import request from "supertest";
import app from "../app";
import { disconnectPrisma } from "../db/prisma";
import { signupAndLogin } from "./helpers";

describe("ReliServe V1 (up to DEV2) - Auth + Emergency + Accept + Lifecycle + Events", () => {
  let customerToken: string;
  let workerAToken: string;
  let workerBToken: string;

  let jobId: string;

  beforeAll(async () => {
    const customer = await signupAndLogin("customer1@test.com", "CUSTOMER");
    const workerA = await signupAndLogin("workerA@test.com", "WORKER");
    const workerB = await signupAndLogin("workerB@test.com", "WORKER");

    customerToken = customer.token;
    workerAToken = workerA.token;
    workerBToken = workerB.token;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  test("Health works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  test("Protected route /v1/auth/me requires token", async () => {
    const res = await request(app).get("/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("Customer creates EMERGENCY job (OPEN)", async () => {
    const res = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        description: "Water heater stopped working, need help ASAP",
        jobType: "plumbing",
        locationText: "Near campus",
        priceMin: 200,
        priceMax: 400,
      });

    expect(res.status).toBe(201);
    expect(res.body.job).toBeTruthy();
    expect(res.body.job.urgency).toBe("EMERGENCY");
    expect(res.body.job.status).toBe("OPEN");

    jobId = res.body.job.id;
    expect(jobId).toBeTruthy();
  });

  test("Workers can list emergency requests", async () => {
    const res = await request(app)
      .get("/v1/worker/requests")
      .set("Authorization", `Bearer ${workerAToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);

    const found = res.body.jobs.find((j: any) => j.id === jobId);
    expect(found).toBeTruthy();
  });

  test("Atomic accept: Worker A accepts, Worker B gets 409", async () => {
    const acceptA = await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${workerAToken}`);

    expect(acceptA.status).toBe(200);
    expect(acceptA.body.job.status).toBe("LOCKED");
    expect(acceptA.body.job.assignedWorkerId).toBeTruthy();

    const acceptB = await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${workerBToken}`);

    expect(acceptB.status).toBe(409);
    expect(acceptB.body.error).toMatch(/already taken/i);
  });

  test("Only assigned worker can start: Worker B start => 403", async () => {
    const res = await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${workerBToken}`);

    expect(res.status).toBe(403);
  });

  test("Assigned worker can start: LOCKED -> IN_PROGRESS", async () => {
    const res = await request(app)
      .post(`/v1/jobs/${jobId}/start`)
      .set("Authorization", `Bearer ${workerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe("IN_PROGRESS");
  });

  test("Assigned worker can complete: IN_PROGRESS -> COMPLETED", async () => {
    const res = await request(app)
      .post(`/v1/jobs/${jobId}/complete`)
      .set("Authorization", `Bearer ${workerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe("COMPLETED");
  });

  test("Cancel rules: customer cannot cancel COMPLETED (409)", async () => {
    const res = await request(app)
      .post(`/v1/jobs/${jobId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(409);
  });

  test("Events show CREATED, ACCEPTED, STARTED, COMPLETED", async () => {
    const res = await request(app)
      .get(`/v1/jobs/${jobId}/events`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);

    const types = res.body.events.map((e: any) => e.type);
    expect(types).toEqual(expect.arrayContaining(["CREATED", "ACCEPTED", "STARTED", "COMPLETED"]));
  });
});
