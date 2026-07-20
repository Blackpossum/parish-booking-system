import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Booking } from '../../lib/api';
import { PageHeading, BookingStatusTag } from '../../components/ui';
import { useScheduleSocket } from '../../hooks/useScheduleSocket';

export function AntreanPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listBookings({ status: 'pending' })
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  // New requests from umat arrive here without a refresh.
  useScheduleSocket(load);

  async function decide(id: string, action: 'approve' | 'reject') {
    setError(null);
    setBusyId(id);
    try {
      if (action === 'approve') await api.approveBooking(id);
      else await api.rejectBooking(id);
      load();
    } catch (err) {
      // A 409 means another admin just approved a conflicting slot — say so plainly.
      setError(
        err instanceof ApiError ? err.message : 'Gagal memproses pengajuan. Coba lagi.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeading
        title="Antrean Persetujuan"
        subtitle="Setujui atau tolak pengajuan booking. Ruangan yang sudah terpakai pada jam yang sama tidak dapat disetujui ganda."
      />

      {error && (
        <div className="card p-3 mb-4 border-[var(--color-accent-2)]">
          <p className="text-sm text-[var(--color-accent-2)]">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-[var(--color-muted)]">Memuat…</p>
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-muted)]">Tidak ada pengajuan yang menunggu persetujuan.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[60rem]">
            <thead>
              <tr>
                <th>Ruangan</th>
                <th>Pemohon</th>
                <th>Lingkungan</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th>Keperluan</th>
                <th>Surat</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.room?.name ?? '—'}</td>
                  <td>{b.pemohon?.nama ?? b.requesterName}</td>
                  <td className="text-[var(--color-muted)]">{b.pemohon?.lingkungan ?? '—'}</td>
                  <td className="whitespace-nowrap">{fmtDate(b.startTime)}</td>
                  <td className="whitespace-nowrap">
                    {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                  </td>
                  <td className="text-[var(--color-muted)]">
                    {b.purpose}
                    {b.timPelayanan && (
                      <span className="block text-xs">Tim: {b.timPelayanan}</span>
                    )}
                    {b.peminjamanBerkala && (
                      <span className="block text-xs">Peminjaman berkala</span>
                    )}
                  </td>
                  <td>
                    {b.suratPermohonanUrl ? (
                      <a
                        href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${b.suratPermohonanUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-accent)] underline underline-offset-4 text-sm"
                      >
                        PDF
                      </a>
                    ) : (
                      <span className="text-[var(--color-muted)] text-sm">—</span>
                    )}
                  </td>
                  <td>
                    <BookingStatusTag status={b.status} />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn"
                        disabled={busyId === b.id}
                        onClick={() => decide(b.id, 'approve')}
                      >
                        Setujui
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={busyId === b.id}
                        onClick={() => decide(b.id, 'reject')}
                      >
                        Tolak
                      </button>
                    </div>
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
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
