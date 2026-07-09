# Agent Client Deployment

This document describes two deployment patterns for `agent-client`:

- `pm2` on a single host
- Docker container images for one-click runtime startup

## Deployment Model

Use:

- one shared code release directory
- one `pm2` app per agent-client instance
- one isolated `AGENT_CLIENT_WORKING_ROOT` per instance

Each instance keeps its own runtime state under `AGENT_CLIENT_WORKING_ROOT`,
including:

- `auth.json`
- `task-store/`
- `tasks/`
- `source-workspaces/`
- `skills/`

As long as each process uses a different `AGENT_CLIENT_WORKING_ROOT`, the
instances stay isolated even when they run on the same machine.

## Container Model

Use:

- one container per `agent-client` instance
- one persistent `/data` volume per instance for runtime state
- one persistent `/codex` volume per instance for Codex login state
- one persistent `/claude` volume per instance for Claude login state

Recommended directory layout on the Docker host:

```text
runtime/
  agent-client-01/
    data/
    codex/
    claude/
```

`/data` stores the agent-client runtime state, including:

- `auth.json`
- `task-store/`
- `tasks/`
- `source-workspaces/`
- `skills/`

`/codex` stores Codex local state such as `auth.json`. When
`AGENT_CLIENT_DEFAULT_AGENT=codex`, the scheduler uses `${CODEX_HOME}/auth.json`
unless API key mode is configured. API key mode requires both
`AGENT_CLIENT_CODEX_API_KEY` and `AGENT_CLIENT_CODEX_BASE_URL`; when both are set,
Codex tasks skip `CODEX_HOME` availability checks.

`/claude` stores Claude Code state. On Linux, Claude Code stores credentials in
`${CLAUDE_CONFIG_DIR}/.credentials.json`.

## Required Configuration

The current agent-client supports these environment variables:

- `AGENT_CLIENT_UUID`
- `AGENT_CLIENT_NAME`
- `AGENT_CLIENT_VERSION`
- `AGENT_CLIENT_SERVER_BASE_URL`
- `AGENT_CLIENT_CONCURRENCY`
- `AGENT_CLIENT_WORKING_ROOT`
- `AGENT_CLIENT_LOG_LEVEL`
- `AGENT_CLIENT_CODEX_HOMES`
- `AGENT_CLIENT_CODEX_API_KEY`
- `AGENT_CLIENT_CODEX_BASE_URL`
- `AGENT_CLIENT_CODEX_MODEL`
- `AGENT_CLIENT_CODEX_REASONING_EFFORT`

The following directories are derived automatically from
`AGENT_CLIENT_WORKING_ROOT`:

- `source-workspaces/`
- `skills/`

`AGENT_CLIENT_CODEX_HOMES` accepts a comma-separated list of Codex home
directories. Relative paths are resolved from the current user's home
directory, so values like `.codex-a,.codex-b` are valid.

To run Codex with a single API key instead of a mounted Codex login, configure
both values:

```bash
AGENT_CLIENT_DEFAULT_AGENT=codex
AGENT_CLIENT_CODEX_API_KEY=sk-...
AGENT_CLIENT_CODEX_BASE_URL=https://api.openai.com/v1
AGENT_CLIENT_CODEX_MODEL=gpt-5.4
AGENT_CLIENT_CODEX_REASONING_EFFORT=high
```

`AGENT_CLIENT_CODEX_API_KEY` and `AGENT_CLIENT_CODEX_BASE_URL` must be set
together. Setting only one of them is treated as a configuration error at
startup.

`AGENT_CLIENT_CODEX_MODEL` defaults to `gpt-5.4`.
`AGENT_CLIENT_CODEX_REASONING_EFFORT` defaults to `high`; supported values are
`minimal`, `low`, `medium`, `high`, and `xhigh`.

For container deployments, also set:

- `CODEX_HOME`
- `CLAUDE_CONFIG_DIR`

## Recommended Directory Layout

```text
/opt/ones-ai-workflow/
  current/
    apps/agent-client/
      dist/
      package.json
  instances/
    agent-client-a/
      data/
    agent-client-b/
      data/
```

## Build

From the repository root:

```bash
pnpm --filter @ones-ai-workflow/agent-client build
```

The container build is split into two images:

- `Dockerfile.agent-client-base`: slow-changing runtime base image
- `Dockerfile.agent-client`: frequently rebuilt application image

The base image includes:

- Node.js runtime
- `git`, `ssh`, `tar`, `ripgrep`, `jq`, `procps`, `zip`, `unzip`, `file`, `rsync`, `less`, `fd`, and `python3`
- Eclipse Temurin JDK 8 for Java compile checks and test execution
- `claude-code` CLI from Anthropic's official Debian repository

Build the `linux/amd64` base image when the runtime dependencies change:

```bash
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  -f Dockerfile.agent-client-base \
  -t img.ones.pro/dev/xl/agent-client-base:node22-bookworm-jdk8 \
  --push \
  .
```

Build the `linux/amd64` application image for each agent-client release:

```bash
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  -f Dockerfile.agent-client \
  --build-arg AGENT_CLIENT_BASE_IMAGE=img.ones.pro/dev/xl/agent-client-base:node22-bookworm-jdk8 \
  -t img.ones.pro/dev/xl/agent-client:v0.1.2 \
  --push \
  .
```

For a local-only build, replace `--push` with `--load`.

The final application image includes the built `@ones-ai-workflow/shared` and
`@ones-ai-workflow/agent-client` packages on top of the selected base image.

To inspect the built image platform:

```bash
docker image inspect img.ones.pro/dev/xl/agent-client:v0.1.2 \
  --format '{{.Os}}/{{.Architecture}}'
```

On Apple Silicon with Colima, make sure Colima is running and build with
`--platform linux/amd64`. If you build and reuse the base image locally, keep
`--provenance=false` so Docker's local image store can resolve the base image
consistently.

## PM2 Setup

1. Install `pm2` on the target machine:

```bash
npm install -g pm2
```

2. Copy `ecosystem.config.example.cjs` and adjust:

- app names
- `AGENT_CLIENT_UUID`
- `AGENT_CLIENT_NAME`
- `AGENT_CLIENT_SERVER_BASE_URL`
- `AGENT_CLIENT_WORKING_ROOT`

3. Start all instances:

```bash
pm2 start apps/agent-client/ecosystem.config.example.cjs
```

Useful commands:

```bash
pm2 ls
pm2 logs agent-client-a
pm2 restart agent-client-a
pm2 stop agent-client-b
pm2 delete agent-client-b
```

## Startup on Boot

After the processes are running as expected:

```bash
pm2 startup
pm2 save
```

`pm2 startup` prints the machine-specific command required to register the
startup agent. Run that command once, then run `pm2 save`.

## Docker Compose Setup

The repository includes a standalone example at
`docker-compose.agent-client.yml`.

1. Prepare persistent directories:

```bash
mkdir -p runtime/agent-client-01/{data,codex,claude}
```

2. Put the required login state into the mounted volumes:

- Codex: mount a valid `auth.json` under `runtime/agent-client-01/codex/`
- Claude: mount a valid `.credentials.json` under
  `runtime/agent-client-01/claude/`

3. Start the container:

```bash
docker compose -f docker-compose.agent-client.yml up -d --build
# or
docker-compose -f docker-compose.agent-client.yml up -d --build
```

4. Check logs:

```bash
docker compose -f docker-compose.agent-client.yml logs -f agent-client
# or
docker-compose -f docker-compose.agent-client.yml logs -f agent-client
```

Notes:

- `AGENT_CLIENT_UUID` must be stable and unique per container.
- `AGENT_CLIENT_SERVER_BASE_URL` should point to the server as reachable from
  inside Docker. The example uses `http://host.docker.internal:3001`.
- `AGENT_CLIENT_DEFAULT_AGENT` may be `codex` or `claude`.
- `AGENT_CLIENT_CONCURRENCY=1` is still the safest default.
- If you want multiple Codex profiles, mount multiple directories and set
  `AGENT_CLIENT_CODEX_HOMES` to absolute container paths such as
  `/codex-a,/codex-b`.
- The image uses Anthropic's official `stable` APT channel for Claude Code
  installation and disables background auto-update so image contents stay
  predictable.

## K3s Example

The repository includes a minimal K3s example deployment for the Claude
backend at:

- `apps/agent-client/agent-client.k3s.example.yaml`

This example:

- creates the fixed namespace `xl`
- runs exactly one replica
- persists `/data` and `/codex` with `hostPath`
- uses an `initContainer` to create and `chown` mounted directories for uid/gid `1000`
- sets `ANTHROPIC_BASE_URL` statically in the pod spec
- assumes Claude authentication is injected at task runtime via workspace
  credentials rather than storing `ANTHROPIC_AUTH_TOKEN` in the pod spec

## Notes

- Do not use `pm2` cluster mode for this service.
- Keep `AGENT_CLIENT_UUID` unique per instance.
- Keep `AGENT_CLIENT_WORKING_ROOT` unique per instance.
- `AGENT_CLIENT_CONCURRENCY=1` is the safest default.
- `pm2` environment variables override values loaded from the repository `.env`
  file, so production instances can be configured entirely from the ecosystem
  file.
