import {
  Box,
  Vec2,
  World,
  type Body,
  type Fixture,
} from "planck";
import {
  COYOTE,
  GRAVITY,
  JUMP_BUFFER,
  JUMP_SPEED,
  LEVELS,
  MOVE_SPEED,
  PLAYER_HH,
  PLAYER_HW,
  STEP,
  type GateDef,
  type LevelDef,
} from "../shared/levels.ts";
import type {
  CrateSnap,
  GateSnap,
  InputState,
  LobbyMessage,
  PlateSnap,
  PlayerSnap,
  StateMessage,
} from "../shared/protocol.ts";

const IDLE_INPUT: InputState = { left: false, right: false, jump: false };
const INPUT_TTL_MS = 280;
const CLEAR_FRAMES = 24;
const CELEBRATE_FRAMES = 90;

type Tag =
  | { kind: "player"; id: string }
  | { kind: "plate"; id: string }
  | { kind: "crate"; id: string }
  | { kind: "solid" }
  | { kind: "gate"; id: string };

type Player = {
  id: string;
  name: string;
  color: string;
  input: InputState;
  prevJump: boolean;
  coyote: number;
  jumpBuffer: number;
  facing: 1 | -1;
  spawnIndex: number;
  lastInputAt: number;
  body: Body | null;
};

type GateRuntime = {
  def: GateDef;
  body: Body;
  latched: boolean;
  open: boolean;
};

type CrateRuntime = {
  id: string;
  body: Body;
};

export class Room {
  readonly code: string;
  hostId: string | null = null;
  inGame = false;
  levelIndex = 0;
  won = false;
  tickCount = 0;
  cleared = false;

  private readonly players = new Map<string, Player>();
  private world: World | null = null;
  private gates: GateRuntime[] = [];
  private crates: CrateRuntime[] = [];
  private platePressed = new Map<string, boolean>();
  private clearHold = 0;
  private celebrate = 0;
  private nextSpawn = 0;

  constructor(code: string) {
    this.code = code;
  }

  get playerCount(): number {
    return this.players.size;
  }

  addPlayer(name: string, color: string): string {
    const id = makeId();
    const player: Player = {
      id,
      name,
      color,
      input: { ...IDLE_INPUT },
      prevJump: false,
      coyote: 0,
      jumpBuffer: 0,
      facing: 1,
      spawnIndex: this.nextSpawn,
      lastInputAt: 0,
      body: null,
    };
    this.nextSpawn += 1;
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    if (this.world) this.spawnPlayerBody(player);
    return id;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    if (player.body && this.world) this.world.destroyBody(player.body);
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = this.players.keys().next().value ?? null;
    }
  }

  setInput(id: string, input: InputState): void {
    const player = this.players.get(id);
    if (!player) return;
    player.input = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      jump: Boolean(input.jump),
    };
    player.lastInputAt = Date.now();
  }

  place(id: string, x: number, y: number): void {
    const body = this.players.get(id)?.body;
    if (!body) return;
    body.setTransform(Vec2(x, y), 0);
    body.setLinearVelocity(Vec2(0, 0));
    body.setAwake(true);
  }

  position(id: string): { x: number; y: number } {
    const body = this.players.get(id)?.body;
    if (!body) return { x: 0, y: 0 };
    const pos = body.getPosition();
    return { x: pos.x, y: pos.y };
  }

  gateOpen(id: string): boolean {
    return this.gates.find((gate) => gate.def.id === id)?.open ?? false;
  }

  start(requesterId: string, levelIndex = 0): boolean {
    if (this.inGame || requesterId !== this.hostId) return false;
    this.levelIndex = levelIndex;
    this.won = false;
    this.inGame = true;
    this.build();
    return true;
  }

  restart(requesterId: string): boolean {
    if (!this.inGame || requesterId !== this.hostId) return false;
    if (this.won) this.levelIndex = 0;
    this.won = false;
    this.build();
    return true;
  }

  tick(): void {
    if (!this.inGame || !this.world || this.won) return;
    const world = this.world;
    const level = this.level();

    for (const player of this.players.values()) {
      if (!player.body) continue;
      this.applyInput(player);
    }

    world.step(STEP, 8, 3);
    this.tickCount += 1;

    const platePlayers = new Map<string, Set<string>>();
    const plateCrates = new Map<string, Set<string>>();
    for (let contact = world.getContactList(); contact; contact = contact.getNext()) {
      if (!contact.isTouching()) continue;
      const tags = [contact.getFixtureA().getUserData(), contact.getFixtureB().getUserData()];
      const plate = tags.find((tag) => isTag(tag) && tag.kind === "plate") as Tag | undefined;
      const person = tags.find((tag) => isTag(tag) && tag.kind === "player") as Tag | undefined;
      const crate = tags.find((tag) => isTag(tag) && tag.kind === "crate") as Tag | undefined;
      if (plate?.kind === "plate" && person?.kind === "player") {
        const set = platePlayers.get(plate.id) ?? new Set<string>();
        set.add(person.id);
        platePlayers.set(plate.id, set);
      }
      if (plate?.kind === "plate" && crate?.kind === "crate") {
        const set = plateCrates.get(plate.id) ?? new Set<string>();
        set.add(crate.id);
        plateCrates.set(plate.id, set);
      }
    }

    this.platePressed.clear();
    for (const plate of level.plates) {
      const people = platePlayers.get(plate.id)?.size ?? 0;
      const boxes = plateCrates.get(plate.id)?.size ?? 0;
      this.platePressed.set(plate.id, people + boxes > 0);
    }

    for (const gate of this.gates) {
      gate.open = this.evaluateGate(gate, platePlayers, plateCrates);
      if (gate.def.style === "door") gate.body.setActive(!gate.open);
      else gate.body.setActive(gate.open);
    }

    for (const player of this.players.values()) {
      const body = player.body;
      if (!body) continue;
      const pos = body.getPosition();
      const inPit = pos.y < level.pitY || level.pits.some((pit) => contains(pit, pos.x, pos.y));
      if (inPit) {
        const spawn = level.spawns[player.spawnIndex % level.spawns.length];
        body.setTransform(Vec2(spawn.x, spawn.y), 0);
        body.setLinearVelocity(Vec2(0, 0));
        body.setAwake(true);
      }
    }

    if (this.cleared) {
      this.celebrate += 1;
      if (this.celebrate === CELEBRATE_FRAMES) {
        if (this.levelIndex < LEVELS.length - 1) {
          this.levelIndex += 1;
          this.build();
        } else {
          this.won = true;
        }
      }
      return;
    }

    const living = [...this.players.values()].filter((player) => player.body);
    const allInExit =
      living.length > 0 &&
      living.every((player) => {
        const pos = player.body!.getPosition();
        return contains(level.exit, pos.x, pos.y);
      });
    this.clearHold = allInExit ? this.clearHold + 1 : 0;
    if (this.clearHold >= CLEAR_FRAMES) {
      this.cleared = true;
      this.celebrate = 0;
    }
  }

  lobby(you: string): LobbyMessage {
    return {
      type: "lobby",
      roomCode: this.code,
      hostId: this.hostId ?? "",
      inGame: this.inGame,
      you,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        color: player.color,
      })),
    };
  }

  snapshot(you: string): StateMessage {
    const level = this.level();
    const players: PlayerSnap[] = [];
    for (const player of this.players.values()) {
      const pos = player.body?.getPosition();
      const vel = player.body?.getLinearVelocity();
      players.push({
        id: player.id,
        name: player.name,
        color: player.color,
        x: pos?.x ?? level.spawns[0].x,
        y: pos?.y ?? level.spawns[0].y,
        vx: vel?.x ?? 0,
        vy: vel?.y ?? 0,
        facing: player.facing,
      });
    }
    const crates: CrateSnap[] = this.crates.map((crate) => {
      const pos = crate.body.getPosition();
      return { id: crate.id, x: pos.x, y: pos.y, angle: crate.body.getAngle() };
    });
    const plates: PlateSnap[] = level.plates.map((plate) => ({
      id: plate.id,
      pressed: this.platePressed.get(plate.id) ?? false,
    }));
    const gates: GateSnap[] = this.gates.map((gate) => ({ id: gate.def.id, open: gate.open }));
    return {
      type: "state",
      tick: this.tickCount,
      levelIndex: this.levelIndex,
      levelName: level.name,
      hint: level.hint,
      cleared: this.cleared,
      won: this.won,
      you,
      hostId: this.hostId ?? "",
      players,
      crates,
      plates,
      gates,
    };
  }

  private level(): LevelDef {
    return LEVELS[this.levelIndex] ?? LEVELS[0];
  }

  private build(): void {
    const level = this.level();
    this.world = new World({ gravity: Vec2(0, GRAVITY) });
    for (const player of this.players.values()) player.body = null;
    this.gates = [];
    this.crates = [];
    this.platePressed = new Map(level.plates.map((plate) => [plate.id, false]));
    this.cleared = false;
    this.clearHold = 0;
    this.celebrate = 0;
    this.tickCount = 0;

    for (const solid of level.solids) {
      const body = this.world.createBody({ type: "static", position: Vec2(solid.x, solid.y) });
      body.createFixture(Box(solid.hw, solid.hh), {
        friction: solid.kind === "ground" ? 0.9 : 0.05,
        userData: { kind: "solid" } satisfies Tag,
      });
    }

    for (const plate of level.plates) {
      const body = this.world.createBody({ type: "static", position: Vec2(plate.x, plate.y) });
      body.createFixture(Box(plate.hw, plate.hh), {
        isSensor: true,
        userData: { kind: "plate", id: plate.id } satisfies Tag,
      });
    }

    for (const gateDef of level.gates) {
      const body = this.world.createBody({ type: "static", position: Vec2(gateDef.x, gateDef.y) });
      body.createFixture(Box(gateDef.hw, gateDef.hh), {
        friction: 0.05,
        userData: { kind: "gate", id: gateDef.id } satisfies Tag,
      });
      const open = false;
      body.setActive(gateDef.style === "door");
      this.gates.push({ def: gateDef, body, latched: false, open });
    }

    for (const crate of level.crates) {
      const body = this.world.createDynamicBody({
        position: Vec2(crate.x, crate.y),
        fixedRotation: true,
        linearDamping: 1,
        allowSleep: false,
      });
      body.createFixture(Box(crate.hw, crate.hh), {
        density: 1.6,
        friction: 0.75,
        userData: { kind: "crate", id: crate.id } satisfies Tag,
      });
      this.crates.push({ id: crate.id, body });
    }

    for (const player of this.players.values()) {
      player.prevJump = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      this.spawnPlayerBody(player);
    }
  }

  private spawnPlayerBody(player: Player): void {
    if (!this.world) return;
    if (player.body) this.world.destroyBody(player.body);
    const level = this.level();
    const spawn = level.spawns[player.spawnIndex % level.spawns.length];
    const body = this.world.createDynamicBody({
      position: Vec2(spawn.x, spawn.y),
      fixedRotation: true,
      allowSleep: false,
    });
    body.createFixture(Box(PLAYER_HW, PLAYER_HH), {
      density: 1,
      friction: 0.1,
      restitution: 0,
      userData: { kind: "player", id: player.id } satisfies Tag,
    });
    player.body = body;
  }

  private applyInput(player: Player): void {
    const body = player.body;
    if (!body) return;
    const fresh = Date.now() - player.lastInputAt <= INPUT_TTL_MS;
    const input = fresh ? player.input : IDLE_INPUT;
    const ground = this.groundUnder(body);
    if (ground) player.coyote = COYOTE;
    else player.coyote = Math.max(0, player.coyote - STEP);

    const jumpPressed = input.jump && !player.prevJump;
    const jumpReleased = !input.jump && player.prevJump;
    player.prevJump = input.jump;
    if (jumpPressed) player.jumpBuffer = JUMP_BUFFER;
    else player.jumpBuffer = Math.max(0, player.jumpBuffer - STEP);

    const velocity = body.getLinearVelocity();
    let vx = velocity.x;
    if (input.left && !input.right) vx = -MOVE_SPEED;
    else if (input.right && !input.left) vx = MOVE_SPEED;
    else vx *= 0.72;

    let vy = velocity.y;
    if (player.jumpBuffer > 0 && player.coyote > 0) {
      vy = ground === "player" ? JUMP_SPEED + 3.4 : JUMP_SPEED;
      player.jumpBuffer = 0;
      player.coyote = 0;
    } else if (jumpReleased && vy > 0) {
      vy *= 0.45;
    }
    if (vy < -18) vy = -18;

    if (vx < -0.4) player.facing = -1;
    else if (vx > 0.4) player.facing = 1;

    body.setLinearVelocity(Vec2(vx, vy));
  }

  private groundUnder(body: Body): "player" | "world" | null {
    if (!this.world) return null;
    const pos = body.getPosition();
    let kind: "player" | "world" | null = null;
    for (const ox of [-0.2, 0.2]) {
      this.world.rayCast(
        Vec2(pos.x + ox, pos.y - PLAYER_HH + 0.04),
        Vec2(pos.x + ox, pos.y - PLAYER_HH - 0.12),
        (fixture: Fixture) => {
          if (fixture.getBody() === body) return -1;
          if (fixture.isSensor()) return -1;
          const data = fixture.getUserData();
          if (isTag(data) && data.kind === "gate" && !fixture.getBody().isActive()) return -1;
          kind = isTag(data) && data.kind === "player" ? "player" : "world";
          return 0;
        },
      );
      if (kind === "player") return kind;
    }
    return kind;
  }

  private evaluateGate(
    gate: GateRuntime,
    platePlayers: Map<string, Set<string>>,
    plateCrates: Map<string, Set<string>>,
  ): boolean {
    const people = (id: string) => platePlayers.get(id)?.size ?? 0;
    const boxes = (id: string) => plateCrates.get(id)?.size ?? 0;
    const rule = gate.def.rule;
    if (rule.kind === "both-plates") {
      if (rule.plates.every((id) => people(id) > 0)) gate.latched = true;
      return gate.latched;
    }
    if (rule.kind === "plate-hold") return people(rule.plate) > 0;
    if (rule.kind === "plate-latch") {
      if (people(rule.plate) > 0) gate.latched = true;
      return gate.latched;
    }
    if (rule.kind === "hold-until-crate") {
      if (boxes(rule.until) > 0) gate.latched = true;
      return gate.latched || people(rule.plate) > 0;
    }
    if (boxes(rule.plate) > 0) gate.latched = true;
    return gate.latched;
  }
}

function contains(rect: { x: number; y: number; hw: number; hh: number }, x: number, y: number): boolean {
  return Math.abs(x - rect.x) <= rect.hw && Math.abs(y - rect.y) <= rect.hh;
}

function isTag(value: unknown): value is Tag {
  return Boolean(value && typeof value === "object" && "kind" in value);
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
