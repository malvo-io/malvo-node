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

/** Discriminated union of every webhook event Malvo emits, keyed on `event`. */
export type WebhookEvent =
  | ItemWebhookEvent
  | TransactionsWebhookEvent
  | ConnectorStatusWebhookEvent;

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
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("Invalid webhook payload: expected a JSON object.");
  }
  const event = (payload as { event?: unknown }).event;
  if (typeof event !== "string" || !FIRED_EVENTS.has(event as FiredWebhookEventType)) {
    throw new TypeError(`Invalid webhook payload: unknown event "${String(event)}".`);
  }
  if (typeof (payload as { eventId?: unknown }).eventId !== "string") {
    throw new TypeError("Invalid webhook payload: missing eventId.");
  }
  return payload as WebhookEvent;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("Invalid webhook payload: not valid JSON.");
  }
}
