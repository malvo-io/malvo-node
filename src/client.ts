/**
 * MalvoClient — the Malvo data API client.
 *
 * ```ts
 * import { MalvoClient } from "@malvo/server";
 *
 * const malvo = new MalvoClient({
 *   clientId: process.env.MALVO_CLIENT_ID!,
 *   clientSecret: process.env.MALVO_CLIENT_SECRET!,
 * });
 *
 * const connectors = await malvo.fetchConnectors({ sandbox: true });
 * ```
 *
 * The apiKey is managed internally (lazy `POST /auth`, cached, proactively
 * refreshed, retried on 401). Every method throws {@link MalvoApiError} on a
 * non-2xx response.
 */
import { HttpClient } from "./http";
import type {
  AccountBalance,
  AccountType,
  Category,
  ClientCategoryRule,
  ConnectorFilters,
  Consent,
  CreateCategoryRuleRequest,
  CreateConnectTokenOptions,
  CreateItemRequest,
  CreateWebhookRequest,
  CreditCardBill,
  Cursor,
  InvestmentFilters,
  InvestmentTransaction,
  MalvoAccount,
  MalvoClientOptions,
  MalvoConnector,
  MalvoIdentity,
  MalvoInvestment,
  MalvoItem,
  MalvoLoan,
  MalvoTransaction,
  MerchantsResponse,
  Paginated,
  TransactionCursorFilters,
  TransactionPageFilters,
  UpdateItemRequest,
  UpdateWebhookRequest,
  Webhook,
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
   * Mint a 30-minute connect token for the hosted widget. Pass `itemId` for an
   * update-mode token. Returns `{ accessToken }`.
   */
  createConnectToken(options: CreateConnectTokenOptions = {}): Promise<{ accessToken: string }> {
    const { itemId, ...opts } = options;
    return this.http.request("POST", "/connect_token", { body: { itemId, options: opts } });
  }

  /* ----- Connectors ------------------------------------------------- */

  fetchConnectors(filters: ConnectorFilters = {}): Promise<Paginated<MalvoConnector>> {
    return this.http.request("GET", "/connectors", {
      query: {
        name: filters.name,
        countries: filters.countries,
        types: filters.types,
        products: filters.products,
        ids: filters.ids,
        sandbox: filters.sandbox,
        isOpenFinance: filters.isOpenFinance,
        supportsPaymentInitiation: filters.supportsPaymentInitiation,
      },
    });
  }

  fetchConnector(id: number): Promise<MalvoConnector> {
    return this.http.request("GET", `/connectors/${id}`);
  }

  /* ----- Items ------------------------------------------------------ */

  createItem(body: CreateItemRequest): Promise<MalvoItem> {
    return this.http.request("POST", "/items", { body });
  }

  fetchItem(id: string): Promise<MalvoItem> {
    return this.http.request("GET", `/items/${id}`);
  }

  /** PATCH an item (re-auth, update credentials/products) — re-triggers a sync. */
  updateItem(id: string, body: UpdateItemRequest = {}): Promise<MalvoItem> {
    return this.http.request("PATCH", `/items/${id}`, { body });
  }

  deleteItem(id: string): Promise<void> {
    return this.http.request("DELETE", `/items/${id}`);
  }

  /** Trigger an immediate re-sync without changing credentials. */
  triggerItemRefresh(id: string): Promise<MalvoItem> {
    return this.http.request("POST", `/items/${id}/refresh`);
  }

  /**
   * Answer an MFA / device challenge while the item is `WAITING_USER_INPUT`.
   * The keys of `parameters` are the connector credential `name`s (e.g. `token`).
   */
  updateItemMFA(id: string, parameters: Record<string, string>): Promise<MalvoItem> {
    return this.http.request("POST", `/items/${id}/mfa`, { body: { parameters } });
  }

  /* ----- Accounts --------------------------------------------------- */

  fetchAccounts(params: { itemId: string; type?: AccountType }): Promise<Paginated<MalvoAccount>> {
    return this.http.request("GET", "/accounts", {
      query: { itemId: params.itemId, type: params.type },
    });
  }

  fetchAccount(id: string): Promise<MalvoAccount> {
    return this.http.request("GET", `/accounts/${id}`);
  }

  /** Live balance — Open Finance connectors only. */
  fetchAccountBalance(id: string): Promise<AccountBalance> {
    return this.http.request("GET", `/accounts/${id}/balance`);
  }

  /* ----- Transactions ----------------------------------------------- */

  /** Cursor-based listing (`GET /v2/transactions`) — the preferred endpoint. */
  fetchTransactions(filters: TransactionCursorFilters): Promise<Cursor<MalvoTransaction>> {
    return this.http.request("GET", "/v2/transactions", {
      query: {
        accountId: filters.accountId,
        ids: filters.ids,
        after: filters.after,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        createdAtFrom: filters.createdAtFrom,
      },
    });
  }

  /** Iterate every transaction across all cursor pages. */
  async *fetchAllTransactions(
    filters: TransactionCursorFilters,
  ): AsyncGenerator<MalvoTransaction, void, unknown> {
    let after = filters.after;
    do {
      const page = await this.fetchTransactions({ ...filters, after });
      for (const tx of page.results) yield tx;
      after = nextCursor(page.next);
    } while (after);
  }

  /** Collect every transaction across all cursor pages into one array. */
  async collectAllTransactions(filters: TransactionCursorFilters): Promise<MalvoTransaction[]> {
    const all: MalvoTransaction[] = [];
    for await (const tx of this.fetchAllTransactions(filters)) all.push(tx);
    return all;
  }

  /**
   * Page-based listing (`GET /transactions`). Deprecated in favour of
   * {@link fetchTransactions}; kept for parity.
   */
  fetchTransactionsPaginated(
    filters: TransactionPageFilters,
  ): Promise<Paginated<MalvoTransaction>> {
    return this.http.request("GET", "/transactions", {
      query: {
        accountId: filters.accountId,
        ids: filters.ids,
        from: filters.from,
        to: filters.to,
        createdAtFrom: filters.createdAtFrom,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    });
  }

  fetchTransaction(id: string): Promise<MalvoTransaction> {
    return this.http.request("GET", `/transactions/${id}`);
  }

  updateTransactionCategory(id: string, categoryId: string): Promise<MalvoTransaction> {
    return this.http.request("PATCH", `/transactions/${id}`, { body: { categoryId } });
  }

  /* ----- Categories ------------------------------------------------- */

  fetchCategories(): Promise<Paginated<Category>> {
    return this.http.request("GET", "/categories");
  }

  fetchCategory(id: string): Promise<Category> {
    return this.http.request("GET", `/categories/${id}`);
  }

  fetchCategorizationRules(): Promise<Paginated<ClientCategoryRule>> {
    return this.http.request("GET", "/categories/rules");
  }

  createCategorizationRule(body: CreateCategoryRuleRequest): Promise<{ created: boolean }> {
    return this.http.request("POST", "/categories/rules", { body });
  }

  /* ----- Identity --------------------------------------------------- */

  fetchIdentityByItemId(itemId: string): Promise<MalvoIdentity> {
    return this.http.request("GET", "/identity", { query: { itemId } });
  }

  fetchIdentity(id: string): Promise<MalvoIdentity> {
    return this.http.request("GET", `/identity/${id}`);
  }

  /* ----- Investments ------------------------------------------------ */

  fetchInvestments(filters: InvestmentFilters = {}): Promise<Paginated<MalvoInvestment>> {
    return this.http.request("GET", "/investments", {
      query: {
        itemId: filters.itemId,
        type: filters.type,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    });
  }

  fetchInvestment(id: string): Promise<MalvoInvestment> {
    return this.http.request("GET", `/investments/${id}`);
  }

  fetchInvestmentTransactions(
    id: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<InvestmentTransaction>> {
    return this.http.request("GET", `/investments/${id}/transactions`, {
      query: { page: params.page, pageSize: params.pageSize },
    });
  }

  /* ----- Loans ------------------------------------------------------ */

  fetchLoans(params: { itemId: string }): Promise<Paginated<MalvoLoan>> {
    return this.http.request("GET", "/loans", { query: { itemId: params.itemId } });
  }

  fetchLoan(id: string): Promise<MalvoLoan> {
    return this.http.request("GET", `/loans/${id}`);
  }

  /* ----- Bills ------------------------------------------------------ */

  fetchBills(params: { accountId: string }): Promise<Paginated<CreditCardBill>> {
    return this.http.request("GET", "/bills", { query: { accountId: params.accountId } });
  }

  fetchBill(id: string): Promise<CreditCardBill> {
    return this.http.request("GET", `/bills/${id}`);
  }

  /* ----- Consents --------------------------------------------------- */

  fetchConsents(params: { itemId: string }): Promise<Paginated<Consent>> {
    return this.http.request("GET", "/consents", { query: { itemId: params.itemId } });
  }

  fetchConsent(id: string): Promise<Consent> {
    return this.http.request("GET", `/consents/${id}`);
  }

  /* ----- Webhooks --------------------------------------------------- */

  fetchWebhooks(): Promise<Paginated<Webhook>> {
    return this.http.request("GET", "/webhooks");
  }

  fetchWebhook(id: string): Promise<Webhook> {
    return this.http.request("GET", `/webhooks/${id}`);
  }

  createWebhook(body: CreateWebhookRequest): Promise<Webhook> {
    return this.http.request("POST", "/webhooks", { body });
  }

  updateWebhook(id: string, body: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.request("PATCH", `/webhooks/${id}`, { body });
  }

  deleteWebhook(id: string): Promise<void> {
    return this.http.request("DELETE", `/webhooks/${id}`);
  }

  /* ----- Merchants -------------------------------------------------- */

  /** Look up merchants by CNPJ (digits only). */
  fetchMerchants(cnpjs: string[]): Promise<MerchantsResponse> {
    return this.http.request("GET", "/merchants", { query: { cnpjs } });
  }
}

/** Extracts the `after` cursor out of a `next` query-string fragment. */
function nextCursor(next: string | null): string | undefined {
  if (!next) return undefined;
  const qs = next.startsWith("?") ? next.slice(1) : next;
  const after = new URLSearchParams(qs).get("after");
  return after ?? undefined;
}
