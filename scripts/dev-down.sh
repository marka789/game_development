#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/resolve-docker.sh
source "$ROOT_DIR/scripts/lib/resolve-docker.sh"
require_docker

docker compose -f deploy/docker-compose.yml down
echo "Stopped local Postgres and Redis."
