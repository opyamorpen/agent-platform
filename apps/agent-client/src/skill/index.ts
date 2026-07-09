import type { AgentClientTask } from '@ones-ai-workflow/shared';

export interface MountSkillsInput {
  taskUUID: string;
  skillUUIDs: string[];
}

export interface Skill {
  ensureSkills(task: AgentClientTask): Promise<void>;
  mountSkills(input: MountSkillsInput): Promise<void>;
}

export { SkillService } from './service.js';

export type {
  SkillServiceDependencies,
  SkillServiceOptions
} from './service.js';
