# Getting Started (Complete Beginner Path)

This repo is set up so you can build and test on a **MacBook in Cursor**, even if you have never made a game before.

## What we picked for you

| Piece | Choice | Why |
|---|---|---|
| Game client | **Godot 4** | Free, lightweight, beginner-friendly |
| Backend | **TypeScript + Fastify** | Edited entirely in Cursor |
| Database | **Postgres + Redis** | Standard multiplayer backend stack |
| Testing | **Your Mac, localhost** | Two clients later; one client for now |

You are **not** building Minecraft-style creative mode. This is a social hub + co-op hunt slice.

---

## One-time Mac setup

Install these once:

1. **Godot 4.3+** — https://godotengine.org/download
2. **Node.js 20+** — https://nodejs.org
3. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
4. **Cursor** — you already have this

Optional later: Git (usually preinstalled on Mac).

---

## Day 1: run the project (about 15 minutes)

### 1. Clone/open this repo in Cursor

```bash
cd /path/to/game_development
```

### 2. Start the backend

```bash
chmod +x scripts/*.sh
./scripts/dev-up.sh
```

This starts Postgres + Redis, installs npm packages, runs migrations, and creates test users.

### 3. Start the API (keep this terminal open)

```bash
cd platform
npm run dev
```

You should see: `Platform API running at http://localhost:3000`

### 4. Smoke-test the API (optional)

In a new terminal:

```bash
./scripts/test-api.sh
```

### 5. Start the hub server (new terminal)

```bash
./scripts/run-hub-server.sh
```

Leave this running. It listens on port `7777` for players.

### 6. Start the hunt server (new terminal)

```bash
./scripts/run-hunt-server.sh
```

Leave this running. It listens on port `7800` for co-op hunts.

### 7. Open the game client

1. Open **Godot**
2. Import project → select `client/godot/project.godot`
3. Press **Play** (F5)
4. Login with:
   - Username: `alice`
   - Password: `test1234`

You should land in the 3D hub as a capsule avatar. Use **WASD** to move.

### 8. Test with a second player (same Mac)

1. In Godot: **Project → Export → Add → macOS** (one-time setup)
2. Export a debug build (or run a second Godot editor instance if you prefer)
3. Keep hub server + API running
4. Login as `bob` / `test1234` in the second client

You should see **both players** in the same hub, moving independently.

### 9. Co-op hunt (party required)

1. Press **Tab** → create a party → invite a friend (or test solo)
2. Everyone toggles **Ready**
3. Party leader clicks **Start Hunt**
4. In the arena: **WASD** move, **Space** attack the red boss
5. After victory you return to hub with **XP + loot**

Requires **four** terminals: API, hub server, hunt server, Godot.

---

## How you will work week to week

```text
Cursor (most days)          Godot (some days)
──────────────────          ─────────────────
platform/ API code          scenes + movement
scripts/                    animations
docs/                       playtesting
```

Rule of thumb:

- **Cursor** → accounts, friends, party, loot, servers, Docker
- **Godot** → walking around, combat, UI screens, boss fights

---

## Testing on one MacBook

### Right now (Week 2)

- Hub server + API + one or two Godot clients
- Login → hub → see other players move
- `alice` in one window, `bob` in another (editor + export build)

### Before friend playtests (Week 11–12)

- Deploy API to a small cloud server
- Send friends a Mac `.app` build

---

## Test accounts

| Username | Password |
|---|---|
| alice | test1234 |
| bob | test1234 |
| carol | test1234 |
| dave | test1234 |

---

## Project layout

```text
client/godot/     # Game you play (Godot)
platform/         # Backend API (TypeScript)
deploy/           # Docker services
scripts/          # dev-up, test helpers
docs/             # architecture + guides
```

---

## Common problems

### `docker: command not found`

Docker Desktop can be open while Terminal still cannot find `docker`. Try in order:

**A. Test Docker directly (paste in Terminal):**
```bash
/Applications/Docker.app/Contents/Resources/bin/docker --version
```

If that works, add this line to `~/.zshrc` (then run `source ~/.zshrc`):
```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
```

**B. Enable CLI in Docker Desktop:**
1. Open **Docker Desktop**
2. **Settings** (gear icon) → **General**
3. Look for options about command line tools / symlinks / PATH
4. Quit Docker Desktop fully, reopen it, open a **new** terminal

**C. Pull latest repo** — `scripts/dev-up.sh` now auto-detects Docker inside `Docker.app`.

**D. Still stuck?** In Docker Desktop → **Troubleshoot** → **Reset to factory defaults** (last resort).

### Godot login fails

1. Is `npm run dev` running in `platform/`?
2. Run `./scripts/test-api.sh`
3. Check Godot points to `http://127.0.0.1:3000` (default in `api_client.gd`)

### "Timed out connecting to hub"

1. Start the hub server: `./scripts/run-hub-server.sh`
2. Confirm port `7777` is not blocked
3. Restart hub server after API restarts

### Database connection error

```bash
./scripts/dev-down.sh
./scripts/dev-up.sh
```

### Pulled new code but graphics look the same

1. Confirm you pulled the **same folder** Godot opened:
   ```bash
   cd /path/to/game_development
   git log -1 --oneline
   ```
2. **Quit Godot completely** (Cmd+Q), then reopen `client/godot/project.godot`.
3. After login, look for: **`Build: hub-art-v1 (blue sky + trees)`** in the top-left.
4. If that text is missing, Godot is still using an old project copy.
5. Check Godot's **Output** panel (bottom) for red errors when you press F5.

---

## What gets built next

Follow the 12-week vertical slice plan in `docs/ARCHITECTURE.md`:

1. Week 1–2: movement + two players see each other
2. Week 3–4: login (done in scaffold) + join hub token
3. Week 5–6: friends + party
4. Week 7–8: hunt instance + boss
5. Week 9–12: loot, polish, friend playtest

You do not need to plan everything upfront. Each week ends with a 5-minute playtest on your Mac.
