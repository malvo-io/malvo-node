/**
 * Typed webhook payloads.
 *
 * Verify `Malvo-Signature` with {@link verifyWebhookSignature} before parsing.
 * Custom headers and the static egress IP remain defense in depth. Always
 * deduplicate by `eventId`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FiredWebhookEventType, WebhookTriggeredBy } from "./types";

interface BaseWebhookEvent {
  /** Stable idempotency key — identical across redeliveries. Deduplicate on this. */
  eventId: string;
  /** Your end-user id, echoed when it was set on the item / connect token. */
  clientUserId?: string;
  triggeredBy?: WebhookTriggeredBy;
}

export interface ItemWebhookEvent extends BaseWebhookEvent {
  event:
    | "item/created"
    | "item/updated"
    | "item/error"
    | "item/deleted"
    | "item/waiting_user_input"
    | "item/login_succeeded";
  itemId: string;
}

export interface TransactionsWebhookEvent extends BaseWebhookEvent {
  event: "transactions/created" | "transactions/updated" | "transactions/deleted";
  itemId: string;
  accountId?: string;
  /** Present on `transactions/deleted`. */
  transactionIds?: string[];
  /** Link to fetch the created transactions (`transactions/created`). */
  createdTransactionsLink?: string;
  /** Link to fetch the updated transactions (`transactions/updated`). */
  updatedTransactionsLink?: string;
}

export interface ConnectorStatusWebhookEvent extends BaseWebhookEvent {
  event: "connector/status_updated";
  connectorId?: number;
  /** ONLINE | UNSTABLE | OFFLINE */
  status?: string;
  /** The status the connector held before this flip. */
  previousStatus?: string;
}

export type AccountVerificationOutcome = "match" | "partial" | "no_match";

export type AccountVerificationReason =
  | "equal"
  | "normalized_equal"
  | "abbreviated"
  | "different"
  | "not_requested"
  | "missing_bank_data"
  | "bank_unavailable"
  | "format_ambiguous";

export interface AccountVerificationCheck {
  result: AccountVerificationOutcome;
  reason: AccountVerificationReason;
}

/** Dedicated completion webhook. Not a `POST /webhooks` subscription event. */
export interface AccountVerificationCompletedWebhookEvent {
  event: "account_verification.completed";
  eventId: string;
  schemaVersion: 1;
  occurredAt: string;
  data: {
    id: string;
    status: "completed";
    result: {
      overallResult: AccountVerificationOutcome;
      checks: {
        bank: AccountVerificationCheck;
        branch: AccountVerificationCheck;
        account: AccountVerificationCheck;
        document: AccountVerificationCheck;
        name: AccountVerificationCheck;
      };
      maskedHolderName: string;
    };
  };
}

/** Discriminated union of every webhook event Malvo emits, keyed on `event`. */
export type WebhookEvent =
  | ItemWebhookEvent
  | TransactionsWebhookEvent
  | ConnectorStatusWebhookEvent
  | AccountVerificationCompletedWebhookEvent;

const ACCOUNT_VERIFICATION_COMPLETED = "account_verification.completed";
const ACCOUNT_VERIFICATION_OUTCOMES = new Set<string>(["match", "partial", "no_match"]);
const ACCOUNT_VERIFICATION_REASONS = new Set<string>([
  "equal",
  "normalized_equal",
  "abbreviated",
  "different",
  "not_requested",
  "missing_bank_data",
  "bank_unavailable",
  "format_ambiguous",
]);
const ACCOUNT_VERIFICATION_FIELDS = ["bank", "branch", "account", "document", "name"] as const;

const FIRED_EVENTS = new Set<FiredWebhookEventType>([
  "item/created",
  "item/updated",
  "item/error",
  "item/deleted",
  "item/waiting_user_input",
  "item/login_succeeded",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
  "connector/status_updated",
]);

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

function payloadBytes(payload: string | Uint8Array): Buffer {
  return typeof payload === "string" ? Buffer.from(payload, "utf8") : Buffer.from(payload);
}

function macHex(secret: string, unix: number, payload: Buffer): string {
  return createHmac("sha256", secret).update(String(unix)).update(".").update(payload).digest("hex");
}

function parseSignatureHeader(header: string): { unix: number; versions: string[] } {
  const trimmed = header.trim();
  if (!trimmed) {
    throw new WebhookSignatureError("missing Malvo-Signature header");
  }
  let unix = 0;
  const versions: string[] = [];
  for (const part of trimmed.split(",")) {
    const cut = part.trim().indexOf("=");
    if (cut <= 0) {
      throw new WebhookSignatureError("malformed Malvo-Signature header");
    }
    const key = part.trim().slice(0, cut);
    const value = part.trim().slice(cut + 1);
    if (!value) {
      throw new WebhookSignatureError("malformed Malvo-Signature header");
    }
    if (key === "t") {
      unix = Number.parseInt(value, 10);
      if (!Number.isFinite(unix)) {
        throw new WebhookSignatureError("malformed Malvo-Signature timestamp");
      }
    } else if (key === "v1") {
      versions.push(value.toLowerCase());
    }
  }
  if (unix === 0 || versions.length === 0) {
    throw new WebhookSignatureError("malformed Malvo-Signature header");
  }
  return { unix, versions };
}

/**
 * Verify `Malvo-Signature` over the raw HTTP body. Pass the exact bytes
 * received — never `JSON.stringify` a parsed object.
 */
export function verifyWebhookSignature(
  payload: string | Uint8Array,
  header: string,
  secret: string | readonly string[],
  options?: { toleranceSeconds?: number; now?: Date },
): void {
  const { unix, versions } = parseSignatureHeader(header);
  const tolerance = options?.toleranceSeconds ?? 300;
  const now = Math.floor((options?.now ?? new Date()).getTime() / 1000);
  if (Math.abs(now - unix) > tolerance) {
    throw new WebhookSignatureError("webhook signature timestamp is outside the tolerance");
  }
  const body = payloadBytes(payload);
  const secrets = (Array.isArray(secret) ? secret : [secret]).filter((item) => item.length > 0);
  for (const candidate of secrets) {
    const expected = Buffer.from(macHex(candidate, unix, body), "utf8");
    for (const got of versions) {
      const actual = Buffer.from(got, "utf8");
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        return;
      }
    }
  }
  throw new WebhookSignatureError("invalid webhook signature");
}

/**
 * Validate and narrow a parsed webhook body to a {@link WebhookEvent}.
 *
 * Accepts an already-parsed object or a raw JSON string. Throws `TypeError` if
 * the payload is malformed or carries an unknown `event`. Does not verify
 * HMAC — call {@link verifyWebhookSignature} first.
 */
export function parseWebhookEvent(body: unknown): WebhookEvent {
  const payload: unknown = typeof body === "string" ? safeParse(body) : body;
  if (!isRecord(payload)) {
    throw new TypeError("Invalid webhook payload: expected a JSON object.");
  }
  const event = payload.event;
  if (event === ACCOUNT_VERIFICATION_COMPLETED) {
    return parseAccountVerificationCompleted(payload);
  }
  if (typeof event !== "string" || !FIRED_EVENTS.has(event as FiredWebhookEventType)) {
    throw new TypeError(`Invalid webhook payload: unknown event "${String(event)}".`);
  }
  if (typeof payload.eventId !== "string") {
    throw new TypeError("Invalid webhook payload: missing eventId.");
  }
  return payload as unknown as WebhookEvent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccountVerificationCompleted(
  payload: Record<string, unknown>,
): AccountVerificationCompletedWebhookEvent {
  if (typeof payload.eventId !== "string") {
    throw new TypeError("Invalid webhook payload: missing eventId.");
  }
  if (payload.schemaVersion !== 1) {
    throw new TypeError("Invalid webhook payload: schemaVersion must be 1.");
  }
  if (typeof payload.occurredAt !== "string") {
    throw new TypeError("Invalid webhook payload: missing occurredAt.");
  }
  if (!isRecord(payload.data)) {
    throw new TypeError("Invalid webhook payload: missing data.");
  }
  const data = payload.data;
  if (typeof data.id !== "string") {
    throw new TypeError("Invalid webhook payload: missing data.id.");
  }
  if (data.status !== "completed") {
    throw new TypeError('Invalid webhook payload: data.status must be "completed".');
  }
  if (!isRecord(data.result)) {
    throw new TypeError("Invalid webhook payload: missing data.result.");
  }
  const result = data.result;
  if (typeof result.overallResult !== "string" || !ACCOUNT_VERIFICATION_OUTCOMES.has(result.overallResult)) {
    throw new TypeError("Invalid webhook payload: data.result.overallResult is invalid.");
  }
  if (!isRecord(result.checks)) {
    throw new TypeError("Invalid webhook payload: missing data.result.checks.");
  }
  const checks = result.checks;
  for (const field of ACCOUNT_VERIFICATION_FIELDS) {
    const check = checks[field];
    if (!isRecord(check)) {
      throw new TypeError(`Invalid webhook payload: missing data.result.checks.${field}.`);
    }
    if (typeof check.result !== "string" || !ACCOUNT_VERIFICATION_OUTCOMES.has(check.result)) {
      throw new TypeError(`Invalid webhook payload: data.result.checks.${field}.result is invalid.`);
    }
    if (typeof check.reason !== "string" || !ACCOUNT_VERIFICATION_REASONS.has(check.reason)) {
      throw new TypeError(`Invalid webhook payload: data.result.checks.${field}.reason is invalid.`);
    }
  }
  if (typeof result.maskedHolderName !== "string") {
    throw new TypeError("Invalid webhook payload: missing data.result.maskedHolderName.");
  }
  return payload as unknown as AccountVerificationCompletedWebhookEvent;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("Invalid webhook payload: not valid JSON.");
  }
}
