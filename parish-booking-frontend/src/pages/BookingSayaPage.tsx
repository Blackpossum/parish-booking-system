import { useCallback, useEffect, useState } from 'react';
import { api, type Booking } from '../lib/api';
import { PageHeading, BookingStatusTag } from '../components/ui';
import { useScheduleSocket } from '../hooks/useScheduleSocket';

export function BookingSayaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.myBookings().then(setBookings);
  }, []);

  useEffect(() => {
    api
      .myBookings()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  // The umat sees Menunggu flip to Disetujui/Ditolak without refreshing.
  useScheduleSocket(load);

  return (
    <>
      <PageHeading title="Booking Saya" subtitle="Riwayat dan status pengajuan booking ruangan Anda." />

      {loading ? (
        <p className="text-[var(--color-muted)]">Memuat…</p>
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-muted)]">Anda belum mengajukan booking apa pun.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[44rem]">
            <thead>
              <tr>
                <th>Ruangan</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th>Keperluan</th>
                <th>Surat</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.room?.name ?? '—'}</td>
                  <td className="whitespace-nowrap">{fmtDate(b.startTime)}</td>
                  <td className="whitespace-nowrap">
                    {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                  </td>
                  <td className="text-[var(--color-muted)]">{b.purpose}</td>
                  <td>
                    {b.suratPermohonanUrl ? (
                      <a
                        href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${b.suratPermohonanUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-accent)] underline underline-offset-4 text-sm"
                      >
                        Lihat PDF
                      </a>
                    ) : (
                      <span className="text-[var(--color-muted)] text-sm">—</span>
                    )}
                  </td>
                  <td>
                    <BookingStatusTag status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
