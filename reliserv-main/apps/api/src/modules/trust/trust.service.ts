import type { PrismaClient } from "@prisma/client";

export class TrustService {
  constructor(private readonly prisma: PrismaClient) {}

  async getWorkerTrustInsights(workerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: workerId },
      include: {
        workerProfile: true,
      },
    });

    if (!user || user.role !== "WORKER") {
      const error = new Error("Worker not found");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const assignedJobs = await this.prisma.job.findMany({
      where: { assignedWorkerId: workerId },
      select: {
        id: true,
        status: true,
        urgency: true,
        createdAt: true,
      },
    });

    const receivedReviews = await this.prisma.review.findMany({
      where: { toUserId: workerId, target: "WORKER" },
      select: {
        id: true,
        rating: true,
        reliabilityImpact: true,
        notes: true,
        createdAt: true,
      },
    });

    const totalAssigned = assignedJobs.length;
    const completed = assignedJobs.filter((j) => j.status === "COMPLETED").length;
    const canceled = assignedJobs.filter((j) => j.status === "CANCELED").length;
    const emergencyCompleted = assignedJobs.filter(
      (j) => j.urgency === "EMERGENCY" && j.status === "COMPLETED"
    ).length;

    const completionRate = totalAssigned > 0 ? completed / totalAssigned : 0;
    const cancelRate = totalAssigned > 0 ? canceled / totalAssigned : 0;

    const positive = receivedReviews.filter((r) => r.rating >= 4).length;
    const neutral = receivedReviews.filter((r) => r.rating === 3).length;
    const negative = receivedReviews.filter((r) => r.rating <= 2).length;

    const averageRating =
      receivedReviews.length > 0
        ? receivedReviews.reduce((sum, r) => sum + r.rating, 0) / receivedReviews.length
        : null;

    return {
      worker: {
        id: user.id,
        name: user.name,
        reliabilityScore: user.reliabilityScore,
      },
      metrics: {
        totalAssignedJobs: totalAssigned,
        completedJobs: completed,
        canceledJobs: canceled,
        emergencyCompletedJobs: emergencyCompleted,
        completionRate,
        cancelRate,
        averageRating,
      },
      reviewBreakdown: {
        positive,
        neutral,
        negative,
        total: receivedReviews.length,
      },
    };
  }

  async getReliabilityHistory(workerId: string) {
    const history = await (this.prisma as any).reliabilityHistory.findMany({
      where: { userId: workerId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        createdAt: true,
        oldScore: true,
        newScore: true,
        delta: true,
        reason: true,
        jobId: true,
        note: true,
      },
    });

    return { history };
  }
}
