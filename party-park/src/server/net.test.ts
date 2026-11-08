import assert from "node:assert/strict";
import { test } from "node:test";
import { WebSocket } from "ws";
import type { ServerMessage } from "../shared/protocol.ts";

test("two sockets share a room and a running level", async () => {
  process.env.PARTY_PARK_EMBED = "1";
  const { createGameServer } = await import("./index.ts");
  const server = createGameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const url = `ws://127.0.0.1:${address.port}/ws`;

  const host = await openPlayer(url, "Ada", "#ff5d5d", null);
  const friend = await openPlayer(url, "Bo", "#3d8bff", host.hello.roomCode);
  host.send({ type: "start" });

  const started = await host.waitFor((message) => message.type === "state" && message.players.length === 2);
  assert.equal(started.type, "state");
  if (started.type === "state") {
    assert.equal(started.levelName, "Both Pads");
    assert.equal(friend.messages.some((message) => message.type === "hello"), true);
  }

  host.ws.close();
  friend.ws.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function openPlayer(url: string, name: string, color: string, roomCode: string | null) {
  const ws = new WebSocket(url);
  const messages: ServerMessage[] = [];
  ws.on("message", (data) => {
    messages.push(JSON.parse(data.toString()) as ServerMessage);
  });
  return new Promise<{
    ws: WebSocket;
    hello: Extract<ServerMessage, { type: "hello" }>;
    messages: ServerMessage[];
    send: (message: object) => void;
    waitFor: (predicate: (message: ServerMessage) => boolean) => Promise<ServerMessage>;
  }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out connecting ${name}`)), 3000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "join", name, color, roomCode }));
    });
    const waitFor = (predicate: (message: ServerMessage) => boolean) =>
      new Promise<ServerMessage>((done, fail) => {
        const check = setInterval(() => {
          const found = messages.find(predicate);
          if (found) {
            clearInterval(check);
            done(found);
          }
        }, 20);
        setTimeout(() => {
          clearInterval(check);
          fail(new Error(`timed out waiting for ${name}`));
        }, 3000);
      });
    const poll = setInterval(() => {
      const hello = messages.find((message) => message.type === "hello");
      if (hello && hello.type === "hello") {
        clearInterval(poll);
        clearTimeout(timer);
        resolve({
          ws,
          hello,
          messages,
          send: (message) => ws.send(JSON.stringify(message)),
          waitFor,
        });
      }
    }, 20);
  });
}
