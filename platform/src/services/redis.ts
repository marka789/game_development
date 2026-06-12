import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl);

export async function setPresence(
  userId: string,
  data: { status: string; hubHost?: string; hubPort?: number },
): Promise<void> {
  await redis.set(
    `presence:${userId}`,
    JSON.stringify({ ...data, updatedAt: Date.now() }),
    "EX",
    300,
  );
}

export async function getPresence(
  userId: string,
): Promise<{ status: string; hubHost?: string; hubPort?: number } | null> {
  const raw = await redis.get(`presence:${userId}`);
  return raw ? (JSON.parse(raw) as { status: string; hubHost?: string; hubPort?: number }) : null;
}

export async function clearPresence(userId: string): Promise<void> {
  await redis.del(`presence:${userId}`);
}
