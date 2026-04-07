import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { requireAuth } from "../../middlewares/auth";
import { AvailabilityService } from "../availability/availability.service";
import { PresenceRedis } from "../availability/presence.redis";
import { MapController } from "./map.controller";
import { MapService } from "./map.service";

export const mapRoutes = Router();

const presenceRedis = new PresenceRedis(redis);
const availabilityService = new AvailabilityService(prisma, presenceRedis);
const mapService = new MapService(prisma, availabilityService);
const controller = new MapController(mapService);

mapRoutes.get("/workers", requireAuth, controller.getWorkersNearPoint);
mapRoutes.get("/jobs/:id/map-candidates", requireAuth, controller.getMapCandidatesForJob);
