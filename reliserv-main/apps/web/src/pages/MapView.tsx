import React from "react";
import { AlertCircle, MapPin, RefreshCw, Zap } from "lucide-react";
import { getMapWorkers, type MapWorker } from "../api/map";
import WorkerMapCard from "../components/WorkerMapCard";

export default function MapView() {
  const [mode, setMode] = React.useState<"normal" | "emergency">("normal");
  const [workers, setWorkers] = React.useState<MapWorker[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );

  async function loadWorkers(
    lat: number,
    lng: number,
    nextMode: "normal" | "emergency",
  ) {
    setLoading(true);
    setError(null);

    try {
      const res = await getMapWorkers(lat, lng, nextMode);
      setWorkers(res.workers ?? []);
      setCenter({ lat: res.center.lat, lng: res.center.lng });
    } catch (err: any) {
      setError(err?.message || "Failed to load map workers");
    } finally {
      setLoading(false);
    }
  }

  function loadFromBrowserLocation(nextMode: "normal" | "emergency" = mode) {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setLoading(false);
      setError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMode(nextMode);
        void loadWorkers(lat, lng, nextMode);
      },
      () => {
        setLoading(false);
        setError("Unable to get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  React.useEffect(() => {
    loadFromBrowserLocation("normal");
  }, []);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Worker Map View</h1>
              <p className="mt-1 text-slate-600">
                See live available workers near your current location.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => loadFromBrowserLocation("normal")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${
                  mode === "normal"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 hover:bg-slate-50"
                }`}
              >
                Normal
              </button>

              <button
                onClick={() => loadFromBrowserLocation("emergency")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${
                  mode === "emergency"
                    ? "bg-red-600 text-white"
                    : "border border-slate-200 hover:bg-slate-50"
                }`}
              >
                Emergency
              </button>

              <button
                onClick={() => loadFromBrowserLocation(mode)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-semibold transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {center ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-blue-600" />
              Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-semibold text-slate-900">Map placeholder</div>
          <div className="mt-2 text-sm text-slate-600">
            Next visual step: replace this panel with a real map library. For now, this
            page shows the live candidate list that will power the map overlays.
          </div>

          {center ? (
            <div className="mt-4 text-sm text-slate-700">
              {mode === "emergency" ? (
                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                  <Zap className="h-4 w-4" />
                  Emergency-only eligible workers
                </span>
              ) : (
                <span className="font-medium text-slate-700">
                  Standard eligible workers
                </span>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "emergency" ? "Emergency visible workers" : "Visible workers"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            These workers are filtered by live availability, heartbeat, and mode-specific
            eligibility.
          </p>

          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-slate-600">Loading visible workers...</div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : workers.length === 0 ? (
              <div className="text-sm text-slate-600">
                No eligible workers visible right now.
              </div>
            ) : (
              <div className="space-y-4">
                {workers.map((worker) => (
                  <WorkerMapCard key={worker.workerId} worker={worker} mode={mode} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
