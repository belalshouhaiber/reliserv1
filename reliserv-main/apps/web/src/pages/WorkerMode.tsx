import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, MapPin, RefreshCw, Shield, Zap } from "lucide-react";
import { getToken, type ApiError } from "../api/client";
import {
  getWorkerEligibility,
  sendWorkerHeartbeat,
  updateEmergencyOptIn,
  updateWorkerStatus,
  type WorkerEligibilitySnapshot,
} from "../api/worker";
import WorkerStatusPill from "../components/WorkerStatusPill";
import EmergencyOptInToggle from "../components/EmergencyOptInToggle";

export default function WorkerMode() {
  const navigate = useNavigate();

  const [data, setData] = React.useState<WorkerEligibilitySnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function loadWorkerState() {
    setLoading(true);
    setError(null);

    if (!getToken()) {
      navigate("/auth/login");
      return;
    }

    try {
      const res = await getWorkerEligibility();
      setData(res);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to load worker availability");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadWorkerState();
  }, []);

  async function handleStatusChange(next: "ONLINE" | "OFFLINE") {
    setActionLoading(next);
    setError(null);
    setMessage(null);

    try {
      await updateWorkerStatus(next);
      const fresh = await getWorkerEligibility();
      setData(fresh);
      setMessage(`Worker status updated to ${fresh.serviceStatus}.`);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to update worker status");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEmergencyOptIn(next: boolean) {
    setActionLoading("emergency");
    setError(null);
    setMessage(null);

    try {
      await updateEmergencyOptIn(next);
      const fresh = await getWorkerEligibility();
      setData(fresh);
      setMessage(next ? "Emergency opt-in enabled." : "Emergency opt-in disabled.");
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to update emergency setting");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendHeartbeat() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setActionLoading("heartbeat");
    setError(null);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendWorkerHeartbeat(
            position.coords.latitude,
            position.coords.longitude
          );
          const fresh = await getWorkerEligibility();
          setData(fresh);
          setMessage("Heartbeat sent successfully.");
        } catch (err) {
          const ae = err as ApiError;
          if (ae.status === 401) {
            navigate("/auth/login");
            return;
          }
          setError(ae.message || "Failed to send heartbeat");
        } finally {
          setActionLoading(null);
        }
      },
      () => {
        setActionLoading(null);
        setError("Location permission denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">Loading worker mode...</div>
      </div>
    );
  }

  if (!data) return null;

  const isBusy = data.serviceStatus === "BUSY";
  const isOnline = data.serviceStatus === "ONLINE";
  const canGoOnline = !isBusy && data.serviceStatus !== "ONLINE";
  const canGoOffline = !isBusy && data.serviceStatus !== "OFFLINE";

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Worker Mode</h1>
              <p className="mt-1 text-slate-600">
                Control your live availability for normal and emergency jobs.
              </p>
            </div>

            <button
              onClick={() => void loadWorkerState()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <WorkerStatusPill status={data.serviceStatus} />
            <span className="text-sm text-slate-600">
              {isBusy
                ? "You are busy with an active assigned job."
                : isOnline
                  ? "You are online and can become match-eligible."
                  : "You are offline and will not receive jobs."}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => void handleStatusChange("ONLINE")}
              disabled={!canGoOnline || actionLoading !== null}
              className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Go Online
            </button>

            <button
              onClick={() => void handleStatusChange("OFFLINE")}
              disabled={!canGoOffline || actionLoading !== null}
              className="rounded-xl border border-slate-200 px-5 py-2 font-semibold transition hover:bg-slate-50 disabled:opacity-60"
            >
              Go Offline
            </button>

            <button
              onClick={() => void handleSendHeartbeat()}
              disabled={actionLoading !== null}
              className="rounded-xl border border-slate-200 px-5 py-2 font-semibold transition hover:bg-slate-50 disabled:opacity-60"
            >
              Send Heartbeat
            </button>
          </div>
        </div>

        <EmergencyOptInToggle
          checked={data.emergencyOptIn}
          disabled={actionLoading !== null}
          onChange={(checked) => void handleEmergencyOptIn(checked)}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-slate-900">Eligibility</h2>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Live heartbeat</span>
                <span className="font-medium">{data.hasLiveHeartbeat ? "Yes" : "No"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Active assigned job</span>
                <span className="font-medium">{data.hasActiveAssignedJob ? "Yes" : "No"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Standard eligible</span>
                <span className="font-medium">{data.standardEligible ? "Yes" : "No"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Emergency eligible</span>
                <span className="font-medium">{data.emergencyEligible ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Last Known Location</h2>
            </div>

            {data.presence ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Latitude</span>
                  <span className="font-medium">{data.presence.lat}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Longitude</span>
                  <span className="font-medium">{data.presence.lng}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Updated</span>
                  <span className="font-medium">
                    {new Date(data.presence.at).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                No live heartbeat yet. Send a heartbeat while online to become
                live-match eligible.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-slate-900">Phase 1 Notes</h2>
          </div>

          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>ONLINE workers can become eligible for matching.</li>
            <li>BUSY is controlled automatically by active assigned jobs.</li>
            <li>OFFLINE workers do not receive work.</li>
            <li>Emergency jobs require online status, heartbeat, and emergency opt-in.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
