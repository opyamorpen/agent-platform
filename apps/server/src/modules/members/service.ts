import type { AppMember } from '@ones-ai-workflow/shared';
import {
  addAppMember,
  deleteAppMember,
  findAppMemberByUserUUID,
  listAppMembers
} from './repository.js';

export class AppMemberConflictError extends Error {
  constructor(userUUID: string) {
    super(`成员已存在: ${userUUID}`);
    this.name = 'AppMemberConflictError';
  }
}

export class AppMemberNotFoundError extends Error {
  constructor(userUUID: string) {
    super(`成员不存在: ${userUUID}`);
    this.name = 'AppMemberNotFoundError';
  }
}

function toAppMember(record: Awaited<ReturnType<typeof addAppMember>>): AppMember {
  return {
    userUUID: record.userUUID,
    name: record.name,
    email: record.email,
    staffID: record.staffID,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function getAppMemberSummaries(teamUUID: string): Promise<AppMember[]> {
  const records = await listAppMembers(teamUUID);
  return records.map(toAppMember);
}

export async function createAppMember(input: {
  teamUUID: string;
  userUUID: string;
  name: string;
  email?: string | null;
  staffID?: string | null;
  createdBy: string;
}): Promise<AppMember> {
  const existing = await findAppMemberByUserUUID(input.teamUUID, input.userUUID);

  if (existing) {
    throw new AppMemberConflictError(input.userUUID);
  }

  return toAppMember(
    await addAppMember({
      teamUUID: input.teamUUID,
      userUUID: input.userUUID,
      name: input.name.trim(),
      email: input.email ?? null,
      staffID: input.staffID ?? null,
      createdBy: input.createdBy
    })
  );
}

export async function removeAppMember(
  teamUUID: string,
  userUUID: string
): Promise<void> {
  const existing = await findAppMemberByUserUUID(teamUUID, userUUID);

  if (!existing) {
    throw new AppMemberNotFoundError(userUUID);
  }

  await deleteAppMember(teamUUID, userUUID);
}
