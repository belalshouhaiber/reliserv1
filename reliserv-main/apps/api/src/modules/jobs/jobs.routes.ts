import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";
import { createJobSchema } from "./jobs.schemas";

export const jobsRoutes = Router();

/**
 * POST /v1/jobs (protected)
 */
jobsRoutes.post("/", requireAuth, async (req, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const data = parsed.data;

  const job = await prisma.job.create({
    data: {
      title: data.title,
      description: data.description,
      jobType: data.jobType,
      urgency: data.urgency ?? "NORMAL",
      status: "OPEN",
      lat: data.lat,
      lng: data.lng,
      locationText: data.locationText,
      priceMin: data.priceMin,
      priceMax: data.priceMax,
      lockedScope: data.lockedScope,
      createdById: userId,
      events: {
        create: {
          type: "CREATED",
          actorId: userId,
          note: "Job created",
        },
      },
    },
    include: { events: true },
  });

  return res.status(201).json({ job });
});

/**
 * GET /v1/jobs?mine=true (protected)
 * - mine=true => jobs created by me
 * - mine=false/absent => returns recent jobs
 */
jobsRoutes.get("/", requireAuth, async (req, res) => {
  const mine = String(req.query.mine || "").toLowerCase() === "true";
  const userId = req.user!.id;

  const jobs = await prisma.job.findMany({
    where: mine ? { createdById: userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      jobType: true,
      urgency: true,
      status: true,
      priceMin: true,
      priceMax: true,
      priceFinal: true,
      locationText: true,
      createdAt: true,
      createdById: true,
      assignedWorkerId: true,
    },
  });

  return res.json({ jobs });
});

/**
 * GET /v1/jobs/:id (protected)
 * Access rule (V1):
 * - creator can view
 * - assigned worker can view
 * - otherwise 403
 */
jobsRoutes.get("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const jobId = req.params.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true, reliabilityScore: true } },
      assignedWorker: { select: { id: true, name: true, reliabilityScore: true } },
    },
  });

  if (!job) return res.status(404).json({ error: "Job not found" });

  const canView = job.createdById === userId || job.assignedWorkerId === userId;
  if (!canView) return res.status(403).json({ error: "Forbidden" });

  return res.json({ job });
});
