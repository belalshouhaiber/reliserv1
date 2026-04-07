import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Shield } from "lucide-react";

type Props = {
  children: React.ReactNode;
  isAuthenticated: boolean;
  user: { name: string; reliabilityScore: number; role: "customer" | "worker" };
  onRoleChange: (role: "customer" | "worker") => void;
};

export default function AppLayout({ children, isAuthenticated, user, onRoleChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  if (!isAuthenticated || location.pathname === "/") return <>{children}</>;

  const isWorkerMode = user.role === "worker";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => navigate(isWorkerMode ? "/worker/dashboard" : "/dashboard")}
            >
              <Shield className="w-6 h-6 text-emerald-500" />
              <span className="text-xl font-bold text-slate-900">ReliServe</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {isWorkerMode ? "Worker Mode" : "Customer Mode"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <button
                      onClick={() => {
                        onRoleChange("customer");
                        setShowRoleMenu(false);
                        navigate("/dashboard");
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        !isWorkerMode ? "text-emerald-600 font-medium" : "text-slate-700"
                      }`}
                    >
                      Customer Mode
                    </button>
                    <button
                      onClick={() => {
                        onRoleChange("worker");
                        setShowRoleMenu(false);
                        navigate("/worker/dashboard");
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        isWorkerMode ? "text-emerald-600 font-medium" : "text-slate-700"
                      }`}
                    >
                      Worker Mode
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">{user.reliabilityScore}%</span>
              </div>

              <button
                onClick={() => navigate("/profile")}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-semibold hover:scale-105 transition-transform"
              >
                {user.name.charAt(0)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}