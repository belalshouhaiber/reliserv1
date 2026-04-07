import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, getToken, type ApiError } from "../api/client";

type ReviewResponse = {
  review: {
    id: string;
    rating: number;
    reliabilityImpact: number;
    notes?: string;
  };
};

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "CUSTOMER" | "WORKER";
    reliabilityScore: number;
  };
};

type JobDetailsResponse = {
  job: {
    id: string;
    status: "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
    createdById: string;
    assignedWorkerId?: string | null;
    assignedWorker?: {
      id: string;
      name: string;
      reliabilityScore: number;
    } | null;
  };
};

type ReviewsResponse = {
  reviews: Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    rating: number;
    notes?: string;
    target: "CUSTOMER" | "WORKER";
  }>;
};

export default function Completion() {
  const navigate = useNavigate();
  const location = useLocation();
  const jobId = location.state?.jobId as string | undefined;

  const [job, setJob] = React.useState<JobDetailsResponse["job"] | null>(null);
  const [me, setMe] = React.useState<MeResponse["user"] | null>(null);
  const [rating, setRating] = React.useState(5);
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = React.useState(false);
  const [updatedScore, setUpdatedScore] = React.useState<number | null>(null);

  React.useEffect(() => {
    async function load() {
      setPageLoading(true);
      setError(null);

      if (!getToken()) {
        navigate("/auth/login");
        return;
      }

      if (!jobId) {
        setError("Missing job id. Please return from the live job page.");
        setPageLoading(false);
        return;
      }

      try {
        const [meRes, jobRes, reviewsRes] = await Promise.all([
          api<MeResponse>("/v1/auth/me", { auth: true }),
          api<JobDetailsResponse>(`/v1/jobs/${jobId}`, { auth: true }),
          api<ReviewsResponse>(`/v1/reviews/job/${jobId}`, { auth: true }),
        ]);

        setMe(meRes.user);
        setJob(jobRes.job);

        const mine = reviewsRes.reviews.find((r) => r.fromUserId === meRes.user.id);
        if (mine) {
          setAlreadyReviewed(true);
        }
      } catch (err) {
        const ae = err as ApiError;
        if (ae.status === 401) {
          navigate("/auth/login");
          return;
        }
        setError(ae.message || "Failed to load completion page");
      } finally {
        setPageLoading(false);
      }
    }

    void load();
  }, [jobId, navigate]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!jobId || !job || !me) {
      setError("Missing job or user context.");
      return;
    }

    if (job.status !== "COMPLETED") {
      setError("Job is not completed yet. Reviews are only allowed after completion.");
      return;
    }

    if (!job.assignedWorkerId) {
      setError("No assigned worker found for this job.");
      return;
    }

    setLoading(true);

    try {
      await api<ReviewResponse>("/v1/reviews", {
        method: "POST",
        auth: true,
        body: {
          jobId,
          toUserId: job.assignedWorkerId,
          target: "WORKER",
          rating,
          notes,
        },
      });

      const meAfter = await api<MeResponse>("/v1/auth/me", { auth: true });
      setUpdatedScore(meAfter.user.reliabilityScore);
      setAlreadyReviewed(true);
      setSuccess("Review submitted successfully.");
    } catch (err) {
      const ae = err as ApiError;

      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }

      if (ae.status === 409) {
        setError(ae.message || "Review already submitted or job not completed.");
        return;
      }

      if (ae.status === 403) {
        setError("You are not authorized to review this job.");
        return;
      }

      setError(ae.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return <div className="container mx-auto px-6 py-8">Loading completion page...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900">Customer Review</h1>
        <p className="text-slate-600 mt-1">
          Submit your review for the completed job.
        </p>

        {job && (
          <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="text-sm text-slate-600">Job Status</div>
            <div className="font-semibold text-slate-900">{job.status}</div>

            <div className="mt-3 text-sm text-slate-600">Assigned Worker</div>
            <div className="font-semibold text-slate-900">
              {job.assignedWorker?.name ?? "Worker"}
            </div>
            <div className="text-sm text-slate-600">
              Current reliability: {job.assignedWorker?.reliabilityScore ?? "?"}
            </div>
          </div>
        )}

        {me && (
          <div className="mt-4 text-sm text-slate-700">
            Your current reliability:{" "}
            <span className="font-semibold">
              {updatedScore ?? me.reliabilityScore}
            </span>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
            {success}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {alreadyReviewed ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700">
            You have already submitted a review for this job.
          </div>
        ) : (
          <form onSubmit={submitReview} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700">Rating</label>
              <select
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Neutral</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Very Poor</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Notes</label>
              <textarea
                rows={4}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
                placeholder="What went well? Any issues?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit Review"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
              >
                Back to Dashboard
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
