import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { MapService } from "./map.service";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  mode: z.enum(["normal", "emergency"]).default("normal"),
});

export class MapController {
  constructor(private readonly mapService: MapService) {}

  getWorkersNearPoint = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = querySchema.parse(req.query);
      const result = await this.mapService.getWorkersNearPoint(
        query.lat,
        query.lng,
        query.mode,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getMapCandidatesForJob = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.mapService.getMapCandidatesForJob(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
