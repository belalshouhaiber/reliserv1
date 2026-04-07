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

export type UpdateWorkerStatusInput = {
  serviceStatus: "ONLINE" | "OFFLINE";
};

export type UpdateEmergencyOptInInput = {
  emergencyOptIn: boolean;
};

export type WorkerHeartbeatInput = {
  lat: number;
  lng: number;
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
