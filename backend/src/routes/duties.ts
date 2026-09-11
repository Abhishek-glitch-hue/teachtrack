import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const dutyRouter = Router();
const dutyTypes = ["LECTURES", "INVIGILATION", "MENTORING", "COMMITTEE"] as const;
const dutySchema = z.object({
  assignedToId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  // Default keeps assignment working for a browser tab that still has the
  // previous form cached; newly loaded forms always send the selected value.
  dutyType: z.enum(dutyTypes).optional().default("LECTURES"),
  description: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
});
const statusSchema = z.object({ status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]) });

function isBeforeToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

async function emitDutyToAdmins(duty: unknown) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  admins.forEach((admin) => emitToUser(admin.id, "duty:updated", duty));
}

dutyRouter.get("/", requireAuth, async (request, response) => {
  const duties = await prisma.duty.findMany({
    where: request.user!.role === "ADMIN" ? {} : { assignedToId: request.user!.id },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
    orderBy: { dueAt: "asc" },
  });
  return response.json({
    duties: request.user!.role === "ADMIN"
      ? duties
      : duties.filter((duty) => !duty.hiddenFromTeacher),
    // The teacher's summary must retain hidden history entries so hiding one
    // does not change any workload, active, or completed totals.
    summaryDuties: duties,
  });
});

dutyRouter.get("/teachers", requireAuth, requireRole("ADMIN"), async (_request, response) => {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });
  return response.json({ teachers });
});

dutyRouter.post("/", requireAuth, requireRole("ADMIN"), async (request, response) => {
  const parsed = dutySchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Please provide valid duty details." });
  if (parsed.data.dueAt && isBeforeToday(parsed.data.dueAt)) return response.status(400).json({ message: "Due date cannot be earlier than today." });

  const teacher = await prisma.user.findFirst({ where: { id: parsed.data.assignedToId, role: "TEACHER", isActive: true } });
  if (!teacher) return response.status(404).json({ message: "Teacher not found." });

  const duty = await prisma.duty.create({
    data: {
      assignedToId: teacher.id,
      title: parsed.data.title,
      dutyType: parsed.data.dutyType,
      description: parsed.data.description || null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      status: parsed.data.status || "PENDING",
    },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  const notification = await prisma.notification.create({
    data: { userId: teacher.id, type: "DUTY", title: "New duty assigned", message: `${duty.title} was assigned to you.` },
  });
  emitToUser(teacher.id, "notification:new", notification);
  emitToUser(teacher.id, "duty:updated", duty);
  await emitDutyToAdmins(duty);
  return response.status(201).json({ duty });
});

dutyRouter.patch("/:id/status", requireAuth, async (request, response) => {
  const parsed = statusSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: "Invalid duty status." });
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await prisma.duty.findFirst({ where: { id, ...(request.user!.role === "ADMIN" ? {} : { assignedToId: request.user!.id }) } });
  if (!existing) return response.status(404).json({ message: "Duty not found." });
  const duty = await prisma.duty.update({ where: { id }, data: { status: parsed.data.status }, include: { assignedTo: { select: { id: true, name: true, email: true } } } });
  if (duty.status === "COMPLETED") {
    await prisma.notification.deleteMany({
      where: {
        userId: duty.assignedToId,
        type: "DUTY",
        message: `${duty.title} was assigned to you.`,
      },
    });
  }
  emitToUser(duty.assignedToId, "duty:updated", duty);
  await emitDutyToAdmins(duty);
  return response.json({ duty });
});

dutyRouter.delete("/:id/history", requireAuth, requireRole("TEACHER"), async (request, response) => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const duty = await prisma.duty.findFirst({ where: { id, assignedToId: request.user!.id } });
  if (!duty) return response.status(404).json({ message: "Duty not found." });

  await prisma.duty.update({
    where: { id: duty.id },
    data: { hiddenFromTeacher: true },
  });

  return response.status(204).end();
});

dutyRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (request, response) => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await prisma.duty.findUnique({ where: { id } });
  if (!existing) return response.status(404).json({ message: "Duty not found." });
  const deleted = await prisma.duty.deleteMany({ where: { id } });
  if (!deleted.count) return response.status(404).json({ message: "Duty not found." });
  emitToUser(existing.assignedToId, "duty:deleted", { id });
  await emitDutyToAdmins({ id, deleted: true });
  return response.status(204).end();
});

export default dutyRouter;
