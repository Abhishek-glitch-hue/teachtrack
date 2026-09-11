import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { requireAuth } from "../middleware/auth.ts";

const calendarRouter = Router();

const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(["REMINDER", "MEETING", "EXAM", "LEAVE", "DUTY"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
}).superRefine((data, context) => {
  if (data.reminderAt && new Date(data.reminderAt) < new Date(data.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reminderAt"], message: "Reminder cannot be earlier than the event." });
  }
});

function notificationMessage(title: string, startsAt: string) {
  return `${title} is scheduled for ${new Date(startsAt).toLocaleString()}.`;
}

function isBeforeToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

calendarRouter.get("/", requireAuth, async (request, response) => {
  const events = await prisma.calendarEvent.findMany({
    where: { userId: request.user!.id },
    orderBy: { startsAt: "asc" },
  });
  return response.json({ events });
});

calendarRouter.post("/", requireAuth, async (request, response) => {
  const parsed = eventSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || "Please provide valid event details." });
  if (isBeforeToday(parsed.data.startsAt)) return response.status(400).json({ message: "Event date cannot be earlier than today." });

  const event = await prisma.calendarEvent.create({
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      startsAt: new Date(parsed.data.startsAt),
      reminderAt: parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null,
      userId: request.user!.id,
    },
  });

  if (event.reminderAt) {
    const notification = await prisma.notification.create({
      data: {
        userId: event.userId,
        type: "REMINDER",
        title: `Reminder: ${event.title}`,
        message: notificationMessage(event.title, event.startsAt.toISOString()),
      },
    });
    emitToUser(event.userId, "notification:new", notification);
  }
  emitToUser(event.userId, "dashboard:updated", { source: "calendar" });

  return response.status(201).json({ event });
});

calendarRouter.patch("/:id", requireAuth, async (request, response) => {
  const parsed = eventSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || "Please provide valid event details." });
  if (isBeforeToday(parsed.data.startsAt)) return response.status(400).json({ message: "Event date cannot be earlier than today." });

  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: request.user!.id } });
  if (!existing) return response.status(404).json({ message: "Event not found." });

  const event = await prisma.calendarEvent.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      startsAt: new Date(parsed.data.startsAt),
      reminderAt: parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null,
    },
  });

  if (event.reminderAt && !existing.reminderAt) {
    const notification = await prisma.notification.create({
      data: {
        userId: event.userId,
        type: "REMINDER",
        title: `Reminder: ${event.title}`,
        message: notificationMessage(event.title, event.startsAt.toISOString()),
      },
    });
    emitToUser(event.userId, "notification:new", notification);
  }
  emitToUser(event.userId, "dashboard:updated", { source: "calendar" });

  return response.json({ event });
});

calendarRouter.delete("/:id", requireAuth, async (request, response) => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const deleted = await prisma.calendarEvent.deleteMany({ where: { id, userId: request.user!.id } });
  if (deleted.count === 0) return response.status(404).json({ message: "Event not found." });
  emitToUser(request.user!.id, "dashboard:updated", { source: "calendar" });
  return response.status(204).end();
});

export default calendarRouter;