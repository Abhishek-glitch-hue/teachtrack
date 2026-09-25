import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { uniqueLeaveDaysInCurrentMonth, MONTHLY_LEAVE_ALLOWANCE } from "../lib/leaveBalance.ts";
import { requireAuth } from "../middleware/auth.ts";

const dashboardRouter = Router();

const DEFAULT_CALENDAR_ITEM_HOURS = 1;
const DUTY_ESTIMATED_HOURS = 4;

function calendarHoursInWeek(
  event: { startsAt: Date; endsAt: Date | null },
  weekStart: Date,
  weekEnd: Date,
) {
  const eventStart = event.startsAt;
  // Calendar entries without an end time represent one scheduled hour. This
  // makes time-only lecture entries count while keeping all-day events useful.
  const eventEnd = event.endsAt && event.endsAt > eventStart
    ? event.endsAt
    : new Date(eventStart.getTime() + DEFAULT_CALENDAR_ITEM_HOURS * 60 * 60 * 1000);
  const overlapStart = Math.max(eventStart.getTime(), weekStart.getTime());
  const overlapEnd = Math.min(eventEnd.getTime(), weekEnd.getTime());

  return overlapEnd > overlapStart
    ? (overlapEnd - overlapStart) / (60 * 60 * 1000)
    : 0;
}

function roundHours(hours: number) {
  return Math.round(hours * 10) / 10;
}

function startOfCalendarWeek(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

dashboardRouter.get("/", requireAuth, async (request, response) => {
  const userId = request.user!.id;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (6 - now.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  // The dashboard workload card is personal, including for administrators.
  // Admins can review all assignments on the Duties page.
  const dutyWhere = { assignedToId: userId };
  // A leave balance always belongs to the signed-in user. Administrators can
  // still review all requests on the Leaves page, but their dashboard must not
  // combine every teacher's allowance into one number.
  const leaveWhere = { teacherId: userId };

  const [duties, events, leaves, conversations, lectures] = await Promise.all([
    prisma.duty.findMany({ where: dutyWhere, include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { dueAt: "asc" }, take: 100 }),
    prisma.calendarEvent.findMany({ where: { userId }, orderBy: { startsAt: "asc" }, take: 100 }),
    prisma.leaveRequest.findMany({ where: leaveWhere, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.message.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, include: { sender: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.timetableLecture.findMany({ where: { userId }, orderBy: [{ day: "asc" }, { time: "asc" }] }),
  ]);

  const approvedLeaveDays = leaves.filter((leave) => leave.status === "APPROVED").reduce((total, leave) => total + Math.max(1, Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / 86400000) + 1), 0);
  const leaveDaysUsedThisMonth = uniqueLeaveDaysInCurrentMonth(
    leaves.filter((leave) => leave.status === "APPROVED"),
    now,
  );
  const upcoming = [
    // The dashboard list is date-based; undated duties remain available on
    // the Duties page but are not considered upcoming.
    ...duties
      .filter((duty) => duty.status !== "COMPLETED" && duty.dueAt && duty.dueAt >= now)
      .map((duty) => ({
        kind: "duty" as const,
        title: duty.title,
        date: duty.dueAt,
        status: duty.status,
        assignedTo: duty.assignedTo,
        isUrgent: false,
      })),
    ...events.filter((event) => event.startsAt >= now).map((event) => ({ kind: "event", title: event.title, date: event.startsAt, status: event.type, assignedTo: null })),
  ].sort((a, b) => {
    const priorityA = "isUrgent" in a && a.isUrgent ? 0 : a.date ? 1 : 2;
    const priorityB = "isUrgent" in b && b.isUrgent ? 0 : b.date ? 1 : 2;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return (a.date?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.date?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });

  // The trend follows the same Sunday-to-Saturday rows shown by Calendar for
  // the current month. For example, 6–12 September is September's W2.
  const weeks = [];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const firstWeekStart = startOfCalendarWeek(monthStart);
  const lastWeekStart = startOfCalendarWeek(monthEnd);
  for (let wStart = firstWeekStart, weekNumber = 1; wStart <= lastWeekStart; wStart.setDate(wStart.getDate() + 7), weekNumber++) {
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    wEnd.setHours(23, 59, 59, 999);
    const dutyHours = duties
      .filter((duty) => duty.dueAt && duty.dueAt >= wStart && duty.dueAt <= wEnd)
      .length * DUTY_ESTIMATED_HOURS;
    const calendarHours = events.reduce(
      (total, event) => total + calendarHoursInWeek(event, wStart, wEnd),
      0,
    );
    // Timetable entries have a weekday/time but no date. Therefore they are
    // assigned to the actual calendar week that contains today; dated entries
    // belong to the week of their Calendar start date.
    const timetableHours = now >= wStart && now <= wEnd ? lectures.length : 0;
    weeks.push({
      week: `W${weekNumber}`,
      hours: roundHours(dutyHours + calendarHours + timetableHours),
      isCurrent: now >= wStart && now <= wEnd,
    });
  }
  const currentWeekHours = lectures.length;

  const dutyBreakdown: { [key: string]: number } = {
    lectures: 0,
    invigilation: 0,
    mentoring: 0,
    committee: 0,
  };
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  duties
    .filter((duty) => {
      const referenceDate = duty.dueAt ?? duty.createdAt;
      return referenceDate >= currentMonthStart && referenceDate < nextMonthStart;
    })
    .forEach((duty) => {
      // dutyType is selected by an admin. The title fallback only supports
      // older records created before duty types were introduced.
      const type = duty.dutyType ?? (duty.title.toLowerCase().includes("exam") || duty.title.toLowerCase().includes("invigil")
        ? "INVIGILATION"
        : duty.title.toLowerCase().includes("mentor") || duty.title.toLowerCase().includes("guidance")
          ? "MENTORING"
          : duty.title.toLowerCase().includes("committee") || duty.title.toLowerCase().includes("meeting")
            ? "COMMITTEE"
            : "LECTURES");
      if (type === "LECTURES") dutyBreakdown.lectures++;
      else if (type === "INVIGILATION") dutyBreakdown.invigilation++;
      else if (type === "MENTORING") dutyBreakdown.mentoring++;
      else if (type === "COMMITTEE") dutyBreakdown.committee++;
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
      upcomingThisWeek: upcoming.filter((item) => item.date && item.date >= weekStart && item.date <= weekEnd).length,
      weeklyHours: currentWeekHours,
      scheduledLessons: lectures.length,
      approvedLeaveDays,
      leaveDaysTaken: leaveDaysUsedThisMonth,
      monthlyLeaveAllowance: MONTHLY_LEAVE_ALLOWANCE,
      leaveBalance: Math.max(0, MONTHLY_LEAVE_ALLOWANCE - leaveDaysUsedThisMonth),
    },
    upcoming,
    messages: conversations,
    weeks,
    trendPeriod: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    breakdown,
  });
});

export default dashboardRouter;
