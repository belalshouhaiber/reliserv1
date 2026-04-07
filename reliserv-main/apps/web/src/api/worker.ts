import { api } from "./client";

export type WorkerServiceStatus = "ONLINE" | "BUSY" | "OFFLINE";

export type WorkerAvailabilityDto = {
  userId: string;
  serviceStatus: WorkerServiceStatus;
  emergencyOptIn: boolean;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationAt: string | null;
  lastHeartbeatAt: string | null;
};

export type WorkerHeartbeatResponse = {
  ok: true;
  expiresInSeconds: number;
};

export type WorkerEligibilitySnapshot = {
  userId: string;
  serviceStatus: WorkerServiceStatus;
  emergencyOptIn: boolean;
  hasLiveHeartbeat: boolean;
  hasActiveAssignedJob: boolean;
  standardEligible: boolean;
  emergencyEligible: boolean;
  presence: {
    userId: string;
    lat: number;
    lng: number;
    at: string;
  } | null;
};

export async function updateWorkerStatus(serviceStatus: "ONLINE" | "OFFLINE") {
  return api<WorkerAvailabilityDto>("/v2/worker/status", {
    method: "PATCH",
    auth: true,
    body: { serviceStatus },
  });
}

export async function updateEmergencyOptIn(emergencyOptIn: boolean) {
  return api<WorkerAvailabilityDto>("/v2/worker/emergency-opt-in", {
    method: "PATCH",
    auth: true,
    body: { emergencyOptIn },
  });
}

export async function sendWorkerHeartbeat(lat: number, lng: number) {
  return api<WorkerHeartbeatResponse>("/v2/worker/heartbeat", {
    method: "POST",
    auth: true,
    body: { lat, lng },
  });
}

export async function getWorkerEligibility() {
  return api<WorkerEligibilitySnapshot>("/v2/worker/eligibility", {
    method: "GET",
    auth: true,
  });
}
