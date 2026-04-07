import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middlewares/auth";
import { createEmergencySchema } from "./emergency.schemas";

export const emergencyRoutes = Router();

/**
 * POST /v1/emergency
 * Creates an EMERGENCY job (status OPEN).
 * Auth: CUSTOMER (we'll allow any authed user for V1; you can restrict later)
 */
emergencyRoutes.post("/", requireAuth, async (req, res) => {
  const parsed = createEmergencySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const data = parsed.data;

  const job = await prisma.job.create({
    data: {
      title: data.title ?? `Emergency - ${data.jobType}`,
      description: data.description,
      jobType: data.jobType,
      urgency: "EMERGENCY",
      status: "OPEN",

      lat: data.lat,
      lng: data.lng,
      locationText: data.locationText,

      priceMin: data.priceMin,
      priceMax: data.priceMax,
      lockedScope: data.lockedScope,

      createdById: userId,
      events: {
        create: {
          type: "CREATED",
          actorId: userId,
          note: "Emergency job created",
        },
      },
    },
    include: { events: true },
  });

  return res.status(201).json({ job });
});


