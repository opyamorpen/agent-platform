# Runtime Troubleshooting

## Task remains running

Check the Agent Client connection and execution log. A task without a heartbeat for `AGENT_TASK_STALE_AFTER_MS` is recovered for a new claim when no ONES write-back has started. If write-back may already have started, the task is blocked to prevent duplicate business data.

## Terminal report is not accepted

The Client keeps the local task until the Server confirms the report. Network, rate-limit and server errors are retried. A `stale_task_claim` response means another claim replaced this Client lease. A `report_conflict` response means the Server already accepted different terminal content; retain the local report for diagnosis.

## Write-back outcome is unknown

`writeback_state_unknown` means the Server lost certainty after starting ONES writes. Do not blindly retry the same output. Check the work item fields, comments, attachments and Wiki target, then use the existing manual retry only after resolving duplicate-risk data.

## Workflow node configuration is invalid

The Workflow page marks malformed or unsupported node binding data. The Poller skips that node. Open the node editor, reselect the required values and save it to write the current versioned format.

## Historical storage declarations

Workspace Verification, Workspace Patch, shadow replay and experience-related Entities may remain in `opkx.json` because ONES upgrades do not allow removing previously declared Entities. Their presence does not mean those runtime capabilities are enabled.
