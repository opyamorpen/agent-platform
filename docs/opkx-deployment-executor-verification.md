# ONES OPKX 部署执行器验证指南

本文用于指导 Agent 判断 ONES Hosted App 是否真正完成安装或升级。不能只依据页面提示、单条成功日志或执行器已经结束来下结论，必须同时核对执行器终态、安装记录和运行状态。

## 1. 验证目标

一次完整的 OPKX 部署验证需要回答三个问题：

1. 平台是否成功完成了安装或升级任务？
2. 平台当前记录的 App 版本是否等于 OPKX 目标版本？
3. 新版本 Runtime 是否健康，关键业务功能是否可用？

只有三个问题都得到肯定答案，才能声明插件真正完成安装或升级。

## 2. 执行器提供的信息

部署执行器详情包含以下关键字段：

| 字段 | 含义 | 成功要求 |
| --- | --- | --- |
| `executor_id` | 本次部署任务标识 | 必须与待验证执行器一致 |
| `task_type` | `CREATE` 或 `UPDATE` | 必须符合本次安装或升级动作 |
| `app_id` | App 标识 | 必须与 OPKX 中的 App ID 一致 |
| `prev_app_version` | 升级前版本 | 升级时应与部署前安装记录一致 |
| `app_version` | 本次目标版本 | 必须与 OPKX 版本一致 |
| `status` | 执行器状态 | 必须为 `DONE` |
| `result` | 执行结果 | 必须为 `SUCCESS` |
| `log_data` | 分阶段执行日志 | 不得包含回滚或未处理错误 |

注意：`status` 表示执行器是否结束，不等于部署是否成功。例如 `DONE_ROLLBACK / FAILED` 表示任务已经结束，但部署失败并已回滚。

## 3. 标准验证流程

### 3.1 确认 OPKX 身份

上传和解析 OPKX 后，记录：

- App ID
- App 名称
- 目标版本
- OPKX ID

App ID 与预期目标不一致时，必须停止部署。目标版本与当前版本相同时，除非用户明确授权，不得使用强制重部署。

### 3.2 确认部署前状态

部署前查询安装记录，保存：

- 当前版本
- `enabled` 或 `disabled` 状态
- 安装记录 ID

升级完成后要使用同一组字段进行对比，不能只看执行器日志。

### 3.3 检查存储声明

执行器日志应出现类似内容：

```text
Apply storage configuration for <app-id> (<version>) ... successfully.
```

这只表示 Entity 和 Object Storage 声明已经应用，不代表 Runtime 已完成升级。

### 3.4 检查 Runtime 部署过程

正常状态通常依次为：

```text
PENDING -> RUNNING -> DONE
```

成功升级通常包含：

```text
App upgrade successfully.
Update completed.
```

安装场景使用对应的安装成功日志。日志中出现 `Timeout`、`failed`、`Rollback started` 或 `Rollback completed` 时，不能声明成功。

### 3.5 检查执行器终态

成功必须同时满足：

```text
status = DONE
result = SUCCESS
```

以下状态均不得判定为成功：

| 状态 | 结论 |
| --- | --- |
| `PENDING` | 尚未开始或等待调度，继续轮询 |
| `RUNNING` | 正在执行，继续轮询 |
| `DONE / SUCCESS` | 执行器层面成功，继续反查安装记录 |
| `DONE / FAILED` | 部署失败 |
| `DONE_ROLLBACK / FAILED` | 部署失败且已回滚 |
| `CANCELLED` | 部署被取消 |
| 轮询超时 | 状态未知，查询执行器详情和安装记录后再判断 |

### 3.6 反查安装记录

执行器成功后必须重新查询平台安装记录，并确认：

- `app_id` 与目标 App 一致。
- `app_version` 等于 OPKX 目标版本。
- 原有 `enabled` 或 `disabled` 状态得到保留。
- 不存在仍在运行的并发部署任务。

如果执行器显示成功，但安装记录仍是旧版本，必须视为验证失败，不得以执行器日志覆盖平台当前事实。

### 3.7 验证 Runtime 和业务功能

最后检查：

- `/health_check` 返回 HTTP `200`。
- Runtime 日志没有启动失败、存储初始化失败或持续异常。
- 插件页面可以加载。
- 本次版本修改涉及的 API 和关键业务路径能够正常使用。

执行器成功只证明平台部署流程完成，不证明业务功能一定正确。因此业务验证是正式发布验收的一部分。

## 4. 推荐命令

使用当前 ONES CLI OAuth 会话确认环境：

```bash
ones whoami
```

查询当前安装记录：

```bash
node /Users/bobibo/.codex/skills/ones-opkx-deploy/scripts/deploy-opkx.mjs \
  --status app_onesaiworkflow01
```

部署并轮询执行器：

```bash
node /Users/bobibo/.codex/skills/ones-opkx-deploy/scripts/deploy-opkx.mjs \
  --file /absolute/path/to/app-version.opkx \
  --poll-timeout-ms 600000
```

查看 Runtime 日志：

```bash
ones app logs --from-opkx-json --tail 50
```

部署脚本会在执行器结束后再次读取安装记录，并校验安装版本是否等于 OPKX 版本。执行器 `result` 不是 `SUCCESS` 或安装版本不匹配时，脚本会以失败退出。

## 5. 实例：exec_gb4xgbda

执行器 `exec_gb4xgbda` 的实际结果：

| 检查项 | 结果 |
| --- | --- |
| 执行器 | `exec_gb4xgbda` |
| App | `app_onesaiworkflow01` |
| 任务类型 | `UPDATE` |
| 原版本 | `v0.4.9` |
| 目标版本 | `v0.4.10` |
| 存储声明 | 应用成功 |
| Runtime 日志 | `App upgrade successfully.` |
| 最终日志 | `Update completed.` |
| 执行器状态 | `DONE` |
| 执行结果 | `SUCCESS` |
| 当前安装版本 | `v0.4.10` |
| 当前 App 状态 | `enabled` |

结论：`exec_gb4xgbda` 可以证明 `app_onesaiworkflow01` 已从 `v0.4.9` 成功升级到 `v0.4.10`。它不能作为 `v0.4.11` 已安装的证据；每个版本必须使用对应执行器和当前安装记录单独验证。

## 6. Agent 判定规则

Agent 在输出部署结论时必须使用以下规则：

```text
OPKX 解析成功
+ 存储声明应用成功
+ 执行器 status=DONE
+ 执行器 result=SUCCESS
+ 当前安装记录版本=OPKX目标版本
+ App启用状态符合部署前状态
+ 健康检查与关键业务验证通过
= 插件真正完成安装或升级
```

如果任一关键证据缺失，应输出“尚未完成验证”而不是“升级成功”。

## 7. 失败处理边界

- 执行器失败后不要立即自动重试，先读取完整日志和当前安装记录。
- `DONE_ROLLBACK` 表示平台已回滚，不得继续验证新版本业务功能。
- 非幂等安装或升级操作不得在状态未知时重复提交。
- 安装记录仍为旧版本时，应明确报告环境未升级。
- Runtime 健康但业务功能失败时，应报告“部署成功、业务验收失败”，不能混为平台部署失败。
- 不得在文档、日志或回复中记录 OAuth Token、Cookie、预签名上传参数、密钥或密码。

## 8. 建议输出模板

```text
环境：<ONES URL>
App：<app-id>
执行器：<executor-id>
部署类型：<CREATE|UPDATE>
版本变化：<old-version> -> <new-version>
执行器终态：<status> / <result>
安装记录：<installed-version> / <enabled-status>
Runtime 健康检查：<passed|failed|not-verified>
业务验证：<passed|failed|not-verified>
最终结论：<升级成功|升级失败并回滚|尚未完成验证>
```
