import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parishWeekRange } from '../config/time';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    // "Minggu ini" — bookings whose start falls in the current week (Mon–Sun),
    // bounded in the parish timezone rather than the server's UTC day.
    const { start: weekStart, end: weekEnd } = parishWeekRange();

    const [bookingsThisWeek, pendingCount, activeRooms, newReports, pending] = await Promise.all([
      this.prisma.booking.count({
        where: { startTime: { gte: weekStart, lt: weekEnd } },
      }),
      this.prisma.booking.count({ where: { status: 'pending' } }),
      this.prisma.room.count({ where: { isActive: true } }),
      this.prisma.feedback.count({ where: { type: 'violation_report', status: 'new' } }),
      this.prisma.booking.findMany({
        where: { status: 'pending' },
        include: { room: true, pemohon: { select: { nama: true, lingkungan: true } } },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
    ]);

    return {
      bookingsThisWeek,
      pendingCount,
      activeRooms,
      newReports,
      pending,
    };
  }
}
