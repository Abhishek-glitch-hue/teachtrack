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

messageRouter.get("/unread-count", requireAuth, async (request, response) => {
  const count = await prisma.message.count({
    where: { receiverId: request.user!.id, readAt: null },
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
  return response.json({ users });
});

messageRouter.get("/conversations", requireAuth, async (request, response) => {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: request.user!.id }, { receiverId: request.user!.id }] },
    include: {
      sender: { select: { id: true, name: true, email: true, department: true, role: true } },
      receiver: { select: { id: true, name: true, email: true, department: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const conversations = new Map<string, { user: typeof messages[number]["sender"]; lastMessage: typeof messages[number]; unreadCount: number }>();
  for (const message of messages) {
    const user = message.senderId === request.user!.id ? message.receiver : message.sender;
    const existing = conversations.get(user.id);
    if (!existing) conversations.set(user.id, { user, lastMessage: message, unreadCount: 0 });
    if (message.receiverId === request.user!.id && !message.readAt) {
      conversations.get(user.id)!.unreadCount += 1;
    }
  }
  return response.json({ conversations: Array.from(conversations.values()) });
});

messageRouter.get("/:userId", requireAuth, async (request, response) => {
  const userId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true, email: true, department: true, role: true } });
  if (!user || user.id === request.user!.id) return response.status(404).json({ message: "User not found." });

  const markedRead = await prisma.message.updateMany({
    where: { senderId: user.id, receiverId: request.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (markedRead.count > 0) {
    emitToUser(request.user!.id, "message:read", { senderId: user.id });
  }
  const messages = await prisma.message.findMany({
    where: { OR: [
      { senderId: request.user!.id, receiverId: user.id },
      { senderId: user.id, receiverId: request.user!.id },
    ] },
    orderBy: { createdAt: "asc" },
  });
  return response.json({ user, messages });
});

messageRouter.post("/", requireAuth, async (request, response) => {
  const parsed = sendMessageSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Enter a message of up to 2,000 characters." });
  if (parsed.data.receiverId === request.user!.id) return response.status(400).json({ message: "You cannot message yourself." });

  const receiver = await prisma.user.findFirst({ where: { id: parsed.data.receiverId, isActive: true }, select: { id: true } });
  if (!receiver) return response.status(404).json({ message: "Recipient not found." });

  const message = await prisma.message.create({
    data: { senderId: request.user!.id, receiverId: receiver.id, content: parsed.data.content },
  });
  emitToUser(receiver.id, "message:new", { message, sender: { id: request.user!.id, name: request.user!.name } });
  return response.status(201).json({ message });
});

export default messageRouter;
