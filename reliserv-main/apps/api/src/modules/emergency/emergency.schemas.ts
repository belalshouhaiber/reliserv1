import { z } from "zod";

export const createEmergencySchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(5000),
  jobType: z.string().min(2).max(40),
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationText: z.string().max(120).optional(),
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().nonnegative().optional(),
  lockedScope: z.string().max(1000).optional(),
});
