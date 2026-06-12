import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { authRoutes } from "./routes/auth.js";
import { friendsRoutes } from "./routes/friends.js";
import { huntRoutes } from "./routes/hunt.js";
import { partyRoutes } from "./routes/party.js";
import { worldRoutes } from "./routes/world.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await runMigrations();

await app.register(authRoutes);
await app.register(friendsRoutes);
await app.register(partyRoutes);
await app.register(worldRoutes);
await app.register(huntRoutes);

app.get("/health", async () => ({ ok: true }));

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Platform API running at http://localhost:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
