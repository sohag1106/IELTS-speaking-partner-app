import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Lazily connect (or reuse) the authenticated socket. */
export function connectSocket(token: string): Socket {
  if (socket) {
    if (socket.auth !== undefined) {
      (socket.auth as { token?: string }).token = token;
    }
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io('/', {
    auth: { token },
    // reconnection is on by default
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

/** emit with ack + timeout; resolves the ack payload or rejects. */
export function emitAck<T = { ok: boolean; error?: string; code?: string }>(
  sock: Socket,
  event: string,
  payload?: unknown,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    const cb = (res: T) => {
      clearTimeout(timer);
      resolve(res);
    };
    if (payload === undefined) {
      sock.emit(event, cb);
    } else {
      sock.emit(event, payload, cb);
    }
  });
}
