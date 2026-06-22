/**
 * Typed webhook payloads.
 *
 * Malvo webhooks carry **no HMAC signature** — secure your endpoint with the
 * custom `headers` you register on the webhook (e.g. a bearer secret) and/or by
 * allowlisting Malvo's egress IP (shown in the Dashboard). Always deduplicate by
 * `eventId`, and treat the webhook as the source of truth (re-fetch the affected
 * resources before acting).
 */
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

/**
 * Validate and narrow a parsed webhook body to a {@link WebhookEvent}.
 *
 * Accepts an already-parsed object or a raw JSON string. Throws `TypeError` if
 * the payload is malformed or carries an unknown `event`. Does NOT verify any
 * signature (Malvo webhooks have none — see the module docs).
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
