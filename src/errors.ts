/**
 * Error type thrown by every {@link MalvoClient} call on a non-2xx response
 * (after auth/rate-limit retries are exhausted) or on a network failure.
 *
 * Mirrors the API error envelope `{ code, message, codeDescription, data,
 * requestId }`. Branch on the stable `codeDescription` (e.g. `"ITEM_NOT_FOUND"`,
 * `"VALIDATION_ERROR"`, `"TOO_MANY_REQUESTS"`) — never on the human `message`.
 */
export class MalvoApiError extends Error {
  /** Backend error code; mirrors the HTTP status. */
  readonly code: number;
  /** HTTP status of the response (`0` for network/transport failures). */
  readonly statusCode: number;
  /** Stable machine-readable code, e.g. `"API_KEY_MISSING_OR_INVALID"`. */
  readonly codeDescription?: string;
  /** Optional structured payload carried by the error envelope. */
  readonly data?: unknown;
  /** Server request id (the `X-Request-ID` echo), useful for support. */
  readonly requestId?: string;

  constructor(args: {
    code: number;
    message: string;
    statusCode: number;
    codeDescription?: string;
    data?: unknown;
    requestId?: string;
  }) {
    super(args.message);
    this.name = "MalvoApiError";
    this.code = args.code;
    this.statusCode = args.statusCode;
    this.codeDescription = args.codeDescription;
    this.data = args.data;
    this.requestId = args.requestId;
    // Restore the prototype chain when compiled down to ES5-ish targets.
    Object.setPrototypeOf(this, MalvoApiError.prototype);
  }
}
