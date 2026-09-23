-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "MessageConnection" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageConnection_requesterId_recipientId_key"
    ON "MessageConnection"("requesterId", "recipientId");

CREATE INDEX "MessageConnection_recipientId_status_idx"
    ON "MessageConnection"("recipientId", "status");

-- AddForeignKey
ALTER TABLE "MessageConnection"
    ADD CONSTRAINT "MessageConnection_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageConnection"
    ADD CONSTRAINT "MessageConnection_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
