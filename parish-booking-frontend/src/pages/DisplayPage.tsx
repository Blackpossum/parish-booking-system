import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { api, type Booking, type Room } from '../lib/api';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { useScheduleSocket } from '../hooks/useScheduleSocket';

// Wall-mounted monitor outside the secretariat: read-only, landscape 16:9,
// refreshes itself from the WebSocket (with a slow poll as a safety net).
export function DisplayPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    api.listRooms().then(setRooms);
  }, []);

  const load = useCallback(() => {
    api.todaysSchedule().then(setBookings);
  }, []);

  // The gateway emits schedule:changed the instant a booking is created,
  // approved or rejected. The hook also refetches on (re)connect.
  const { connected } = useScheduleSocket(load);

  useEffect(() => {
    load();
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, [load]);

  // Polling exists only to cover a dead socket. While the socket is connected,
  // schedule:changed already pushes every update, so polling would just be
  // redundant traffic from a screen that runs 24/7.
  useEffect(() => {
    if (connected) return;
    const poll = setInterval(load, 60_000);
    return () => clearInterval(poll);
  }, [connected, load]);

  const { upcoming, finished } = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    return {
      upcoming: sorted.filter((b) => new Date(b.endTime) > now),
      finished: sorted.filter((b) => new Date(b.endTime) <= now),
    };
  }, [bookings, now]);

  const dateLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // The umat app lives at this origin; the QR sends people straight to it.
  const appUrl = `${window.location.origin}/login`;

  return (
    <div className="h-screen w-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col overflow-hidden">
      {/* Masthead */}
      <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--color-hairline)] shrink-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid place-items-center w-10 h-10 rounded-full border border-[var(--color-neutral)] text-xl"
          >
            ✝
          </span>
          <div className="leading-tight">
            <p className="font-display text-2xl font-semibold">Paroki St. Antonius Purbayan</p>
            <p className="eyebrow">Jadwal Ruang Pertemuan Hari Ini</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-4xl tabular-nums leading-none">{timeLabel}</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">{dateLabel}</p>
        </div>
      </header>

      {/* Three columns: upcoming · calendar · finished */}
      <main className="flex-1 grid grid-cols-[15rem_1fr_15rem] gap-4 p-4 min-h-0">
        <SideColumn title="Akan Datang" items={upcoming} tone="upcoming" now={now} />

        <section className="card min-h-0 overflow-hidden flex flex-col">
          <ScheduleGrid rooms={rooms} bookings={bookings} now={now} dense />
        </section>

        <SideColumn title="Selesai" items={finished} tone="finished" now={now} />
      </main>

      {/* Footer: QR to the umat app + live indicator */}
      <footer className="flex items-center justify-between gap-4 px-6 py-3 border-t border-[var(--color-hairline)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 border border-[var(--color-hairline)]">
            <QRCode value={appUrl} size={52} bgColor="#ffffff" fgColor="#201e1d" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm">Pindai untuk booking ruangan</p>
            <p className="text-xs text-[var(--color-muted)]">
              Masuk dengan akun umat untuk mengajukan peminjaman
            </p>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)] flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? 'var(--color-accent)' : 'var(--color-accent-2)' }}
          />
          {connected ? 'Diperbarui otomatis' : 'Menyambung ulang…'} · Dipasang di luar Ruang
          Sekretariat Paroki
        </p>
      </footer>
    </div>
  );
}

function SideColumn({
  title,
  items,
  tone,
  now,
}: {
  title: string;
  items: Booking[];
  tone: 'upcoming' | 'finished';
  now: Date;
}) {
  return (
    <aside className="card flex flex-col min-h-0">
      <h2
        className="font-display text-lg px-3 py-2 border-b border-[var(--color-hairline)] shrink-0"
        style={{ color: tone === 'upcoming' ? 'var(--color-accent)' : 'var(--color-muted)' }}
      >
        {title}
      </h2>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-[var(--color-muted)] px-1 py-2">
            {tone === 'upcoming' ? 'Tidak ada jadwal berikutnya.' : 'Belum ada yang selesai.'}
          </p>
        )}
        {items.map((b) => {
          const ongoing = new Date(b.startTime) <= now && now < new Date(b.endTime);
          return (
            <div
              key={b.id}
              className="border-l-2 pl-2 py-1"
              style={{
                borderColor:
                  tone === 'finished'
                    ? 'var(--color-neutral)'
                    : ongoing
                      ? 'var(--color-accent-2)'
                      : 'var(--color-accent)',
                opacity: tone === 'finished' ? 0.6 : 1,
              }}
            >
              <p className="text-[11px] text-[var(--color-muted)] tabular-nums">
                {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                {ongoing && <span className="ml-1 font-semibold">· berlangsung</span>}
              </p>
              <p className="font-semibold text-sm leading-tight truncate">{b.purpose}</p>
              <p className="text-[11px] text-[var(--color-muted)] truncate">{b.room?.name}</p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
