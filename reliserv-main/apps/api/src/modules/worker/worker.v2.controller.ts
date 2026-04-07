import type { NextFunction, Request, Response } from "express";
import { WorkerV2Service } from "./worker.v2.service";
import {
  updateEmergencyOptInSchema,
  updateWorkerStatusSchema,
  workerHeartbeatSchema,
} from "./worker.v2.validator";

export class WorkerV2Controller {
  constructor(private readonly workerV2Service: WorkerV2Service) {}

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateWorkerStatusSchema.parse(req.body);
      const result = await this.workerV2Service.updateStatus(
        req.user!.id,
        body.serviceStatus,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateEmergencyOptIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateEmergencyOptInSchema.parse(req.body);
      const result = await this.workerV2Service.updateEmergencyOptIn(
        req.user!.id,
        body.emergencyOptIn,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  heartbeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = workerHeartbeatSchema.parse(req.body);
      const result = await this.workerV2Service.heartbeat(
        req.user!.id,
        body.lat,
        body.lng,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getEligibility = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.workerV2Service.getEligibility(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
