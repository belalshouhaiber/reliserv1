import type { NextFunction, Request, Response } from "express";
import { MatchingService } from "./matching.service";

export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  getRankedWorkersForJob = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.matchingService.getRankedWorkersForJob(
        req.params.id,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getRankedWorkersForEmergency = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.matchingService.getRankedWorkersForEmergency(
        req.params.id,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
