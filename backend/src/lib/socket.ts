import type { Server } from "socket.io";

let io: Server | null = null;

export function configureSocketServer(server: Server) {
  io = server;
}

export function emitToUser(
  userId: string,
  event: string,
  payload: unknown,
) {
  io?.to(`user:${userId}`).emit(event, payload);
}