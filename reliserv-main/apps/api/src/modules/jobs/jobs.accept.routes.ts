import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";

export const jobsAcceptRoutes = Router();

/**
 * POST /v1/jobs/:id/accept
 * Atomic lock-on-accept:
 * - only if status == OPEN
 * - sets assignedWorkerId + status LOCKED
 * - creates ACCEPTED event
 * If already locked: 409
 */
jobsAcceptRoutes.post("/:id/accept", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const workerId = req.user!.id;

  if (req.user?.role !== "WORKER") {
    return res.status(403).json({ error: "Only workers can accept jobs" });
  }

  const job = await prisma.$transaction(async (tx) => {
    // Atomic guard: update only if OPEN
    const result = await tx.job.updateMany({
      where: { id: jobId, status: "OPEN" },
      data: {
        status: "LOCKED",
        assignedWorkerId: workerId,
      },
    });

    if (result.count === 0) {
      return null;
    }

    await tx.jobEvent.create({
      data: {
        jobId,
        actorId: workerId,
        type: "ACCEPTED",
        note: "Worker accepted and locked the job",
      },
    });

    return tx.job.findUnique({
      where: { id: jobId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { id: true, name: true, reliabilityScore: true } },
        assignedWorker: { select: { id: true, name: true, reliabilityScore: true } },
      },
    });
  });

  if (!job) {
    return res.status(409).json({ error: "Job already taken" });
  }

  return res.json({ job });
});
