#!/bin/sh
set -eu

mkdir -p "${AGENT_CLIENT_WORKING_ROOT:-/data}"
mkdir -p "${CODEX_HOME:-/codex}"
mkdir -p "${CLAUDE_CONFIG_DIR:-/claude}"

if [ -z "${AGENT_CLIENT_CODEX_API_KEY:-}" ] \
  && [ -z "${AGENT_CLIENT_CODEX_BASE_URL:-}" ] \
  && [ ! -f "${CODEX_HOME:-/codex}/auth.json" ]; then
  echo "[agent-client] warning: ${CODEX_HOME:-/codex}/auth.json not found and AGENT_CLIENT_CODEX_API_KEY/AGENT_CLIENT_CODEX_BASE_URL are not set; codex tasks will be deferred until a valid Codex login is mounted." >&2
fi

if [ ! -f "${CLAUDE_CONFIG_DIR:-/claude}/.credentials.json" ] \
  && [ -z "${ANTHROPIC_API_KEY:-}" ] \
  && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ] \
  && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "[agent-client] warning: ${CLAUDE_CONFIG_DIR:-/claude}/.credentials.json not found; claude tasks will require login before use." >&2
fi

exec "$@"
