import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from '../lib/api';

/**
 * Subscribes to the backend's `schedule:changed` broadcast and calls `onChange`
 * whenever anything about the booking schedule moves — a new request, an
 * approval, or a rejection.
 *
 * Every screen that shows booking data needs this; previously only the Monitor
 * Display opened a socket, so the admin queue, the calendar, the availability
 * view and "Booking Saya" all sat on stale data until someone hit refresh.
 *
 * Returns `connected` so callers can decide whether a polling fallback is
 * needed — while the socket is up, polling is redundant traffic.
 */
export function useScheduleSocket(onChange: () => void) {
  const [connected, setConnected] = useState(false);

  // Keep the latest callback in a ref so re-renders don't tear down the socket.
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const socket: Socket = io(`${API_BASE}/schedule`, { transports: ['websocket'] });

    socket.on('connect', () => {
      setConnected(true);
      // Catch up: any schedule:changed emitted while we were disconnected is
      // gone for good, so refetch once on (re)connect.
      handler.current();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('schedule:changed', () => handler.current());

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected };
}
