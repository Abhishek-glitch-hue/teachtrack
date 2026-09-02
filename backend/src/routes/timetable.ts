import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";
import { emitToUser } from "../lib/socket.ts";

const timetableRouter = Router();
const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const times = ["09:00", "10:00", "11:00"] as const;
const types = ["teal", "blue", "purple"] as const;

const lectureSchema = z.object({
  subject: z.string().trim().min(2).max(60),
  className: z.string().trim().min(2).max(40),
  room: z.string().trim().min(2).max(40),
  day: z.enum(days),
  time: z.enum(times),
  type: z.enum(types),
});

timetableRouter.get("/", requireAuth, async (request, response) => {
  const lectures = await prisma.timetableLecture.findMany({
    where: { userId: request.user!.id },
    orderBy: [{ day: "asc" }, { time: "asc" }],
  });
  return response.json({ lectures });
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
