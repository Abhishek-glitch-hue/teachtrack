import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";

const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (request, response) => {
  const [notifications, completedDuties, expiredReminders] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.duty.findMany({
      where: { assignedToId: request.user!.id, status: "COMPLETED" },
      select: { title: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: request.user!.id, reminderAt: { lt: new Date() } },
      select: { title: true },
    }),
  ]);

  const completedDutyMessages = new Set(completedDuties.map((duty) => `${duty.title} was assigned to you.`));
  const expiredReminderTitles = new Set(expiredReminders.map((event) => `Reminder: ${event.title}`));
  const staleNotificationIds = notifications
    .filter((notification) => (
      notification.type === "DUTY" && completedDutyMessages.has(notification.message)
    ) || (
      notification.type === "REMINDER" && expiredReminderTitles.has(notification.title)
    ))
    .map((notification) => notification.id);

  if (staleNotificationIds.length) {
    await prisma.notification.deleteMany({ where: { id: { in: staleNotificationIds }, userId: request.user!.id } });
  }

  return response.json({
    notifications: notifications.filter((notification) => !staleNotificationIds.includes(notification.id)),
  });
});

notificationRouter.delete("/", requireAuth, async (request, response) => {
  await prisma.notification.deleteMany({ where: { userId: request.user!.id } });
  return response.status(204).send();
});

notificationRouter.patch("/read-all", requireAuth, async (request, response) => {
  await prisma.notification.updateMany({
    where: {
      userId: request.user!.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  return response.status(204).send();
});

notificationRouter.patch("/:id/read", requireAuth, async (request, response) => {
  const result = await prisma.notification.updateMany({
    where: {
      id: String(request.params.id),
      userId: request.user!.id,
    },
    data: { isRead: true },
  });

  if (result.count === 0) {
    return response.status(404).json({ message: "Notification not found." });
  }

  return response.status(204).send();
});

notificationRouter.delete("/:id", requireAuth, async (request, response) => {
  const result = await prisma.notification.deleteMany({
    where: {
      id: String(request.params.id),
      userId: request.user!.id,
    },
  });

  if (result.count === 0) {
    return response.status(404).json({ message: "Notification not found." });
  }

  return response.status(204).send();
});

export default notificationRouter;