import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  createSkillDownloadUrlPackage,
  createSkillRecord,
  getSkillManifest,
  getSkillSummaries,
  InvalidSkillPackageError,
  removeSkillRecord,
  SkillConflictError,
  SkillInUseError,
  SkillNotFoundError,
  uploadSkillVersionRecord,
  type UploadedSkillFile
} from './service.js';

export async function listSkillsHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getSkillSummaries(teamUUID)));
}

export async function getSkillsManifestHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getSkillManifest(teamUUID)));
}

export async function createSkillHandler(c: Context) {
  const formData = await c.req.formData().catch(() => null);

  if (!formData) {
    return c.json(failure('Invalid skill payload', 'skills.invalid_payload'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    const createdSkill = await createSkillRecord({
      files: extractUploadedFiles(formData)
    }, teamUUID);

    return c.json(success(createdSkill), 201);
  } catch (error) {
    if (error instanceof SkillConflictError) {
      return c.json(failure(error.message, 'skills.conflict'), 409);
    }

    if (error instanceof InvalidSkillPackageError) {
      return c.json(failure(error.message, 'skills.invalid_package_payload'), 400);
    }

    throw error;
  }
}

export async function uploadSkillVersionHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const formData = await c.req.formData().catch(() => null);

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  if (!formData) {
    return c.json(
      failure('Invalid skill package payload', 'skills.invalid_package_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(
        await uploadSkillVersionRecord(uuid, {
          files: extractUploadedFiles(formData)
        }, teamUUID)
      )
    );
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    if (error instanceof InvalidSkillPackageError) {
      return c.json(failure(error.message, 'skills.invalid_package_payload'), 400);
    }

    throw error;
  }
}

export async function downloadSkillHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    const downloadPackage = await createSkillDownloadUrlPackage(
      uuid,
      undefined,
      teamUUID
    );

    return c.redirect(downloadPackage.downloadUrl, 302);
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    if (error instanceof SkillInUseError) {
      return c.json(failure(error.message, 'skills.in_use'), 409);
    }

    throw error;
  }
}

export async function getSkillDownloadUrlHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await createSkillDownloadUrlPackage(uuid, undefined, teamUUID))
    );
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    if (error instanceof SkillInUseError) {
      return c.json(failure(error.message, 'skills.in_use'), 409);
    }

    throw error;
  }
}

export async function downloadSkillVersionHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const versionValue = c.req.param('version');
  const version = Number(versionValue);

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  if (!Number.isInteger(version) || version <= 0) {
    return c.json(
      failure('Skill version must be a positive integer', 'skills.version_invalid'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    const downloadPackage = await createSkillDownloadUrlPackage(
      uuid,
      version,
      teamUUID
    );

    return c.redirect(downloadPackage.downloadUrl, 302);
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    throw error;
  }
}

export async function getSkillVersionDownloadUrlHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const versionValue = c.req.param('version');
  const version = Number(versionValue);

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  if (!Number.isInteger(version) || version <= 0) {
    return c.json(
      failure('Skill version must be a positive integer', 'skills.version_invalid'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await createSkillDownloadUrlPackage(uuid, version, teamUUID))
    );
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    throw error;
  }
}

export async function deleteSkillHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(failure('Skill uuid is required', 'skills.uuid_required'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeSkillRecord(uuid, teamUUID);
    return c.json(success(true));
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message, 'skills.not_found'), 404);
    }

    if (error instanceof SkillInUseError) {
      return c.json(failure(error.message, 'skills.in_use'), 409);
    }

    throw error;
  }
}

function extractUploadedFiles(formData: FormData): UploadedSkillFile[] {
  const files = formData.getAll('files');
  const paths = formData.getAll('paths');

  if (files.length !== paths.length) {
    throw new InvalidSkillPackageError('Uploaded files and paths do not match');
  }

  return files.map((fileValue, index) => {
    if (!(fileValue instanceof File)) {
      throw new InvalidSkillPackageError('Invalid uploaded file');
    }

    const relativePath = String(paths[index] ?? '').trim();

    return {
      relativePath: relativePath || fileValue.name,
      file: fileValue
    };
  });
}
