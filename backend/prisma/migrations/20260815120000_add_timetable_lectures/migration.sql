-- CreateTable
CREATE TABLE "TimetableLecture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'teal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableLecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimetableLecture_userId_day_time_key" ON "TimetableLecture"("userId", "day", "time");

-- CreateIndex
CREATE INDEX "TimetableLecture_userId_day_time_idx" ON "TimetableLecture"("userId", "day", "time");

-- AddForeignKey
ALTER TABLE "TimetableLecture" ADD CONSTRAINT "TimetableLecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
