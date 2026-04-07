import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CheckCircle, Wrench, Zap } from "lucide-react";

export default function WorkerOnboarding({
  workerProfile,
  setWorkerProfile,
}: {
  workerProfile: any;
  setWorkerProfile: (v: any) => void;
}) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(workerProfile.categories?.join(", ") || "plumbing, electrical");
  const [radiusMiles, setRadiusMiles] = useState(workerProfile.radiusMiles || 15);
  const [baseRate, setBaseRate] = useState(workerProfile.baseRate || 75);
  const [emergencyOptIn, setEmergencyOptIn] = useState(workerProfile.emergencyOptIn ?? true);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900">Worker Onboarding</h1>
        <p className="text-slate-600 mt-1">Set your service area, categories, and emergency preference.</p>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div>
            <label className="text-sm font-semibold text-slate-700">Categories</label>
            <input
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
              placeholder="plumbing, electrical"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Service Radius (miles)</label>
            <input
              type="number"
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Base Rate ($/hr)</label>
            <input
              type="number"
              value={baseRate}
              onChange={(e) => setBaseRate(Number(e.target.value))}
              className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
            />
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-semibold text-slate-900">Emergency Opt-in</p>
                <p className="text-xs text-slate-600">Receive emergency requests</p>
              </div>
            </div>
            <button
              onClick={() => setEmergencyOptIn((v: boolean) => !v)}
              className={`px-3 py-1.5 rounded-xl font-semibold border ${
                emergencyOptIn ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {emergencyOptIn ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> V1: onboarding is local state (mock).
          </div>

          <button
            onClick={() => {
              setWorkerProfile({
                ...workerProfile,
                categories: categories.split(",").map((s: string) => s.trim()).filter(Boolean),
                radiusMiles,
                baseRate,
                emergencyOptIn,
              });
              navigate("/worker/dashboard");
            }}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
