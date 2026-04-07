import type { NextFunction, Request, Response } from "express";
import { TrustService } from "./trust.service";

export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  getWorkerTrustInsights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.trustService.getWorkerTrustInsights(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getReliabilityHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.trustService.getReliabilityHistory(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
