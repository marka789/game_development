import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { getPresence } from "../services/redis.js";

export async function friendsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/friends", { preHandler: requireAuth }, async (request) => {
    const userId = request.authUser!.userId;
    const result = await pool.query(
      `
      SELECT
        CASE
          WHEN f.requester_id = $1 THEN u2.id
          ELSE u1.id
        END AS friend_id,
        CASE
          WHEN f.requester_id = $1 THEN p2.display_name
          ELSE p1.display_name
        END AS display_name,
        CASE
          WHEN f.requester_id = $1 THEN u2.username
          ELSE u1.username
        END AS username,
        f.status,
        CASE
          WHEN f.requester_id = $1 THEN 'outgoing'
          ELSE 'incoming'
        END AS direction
      FROM friendships f
      JOIN users u1 ON u1.id = f.requester_id
      JOIN users u2 ON u2.id = f.addressee_id
      JOIN player_profiles p1 ON p1.user_id = u1.id
      JOIN player_profiles p2 ON p2.user_id = u2.id
      WHERE ($1 = f.requester_id OR $1 = f.addressee_id)
        AND f.status IN ('pending', 'accepted')
      ORDER BY f.created_at DESC
      `,
      [userId],
    );

    const friends = await Promise.all(
      result.rows.map(async (row) => {
        const presence = await getPresence(row.friend_id as string);
        return {
          ...row,
          online: presence?.status === "in_hub",
          presence: presence?.status ?? "offline",
        };
      }),
    );

    return { friends };
  });

  app.post("/friends/request", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ username: z.string().min(3) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const target = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [parsed.data.username.toLowerCase()],
    );
    const friendId = target.rows[0]?.id as string | undefined;
    if (!friendId) {
      return reply.code(404).send({ error: "User not found" });
    }
    if (friendId === userId) {
      return reply.code(400).send({ error: "Cannot friend yourself" });
    }

    await pool.query(
      `
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (requester_id, addressee_id) DO NOTHING
      `,
      [userId, friendId],
    );

    return { ok: true };
  });

  app.post("/friends/accept", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ username: z.string().min(3) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const result = await pool.query(
      `
      UPDATE friendships f
      SET status = 'accepted'
      FROM users u
      WHERE f.requester_id = u.id
        AND u.username = $2
        AND f.addressee_id = $1
        AND f.status = 'pending'
      RETURNING f.id
      `,
      [userId, parsed.data.username.toLowerCase()],
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Friend request not found" });
    }

    return { ok: true };
  });
}
