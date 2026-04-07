import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { requireAuth } from "../../middlewares/auth";
import { AvailabilityService } from "../availability/availability.service";
import { PresenceRedis } from "../availability/presence.redis";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";

export const matchingRoutes = Router();

const presenceRedis = new PresenceRedis(redis);
const availabilityService = new AvailabilityService(prisma, presenceRedis);
const matchingService = new MatchingService(prisma, availabilityService);
const controller = new MatchingController(matchingService);

matchingRoutes.get(
  "/jobs/:id/ranked-workers",
  requireAuth,
  controller.getRankedWorkersForJob,
);
matchingRoutes.get(
  "/emergency/:id/ranked-workers",
  requireAuth,
  controller.getRankedWorkersForEmergency,
);
