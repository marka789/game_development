export const COLORS = ["#ff5d5d", "#3d8bff", "#ffc44d", "#3dce7a", "#b57bff"] as const;

export type PlayerColor = (typeof COLORS)[number];

export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
};

export type ClientMessage =
  | { type: "join"; name: string; color: string; roomCode: string | null }
  | { type: "input"; left: boolean; right: boolean; jump: boolean }
  | { type: "start" }
  | { type: "restart" };

export type LobbyPlayer = {
  id: string;
  name: string;
  color: string;
};

export type PlayerSnap = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
};

export type CrateSnap = {
  id: string;
  x: number;
  y: number;
  angle: number;
};

export type PlateSnap = {
  id: string;
  pressed: boolean;
};

export type GateSnap = {
  id: string;
  open: boolean;
};

export type HelloMessage = {
  type: "hello";
  playerId: string;
  roomCode: string;
  hostId: string;
};

export type LobbyMessage = {
  type: "lobby";
  roomCode: string;
  hostId: string;
  inGame: boolean;
  you: string;
  players: LobbyPlayer[];
};

export type StateMessage = {
  type: "state";
  tick: number;
  levelIndex: number;
  levelName: string;
  hint: string;
  cleared: boolean;
  won: boolean;
  you: string;
  hostId: string;
  players: PlayerSnap[];
  crates: CrateSnap[];
  plates: PlateSnap[];
  gates: GateSnap[];
};

export type ServerMessage =
  | HelloMessage
  | LobbyMessage
  | StateMessage
  | { type: "error"; message: string };

export function isPlayerColor(value: string): value is PlayerColor {
  return (COLORS as readonly string[]).includes(value);
}

export function cleanName(value: string): string {
  const name = value.replace(/[^\p{L}\p{N} _.'-]/gu, "").trim().slice(0, 16);
  return name.length > 0 ? name : "Player";
}
