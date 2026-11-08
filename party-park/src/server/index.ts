import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { cleanName, isPlayerColor, type ClientMessage, type ServerMessage } from "../shared/protocol.ts";
import { Room, makeRoomCode } from "./room.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(ROOT, "dist");
const STEP_MS = 1000 / 60;

type Connection = {
  ws: WebSocket;
  room: Room;
  playerId: string;
};

const rooms = new Map<string, Room>();
const connections = new Set<Connection>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcastLobby(room: Room): void {
  for (const connection of connections) {
    if (connection.room !== room) continue;
    send(connection.ws, room.lobby(connection.playerId));
  }
}

function broadcastState(room: Room): void {
  for (const connection of connections) {
    if (connection.room !== room) continue;
    send(connection.ws, room.inGame ? room.snapshot(connection.playerId) : room.lobby(connection.playerId));
  }
}

function forgetRoom(room: Room): void {
  if (room.playerCount === 0) rooms.delete(room.code);
}

export function createGameServer(): http.Server {
  const server = http.createServer((request, response) => {
    if (!existsSync(path.join(DIST, "index.html"))) {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("Party Park server is running. In development, open the Vite page on port 5173.");
      return;
    }
    serveStatic(request.url ?? "/", response);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    let connection: Connection | null = null;

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      if (text.length > 2000) return;
      let message: ClientMessage;
      try {
        message = JSON.parse(text) as ClientMessage;
      } catch {
        send(ws, { type: "error", message: "Bad message" });
        return;
      }

      if (!connection) {
        if (message.type !== "join") {
          send(ws, { type: "error", message: "Join a room first" });
          return;
        }
        const joined = joinRoom(ws, message.name, message.color, message.roomCode);
        if ("error" in joined) {
          send(ws, { type: "error", message: joined.error });
          return;
        }
        connection = joined;
        connections.add(connection);
        send(ws, {
          type: "hello",
          playerId: connection.playerId,
          roomCode: connection.room.code,
          hostId: connection.room.hostId ?? connection.playerId,
        });
        if (connection.room.inGame) broadcastState(connection.room);
        else broadcastLobby(connection.room);
        return;
      }

      if (message.type === "input") {
        connection.room.setInput(connection.playerId, message);
      } else if (message.type === "start") {
        if (connection.room.start(connection.playerId)) broadcastState(connection.room);
      } else if (message.type === "restart") {
        if (connection.room.restart(connection.playerId)) broadcastState(connection.room);
      }
    });

    ws.on("close", () => {
      if (!connection) return;
      connections.delete(connection);
      const room = connection.room;
      room.removePlayer(connection.playerId);
      if (room.playerCount === 0) forgetRoom(room);
      else broadcastState(room);
    });
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.inGame) continue;
      room.tick();
      broadcastState(room);
    }
  }, STEP_MS);
  timer.unref?.();

  server.on("close", () => {
    clearInterval(timer);
    wss.close();
  });

  return server;
}

function joinRoom(
  ws: WebSocket,
  rawName: string,
  rawColor: string,
  rawCode: string | null,
): Connection | { error: string } {
  const name = cleanName(rawName);
  const color = isPlayerColor(rawColor) ? rawColor : "#ff5d5d";
  let room: Room | undefined;
  if (rawCode) {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    room = rooms.get(code);
    if (!room) return { error: "No room with that code" };
    if (room.playerCount >= 4) return { error: "That room is full" };
  } else {
    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();
    room = new Room(code);
    rooms.set(code, room);
  }
  const playerId = room.addPlayer(name, color);
  return { ws, room, playerId };
}

function serveStatic(urlPath: string, response: http.ServerResponse): void {
  const clean = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(DIST, relative));
  if (!filePath.startsWith(DIST) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const fallback = path.join(DIST, "index.html");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallback).pipe(response);
    return;
  }
  response.writeHead(200, { "content-type": contentType(filePath) });
  createReadStream(filePath).pipe(response);
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

if (process.env.PARTY_PARK_EMBED !== "1") {
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";
  createGameServer().listen(port, host, () => {
    console.log(`Party Park room server on http://${host}:${port}`);
  });
}
