import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorMiddleware } from "./middlewares/error";

import { authRoutes } from "./modules/auth/auth.routes";
import { jobsRoutes } from "./modules/jobs/jobs.routes";
import { emergencyRoutes } from "./modules/emergency/emergency.routes";
import { workerRoutes } from "./modules/worker/worker.routes";
import { workerV2Routes } from "./modules/worker/worker.v2.routes";
import { jobsAcceptRoutes } from "./modules/jobs/jobs.accept.routes";
import { jobsLifecycleRoutes } from "./modules/jobs/jobs.lifecycle.routes";
import { reviewsRoutes } from "./modules/reviews/reviews.routes";
import { matchingRoutes } from "./modules/matching/matching.routes";
import { trustRoutes } from "./modules/trust/trust.routes";
import { mapRoutes } from "./modules/map/map.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_, res) => res.json({ ok: true }));

  app.use("/v1/auth", authRoutes);
  app.use("/v1/jobs", jobsRoutes);
  app.use("/v1/jobs", jobsAcceptRoutes);
  app.use("/v1/jobs", jobsLifecycleRoutes);
  app.use("/v1/reviews", reviewsRoutes);
  app.use("/v1/emergency", emergencyRoutes);
  app.use("/v1/worker", workerRoutes);
  app.use("/v2/worker", workerV2Routes);
  app.use("/v2", matchingRoutes);
  app.use("/v2", trustRoutes);
  app.use("/v2/map", mapRoutes);

  app.use(errorMiddleware);

  return app;
}

const app = createApp();

export default app;
