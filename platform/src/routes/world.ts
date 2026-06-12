import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { setPresence } from "../services/redis.js";

type HubJoinPayload = {
  userId: string;
  username: string;
  purpose: string;
};

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

  app.post("/world/validate-hub-join", async (request, reply) => {
    const parsed = z.object({ joinToken: z.string().min(10) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    let payload: HubJoinPayload;
    try {
      payload = jwt.verify(parsed.data.joinToken, config.jwtSecret) as HubJoinPayload;
    } catch {
      return reply.code(401).send({ error: "Invalid or expired join token" });
    }

    if (payload.purpose !== "hub_join") {
      return reply.code(401).send({ error: "Invalid token purpose" });
    }

    const result = await pool.query(
      `
      SELECT u.id AS user_id, u.username, p.display_name, p.skin_color
      FROM users u
      JOIN player_profiles p ON p.user_id = u.id
      WHERE u.id = $1
      `,
      [payload.userId],
    );

    const profile = result.rows[0] as
      | {
          user_id: string;
          username: string;
          display_name: string;
          skin_color: string;
        }
      | undefined;

    if (!profile) {
      return reply.code(404).send({ error: "Player profile not found" });
    }

    return {
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      skinColor: profile.skin_color,
    };
  });
}
