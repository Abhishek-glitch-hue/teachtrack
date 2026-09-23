export const MONTHLY_LEAVE_ALLOWANCE = 6;

export function leaveDaysInCurrentMonth(
  startDate: Date,
  endDate: Date,
  referenceDate = new Date(),
) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const start = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
  const end = new Date(Math.min(endDate.getTime(), monthEnd.getTime()));

  return end >= start ? Math.floor((end.getTime() - start.getTime()) / 86400000) + 1 : 0;
}

export function uniqueLeaveDaysInCurrentMonth(
  leaves: Array<{ startDate: Date; endDate: Date }>,
  referenceDate = new Date(),
) {
  const ranges = leaves
    .map((leave) => {
      const start = new Date(Math.max(leave.startDate.getTime(), new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1).getTime()));
      const end = new Date(Math.min(leave.endDate.getTime(), new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime()));
      return end >= start ? { start, end } : null;
    })
    .filter((range): range is { start: Date; end: Date } => Boolean(range))
    .sort((first, second) => first.start.getTime() - second.start.getTime());

  let total = 0;
  let current = ranges[0];
  for (const range of ranges.slice(1)) {
    if (!current) {
      current = range;
    } else if (range.start.getTime() <= current.end.getTime() + 86400000) {
      if (range.end > current.end) current.end = range.end;
    } else {
      total += leaveDaysInCurrentMonth(current.start, current.end, referenceDate);
      current = range;
    }
  }
  if (current) total += leaveDaysInCurrentMonth(current.start, current.end, referenceDate);
  return total;
}

export function monthsCoveredByLeave(startDate: Date, endDate: Date) {
  const months: Date[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= lastMonth) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function exceedsMonthlyLeaveAllowance(
  leaves: Array<{ startDate: Date; endDate: Date }>,
  allowance = MONTHLY_LEAVE_ALLOWANCE,
) {
  if (leaves.length === 0) return false;

  const firstDate = leaves.reduce(
    (earliest, leave) => (leave.startDate < earliest ? leave.startDate : earliest),
    leaves[0].startDate,
  );
  const lastDate = leaves.reduce(
    (latest, leave) => (leave.endDate > latest ? leave.endDate : latest),
    leaves[0].endDate,
  );

  return monthsCoveredByLeave(firstDate, lastDate).some(
    (month) => uniqueLeaveDaysInCurrentMonth(leaves, month) > allowance,
  );
}
