# ones-ai-workflow

ONES Hosted App，用于将可配置 Agent 嵌入工作项状态流转，并通过组织默认模型或外部 Agent Client 执行任务。

项目采用 `pnpm workspace`，包含：

- `apps/web`：React + Vite + TypeScript
- `apps/server`：Node.js + Hono Hosted App Server
- `apps/agent-client`：Codex、Claude 和 Hermes 轮询执行端
- `packages/shared`：前后端共享类型

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## 当前能力

- Workflow 按项目、工作项类型和触发状态轮询工作项，并在成功后确定性流转状态
- Agent 支持输入输出字段、Wiki 读写、知识源、Skill、验收标准和返工上下文
- 支持 Server 组织默认模型，以及指定 Codex、Claude 或 Hermes Agent Client
- Agent Client 支持多仓 Workspace、凭据注入、Skill 挂载、附件和执行日志
- 支持自动修正循环、预算控制、AI 评审、返工摘要和人工接管
- 支持 AI 创建 Skill、Prompt 推荐和基于历史样本的资产优化候选

Workspace Verification 和代码 Patch 已从运行时移除；Manifest 中相关 Entity 仅为历史升级兼容，不代表功能可用。

## Agent Client

`apps/agent-client` 消费 Server 下发的最终 Prompt，并按配置调用 Codex、Claude 或 Hermes。

核心行为：

- 周期性调用 `POST /api/agent-clients/exchange`
- 按 `availableSlots` 从 server 拉取任务
- 以可配置并发执行多个 Agent 任务
- 将 `running / success / failure` 报告回 server
- 保留未确认的终态报告并自动补报，避免网络故障造成任务结果丢失
- 使用任务领取令牌拒绝过期 Client 报告
- 固定任务创建时的 Workspace、仓库和 Skill 绑定

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

容器化部署参见 `apps/agent-client/README.deploy.md`。运行故障排查参见 `docs/runtime-troubleshooting.md`。

- `Dockerfile.agent-client`
- `docker-compose.agent-client.yml`

该镜像支持 `codex` 和 `claude` 两种执行后端：

- `codex`：当前实现通过 SDK 运行。默认使用 `CODEX_HOME/auth.json`；如需 API key 模式，需同时配置 `AGENT_CLIENT_CODEX_API_KEY` 和 `AGENT_CLIENT_CODEX_BASE_URL`
- `claude`：当前实现通过 SDK 调用本机 `claude` 可执行文件，因此镜像内已安装 Claude Code CLI
