import { Server as SocketIOServer } from 'socket.io';

// ─── Socket.IO Instance (singleton) ──────────────────────────────────────────
let _io: SocketIOServer | null = null;

export function initSocket(io: SocketIOServer): void {
  _io = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Emit an event to all connected socket clients.
 * Safe to call even before socket is initialized (no-op).
 */
export function emitSocketEvent(event: string, data: unknown): void {
  if (_io) {
    _io.emit(event, data);
  }
}
