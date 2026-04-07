import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";
import {
  updateReliabilityForJobParticipants,
  updateUserReliability,
} from "../reliability/reliability.service";

export const jobsLifecycleRoutes = Router();

/**
 * Helper: load job with minimal fields for auth + state checks
 */
async function getJobOr404(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      createdById: true,
      assignedWorkerId: true,
    },
  });
  return job;
}

/**
 * GET /v1/jobs/:id/events
 * Access: creator or assigned worker
 */
jobsLifecycleRoutes.get("/:id/events", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user!.id;

  const job = await getJobOr404(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const canView = job.createdById === userId || job.assignedWorkerId === userId;
  if (!canView) return res.status(403).json({ error: "Forbidden" });

  const events = await prisma.jobEvent.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      type: true,
      note: true,
      actorId: true,
    },
  });

  res.json({ events });
});

/**
 * POST /v1/jobs/:id/start
 * Transition: LOCKED -> IN_PROGRESS
 * Access: assigned worker only
 */
jobsLifecycleRoutes.post("/:id/start", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user!.id;

  if (req.user?.role !== "WORKER") {
    return res.status(403).json({ error: "Only workers can start jobs" });
  }

  const job = await getJobOr404(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.assignedWorkerId !== userId) {
    return res.status(403).json({ error: "Only assigned worker can start this job" });
  }

  // Atomic state transition guard
  const updated = await prisma.job.updateMany({
    where: { id: jobId, status: "LOCKED" },
    data: { status: "IN_PROGRESS" },
  });

  if (updated.count === 0) {
    return res.status(409).json({ error: `Job cannot be started from status ${job.status}` });
  }

  await prisma.jobEvent.create({
    data: {
      jobId,
      actorId: userId,
      type: "STARTED",
      note: "Worker started job",
    },
  });

  const fresh = await prisma.job.findUnique({
    where: { id: jobId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  res.json({ job: fresh });
});

/**
 * POST /v1/jobs/:id/complete
 * Transition: IN_PROGRESS -> COMPLETED
 * Access: assigned worker only
 */
jobsLifecycleRoutes.post("/:id/complete", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user!.id;

  if (req.user?.role !== "WORKER") {
    return res.status(403).json({ error: "Only workers can complete jobs" });
  }

  const job = await getJobOr404(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.assignedWorkerId !== userId) {
    return res.status(403).json({ error: "Only assigned worker can complete this job" });
  }

  const updated = await prisma.job.updateMany({
    where: { id: jobId, status: "IN_PROGRESS" },
    data: { status: "COMPLETED" },
  });

  if (updated.count === 0) {
    return res.status(409).json({ error: `Job cannot be completed from status ${job.status}` });
  }

  await prisma.jobEvent.create({
    data: {
      jobId,
      actorId: userId,
      type: "COMPLETED",
      note: "Worker completed job",
    },
  });

  await updateReliabilityForJobParticipants(jobId, {
    reason: "JOB_COMPLETED",
    note: "Job marked completed",
  });

  const fresh = await prisma.job.findUnique({
    where: { id: jobId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  res.json({ job: fresh });
});

/**
 * POST /v1/jobs/:id/cancel
 * Rule:
 * - Only creator can cancel
 * - Only if OPEN (V1)
 * - If LOCKED/IN_PROGRESS/COMPLETED => 409 for now
 */
jobsLifecycleRoutes.post("/:id/cancel", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user!.id;

  const job = await getJobOr404(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.createdById !== userId) {
    return res.status(403).json({ error: "Only the customer who created the job can cancel" });
  }

  // V1 strict: only OPEN can be canceled
  if (job.status !== "OPEN") {
    return res.status(409).json({ error: `Cannot cancel a job in status ${job.status}` });
  }

  const updated = await prisma.job.updateMany({
    where: { id: jobId, status: "OPEN" },
    data: { status: "CANCELED" },
  });

  if (updated.count === 0) {
    return res.status(409).json({ error: "Cancel failed (job already changed)" });
  }

  await prisma.jobEvent.create({
    data: {
      jobId,
      actorId: userId,
      type: "CANCELED",
      note: "Customer canceled job",
    },
  });

  await updateUserReliability(userId, {
    reason: "JOB_CANCELED",
    jobId,
    note: "Customer canceled job",
  });

  const fresh = await prisma.job.findUnique({
    where: { id: jobId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  res.json({ job: fresh });
});
