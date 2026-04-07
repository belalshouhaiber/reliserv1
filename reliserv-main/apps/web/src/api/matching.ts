import { api } from "./client";

export type RankedWorker = {
  rank: number;
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

export type RankedWorkersResponse = {
  job: {
    id: string;
    title: string;
    urgency: "NORMAL" | "EMERGENCY";
    status: "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  };
  workers: RankedWorker[];
};

export async function getRankedWorkersForJob(jobId: string) {
  return api<RankedWorkersResponse>(`/v2/jobs/${jobId}/ranked-workers`, {
    method: "GET",
    auth: true,
  });
}

export async function getRankedWorkersForEmergency(jobId: string) {
  return api<RankedWorkersResponse>(`/v2/emergency/${jobId}/ranked-workers`, {
    method: "GET",
    auth: true,
  });
}
