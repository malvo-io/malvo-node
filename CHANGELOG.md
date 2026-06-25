## 0.2.1

Wire-parity fixes from an endpoint-by-endpoint audit against the backend's
actual JSON output:

- `Transaction.paymentData.boletoMetadata` is now typed (`BoletoMetadata`:
  `digitableLine`, `barcode`, `baseAmount`, `interestAmount`, `penaltyAmount`,
  `discountAmount`) — the backend emits it on boleto-settled movements.
- `Item.statusDetail.<product>.warnings` is now `… [] | null` (the backend sends
  `null`, not an absent key — guards an array-access NPE).
- `ConnectorCredential.type` accepts `"ethaddress"` and `"hcaptcha"` (the backend
  can emit them).
- Removed `ConnectTokenOptions.connectorSortAlphabetically` — the backend ignores
  it, so it advertised a no-op.
- Documented that `fetchAccountStatements` currently returns
  `404 STATEMENTS_NOT_AVAILABLE` (statement collection not yet enabled backend-side).

## 0.2.0

**Positional surface.** `MalvoClient` methods now take positional arguments
instead of single option objects, aligning the whole data plane on one calling
convention.

- **Breaking — positional args replace option objects:**
  - `createConnectToken(itemId?, options?)` (was `createConnectToken(options)`).
  - `createItem(connectorId, parameters?, options?)` (was `createItem(body)`).
  - `updateItem(id, parameters?, options?)` (was `updateItem(id, body)`).
  - `fetchAccounts(itemId, type?)` (was `fetchAccounts({ itemId, type })`).
  - `fetchInvestments(itemId, type?, options?)`, `fetchLoans(itemId, options?)`,
    `fetchConsents(itemId, options?)` (were single-object filters).
  - `createWebhook(event, url, headers?)` (was `createWebhook(body)`).
- **Breaking — transaction methods realigned:**
  - `fetchTransactions(accountId, options?)` is now the **page-based**
    `GET /transactions` (was the cursor endpoint).
  - `fetchTransactionsCursor(accountId, options?)` is the cursor
    `GET /v2/transactions`.
  - `fetchAllTransactions(accountId, options?)` now **returns `Transaction[]`**
    (was an async generator). The lazy iterator moved to `streamTransactions`.
    `collectAllTransactions` was removed (use `fetchAllTransactions`).
- **Breaking — bill methods renamed:** `fetchCreditCardBills(accountId, options?)`
  / `fetchCreditCardBill(id)` (were `fetchBills` / `fetchBill`).
- **New endpoints (full backend parity):**
  - `fetchAccountStatements(accountId)` → `GET /accounts/{id}/statements`.
  - `fetchAllInvestmentTransactions(investmentId)` collects every page.
  - `fetchItemInsights(itemIds)` → `POST /book`.
  - `enrichTransactions(transactions)` → `POST /categorization`.
  - `fetchRecurringPayments(itemId)` → `POST /recurring-payments`.
- **New type aliases:** `Item`, `Account`, `Transaction`, `Connector`,
  `Investment`, `Loan`, `Identity`/`IdentityResponse`, `CreditCardBills`,
  `ProductType`, `PageResponse`, `CursorPageResponse`, `Parameters`,
  `ConnectTokenOptions`, `CreateItemOptions`, `TransactionFilters`,
  `TransactionCursorFilters`, `InvestmentsFilters`, `ConsentFilters`,
  `PageFilters`, `AccountStatement`. Old names (`Malvo*`, `Paginated`, `Cursor`,
  `Create*Request`) are kept as `@deprecated` aliases.

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
