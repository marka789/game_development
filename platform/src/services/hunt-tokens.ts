import jwt from "jsonwebtoken";
import { config } from "../config.js";

type HuntJoinPayload = {
  huntSessionId: string;
  partyId: string;
  userId: string;
  purpose: string;
};

export function createHuntJoinToken(
  huntSessionId: string,
  partyId: string,
  userId: string,
): string {
  return jwt.sign(
    {
      huntSessionId,
      partyId,
      userId,
      purpose: "hunt_join",
    },
    config.jwtSecret,
    { expiresIn: "10m" },
  );
}

export function verifyHuntJoinToken(token: string): HuntJoinPayload {
  const payload = jwt.verify(token, config.jwtSecret) as HuntJoinPayload;
  if (payload.purpose !== "hunt_join") {
    throw new Error("Invalid token purpose");
  }
  return payload;
}
