# ones-ai-workflow

基于 `pnpm workspace` 的前后端脚手架，包含：

- `apps/web`：React + Vite + TypeScript
- `apps/server`：Node.js + Hono + Prisma
- `apps/agent-client`：基于 `codex exec` 的轮询执行端
- `packages/shared`：前后端共享类型

## 快速开始

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm dev
```

## 当前状态

- 已搭好前后端基础目录、路由、页面骨架和接口契约
- 未接入真实 ONES API
- 已有一个最小 `agent-client` 骨架：轮询 `exchange`、按并发执行 `codex exec`、回报任务状态
- 前端预留了 `ones-design` 接入边界，待确认实际包名后可直接替换

## Agent Client

`apps/agent-client` 是当前的最小执行端实现。它不再维护本地 worker / handler 抽象，而是直接消费 server 下发的最终 prompt，并用 `codex exec` 执行。

核心行为：

- 周期性调用 `POST /api/agent-clients/exchange`
- 按 `availableSlots` 从 server 拉取任务
- 以可配置并发执行多个 `codex exec`
- 将 `running / success / failure` 报告回 server
- 使用 `CODEX_HOME_PROFILES` 为并发任务分配独立登录态，并用锁文件避免复用

常用环境变量：

- `AGENT_CLIENT_UUID`：client 唯一标识；默认 `<hostname>-agent-client`
- `AGENT_CLIENT_NAME`：client 展示名称
- `AGENT_CLIENT_SERVER_BASE_URL`：server 地址，默认 `http://127.0.0.1:3001`
- `AGENT_CLIENT_POLL_INTERVAL_MS`：轮询间隔，默认 `5000`
- `AGENT_CLIENT_CONCURRENCY`：期望并发数，默认 `1`
- `AGENT_CLIENT_WORKING_ROOT`：本地工作目录，默认仓库根目录下 `.agent-client`
- `AGENT_CLIENT_SOURCE_REPOS_ROOT`：多仓源码根目录，默认 `.agent-client/source-repos`
- `AGENT_CLIENT_SKILLS_ROOT`：本地 skill 缓存根目录，默认 `.agent-client/skills`
- `AGENT_CLIENT_SKILLS_SYNC_INTERVAL_MS`：skill manifest 同步间隔，默认 `60000`
- `CODEX_HOME_PROFILES`：多个已登录的 `CODEX_HOME` 目录，支持逗号 / 分号 / 换行分隔或 JSON 数组
- `AGENT_CLIENT_CODEX_MODEL`：Codex 使用的模型，默认 `gpt-5.4`
- `AGENT_CLIENT_CODEX_REASONING_EFFORT`：Codex 推理强度，默认 `high`

说明：

- 若未配置 `CODEX_HOME_PROFILES`，当前实现会将有效并发限制为 `1`
- client 会独立轮询同步所有 skills 的当前版本，并缓存在 `.agent-client/skills/store/`
- 每次任务 workspace 会挂载 `./.agents/skills/` 和 `./.agents/skills-manifest.json`，供 Codex 按官方 skills 目录约定自动发现本地已同步 skills
- 每个任务会在 `.agent-client/tasks/<taskUUID>/` 下写入 `prompt.md`、`task.json`，并在 `workspace/` 下创建多仓临时 worktree
- 每个任务的执行日志会写到 `.agent-client/logs/<taskUUID>.log`
- `AGENT_CLIENT_SOURCE_REPOS_ROOT` 下一级目录必须是独立 git repo；任务结束后会自动移除对应 worktree

启动方式：

```bash
pnpm install
pnpm dev:server
pnpm dev:agent-client
```

容器化部署可参考 [apps/agent-client/README.deploy.md](/Users/liwei/code/ones-ai-workflow/apps/agent-client/README.deploy.md:1) 里的 Docker 方案。仓库已提供：

- `Dockerfile.agent-client`
- `docker-compose.agent-client.yml`

该镜像支持 `codex` 和 `claude` 两种执行后端：

- `codex`：当前实现通过 SDK 运行。默认使用 `CODEX_HOME/auth.json`；如需 API key 模式，需同时配置 `AGENT_CLIENT_CODEX_API_KEY` 和 `AGENT_CLIENT_CODEX_BASE_URL`
- `claude`：当前实现通过 SDK 调用本机 `claude` 可执行文件，因此镜像内已安装 Claude Code CLI
