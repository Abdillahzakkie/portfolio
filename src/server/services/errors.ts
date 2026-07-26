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

/**
 * The write conflicts with existing state (e.g. slug already taken, or a delete
 * blocked by referencing rows). `details` carries an optional structured payload
 * (e.g. `{ code: 'linked_posts', count: n }`) the route can surface to the client
 * WITHOUT the generic `handleApiError` path changing for plain conflicts.
 */
export class ConflictError extends ServiceError {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'conflict');
    this.details = details;
  }
}

/** The caller is not authenticated / not permitted. */
export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
  }
}
