import type { RankedWorker } from "../api/matching";
import RankedWorkerCard from "./RankedWorkerCard";

type Props = {
  title: string;
  subtitle?: string;
  workers: RankedWorker[];
  mode: "NORMAL" | "EMERGENCY";
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
};

export default function RankedWorkerList({
  title,
  subtitle,
  workers,
  mode,
  loading = false,
  error = null,
  emptyText = "No ranked workers available.",
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>

      {loading ? (
        <div className="text-sm text-slate-600">Loading ranked workers...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : workers.length === 0 ? (
        <div className="text-sm text-slate-600">{emptyText}</div>
      ) : (
        <div className="space-y-4">
          {workers.map((worker) => (
            <RankedWorkerCard
              key={worker.workerId}
              worker={worker}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
