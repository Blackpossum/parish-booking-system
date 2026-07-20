import {useMemo} from 'react';
import type { Booking} from '../lib/api';
import LinePointer from './calendarGrid/LinePointer';
import RoomHeader from './calendarGrid/RoomHeader';
import RoomColumn from './calendarGrid/RoomColumn';
import { HourSizeByPx } from '../constant/calendarGridConstant';
import type { ScheduleGridProps } from '../interface/calendarGridInterface';

// Shared day-calendar used by the admin Kalender page and the Monitor Display.
// Rooms are columns, hours run down the left rail, and the current time is drawn
// ONCE across all columns (Google-Calendar style) rather than per column.

export function ScheduleGrid({
  rooms,
  bookings,
  now,
  dayStartHour = 6,
  dayEndHour = 22,
  dense = false,
  placeholder,
}: ScheduleGridProps) {
  // const scrollReff= useRef<HTMLDivElement>(null);

  const hourPx = dense ? 42 : HourSizeByPx;
  const gridHeight = (dayEndHour - dayStartHour) * hourPx;
  
  const dayStart = new Date(now);
  dayStart.setHours(dayStartHour, 0, 0, 0);
  
  const hourMarks = useMemo(
    () => Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, i) => i + dayStartHour),
    [dayStartHour, dayEndHour],
  );

  const minutesToPx = (min: number) => (min / 60) * hourPx;
  const clamp = (px: number) => Math.min(Math.max(px, 0), gridHeight);
  const offsetPx = (d: Date) =>
    clamp(minutesToPx(Math.max((d.getTime() - dayStart.getTime()) / 60000, 0)));

  const nowY = offsetPx(now);
  const byRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const r of rooms) map.set(r.id, []);
    for (const b of bookings) {
      if (!map.has(b.roomId)) map.set(b.roomId, []);
      map.get(b.roomId)!.push(b);
    }
    // console.log("[DEBUG] byRoom Map:", map)
    return map;
  }, [rooms, bookings]);

  //   useLayoutEffect(() => {
  //   const container = scrollReff.current;
  //   if (!container) return;

  //   const nowPosition = offsetPx(new Date());

  //   container.scrollTop = Math.max(
  //     nowPosition - container.clientHeight / 2,
  //     0
  //   );
  // }, []);

  if (rooms.length === 0) {
    return <p className="p-8 text-center text-[var(--color-muted)]">{placeholder ? placeholder: "Belum ada ruangan aktif."}</p>;
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Header row — left spacer matches the hour rail so 00:00 lines up exactly */}
      <RoomHeader emptyFirstCol={true} roomData={rooms} dense={dense} />
      
      <div  className="flex overflow-y-auto min-h-0">
        {/* Hour rail */}
        <div
          className="w-14 shrink-0 relative border-r border-[var(--color-hairline)]"
          style={{ height: gridHeight }}
        >
          {hourMarks.map((h) => {
            // console.log("[DEBUG] hourmarks h :", h)
            return (
            <div
              key={h}
              className="absolute left-0 right-0 -translate-y-1/2 text-[10px] text-[var(--color-muted)] px-1"
              style={{ top: (h - dayStartHour) * hourPx }}
            >
              {String(h).padStart(2, '0')}.00
            </div>
          )
          })}
        </div>

        {/* Room columns share one relative wrapper so the now-line spans all of them */}
          <div
            id='room-collumn-container'
            className="flex-1 flex relative" 
            style={{ 
              height: gridHeight 
            }}
            >
            {rooms.map((room) => (
              <RoomColumn
                key={room.id}
                bookings={byRoom.get(room.id) ?? []}
                now={now}
                offsetPx={offsetPx}
                hourMarks={hourMarks}
                dayStartHour={dayStartHour}
                hourPx={hourPx}
              />
            ))}

            {/* One shared current-time line */}
            <LinePointer topPosition={nowY}/>
          </div>

      </div>
    </div>
  );
}
