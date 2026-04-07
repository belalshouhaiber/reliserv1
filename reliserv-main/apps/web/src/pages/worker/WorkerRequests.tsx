import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Clock, MapPin, Shield, Zap } from "lucide-react";
import { api, getToken, type ApiError } from "../../api/client";

type WorkerRequestJob = {
  id: string;
  title: string;
  description: string;
  jobType: string;
  urgency: "NORMAL" | "EMERGENCY";
  status: "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  priceMin?: number | null;
  priceMax?: number | null;
  locationText?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    reliabilityScore: number;
  };
};

type WorkerRequestsResponse = {
  jobs: WorkerRequestJob[];
};

type AcceptResponse = {
  job: {
    id: string;
    status: string;
    assignedWorkerId?: string | null;
  };
};

export default function WorkerRequests() {
  const navigate = useNavigate();

  const [jobs, setJobs] = React.useState<WorkerRequestJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [acceptingJobId, setAcceptingJobId] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError(null);
    setActionMessage(null);

    const token = getToken();
    if (!token) {
      setLoading(false);
      navigate("/auth/login");
      return;
    }

    try {
      const res = await api<WorkerRequestsResponse>("/v1/worker/requests", {
        method: "GET",
        auth: true,
      });

      setJobs(res.jobs ?? []);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to load worker requests");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRequests();
  }, []);

  async function handleAccept(jobId: string) {
    if (!getToken()) {
      navigate("/auth/login");
      return;
    }

    setAcceptingJobId(jobId);
    setActionMessage(null);
    setError(null);

    try {
      const res = await api<AcceptResponse>(`/v1/jobs/${jobId}/accept`, {
        method: "POST",
        auth: true,
      });

      if (res.job?.status === "LOCKED") {
        navigate(`/worker/live-job/${jobId}`);
      } else {
        setActionMessage("Job accepted.");
      }
    } catch (err) {
      const ae = err as ApiError;

      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }

      if (ae.status === 409) {
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        setActionMessage("Job already taken by another worker.");
        return;
      }

      setError(ae.message || "Failed to accept job");
    } finally {
      setAcceptingJobId(null);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Worker Requests</h1>
            <p className="text-slate-600 mt-1">
              Live emergency requests from the backend.
            </p>
          </div>

          <button
            onClick={() => void loadRequests()}
            disabled={loading}
            className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition font-semibold disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {loading ? (
            <div className="text-slate-600">Loading worker requests...</div>
          ) : jobs.length === 0 ? (
            <div className="text-slate-600">No open emergency jobs right now.</div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-5 border border-slate-200 rounded-xl hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {job.title}
                        </h3>

                        {job.urgency === "EMERGENCY" && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            EMERGENCY
                          </span>
                        )}

                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                          {job.status}
                        </span>
                      </div>

                      <p className="text-slate-600 mt-2">{job.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(job.createdAt).toLocaleString()}
                        </span>

                        <span className="flex items-center gap-1 capitalize">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          {job.createdBy?.reliabilityScore ?? "?"}%
                        </span>

                        <span className="capitalize">{job.jobType}</span>

                        {job.locationText && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.locationText}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-slate-700">
                        Customer:{" "}
                        <span className="font-medium">
                          {job.createdBy?.name ?? "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-[150px] text-right">
                      <div className="text-lg font-bold text-slate-900">
                        ${job.priceMin ?? "?"} - ${job.priceMax ?? "?"}
                      </div>

                      <button
                        onClick={() => void handleAccept(job.id)}
                        disabled={acceptingJobId === job.id}
                        className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition disabled:opacity-60"
                      >
                        {acceptingJobId === job.id ? "Accepting..." : "Accept"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500">
            V1 worker flow: open emergency jobs load from the API, and first
            accept locks the job.
          </div>
        </div>
      </div>
    </div>
  );
}
