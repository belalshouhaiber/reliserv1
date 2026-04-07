import { AvailabilityService } from "../availability/availability.service";

export class WorkerV2Service {
  constructor(private readonly availabilityService: AvailabilityService) {}

  updateStatus(userId: string, serviceStatus: "ONLINE" | "OFFLINE") {
    return this.availabilityService.updateWorkerStatus(userId, serviceStatus);
  }

  updateEmergencyOptIn(userId: string, emergencyOptIn: boolean) {
    return this.availabilityService.updateEmergencyOptIn(userId, emergencyOptIn);
  }

  heartbeat(userId: string, lat: number, lng: number) {
    return this.availabilityService.heartbeatWorker(userId, lat, lng);
  }

  getEligibility(userId: string) {
    return this.availabilityService.getWorkerEligibilitySnapshot(userId);
  }
}
