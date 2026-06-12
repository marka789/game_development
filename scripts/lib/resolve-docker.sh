#!/usr/bin/env bash
# Finds Docker CLI on macOS when Docker Desktop is installed but not on PATH.

resolve_docker_bin() {
  if command -v docker >/dev/null 2>&1; then
    printf '%s\n' "$(command -v docker)"
    return 0
  fi

  local candidates=(
    "/usr/local/bin/docker"
    "/opt/homebrew/bin/docker"
    "/Applications/Docker.app/Contents/Resources/bin/docker"
    "$HOME/.docker/bin/docker"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

export_docker_path() {
  local docker_bin
  docker_bin="$(resolve_docker_bin)" || return 1
  export PATH="$(dirname "$docker_bin"):$PATH"
  if [ -d "/Applications/Docker.app/Contents/Resources/cli-plugins" ]; then
    export DOCKER_CLI_PLUGIN_EXTRA_DIRS="/Applications/Docker.app/Contents/Resources/cli-plugins"
  fi
  return 0
}

require_docker() {
  if export_docker_path; then
    return 0
  fi

  cat <<'EOF' >&2
Docker CLI not found.

Docker Desktop may be open, but the terminal cannot find the "docker" command.

Try these fixes on Mac:
  1) Docker Desktop → Settings → General → enable command line tools / symlinks
  2) Restart Docker Desktop, then open a new terminal
  3) Run manually:
       /Applications/Docker.app/Contents/Resources/bin/docker --version

If that works, add to ~/.zshrc:
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

Or re-run this script after pulling the latest repo (it auto-detects Docker.app).
EOF
  return 1
}
