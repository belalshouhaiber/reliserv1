import type { RedisClientLike } from "../../lib/redis";

export const WORKER_PRESENCE_TTL_SECONDS = 90;

export type WorkerPresencePayload = {
  userId: string;
  lat: number;
  lng: number;
  at: string;
};

const presenceKey = (userId: string) => `worker:presence:${userId}`;

export class PresenceRedis {
  constructor(private readonly redis: RedisClientLike) {}

  async setWorkerPresence(
    userId: string,
    payload: WorkerPresencePayload,
    ttlSeconds = WORKER_PRESENCE_TTL_SECONDS,
  ) {
    await this.redis.set(
      presenceKey(userId),
      JSON.stringify(payload),
      "EX",
      ttlSeconds,
    );
  }

  async getWorkerPresence(userId: string): Promise<WorkerPresencePayload | null> {
    const raw = await this.redis.get(presenceKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkerPresencePayload;
  }

  async clearWorkerPresence(userId: string) {
    await this.redis.del(presenceKey(userId));
  }
}
