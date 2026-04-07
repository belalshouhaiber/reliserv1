import { api } from "./client";

export type WorkerTrustInsightsResponse = {
  worker: {
    id: string;
    name: string;
    reliabilityScore: number;
  };
  metrics: {
    totalAssignedJobs: number;
    completedJobs: number;
    canceledJobs: number;
    emergencyCompletedJobs: number;
    completionRate: number;
    cancelRate: number;
    averageRating: number | null;
  };
  reviewBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  };
};

export type ReliabilityHistoryItem = {
  id: string;
  createdAt: string;
  oldScore: number;
  newScore: number;
  delta: number;
  reason: string;
  jobId?: string | null;
  note?: string | null;
};

export type ReliabilityHistoryResponse = {
  history: ReliabilityHistoryItem[];
};

export async function getWorkerTrustInsights(workerId: string) {
  return api<WorkerTrustInsightsResponse>(`/v2/workers/${workerId}/trust-insights`, {
    method: "GET",
    auth: true,
  });
}

export async function getReliabilityHistory(workerId: string) {
  return api<ReliabilityHistoryResponse>(`/v2/workers/${workerId}/reliability-history`, {
    method: "GET",
    auth: true,
  });
}
