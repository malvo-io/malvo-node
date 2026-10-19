import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { WebhookEventType } from "./types";
import { parseWebhookEvent, verifyWebhookSignature, WebhookSignatureError } from "./webhooks.ts";

type AssertTrue<T extends true> = T;
export type DedicatedWebhookIsNotSubscription = AssertTrue<
  "account_verification.completed" extends WebhookEventType ? false : true
>;

interface CompletedFixture {
  event: string;
  eventId: string;
  schemaVersion: number;
  occurredAt: string;
  data: {
    id: string;
    status: string;
    result: {
      overallResult: string;
      checks: Record<string, { result: string; reason: string }>;
      maskedHolderName: string;
    };
  };
}

const completedEvent: CompletedFixture = {
  event: "account_verification.completed",
  eventId: "11111111-1111-4111-8111-111111111111",
  schemaVersion: 1,
  occurredAt: "2026-10-19T03:00:00Z",
  data: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "completed",
    result: {
      overallResult: "match",
      checks: {
        bank: { result: "match", reason: "equal" },
        branch: { result: "match", reason: "equal" },
        account: { result: "match", reason: "equal" },
        document: { result: "match", reason: "equal" },
        name: { result: "match", reason: "normalized_equal" },
      },
      maskedHolderName: "M*** E***",
    },
  },
};

const outcomes = ["match", "partial", "no_match"] as const;
const reasons = [
  "equal",
  "normalized_equal",
  "abbreviated",
  "different",
  "not_requested",
  "missing_bank_data",
  "bank_unavailable",
  "format_ambiguous",
] as const;

function signedHeader(body: string, unix = 1_700_000_000): string {
  const mac = createHmac("sha256", secret).update(String(unix)).update(".").update(body).digest("hex");
  return `t=${unix},v1=${mac}`;
}

const payload = '{"event":"item/created","eventId":"evt_1","link":"https://a.test/?x=1&y=2"}';
const secret = "whsec_testsecret";
const header =
  "t=1700000000,v1=dcaf77c8756a00f70a8dd760e8c84b6d7f165f6ab0b697bfa3b13c240634e6f2";
const now = new Date(1_700_000_000 * 1000);

test("accepts the Go golden vector", () => {
  verifyWebhookSignature(payload, header, secret, { now });
});

test("rejects a tampered body", () => {
  assert.throws(
    () => verifyWebhookSignature(payload.slice(0, -1), header, secret, { now }),
    WebhookSignatureError,
  );
});

test("rejects a stale timestamp", () => {
  assert.throws(
    () =>
      verifyWebhookSignature(payload, header, secret, {
        now: new Date((1_700_000_000 + 400) * 1000),
        toleranceSeconds: 300,
      }),
    WebhookSignatureError,
  );
});

test("accepts either rotated secret", () => {
  verifyWebhookSignature(payload, header, ["other", secret], { now });
});

test("parses the minimal account verification webhook and exposes status and reason", () => {
  const event = parseWebhookEvent(completedEvent);
  assert.equal(event.event, "account_verification.completed");
  if (event.event !== "account_verification.completed") {
    return;
  }
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.data.status, "completed");
  assert.equal(event.data.result.overallResult, "match");
  assert.equal(event.data.result.checks.bank.reason, "equal");
  assert.equal(event.data.result.checks.name.reason, "normalized_equal");
  assert.equal(event.data.result.maskedHolderName, "M*** E***");
});

test("accepts every contracted result and reason on the dedicated webhook", () => {
  for (const overallResult of outcomes) {
    for (const reason of reasons) {
      const body = structuredClone(completedEvent);
      body.data.result.overallResult = overallResult;
      body.data.result.checks.name.result = overallResult;
      body.data.result.checks.name.reason = reason;
      const event = parseWebhookEvent(body);
      assert.equal(event.event, "account_verification.completed");
    }
  }
});

test("rejects an account verification webhook whose status is not completed", () => {
  const body = structuredClone(completedEvent);
  body.data.status = "failed";
  assert.throws(() => parseWebhookEvent(body), /data\.status/);
});

test("rejects an account verification check reason outside the contract", () => {
  const body = structuredClone(completedEvent);
  body.data.result.checks.document.reason = "raw_value";
  assert.throws(() => parseWebhookEvent(body), /reason/);
});

test("verifies the dedicated webhook with the existing signature and rejects a tampered body", () => {
  const body = JSON.stringify(completedEvent);
  const headerForBody = signedHeader(body);
  verifyWebhookSignature(body, headerForBody, secret, { now });
  const event = parseWebhookEvent(body);
  assert.equal(event.event, "account_verification.completed");
  assert.throws(
    () => verifyWebhookSignature(body.slice(0, -1), headerForBody, secret, { now }),
    WebhookSignatureError,
  );
});

test("still parses the previous webhook events", () => {
  assert.equal(
    parseWebhookEvent({ event: "item/created", eventId: "evt_item", itemId: "item_1" }).event,
    "item/created",
  );
  assert.equal(
    parseWebhookEvent({
      event: "transactions/deleted",
      eventId: "evt_tx",
      itemId: "item_1",
      transactionIds: ["tx_1"],
    }).event,
    "transactions/deleted",
  );
  assert.equal(
    parseWebhookEvent({
      event: "connector/status_updated",
      eventId: "evt_conn",
      status: "OFFLINE",
      previousStatus: "ONLINE",
    }).event,
    "connector/status_updated",
  );
});

test("still rejects an event the dedicated parser does not emit", () => {
  assert.throws(
    () => parseWebhookEvent({ event: "payment_intent/created", eventId: "evt_pay" }),
    /unknown event/,
  );
});
