import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, MapPin, Shield, Zap } from "lucide-react";
import { api, getToken, type ApiError } from "../api/client";
import {
  getRankedWorkersForEmergency,
  type RankedWorkersResponse,
} from "../api/matching";
import RankedWorkerList from "../components/RankedWorkerList";

type EmergencyResponse = {
  job: {
    id: string;
    title?: string | null;
    status?: "OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  };
};

export default function Emergency() {
  const navigate = useNavigate();

  const [jobType, setJobType] = React.useState("plumbing");
  const [description, setDescription] = React.useState("");
  const [locationText, setLocationText] = React.useState("Use current location");
  const [lat, setLat] = React.useState<number | null>(null);
  const [lng, setLng] = React.useState<number | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdEmergencyJobId, setCreatedEmergencyJobId] = React.useState<string | null>(null);
  const [createdEmergencyTitle, setCreatedEmergencyTitle] = React.useState<string | null>(null);
  const [rankedWorkers, setRankedWorkers] = React.useState<RankedWorkersResponse["workers"]>([]);
  const [rankingLoading, setRankingLoading] = React.useState(false);
  const [rankingError, setRankingError] = React.useState<string | null>(null);

  const requestBrowserLocation = React.useCallback(async () => {
    if (locationLoading) {
      return null;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationError("Location access is not supported in this browser.");
      return null;
    }

    setLocationLoading(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;
      const nextLocationText = `Current location (${nextLat.toFixed(5)}, ${nextLng.toFixed(5)})`;

      setLat(nextLat);
      setLng(nextLng);
      setLocationText(nextLocationText);
      return { lat: nextLat, lng: nextLng, locationText: nextLocationText };
    } catch (err) {
      let nextMessage = "We couldn't get your location. Check browser permissions and try again.";

      const geoError = err as GeolocationPositionError;
      if (geoError?.code === 1) {
        nextMessage = "Location permission was denied. Allow access to use your current location.";
      } else if (geoError?.code === 2) {
        nextMessage = "Your location is unavailable right now. Try again in a moment.";
      } else if (geoError?.code === 3) {
        nextMessage = "Location lookup timed out. Try clicking the field again.";
      }

      setLat(null);
      setLng(null);
      setLocationError(nextMessage);
      return null;
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoading]);

  async function loadEmergencyRanking(jobId: string) {
    setRankingLoading(true);
    setRankingError(null);

    try {
      const res = await getRankedWorkersForEmergency(jobId);
      setRankedWorkers(res.workers ?? []);
    } catch (err) {
      const ae = err as ApiError;
      setRankingError(ae.message || "Failed to load ranked emergency workers");
    } finally {
      setRankingLoading(false);
    }
  }

  async function createEmergency() {
    setError(null);

    if (!description.trim()) {
      setError("Please describe the emergency before sending the request.");
      return;
    }

    if (!getToken()) {
      navigate("/auth/login");
      return;
    }

    let nextLat = lat;
    let nextLng = lng;
    let nextLocationText = locationText.trim() || "Use current location";

    if (nextLat == null || nextLng == null) {
      const coords = await requestBrowserLocation();
      if (!coords) {
        setError("Please enable location access before creating an emergency request.");
        return;
      }

      nextLat = coords.lat;
      nextLng = coords.lng;
      nextLocationText = coords.locationText;
    }

    if (nextLat == null || nextLng == null) {
      setError("Please enable location access before creating an emergency request.");
      return;
    }

    setLoading(true);
    setRankedWorkers([]);
    setRankingError(null);

    try {
      const res = await api<EmergencyResponse>("/v1/emergency", {
        method: "POST",
        auth: true,
        body: {
          description: description.trim(),
          jobType,
          locationText: nextLocationText,
          lat: nextLat,
          lng: nextLng,
          priceMin: 220,
          priceMax: 380,
          lockedScope: description.trim(),
        },
      });

      setCreatedEmergencyJobId(res.job.id);
      setCreatedEmergencyTitle(res.job.title ?? `Emergency - ${jobType}`);
      void loadEmergencyRanking(res.job.id);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to create emergency request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-8 text-white mb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Zap className="w-7 h-7" />
                Emergency Mode
              </h1>
              <p className="text-red-100 mt-2">
                Create a real emergency job. First worker accept locks it.
              </p>
            </div>

            <div className="bg-white/15 rounded-xl p-4 border border-white/20">
              <p className="text-sm text-red-100">Backend path</p>
              <p className="text-xl font-bold">POST /v1/emergency</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Emergency Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="cleaning">Cleaning</option>
                <option value="handyman">Handyman</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Location</label>
              <div className="mt-2 flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3">
                <MapPin className="w-4 h-4 text-slate-500" />
                <input
                  value={locationText}
                  onClick={() => void requestBrowserLocation()}
                  onFocus={() => {
                    if (lat == null || lng == null) {
                      void requestBrowserLocation();
                    }
                  }}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    setLocationError(null);
                  }}
                  className="w-full bg-transparent outline-none text-slate-700"
                  aria-invalid={locationError ? "true" : "false"}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {locationLoading
                  ? "Getting your current location..."
                  : "Click the field to use your browser location."}
              </p>
              {locationError && (
                <p className="mt-2 text-sm text-amber-700">{locationError}</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm font-semibold text-slate-700">What happened?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
              placeholder="Example: water heater stopped working and there is leaking near the base..."
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Shield className="w-4 h-4 text-emerald-600" />
              Demo-safe defaults
            </div>
            <p className="mt-2">Emergency jobs are created with a `220-380` range and appear immediately in worker requests.</p>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => void createEmergency()}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Emergency Request"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-6 py-3 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
            >
              Back to Dashboard
            </button>
          </div>

          {createdEmergencyJobId && (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                      Emergency job created
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {createdEmergencyTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-700">
                      Job ID: {createdEmergencyJobId}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {locationText.trim() || "Use current location"} | {jobType}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/live-job", { state: { jobId: createdEmergencyJobId } })}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open Live Job
                  </button>
                </div>
              </div>

              <RankedWorkerList
                title="Recommended emergency workers"
                subtitle="These workers are prioritized by live availability, proximity, reliability, and emergency readiness."
                workers={rankedWorkers}
                mode="EMERGENCY"
                loading={rankingLoading}
                error={rankingError}
                emptyText="No emergency-eligible workers are available right now."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
