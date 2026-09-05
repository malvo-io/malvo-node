import assert from "node:assert/strict";
import test from "node:test";
import { verifyWebhookSignature, WebhookSignatureError } from "./webhooks.ts";

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
