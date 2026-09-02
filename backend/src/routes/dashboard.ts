import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { requireAuth } from "../middleware/auth.ts";

const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (request, response) => {
  const userId = request.user!.id;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (6 - now.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  const dutyWhere = request.user!.role === "ADMIN" ? {} : { assignedToId: userId };
  const leaveWhere = request.user!.role === "ADMIN" ? {} : { teacherId: userId };

  const [duties, events, leaves, conversations, lectures] = await Promise.all([
    prisma.duty.findMany({ where: dutyWhere, include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { dueAt: "asc" }, take: 100 }),
    prisma.calendarEvent.findMany({ where: { userId }, orderBy: { startsAt: "asc" }, take: 100 }),
    prisma.leaveRequest.findMany({ where: leaveWhere, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.message.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, include: { sender: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.timetableLecture.findMany({ where: { userId }, orderBy: [{ day: "asc" }, { time: "asc" }] }),
  ]);

  const approvedLeaveDays = leaves.filter((leave) => leave.status === "APPROVED").reduce((total, leave) => total + Math.max(1, Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / 86400000) + 1), 0);
  const upcoming = [
    ...duties.filter((duty) => duty.dueAt && duty.dueAt >= now).map((duty) => ({ kind: "duty", title: duty.title, date: duty.dueAt, status: duty.status, assignedTo: duty.assignedTo })),
    ...events.filter((event) => event.startsAt >= now).map((event) => ({ kind: "event", title: event.title, date: event.startsAt, status: event.type, assignedTo: null })),
  ].sort((a, b) => a.date!.getTime() - b.date!.getTime()).slice(0, 5);

  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const wStart = new Date(now);
    wStart.setDate(now.getDate() - now.getDay() - i * 7);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    wEnd.setHours(23, 59, 59, 999);
    const weekDuties = duties.filter((duty) => duty.dueAt && duty.dueAt >= wStart && duty.dueAt <= wEnd).length;
    weeks.push({ week: `W${4 - i}`, hours: Math.max(weekDuties * 4, 0) });
  }

  const dutyBreakdown: { [key: string]: number } = {
    lectures: 0,
    invigilation: 0,
    mentoring: 0,
    committee: 0,
    other: 0,
  };
  duties.forEach((duty) => {
    const title = duty.title.toLowerCase();
    if (title.includes("lecture") || title.includes("class") || title.includes("teach")) dutyBreakdown.lectures++;
    else if (title.includes("invigil") || title.includes("exam")) dutyBreakdown.invigilation++;
    else if (title.includes("mentor") || title.includes("guidance")) dutyBreakdown.mentoring++;
    else if (title.includes("committee") || title.includes("meeting") || title.includes("staff")) dutyBreakdown.committee++;
    else dutyBreakdown.other++;
  });
  const totalDuties = Object.values(dutyBreakdown).reduce((sum, count) => sum + count, 0);
  const breakdown = Object.entries(dutyBreakdown).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    percentage: totalDuties > 0 ? Math.round((count / totalDuties) * 100) : 0,
  }));

  return response.json({
    user: request.user,
    stats: {
      duties: duties.length,
      pendingDuties: duties.filter((duty) => duty.status !== "COMPLETED").length,
      completedDuties: duties.filter((duty) => duty.status === "COMPLETED").length,
      upcomingThisWeek: upcoming.filter((item) => item.date! >= weekStart && item.date! <= weekEnd).length,
      scheduledLessons: lectures.length,
      approvedLeaveDays,
    },
    upcoming,
    messages: conversations,
    weeks,
    breakdown,
  });
});

export default dashboardRouter;