import type { ApiError, ApiSuccess } from '@ones-ai-workflow/shared';

export function success<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data
  };
}

export function failure(message: string, code?: string): ApiError {
  return {
    success: false,
    message,
    code
  };
}
