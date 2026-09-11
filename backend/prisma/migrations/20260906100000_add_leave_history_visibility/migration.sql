-- Hiding a leave from a history view must not change leave balances or reports.
ALTER TABLE "LeaveRequest"
ADD COLUMN "hiddenFromTeacher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hiddenFromAdmin" BOOLEAN NOT NULL DEFAULT false;
