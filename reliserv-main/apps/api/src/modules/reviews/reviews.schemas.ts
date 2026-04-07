import { z } from "zod";

export const createReviewSchema = z.object({
  jobId: z.string().min(1),
  toUserId: z.string().min(1),
  target: z.enum(["CUSTOMER", "WORKER"]),
  rating: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
});
