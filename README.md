# Social Hunt Slice

A beginner-friendly multiplayer game vertical slice:

**login → social hub → party with friends → co-op hunt → loot/XP → back to hub**

Inspired by social hangout games + co-op hunts + light RPG progression — **without** Minecraft-style creative building.

## Stack

- **Godot 4** — game client
- **TypeScript + Fastify** — platform API (auth, friends, party, progression)
- **Postgres + Redis** — data and presence
- **Docker** — local Mac development

## Quick start (Mac)

```bash
chmod +x scripts/*.sh
./scripts/dev-up.sh

# terminal 2
cd platform && npm run dev

# terminal 3
./scripts/run-hub-server.sh

# Godot: open client/godot/project.godot and press Play
# login: alice / test1234
```

Full beginner guide: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

Architecture + 12-week plan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Repo layout

```text
client/godot/   # Game project (open in Godot)
platform/       # Backend API (edit in Cursor)
deploy/         # docker-compose for Postgres/Redis
scripts/        # dev-up, test-api
docs/           # guides
```

## Current status

Scaffold only — Week 0:

- [x] Platform API with auth, friends, party, hunt reward stubs
- [x] Dockerized Postgres + Redis
- [x] Godot login screen → join hub flow
- [x] Multiplayer movement in hub (ENet + dedicated hub server)
- [x] Friends + party UI in hub (Tab to open social panel)
- [x] Basic hub graphics (sky, trees, rocks, plaza, hunt board, lantern lights)
- [x] Co-op hunt instance with boss fight, XP/loot, return to hub
- [ ] Hunt instance + boss (Week 7–8)
