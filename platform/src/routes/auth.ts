import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const credentialsSchema = z.object({
  username: z.string().min(3).max(24),
  password: z.string().min(6).max(72),
  displayName: z.string().min(2).max(24).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { username, password, displayName } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        `
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING id, username
        `,
        [username.toLowerCase(), passwordHash],
      );
      const user = userResult.rows[0] as { id: string; username: string };
      await client.query(
        `
        INSERT INTO player_profiles (user_id, display_name)
        VALUES ($1, $2)
        `,
        [user.id, displayName ?? username],
      );
      await client.query("COMMIT");

      const token = signToken({ userId: user.id, username: user.username });
      return { token, userId: user.id, username: user.username };
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Username already taken" });
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.pick({ username: true, password: true }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { username, password } = parsed.data;
    const result = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username.toLowerCase()],
    );
    const user = result.rows[0] as
      | { id: string; username: string; password_hash: string }
      | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const token = signToken({ userId: user.id, username: user.username });
    return { token, userId: user.id, username: user.username };
  });

  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const result = await pool.query(
      `
      SELECT u.id, u.username, p.display_name, p.level, p.xp, p.skin_color
      FROM users u
      JOIN player_profiles p ON p.user_id = u.id
      WHERE u.id = $1
      `,
      [request.authUser!.userId],
    );
    const profile = result.rows[0];
    if (!profile) {
      return reply.code(404).send({ error: "Profile not found" });
    }
    return profile;
  });
}
