import request from "supertest";
import { JobStatus, JobUrgency } from "@prisma/client";
import app from "../app";
import { disconnectPrisma, prisma } from "../db/prisma";
import { signupAndLogin } from "./helpers";

jest.setTimeout(30000);

function uniqueEmail(label: string) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.com`;
}

async function makeWorkerAvailable(input: {
  token: string;
  lat: number;
  lng: number;
  emergencyOptIn?: boolean;
}) {
  await request(app)
    .patch("/v2/worker/status")
    .set("Authorization", `Bearer ${input.token}`)
    .send({ serviceStatus: "ONLINE" })
    .expect(200);

  await request(app)
    .post("/v2/worker/heartbeat")
    .set("Authorization", `Bearer ${input.token}`)
    .send({ lat: input.lat, lng: input.lng })
    .expect(200);

  if (input.emergencyOptIn != null) {
    await request(app)
      .patch("/v2/worker/emergency-opt-in")
      .set("Authorization", `Bearer ${input.token}`)
      .send({ emergencyOptIn: input.emergencyOptIn })
      .expect(200);
  }
}

async function seedWorkerHistory(input: {
  workerId: string;
  createdById: string;
  completed: number;
  canceled: number;
  emergencyCompleted?: number;
}) {
  const data = [
    ...Array.from({ length: input.completed }, (_, index) => ({
      title: `Completed history ${input.workerId} ${index}`,
      description: "Historical completed job for matching tests",
      jobType: "plumbing",
      urgency:
        index < (input.emergencyCompleted ?? 0)
          ? JobUrgency.EMERGENCY
          : JobUrgency.NORMAL,
      status: JobStatus.COMPLETED,
      createdById: input.createdById,
      assignedWorkerId: input.workerId,
    })),
    ...Array.from({ length: input.canceled }, (_, index) => ({
      title: `Canceled history ${input.workerId} ${index}`,
      description: "Historical canceled job for matching tests",
      jobType: "plumbing",
      urgency: JobUrgency.NORMAL,
      status: JobStatus.CANCELED,
      createdById: input.createdById,
      assignedWorkerId: input.workerId,
    })),
  ];

  if (data.length > 0) {
    await prisma.job.createMany({ data });
  }
}

describe("Matching rankings", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  test("normal ranking returns only standard-eligible workers and sorts by score", async () => {
    const customer = await signupAndLogin(uniqueEmail("matching.normal.customer"), "CUSTOMER");
    const nearWorker = await signupAndLogin(uniqueEmail("matching.normal.near"), "WORKER");
    const farWorker = await signupAndLogin(uniqueEmail("matching.normal.far"), "WORKER");
    const offlineWorker = await signupAndLogin(uniqueEmail("matching.normal.offline"), "WORKER");

    await prisma.user.update({
      where: { id: nearWorker.user.id },
      data: { reliabilityScore: 96 },
    });

    await prisma.user.update({
      where: { id: farWorker.user.id },
      data: { reliabilityScore: 78 },
    });

    await prisma.user.update({
      where: { id: offlineWorker.user.id },
      data: { reliabilityScore: 99 },
    });

    await seedWorkerHistory({
      workerId: nearWorker.user.id,
      createdById: customer.user.id,
      completed: 9,
      canceled: 1,
    });

    await seedWorkerHistory({
      workerId: farWorker.user.id,
      createdById: customer.user.id,
      completed: 6,
      canceled: 4,
    });

    await makeWorkerAvailable({
      token: nearWorker.token,
      lat: 30.2678,
      lng: -97.7428,
    });

    await makeWorkerAvailable({
      token: farWorker.token,
      lat: 30.405,
      lng: -97.85,
    });

    const createRes = await request(app)
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        title: "Fix sink leak",
        description: "Kitchen sink leak needs a worker this afternoon",
        jobType: "plumbing",
        urgency: "NORMAL",
        lat: 30.2672,
        lng: -97.7431,
        locationText: "Downtown Austin",
        priceMin: 120,
        priceMax: 180,
      })
      .expect(201);

    const rankingRes = await request(app)
      .get(`/v2/jobs/${createRes.body.job.id}/ranked-workers`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(rankingRes.body.job).toMatchObject({
      id: createRes.body.job.id,
      title: "Fix sink leak",
      urgency: "NORMAL",
      status: "OPEN",
    });

    const nearRanked = rankingRes.body.workers.find(
      (worker: { workerId: string }) => worker.workerId === nearWorker.user.id,
    );
    const farRanked = rankingRes.body.workers.find(
      (worker: { workerId: string }) => worker.workerId === farWorker.user.id,
    );

    expect(nearRanked).toMatchObject({
      workerId: nearWorker.user.id,
      reliabilityScore: 96,
      avgResponseSeconds: null,
    });
    expect(farRanked).toBeTruthy();
    if (!nearRanked || !farRanked) {
      throw new Error("Expected both target workers in normal ranking results");
    }
    expect(nearRanked.score).toBeGreaterThan(farRanked.score);
    expect(nearRanked.distanceMiles).toBeLessThan(farRanked.distanceMiles);
    expect(nearRanked.rank).toBeLessThan(farRanked.rank);
    expect(nearRanked.reasons).toEqual(
      expect.arrayContaining([
        "High reliability",
        "Very close to job",
        "Strong completion history",
      ]),
    );
    expect(
      rankingRes.body.workers.some(
        (worker: { workerId: string }) => worker.workerId === offlineWorker.user.id,
      ),
    ).toBe(false);
  });

  test("emergency ranking only includes emergency-eligible workers and rewards emergency experience", async () => {
    const customer = await signupAndLogin(uniqueEmail("matching.emergency.customer"), "CUSTOMER");
    const nearEmergencyWorker = await signupAndLogin(
      uniqueEmail("matching.emergency.near"),
      "WORKER",
    );
    const farEmergencyWorker = await signupAndLogin(
      uniqueEmail("matching.emergency.far"),
      "WORKER",
    );
    const standardOnlyWorker = await signupAndLogin(
      uniqueEmail("matching.emergency.standard"),
      "WORKER",
    );

    await prisma.user.update({
      where: { id: nearEmergencyWorker.user.id },
      data: { reliabilityScore: 91 },
    });

    await prisma.user.update({
      where: { id: farEmergencyWorker.user.id },
      data: { reliabilityScore: 98 },
    });

    await seedWorkerHistory({
      workerId: nearEmergencyWorker.user.id,
      createdById: customer.user.id,
      completed: 4,
      canceled: 0,
      emergencyCompleted: 3,
    });

    await seedWorkerHistory({
      workerId: farEmergencyWorker.user.id,
      createdById: customer.user.id,
      completed: 4,
      canceled: 0,
      emergencyCompleted: 0,
    });

    await makeWorkerAvailable({
      token: nearEmergencyWorker.token,
      lat: 29.7607,
      lng: -95.3694,
      emergencyOptIn: true,
    });

    await makeWorkerAvailable({
      token: farEmergencyWorker.token,
      lat: 29.9001,
      lng: -95.55,
      emergencyOptIn: true,
    });

    await makeWorkerAvailable({
      token: standardOnlyWorker.token,
      lat: 29.761,
      lng: -95.37,
      emergencyOptIn: false,
    });

    const createRes = await request(app)
      .post("/v1/emergency")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        description: "Burst pipe flooding the lobby right now",
        jobType: "plumbing",
        lat: 29.7604,
        lng: -95.3698,
        locationText: "Houston lobby",
        priceMin: 200,
        priceMax: 320,
      })
      .expect(201);

    const rankingRes = await request(app)
      .get(`/v2/emergency/${createRes.body.job.id}/ranked-workers`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(rankingRes.body.job).toMatchObject({
      id: createRes.body.job.id,
      urgency: "EMERGENCY",
      status: "OPEN",
    });

    const nearEmergencyRanked = rankingRes.body.workers.find(
      (worker: { workerId: string }) => worker.workerId === nearEmergencyWorker.user.id,
    );
    const farEmergencyRanked = rankingRes.body.workers.find(
      (worker: { workerId: string }) => worker.workerId === farEmergencyWorker.user.id,
    );

    expect(nearEmergencyRanked).toBeTruthy();
    expect(farEmergencyRanked).toBeTruthy();
    if (!nearEmergencyRanked || !farEmergencyRanked) {
      throw new Error("Expected both target workers in emergency ranking results");
    }
    expect(nearEmergencyRanked.rank).toBeLessThan(farEmergencyRanked.rank);
    expect(nearEmergencyRanked.etaMinutes).toBeLessThanOrEqual(
      farEmergencyRanked.etaMinutes,
    );
    expect(nearEmergencyRanked.reasons).toEqual(
      expect.arrayContaining(["Emergency job experience"]),
    );
    expect(
      rankingRes.body.workers.some(
        (worker: { workerId: string }) => worker.workerId === standardOnlyWorker.user.id,
      ),
    ).toBe(false);
  });

  test("busy workers are excluded from ranked results", async () => {
    const customer = await signupAndLogin(uniqueEmail("matching.busy.customer"), "CUSTOMER");
    const busyWorker = await signupAndLogin(uniqueEmail("matching.busy.worker"), "WORKER");
    const availableWorker = await signupAndLogin(uniqueEmail("matching.available.worker"), "WORKER");

    await prisma.user.update({
      where: { id: busyWorker.user.id },
      data: { reliabilityScore: 99 },
    });

    await prisma.user.update({
      where: { id: availableWorker.user.id },
      data: { reliabilityScore: 88 },
    });

    await makeWorkerAvailable({
      token: busyWorker.token,
      lat: 32.7769,
      lng: -96.7971,
    });

    await makeWorkerAvailable({
      token: availableWorker.token,
      lat: 32.7773,
      lng: -96.7968,
    });

    const rankingJobRes = await request(app)
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        title: "Rank available workers",
        description: "Need to see which available worker is returned",
        jobType: "handyman",
        urgency: "NORMAL",
        lat: 32.7767,
        lng: -96.797,
        locationText: "Dallas office",
        priceMin: 90,
        priceMax: 150,
      })
      .expect(201);

    const busyJobRes = await request(app)
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        title: "Make worker busy",
        description: "Separate job used to force the worker into busy state",
        jobType: "handyman",
        urgency: "NORMAL",
        lat: 32.78,
        lng: -96.8,
        locationText: "Dallas warehouse",
        priceMin: 100,
        priceMax: 140,
      })
      .expect(201);

    await request(app)
      .post(`/v1/jobs/${busyJobRes.body.job.id}/accept`)
      .set("Authorization", `Bearer ${busyWorker.token}`)
      .expect(200);

    const rankingRes = await request(app)
      .get(`/v2/jobs/${rankingJobRes.body.job.id}/ranked-workers`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(
      rankingRes.body.workers.some(
        (worker: { workerId: string }) => worker.workerId === availableWorker.user.id,
      ),
    ).toBe(true);
    expect(
      rankingRes.body.workers.some(
        (worker: { workerId: string }) => worker.workerId === busyWorker.user.id,
      ),
    ).toBe(false);
  });
});
