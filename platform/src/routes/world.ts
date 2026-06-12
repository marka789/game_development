import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { setPresence } from "../services/redis.js";

export async function worldRoutes(app: FastifyInstance): Promise<void> {
  app.post("/world/join-hub", { preHandler: requireAuth }, async (request) => {
    const user = request.authUser!;

    await setPresence(user.userId, {
      status: "in_hub",
      hubHost: config.hubHost,
      hubPort: config.hubPort,
    });

    const joinToken = jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        purpose: "hub_join",
      },
      config.jwtSecret,
      { expiresIn: "5m" },
    );

    return {
      hubHost: config.hubHost,
      hubPort: config.hubPort,
      joinToken,
    };
  });
}
