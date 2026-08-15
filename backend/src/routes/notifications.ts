import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";

const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (request, response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: request.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({ notifications });
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
      id: request.params.id,
      userId: request.user!.id,
    },
    data: { isRead: true },
  });

  if (result.count === 0) {
    return response.status(404).json({ message: "Notification not found." });
  }

  return response.status(204).send();
});

export default notificationRouter;