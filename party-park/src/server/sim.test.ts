import assert from "node:assert/strict";
import { test } from "node:test";
import { COLORS } from "../shared/protocol.ts";
import { Room } from "./room.ts";

function seek(room: Room, id: string, targetX: number, jump = false): void {
  const pos = room.position(id);
  room.setInput(id, {
    left: pos.x > targetX + 0.12,
    right: pos.x < targetX - 0.12,
    jump,
  });
}

function frames(room: Room, count: number, control: () => void): void {
  for (let i = 0; i < count; i += 1) {
    control();
    room.tick();
  }
}

function until(room: Room, max: number, done: () => boolean, control: () => void): number {
  for (let i = 0; i < max; i += 1) {
    control();
    room.tick();
    if (done()) return i;
  }
  return -1;
}

test("two players clear both pads and reach the exit", () => {
  const room = new Room("PADS");
  const ada = room.addPlayer("Ada", COLORS[0]);
  const bo = room.addPlayer("Bo", COLORS[1]);
  assert.equal(room.start(ada), true);

  const opened = until(room, 400, () => room.gateOpen("gate"), () => {
    seek(room, ada, 6.2);
    seek(room, bo, 11.6);
  });
  assert.ok(opened >= 0, "door should unlock once both pads are held");

  const cleared = until(room, 500, () => room.snapshot(ada).cleared || room.snapshot(ada).levelIndex > 0, () => {
    seek(room, ada, 20.2);
    seek(room, bo, 20.2);
  });
  assert.ok(cleared >= 0, "level 1 should clear");
});

test("a solo player cannot open the first door", () => {
  const room = new Room("SOLO");
  const ada = room.addPlayer("Ada", COLORS[0]);
  room.start(ada);
  frames(room, 240, () => seek(room, ada, 6.2));
  frames(room, 240, () => seek(room, ada, 11.6));
  assert.equal(room.gateOpen("gate"), false);
  assert.equal(room.snapshot(ada).cleared, false);
});

test("jumping leaves the ground and players can stand on each other", () => {
  const room = new Room("MOVE");
  const ada = room.addPlayer("Ada", COLORS[0]);
  const bo = room.addPlayer("Bo", COLORS[1]);
  room.start(ada);
  frames(room, 40, () => room.setInput(ada, { left: false, right: false, jump: false }));
  const landed = room.position(ada).y;
  let peaked = landed;
  frames(room, 40, () => {
    room.setInput(ada, { left: false, right: false, jump: true });
    peaked = Math.max(peaked, room.position(ada).y);
  });
  assert.ok(peaked > landed + 1.2, `expected a real jump, peak ${peaked} from ${landed}`);

  frames(room, 30, () => {
    room.setInput(ada, { left: false, right: false, jump: false });
    room.setInput(bo, { left: false, right: false, jump: false });
  });
  frames(room, 90, () => {
    const a = room.position(ada);
    const b = room.position(bo);
    room.setInput(bo, { left: b.x > 6.05, right: b.x < 5.95, jump: false });
    room.setInput(ada, { left: a.x > 6.05, right: a.x < 5.95, jump: a.y < b.y + 0.7 });
  });
  assert.ok(room.position(ada).y > room.position(bo).y + 0.6);
});

test("the pit respawns you and the high ledge needs a boost", () => {
  const room = new Room("HIGH");
  const ada = room.addPlayer("Ada", COLORS[0]);
  const bo = room.addPlayer("Bo", COLORS[1]);
  room.start(ada, 1);

  let fell = false;
  for (let i = 0; i < 140; i += 1) {
    const before = room.position(ada).x;
    room.setInput(ada, { left: false, right: true, jump: false });
    room.setInput(bo, { left: false, right: false, jump: false });
    room.tick();
    if (room.position(ada).x < before - 1) fell = true;
  }
  assert.equal(fell, true, "walking into the pit should respawn");

  room.place(bo, 2, 0.6);
  room.place(ada, 14.2, 0.6);
  frames(room, 10, () => room.setInput(ada, { left: false, right: false, jump: false }));
  let soloLanded = false;
  frames(room, 60, () => {
    room.setInput(ada, { left: false, right: true, jump: true });
    const pos = room.position(ada);
    if (pos.y > 2.4 && pos.x > 16) soloLanded = true;
  });
  assert.equal(soloLanded, false, "a solo jump should not reach the ledge");

  room.place(bo, 14.1, 0.6);
  room.place(ada, 14.1, 1.6);
  frames(room, 8, () => {
    room.setInput(ada, { left: false, right: false, jump: false });
    room.setInput(bo, { left: false, right: false, jump: false });
  });
  const up = until(room, 70, () => room.position(ada).y > 2.45 && room.position(ada).x > 16.2, () => {
    room.setInput(bo, { left: false, right: false, jump: false });
    room.setInput(ada, { left: false, right: true, jump: true });
  });
  assert.ok(up >= 0, "jumping from a friend should reach the ledge");

  const hatch = until(room, 150, () => room.gateOpen("hatch"), () => {
    seek(room, ada, 17.6);
    seek(room, bo, 14);
  });
  assert.ok(hatch >= 0, "the pad should open the door");

  const through = until(room, 400, () => room.position(bo).x > 18, () => {
    seek(room, ada, 18.5);
    seek(room, bo, 19);
  });
  assert.ok(through >= 0, "the friend should walk through the opened door");

  const cleared = until(room, 300, () => room.snapshot(ada).cleared, () => {
    seek(room, ada, 19);
    seek(room, bo, 19.5);
  });
  assert.ok(cleared >= 0, "level 2 should clear");
});

test("the crate level needs one player on the pad and one pushing", () => {
  const room = new Room("CRATE");
  const ada = room.addPlayer("Ada", COLORS[0]);
  const bo = room.addPlayer("Bo", COLORS[1]);
  room.start(ada, 2);
  assert.equal(room.gateOpen("gate"), false);

  const gate = until(room, 300, () => room.gateOpen("gate"), () => {
    seek(room, ada, 1.8);
    seek(room, bo, 6);
  });
  assert.ok(gate >= 0);

  const door = until(room, 800, () => room.gateOpen("exit-door"), () => {
    seek(room, ada, 1.8);
    seek(room, bo, 16);
  });
  assert.ok(door >= 0, "the crate should open the exit");
  assert.equal(room.gateOpen("gate"), true, "the first gate stays open after the switch");

  const cleared = until(room, 700, () => room.snapshot(ada).cleared, () => {
    seek(room, ada, 21.1);
    seek(room, bo, 21.1);
  });
  assert.ok(cleared >= 0, "both players should reach the exit");
});
