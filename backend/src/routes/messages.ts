import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { requireAuth } from "../middleware/auth.ts";

const messageRouter = Router();
const sendMessageSchema = z.object({
  receiverId: z.string().min(1),
  content: z.string().trim().min(1).max(2_000),
});
const connectionSchema = z.object({ recipientId: z.string().min(1) });

async function teacherConnection(firstId: string, secondId: string) {
  return prisma.messageConnection.findFirst({ where: { OR: [{ requesterId: firstId, recipientId: secondId }, { requesterId: secondId, recipientId: firstId }] } });
}

async function canMessage(sender: { id: string; role: "ADMIN" | "TEACHER" }, receiver: { id: string; role: "ADMIN" | "TEACHER" }) {
  return sender.role === "ADMIN" || receiver.role === "ADMIN" || (await teacherConnection(sender.id, receiver.id))?.status === "ACCEPTED";
}

messageRouter.get("/unread-count", requireAuth, async (request, response) => {
  const count = await prisma.message.count({
    where: { receiverId: request.user!.id, readAt: null, hiddenFromReceiver: false },
  });
  return response.json({ count });
});

messageRouter.get("/users", requireAuth, async (request, response) => {
  const query = Array.isArray(request.query.q) ? request.query.q[0] : request.query.q;
  const search = typeof query === "string" ? query.trim() : "";
  const users = await prisma.user.findMany({
    where: {
      id: { not: request.user!.id },
      isActive: true,
      ...(search ? { OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
      ] } : {}),
    },
    select: { id: true, name: true, email: true, department: true, role: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  const connections = await prisma.messageConnection.findMany({ where: { OR: [{ requesterId: request.user!.id }, { recipientId: request.user!.id }] } });
  return response.json({ users: users.map((user) => {
    const connection = connections.find((item) => item.requesterId === user.id || item.recipientId === user.id);
    const connectionStatus = connection?.status === "ACCEPTED" ? "ACCEPTED" : connection?.status === "PENDING" ? (connection.requesterId === request.user!.id ? "OUTGOING" : "INCOMING") : "NONE";
    return { ...user, connectionStatus, connectionId: connection?.id ?? null };
  }) });
});

messageRouter.post("/requests", requireAuth, async (request, response) => {
  const parsed = connectionSchema.safeParse(request.body);
  if (!parsed.success || parsed.data.recipientId === request.user!.id) return response.status(400).json({ message: "Choose another user." });

  const recipient = await prisma.user.findFirst({
    where: { id: parsed.data.recipientId, isActive: true },
    select: { id: true, role: true },
  });
  if (!recipient) return response.status(400).json({ message: "User not found or inactive." });

  if (request.user!.role === "ADMIN") {
    return response.status(201).json({ connection: null, directMessage: true, recipientId: recipient.id });
  }

  if (request.user!.role !== "TEACHER" || recipient.role !== "TEACHER") return response.status(400).json({ message: "Requests can only be sent to active teachers." });

  const existing = await teacherConnection(request.user!.id, recipient.id);
  if (existing?.status === "ACCEPTED") return response.status(409).json({ message: "You are already connected." });
  if (existing?.status === "PENDING") return response.status(409).json({ message: "A request is already pending." });
  const connection = existing ? await prisma.messageConnection.update({ where: { id: existing.id }, data: { requesterId: request.user!.id, recipientId: recipient.id, status: "PENDING" } }) : await prisma.messageConnection.create({ data: { requesterId: request.user!.id, recipientId: recipient.id } });
  emitToUser(recipient.id, "message:connection-request", { connectionId: connection.id, requester: request.user!.name });
  return response.status(201).json({ connection });
});

messageRouter.patch("/requests/:id", requireAuth, async (request, response) => {
  if (request.body?.status !== "ACCEPTED" && request.body?.status !== "REJECTED") return response.status(400).json({ message: "Choose ACCEPTED or REJECTED." });
  const connection = await prisma.messageConnection.findFirst({ where: { id: String(request.params.id), recipientId: request.user!.id, status: "PENDING" } });
  if (!connection) return response.status(404).json({ message: "Request not found." });
  const updated = await prisma.messageConnection.update({ where: { id: connection.id }, data: { status: request.body.status } });
  emitToUser(connection.requesterId, "message:connection-updated", updated);
  return response.json({ connection: updated });
});

messageRouter.delete("/requests/:id", requireAuth, async (request, response) => {
  const targetId = String(request.params.id);
  const connection = await prisma.messageConnection.findFirst({ where: {
    OR: [
      { id: targetId },
      { requesterId: request.user!.id, recipientId: targetId },
      { requesterId: targetId, recipientId: request.user!.id },
    ],
    AND: [{ OR: [{ requesterId: request.user!.id }, { recipientId: request.user!.id }] }],
  } });
  if (!connection) return response.status(404).json({ message: "Connection not found." });
  await prisma.messageConnection.delete({ where: { id: connection.id } });
  const otherUserId = connection.requesterId === request.user!.id ? connection.recipientId : connection.requesterId;
  emitToUser(otherUserId, "message:connection-updated", { connectionId: connection.id, status: "REMOVED" });
  return response.status(204).end();
});

messageRouter.delete("/connections/:userId", requireAuth, async (request, response) => {
  const otherUserId = String(request.params.userId);
  const connection = await prisma.messageConnection.findFirst({
    where: {
      OR: [
        { requesterId: request.user!.id, recipientId: otherUserId },
        { requesterId: otherUserId, recipientId: request.user!.id },
      ],
    },
  });
  if (!connection) return response.status(404).json({ message: "Friend connection not found." });
  await prisma.messageConnection.delete({ where: { id: connection.id } });
  emitToUser(otherUserId, "message:connection-updated", { connectionId: connection.id, status: "REMOVED" });
  return response.status(204).end();
});

messageRouter.get("/conversations", requireAuth, async (request, response) => {
  const messages = await prisma.message.findMany({
    where: { OR: [
      { senderId: request.user!.id, hiddenFromSender: false },
      { receiverId: request.user!.id, hiddenFromReceiver: false },
    ] },
    include: {
      sender: { select: { id: true, name: true, email: true, department: true, role: true } },
      receiver: { select: { id: true, name: true, email: true, department: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const acceptedConnectionUserIds = request.user!.role === "ADMIN"
    ? null
    : new Set((await prisma.messageConnection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: request.user!.id }, { recipientId: request.user!.id }],
      },
      select: { requesterId: true, recipientId: true },
    })).map((connection) => connection.requesterId === request.user!.id ? connection.recipientId : connection.requesterId));
  const visibleMessages = acceptedConnectionUserIds
    ? messages.filter((message) => message.sender.role === "ADMIN" || message.receiver.role === "ADMIN" || acceptedConnectionUserIds.has(message.senderId === request.user!.id ? message.receiverId : message.senderId))
    : messages;
  const conversations = new Map<string, { user: typeof messages[number]["sender"]; lastMessage: typeof messages[number]; unreadCount: number }>();
  for (const message of visibleMessages) {
    const user = message.senderId === request.user!.id ? message.receiver : message.sender;
    const existing = conversations.get(user.id);
    if (!existing) conversations.set(user.id, { user, lastMessage: message, unreadCount: 0 });
    if (message.receiverId === request.user!.id && !message.readAt) {
      conversations.get(user.id)!.unreadCount += 1;
    }
  }
  return response.json({ conversations: Array.from(conversations.values()) });
});

messageRouter.delete("/:userId", requireAuth, async (request, response) => {
  const userId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;
  if (userId === request.user!.id) return response.status(400).json({ message: "You cannot clear a conversation with yourself." });

  const [sent, received] = await prisma.$transaction([
    prisma.message.updateMany({
      where: { senderId: request.user!.id, receiverId: userId },
      data: { hiddenFromSender: true },
    }),
    prisma.message.updateMany({
      where: { senderId: userId, receiverId: request.user!.id },
      data: { hiddenFromReceiver: true },
    }),
  ]);
  return response.json({ hiddenCount: sent.count + received.count });
});

messageRouter.get("/:userId", requireAuth, async (request, response) => {
  const userId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true, email: true, department: true, role: true } });
  if (!user || user.id === request.user!.id) return response.status(404).json({ message: "User not found." });
  const connection = await teacherConnection(request.user!.id, user.id);
  if (!(await canMessage(request.user!, user))) {
    const connectionStatus = connection?.status === "PENDING" ? (connection.requesterId === request.user!.id ? "OUTGOING" : "INCOMING") : "NONE";
    return response.json({ user, messages: [], canMessage: false, connectionId: connection?.id ?? null, connectionStatus });
  }

  const markedRead = await prisma.message.updateMany({
    where: { senderId: user.id, receiverId: request.user!.id, readAt: null, hiddenFromReceiver: false },
    data: { readAt: new Date() },
  });
  if (markedRead.count > 0) {
    emitToUser(request.user!.id, "message:read", { senderId: user.id });
  }
  const messages = await prisma.message.findMany({
    where: { OR: [
      { senderId: request.user!.id, receiverId: user.id, hiddenFromSender: false },
      { senderId: user.id, receiverId: request.user!.id, hiddenFromReceiver: false },
    ] },
    orderBy: { createdAt: "asc" },
  });
  return response.json({ user, messages, canMessage: true });
});

messageRouter.post("/", requireAuth, async (request, response) => {
  const parsed = sendMessageSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Enter a message of up to 2,000 characters." });
  if (parsed.data.receiverId === request.user!.id) return response.status(400).json({ message: "You cannot message yourself." });

  const receiver = await prisma.user.findFirst({ where: { id: parsed.data.receiverId, isActive: true }, select: { id: true, role: true } });
  if (!receiver) return response.status(404).json({ message: "Recipient not found." });
  if (!(await canMessage(request.user!, receiver))) return response.status(403).json({ message: "This teacher must accept a connection request before messaging." });

  const message = await prisma.message.create({
    data: { senderId: request.user!.id, receiverId: receiver.id, content: parsed.data.content },
  });
  emitToUser(receiver.id, "message:new", { message, sender: { id: request.user!.id, name: request.user!.name } });
  return response.status(201).json({ message });
});

export default messageRouter;
