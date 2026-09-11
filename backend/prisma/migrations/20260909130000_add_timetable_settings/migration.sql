CREATE TABLE "TimetableSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lectureCount" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimetableSetting_userId_day_key" ON "TimetableSetting"("userId", "day");
CREATE INDEX "TimetableSetting_userId_day_idx" ON "TimetableSetting"("userId", "day");

ALTER TABLE "TimetableSetting" ADD CONSTRAINT "TimetableSetting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;