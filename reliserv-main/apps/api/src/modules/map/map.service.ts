import type { PrismaClient } from "@prisma/client";
import { AvailabilityService } from "../availability/availability.service";

type MapMode = "normal" | "emergency";

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

function estimateEtaMinutes(distanceMiles: number | null): number | null {
  if (distanceMiles == null) return null;
  const hours = distanceMiles / 30;
  return Math.max(1, Math.round(hours * 60));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export class MapService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly availabilityService: AvailabilityService,
  ) {}

  private async getVisibleWorkers(lat: number, lng: number, mode: MapMode) {
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

    const visibleWorkers: Array<{
      workerId: string;
      name: string;
      lat: number;
      lng: number;
      serviceStatus: "ONLINE" | "BUSY" | "OFFLINE";
      reliabilityScore: number;
      emergencyOptIn: boolean;
      distanceMiles: number;
      etaMinutes: number | null;
      standardEligible: boolean;
      emergencyEligible: boolean;
    }> = [];

    for (const worker of workers) {
      const eligibility =
        await this.availabilityService.getWorkerEligibilitySnapshot(worker.id);

      const isEligible =
        mode === "emergency"
          ? eligibility.emergencyEligible
          : eligibility.standardEligible;

      if (!isEligible) continue;

      const workerLat = worker.workerProfile?.lastKnownLat ?? null;
      const workerLng = worker.workerProfile?.lastKnownLng ?? null;

      if (workerLat == null || workerLng == null) continue;

      const distanceMiles = haversineMiles(lat, lng, workerLat, workerLng);
      const etaMinutes = estimateEtaMinutes(distanceMiles);

      visibleWorkers.push({
        workerId: worker.id,
        name: worker.name,
        lat: workerLat,
        lng: workerLng,
        serviceStatus: eligibility.serviceStatus,
        reliabilityScore: worker.reliabilityScore,
        emergencyOptIn: worker.workerProfile?.emergencyOptIn ?? false,
        distanceMiles: round2(distanceMiles),
        etaMinutes,
        standardEligible: eligibility.standardEligible,
        emergencyEligible: eligibility.emergencyEligible,
      });
    }

    visibleWorkers.sort((a, b) => {
      if (a.distanceMiles !== b.distanceMiles) {
        return a.distanceMiles - b.distanceMiles;
      }
      return b.reliabilityScore - a.reliabilityScore;
    });

    return visibleWorkers;
  }

  async getWorkersNearPoint(lat: number, lng: number, mode: MapMode) {
    const workers = await this.getVisibleWorkers(lat, lng, mode);

    return {
      center: {
        lat,
        lng,
        mode,
      },
      workers,
    };
  }

  async getMapCandidatesForJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        urgency: true,
        status: true,
        lat: true,
        lng: true,
      },
    });

    if (!job) {
      const error = new Error("Job not found");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    if (job.lat == null || job.lng == null) {
      const error = new Error("Job location is missing");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const mode: MapMode = job.urgency === "EMERGENCY" ? "emergency" : "normal";
    const workers = await this.getVisibleWorkers(job.lat, job.lng, mode);

    return {
      job: {
        id: job.id,
        title: job.title,
        urgency: job.urgency,
        status: job.status,
        lat: job.lat,
        lng: job.lng,
      },
      workers,
    };
  }
}
