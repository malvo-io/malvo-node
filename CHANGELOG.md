## 0.1.1

- **100% backend parity**, validated end-to-end against the live API:
  - Rewrote `MalvoLoan` to the real wire shape (`kind`, `ipocCode`, `CET`,
    `interestRates`, `contractedFees`, `installments`, `payments`, …).
  - Fixed `CreditCardBill` (`minimumPaymentAmount`, added `payments[]`,
    required fields) and `BillFinanceCharge` (`creditCardBillId`).
  - Expanded `MalvoIdentity` (`companyName`, `relations`, `investorProfile`,
    `qualifications`/`financialRelationships`, address/phone subfields).
  - Aligned `ConnectorType`, `Product`, `ItemStatus`, `ExecutionStatus` to the
    backend enums; added `Item.userAction`.
  - `createCategorizationRule` now returns `{ created: boolean }`.

## 0.1.0

- Initial release.
- `MalvoClient`: manages the apiKey lifecycle (lazy `POST /auth`, in-memory
  cache, proactive refresh, retry-once-on-401, backoff-on-429) and exposes one
  method per data-plane endpoint — connectors, items, accounts, transactions,
  categories, identity, investments, loans, bills, consents, webhooks and
  merchants — plus `createConnectToken`.
- Cursor auto-pagination for `GET /v2/transactions` via `fetchAllTransactions`
  / `collectAllTransactions`.
- `MalvoApiError` carrying `code` / `statusCode` / `codeDescription` / `data`.
- Typed webhook events (`WebhookEvent` union + `parseWebhookEvent`). No signature
  verification — webhooks are secured via custom headers / IP allowlist.
- Zero runtime dependencies; uses the native `fetch` (Node 18+).
