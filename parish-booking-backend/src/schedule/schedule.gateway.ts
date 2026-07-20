import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { isOriginAllowed } from '../config/cors';

// The display screen connects here and just listens — it never sends
// anything back. Kept as its own small gateway so BookingsService can
// depend on this instead of the whole websockets module.
//
// Shares the HTTP layer's origin allowlist (see config/cors.ts) so the two
// can't drift apart.
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, isOriginAllowed(origin)),
    credentials: true,
  },
  namespace: 'schedule',
})
export class ScheduleGateway {
  @WebSocketServer()
  server!: Server;

  broadcastScheduleChanged(roomId: string) {
    this.server?.emit('schedule:changed', { roomId, at: new Date().toISOString() });
  }
}
