import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Zap, Clock, Wrench, ToggleLeft, ToggleRight } from "lucide-react";
import { api, getToken, type ApiError } from "../../api/client";
import { mockData } from "../../mock/mockData";

export default function WorkerDashboard({
  user,
  workerProfile,
  setWorkerProfile,
}: {
  user: any;
  workerProfile: any;
  setWorkerProfile: React.Dispatch<React.SetStateAction<any>>;
}) {
  const navigate = useNavigate();
  const jobs = mockData.jobs;
  const [heartbeatError, setHeartbeatError] = React.useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = React.useState<string | null>(null);

  const availableNow = workerProfile.availableNow ?? true;

  React.useEffect(() => {
    let active = true;

    async function sendHeartbeat() {
      const token = getToken();

      if (!token) {
        return;
      }

      try {
        await api("/v2/worker/heartbeat", {
          method: "POST",
          auth: true,
          body: {
            lat: 27.8006,
            lng: -97.3964,
          },
        });

        if (!active) {
          return;
        }

        const heartbeatAt = new Date().toISOString();
        setHeartbeatError(null);
        setLastHeartbeatAt(heartbeatAt);
        setWorkerProfile((prev: any) => ({
          ...prev,
          availableNow: true,
          serviceStatus: "ONLINE",
          lastKnownLat: 27.8006,
          lastKnownLng: -97.3964,
          lastHeartbeatAt: heartbeatAt,
          lastLocationAt: heartbeatAt,
        }));
      } catch (err) {
        if (!active) {
          return;
        }

        const ae = err as ApiError;
        if (ae.status === 401) {
          navigate("/auth/login");
          return;
        }

        setHeartbeatError(ae.message || "Auto-heartbeat failed. We will keep retrying.");
      }
    }

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [navigate, setWorkerProfile]);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Worker Dashboard</h1>
            <p className="text-slate-600 mt-1">Track requests, availability, and emergency opt-in.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/worker/onboarding")}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition font-semibold"
            >
              Edit Profile
            </button>

            <button
              onClick={() => setWorkerProfile({ ...workerProfile, availableNow: !availableNow })}
              className={`px-4 py-2 rounded-xl font-semibold border flex items-center gap-2 ${
                availableNow ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {availableNow ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {availableNow ? "Available" : "Offline"}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600">Your reliability</p>
            <p className="text-3xl font-bold text-emerald-700 mt-2 flex items-center gap-2">
              <Shield className="w-7 h-7 text-emerald-600" />
              {user.reliabilityScore}%
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600">Emergency opt-in</p>
            <p className="text-3xl font-bold text-slate-900 mt-2 flex items-center gap-2">
              <Zap className="w-7 h-7 text-red-500" />
              {workerProfile.emergencyOptIn ? "ON" : "OFF"}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600">Categories</p>
            <p className="text-lg font-semibold text-slate-900 mt-2">{workerProfile.categories?.join(", ") || "plumbing"}</p>
            <p className="text-xs text-slate-500 mt-1">{workerProfile.radiusMiles || 15} mile radius</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Live Heartbeat</h2>
              <p className="mt-1 text-sm text-slate-600">
                Worker heartbeat sends automatically on load and every 30 seconds.
              </p>
            </div>

            <div className="text-sm text-slate-600">
              {lastHeartbeatAt
                ? `Last heartbeat: ${new Date(lastHeartbeatAt).toLocaleTimeString()}`
                : "Sending initial heartbeat..."}
            </div>
          </div>

          {heartbeatError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {heartbeatError}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Incoming Requests</h2>
            <button onClick={() => navigate("/worker/requests")} className="text-emerald-700 font-semibold hover:underline">
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {jobs.slice(0, 3).map((job) => (
              <div key={job.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{job.title}</p>
                      {job.isEmergency && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Zap className="w-3 h-3" /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {job.estimatedTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-4 h-4" /> {job.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-4 h-4 text-emerald-600" /> {job.poster.reliability}%
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/worker/live-job/${job.id}`)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Sprint 3–4: implement accept/decline + lock-on-accept for emergencies.
          </div>
        </div>
      </div>
    </div>
  );
}
