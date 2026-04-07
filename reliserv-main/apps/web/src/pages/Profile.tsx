import React from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, type ApiError } from "../api/client";

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "CUSTOMER" | "WORKER";
    phone?: string;
    reliabilityScore: number;
    workerProfile?: {
      categories: string[];
      radiusMiles: number;
      baseRate: number;
      emergencyOptIn: boolean;
      availableNow: boolean;
      serviceStatus?: "ONLINE" | "BUSY" | "OFFLINE";
      lastKnownLat?: number | null;
      lastKnownLng?: number | null;
      lastLocationAt?: string | null;
      lastHeartbeatAt?: string | null;
    } | null;
    createdAt: string;
  };
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    if (!getToken()) {
      navigate("/auth/login");
      return;
    }

    try {
      const res = await api<MeResponse>("/v1/auth/me", { auth: true });
      setUser(res.user);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        navigate("/auth/login");
        return;
      }
      setError(ae.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadProfile();
  }, []);

  if (loading) {
    return <div className="container mx-auto px-6 py-8">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
            <p className="text-slate-600">{user.email}</p>
            <p className="text-sm text-slate-500 mt-1">{user.role}</p>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-600">Reliability Score</div>
            <div className="text-3xl font-bold text-emerald-700">
              {user.reliabilityScore}
            </div>
          </div>
        </div>

        {user.workerProfile && (
          <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="font-semibold text-slate-900">Worker Profile</div>
            <div className="mt-2 text-sm text-slate-700">
              Categories: {user.workerProfile.categories.join(", ") || "None"}
            </div>
            <div className="text-sm text-slate-700">
              Radius: {user.workerProfile.radiusMiles} miles
            </div>
            <div className="text-sm text-slate-700">
              Base Rate: ${user.workerProfile.baseRate}
            </div>
            <div className="text-sm text-slate-700">
              Emergency Opt-in: {user.workerProfile.emergencyOptIn ? "Yes" : "No"}
            </div>
            <div className="text-sm text-slate-700">
              Available Now: {user.workerProfile.availableNow ? "Yes" : "No"}
            </div>
            <div className="text-sm text-slate-700">
              Service Status: {user.workerProfile.serviceStatus ?? "OFFLINE"}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => void loadProfile()}
            className="px-5 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition"
          >
            Refresh Profile
          </button>

          {user.role === "WORKER" && (
            <button
              onClick={() => navigate("/worker/mode")}
              className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition"
            >
              Open Worker Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
