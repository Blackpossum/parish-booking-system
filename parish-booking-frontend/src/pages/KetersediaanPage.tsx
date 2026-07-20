import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Room, type RoomAvailability } from '../lib/api';
import { PageHeading } from '../components/ui';
import { useScheduleSocket } from '../hooks/useScheduleSocket';

// The availability board is shown as two-hour blocks across the parish's
// usable day, which matches how the secretariat books rooms in practice.
const DAY_START = 7;
const DAY_END = 21;
const SLOT_HOURS = 2;

interface Slot {
  label: string;
  start: Date;
  end: Date;
  booking?: { purpose: string };
}

export function KetersediaanPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<RoomAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRooms().then((r) => {
      setRooms(r);
      if (r.length) setSelectedId((prev) => prev ?? r[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setAvailability(null);
    api.roomAvailability(selectedId).then(setAvailability);
  }, [selectedId]);

  // Refresh the slot table when a booking is approved or rejected elsewhere.
  // Kept silent (no spinner) so the table doesn't flicker under the user.
  const refreshAvailability = useCallback(() => {
    if (!selectedId) return;
    api.roomAvailability(selectedId).then(setAvailability);
  }, [selectedId]);
  useScheduleSocket(refreshAvailability);

  const slots = useMemo<Slot[]>(() => {
    if (!availability) return [];
    const base = new Date(availability.date);
    const out: Slot[] = [];

    for (let h = DAY_START; h < DAY_END; h += SLOT_HOURS) {
      const start = new Date(base);
      start.setHours(h, 0, 0, 0);
      const end = new Date(base);
      end.setHours(h + SLOT_HOURS, 0, 0, 0);

      // A slot counts as taken when any approved booking overlaps it.
      const hit = availability.bookings.find((b) => {
        const bs = new Date(b.startTime);
        const be = new Date(b.endTime);
        return bs < end && be > start;
      });

      out.push({
        label: `${fmt(start)}–${fmt(end)}`,
        start,
        end,
        booking: hit ? { purpose: hit.purpose } : undefined,
      });
    }
    return out;
  }, [availability]);

  const selectedRoom = rooms.find((r) => r.id === selectedId);
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) return <p className="text-[var(--color-muted)]">Memuat…</p>;

  if (rooms.length === 0) {
    return (
      <>
        <PageHeading title="Ketersediaan Ruangan" />
        <p className="text-[var(--color-muted)]">Belum ada ruangan aktif.</p>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Ketersediaan Ruangan"
        subtitle={`${today} — pilih ruangan untuk melihat jadwal hari ini.`}
      />

      {/* Segmented room selector — scrolls horizontally on narrow screens */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`seg ${r.id === selectedId ? 'active' : ''}`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {selectedRoom && (
        <div className="card p-5 mb-6">
          <p className="eyebrow">Detail Ruangan</p>
          <p className="font-display text-xl mt-1">
            {selectedRoom.name} · Kapasitas {selectedRoom.capacity} orang
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {selectedRoom.facilities || '—'}
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[32rem]">
          <thead>
            <tr>
              <th>Jam</th>
              <th>Status</th>
              <th>Kegiatan</th>
            </tr>
          </thead>
          <tbody>
            {!availability && (
              <tr>
                <td colSpan={3} className="text-[var(--color-muted)]">
                  Memuat jadwal…
                </td>
              </tr>
            )}
            {availability &&
              slots.map((s) => (
                <tr key={s.label}>
                  <td className="whitespace-nowrap">{s.label}</td>
                  <td>
                    <span className={`tag ${s.booking ? 'tag-reject' : 'tag-ok'}`}>
                      {s.booking ? 'Terpakai' : 'Tersedia'}
                    </span>
                  </td>
                  <td className="text-[var(--color-muted)]">{s.booking?.purpose ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function fmt(d: Date) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
