# @malvo/server

Node.js / TypeScript **server SDK** for the [Malvo](https://malvo.io) API
(Open Finance Brasil). One `MalvoClient` class manages the apiKey lifecycle and
exposes one method per endpoint: connectors, items, accounts, transactions,
investments, loans, bills, identity, categories, consents, webhooks and
merchants — plus minting connect tokens for the hosted widget.

Talks to a single host: `https://api.malvo.io`. **Data aggregation only** — no
payment initiation.

## Install

```bash
npm install @malvo/server
```

Requires **Node 18+** (uses the global `fetch`). Zero runtime dependencies.

## Quickstart

```ts
import { MalvoClient } from "@malvo/server";

const malvo = new MalvoClient({
  clientId: process.env.MALVO_CLIENT_ID!,
  clientSecret: process.env.MALVO_CLIENT_SECRET!,
});

// apiKey is fetched lazily, cached, refreshed and retried for you.
const { results: connectors } = await malvo.fetchConnectors({ sandbox: true });
```

> **Keep secrets on the server.** `clientId` / `clientSecret` (and the apiKey the
> SDK derives from them) must never reach the browser. The only value safe to
> send to a frontend is the 30-minute **connect token**.

## The token chain

| Step | What | TTL |
|---|---|---|
| 1 | `clientId` + `clientSecret` → apiKey (managed internally by the SDK) | 2h |
| 2 | `malvo.createConnectToken(...)` → `accessToken` (the connect token) | 30 min |
| 3 | Frontend opens the widget with the connect token | — |

## Minting a connect token (Express)

```ts
import express from "express";
import { MalvoClient } from "@malvo/server";

const malvo = new MalvoClient({
  clientId: process.env.MALVO_CLIENT_ID!,
  clientSecret: process.env.MALVO_CLIENT_SECRET!,
});

const app = express();

app.post("/api/malvo/connect-token", async (req, res) => {
  const { accessToken } = await malvo.createConnectToken({
    clientUserId: req.user.id,
    webhookUrl: process.env.MALVO_WEBHOOK_URL,
  });
  res.json({ accessToken }); // the frontend passes this to the widget
});
```

## Reading data

After the `item/created` / `item/updated` webhook fires, read the item's data.
Transactions use a cursor — `fetchAllTransactions` paginates it for you:

```ts
const { results: accounts } = await malvo.fetchAccounts({ itemId });

for (const account of accounts) {
  for await (const tx of malvo.fetchAllTransactions({ accountId: account.id })) {
    console.log(tx.date, tx.description, tx.amount);
  }
}
```

Or grab a single page (`fetchTransactions` returns `{ results, next }`), or
collect everything at once with `collectAllTransactions({ accountId })`.

## Error handling

Every method throws `MalvoApiError` on a non-2xx response. Branch on the stable
`codeDescription`, never on the human `message`:

```ts
import { MalvoApiError } from "@malvo/server";

try {
  await malvo.fetchItem(itemId);
} catch (err) {
  if (err instanceof MalvoApiError && err.codeDescription === "ITEM_NOT_FOUND") {
    // handle missing item
  } else {
    throw err;
  }
}
```

`401` (apiKey expired) is retried automatically once, and `429` is backed off up
to `maxRetries` times respecting `Retry-After`.

## Webhooks

```ts
import { parseWebhookEvent } from "@malvo/server";

app.post("/webhooks/malvo", express.json(), (req, res) => {
  const event = parseWebhookEvent(req.body); // typed, throws on malformed input
  res.sendStatus(200); // ack fast; deduplicate by event.eventId

  if (event.event === "transactions/created") {
    // re-fetch the affected account's transactions
  }
});
```

Malvo webhooks have **no HMAC signature** — secure the endpoint with the custom
`headers` you register (e.g. a bearer secret) and/or by allowlisting Malvo's
egress IP from the Dashboard.

> **Webhooks are the source of truth.** Persist connections and data from the
> `item/*` and `transactions/*` webhooks; don't rely on a single response.

## Docs

Full reference: <https://malvo.io/docs/sdks/node>
