import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle, DollarSign, MapPin, Shield, Sparkles, Upload, Zap } from "lucide-react";
import { api } from "../api/client";

type CreateJobBody = {
  title: string;
  description: string;
  jobType: string;
  urgency: "EMERGENCY" | "NORMAL";
  priceMin?: number;
  priceMax?: number;
  lockedScope?: string;
  locationText?: string;
  lat?: number;
  lng?: number;
};

export default function CreateJob() {
  const navigate = useNavigate();

  const [jobType, setJobType] = useState("plumbing");
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [showAIQuestions, setShowAIQuestions] = useState(false);
  const [aiQuestionsCompleted, setAiQuestionsCompleted] = useState(false);
  const [questions, setQuestions] = useState({
    urgency: "",
    access: "",
    previousFixes: "",
    photos: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const priceMin = isEmergency ? 220 : 90;
  const priceMax = isEmergency ? 380 : 160;

  const onStartAI = () => setShowAIQuestions(true);

  const onFinishAI = () => {
    setAiQuestionsCompleted(true);
    setShowAIQuestions(false);
  };

  function buildLockedScope() {
    const parts: string[] = [];
    if (description.trim()) parts.push(description.trim());
    if (aiQuestionsCompleted) {
      if (questions.urgency.trim()) parts.push(`Urgency: ${questions.urgency.trim()}`);
      if (questions.access.trim()) parts.push(`Access: ${questions.access.trim()}`);
      if (questions.previousFixes.trim()) parts.push(`Previous fixes: ${questions.previousFixes.trim()}`);
    }
    return parts.join("\n");
  }

  const onPostJob = async () => {
    setSubmitError(null);

    if (!description.trim()) {
      setSubmitError("Please add a description so workers know what you need.");
      return;
    }

    setSubmitting(true);
    try {
      const title = `${isEmergency ? "Emergency - " : ""}${jobType[0].toUpperCase()}${jobType.slice(1)} job`;

      const body: CreateJobBody = {
        title,
        description: description.trim(),
        jobType,
        urgency: isEmergency ? "EMERGENCY" : "NORMAL",
        priceMin,
        priceMax,
        lockedScope: buildLockedScope(),
        locationText: "Use current location",
      };

      const res = await api<{ job: { id: string } }>("/v1/jobs", {
        method: "POST",
        body,
      });

      navigate("/live-job", { state: { jobId: res.job.id } });
    } catch (e: any) {
      setSubmitError(e?.message || "Failed to post job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Post a Job</h1>
              <p className="text-slate-600 mt-1">Describe what you need. We will help clarify scope and pricing.</p>
            </div>

            <button
              onClick={() => setIsEmergency((v) => !v)}
              className={`px-4 py-2 rounded-xl font-semibold border transition-all flex items-center gap-2 ${
                isEmergency
                  ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-red-400"
              }`}
            >
              <Zap className="w-4 h-4" />
              Emergency
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                <span className="text-slate-700">Use current location</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Example: kitchen faucet leaking, worse when turned off..."
              className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">AI Job Clarity</p>
                  <p className="text-sm text-slate-600">Answer a few questions to lock the scope.</p>
                </div>
              </div>

              {!aiQuestionsCompleted ? (
                <button
                  onClick={onStartAI}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition"
                >
                  Start
                </button>
              ) : (
                <span className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Scope locked
                </span>
              )}
            </div>

            {showAIQuestions && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">How urgent is this?</label>
                  <input
                    value={questions.urgency}
                    onChange={(e) => setQuestions((p) => ({ ...p, urgency: e.target.value }))}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
                    placeholder="Example: leak is getting worse, need today"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Access notes</label>
                  <input
                    value={questions.access}
                    onChange={(e) => setQuestions((p) => ({ ...p, access: e.target.value }))}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
                    placeholder="Example: parking available, building code needed"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Any previous fixes attempted?</label>
                  <input
                    value={questions.previousFixes}
                    onChange={(e) => setQuestions((p) => ({ ...p, previousFixes: e.target.value }))}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3"
                    placeholder="Example: tried tightening handle"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-100 transition"
                  >
                    <Camera className="w-4 h-4" />
                    Add photos
                  </button>

                  <button
                    type="button"
                    onClick={onFinishAI}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
                  >
                    Finish
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl p-6 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Fair Price Range</p>
                  <p className="text-sm text-slate-600">Based on similar jobs and urgency.</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold text-slate-900">
                  ${priceMin}-${priceMax}
                </p>
                <p className="text-xs text-slate-500">{isEmergency ? "Emergency pricing" : "Standard pricing"}</p>
              </div>
            </div>

            {submitError && (
              <div className="mt-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                {submitError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Shield className="w-4 h-4 text-emerald-600" />
                Workers will see your locked scope before accepting.
              </div>

              <button
                disabled={submitting}
                onClick={onPostJob}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Posting..." : "Post Job"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-500 flex items-center gap-2 justify-center">
          <Upload className="w-4 h-4" />
          V1: Backend wiring enabled - jobs are created via API.
        </div>
      </div>
    </div>
  );
}
