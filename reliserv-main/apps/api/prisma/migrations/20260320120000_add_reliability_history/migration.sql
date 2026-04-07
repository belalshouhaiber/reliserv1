-- CreateEnum
CREATE TYPE "ReliabilityChangeReason" AS ENUM (
  'JOB_COMPLETED',
  'JOB_CANCELED',
  'REVIEW_IMPACT',
  'EMERGENCY_BONUS',
  'MANUAL_RECALC'
);

-- CreateTable
CREATE TABLE "ReliabilityHistory" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "oldScore" INTEGER NOT NULL,
  "newScore" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "ReliabilityChangeReason" NOT NULL,
  "jobId" TEXT,
  "note" TEXT,

  CONSTRAINT "ReliabilityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReliabilityHistory_userId_createdAt_idx" ON "ReliabilityHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReliabilityHistory"
ADD CONSTRAINT "ReliabilityHistory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
