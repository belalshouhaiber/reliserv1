import { JobStatus, JobUrgency, type PrismaClient } from "@prisma/client";
import { AvailabilityService } from "../availability/availability.service";

type RankedWorker = {
  workerId: string;
  name: string;
  reliabilityScore: number;
  distanceMiles: number | null;
  etaMinutes: number | null;
  completionRate: number;
  cancelRate: number;
  emergencyCompletionCount: number;
  avgResponseSeconds: number | null;
  score: number;
  reasons: string[];
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));
  return earthRadiusMiles * c;
}

export class MatchingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly availabilityService: AvailabilityService,
  ) {}

  private async getJobOrThrow(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        description: true,
        jobType: true,
        urgency: true,
        status: true,
        lat: true,
        lng: true,
        createdById: true,
        assignedWorkerId: true,
      },
    });

    if (!job) {
      const error = new Error("Job not found");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    return job;
  }

  private async getWorkerMetrics(workerId: string) {
    const assignedJobs = await this.prisma.job.findMany({
      where: { assignedWorkerId: workerId },
      select: {
        id: true,
        status: true,
        urgency: true,
      },
    });

    const totalAssigned = assignedJobs.length;
    const completed = assignedJobs.filter(
      (job) => job.status === JobStatus.COMPLETED,
    ).length;
    const canceled = assignedJobs.filter(
      (job) => job.status === JobStatus.CANCELED,
    ).length;
    const emergencyCompleted = assignedJobs.filter(
      (job) =>
        job.urgency === JobUrgency.EMERGENCY &&
        job.status === JobStatus.COMPLETED,
    ).length;

    return {
      totalAssigned,
      completed,
      canceled,
      emergencyCompleted,
      completionRate: totalAssigned > 0 ? completed / totalAssigned : 0,
      cancelRate: totalAssigned > 0 ? canceled / totalAssigned : 0,
    };
  }

  private getDistanceMiles(
    jobLat: number | null,
    jobLng: number | null,
    workerLat: number | null,
    workerLng: number | null,
  ): number | null {
    if (
      jobLat == null ||
      jobLng == null ||
      workerLat == null ||
      workerLng == null
    ) {
      return null;
    }

    return haversineMiles(jobLat, jobLng, workerLat, workerLng);
  }

  private estimateEtaMinutes(distanceMiles: number | null): number | null {
    if (distanceMiles == null) return null;

    const hours = distanceMiles / 30;
    return Math.max(1, Math.round(hours * 60));
  }

  private buildReasons(input: {
    reliabilityScore: number;
    distanceMiles: number | null;
    completionRate: number;
    emergencyCompletionCount: number;
    emergencyMode: boolean;
  }) {
    const reasons: string[] = [];

    if (input.reliabilityScore >= 90) {
      reasons.push("High reliability");
    } else if (input.reliabilityScore >= 75) {
      reasons.push("Strong reliability");
    }

    if (input.distanceMiles != null) {
      if (input.distanceMiles <= 3) {
        reasons.push("Very close to job");
      } else if (input.distanceMiles <= 10) {
        reasons.push("Reasonably close to job");
      }
    }

    if (input.completionRate >= 0.9) {
      reasons.push("Strong completion history");
    } else if (input.completionRate >= 0.75) {
      reasons.push("Good completion history");
    }

    if (input.emergencyMode && input.emergencyCompletionCount > 0) {
      reasons.push("Emergency job experience");
    }

    if (reasons.length === 0) {
      reasons.push("Eligible and available");
    }

    return reasons;
  }

  private computeNormalScore(input: {
    reliabilityScore: number;
    distanceMiles: number | null;
    completionRate: number;
    cancelRate: number;
  }) {
    const reliabilityNorm = clamp01(input.reliabilityScore / 100);
    const proximityNorm =
      input.distanceMiles == null
        ? 0.3
        : clamp01(1 - Math.min(input.distanceMiles, 25) / 25);
    const completionNorm = clamp01(input.completionRate);
    const cancelPenalty = clamp01(input.cancelRate);
    const responseSpeedNorm = 0.5;

    const score =
      0.35 * reliabilityNorm +
      0.2 * proximityNorm +
      0.2 * completionNorm +
      0.15 * responseSpeedNorm -
      0.1 * cancelPenalty;

    return round2(score * 100);
  }

  private computeEmergencyScore(input: {
    reliabilityScore: number;
    distanceMiles: number | null;
    emergencyCompletionCount: number;
  }) {
    const reliabilityNorm = clamp01(input.reliabilityScore / 100);
    const etaNorm =
      input.distanceMiles == null
        ? 0.2
        : clamp01(1 - Math.min(input.distanceMiles, 20) / 20);
    const emergencyHistoryNorm = clamp01(input.emergencyCompletionCount / 10);
    const responseSpeedNorm = 0.5;

    const score =
      0.4 * etaNorm +
      0.3 * reliabilityNorm +
      0.2 * responseSpeedNorm +
      0.1 * emergencyHistoryNorm;

    return round2(score * 100);
  }

  async getRankedWorkersForJob(jobId: string) {
    const job = await this.getJobOrThrow(jobId);

    const workers = await this.prisma.user.findMany({
      where: {
        role: "WORKER",
        workerProfile: {
          isNot: null,
        },
      },
      select: {
        id: true,
        name: true,
        reliabilityScore: true,
        workerProfile: {
          select: {
            emergencyOptIn: true,
            serviceStatus: true,
            lastKnownLat: true,
            lastKnownLng: true,
          },
        },
      },
    });

    const ranked: RankedWorker[] = [];

    for (const worker of workers) {
      const eligibility = await this.availabilityService.getWorkerEligibilitySnapshot(
        worker.id,
      );

      if (!eligibility.standardEligible) continue;

      const metrics = await this.getWorkerMetrics(worker.id);
      const distanceMiles = this.getDistanceMiles(
        job.lat,
        job.lng,
        worker.workerProfile?.lastKnownLat ?? null,
        worker.workerProfile?.lastKnownLng ?? null,
      );
      const etaMinutes = this.estimateEtaMinutes(distanceMiles);

      const score = this.computeNormalScore({
        reliabilityScore: worker.reliabilityScore,
        distanceMiles,
        completionRate: metrics.completionRate,
        cancelRate: metrics.cancelRate,
      });

      ranked.push({
        workerId: worker.id,
        name: worker.name,
        reliabilityScore: worker.reliabilityScore,
        distanceMiles: distanceMiles != null ? round2(distanceMiles) : null,
        etaMinutes,
        completionRate: round2(metrics.completionRate),
        cancelRate: round2(metrics.cancelRate),
        emergencyCompletionCount: metrics.emergencyCompleted,
        avgResponseSeconds: null,
        score,
        reasons: this.buildReasons({
          reliabilityScore: worker.reliabilityScore,
          distanceMiles,
          completionRate: metrics.completionRate,
          emergencyCompletionCount: metrics.emergencyCompleted,
          emergencyMode: false,
        }),
      });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.distanceMiles ?? 9999) !== (b.distanceMiles ?? 9999)) {
        return (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999);
      }
      return b.reliabilityScore - a.reliabilityScore;
    });

    return {
      job: {
        id: job.id,
        title: job.title,
        urgency: job.urgency,
        status: job.status,
      },
      workers: ranked.map((worker, index) => ({
        ...worker,
        rank: index + 1,
      })),
    };
  }

  async getRankedWorkersForEmergency(jobId: string) {
    const job = await this.getJobOrThrow(jobId);

    const workers = await this.prisma.user.findMany({
      where: {
        role: "WORKER",
        workerProfile: {
          isNot: null,
        },
      },
      select: {
        id: true,
        name: true,
        reliabilityScore: true,
        workerProfile: {
          select: {
            emergencyOptIn: true,
            serviceStatus: true,
            lastKnownLat: true,
            lastKnownLng: true,
          },
        },
      },
    });

    const ranked: RankedWorker[] = [];

    for (const worker of workers) {
      const eligibility = await this.availabilityService.getWorkerEligibilitySnapshot(
        worker.id,
      );

      if (!eligibility.emergencyEligible) continue;

      const metrics = await this.getWorkerMetrics(worker.id);
      const distanceMiles = this.getDistanceMiles(
        job.lat,
        job.lng,
        worker.workerProfile?.lastKnownLat ?? null,
        worker.workerProfile?.lastKnownLng ?? null,
      );
      const etaMinutes = this.estimateEtaMinutes(distanceMiles);

      const score = this.computeEmergencyScore({
        reliabilityScore: worker.reliabilityScore,
        distanceMiles,
        emergencyCompletionCount: metrics.emergencyCompleted,
      });

      ranked.push({
        workerId: worker.id,
        name: worker.name,
        reliabilityScore: worker.reliabilityScore,
        distanceMiles: distanceMiles != null ? round2(distanceMiles) : null,
        etaMinutes,
        completionRate: round2(metrics.completionRate),
        cancelRate: round2(metrics.cancelRate),
        emergencyCompletionCount: metrics.emergencyCompleted,
        avgResponseSeconds: null,
        score,
        reasons: this.buildReasons({
          reliabilityScore: worker.reliabilityScore,
          distanceMiles,
          completionRate: metrics.completionRate,
          emergencyCompletionCount: metrics.emergencyCompleted,
          emergencyMode: true,
        }),
      });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.etaMinutes ?? 9999) !== (b.etaMinutes ?? 9999)) {
        return (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999);
      }
      return b.reliabilityScore - a.reliabilityScore;
    });

    return {
      job: {
        id: job.id,
        title: job.title,
        urgency: job.urgency,
        status: job.status,
      },
      workers: ranked.map((worker, index) => ({
        ...worker,
        rank: index + 1,
      })),
    };
  }
}
