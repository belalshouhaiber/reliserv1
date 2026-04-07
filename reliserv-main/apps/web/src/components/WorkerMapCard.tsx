import type { MapWorker } from "../api/map";
import EtaPill from "./EtaPill";

type Props = {
  worker: MapWorker;
  mode: "normal" | "emergency";
};

export default function WorkerMapCard({ worker, mode }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{worker.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
            <span>Reliability {worker.reliabilityScore}</span>
            <span>
              {worker.distanceMiles != null
                ? `${worker.distanceMiles.toFixed(1)} mi away`
                : "Distance unavailable"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <EtaPill etaMinutes={worker.etaMinutes} />
            {mode === "emergency" && worker.emergencyOptIn ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                Emergency Ready
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>{worker.serviceStatus}</div>
        </div>
      </div>
    </div>
  );
}
