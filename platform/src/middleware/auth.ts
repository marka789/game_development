import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AuthUser = {
  userId: string;
  username: string;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "7d" });
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing bearer token" });
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    request.authUser = payload;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
  }
}
