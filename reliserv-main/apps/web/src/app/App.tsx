import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { api } from "../api/client";
import { mockData } from "../mock/mockData";

import Home from "../pages/Home";
import Dashboard from "../pages/Dashboard";
import CreateJob from "../pages/CreateJob";
import Emergency from "../pages/Emergency";
import MapView from "../pages/MapView";
import Profile from "../pages/Profile";
import LiveJob from "../pages/LiveJob";
import Completion from "../pages/Completion";
import AuthLogin from "../pages/AuthLogin";
import WorkerMode from "../pages/WorkerMode";

import WorkerOnboarding from "../pages/worker/WorkerOnboarding";
import WorkerDashboard from "../pages/worker/WorkerDashboard";
import WorkerRequests from "../pages/worker/WorkerRequests";
import WorkerLiveJob from "../pages/worker/WorkerLiveJob";
import WorkerCompletion from "../pages/worker/WorkerCompletion";
import WorkerTrustInsights from "../pages/WorkerTrustInsights";

export default function App() {
  // 🔐 Auth state (persisted)
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );

  const [user, setUser] = useState(mockData.user);
  const [workerProfile, setWorkerProfile] = useState(mockData.workerProfile);

  const onRoleChange = (role: "customer" | "worker") =>
    setUser((p) => ({ ...p, role }));

  // Sync auth if token changes
  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!isAuthenticated) return;

      try {
        const res = await api<{
          user: {
            name: string;
            email: string;
            phone?: string;
            role: "CUSTOMER" | "WORKER";
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
          };
        }>("/v1/auth/me", { auth: true });

        if (!mounted) return;

        setUser((prev) => ({
          ...prev,
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone ?? prev.phone,
          role: res.user.role === "WORKER" ? "worker" : "customer",
          reliabilityScore: res.user.reliabilityScore,
        }));

        if (res.user.workerProfile) {
          setWorkerProfile((prev: typeof mockData.workerProfile) => ({
            ...prev,
            ...res.user.workerProfile,
          }));
        }
      } catch {
        if (!mounted) return;
        localStorage.removeItem("token");
        setIsAuthenticated(false);
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route
        path="/auth/login"
        element={<AuthLogin onLoginSuccess={() => setIsAuthenticated(true)} />}
      />

      {/* Everything else uses AppLayout */}
      <Route
        path="/*"
        element={
          <AppLayout
            isAuthenticated={isAuthenticated}
            user={user}
            onRoleChange={onRoleChange}
          >
            <Routes>
              {/* Customer */}
              <Route
                path="dashboard"
                element={isAuthenticated ? <Dashboard user={user} /> : <Navigate to="/" replace />}
              />
              <Route
                path="post-job"
                element={isAuthenticated ? <CreateJob /> : <Navigate to="/" replace />}
              />
              <Route
                path="emergency"
                element={isAuthenticated ? <Emergency /> : <Navigate to="/" replace />}
              />
              <Route
                path="map"
                element={isAuthenticated ? <MapView /> : <Navigate to="/" replace />}
              />
              <Route
                path="profile"
                element={isAuthenticated ? <Profile /> : <Navigate to="/" replace />}
              />
              <Route
                path="live-job"
                element={isAuthenticated ? <LiveJob /> : <Navigate to="/" replace />}
              />
              <Route
                path="completion"
                element={isAuthenticated ? <Completion /> : <Navigate to="/" replace />}
              />

              {/* Worker */}
              <Route
                path="worker/onboarding"
                element={
                  isAuthenticated ? (
                    <WorkerOnboarding
                      workerProfile={workerProfile}
                      setWorkerProfile={setWorkerProfile}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="worker/dashboard"
                element={
                  isAuthenticated ? (
                    <WorkerDashboard
                      user={user}
                      workerProfile={workerProfile}
                      setWorkerProfile={setWorkerProfile}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="worker/mode"
                element={
                  isAuthenticated ? <WorkerMode /> : <Navigate to="/auth/login" replace />
                }
              />
              <Route
                path="worker/requests"
                element={isAuthenticated ? <WorkerRequests /> : <Navigate to="/auth/login" replace />}
              />
              <Route
                path="worker/live-job/:jobId"
                element={isAuthenticated ? <WorkerLiveJob /> : <Navigate to="/" replace />}
              />
              <Route
                path="worker/completion"
                element={isAuthenticated ? <WorkerCompletion /> : <Navigate to="/" replace />}
              />
              <Route
                path="worker/trust/:workerId"
                element={
                  isAuthenticated ? <WorkerTrustInsights /> : <Navigate to="/auth/login" replace />
                }
              />

              {/* Catch-all inside layout */}
              <Route
                path="*"
                element={
                  isAuthenticated ? (
                    <Navigate
                      to={user.role === "worker" ? "/worker/dashboard" : "/dashboard"}
                      replace
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
}
