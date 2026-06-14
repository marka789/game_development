import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { createHuntJoinToken } from "../services/hunt-tokens.js";

async function getPartyForUser(userId: string) {
  const result = await pool.query(
    `
    SELECT p.id, p.leader_id, p.status, p.hunt_session_id
    FROM parties p
    JOIN party_members pm ON pm.party_id = p.id
    WHERE pm.user_id = $1
    LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] as
    | { id: string; leader_id: string; status: string; hunt_session_id: string | null }
    | undefined;
}

async function getPartyMembers(partyId: string) {
  const result = await pool.query(
    `
    SELECT pm.user_id, u.username, pp.display_name, pm.is_ready,
           (p.leader_id = pm.user_id) AS is_leader
    FROM party_members pm
    JOIN users u ON u.id = pm.user_id
    JOIN player_profiles pp ON pp.user_id = pm.user_id
    JOIN parties p ON p.id = pm.party_id
    WHERE pm.party_id = $1
    ORDER BY pm.joined_at ASC
    `,
    [partyId],
  );
  return result.rows;
}

async function buildHuntConnection(
  party: { id: string; hunt_session_id: string | null; status: string },
  userId: string,
) {
  if (party.status !== "in_hunt" || !party.hunt_session_id) {
    return null;
  }

  const session = await pool.query(
    `
    SELECT instance_host, instance_port, status
    FROM hunt_sessions
    WHERE id = $1
    `,
    [party.hunt_session_id],
  );
  const hunt = session.rows[0] as
    | { instance_host: string; instance_port: number; status: string }
    | undefined;
  if (!hunt || hunt.status !== "active") {
    return null;
  }

  return {
    huntSessionId: party.hunt_session_id,
    huntHost: hunt.instance_host,
    huntPort: hunt.instance_port,
    joinToken: createHuntJoinToken(party.hunt_session_id, party.id, userId),
  };
}

export async function partyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/party", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const party = await getPartyForUser(userId);
    if (!party) {
      return { party: null, huntConnection: null };
    }
    const members = await getPartyMembers(party.id);
    const huntConnection = await buildHuntConnection(party, userId);
    return { party: { ...party, members }, huntConnection };
  });

  app.post("/party/create", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const existing = await getPartyForUser(userId);
    if (existing) {
      return reply.code(400).send({ error: "Already in a party" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const partyResult = await client.query(
        `
        INSERT INTO parties (leader_id)
        VALUES ($1)
        RETURNING id, leader_id, status
        `,
        [userId],
      );
      const party = partyResult.rows[0] as { id: string; leader_id: string; status: string };
      await client.query(
        `
        INSERT INTO party_members (party_id, user_id, is_ready)
        VALUES ($1, $2, TRUE)
        `,
        [party.id, userId],
      );
      await client.query("COMMIT");
      const members = await getPartyMembers(party.id);
      return { party: { ...party, members } };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/party/invite", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ username: z.string().min(3) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const party = await getPartyForUser(userId);
    if (!party) {
      return reply.code(400).send({ error: "Not in a party" });
    }
    if (party.leader_id !== userId) {
      return reply.code(403).send({ error: "Only the party leader can invite" });
    }

    const target = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [parsed.data.username.toLowerCase()],
    );
    const inviteeId = target.rows[0]?.id as string | undefined;
    if (!inviteeId) {
      return reply.code(404).send({ error: "User not found" });
    }

    const inviteeParty = await getPartyForUser(inviteeId);
    if (inviteeParty) {
      return reply.code(400).send({ error: "Player already in a party" });
    }

    const memberCount = await pool.query(
      "SELECT COUNT(*)::int AS count FROM party_members WHERE party_id = $1",
      [party.id],
    );
    if ((memberCount.rows[0]?.count as number) >= 4) {
      return reply.code(400).send({ error: "Party is full" });
    }

    await pool.query(
      `
      INSERT INTO party_members (party_id, user_id)
      VALUES ($1, $2)
      `,
      [party.id, inviteeId],
    );

    const members = await getPartyMembers(party.id);
    return { party: { ...party, members } };
  });

  app.post("/party/leave", { preHandler: requireAuth }, async (request) => {
    const userId = request.authUser!.userId;
    const party = await getPartyForUser(userId);
    if (!party) {
      return { ok: true };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM party_members WHERE party_id = $1 AND user_id = $2",
        [party.id, userId],
      );

      const remaining = await client.query(
        "SELECT user_id FROM party_members WHERE party_id = $1 ORDER BY joined_at ASC",
        [party.id],
      );

      if (remaining.rowCount === 0) {
        await client.query("DELETE FROM parties WHERE id = $1", [party.id]);
      } else if (party.leader_id === userId) {
        const newLeaderId = remaining.rows[0].user_id as string;
        await client.query("UPDATE parties SET leader_id = $1 WHERE id = $2", [
          newLeaderId,
          party.id,
        ]);
      }

      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/party/ready", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ ready: z.boolean() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const party = await getPartyForUser(userId);
    if (!party) {
      return reply.code(400).send({ error: "Not in a party" });
    }

    await pool.query(
      "UPDATE party_members SET is_ready = $1 WHERE party_id = $2 AND user_id = $3",
      [parsed.data.ready, party.id, userId],
    );

    const members = await getPartyMembers(party.id);
    return { party: { ...party, members } };
  });
}
