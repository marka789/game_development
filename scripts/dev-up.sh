#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/resolve-docker.sh
source "$ROOT_DIR/scripts/lib/resolve-docker.sh"
require_docker

echo "==> Starting Postgres + Redis (Docker)"
docker compose -f deploy/docker-compose.yml up -d

echo "==> Waiting for Postgres..."
until docker compose -f deploy/docker-compose.yml exec -T postgres pg_isready -U game -d game_dev >/dev/null 2>&1; do
  sleep 1
done

if [ ! -f platform/.env ]; then
  echo "==> Creating platform/.env from example"
  cp platform/.env.example platform/.env
fi

echo "==> Installing platform dependencies"
cd platform
npm install

echo "==> Running migrations + seed users"
npm run db:migrate
npm run db:seed

echo ""
echo "Dev environment is ready."
echo ""
echo "Next steps (three terminals):"
echo "  1) API:         cd platform && npm run dev"
echo "  2) Hub server:  ./scripts/run-hub-server.sh"
echo "  3) Godot client: open client/godot in Godot 4.3+ and press Play"
echo ""
echo "Test logins:"
echo "  alice / test1234"
echo "  bob   / test1234"
