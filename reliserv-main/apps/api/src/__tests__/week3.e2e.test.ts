import request from "supertest";
import app from "../app";
import { prisma, disconnectPrisma } from "../db/prisma";
import { updateUserReliability } from "../modules/reliability/reliability.service";
import { signupAndLogin } from "./helpers";

jest.setTimeout(30000);

function uniqueEmail(label: string) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.com`;
}

async function getMe(token: string) {
  const res = await request(app)
    .get("/v1/auth/me")
    .set("Authorization", `Bearer ${token}`);

  expect(res.status).toBe(200);
  return res.body.user as {
    id: string;
    role: "CUSTOMER" | "WORKER";
    reliabilityScore: number;
  };
}

describe("ReliServe Week 3 - reliability verification, hardening, and trust loop", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  test("completion updates reliability, /v1/auth/me matches DB, and event trail is correct", async () => {
    const customer = await signupAndLogin(uniqueEmail("week3.complete.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("week3.complete.worker"), "WORKER");

    const createRes = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        description: "Burst pipe in kitchen",
        jobType: "plumbing",
        locationText: "Unit 4B",
        priceMin: 220,
        priceMax: 380,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    const acceptRes = await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.job.status).toBe("LOCKED");

    const startRes = await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.job.status).toBe("IN_PROGRESS");

    const completeRes = await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.job.status).toBe("COMPLETED");

    const customerMe = await getMe(customer.token);
    const workerMe = await getMe(worker.token);

    expect(customerMe.reliabilityScore).toBe(93);
    expect(workerMe.reliabilityScore).toBe(93);

    const dbUsers = await prisma.user.findMany({
      where: { id: { in: [customer.user.id, worker.user.id] } },
      select: { id: true, reliabilityScore: true },
    });

    const scoreMap = new Map(dbUsers.map((user) => [user.id, user.reliabilityScore]));
    expect(scoreMap.get(customer.user.id)).toBe(customerMe.reliabilityScore);
    expect(scoreMap.get(worker.user.id)).toBe(workerMe.reliabilityScore);

    const eventsRes = await request(app)
      .get(`/v1/jobs/${jobId}/events`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events.map((event: { type: string }) => event.type)).toEqual([
      "CREATED",
      "ACCEPTED",
      "STARTED",
      "COMPLETED",
    ]);
  });

  test("cancel drops customer reliability by 5 and persists to DB", async () => {
    const customer = await signupAndLogin(uniqueEmail("week3.cancel.customer"), "CUSTOMER");

    const createRes = await request(app)
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        title: "Cancel me",
        description: "Open job that will be canceled",
        jobType: "cleaning",
        urgency: "NORMAL",
        priceMin: 90,
        priceMax: 120,
        locationText: "Office suite",
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    const cancelRes = await request(app)
      .post(`/v1/jobs/${jobId}/cancel`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.job.status).toBe("CANCELED");

    const me = await getMe(customer.token);
    expect(me.reliabilityScore).toBe(85);

    const dbUser = await prisma.user.findUnique({
      where: { id: customer.user.id },
      select: { reliabilityScore: true },
    });

    expect(dbUser?.reliabilityScore).toBe(85);

    const eventsRes = await request(app)
      .get(`/v1/jobs/${jobId}/events`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events.map((event: { type: string }) => event.type)).toEqual([
      "CREATED",
      "CANCELED",
    ]);
  });

  test("review rules enforce completed-only, duplicate prevention, wrong-user rejection, and reliability updates", async () => {
    const customer = await signupAndLogin(uniqueEmail("week3.review.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("week3.review.worker"), "WORKER");
    const outsider = await signupAndLogin(uniqueEmail("week3.review.outsider"), "WORKER");

    const createRes = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        description: "No AC, urgent",
        jobType: "electrical",
        locationText: "Lobby",
        priceMin: 200,
        priceMax: 320,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    const beforeCompletionReview = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        jobId,
        toUserId: worker.user.id,
        target: "WORKER",
        rating: 5,
      });

    expect(beforeCompletionReview.status).toBe(409);

    await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    const validCustomerReview = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        jobId,
        toUserId: worker.user.id,
        target: "WORKER",
        rating: 5,
        notes: "Resolved quickly",
      });

    expect(validCustomerReview.status).toBe(201);
    expect(validCustomerReview.body.review.reliabilityImpact).toBe(2);

    const duplicateReview = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        jobId,
        toUserId: worker.user.id,
        target: "WORKER",
        rating: 5,
      });

    expect(duplicateReview.status).toBe(409);

    const wrongUserReview = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({
        jobId,
        toUserId: worker.user.id,
        target: "WORKER",
        rating: 1,
      });

    expect(wrongUserReview.status).toBe(403);

    const validWorkerReview = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({
        jobId,
        toUserId: customer.user.id,
        target: "CUSTOMER",
        rating: 4,
        notes: "Clear instructions",
      });

    expect(validWorkerReview.status).toBe(201);
    expect(validWorkerReview.body.review.reliabilityImpact).toBe(2);

    const customerMe = await getMe(customer.token);
    const workerMe = await getMe(worker.token);

    expect(customerMe.reliabilityScore).toBe(95);
    expect(workerMe.reliabilityScore).toBe(95);

    const reviewsRes = await request(app)
      .get(`/v1/reviews/job/${jobId}`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(reviewsRes.status).toBe(200);
    expect(reviewsRes.body.reviews).toHaveLength(2);
  });

  test("invalid lifecycle transitions and role misuse return clean 4xx responses", async () => {
    const customer = await signupAndLogin(uniqueEmail("week3.lifecycle.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("week3.lifecycle.worker"), "WORKER");

    const createRes = await request(app)
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        title: "Lifecycle checks",
        description: "Need a valid sequence",
        jobType: "handyman",
        urgency: "NORMAL",
        priceMin: 100,
        priceMax: 140,
        locationText: "Warehouse",
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    const customerAcceptRes = await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(customerAcceptRes.status).toBe(403);

    const openCompleteRes = await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(openCompleteRes.status).toBe(403);

    await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    const lockedCompleteRes = await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(lockedCompleteRes.status).toBe(409);

    const cancelAfterLockedRes = await request(app)
      .post(`/v1/jobs/${jobId}/cancel`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(cancelAfterLockedRes.status).toBe(409);

    await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    const completedStartRes = await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${worker.token}`);

    expect(completedStartRes.status).toBe(409);
  });

  test("reliability score clamps to the 0-100 range", async () => {
    const positive = await signupAndLogin(uniqueEmail("week3.clamp.high"), "CUSTOMER");
    const negative = await signupAndLogin(uniqueEmail("week3.clamp.low"), "CUSTOMER");

    await prisma.job.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        title: `High clamp ${index}`,
        description: "Completed emergency for clamp test",
        jobType: "plumbing",
        urgency: "EMERGENCY",
        status: "COMPLETED",
        createdById: positive.user.id,
      })),
    });

    await prisma.job.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        title: `Low clamp ${index}`,
        description: "Canceled job for clamp test",
        jobType: "cleaning",
        urgency: "NORMAL",
        status: "CANCELED",
        createdById: negative.user.id,
      })),
    });

    await updateUserReliability(positive.user.id);
    await updateUserReliability(negative.user.id);

    const highMe = await getMe(positive.token);
    const lowMe = await getMe(negative.token);

    expect(highMe.reliabilityScore).toBe(100);
    expect(lowMe.reliabilityScore).toBe(0);
  });
});
