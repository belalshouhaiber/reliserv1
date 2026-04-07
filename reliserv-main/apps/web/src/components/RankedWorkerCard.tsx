import { Clock3, MapPin, Shield, Star, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { RankedWorker } from "../api/matching";

type Props = {
  worker: RankedWorker;
  mode: "NORMAL" | "EMERGENCY";
};

export default function RankedWorkerCard({ worker, mode }: Props) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {worker.rank}
            </span>

            <h3 className="text-lg font-semibold text-slate-900">{worker.name}</h3>

            {mode === "EMERGENCY" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                <Zap className="h-3 w-3" />
                PRIORITIZED
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Shield className="h-4 w-4 text-emerald-600" />
              Reliability {worker.reliabilityScore}
            </span>

            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-500" />
              Completion {(worker.completionRate * 100).toFixed(0)}%
            </span>

            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4 text-blue-600" />
              {worker.distanceMiles != null
                ? `${worker.distanceMiles.toFixed(1)} mi`
                : "Distance unavailable"}
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4 text-violet-600" />
              {worker.etaMinutes != null
                ? `${worker.etaMinutes} min ETA`
                : "ETA unavailable"}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-900">Why recommended</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {worker.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          {mode === "EMERGENCY" && worker.emergencyCompletionCount > 0 && (
            <div className="mt-3 text-sm text-slate-600">
              Emergency completions:{" "}
              <span className="font-semibold text-slate-900">
                {worker.emergencyCompletionCount}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(`/worker/trust/${worker.workerId}`)}
            className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View trust insights
          </button>
        </div>

        <div className="min-w-[92px] text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">Match score</div>
          <div className="text-2xl font-bold text-slate-900">{worker.score}</div>
        </div>
      </div>
    </div>
  );
}
