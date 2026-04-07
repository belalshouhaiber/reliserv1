import request from "supertest";
import app from "../app";
import { disconnectPrisma, prisma } from "../db/prisma";
import { signupAndLogin } from "./helpers";

jest.setTimeout(30000);

const MAP_CENTER = {
  lat: 27.8006,
  lng: -97.3964,
} as const;

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

async function createNormalJob(input: {
  token: string;
  title: string;
  lat: number;
  lng: number;
}) {
  const res = await request(app)
    .post("/v1/jobs")
    .set("Authorization", `Bearer ${input.token}`)
    .send({
      title: input.title,
      description: `${input.title} description`,
      jobType: "plumbing",
      urgency: "NORMAL",
      lat: input.lat,
      lng: input.lng,
      locationText: "Map test normal job",
      priceMin: 100,
      priceMax: 180,
    })
    .expect(201);

  return res.body.job.id as string;
}

async function createEmergencyJob(input: {
  token: string;
  description: string;
  lat: number;
  lng: number;
}) {
  const res = await request(app)
    .post("/v1/emergency")
    .set("Authorization", `Bearer ${input.token}`)
    .send({
      description: input.description,
      jobType: "plumbing",
      lat: input.lat,
      lng: input.lng,
      locationText: "Map test emergency job",
      priceMin: 160,
      priceMax: 260,
    })
    .expect(201);

  return res.body.job.id as string;
}

type MapWorkerDto = {
  workerId: string;
  distanceMiles: number;
  etaMinutes: number | null;
  standardEligible: boolean;
  emergencyEligible: boolean;
};

describe("Map worker visibility", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  test("normal mode shows ONLINE workers with heartbeat and sorts nearer workers first", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.normal.customer"), "CUSTOMER");
    const nearWorker = await signupAndLogin(uniqueEmail("map.normal.near"), "WORKER");
    const farWorker = await signupAndLogin(uniqueEmail("map.normal.far"), "WORKER");

    await makeWorkerAvailable({
      token: nearWorker.token,
      lat: 27.8206,
      lng: -97.3964,
    });

    await makeWorkerAvailable({
      token: farWorker.token,
      lat: 27.9006,
      lng: -97.3964,
    });

    const res = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=normal`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(res.body.center).toMatchObject({
      lat: MAP_CENTER.lat,
      lng: MAP_CENTER.lng,
      mode: "normal",
    });

    const nearVisible = res.body.workers.find(
      (worker: MapWorkerDto) => worker.workerId === nearWorker.user.id,
    );
    const farVisible = res.body.workers.find(
      (worker: MapWorkerDto) => worker.workerId === farWorker.user.id,
    );

    expect(nearVisible).toBeTruthy();
    expect(farVisible).toBeTruthy();

    if (!nearVisible || !farVisible) {
      throw new Error("Expected both target workers to appear in normal map results");
    }

    expect(nearVisible.standardEligible).toBe(true);
    expect(nearVisible.distanceMiles).toBeGreaterThanOrEqual(0);
    expect(farVisible.distanceMiles).toBeGreaterThanOrEqual(0);
    expect(nearVisible.etaMinutes).not.toBeNull();
    expect(farVisible.etaMinutes).not.toBeNull();
    expect(nearVisible.etaMinutes!).toBeGreaterThanOrEqual(0);
    expect(farVisible.etaMinutes!).toBeGreaterThanOrEqual(0);
    expect(nearVisible.distanceMiles).toBeLessThan(farVisible.distanceMiles);
    expect(nearVisible.etaMinutes!).toBeLessThan(farVisible.etaMinutes!);
    expect(res.body.workers[0].workerId).toBe(nearWorker.user.id);
  });

  test("OFFLINE workers do not appear in normal or emergency mode", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.offline.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("map.offline.worker"), "WORKER");

    await makeWorkerAvailable({
      token: worker.token,
      lat: 27.8106,
      lng: -97.3964,
      emergencyOptIn: true,
    });

    await request(app)
      .patch("/v2/worker/status")
      .set("Authorization", `Bearer ${worker.token}`)
      .send({ serviceStatus: "OFFLINE" })
      .expect(200);

    const normalRes = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=normal`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    const emergencyRes = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=emergency`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(
      normalRes.body.workers.some(
        (visibleWorker: MapWorkerDto) => visibleWorker.workerId === worker.user.id,
      ),
    ).toBe(false);
    expect(
      emergencyRes.body.workers.some(
        (visibleWorker: MapWorkerDto) => visibleWorker.workerId === worker.user.id,
      ),
    ).toBe(false);
  });

  test("BUSY workers do not appear in map results", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.busy.customer"), "CUSTOMER");
    const busyWorker = await signupAndLogin(uniqueEmail("map.busy.worker"), "WORKER");
    const availableWorker = await signupAndLogin(uniqueEmail("map.available.worker"), "WORKER");

    await makeWorkerAvailable({
      token: busyWorker.token,
      lat: 27.8056,
      lng: -97.3964,
    });

    await makeWorkerAvailable({
      token: availableWorker.token,
      lat: 27.8156,
      lng: -97.3964,
    });

    const busyJobId = await createNormalJob({
      token: customer.token,
      title: "Force worker busy",
      lat: 27.81,
      lng: -97.39,
    });

    await request(app)
      .post(`/v1/jobs/${busyJobId}/accept`)
      .set("Authorization", `Bearer ${busyWorker.token}`)
      .expect(200);

    const res = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=normal`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(
      res.body.workers.some(
        (worker: MapWorkerDto) => worker.workerId === busyWorker.user.id,
      ),
    ).toBe(false);
    expect(
      res.body.workers.some(
        (worker: MapWorkerDto) => worker.workerId === availableWorker.user.id,
      ),
    ).toBe(true);
  });

  test("emergency mode excludes emergency opt-out workers but normal mode can still include them", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.optout.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("map.optout.worker"), "WORKER");

    await makeWorkerAvailable({
      token: worker.token,
      lat: 27.8126,
      lng: -97.3964,
      emergencyOptIn: false,
    });

    const normalRes = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=normal`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    const emergencyRes = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=emergency`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    const normalWorker = normalRes.body.workers.find(
      (visibleWorker: MapWorkerDto) => visibleWorker.workerId === worker.user.id,
    );

    expect(normalWorker).toBeTruthy();
    expect(normalWorker?.standardEligible).toBe(true);
    expect(normalWorker?.emergencyEligible).toBe(false);
    expect(
      emergencyRes.body.workers.some(
        (visibleWorker: MapWorkerDto) => visibleWorker.workerId === worker.user.id,
      ),
    ).toBe(false);
  });

  test("workers with missing coordinates are skipped safely and the endpoint still returns 200", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.coords.customer"), "CUSTOMER");
    const worker = await signupAndLogin(uniqueEmail("map.coords.worker"), "WORKER");

    await makeWorkerAvailable({
      token: worker.token,
      lat: 27.8066,
      lng: -97.3964,
    });

    await prisma.workerProfile.update({
      where: { userId: worker.user.id },
      data: {
        lastKnownLat: null,
        lastKnownLng: null,
      },
    });

    const res = await request(app)
      .get(
        `/v2/map/workers?lat=${MAP_CENTER.lat}&lng=${MAP_CENTER.lng}&mode=normal`,
      )
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(
      res.body.workers.some(
        (visibleWorker: MapWorkerDto) => visibleWorker.workerId === worker.user.id,
      ),
    ).toBe(false);
  });

  test("job-centered candidate query uses job location and urgency-specific eligibility", async () => {
    const customer = await signupAndLogin(uniqueEmail("map.job.customer"), "CUSTOMER");
    const nearEmergencyWorker = await signupAndLogin(
      uniqueEmail("map.job.emergency.near"),
      "WORKER",
    );
    const farEmergencyWorker = await signupAndLogin(
      uniqueEmail("map.job.emergency.far"),
      "WORKER",
    );
    const standardOnlyWorker = await signupAndLogin(
      uniqueEmail("map.job.standard.only"),
      "WORKER",
    );

    await makeWorkerAvailable({
      token: nearEmergencyWorker.token,
      lat: 29.7704,
      lng: -95.3698,
      emergencyOptIn: true,
    });

    await makeWorkerAvailable({
      token: farEmergencyWorker.token,
      lat: 29.8604,
      lng: -95.3698,
      emergencyOptIn: true,
    });

    await makeWorkerAvailable({
      token: standardOnlyWorker.token,
      lat: 29.7714,
      lng: -95.3698,
      emergencyOptIn: false,
    });

    const emergencyJobId = await createEmergencyJob({
      token: customer.token,
      description: "Emergency map candidate query",
      lat: 29.7604,
      lng: -95.3698,
    });

    const emergencyRes = await request(app)
      .get(`/v2/map/jobs/${emergencyJobId}/map-candidates`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    expect(emergencyRes.body.job).toMatchObject({
      id: emergencyJobId,
      urgency: "EMERGENCY",
      lat: 29.7604,
      lng: -95.3698,
    });
    expect(emergencyRes.body.workers[0].workerId).toBe(nearEmergencyWorker.user.id);
    expect(
      emergencyRes.body.workers.some(
        (worker: MapWorkerDto) => worker.workerId === standardOnlyWorker.user.id,
      ),
    ).toBe(false);

    const normalJobId = await createNormalJob({
      token: customer.token,
      title: "Normal map candidate query",
      lat: 29.7604,
      lng: -95.3698,
    });

    const normalRes = await request(app)
      .get(`/v2/map/jobs/${normalJobId}/map-candidates`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);

    const normalWorkerIds = normalRes.body.workers.map(
      (worker: MapWorkerDto) => worker.workerId,
    );

    expect(normalRes.body.job).toMatchObject({
      id: normalJobId,
      urgency: "NORMAL",
      lat: 29.7604,
      lng: -95.3698,
    });
    expect(normalWorkerIds).toContain(standardOnlyWorker.user.id);
    expect(normalWorkerIds).toContain(nearEmergencyWorker.user.id);
    expect(normalRes.body.workers[0].distanceMiles).toBeLessThanOrEqual(
      normalRes.body.workers[1].distanceMiles,
    );
  });
});
