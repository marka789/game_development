#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT_DIR/client/godot"
PORT="${HUNT_PORT:-7800}"

if [ -d "/Applications/Godot.app" ]; then
  GODOT_BIN="/Applications/Godot.app/Contents/MacOS/Godot"
elif command -v godot4 >/dev/null 2>&1; then
  GODOT_BIN="godot4"
elif command -v godot >/dev/null 2>&1; then
  GODOT_BIN="godot"
else
  echo "Godot not found. Install Godot 4 and/or set GODOT_BIN."
  exit 1
fi

echo "Starting hunt server on port $PORT"
echo "Requires platform API at http://127.0.0.1:3000 for join token validation"
echo ""

exec "$GODOT_BIN" --headless --path "$PROJECT_DIR" res://scenes/hunt/hunt.tscn -- --hunt-server
