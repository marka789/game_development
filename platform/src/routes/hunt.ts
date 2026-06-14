import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { createHuntJoinToken, verifyHuntJoinToken } from "../services/hunt-tokens.js";

const HUNT_INSTANCE_PORT = Number(process.env.HUNT_PORT ?? 7800);

async function getPartyForUser(userId: string) {
  const result = await pool.query(
    `
    SELECT p.id, p.leader_id, p.status
    FROM parties p
    JOIN party_members pm ON pm.party_id = p.id
    WHERE pm.user_id = $1
    LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] as { id: string; leader_id: string; status: string } | undefined;
}

export async function huntRoutes(app: FastifyInstance): Promise<void> {
  app.post("/party/start-hunt", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const party = await getPartyForUser(userId);
    if (!party) {
      return reply.code(400).send({ error: "Not in a party" });
    }
    if (party.leader_id !== userId) {
      return reply.code(403).send({ error: "Only the party leader can start a hunt" });
    }
    if (party.status === "in_hunt") {
      return reply.code(400).send({ error: "Party already in a hunt" });
    }

    const members = await pool.query(
      "SELECT user_id, is_ready FROM party_members WHERE party_id = $1",
      [party.id],
    );
    const notReady = members.rows.filter((row) => !row.is_ready);
    if (notReady.length > 0) {
      return reply.code(400).send({ error: "All party members must be ready" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const huntResult = await client.query(
        `
        INSERT INTO hunt_sessions (party_id, instance_host, instance_port, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING id
        `,
        [party.id, config.hubHost, HUNT_INSTANCE_PORT],
      );
      const huntSessionId = huntResult.rows[0].id as string;
      await client.query(
        "UPDATE parties SET status = 'in_hunt', hunt_session_id = $1 WHERE id = $2",
        [huntSessionId, party.id],
      );
      await client.query("COMMIT");

      const joinToken = createHuntJoinToken(huntSessionId, party.id, userId);

      return {
        huntSessionId,
        huntHost: config.hubHost,
        huntPort: HUNT_INSTANCE_PORT,
        joinToken,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/hunt/complete", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        huntSessionId: z.string().uuid(),
        success: z.boolean(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const { huntSessionId, success } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT 1 FROM hunt_results WHERE hunt_session_id = $1 AND user_id = $2",
        [huntSessionId, userId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await client.query("ROLLBACK");
        return { ok: true, message: "Already granted" };
      }

      const xpGained = success ? 100 : 25;
      const lootItemId = success ? "iron_sword" : null;

      await client.query(
        `
        INSERT INTO hunt_results (hunt_session_id, user_id, success, xp_gained, loot_item_id)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [huntSessionId, userId, success, xpGained, lootItemId],
      );

      await client.query(
        `
        UPDATE player_profiles
        SET xp = xp + $1,
            level = GREATEST(1, 1 + ((xp + $1) / 300)::int)
        WHERE user_id = $2
        `,
        [xpGained, userId],
      );

      await client.query(
        `
        UPDATE hunt_sessions
        SET status = $1, ended_at = NOW()
        WHERE id = $2
        `,
        [success ? "completed" : "failed", huntSessionId],
      );

      await client.query(
        `
        UPDATE parties
        SET status = 'open', hunt_session_id = NULL
        WHERE hunt_session_id = $1
        `,
        [huntSessionId],
      );

      await client.query("COMMIT");
      return { ok: true, xpGained, lootItemId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/hunt/validate-join", async (request, reply) => {
    const parsed = z.object({ joinToken: z.string().min(10) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    let payload;
    try {
      payload = verifyHuntJoinToken(parsed.data.joinToken);
    } catch {
      return reply.code(401).send({ error: "Invalid or expired hunt join token" });
    }

    const session = await pool.query(
      `
      SELECT id, status
      FROM hunt_sessions
      WHERE id = $1
      `,
      [payload.huntSessionId],
    );
    const hunt = session.rows[0] as { id: string; status: string } | undefined;
    if (!hunt || hunt.status !== "active") {
      return reply.code(400).send({ error: "Hunt session is not active" });
    }

    const membership = await pool.query(
      `
      SELECT 1
      FROM party_members
      WHERE party_id = $1 AND user_id = $2
      `,
      [payload.partyId, payload.userId],
    );
    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: "Player is not in this party" });
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
    const profile = result.rows[0];
    if (!profile) {
      return reply.code(404).send({ error: "Player profile not found" });
    }

    return {
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      skinColor: profile.skin_color,
      huntSessionId: payload.huntSessionId,
      partyId: payload.partyId,
    };
  });
}
