import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { parishDayRange } from '../config/time';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.room.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  // "Ketersediaan Ruangan": the room plus its approved bookings for a given day,
  // so the frontend can render Tersedia/Terpakai slots.
  async availability(id: string, dateStr?: string) {
    const room = await this.findOne(id);

    // Same timezone trap as the display schedule: the availability table must
    // cover the parish's calendar day, not the server's UTC one.
    const { start, end } = parishDayRange(dateStr ? new Date(dateStr) : new Date());

    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId: id,
        status: 'approved',
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'asc' },
      select: { id: true, startTime: true, endTime: true, purpose: true },
    });

    return { room, date: start.toISOString(), bookings };
  }

  create(dto: CreateRoomDto) {
    return this.prisma.room.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id); // 404s early if missing
    return this.prisma.room.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    // Soft-delete only — rooms are never hard-deleted since bookings reference them.
    return this.prisma.room.update({ where: { id }, data: { isActive: false } });
  }
}
