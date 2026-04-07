import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getToken, type ApiError } from "../api/client";
import {
  getReliabilityHistory,
  getWorkerTrustInsights,
  type ReliabilityHistoryItem,
  type WorkerTrustInsightsResponse,
} from "../api/trust";
import TrustInsightCard from "../components/TrustInsightCard";
import ReliabilityHistoryList from "../components/ReliabilityHistoryList";

export default function WorkerTrustInsights() {
  const { workerId } = useParams();
  const navigate = useNavigate();

  const [insights, setInsights] = React.useState<WorkerTrustInsightsResponse | null>(null);
  const [history, setHistory] = React.useState<ReliabilityHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      if (!getToken()) {
        navigate("/auth/login");
        return;
      }

      if (!workerId) {
        setError("Missing worker id");
        setLoading(false);
        return;
      }

      try {
        const [insightsRes, historyRes] = await Promise.all([
          getWorkerTrustInsights(workerId),
          getReliabilityHistory(workerId),
        ]);

        setInsights(insightsRes);
        setHistory(historyRes.history ?? []);
      } catch (err) {
        const ae = err as ApiError;
        if (ae.status === 401) {
          navigate("/auth/login");
          return;
        }
        setError(ae.message || "Failed to load trust insights");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [workerId, navigate]);

  if (loading) {
    return <div className="container mx-auto px-6 py-8">Loading trust insights...</div>;
  }

  if (error || !insights) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error || "Unable to load trust insights"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">{insights.worker.name}</h1>
        <p className="mt-1 text-slate-600">
          Reliability score:{" "}
          <span className="font-semibold">{insights.worker.reliabilityScore}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TrustInsightCard
          label="Completion rate"
          value={`${(insights.metrics.completionRate * 100).toFixed(0)}%`}
        />
        <TrustInsightCard
          label="Cancel rate"
          value={`${(insights.metrics.cancelRate * 100).toFixed(0)}%`}
        />
        <TrustInsightCard
          label="Emergency completions"
          value={`${insights.metrics.emergencyCompletedJobs}`}
        />
        <TrustInsightCard
          label="Review average"
          value={
            insights.metrics.averageRating != null
              ? insights.metrics.averageRating.toFixed(1)
              : "—"
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Review breakdown</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>Positive</span>
              <span className="font-semibold">{insights.reviewBreakdown.positive}</span>
            </div>
            <div className="flex justify-between">
              <span>Neutral</span>
              <span className="font-semibold">{insights.reviewBreakdown.neutral}</span>
            </div>
            <div className="flex justify-between">
              <span>Negative</span>
              <span className="font-semibold">{insights.reviewBreakdown.negative}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3">
              <span>Total</span>
              <span className="font-semibold">{insights.reviewBreakdown.total}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Job totals</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>Total assigned</span>
              <span className="font-semibold">{insights.metrics.totalAssignedJobs}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="font-semibold">{insights.metrics.completedJobs}</span>
            </div>
            <div className="flex justify-between">
              <span>Canceled</span>
              <span className="font-semibold">{insights.metrics.canceledJobs}</span>
            </div>
          </div>
        </div>
      </div>

      <ReliabilityHistoryList items={history} />
    </div>
  );
}
