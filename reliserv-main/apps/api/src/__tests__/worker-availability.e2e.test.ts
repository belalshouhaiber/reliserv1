import request from "supertest";
import app from "../app";
import { disconnectPrisma } from "../db/prisma";
import { signupAndLogin } from "./helpers";

jest.setTimeout(30000);

function uniqueEmail(label: string) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.com`;
}

describe("Worker availability", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  it("ONLINE worker with heartbeat is standard eligible", async () => {
    const worker = await signupAndLogin(uniqueEmail("availability.online"), "WORKER");

    await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "ONLINE" })
      .expect(200);

    await request(app)
      .post("/v2/worker/heartbeat")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ lat: 27.8006, lng: -97.3964 })
      .expect(200);

    const eligibilityRes = await request(app)
      .get("/v2/worker/eligibility")
      .set("Authorization", `Bearer ${worker.token}`);

    expect(eligibilityRes.status).toBe(200);
    expect(eligibilityRes.body.serviceStatus).toBe("ONLINE");
    expect(eligibilityRes.body.hasLiveHeartbeat).toBe(true);
    expect(eligibilityRes.body.standardEligible).toBe(true);
    expect(eligibilityRes.body.emergencyEligible).toBe(false);
  });

  it("OFFLINE worker is not eligible", async () => {
    const worker = await signupAndLogin(uniqueEmail("availability.offline"), "WORKER");

    const statusRes = await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "OFFLINE" });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.serviceStatus).toBe("OFFLINE");

    const eligibilityRes = await request(app)
      .get("/v2/worker/eligibility")
      .set("Authorization", `Bearer ${worker.token}`);

    expect(eligibilityRes.status).toBe(200);
    expect(eligibilityRes.body.serviceStatus).toBe("OFFLINE");
    expect(eligibilityRes.body.hasLiveHeartbeat).toBe(false);
    expect(eligibilityRes.body.standardEligible).toBe(false);
    expect(eligibilityRes.body.emergencyEligible).toBe(false);
  });

  it("worker without heartbeat is not eligible", async () => {
    const worker = await signupAndLogin(uniqueEmail("availability.noheartbeat"), "WORKER");

    await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "ONLINE" })
      .expect(200);

    const eligibilityRes = await request(app)
      .get("/v2/worker/eligibility")
      .set("Authorization", `Bearer ${worker.token}`);

    expect(eligibilityRes.status).toBe(200);
    expect(eligibilityRes.body.serviceStatus).toBe("ONLINE");
    expect(eligibilityRes.body.hasLiveHeartbeat).toBe(false);
    expect(eligibilityRes.body.standardEligible).toBe(false);
  });

  it("emergency opt-out excludes emergency eligibility", async () => {
    const worker = await signupAndLogin(uniqueEmail("availability.optout"), "WORKER");

    await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "ONLINE" })
      .expect(200);

    await request(app)
      .post("/v2/worker/heartbeat")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ lat: 27.8006, lng: -97.3964 })
      .expect(200);

    await request(app)
      .patch("/v2/worker/emergency-opt-in")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ emergencyOptIn: false })
      .expect(200);

    const eligibilityRes = await request(app)
      .get("/v2/worker/eligibility")
      .set("Authorization", `Bearer ${worker.token}`);

    expect(eligibilityRes.status).toBe(200);
    expect(eligibilityRes.body.standardEligible).toBe(true);
    expect(eligibilityRes.body.emergencyEligible).toBe(false);
  });

  it("active assigned job forces BUSY status and offline clears presence", async () => {
    const customer = await signupAndLogin(uniqueEmail("availability.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("availability.busy"), "WORKER");

    await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "ONLINE" })
      .expect(200);

    await request(app)
      .post("/v2/worker/heartbeat")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ lat: 27.8006, lng: -97.3964 })
      .expect(200);

    const createRes = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        description: "Burst pipe in garage",
        jobType: "plumbing",
        locationText: "Garage",
        priceMin: 150,
        priceMax: 240,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    await request(app)
      .post(`/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${worker.token}`)
      .expect(200);

    const busyRes = await request(app)
      .get("/v2/worker/eligibility")
      .set("Authorization", `Bearer ${worker.token}`);

    expect(busyRes.status).toBe(200);
    expect(busyRes.body.serviceStatus).toBe("BUSY");
    expect(busyRes.body.hasActiveAssignedJob).toBe(true);
    expect(busyRes.body.standardEligible).toBe(false);
    expect(busyRes.body.emergencyEligible).toBe(false);

    const forcedBusyRes = await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "OFFLINE" });

    expect(forcedBusyRes.status).toBe(200);
    expect(forcedBusyRes.body.serviceStatus).toBe("BUSY");
  });
});
