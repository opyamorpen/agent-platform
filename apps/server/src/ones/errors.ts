export class OnesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnesConfigError';
  }
}

export class OnesRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'OnesRequestError';
  }
}

export class OnesResponseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'OnesResponseError';
  }
}

export class OnesAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnesAuthError';
  }
}
