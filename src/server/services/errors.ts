/**
 * Service-layer error taxonomy.
 *
 * Services throw these instead of returning ad-hoc shapes so the thin API route
 * handlers can map a thrown error to a correct HTTP status + a stable, caller-
 * actionable JSON body without leaking internals. `handleServiceError` in
 * `src/app/api/_lib/responses.ts` is the single translation point.
 */

export class ServiceError extends Error {
  /** HTTP status the API layer should return for this error. */
  readonly status: number;
  /** Stable machine-readable code the client can branch on. */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

/** Input failed a business rule (missing required field, bad reference, etc.). */
export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message, 400, 'validation_error');
  }
}

/** The requested resource does not exist. */
export class NotFoundError extends ServiceError {
  constructor(message = 'Not found') {
    super(message, 404, 'not_found');
  }
}

/** The write conflicts with existing state (e.g. slug already taken). */
export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(message, 409, 'conflict');
  }
}

/** The caller is not authenticated / not permitted. */
export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
  }
}
