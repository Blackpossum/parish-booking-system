import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { DecideBookingDto } from './dto/decide-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { ScheduleGateway } from '../schedule/schedule.gateway';
import { PushService } from '../push/push.service';

// Postgres error code for an EXCLUDE constraint violation.
// See: https://www.postgresql.org/docs/current/errcodes-appendix.html
const EXCLUSION_VIOLATION = '23P01';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private scheduleGateway: ScheduleGateway,
    private push: PushService,
  ) {}

  async create(dto: CreateBookingDto, pemohonId: string, suratPermohonanUrl?: string) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // No conflict check here on purpose: multiple pending requests for the
    // same slot are allowed to coexist. The room is only "claimed" at
    // approval time — see approve() below.
    const created = await this.prisma.booking.create({
      data: {
        roomId: dto.roomId,
        pemohonId,
        requesterName: dto.requesterName,
        requesterContact: dto.requesterContact,
        timPelayanan: dto.timPelayanan,
        purpose: dto.purpose,
        peminjamanBerkala: dto.peminjamanBerkala ?? false,
        suratPermohonanUrl,
        startTime: start,
        endTime: end,
      },
      include: { room: true },
    });

    // Tells the admin's approval queue a new request just landed. Without this
    // the queue only updated on a manual refresh.
    this.scheduleGateway.broadcastScheduleChanged(created.roomId);
    return created;
  }

  findAll(query: QueryBookingsDto) {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.roomId) where.roomId = query.roomId;
    if (query.from || query.to) {
      where.startTime = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return this.prisma.booking.findMany({
      where,
      include: { room: true, pemohon: { select: { nama: true, lingkungan: true } } },
      orderBy: { startTime: 'asc' },
    });
  }

  // "Booking Saya" — a umat's own submissions, newest first.
  findMine(pemohonId: string) {
    return this.prisma.booking.findMany({
      where: { pemohonId },
      include: { room: true },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true, pemohon: { select: { nama: true, lingkungan: true } } },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  /**
   * Approve a pending booking. This is the one operation where two admins
   * could race on the same room/slot. Rather than doing a check-then-write
   * (which has a TOCTOU race), we let the write itself hit the Postgres
   * exclusion constraint (see migration 20260717000000) and translate that
   * failure into a clean 409 for the caller.
   */
  async approve(id: string, adminId: string, dto: DecideBookingDto) {
    const booking = await this.findOne(id);
    if (booking.status !== 'pending') {
      throw new BadRequestException(`Booking is already ${booking.status}`);
    }

    try {
      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          status: 'approved',
          adminNote: dto.adminNote,
          decidedById: adminId,
          decidedAt: new Date(),
        },
        include: { room: true },
      });

      this.scheduleGateway.broadcastScheduleChanged(updated.roomId);
      void this.notifyDecision(updated.pemohonId, updated.room.name, updated.startTime, 'approved');
      return updated;
    } catch (err) {
      // Prisma has no first-class error code for a custom EXCLUDE constraint
      // (that's only mapped for its own known constraints, e.g. P2002 for
      // UNIQUE). The violation surfaces as a raw Postgres error wrapped in
      // Prisma's "unknown request error", so we detect it by message/code
      // instead. Verify the exact wording against your installed Prisma
      // version before relying on it in prod.
      const message = err instanceof Error ? err.message : String(err);
      const looksLikeExclusionViolation =
        message.includes(EXCLUSION_VIOLATION) ||
        message.includes('no_overlapping_approved_bookings');

      if (looksLikeExclusionViolation) {
        throw new ConflictException(
          'Ruangan ini sudah punya booking disetujui yang beririsan dengan jam tersebut.',
        );
      }
      throw err;
    }
  }

  async reject(id: string, adminId: string, dto: DecideBookingDto) {
    const booking = await this.findOne(id);
    if (booking.status !== 'pending') {
      throw new BadRequestException(`Booking is already ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'rejected',
        adminNote: dto.adminNote,
        decidedById: adminId,
        decidedAt: new Date(),
      },
      include: { room: true },
    });

    // A rejection frees the slot for other pending requests, so every listening
    // screen needs to know — not just on approval.
    this.scheduleGateway.broadcastScheduleChanged(updated.roomId);
    void this.notifyDecision(updated.pemohonId, updated.room.name, updated.startTime, 'rejected');
    return updated;
  }

  // Push the outcome to the requester's devices. Deliberately fire-and-forget:
  // a failed notification must never fail the admin's approve/reject action.
  private async notifyDecision(
    pemohonId: string,
    roomName: string,
    startTime: Date,
    outcome: 'approved' | 'rejected',
  ) {
    const when = startTime.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    const approved = outcome === 'approved';

    await this.push.notifyUser(pemohonId, {
      title: approved ? 'Booking Disetujui' : 'Booking Ditolak',
      body: approved
        ? `Peminjaman ${roomName} pada ${when} telah disetujui sekretariat.`
        : `Peminjaman ${roomName} pada ${when} tidak dapat disetujui. Buka aplikasi untuk detail.`,
      url: '/booking-saya',
      tag: 'booking-update',
    });
  }

  /** Used by the public display screen: today's approved bookings, grouped by room. */
  async findTodaysApprovedSchedule() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.booking.findMany({
      where: {
        status: 'approved',
        startTime: { gte: startOfDay, lte: endOfDay },
      },
      include: { room: true },
      orderBy: [{ roomId: 'asc' }, { startTime: 'asc' }],
    });
  }
}
