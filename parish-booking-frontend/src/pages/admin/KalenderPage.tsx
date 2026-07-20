import { useCallback, useEffect, useState } from 'react';
import { api, type Booking, type Room } from '../../lib/api';
import { PageHeading } from '../../components/ui';
import { ScheduleGrid } from '../../components/ScheduleGrid';
import { useScheduleSocket } from '../../hooks/useScheduleSocket';

export function KalenderPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(() => {
    api.todaysSchedule().then(setBookings);
  }, []);

  useEffect(() => {
    Promise.all([api.listRooms(), api.todaysSchedule()])
      .then(([r, b]) => {
        setRooms(r);
        setBookings(b);
      })
      .finally(() => setLoading(false));

    const clock = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(clock);
  }, []);

  // Approvals show up on the calendar as they happen.
  useScheduleSocket(loadSchedule);

  const today = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeading
        title="Kalender Ruangan"
        subtitle={`${today} — booking yang sudah disetujui untuk hari ini.`}
      />

      {loading ? (
        <p className="text-[var(--color-muted)]">Memuat…</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <ScheduleGrid rooms={rooms} bookings={bookings} now={now} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
