import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";
import { emitToUser } from "../lib/socket.ts";

const timetableRouter = Router();
const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const types = ["teal", "blue", "purple"] as const;
const settingSchema = z.object({
  day: z.enum(days),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  lectureCount: z.number().int().min(1).max(20),
  duration: z.number().int().min(15).max(240),
}).superRefine((value, context) => {
  if (value.endTime <= value.startTime) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "End time must be later than start time." });
  }
  const availableMinutes = (Number(value.endTime.slice(0, 2)) * 60 + Number(value.endTime.slice(3))) -
    (Number(value.startTime.slice(0, 2)) * 60 + Number(value.startTime.slice(3)));
  if (value.lectureCount * value.duration > availableMinutes) {
    context.addIssue({ code: "custom", path: ["lectureCount"], message: "The selected day is too short for this many lectures." });
  }
});

const lectureSchema = z.object({
  subject: z.string().trim().min(2).max(60),
  className: z.string().trim().min(2).max(40),
  room: z.string().trim().min(2).max(40),
  day: z.enum(days),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  type: z.enum(types),
});

timetableRouter.get("/", requireAuth, async (request, response) => {
  const [lectures, settings] = await Promise.all([
    prisma.timetableLecture.findMany({
    where: { userId: request.user!.id },
    orderBy: [{ day: "asc" }, { time: "asc" }],
    }),
    prisma.timetableSetting.findMany({
      where: { userId: request.user!.id },
      orderBy: { day: "asc" },
    }),
  ]);
  return response.json({ lectures, settings });
});

timetableRouter.put("/settings/:day", requireAuth, async (request, response) => {
  const parsed = settingSchema.safeParse({ ...request.body, day: request.params.day });
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || "Please provide valid timetable settings." });

  const setting = await prisma.timetableSetting.upsert({
    where: { userId_day: { userId: request.user!.id, day: parsed.data.day } },
    create: { ...parsed.data, userId: request.user!.id },
    update: { startTime: parsed.data.startTime, endTime: parsed.data.endTime, lectureCount: parsed.data.lectureCount, duration: parsed.data.duration },
  });
  emitToUser(request.user!.id, "dashboard:updated", { source: "timetable" });
  return response.json({ setting });
});

timetableRouter.post("/", requireAuth, async (request, response) => {
  const parsed = lectureSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Please provide valid lecture details." });

  try {
    const lecture = await prisma.timetableLecture.create({
      data: { ...parsed.data, userId: request.user!.id },
    });
    emitToUser(request.user!.id, "dashboard:updated", { source: "timetable" });
    return response.status(201).json({ lecture });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return response.status(409).json({ message: "A lecture already exists in that time slot." });
    }
    throw error;
  }
});

timetableRouter.patch("/:id", requireAuth, async (request, response) => {
  const parsed = lectureSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Please provide valid lecture details." });

  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await prisma.timetableLecture.findFirst({ where: { id, userId: request.user!.id } });
  if (!existing) return response.status(404).json({ message: "Lecture not found." });

  try {
    const lecture = await prisma.timetableLecture.update({ where: { id: existing.id }, data: parsed.data });
    emitToUser(request.user!.id, "dashboard:updated", { source: "timetable" });
    return response.json({ lecture });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return response.status(409).json({ message: "A lecture already exists in that time slot." });
    }
    throw error;
  }
});

timetableRouter.delete("/:id", requireAuth, async (request, response) => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const deleted = await prisma.timetableLecture.deleteMany({ where: { id, userId: request.user!.id } });
  if (deleted.count === 0) return response.status(404).json({ message: "Lecture not found." });
  emitToUser(request.user!.id, "dashboard:updated", { source: "timetable" });
  return response.status(204).end();
});

export default timetableRouter;
