/**
 * MalvoClient — the Malvo data API client. One method per data-plane endpoint,
 * with positional arguments:
 *
 * ```ts
 * import { MalvoClient } from "@malvo/server";
 *
 * const malvo = new MalvoClient({
 *   clientId: process.env.MALVO_CLIENT_ID!,
 *   clientSecret: process.env.MALVO_CLIENT_SECRET!,
 * });
 *
 * const { results: connectors } = await malvo.fetchConnectors({ sandbox: true });
 * const accounts = await malvo.fetchAccounts(item.id);
 * const txs = await malvo.fetchAllTransactions(accounts.results[0].id);
 * ```
 *
 * Malvo is **data-only**: there is no payment-initiation (ITP) surface. Beyond
 * the core collection endpoints there are a few extras (`fetchAccountBalance`,
 * `triggerItemRefresh`, category rules, merchants and the intelligence endpoints
 * `fetchItemInsights` / `enrichTransactions` / `fetchRecurringPayments`).
 *
 * The apiKey is managed internally (lazy `POST /auth`, cached, proactively
 * refreshed, retried on 401). Every method throws {@link MalvoApiError} on a
 * non-2xx response.
 */
import { HttpClient } from "./http";
import type {
  Account,
  AccountBalance,
  AccountStatement,
  AccountType,
  Category,
  ClientCategoryRule,
  Connector,
  ConnectorFilters,
  Consent,
  ConsentFilters,
  ConnectTokenOptions,
  CreateCategoryRuleRequest,
  CreateItemOptions,
  CreditCardBills,
  CursorPageResponse,
  EnrichTransactionInput,
  EnrichedTransaction,
  IdentityResponse,
  Investment,
  InvestmentsFilters,
  InvestmentTransaction,
  InvestmentType,
  Item,
  ItemInsights,
  Loan,
  MalvoClientOptions,
  MerchantsResponse,
  PageFilters,
  PageResponse,
  Parameters,
  RecurringPayment,
  Transaction,
  TransactionCursorFilters,
  TransactionFilters,
  UpdateItemOptions,
  UpdateWebhook,
  Webhook,
  WebhookEventType,
} from "./types";

export class MalvoClient {
  private readonly http: HttpClient;

  constructor(options: MalvoClientOptions) {
    this.http = new HttpClient(options);
  }

  /** Authenticate eagerly (optional warm-up). Auth otherwise happens lazily. */
  ensureAuthenticated(): Promise<void> {
    return this.http.ensureAuthenticated();
  }

  /* ----- Connect token --------------------------------------------- */

  /**
   * Mint a 30-minute connect token for the hosted widget. Pass `itemId` to mint
   * an update-mode token. Returns `{ accessToken }`.
   */
  createConnectToken(
    itemId?: string,
    options: ConnectTokenOptions = {},
  ): Promise<{ accessToken: string }> {
    return this.http.request("POST", "/connect_token", { body: { itemId, options } });
  }

  /* ----- Connectors ------------------------------------------------- */

  fetchConnectors(options: ConnectorFilters = {}): Promise<PageResponse<Connector>> {
    return this.http.request("GET", "/connectors", {
      query: {
        name: options.name,
        countries: options.countries,
        types: options.types,
        products: options.products,
        ids: options.ids,
        sandbox: options.sandbox,
        isOpenFinance: options.isOpenFinance,
        supportsPaymentInitiation: options.supportsPaymentInitiation,
      },
    });
  }

  fetchConnector(id: number): Promise<Connector> {
    return this.http.request("GET", `/connectors/${id}`);
  }

  /* ----- Items ------------------------------------------------------ */

  createItem(
    connectorId: number,
    parameters?: Parameters,
    options: CreateItemOptions = {},
  ): Promise<Item> {
    return this.http.request("POST", "/items", {
      body: {
        connectorId,
        parameters,
        webhookUrl: options.webhookUrl,
        clientUserId: options.clientUserId,
        products: options.products,
        oauthRedirectUri: options.oauthRedirectUri,
        avoidDuplicates: options.avoidDuplicates,
      },
    });
  }

  fetchItem(id: string): Promise<Item> {
    return this.http.request("GET", `/items/${id}`);
  }

  /** PATCH an item (re-auth, update credentials/products) — re-triggers a sync. */
  updateItem(
    id: string,
    parameters?: Parameters,
    options: UpdateItemOptions = {},
  ): Promise<Item> {
    return this.http.request("PATCH", `/items/${id}`, {
      body: {
        parameters,
        webhookUrl: options.webhookUrl,
        oauthRedirectUri: options.oauthRedirectUri,
        connectorId: options.connectorId,
      },
    });
  }

  deleteItem(id: string): Promise<void> {
    return this.http.request("DELETE", `/items/${id}`);
  }

  /**
   * Answer an MFA / device challenge while the item is `WAITING_USER_INPUT`.
   * The keys of `parameters` are the connector credential `name`s (e.g. `token`).
   */
  updateItemMFA(id: string, parameters?: Parameters): Promise<Item> {
    return this.http.request("POST", `/items/${id}/mfa`, { body: { parameters } });
  }

  /** Malvo extension: trigger an immediate re-sync without changing credentials. */
  triggerItemRefresh(id: string): Promise<Item> {
    return this.http.request("POST", `/items/${id}/refresh`);
  }

  /* ----- Accounts --------------------------------------------------- */

  fetchAccounts(itemId: string, type?: AccountType): Promise<PageResponse<Account>> {
    return this.http.request("GET", "/accounts", { query: { itemId, type } });
  }

  fetchAccount(id: string): Promise<Account> {
    return this.http.request("GET", `/accounts/${id}`);
  }

  /** Live balance — Open Finance connectors only. Malvo extension. */
  fetchAccountBalance(id: string): Promise<AccountBalance> {
    return this.http.request("GET", `/accounts/${id}/balance`);
  }

  /**
   * Monthly statement files for an account (Open Finance connectors).
   *
   * @remarks Statement collection is not yet enabled on the backend: this
   * endpoint currently responds `404 STATEMENTS_NOT_AVAILABLE`, so this method
   * throws {@link MalvoApiError} until the feature ships. The route is in place
   * so the method works unchanged once it does.
   */
  fetchAccountStatements(accountId: string): Promise<PageResponse<AccountStatement>> {
    return this.http.request("GET", `/accounts/${accountId}/statements`);
  }

  /* ----- Transactions ----------------------------------------------- */

  /** Page-based listing (`GET /transactions`). */
  fetchTransactions(
    accountId: string,
    options: TransactionFilters = {},
  ): Promise<PageResponse<Transaction>> {
    return this.http.request("GET", "/transactions", {
      query: {
        accountId,
        ids: options.ids,
        from: options.from,
        to: options.to,
        createdAtFrom: options.createdAtFrom,
        page: options.page,
        pageSize: options.pageSize,
      },
    });
  }

  /** Cursor-based listing (`GET /v2/transactions`) — the preferred endpoint. */
  fetchTransactionsCursor(
    accountId: string,
    options: TransactionCursorFilters = {},
  ): Promise<CursorPageResponse<Transaction>> {
    return this.http.request("GET", "/v2/transactions", {
      query: {
        accountId,
        ids: options.ids,
        after: options.after,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        createdAtFrom: options.createdAtFrom,
      },
    });
  }

  /** Collect every transaction for an account across all cursor pages. */
  async fetchAllTransactions(
    accountId: string,
    options: Omit<TransactionCursorFilters, "after"> = {},
  ): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let after: string | undefined;
    do {
      const page = await this.fetchTransactionsCursor(accountId, { ...options, after });
      all.push(...page.results);
      after = nextCursor(page.next);
    } while (after);
    return all;
  }

  /** Malvo extension: lazily iterate every transaction across all cursor pages. */
  async *streamTransactions(
    accountId: string,
    options: Omit<TransactionCursorFilters, "after"> = {},
  ): AsyncGenerator<Transaction, void, unknown> {
    let after: string | undefined;
    do {
      const page = await this.fetchTransactionsCursor(accountId, { ...options, after });
      for (const tx of page.results) yield tx;
      after = nextCursor(page.next);
    } while (after);
  }

  fetchTransaction(id: string): Promise<Transaction> {
    return this.http.request("GET", `/transactions/${id}`);
  }

  updateTransactionCategory(id: string, categoryId: string): Promise<Transaction> {
    return this.http.request("PATCH", `/transactions/${id}`, { body: { categoryId } });
  }

  /* ----- Investments ------------------------------------------------ */

  fetchInvestments(
    itemId: string,
    type?: InvestmentType,
    options: InvestmentsFilters = {},
  ): Promise<PageResponse<Investment>> {
    return this.http.request("GET", "/investments", {
      query: { itemId, type, page: options.page, pageSize: options.pageSize },
    });
  }

  fetchInvestment(id: string): Promise<Investment> {
    return this.http.request("GET", `/investments/${id}`);
  }

  fetchInvestmentTransactions(
    investmentId: string,
    options: PageFilters = {},
  ): Promise<PageResponse<InvestmentTransaction>> {
    return this.http.request("GET", `/investments/${investmentId}/transactions`, {
      query: { page: options.page, pageSize: options.pageSize },
    });
  }

  /** Collect every investment transaction across all pages. */
  async fetchAllInvestmentTransactions(
    investmentId: string,
  ): Promise<InvestmentTransaction[]> {
    const all: InvestmentTransaction[] = [];
    let page = 1;
    for (;;) {
      const res = await this.fetchInvestmentTransactions(investmentId, { page, pageSize: 500 });
      all.push(...res.results);
      if (page >= res.totalPages || res.results.length === 0) break;
      page++;
    }
    return all;
  }

  /* ----- Identity --------------------------------------------------- */

  fetchIdentity(id: string): Promise<IdentityResponse> {
    return this.http.request("GET", `/identity/${id}`);
  }

  fetchIdentityByItemId(itemId: string): Promise<IdentityResponse> {
    return this.http.request("GET", "/identity", { query: { itemId } });
  }

  /* ----- Loans ------------------------------------------------------ */

  fetchLoans(itemId: string, options: PageFilters = {}): Promise<PageResponse<Loan>> {
    return this.http.request("GET", "/loans", {
      query: { itemId, page: options.page, pageSize: options.pageSize },
    });
  }

  fetchLoan(id: string): Promise<Loan> {
    return this.http.request("GET", `/loans/${id}`);
  }

  /* ----- Credit-card bills ------------------------------------------ */

  fetchCreditCardBills(
    accountId: string,
    options: PageFilters = {},
  ): Promise<PageResponse<CreditCardBills>> {
    return this.http.request("GET", "/bills", {
      query: { accountId, page: options.page, pageSize: options.pageSize },
    });
  }

  fetchCreditCardBill(id: string): Promise<CreditCardBills> {
    return this.http.request("GET", `/bills/${id}`);
  }

  /* ----- Consents --------------------------------------------------- */

  fetchConsents(itemId: string, options: ConsentFilters = {}): Promise<PageResponse<Consent>> {
    return this.http.request("GET", "/consents", {
      query: { itemId, page: options.page, pageSize: options.pageSize },
    });
  }

  fetchConsent(id: string): Promise<Consent> {
    return this.http.request("GET", `/consents/${id}`);
  }

  /* ----- Categories ------------------------------------------------- */

  fetchCategories(): Promise<PageResponse<Category>> {
    return this.http.request("GET", "/categories");
  }

  fetchCategory(id: string): Promise<Category> {
    return this.http.request("GET", `/categories/${id}`);
  }

  /** Malvo extension: list the application's custom categorization rules. */
  fetchCategorizationRules(): Promise<PageResponse<ClientCategoryRule>> {
    return this.http.request("GET", "/categories/rules");
  }

  /** Malvo extension: create a custom categorization rule. */
  createCategorizationRule(body: CreateCategoryRuleRequest): Promise<{ created: boolean }> {
    return this.http.request("POST", "/categories/rules", { body });
  }

  /* ----- Webhooks --------------------------------------------------- */

  fetchWebhooks(): Promise<PageResponse<Webhook>> {
    return this.http.request("GET", "/webhooks");
  }

  fetchWebhook(id: string): Promise<Webhook> {
    return this.http.request("GET", `/webhooks/${id}`);
  }

  createWebhook(
    event: WebhookEventType,
    url: string,
    headers?: Record<string, string>,
  ): Promise<Webhook> {
    return this.http.request("POST", "/webhooks", { body: { url, event, headers } });
  }

  updateWebhook(id: string, updatedWebhookParams: UpdateWebhook): Promise<Webhook> {
    return this.http.request("PATCH", `/webhooks/${id}`, { body: updatedWebhookParams });
  }

  deleteWebhook(id: string): Promise<void> {
    return this.http.request("DELETE", `/webhooks/${id}`);
  }

  /* ----- Merchants (Malvo extension) -------------------------------- */

  /** Look up merchants by CNPJ (digits only). */
  fetchMerchants(cnpjs: string[]): Promise<MerchantsResponse> {
    return this.http.request("GET", "/merchants", { query: { cnpjs } });
  }

  /* ----- Intelligence & enrichment (Malvo extensions) --------------- */

  /** Per-item aggregated insights (`POST /book`). */
  fetchItemInsights(itemIds: string[]): Promise<ItemInsights[]> {
    return this.http.request("POST", "/book", { query: { itemIds } });
  }

  /**
   * Categorize/enrich client-supplied transactions without persisting them
   * (`POST /categorization`). Up to 5000 transactions per request.
   */
  async enrichTransactions(
    transactions: EnrichTransactionInput[],
  ): Promise<EnrichedTransaction[]> {
    const res = await this.http.request<{ results: EnrichedTransaction[] }>(
      "POST",
      "/categorization",
      { body: { transactions } },
    );
    return res.results;
  }

  /** Detect recurring charges (subscriptions, salary, utilities) for an item. */
  fetchRecurringPayments(itemId: string): Promise<RecurringPayment[]> {
    return this.http.request("POST", "/recurring-payments", { body: { itemId } });
  }
}

/** Extracts the `after` cursor out of a `next` query-string fragment. */
function nextCursor(next: string | null): string | undefined {
  if (!next) return undefined;
  const qs = next.startsWith("?") ? next.slice(1) : next;
  const after = new URLSearchParams(qs).get("after");
  return after ?? undefined;
}
