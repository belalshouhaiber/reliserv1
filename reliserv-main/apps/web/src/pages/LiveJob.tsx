import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, MapPin, RefreshCw, Shield, Zap } from "lucide-react";
import { api, getToken, type ApiError } from "../api/client";
import {
  getRankedWorkersForJob,
  type RankedWorkersResponse,
} from "../api/matching";
import RankedWorkerList from "../components/RankedWorkerList";

type JobDetailsResponse = {
  job: {
    id: string;
    title: string;
    description: string;
    jobType: string;
    urgency: "NORMAL" | "EMERGENCY";
    status: "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
    locationText?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    lockedScope?: string | null;
    createdAt: string;
    createdById: string;
    assignedWorkerId?: string | null;
    assignedWorker?: {
      id: string;
      name: string;
      reliabilityScore: number;
    } | null;
    events: Array<{
      id: string;
      type: string;
      note?: string | null;
      createdAt: string;
    }>;
  };
};

export default function LiveJob() {
  const navigate = useNavigate();
  const location = useLocation();
  const jobId = location.state?.jobId as string | undefined;

  const [job, setJob] = React.useState<JobDetailsResponse["job"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [rankedWorkers, setRankedWorkers] = React.useState<RankedWorkersResponse["workers"]>([]);
  const [rankingLoading, setRankingLoading] = React.useState(false);
  const [rankingError, setRankingError] = React.useState<string | null>(null);

  async function loadRankedWorkers(currentJobId: string) {
    setRankingLoading(true);
    setRankingError(null);

    try {
      const res = await getRankedWorkersForJob(currentJobId);
      setRankedWorkers(res.workers ?? []);
    } catch (err) {
      const ae = err as ApiError;
      setRankingError(ae.message || "Failed to load ranked workers");
    } finally {
      setRankingLoading(false);
    }
  }

  async function loadJob(showSpinner = true) {
    if (!jobId) {
      setError("Missing job id. Open this page from the dashboard or emergency flow.");
      setLoading(false);
      return;
    }

    if (!getToken()) {
      navigate("/auth/login");
      return;
    }

    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const res = await api<JobDetailsResponse>(`/v1/jobs/${jobId}`, { auth: true });
      setJob(res.job);

      if (
        res.job.urgency !== "EMERGENCY" &&
        (res.job.status === "OPEN" || res.job.status === "LOCKED")
      ) {
        await loadRankedWorkers(res.job.id);
      } else {
        setRankedWorkers([]);
        setRankingError(null);
      }
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to load live job");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    void loadJob();
  }, [jobId, navigate]);

  async function handleCancel() {
    if (!jobId) return;

    setActionMessage(null);
    setError(null);
    setRefreshing(true);

    try {
      await api(`/v1/jobs/${jobId}/cancel`, {
        method: "POST",
        auth: true,
      });

      setActionMessage("Job canceled.");
      await loadJob(false);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to cancel job");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-6 py-8">Loading live job...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{job?.title ?? "Live Job"}</h1>
                {job?.urgency === "EMERGENCY" && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    EMERGENCY
                  </span>
                )}
              </div>
              <p className="text-slate-600 mt-1">{job?.description}</p>
            </div>

            <button
              onClick={() => void loadJob(false)}
              disabled={refreshing}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition font-semibold disabled:opacity-60 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {actionMessage && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
              {actionMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {job && (
            <>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Clock className="w-4 h-4" />
                    Status
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-1">{job.status}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <MapPin className="w-4 h-4" />
                    Location
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-1">{job.locationText ?? "Unknown"}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Assigned Worker
                  </div>
                  <p className="text-lg font-bold text-emerald-700 mt-1">
                    {job.assignedWorker?.name ?? "Waiting for accept"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Reliability: {job.assignedWorker?.reliabilityScore ?? "?"}
                  </p>
                </div>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
                <p className="font-semibold text-slate-900 mb-2">Locked scope</p>
                <p className="text-slate-700">{job.lockedScope || job.description}</p>

                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Events: {job.events.map((event) => event.type).join(" -> ")}
                </div>
              </div>

              {job.urgency !== "EMERGENCY" &&
                (job.status === "OPEN" || job.status === "LOCKED") && (
                <div className="mb-6">
                  <RankedWorkerList
                    title="Recommended workers"
                    subtitle="Ranked using reliability, availability, proximity, and completion history."
                    workers={rankedWorkers}
                    mode="NORMAL"
                    loading={rankingLoading}
                    error={rankingError}
                    emptyText="No eligible workers available for this job right now."
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {job.status === "OPEN" && (
                  <button
                    onClick={() => void handleCancel()}
                    disabled={refreshing}
                    className="px-6 py-3 border border-red-200 text-red-700 rounded-xl font-semibold hover:bg-red-50 transition disabled:opacity-60"
                  >
                    Cancel Job
                  </button>
                )}

                {job.status === "COMPLETED" && (
                  <button
                    onClick={() => navigate("/completion", { state: { jobId: job.id } })}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition"
                  >
                    Review Completed Job
                  </button>
                )}

                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-6 py-3 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
                >
                  Back to Dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
