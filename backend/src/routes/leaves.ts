import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import {
  exceedsMonthlyLeaveAllowance,
  uniqueLeaveDaysInCurrentMonth,
  MONTHLY_LEAVE_ALLOWANCE,
} from "../lib/leaveBalance.ts";
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
  })
  .refine((data) => {
    const startDate = new Date(data.startDate);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return startDate >= today;
  }, {
    message: "Leave cannot start before today.",
    path: ["startDate"],
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

  const existingLeaves = await prisma.leaveRequest.findMany({
    where: {
      teacherId: request.user!.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      startDate: true,
      endDate: true,
    },
  });

  if (
    exceedsMonthlyLeaveAllowance([
      ...existingLeaves,
      {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
    ])
  ) {
    return response.status(409).json({
      message: `You can take a maximum of ${MONTHLY_LEAVE_ALLOWANCE} leave days per month.`,
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
      emitToUser(admin.id, "leave:created", { leaveId: leave.id });
    });
  }

  return response.status(201).json({ leave });
});

leaveRouter.get("/my", requireAuth, async (request, response) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: { teacherId: request.user!.id },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const leaveDaysTaken = uniqueLeaveDaysInCurrentMonth(
    leaves.filter((leave) => leave.status === "APPROVED"),
    now,
  );

  return response.json({
    leaves: leaves.filter((leave) => !leave.hiddenFromTeacher),
    summary: {
      monthlyAllowance: MONTHLY_LEAVE_ALLOWANCE,
      leaveDaysTaken,
      leaveBalance: Math.max(0, MONTHLY_LEAVE_ALLOWANCE - leaveDaysTaken),
    },
  });
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

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const approvedLeaves = leaves.filter((leave) => leave.status === "APPROVED");

  return response.json({
    leaves: leaves.filter((leave) => !leave.hiddenFromAdmin),
    summary: {
      pendingRequests: leaves.filter((leave) => leave.status === "PENDING").length,
      approvedThisMonth: approvedLeaves.filter(
        (leave) => leave.startDate <= monthEnd && leave.endDate >= monthStart,
      ).length,
    },
  });
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
      where: { id: String(request.params.id) },
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

    const teacherLeaves = await prisma.leaveRequest.findMany({
      where: {
        teacherId: existingLeave.teacherId,
        status: { in: ["PENDING", "APPROVED"] },
        id: { not: existingLeave.id },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    if (
      parsed.data.status === "APPROVED" &&
      exceedsMonthlyLeaveAllowance([
        ...teacherLeaves,
        {
          startDate: existingLeave.startDate,
          endDate: existingLeave.endDate,
        },
      ])
    ) {
      return response.status(409).json({
        message: `Approving this request would exceed the ${MONTHLY_LEAVE_ALLOWANCE}-day monthly leave allowance.`,
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

leaveRouter.delete("/:id", requireAuth, async (request, response) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: String(request.params.id) },
  });

  if (!leave) {
    return response.status(404).json({
      message: "Leave request not found.",
    });
  }

  const isAdmin = request.user!.role === "ADMIN";
  const isOwner = leave.teacherId === request.user!.id;

  if (!isOwner && !isAdmin) {
    return response.status(403).json({
      message: "You do not have permission to remove this leave request.",
    });
  }

  await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: isAdmin ? { hiddenFromAdmin: true } : { hiddenFromTeacher: true },
  });

  return response.status(204).send();
});

export default leaveRouter;
