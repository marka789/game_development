# Architecture — Multiplayer Vertical Slice

## Goal

Prove this loop on your Mac:

> Login → meet friends in hub → party up → co-op hunt → loot/XP → back to hub

## Stack

- **Godot 4** client (`client/godot/`)
- **TypeScript API** (`platform/`)
- **Postgres** player data
- **Redis** online presence
- **Docker Compose** local dev (`deploy/docker-compose.yml`)

## Services

```text
Godot Client
    |  HTTPS (login, friends, party, loot)
    v
Platform API :3000
    |          |
    v          v
 Postgres    Redis

Godot Hub Server :7777        (Week 4+)
Godot Hunt Server :7800       (Week 7+)
```

## API routes (current scaffold)

| Route | Purpose |
|---|---|
| `POST /auth/register` | Create account |
| `POST /auth/login` | Login |
| `GET /me` | Profile, level, XP |
| `GET /friends` | Friends list + online status |
| `POST /friends/request` | Add friend |
| `POST /friends/accept` | Accept friend |
| `GET /party` | Current party |
| `POST /party/create` | Create party |
| `POST /party/invite` | Invite by username |
| `POST /party/leave` | Leave party |
| `POST /party/ready` | Ready toggle |
| `POST /world/join-hub` | Hub connection info + join token |
| `POST /world/validate-hub-join` | Hub server validates join tokens |
| `POST /party/start-hunt` | Start hunt instance |
| `POST /hunt/complete` | Grant XP + loot |

## 12-week backlog

| Week | Milestone |
|---|---|
| 1–2 | Repo + movement + net spike |
| 3–4 | Auth + join hub (auth scaffold done) |
| 5–6 | Friends + party in hub |
| 7–8 | Hunt instance + boss v1 |
| 9–10 | XP, loot, full loop |
| 11–12 | Deploy + friend playtest |

## Design rules

1. **Server authoritative** for combat and rewards
2. **Hub ≠ hunt** — separate processes/scenes
3. **Personal loot** in the slice (simpler than shared rolls)
4. **No voxel building** — catalog housing comes later
5. **Idempotent hunt completion** — no duplicate rewards

See conversation history for detailed sequence diagrams and data models.
