import { env } from "../config/env";

export interface RedisClientLike {
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

type Entry = {
  value: string;
  expiresAt: number | null;
};

class InMemoryRedisClient implements RedisClientLike {
  private readonly store = new Map<string, Entry>();

  async set(key: string, value: string, mode: "EX", ttlSeconds: number) {
    const expiresAt = mode === "EX" ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
}

function createRedisClient(): RedisClientLike {
  try {
    const Redis = require("ioredis");
    return new Redis(env.REDIS_URL) as RedisClientLike;
  } catch (error) {
    console.warn("ioredis is not installed or Redis is unavailable. Falling back to in-memory presence storage.", error);
    return new InMemoryRedisClient();
  }
}

export const redis = createRedisClient();
