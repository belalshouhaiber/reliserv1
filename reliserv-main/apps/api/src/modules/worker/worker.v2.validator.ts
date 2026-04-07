import { z } from "zod";

export const updateWorkerStatusSchema = z.object({
  serviceStatus: z.enum(["ONLINE", "OFFLINE"]),
});

export const updateEmergencyOptInSchema = z.object({
  emergencyOptIn: z.boolean(),
});

export const workerHeartbeatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
