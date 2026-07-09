import { env } from '../../config/env.js';
import { listInstallationSecrets } from '../../lib/app-auth.js';
import { getLogger } from '../../lib/logger.js';
import { listWorkflowTeamUUIDs } from '../workflows/repository.js';
import { pollWorkflowIssueExecutionsOnce } from './service.js';

let isRunning = false;
let timer: NodeJS.Timeout | null = null;
const logger = getLogger('workflow-execution.poller');

function isHostedRuntime(): boolean {
  return Boolean(env.ONES_HOSTED_APP_ID);
}

async function runPollCycle() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const enabledInstallations = await listInstallationSecrets({
      status: 'enabled'
    });

    if (enabledInstallations.length === 0 && isHostedRuntime()) {
      return;
    }

    const teamUUIDs = await listWorkflowTeamUUIDs();

    logger.info('[workflow-execution] poll cycle started', {
      teamCount: teamUUIDs.length,
      teamUUIDs
    });

    for (const teamUUID of teamUUIDs) {
      logger.info('[workflow-execution] polling team workflows', {
        teamUUID
      });
      await pollWorkflowIssueExecutionsOnce(teamUUID);
    }
  } catch (error) {
    logger.error('[workflow-execution] poll cycle failed', error);
  } finally {
    isRunning = false;
  }
}

export function startWorkflowExecutionPoller() {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    void runPollCycle();
  }, env.WORKFLOW_POLL_INTERVAL_MS);

  void runPollCycle();
}
