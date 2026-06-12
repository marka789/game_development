import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me-in-production"),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://game:game@localhost:5432/game_dev",
  ),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  hubHost: required("HUB_HOST", "127.0.0.1"),
  hubPort: Number(process.env.HUB_PORT ?? 7777),
};
