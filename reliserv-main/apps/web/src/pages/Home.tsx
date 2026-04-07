import { useNavigate } from "react-router-dom";
import { Shield, Zap } from "lucide-react";
import UsersIcon from "../components/icons/UsersIcon";

export default function Home() {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate("/auth/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-red-500/10"></div>

        <nav className="relative z-10 container mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            <span className="text-2xl font-bold text-white">ReliServe</span>
          </div>
          <button
            onClick={goToLogin}
            className="px-6 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
          >
            Sign In
          </button>
        </nav>

        <div className="relative z-10 container mx-auto px-6 py-24 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight animate-fadeInUp">
              Local services built on
              <span className="block mt-2 bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                reliability — not ratings
              </span>
            </h1>

            <p
              className="text-xl text-slate-300 max-w-2xl mx-auto animate-fadeInUp"
              style={{ animationDelay: "0.1s" }}
            >
              Connect with trusted local professionals. Emergency services guaranteed within minutes.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-fadeInUp"
              style={{ animationDelay: "0.2s" }}
            >
              <button
                onClick={goToLogin}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/30"
              >
                Post a Job
              </button>
              <button
                onClick={goToLogin}
                className="w-full sm:w-auto px-8 py-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Emergency Service
              </button>
            </div>

            <div className="pt-4">
              <button
                onClick={goToLogin}
                className="text-slate-300 hover:text-white underline decoration-emerald-400/50 hover:decoration-emerald-400 transition-all"
              >
                Are you a service provider? Join as a worker →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-slate-900/50 backdrop-blur-sm py-24">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Reliability Score",
                description: "Track real performance, not just star ratings. Every job updates your trust score.",
                colorClass: "emerald",
              },
              {
                icon: Zap,
                title: "Emergency Mode",
                description: "Urgent jobs get priority routing to available, high-reliability workers nearby.",
                colorClass: "red",
              },
              {
                icon: UsersIcon,
                title: "Mutual Accountability",
                description: "Both customers and workers have reliability scores. Fair for everyone.",
                colorClass: "blue",
              },
            ].map((feature, idx) => {
              const bgClass =
                feature.colorClass === "emerald"
                  ? "bg-emerald-500/10 group-hover:bg-emerald-500/20"
                  : feature.colorClass === "red"
                  ? "bg-red-500/10 group-hover:bg-red-500/20"
                  : "bg-blue-500/10 group-hover:bg-blue-500/20";

              const textClass =
                feature.colorClass === "emerald"
                  ? "text-emerald-400"
                  : feature.colorClass === "red"
                  ? "text-red-400"
                  : "text-blue-400";

              const borderClass =
                feature.colorClass === "emerald"
                  ? "hover:border-emerald-500/50"
                  : feature.colorClass === "red"
                  ? "hover:border-red-500/50"
                  : "hover:border-blue-500/50";

              const Icon: any = feature.icon;

              return (
                <div
                  key={idx}
                  className={`group p-8 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 ${borderClass} transition-all duration-300 hover:transform hover:scale-105 animate-fadeInUp`}
                  style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${bgClass} flex items-center justify-center mb-6 transition-all duration-300`}
                  >
                    <Icon className={`w-7 h-7 ${textClass}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.6s ease-out forwards; opacity: 0; }
      `}</style>
    </div>
  );
}