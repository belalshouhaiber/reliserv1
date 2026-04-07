-- CreateEnum
CREATE TYPE "WorkerServiceStatus" AS ENUM ('ONLINE', 'BUSY', 'OFFLINE');

-- AlterTable
ALTER TABLE "WorkerProfile"
ADD COLUMN "serviceStatus" "WorkerServiceStatus" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN "lastKnownLat" DOUBLE PRECISION,
ADD COLUMN "lastKnownLng" DOUBLE PRECISION,
ADD COLUMN "lastLocationAt" TIMESTAMP(3),
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkerProfile_serviceStatus_emergencyOptIn_idx" ON "WorkerProfile"("serviceStatus", "emergencyOptIn");

-- CreateIndex
CREATE INDEX "WorkerProfile_userId_serviceStatus_idx" ON "WorkerProfile"("userId", "serviceStatus");
