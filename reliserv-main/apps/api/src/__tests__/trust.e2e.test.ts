import request from "supertest";
import app from "../app";
import { prisma, disconnectPrisma } from "../db/prisma";
import { signupAndLogin } from "./helpers";

jest.setTimeout(30000);

function uniqueEmail(label: string) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.com`;
}

describe("trust insights", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  test("returns worker trust insights and reliability history rows", async () => {
    const customer = await signupAndLogin(uniqueEmail("trust.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("trust.worker"), "WORKER");

    const createRes = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        description: "Basement flooding",
        jobType: "plumbing",
        locationText: "Building A",
        priceMin: 250,
        priceMax: 400,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        jobId,
        toUserId: worker.user.id,
        target: "WORKER",
        rating: 5,
        notes: "Arrived fast and fixed it",
      })
      .expect(201);

    const insightsRes = await request(app)
      .get(`/v2/workers/${worker.user.id}/trust-insights`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(insightsRes.status).toBe(200);
    expect(insightsRes.body.worker.id).toBe(worker.user.id);
    expect(insightsRes.body.worker.reliabilityScore).toBe(95);
    expect(insightsRes.body.metrics.totalAssignedJobs).toBe(1);
    expect(insightsRes.body.metrics.completedJobs).toBe(1);
    expect(insightsRes.body.metrics.canceledJobs).toBe(0);
    expect(insightsRes.body.metrics.emergencyCompletedJobs).toBe(1);
    expect(insightsRes.body.metrics.completionRate).toBe(1);
    expect(insightsRes.body.metrics.cancelRate).toBe(0);
    expect(insightsRes.body.reviewBreakdown).toEqual({
      positive: 1,
      neutral: 0,
      negative: 0,
      total: 1,
    });

    const historyRes = await request(app)
      .get(`/v2/workers/${worker.user.id}/reliability-history`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history).toHaveLength(2);
    expect(historyRes.body.history[0]).toMatchObject({
      reason: "REVIEW_IMPACT",
      oldScore: 93,
      newScore: 95,
      delta: 2,
      jobId,
    });
    expect(historyRes.body.history[1]).toMatchObject({
      reason: "JOB_COMPLETED",
      oldScore: 90,
      newScore: 93,
      delta: 3,
      jobId,
    });

    const dbHistory = await prisma.reliabilityHistory.findMany({
      where: { userId: worker.user.id },
      orderBy: { createdAt: "desc" },
    });

    expect(dbHistory).toHaveLength(2);
  });

  test("returns 404 when trust insights are requested for a non-worker", async () => {
    const customer = await signupAndLogin(uniqueEmail("trust.nonworker.customer"), "CUSTOMER");

    const res = await request(app)
      .get(`/v2/workers/${customer.user.id}/trust-insights`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Worker not found");
  });
});
