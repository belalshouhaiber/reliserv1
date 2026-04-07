import { JobStatus, UserRole, type PrismaClient } from "@prisma/client";
import { PresenceRedis, WORKER_PRESENCE_TTL_SECONDS } from "./presence.redis";

export type WorkerServiceStatus = "ONLINE" | "BUSY" | "OFFLINE";

type WorkerProfileSnapshot = {
  emergencyOptIn: boolean;
  serviceStatus: WorkerServiceStatus;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationAt: Date | null;
  lastHeartbeatAt: Date | null;
};

type WorkerSnapshot = {
  id: string;
  role: "CUSTOMER" | "WORKER";
  workerProfile: WorkerProfileSnapshot | null;
};

export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly presenceRedis: PresenceRedis,
  ) {}

  private async ensureWorker(userId: string): Promise<WorkerSnapshot> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: true,
      },
    });

    if (!user) {
      const error = new Error("User not found");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    if (user.role !== UserRole.WORKER) {
      const error = new Error("Only workers can perform this action");
      (error as Error & { statusCode?: number }).statusCode = 403;
      throw error;
    }

    if (!user.workerProfile) {
      const error = new Error("Worker profile not found");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    return user as WorkerSnapshot;
  }

  async hasActiveAssignedJob(workerId: string): Promise<boolean> {
    const activeJob = await this.prisma.job.findFirst({
      where: {
        assignedWorkerId: workerId,
        status: {
          in: [JobStatus.LOCKED, JobStatus.IN_PROGRESS],
        },
      },
      select: { id: true },
    });

    return Boolean(activeJob);
  }

  async getEffectiveServiceStatus(userId: string): Promise<WorkerServiceStatus> {
    const user = await this.ensureWorker(userId);
    const active = await this.hasActiveAssignedJob(userId);

    if (active) return "BUSY";
    return user.workerProfile!.serviceStatus;
  }

  private toAvailabilityDto(
    user: WorkerSnapshot,
    effectiveStatus?: WorkerServiceStatus,
  ) {
    const workerProfile = user.workerProfile!;

    return {
      userId: user.id,
      serviceStatus: effectiveStatus ?? workerProfile.serviceStatus,
      emergencyOptIn: workerProfile.emergencyOptIn,
      lastKnownLat: workerProfile.lastKnownLat,
      lastKnownLng: workerProfile.lastKnownLng,
      lastLocationAt: workerProfile.lastLocationAt?.toISOString() ?? null,
      lastHeartbeatAt: workerProfile.lastHeartbeatAt?.toISOString() ?? null,
    };
  }

  async updateWorkerStatus(userId: string, requestedStatus: "ONLINE" | "OFFLINE") {
    const user = await this.ensureWorker(userId);
    const active = await this.hasActiveAssignedJob(userId);

    if (active) {
      return this.toAvailabilityDto(user, "BUSY");
    }

    const updated = await (this.prisma as any).workerProfile.update({
      where: { userId },
      data: {
        serviceStatus: requestedStatus,
        availableNow: requestedStatus === "ONLINE",
      },
    });

    if (requestedStatus === "OFFLINE") {
      await this.presenceRedis.clearWorkerPresence(userId);
    }

    return {
      userId,
      serviceStatus: updated.serviceStatus as WorkerServiceStatus,
      emergencyOptIn: updated.emergencyOptIn as boolean,
      lastKnownLat: (updated.lastKnownLat as number | null) ?? null,
      lastKnownLng: (updated.lastKnownLng as number | null) ?? null,
      lastLocationAt: updated.lastLocationAt?.toISOString() ?? null,
      lastHeartbeatAt: updated.lastHeartbeatAt?.toISOString() ?? null,
    };
  }

  async updateEmergencyOptIn(userId: string, emergencyOptIn: boolean) {
    await this.ensureWorker(userId);

    const updated = await (this.prisma as any).workerProfile.update({
      where: { userId },
      data: { emergencyOptIn },
    });

    const effectiveStatus = await this.getEffectiveServiceStatus(userId);

    return {
      userId,
      serviceStatus: effectiveStatus,
      emergencyOptIn: updated.emergencyOptIn as boolean,
      lastKnownLat: (updated.lastKnownLat as number | null) ?? null,
      lastKnownLng: (updated.lastKnownLng as number | null) ?? null,
      lastLocationAt: updated.lastLocationAt?.toISOString() ?? null,
      lastHeartbeatAt: updated.lastHeartbeatAt?.toISOString() ?? null,
    };
  }

  async heartbeatWorker(userId: string, lat: number, lng: number) {
    await this.ensureWorker(userId);

    const now = new Date();

    await (this.prisma as any).workerProfile.update({
      where: { userId },
      data: {
        lastKnownLat: lat,
        lastKnownLng: lng,
        lastLocationAt: now,
        lastHeartbeatAt: now,
      },
    });

    await this.presenceRedis.setWorkerPresence(userId, {
      userId,
      lat,
      lng,
      at: now.toISOString(),
    });

    return {
      ok: true as const,
      expiresInSeconds: WORKER_PRESENCE_TTL_SECONDS,
    };
  }

  async getWorkerEligibilitySnapshot(userId: string) {
    const user = await this.ensureWorker(userId);
    const presence = await this.presenceRedis.getWorkerPresence(userId);
    const hasActiveAssignedJob = await this.hasActiveAssignedJob(userId);
    const effectiveStatus = hasActiveAssignedJob
      ? "BUSY"
      : user.workerProfile!.serviceStatus;

    const standardEligible =
      effectiveStatus === "ONLINE" &&
      !!presence &&
      !hasActiveAssignedJob;

    const emergencyEligible =
      effectiveStatus === "ONLINE" &&
      user.workerProfile!.emergencyOptIn &&
      !!presence &&
      !hasActiveAssignedJob;

    return {
      userId,
      serviceStatus: effectiveStatus,
      emergencyOptIn: user.workerProfile!.emergencyOptIn,
      hasLiveHeartbeat: !!presence,
      hasActiveAssignedJob,
      standardEligible,
      emergencyEligible,
      presence,
    };
  }
}
