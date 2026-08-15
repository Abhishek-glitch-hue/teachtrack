import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const leaveRouter = Router();

const createLeaveSchema = z
  .object({
    leaveType: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date cannot be earlier than start date.",
    path: ["endDate"],
  });

const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewerNote: z.string().trim().max(500).optional(),
});

leaveRouter.post("/", requireAuth, async (request, response) => {
  const parsed = createLeaveSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      message: "Please provide valid leave details.",
      errors: parsed.error.issues,
    });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      teacherId: request.user!.id,
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason,
    },
  });

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
    },
    select: { id: true },
  });

  if (admins.length > 0) {
    const title = "New leave request";
    const message = `${request.user!.name} submitted a ${leave.leaveType} request.`;

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "LEAVE_REQUEST" as const,
        title,
        message,
      })),
    });

    admins.forEach((admin) => {
      emitToUser(admin.id, "notification:new", {
        type: "LEAVE_REQUEST",
        title,
        message,
        leaveId: leave.id,
      });
    });
  }

  return response.status(201).json({ leave });
});

leaveRouter.get("/my", requireAuth, async (request, response) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: { teacherId: request.user!.id },
    orderBy: { createdAt: "desc" },
  });

  return response.json({ leaves });
});

leaveRouter.get("/", requireAuth, requireRole("ADMIN"), async (_request, response) => {
  const leaves = await prisma.leaveRequest.findMany({
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return response.json({ leaves });
});

leaveRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  async (request, response) => {
    const parsed = reviewLeaveSchema.safeParse(request.body);

    if (!parsed.success) {
      return response.status(400).json({
        message: "Status must be APPROVED or REJECTED.",
      });
    }

    const existingLeave = await prisma.leaveRequest.findUnique({
      where: { id: request.params.id },
    });

    if (!existingLeave) {
      return response.status(404).json({
        message: "Leave request not found.",
      });
    }

    if (existingLeave.status !== "PENDING") {
      return response.status(409).json({
        message: "This leave request has already been reviewed.",
      });
    }

    const leave = await prisma.leaveRequest.update({
      where: { id: existingLeave.id },
      data: {
        status: parsed.data.status,
        reviewerNote: parsed.data.reviewerNote,
        reviewedById: request.user!.id,
        reviewedAt: new Date(),
      },
    });

    const approved = leave.status === "APPROVED";
    const title = approved ? "Leave request approved" : "Leave request rejected";
    const message = approved
      ? `Your ${leave.leaveType} request has been approved.`
      : `Your ${leave.leaveType} request has been rejected.`;

    const notification = await prisma.notification.create({
      data: {
        userId: leave.teacherId,
        type: approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title,
        message,
      },
    });

    emitToUser(leave.teacherId, "notification:new", notification);
    emitToUser(leave.teacherId, "leave:updated", { leave });

    return response.json({ leave });
  },
);

export default leaveRouter;