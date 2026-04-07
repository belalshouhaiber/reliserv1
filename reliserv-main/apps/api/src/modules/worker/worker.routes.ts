import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";

export const workerRoutes = Router();

/**
 * GET /v1/worker/requests
 * Returns OPEN jobs (default EMERGENCY first).
 * V1 simple: return OPEN EMERGENCY jobs sorted by newest.
 */
workerRoutes.get("/requests", requireAuth, async (req, res) => {
  if (req.user?.role !== "WORKER") {
    return res.status(403).json({ error: "Only workers can view worker requests" });
  }

  const jobs = await prisma.job.findMany({
    where: {
      status: "OPEN",
      urgency: "EMERGENCY",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      jobType: true,
      urgency: true,
      status: true,
      priceMin: true,
      priceMax: true,
      locationText: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, reliabilityScore: true } },
    },
  });

  res.json({ jobs });
});
