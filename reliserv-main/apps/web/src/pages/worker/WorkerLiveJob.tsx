import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, MapPin, RefreshCw, Shield, Zap } from "lucide-react";
import { api, getToken, type ApiError } from "../../api/client";

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
    createdBy?: {
      id: string;
      name: string;
      reliabilityScore: number;
    } | null;
    assignedWorkerId?: string | null;
  };
};

export default function WorkerLiveJob() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = React.useState<JobDetailsResponse["job"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  async function loadJob(showSpinner = true) {
    if (!jobId) {
      setError("Missing job id.");
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
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to load worker live job");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    void loadJob();
  }, [jobId, navigate]);

  async function handleStart() {
    if (!jobId) return;

    setActionMessage(null);
    setError(null);
    setRefreshing(true);

    try {
      const res = await api<JobDetailsResponse>(`/v1/jobs/${jobId}/start`, {
        method: "POST",
        auth: true,
      });

      setJob(res.job);
      setActionMessage("Job started.");
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to start job");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-6 py-8">Loading worker live job...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{job?.title ?? "Worker Live Job"}</h1>
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
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Status
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">{job.status}</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Customer Reliability
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {job.createdBy?.reliabilityScore ?? "?"}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">{job.locationText ?? "Unknown"}</p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
              <p className="font-semibold text-slate-900 mb-2">Locked scope</p>
              <p className="text-slate-700">{job.lockedScope || job.description}</p>

              <div className="mt-4 text-sm text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Follow the locked scope to protect reliability.
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {job.status === "LOCKED" && (
                <button
                  onClick={() => void handleStart()}
                  disabled={refreshing}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition disabled:opacity-60"
                >
                  Start Job
                </button>
              )}

              {(job.status === "IN_PROGRESS" || job.status === "COMPLETED") && (
                <button
                  onClick={() => navigate("/worker/completion", { state: { jobId: job.id } })}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
                >
                  {job.status === "COMPLETED" ? "Open Review Flow" : "Complete Job"}
                </button>
              )}

              <button
                onClick={() => navigate("/worker/requests")}
                className="px-6 py-3 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
              >
                Back to Requests
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
