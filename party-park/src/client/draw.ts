import { LEVELS, PLAYER_HH, PLAYER_HW, type LevelDef } from "../shared/levels.ts";
import type { CrateSnap, PlayerSnap, StateMessage } from "../shared/protocol.ts";

export type Ghost = { x: number; y: number; angle: number };

export function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  levelIndex: number,
  state: StateMessage | null,
  ghosts: Map<string, Ghost>,
  time: number,
): void {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const view = camera(ctx.canvas, level);
  const sky = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  sky.addColorStop(0, "#7ec8ee");
  sky.addColorStop(1, "#d7f3c8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(view.ox, view.oy);
  ctx.scale(view.scale, view.scale);
  ctx.translate(0, level.height);
  ctx.scale(1, -1);

  drawHills(ctx, level, time);
  ctx.fillStyle = "#3d6f86";
  ctx.fillRect(-2, -2.2, level.width + 4, 2.2);
  ctx.fillStyle = "#7fd0d8";
  ctx.fillRect(-2, -0.35, level.width + 4, 0.45);

  for (const solid of level.solids) {
    if (solid.kind === "ground") drawGround(ctx, solid.x, solid.y, solid.hw, solid.hh);
    else if (solid.kind === "wall") drawWall(ctx, solid.x, solid.y, solid.hw, solid.hh);
    else drawBlock(ctx, solid.x, solid.y, solid.hw, solid.hh);
  }

  const pressed = new Map((state?.plates ?? []).map((plate) => [plate.id, plate.pressed]));
  for (const plate of level.plates) drawPlate(ctx, plate.x, plate.y, plate.hw, plate.hh, pressed.get(plate.id) ?? false);

  const open = new Map((state?.gates ?? []).map((gate) => [gate.id, gate.open]));
  for (const gate of level.gates) {
    const shown = open.get(gate.id) ?? false;
    if (gate.style === "stairs") {
      if (shown) drawStairs(ctx, gate.x, gate.y, gate.hw, gate.hh);
    } else {
      drawDoor(ctx, gate.x, gate.y, gate.hw, gate.hh, shown);
    }
  }

  drawExit(ctx, level.exit.x, level.exit.y, level.exit.hw, level.exit.hh, time);

  for (const crate of state?.crates ?? []) {
    const ghost = moveGhost(ghosts, `crate:${crate.id}`, crate.x, crate.y, crate.angle);
    drawCrate(ctx, ghost.x, ghost.y, 0.42, 0.42, ghost.angle);
  }

  for (const player of state?.players ?? []) {
    const ghost = moveGhost(ghosts, player.id, player.x, player.y, 0);
    drawPlayer(ctx, player, ghost, state?.tick ?? 0);
  }

  ctx.restore();
}

function camera(canvas: HTMLCanvasElement, level: LevelDef): { scale: number; ox: number; oy: number } {
  const pad = 0.8;
  const worldW = level.width + pad * 2;
  const worldH = level.height + pad * 2 + 1.2;
  const scale = Math.min(canvas.width / worldW, canvas.height / worldH);
  const ox = (canvas.width - level.width * scale) / 2;
  const oy = (canvas.height - (level.height + 0.4) * scale) / 2;
  return { scale, ox, oy };
}

function drawHills(ctx: CanvasRenderingContext2D, level: LevelDef, time: number): void {
  ctx.fillStyle = "#b7e38d";
  hill(ctx, 4 + Math.sin(time * 0.05), 1.2, 5, 2.2);
  hill(ctx, 16, 1.1, 7, 2.6);
  ctx.fillStyle = "#fff";
  const cloudX = ((time * 0.4) % (level.width + 6)) - 3;
  cloud(ctx, cloudX, 6.4);
  cloud(ctx, cloudX - 8, 6.9);
}

function hill(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 1.1, 0.45, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 0.8, y + 0.1, 0.8, 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number): void {
  ctx.fillStyle = "#8d5a3c";
  ctx.fillRect(x - hw, y - hh, hw * 2, hh * 2);
  ctx.fillStyle = "#67a83a";
  ctx.fillRect(x - hw, y + hh - 0.28, hw * 2, 0.28);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number): void {
  ctx.fillStyle = "#6e5437";
  ctx.fillRect(x - hw, y - hh, hw * 2, hh * 2);
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number): void {
  ctx.fillStyle = "#d7b07a";
  ctx.fillRect(x - hw, y - hh, hw * 2, hh * 2);
  ctx.strokeStyle = "#6e5437";
  ctx.lineWidth = 0.06;
  ctx.strokeRect(x - hw, y - hh, hw * 2, hh * 2);
  ctx.fillStyle = "#67a83a";
  ctx.fillRect(x - hw, y + hh - 0.22, hw * 2, 0.22);
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, pressed: boolean): void {
  ctx.fillStyle = pressed ? "#3dce7a" : "#efe6cf";
  roundRect(ctx, x - hw, y - hh * 0.45, hw * 2, hh, 0.12);
  ctx.fill();
  ctx.strokeStyle = "#2a2118";
  ctx.lineWidth = 0.05;
  ctx.stroke();
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, open: boolean): void {
  if (open) return;
  ctx.fillStyle = "#c46a3a";
  ctx.fillRect(x - hw, y - hh, hw * 2, hh * 2);
  ctx.fillStyle = "#8d4b28";
  ctx.fillRect(x - hw * 0.2, y - hh, hw * 0.18, hh * 2);
  ctx.beginPath();
  ctx.arc(x + hw * 0.45, y, Math.min(0.1, hw * 0.35), 0, Math.PI * 2);
  ctx.fillStyle = "#ffe08a";
  ctx.fill();
}

function drawStairs(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number): void {
  ctx.fillStyle = "#e0b15c";
  ctx.strokeStyle = "#6e5437";
  ctx.lineWidth = 0.05;
  const steps = 3;
  for (let i = 0; i < steps; i += 1) {
    const w = hw * 2 * ((steps - i) / steps);
    const h = (hh * 2) / steps;
    const left = x - hw;
    const bottom = y - hh + i * h;
    ctx.fillRect(left, bottom, w, h);
    ctx.strokeRect(left, bottom, w, h);
  }
}

function drawExit(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, time: number): void {
  const flagY = Math.max(0.2, y - hh + 0.15);
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.1;
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.ellipse(x, flagY, Math.min(hw, 1.3), 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#6e5437";
  ctx.fillRect(x - 0.04, flagY, 0.08, 1.15);
  ctx.fillStyle = "#ff5d5d";
  ctx.beginPath();
  ctx.moveTo(x + 0.04, flagY + 1.15);
  ctx.lineTo(x + 0.72, flagY + 0.82);
  ctx.lineTo(x + 0.04, flagY + 0.5);
  ctx.fill();
}

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#e0a15a";
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  ctx.strokeStyle = "#6e3b22";
  ctx.lineWidth = 0.06;
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  ctx.beginPath();
  ctx.moveTo(-hw, -hh);
  ctx.lineTo(hw, hh);
  ctx.moveTo(hw, -hh);
  ctx.lineTo(-hw, hh);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerSnap, ghost: Ghost, tick: number): void {
  const bob = Math.abs(player.vx) > 0.4 ? Math.sin(tick * 0.45 + ghost.x) * 0.04 : 0;
  ctx.save();
  ctx.translate(ghost.x, ghost.y + bob);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = "rgba(42, 33, 24, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, -PLAYER_HH + 0.05, 0.28, 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = player.color;
  roundRect(ctx, -PLAYER_HW, -PLAYER_HH, PLAYER_HW * 2, PLAYER_HH * 2, 0.18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0.05, 0.16, 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(-0.1, 0.16, 0.08, 0, Math.PI * 2);
  ctx.arc(0.1, 0.16, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2118";
  ctx.beginPath();
  ctx.arc(-0.07, 0.16, 0.035, 0, Math.PI * 2);
  ctx.arc(0.13, 0.16, 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.scale(1, -1);
  ctx.fillStyle = "#2a2118";
  ctx.font = "0.32px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(player.name, ghost.x, -(ghost.y + PLAYER_HH + 0.22));
  ctx.restore();
}

function moveGhost(ghosts: Map<string, Ghost>, id: string, x: number, y: number, angle: number): Ghost {
  const current = ghosts.get(id) ?? { x, y, angle };
  const far = Math.hypot(x - current.x, y - current.y) > 3;
  const next = far
    ? { x, y, angle }
    : {
        x: current.x + (x - current.x) * 0.45,
        y: current.y + (y - current.y) * 0.45,
        angle: current.angle + (angle - current.angle) * 0.45,
      };
  ghosts.set(id, next);
  return next;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function previewLevelIndex(state: StateMessage | null): number {
  return state?.levelIndex ?? 0;
}
