import { drawWorld, fitCanvas, type Ghost } from "./draw.ts";
import { COLORS, type LobbyMessage, type ServerMessage, type StateMessage } from "../shared/protocol.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const menu = document.querySelector<HTMLFormElement>("#menu")!;
const lobby = document.querySelector<HTMLElement>("#lobby")!;
const topbar = document.querySelector<HTMLElement>("#topbar")!;
const banner = document.querySelector<HTMLElement>("#banner")!;
const nameInput = document.querySelector<HTMLInputElement>("#name")!;
const codeInput = document.querySelector<HTMLInputElement>("#code")!;
const menuError = document.querySelector<HTMLElement>("#menu-error")!;
const colorRow = document.querySelector<HTMLElement>("#colors")!;
const levelName = document.querySelector<HTMLElement>("#level-name")!;
const roomPill = document.querySelector<HTMLElement>("#room-pill")!;
const hint = document.querySelector<HTMLElement>("#hint")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy")!;
const startButton = document.querySelector<HTMLButtonElement>("#start")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart")!;
const lobbyCode = document.querySelector<HTMLElement>("#lobby-code")!;
const lobbyStatus = document.querySelector<HTMLElement>("#lobby-status")!;
const playerList = document.querySelector<HTMLElement>("#player-list")!;
const lobbyCopy = document.querySelector<HTMLButtonElement>("#lobby-copy")!;
const lobbyStart = document.querySelector<HTMLButtonElement>("#lobby-start")!;

const params = new URLSearchParams(location.search);
if (params.get("room")) codeInput.value = params.get("room")!.toUpperCase();

let color = COLORS[Math.floor(Math.random() * COLORS.length)];
for (const swatch of COLORS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "swatch";
  button.style.background = swatch;
  button.setAttribute("aria-label", swatch);
  button.addEventListener("click", () => {
    color = swatch;
    paintSwatches();
  });
  colorRow.append(button);
}
paintSwatches();

const keys = new Set<string>();
let socket: WebSocket | null = null;
let helloId = "";
let hostId = "";
let roomCode = "";
let lobbyState: LobbyMessage | null = null;
let gameState: StateMessage | null = null;
const ghosts = new Map<string, Ghost>();
let levelIndex = 0;

window.addEventListener("keydown", (event) => {
  if (isTyping(event.target)) return;
  keys.add(event.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", () => fitCanvas(canvas));
fitCanvas(canvas);

menu.addEventListener("submit", (event) => {
  event.preventDefault();
  connect(null);
});
document.querySelector<HTMLButtonElement>("#join")!.addEventListener("click", () => joinFromCode());
codeInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  joinFromCode();
});
copyButton.addEventListener("click", () => copyLink());
lobbyCopy.addEventListener("click", () => copyLink());
startButton.addEventListener("click", () => send({ type: "start" }));
lobbyStart.addEventListener("click", () => send({ type: "start" }));
restartButton.addEventListener("click", () => send({ type: "restart" }));

setInterval(sendInput, 50);
requestAnimationFrame(frame);

function paintSwatches(): void {
  for (const button of colorRow.querySelectorAll<HTMLButtonElement>(".swatch")) {
    button.classList.toggle("selected", button.style.background === hexToRgb(color) || button.getAttribute("aria-label") === color);
  }
}

function joinFromCode(): void {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length < 4) {
    menuError.textContent = "Enter the 4-character room code.";
    return;
  }
  connect(code);
}

function connect(room: string | null): void {
  menuError.textContent = "";
  socket?.close();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener("open", () => {
    send({ type: "join", name: nameInput.value, color, roomCode: room });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (message.type === "error") {
      menuError.textContent = message.message;
      menu.hidden = false;
      lobby.hidden = true;
      return;
    }
    if (message.type === "hello") {
      helloId = message.playerId;
      hostId = message.hostId;
      roomCode = message.roomCode;
      const url = new URL(location.href);
      url.searchParams.set("room", roomCode);
      history.replaceState(null, "", url);
      menu.hidden = true;
      return;
    }
    if (message.type === "lobby") {
      lobbyState = message;
      hostId = message.hostId;
      gameState = message.inGame ? gameState : null;
      renderChrome();
      return;
    }
    gameState = message;
    hostId = message.hostId;
    if (message.levelIndex !== levelIndex) ghosts.clear();
    levelIndex = message.levelIndex;
    renderChrome();
    drawWorld(ctx, levelIndex, gameState, ghosts, performance.now() / 1000);
  });
  socket.addEventListener("close", () => {
    if (!roomCode) return;
    menu.hidden = false;
    lobby.hidden = true;
    topbar.hidden = true;
    menuError.textContent = "Disconnected. Refresh to rejoin.";
  });
}

function renderChrome(): void {
  const inGame = Boolean(gameState);
  menu.hidden = true;
  lobby.hidden = inGame;
  topbar.hidden = !inGame;
  const youHost = hostId === helloId;
  if (lobbyState && !inGame) {
    lobbyCode.textContent = lobbyState.roomCode;
    playerList.replaceChildren(
      ...lobbyState.players.map((player) => {
        const item = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = player.color;
        item.append(dot, document.createTextNode(player.name + (player.id === hostId ? " · host" : "")));
        return item;
      }),
    );
    lobbyStart.hidden = !youHost;
    lobbyStatus.textContent = youHost
      ? "Send the invite link, then start when everyone is here."
      : "Waiting for the host to start.";
  }
  if (gameState) {
    levelName.textContent = gameState.won ? "All clear" : gameState.levelName;
    roomPill.textContent = roomCode;
    hint.textContent = gameState.hint;
    startButton.hidden = true;
    restartButton.hidden = !youHost;
    banner.hidden = !(gameState.cleared || gameState.won);
    banner.textContent = gameState.won ? "You made it through all three." : "Level clear";
  } else {
    banner.hidden = true;
  }
}

function sendInput(): void {
  if (!gameState || !socket || socket.readyState !== WebSocket.OPEN) return;
  send({
    type: "input",
    left: keys.has("ArrowLeft") || keys.has("KeyA"),
    right: keys.has("ArrowRight") || keys.has("KeyD"),
    jump: keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space"),
  });
}

function send(message: object): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

async function copyLink(): Promise<void> {
  const url = new URL(location.href);
  url.searchParams.set("room", roomCode);
  const text = url.toString();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt("Copy this invite link", text);
  }
}

function frame(time: number): void {
  if (gameState) levelIndex = gameState.levelIndex;
  drawWorld(ctx, levelIndex, gameState, ghosts, time / 1000);
  requestAnimationFrame(frame);
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
