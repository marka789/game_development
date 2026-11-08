export const STEP = 1 / 60;
export const GRAVITY = -34;
export const MOVE_SPEED = 5.6;
export const JUMP_SPEED = 11.6;
export const COYOTE = 0.12;
export const JUMP_BUFFER = 0.12;
export const PLAYER_HW = 0.32;
export const PLAYER_HH = 0.46;

export type Rect = {
  x: number;
  y: number;
  hw: number;
  hh: number;
};

export type SolidDef = Rect & {
  kind: "ground" | "wall" | "block";
};

export type PlateDef = Rect & {
  id: string;
};

export type GateRule =
  | { kind: "both-plates"; plates: string[] }
  | { kind: "plate-hold"; plate: string }
  | { kind: "plate-latch"; plate: string }
  | { kind: "crate-on"; plate: string }
  | { kind: "hold-until-crate"; plate: string; until: string };

export type GateDef = Rect & {
  id: string;
  style: "door" | "stairs";
  rule: GateRule;
};

export type CrateDef = Rect & {
  id: string;
};

export type LevelDef = {
  name: string;
  hint: string;
  width: number;
  height: number;
  pitY: number;
  pits: Rect[];
  spawns: { x: number; y: number }[];
  solids: SolidDef[];
  plates: PlateDef[];
  gates: GateDef[];
  crates: CrateDef[];
  exit: Rect;
};

const shell = (width: number): SolidDef[] => [
  { kind: "ground", x: width / 2, y: -0.5, hw: width / 2 + 1, hh: 0.5 },
  { kind: "wall", x: -0.45, y: 4, hw: 0.45, hh: 4.6 },
  { kind: "wall", x: width + 0.45, y: 4, hw: 0.45, hh: 4.6 },
  { kind: "wall", x: width / 2, y: 8.45, hw: width / 2 + 1, hh: 0.45 },
];

export const LEVELS: LevelDef[] = [
  {
    name: "Both Pads",
    hint: "Stand on both pads at the same time. Then everyone goes through the door.",
    width: 24,
    height: 8,
    pitY: -0.2,
    pits: [],
    spawns: [
      { x: 1.7, y: 2 },
      { x: 3.1, y: 2 },
      { x: 2.3, y: 2.8 },
      { x: 3.8, y: 2 },
    ],
    solids: shell(24),
    plates: [
      { id: "left", x: 6.2, y: 0.3, hw: 0.9, hh: 0.34 },
      { id: "right", x: 11.6, y: 0.3, hw: 0.9, hh: 0.34 },
    ],
    gates: [
      {
        id: "gate",
        style: "door",
        x: 16.2,
        y: 4,
        hw: 0.28,
        hh: 4,
        rule: { kind: "both-plates", plates: ["left", "right"] },
      },
    ],
    crates: [],
    exit: { x: 20.2, y: 2.1, hw: 3.2, hh: 2.1 },
  },
  {
    name: "Too High",
    hint: "One jump is not enough. Boost a friend up. Their pad opens the door underneath.",
    width: 24,
    height: 8,
    pitY: -0.2,
    pits: [{ x: 8.7, y: -0.7, hw: 0.55, hh: 1.2 }],
    spawns: [
      { x: 1.8, y: 2 },
      { x: 3.3, y: 2 },
      { x: 2.4, y: 2.8 },
      { x: 4, y: 2 },
    ],
    solids: [
      { kind: "ground", x: 4, y: -0.5, hw: 4, hh: 0.5 },
      { kind: "ground", x: 16.65, y: -0.5, hw: 7.35, hh: 0.5 },
      { kind: "block", x: 19.3, y: 1.85, hw: 3.7, hh: 0.4 },
      { kind: "wall", x: -0.45, y: 4, hw: 0.45, hh: 4.6 },
      { kind: "wall", x: 24.45, y: 4, hw: 0.45, hh: 4.6 },
      { kind: "wall", x: 12, y: 8.45, hw: 13, hh: 0.45 },
    ],
    plates: [{ id: "high", x: 17.6, y: 2.52, hw: 0.65, hh: 0.26 }],
    gates: [
      {
        id: "hatch",
        style: "door",
        x: 16.35,
        y: 0.7,
        hw: 0.28,
        hh: 0.7,
        rule: { kind: "plate-latch", plate: "high" },
      },
    ],
    crates: [],
    exit: { x: 19.6, y: 2.4, hw: 3.1, hh: 2.5 },
  },
  {
    name: "Crate",
    hint: "Stand on the high pad to open the gate. A friend pushes the crate through, onto the switch.",
    width: 24,
    height: 8,
    pitY: -0.2,
    pits: [],
    spawns: [
      { x: 4.3, y: 2 },
      { x: 5.4, y: 2 },
      { x: 4.8, y: 2.8 },
      { x: 5.9, y: 2.8 },
    ],
    solids: shell(24),
    plates: [
      { id: "hold", x: 1.8, y: 0.3, hw: 0.8, hh: 0.34 },
      { id: "switch", x: 14.6, y: 0.32, hw: 0.95, hh: 0.36 },
    ],
    gates: [
      {
        id: "gate",
        style: "door",
        x: 8.1,
        y: 4,
        hw: 0.28,
        hh: 4,
        rule: { kind: "hold-until-crate", plate: "hold", until: "switch" },
      },
      {
        id: "exit-door",
        style: "door",
        x: 18.1,
        y: 4,
        hw: 0.28,
        hh: 4,
        rule: { kind: "crate-on", plate: "switch" },
      },
    ],
    crates: [{ id: "box", x: 10.5, y: 1.1, hw: 0.42, hh: 0.42 }],
    exit: { x: 21.1, y: 2.1, hw: 2.3, hh: 2.1 },
  },
];
