import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";
import { updateUserReliability } from "../reliability/reliability.service";
import { createReviewSchema } from "./reviews.schemas";

export const reviewsRoutes = Router();

function deriveReliabilityImpact(rating: number): number {
  if (rating >= 4) return 2;
  if (rating <= 2) return -3;
  return 0;
}

reviewsRoutes.post("/", requireAuth, async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fromUserId = req.user!.id;
  const { jobId, toUserId, target, rating, notes } = parsed.data;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      createdById: true,
      assignedWorkerId: true,
    },
  });

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.status !== "COMPLETED") {
    return res.status(409).json({ error: "Reviews are only allowed after job completion" });
  }

  const isCustomer = job.createdById === fromUserId;
  const isWorker = job.assignedWorkerId === fromUserId;

  if (!isCustomer && !isWorker) {
    return res.status(403).json({ error: "Only job participants can submit reviews" });
  }

  if (isCustomer) {
    if (!job.assignedWorkerId) {
      return res.status(409).json({ error: "Job has no assigned worker to review" });
    }

    if (target !== "WORKER" || toUserId !== job.assignedWorkerId) {
      return res.status(400).json({ error: "Customer can only review the assigned worker" });
    }
  }

  if (isWorker) {
    if (target !== "CUSTOMER" || toUserId !== job.createdById) {
      return res.status(400).json({ error: "Worker can only review the customer who created the job" });
    }
  }

  if (fromUserId === toUserId) {
    return res.status(400).json({ error: "You cannot review yourself" });
  }

  const existing = await prisma.review.findUnique({
    where: {
      jobId_fromUserId: {
        jobId,
        fromUserId,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ error: "You have already submitted a review for this job" });
  }

  const reliabilityImpact = deriveReliabilityImpact(rating);

  const review = await prisma.review.create({
    data: {
      jobId,
      fromUserId,
      toUserId,
      target,
      rating,
      reliabilityImpact,
      notes,
    },
  });

  await updateUserReliability(toUserId, {
    reason: "REVIEW_IMPACT",
    jobId,
    note: `Review rating ${rating} submitted`,
  });

  return res.status(201).json({ review });
});

reviewsRoutes.get("/job/:id", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user!.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      createdById: true,
      assignedWorkerId: true,
    },
  });

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const canView = job.createdById === userId || job.assignedWorkerId === userId;
  if (!canView) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const reviews = await prisma.review.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      fromUserId: true,
      toUserId: true,
      target: true,
      rating: true,
      reliabilityImpact: true,
      notes: true,
    },
  });

  return res.json({ reviews });
});
