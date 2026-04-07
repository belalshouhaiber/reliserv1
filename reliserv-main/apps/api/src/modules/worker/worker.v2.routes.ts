import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { requireAuth } from "../../middlewares/auth";
import { AvailabilityService } from "../availability/availability.service";
import { PresenceRedis } from "../availability/presence.redis";
import { WorkerV2Controller } from "./worker.v2.controller";
import { WorkerV2Service } from "./worker.v2.service";

const router = Router();

const presenceRedis = new PresenceRedis(redis);
const availabilityService = new AvailabilityService(prisma as any, presenceRedis);
const workerV2Service = new WorkerV2Service(availabilityService);
const controller = new WorkerV2Controller(workerV2Service);

router.patch("/status", requireAuth, controller.updateStatus);
router.patch("/emergency-opt-in", requireAuth, controller.updateEmergencyOptIn);
router.post("/heartbeat", requireAuth, controller.heartbeat);
router.get("/eligibility", requireAuth, controller.getEligibility);

export const workerV2Routes = router;
