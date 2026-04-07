import { prisma } from "../../db/prisma";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

export async function calculateReliabilityScore(userId: string): Promise<number> {
  let score = 90;

  const createdJobs = await prisma.job.findMany({
    where: { createdById: userId },
    select: {
      id: true,
      urgency: true,
      status: true,
    },
  });

  const assignedJobs = await prisma.job.findMany({
    where: { assignedWorkerId: userId },
    select: {
      id: true,
      urgency: true,
      status: true,
    },
  });

  const reviewsReceived = await prisma.review.findMany({
    where: { toUserId: userId },
    select: {
      rating: true,
      reliabilityImpact: true,
    },
  });

  for (const job of createdJobs) {
    if (job.status === "COMPLETED") score += 2;
    if (job.status === "CANCELED") score -= 5;
    if (job.urgency === "EMERGENCY" && job.status === "COMPLETED") score += 1;
  }

  for (const job of assignedJobs) {
    if (job.status === "COMPLETED") score += 2;
    if (job.status === "CANCELED") score -= 8;
    if (job.urgency === "EMERGENCY" && job.status === "COMPLETED") score += 1;
  }

  for (const review of reviewsReceived) {
    score += review.reliabilityImpact;
  }

  return clampScore(score);
}

async function recordReliabilityHistory(params: {
  userId: string;
  oldScore: number;
  newScore: number;
  reason:
    | "JOB_COMPLETED"
    | "JOB_CANCELED"
    | "REVIEW_IMPACT"
    | "EMERGENCY_BONUS"
    | "MANUAL_RECALC";
  jobId?: string;
  note?: string;
}) {
  if (params.oldScore === params.newScore) return;

  await (prisma as any).reliabilityHistory.create({
    data: {
      userId: params.userId,
      oldScore: params.oldScore,
      newScore: params.newScore,
      delta: params.newScore - params.oldScore,
      reason: params.reason,
      jobId: params.jobId,
      note: params.note,
    },
  });
}

export async function updateUserReliability(
  userId: string,
  options?: {
    reason?:
      | "JOB_COMPLETED"
      | "JOB_CANCELED"
      | "REVIEW_IMPACT"
      | "EMERGENCY_BONUS"
      | "MANUAL_RECALC";
    jobId?: string;
    note?: string;
  }
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reliabilityScore: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const oldScore = user.reliabilityScore;
  const newScore = await calculateReliabilityScore(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { reliabilityScore: newScore },
  });

  await recordReliabilityHistory({
    userId,
    oldScore,
    newScore,
    reason: options?.reason ?? "MANUAL_RECALC",
    jobId: options?.jobId,
    note: options?.note,
  });

  return newScore;
}

export async function updateReliabilityForJobParticipants(
  jobId: string,
  options?: {
    reason?:
      | "JOB_COMPLETED"
      | "JOB_CANCELED"
      | "REVIEW_IMPACT"
      | "EMERGENCY_BONUS"
      | "MANUAL_RECALC";
    note?: string;
  }
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      createdById: true,
      assignedWorkerId: true,
    },
  });

  if (!job) return;

  await updateUserReliability(job.createdById, {
    reason: options?.reason ?? "MANUAL_RECALC",
    jobId,
    note: options?.note,
  });

  if (job.assignedWorkerId) {
    await updateUserReliability(job.assignedWorkerId, {
      reason: options?.reason ?? "MANUAL_RECALC",
      jobId,
      note: options?.note,
    });
  }
}
