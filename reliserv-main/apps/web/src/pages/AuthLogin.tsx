import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

type LoginResponse = {
  token: string;
  user: {
    role: "CUSTOMER" | "WORKER";
  };
};

export default function AuthLogin({
  onLoginSuccess,
}: {
  onLoginSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api<LoginResponse>("/v1/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", res.token);
      onLoginSuccess();
      navigate(res.user.role === "WORKER" ? "/worker/dashboard" : "/dashboard");

    } catch (err: any) {
      localStorage.removeItem("token"); // prevents old token from keeping you "logged in"
      setError(err.message || "Login failed");
    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white">Sign In</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-slate-300 text-sm">Email</label>
            <input
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm">Password</label>
            <input
              type="password"
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl"
          >
            Back
          </button>
        </form>
      </div>
    </div>
  );
}
