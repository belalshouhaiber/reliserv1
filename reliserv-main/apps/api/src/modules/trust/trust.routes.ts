import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middlewares/auth";
import { TrustController } from "./trust.controller";
import { TrustService } from "./trust.service";

export const trustRoutes = Router();

const service = new TrustService(prisma);
const controller = new TrustController(service);

trustRoutes.get("/workers/:id/trust-insights", requireAuth, controller.getWorkerTrustInsights);
trustRoutes.get("/workers/:id/reliability-history", requireAuth, controller.getReliabilityHistory);
