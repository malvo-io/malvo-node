/**
 * TypeScript types for the Malvo data API (https://api.malvo.io).
 *
 * Field names match the JSON wire format (camelCase); enums are UPPERCASE
 * string literals; all timestamps are ISO-8601 strings (e.g.
 * `"2025-01-02T08:00:00.000Z"`). Money values are plain numbers paired with a
 * sibling `currencyCode`.
 */

/* ------------------------------------------------------------------ */
/* Envelopes                                                           */
/* ------------------------------------------------------------------ */

/** Page-based list envelope (every list endpoint except `/v2/transactions`). */
export interface PageResponse<T> {
  results: T[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Cursor list envelope (`GET /v2/transactions`). `next` is an opaque query-string
 * fragment (e.g. `"?accountId=...&after=..."`) or `null` when there are no more
 * pages. Prefer {@link MalvoClient.fetchAllTransactions} to collect it.
 */
export interface CursorPageResponse<T> {
  results: T[];
  next: string | null;
}

/** @deprecated Use {@link PageResponse}. Kept for back-compat. */
export type Paginated<T> = PageResponse<T>;
/** @deprecated Use {@link CursorPageResponse}. */
export type Cursor<T> = CursorPageResponse<T>;

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export type ConnectorType = "PERSONAL_BANK" | "BUSINESS_BANK" | "INVESTMENT" | "OTHER";

export type Product =
  | "ACCOUNTS"
  | "TRANSACTIONS"
  | "CREDIT_CARDS"
  | "INVESTMENTS"
  | "INVESTMENTS_TRANSACTIONS"
  | "LOANS"
  | "IDENTITY"
  | "OPPORTUNITIES"
  | "PORTFOLIO"
  | "INCOME_REPORTS";

export type ItemStatus =
  | "CREATING"
  | "UPDATING"
  | "LOGIN_IN_PROGRESS"
  | "WAITING_USER_INPUT"
  | "UPDATED"
  | "OUTDATED"
  | "LOGIN_ERROR";

/**
 * Detailed execution status. The known literals are listed for autocomplete;
 * the open `(string & {})` member keeps forward compatibility if the API adds
 * new states.
 */
export type ExecutionStatus =
  | "CREATED"
  | "LOGIN_IN_PROGRESS"
  | "LOGIN_MFA_IN_PROGRESS"
  | "ACCOUNTS_IN_PROGRESS"
  | "CREDITCARDS_IN_PROGRESS"
  | "TRANSACTIONS_IN_PROGRESS"
  | "INVESTMENTS_TRANSACTIONS_IN_PROGRESS"
  | "PAYMENT_DATA_IN_PROGRESS"
  | "IDENTITY_IN_PROGRESS"
  | "MERGING"
  | "WAITING_USER_INPUT"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "ERROR"
  | "MERGE_ERROR"
  | "INVALID_CREDENTIALS"
  | "INVALID_CREDENTIALS_MFA"
  | "ALREADY_LOGGED_IN"
  | "SITE_NOT_AVAILABLE"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_NEEDS_ACTION"
  | "ACCOUNT_CREDENTIALS_RESET"
  | "USER_NOT_SUPPORTED"
  | "CONNECTION_ERROR"
  | "USER_AUTHORIZATION_PENDING"
  | "USER_AUTHORIZATION_NOT_GRANTED"
  | "USER_AUTHORIZATION_REVOKED"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export type AccountType = "BANK" | "CREDIT";
export type AccountSubtype = "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD";

export type TransactionStatus = "POSTED" | "PENDING";
export type TransactionType = "DEBIT" | "CREDIT";

export type InvestmentType =
  | "MUTUAL_FUND"
  | "SECURITY"
  | "EQUITY"
  | "COE"
  | "FIXED_INCOME"
  | "ETF"
  | "OTHER";

export type InvestmentStatus = "ACTIVE" | "PENDING" | "TOTAL_WITHDRAWAL";

export type InvestmentTransactionType =
  | "BUY"
  | "SELL"
  | "TAX"
  | "TRANSFER"
  | "INTEREST"
  | "AMORTIZATION";

export type ConsentStatus =
  | "AWAITING_AUTHORISATION"
  | "AUTHORISED"
  | "REJECTED"
  | "REVOKED";

export type ConnectorHealthStatus = "ONLINE" | "UNSTABLE" | "OFFLINE";

/** Who triggered a webhook delivery (envelope `triggeredBy`). */
export type WebhookTriggeredBy = "USER" | "CLIENT" | "SYNC" | "INTERNAL";

/**
 * Every `event` value the API accepts on `POST /webhooks`. The
 * `payment_intent/*`, `scheduled_payment/*`, `automatic_pix_payment/*`,
 * `smart_transfer_*` and `payment_request/*` values are accepted for wire
 * compatibility but are **never fired** by Malvo (no payment initiation).
 * See {@link FiredWebhookEventType} for the subset actually emitted.
 */
export type WebhookEventType =
  | "all"
  | FiredWebhookEventType
  | "item/waiting_user_action"
  | "scheduled_payment/all_completed"
  | "scheduled_payment/all_created"
  | "boleto/updated"
  | "payment_intent/created"
  | "payment_intent/waiting_payer_authorization"
  | "payment_intent/completed"
  | "payment_intent/error"
  | "scheduled_payment/created"
  | "scheduled_payment/completed"
  | "scheduled_payment/error"
  | "scheduled_payment/canceled"
  | "automatic_pix_payment/created"
  | "automatic_pix_payment/completed"
  | "automatic_pix_payment/error"
  | "automatic_pix_payment/canceled"
  | "smart_transfer_preauthorization/completed"
  | "smart_transfer_preauthorization/error"
  | "smart_transfer_payment/completed"
  | "smart_transfer_payment/error"
  | "payment_request/updated";

/** The webhook events Malvo actually emits. */
export type FiredWebhookEventType =
  | "item/created"
  | "item/updated"
  | "item/error"
  | "item/deleted"
  | "item/waiting_user_input"
  | "item/login_succeeded"
  | "transactions/created"
  | "transactions/updated"
  | "transactions/deleted"
  | "connector/status_updated";

/* ------------------------------------------------------------------ */
/* Connectors                                                          */
/* ------------------------------------------------------------------ */

export interface ConnectorCredentialOption {
  label: string;
  value: string;
}

export interface ConnectorCredential {
  label: string;
  /** Field key to send back in `parameters` on `createItem` / `updateItemMFA`. */
  name: string;
  type?: "text" | "password" | "number" | "image" | "select" | "ethaddress" | "hcaptcha";
  mfa?: boolean;
  placeholder?: string;
  validation?: string;
  validationMessage?: string;
  optional?: boolean;
  assistiveText?: string;
  /** Base64 payload for image / QR-code challenges. */
  data?: string;
  expiresAt?: string;
  instructions?: string;
  options?: ConnectorCredentialOption[];
}

export interface ConnectorHealth {
  status: ConnectorHealthStatus;
  stage: string | null;
}

export interface MalvoConnector {
  id: number;
  name: string;
  institutionUrl: string;
  imageUrl: string;
  /** Brand color as a hex string WITHOUT the leading `#`. */
  primaryColor: string;
  type: ConnectorType;
  country: string;
  credentials: ConnectorCredential[];
  hasMFA: boolean;
  oauth?: boolean;
  /** Single-use bank login URL surfaced on Open Finance items after creation. */
  oauthUrl?: string | null;
  health?: ConnectorHealth;
  products?: Product[];
  isSandbox?: boolean;
  isOpenFinance?: boolean;
  /** Malvo is data-only, so the payment-capability flags are always `false`. */
  supportsPaymentInitiation?: boolean;
  supportsScheduledPayments?: boolean;
  supportsSmartTransfers?: boolean;
  supportsAutomaticPix?: boolean;
  supportsBoletoManagement?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export interface ItemError {
  code: string;
  message: string;
  providerMessage?: string | null;
  attributes?: Record<string, string> | null;
}

/** Manual action the user must perform at the institution (ACCOUNT_NEEDS_ACTION). */
export interface UserAction {
  instructions: string;
  attributes?: Record<string, string>;
}

/** Per-product freshness inside {@link ItemStatusDetail}. */
export interface ProductStatusDetail {
  isUpdated: boolean;
  lastUpdatedAt: string | null;
  warnings?: { code: string; message: string; providerMessage?: string | null }[] | null;
}

export interface ItemStatusDetail {
  accounts?: ProductStatusDetail | null;
  creditCards?: ProductStatusDetail | null;
  transactions?: ProductStatusDetail | null;
  investments?: ProductStatusDetail | null;
  /** Official Pluggy key is `investmentTransactions` (singular "investment"). */
  investmentTransactions?: ProductStatusDetail | null;
  identity?: ProductStatusDetail | null;
  loans?: ProductStatusDetail | null;
  paymentData?: ProductStatusDetail | null;
  accountStatements?: ProductStatusDetail | null;
}

export interface MalvoItem {
  id: string;
  connector: MalvoConnector;
  status: ItemStatus;
  executionStatus: ExecutionStatus;
  createdAt: string;
  updatedAt: string;
  lastUpdatedAt: string | null;
  nextAutoSyncAt?: string | null;
  /** MFA parameter requested while status is `WAITING_USER_INPUT`. */
  parameter: ConnectorCredential | null;
  webhookUrl: string | null;
  error: ItemError | null;
  /** Manual step required at the institution; null unless one is pending. */
  userAction?: UserAction | null;
  clientUserId: string | null;
  consecutiveFailedLoginAttempts?: number;
  statusDetail?: ItemStatusDetail | null;
  products?: Product[];
  consentExpiresAt?: string | null;
  oauthRedirectUri?: string | null;
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export interface Remuneration {
  preFixedRate?: number | null;
  postFixedIndexerPercentage?: number | null;
  rateType?: string | null;
  indexer?: string | null;
  calculation?: string | null;
  ratePeriodicity?: string | null;
  indexerAdditionalInfo?: string | null;
}

export interface ReservedBalanceAmount {
  amount: number;
  currencyCode: string;
  remuneration?: Remuneration | null;
}

export interface ReservedBalance {
  name?: string | null;
  identification: string;
  availableAmounts: ReservedBalanceAmount[];
}

export interface AccountBankData {
  transferNumber: string | null;
  closingBalance: number | null;
  automaticallyInvestedBalance: number | null;
  overdraftContractedLimit?: number | null;
  overdraftUsedLimit?: number | null;
  unarrangedOverdraftAmount?: number | null;
  hasReservedBalance?: boolean | null;
  reservedBalances?: ReservedBalance[];
}

export interface DisaggregatedCreditLimit {
  creditLineLimitType: string;
  consolidationType: string;
  identificationNumber: string;
  isLimitFlexible: boolean;
  usedAmount: number;
  usedAmountCurrencyCode: string;
  lineName?: string | null;
  lineNameAdditionalInfo?: string | null;
  limitAmount?: number | null;
  limitAmountCurrencyCode?: string | null;
  availableAmount?: number | null;
  availableAmountCurrencyCode?: string | null;
}

export interface AdditionalCard {
  number: string;
}

export interface AccountCreditData {
  level: string | null;
  brand: string | null;
  balanceCloseDate: string | null;
  balanceDueDate: string | null;
  availableCreditLimit: number | null;
  balanceForeignCurrency: number | null;
  minimumPayment: number | null;
  creditLimit: number | null;
  isLimitFlexible?: boolean | null;
  /** ACTIVE | BLOCKED | CANCELLED */
  status: string | null;
  /** MAIN | ADDITIONAL */
  holderType?: string | null;
  disaggregatedCreditLimits?: DisaggregatedCreditLimit[];
  additionalCards?: AdditionalCard[];
}

export interface MalvoAccount {
  id: string;
  itemId: string;
  type: AccountType;
  subtype: AccountSubtype;
  number: string;
  name: string;
  marketingName: string | null;
  balance: number;
  currencyCode: string;
  taxNumber: string | null;
  owner: string | null;
  /** Present when `type === "BANK"`. */
  bankData?: AccountBankData | null;
  /** Present when `type === "CREDIT"`. */
  creditData?: AccountCreditData | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of `GET /accounts/{id}/balance` (Open Finance connectors only). */
export interface AccountBalance {
  balance: number;
  blockedBalance?: number | null;
  automaticallyInvestedBalance?: number | null;
  currencyCode: string;
  updateDateTime: string;
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export interface TransactionMerchant {
  name: string;
  businessName?: string | null;
  cnpj?: string | null;
  cnae?: string | null;
  category?: string | null;
}

export interface TransactionDocumentNumber {
  type?: "CPF" | "CNPJ" | null;
  value?: string | null;
}

export interface TransactionPaymentParticipant {
  name?: string | null;
  documentNumber?: TransactionDocumentNumber | null;
  accountNumber?: string | null;
  branchNumber?: string | null;
  routingNumber?: string | null;
  routingNumberISPB?: string | null;
}

/** Boleto detail, present on boleto-settled transactions. */
export interface BoletoMetadata {
  digitableLine?: string | null;
  barcode?: string | null;
  baseAmount?: number | null;
  interestAmount?: number | null;
  penaltyAmount?: number | null;
  discountAmount?: number | null;
}

export interface TransactionPaymentData {
  payer?: TransactionPaymentParticipant | null;
  receiver?: TransactionPaymentParticipant | null;
  /** PIX | TED | DOC | TEV | BOLETO | WIRE_TRANSFER */
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  receiverReferenceId?: string | null;
  reason?: string | null;
  /** Present when the movement settled a boleto. */
  boletoMetadata?: BoletoMetadata | null;
}

export interface TransactionCreditCardMetadata {
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  totalAmount?: number | null;
  purchaseDate?: string | null;
  payeeMCC?: number | null;
  cardNumber?: string | null;
  billId?: string | null;
}

export interface MalvoTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw: string | null;
  currencyCode: string;
  /** Signed: BANK positive = credit; CREDIT amounts are inverted. */
  amount: number;
  amountInAccountCurrency?: number | null;
  date: string;
  category: string | null;
  categoryId: string | null;
  balance: number | null;
  status: TransactionStatus;
  type: TransactionType;
  providerCode?: string | null;
  /** Open Finance operation type, e.g. `"PIX"`, `"TED"`. */
  operationType?: string | null;
  paymentData?: TransactionPaymentData | null;
  creditCardMetadata?: TransactionCreditCardMetadata | null;
  merchant?: TransactionMerchant | null;
  providerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export interface IdentityPhone {
  /** Personal | Work | Residencial */
  type?: string;
  value: string;
  countryCallingCode?: string;
  areaCode?: string;
  extension?: string;
  additionalInfo?: string;
}

export interface IdentityEmail {
  /** Personal | Work */
  type?: string;
  value: string;
}

export interface IdentityRelation {
  /** Mother | Father | Spouse */
  type?: string;
  name?: string;
  document?: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface IdentityAddress {
  fullAddress?: string;
  primaryAddress?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  /** Personal | Work */
  type?: string;
  additionalInfo?: string;
  district?: string;
  ibgeTownCode?: string;
  /** ISO alpha-3 country code, e.g. "BRA". */
  countryCode?: string;
  geographicCoordinates?: GeoCoordinates;
}

export interface MalvoIdentity {
  id: string;
  itemId: string;
  fullName: string | null;
  companyName?: string;
  socialName?: string | null;
  companiesCnpj?: string[];
  document: string | null;
  /** Typically "CPF" | "CNPJ"; passed through verbatim. */
  documentType: string | null;
  taxNumber: string | null;
  birthDate: string | null;
  jobTitle: string | null;
  establishmentCode?: string;
  establishmentName?: string;
  addresses: IdentityAddress[] | null;
  phoneNumbers: IdentityPhone[] | null;
  emails: IdentityEmail[] | null;
  relations: IdentityRelation[] | null;
  /** Conservative | Moderate | Aggressive */
  investorProfile?: string;
  /** Open Finance (Regulado) pass-through subtree. */
  qualifications?: unknown;
  /** Open Finance (Regulado) pass-through subtree. */
  financialRelationships?: unknown;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Investments                                                         */
/* ------------------------------------------------------------------ */

export interface InvestmentInsurer {
  name: string;
  cnpj: string;
}

export interface InvestmentMetadata {
  taxRegime?: string | null;
  proposalNumber?: string | null;
  processNumber?: string | null;
  fundName?: string | null;
  insurer?: InvestmentInsurer | null;
}

export interface MalvoInvestment {
  id: string;
  itemId: string;
  type: InvestmentType;
  subtype?: string | null;
  number?: string | null;
  name: string;
  /** Mutual funds: the fund CNPJ. */
  code?: string | null;
  isin?: string | null;
  balance: number;
  amount?: number | null;
  value?: number | null;
  quantity?: number | null;
  currencyCode: string;
  /** Income taxes (IR). */
  taxes?: number | null;
  /** Financial taxes (IOF). */
  taxes2?: number | null;
  date: string;
  owner?: string | null;
  amountProfit?: number | null;
  amountWithdrawal?: number | null;
  amountOriginal?: number | null;
  lastMonthRate?: number | null;
  lastTwelveMonthsRate?: number | null;
  annualRate?: number | null;
  /** e.g. `30` = 30% of CDI. */
  rate?: number | null;
  rateType?: string | null;
  fixedAnnualRate?: number | null;
  dueDate?: string | null;
  issueDate?: string | null;
  purchaseDate?: string | null;
  gracePeriodDate?: string | null;
  issuer?: string | null;
  issuerCNPJ?: string | null;
  status?: InvestmentStatus | null;
  metadata?: InvestmentMetadata | null;
}

export interface InvestmentExpenses {
  serviceTax?: number | null;
  brokerageFee?: number | null;
  incomeTax?: number | null;
  tradingAssetsNoticeFee?: number | null;
  maintenanceFee?: number | null;
  settlementFee?: number | null;
  clearingFee?: number | null;
  stockExchangeFee?: number | null;
  custodyFee?: number | null;
  operatingFee?: number | null;
  other?: number | null;
}

export interface InvestmentTransaction {
  id: string;
  type: InvestmentTransactionType;
  /** CREDIT | DEBIT */
  movementType: string | null;
  quantity?: number | null;
  value?: number | null;
  amount?: number | null;
  netAmount?: number | null;
  agreedRate?: number | null;
  brokerageNumber?: string | null;
  date: string;
  tradeDate?: string | null;
  description?: string | null;
  expenses?: InvestmentExpenses | null;
}

/* ------------------------------------------------------------------ */
/* Loans & bills                                                       */
/* ------------------------------------------------------------------ */

export interface LoanInterestRate {
  taxType?: string;
  interestRateType?: string;
  taxPeriodicity?: string;
  /** e.g. "21/252". */
  calculation?: string;
  referentialRateIndexerType?: string;
  referentialRateIndexerSubType?: string;
  referentialRateIndexerAdditionalInfo?: string;
  /** 1 = 100%. */
  preFixedRate?: number;
  /** 1 = 100%. */
  postFixedRate?: number;
  additionalInfo?: string;
}

export interface LoanContractedFee {
  name?: string;
  code?: string;
  chargeType?: string;
  charge?: string;
  amount?: number;
  rate?: number;
}

export interface LoanContractedFinanceCharge {
  type?: string;
  additionalInfo?: string;
  rate?: number;
}

export interface LoanWarranty {
  currencyCode?: string;
  type?: string;
  subtype?: string;
  amount?: number;
}

export interface LoanCurrencyValue {
  value: number;
  currencyCode: string;
}

export interface LoanBalloonPayment {
  dueDate: string;
  amount: LoanCurrencyValue;
}

export interface LoanInstallments {
  typeNumberOfInstallments?: string;
  totalNumberOfInstallments?: number;
  typeContractRemaining?: string;
  contractRemainingNumber?: number;
  paidInstallments?: number;
  dueInstallments?: number;
  pastDueInstallments?: number;
  balloonPayments?: LoanBalloonPayment[];
}

export interface LoanOverParcelFee {
  name?: string;
  code?: string;
  amount?: number;
}

export interface LoanOverParcelCharge {
  type?: string;
  additionalInfo?: string;
  amount?: number;
}

export interface LoanOverParcel {
  fees?: LoanOverParcelFee[];
  charges?: LoanOverParcelCharge[];
}

export interface LoanRelease {
  isOverParcelPayment?: boolean;
  installmentId?: string;
  paidDate?: string;
  currencyCode?: string;
  paidAmount?: number;
  overParcel?: LoanOverParcel;
}

export interface LoanPayments {
  contractOutstandingBalance?: number;
  releases?: LoanRelease[];
}

export interface MalvoLoan {
  id: string;
  itemId: string;
  contractNumber: string | null;
  ipocCode: string | null;
  productName: string;
  /** OFB product subtype, e.g. CREDITO_PESSOAL_COM_CONSIGNACAO. */
  type: string | null;
  /** LOAN | FINANCING | INVOICE_FINANCING | UNARRANGED_ACCOUNT_OVERDRAFT */
  kind: string;
  date: string;
  contractDate?: string;
  disbursementDates?: string[];
  settlementDate?: string;
  contractAmount: number | null;
  currencyCode: string;
  dueDate: string | null;
  installmentPeriodicity?: string;
  installmentPeriodicityAdditionalInfo?: string;
  firstInstallmentDueDate?: string;
  /** Total cost of credit (Custo Efetivo Total). Note the UPPERCASE wire key. */
  CET?: number;
  amortizationScheduled?: string;
  amortizationScheduledAdditionalInfo?: string;
  cnpjConsignee?: string;
  interestRates?: LoanInterestRate[];
  contractedFees?: LoanContractedFee[];
  contractedFinanceCharges?: LoanContractedFinanceCharge[];
  warranties?: LoanWarranty[];
  installments?: LoanInstallments;
  payments?: LoanPayments;
}

export interface BillFinanceCharge {
  id: string;
  /** Only emitted on the retrieve endpoint (omitted on list). */
  creditCardBillId?: string;
  /** LATE_PAYMENT_REMUNERATIVE_INTEREST | LATE_PAYMENT_FEE | LATE_PAYMENT_INTEREST | IOF | OTHER */
  type: string;
  amount: number;
  currencyCode: string;
  /** Mandatory when `type === "OTHER"`. */
  additionalInfo?: string;
}

export interface BillPayment {
  id: string;
  /** INSTALLMENT_PAYMENT | FULL_PAYMENT | OTHER_PAYMENT */
  valueType: string;
  paymentDate: string;
  /** DEBIT_ACCOUNT | BANK_SLIP | PAYROLL_DEDUCTION | PIX */
  paymentMode: string | null;
  amount: number;
  currencyCode: string;
}

export interface CreditCardBill {
  id: string;
  accountId: string;
  dueDate: string;
  totalAmount: number;
  totalAmountCurrencyCode: string;
  minimumPaymentAmount: number | null;
  allowsInstallments: boolean | null;
  financeCharges: BillFinanceCharge[];
  payments: BillPayment[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export interface Category {
  /** Stable 8-digit numeric id (level-1 `XX000000`, level-2 `XXYY0000`, ...). */
  id: string;
  description: string;
  descriptionTranslated?: string;
  parentId?: string | null;
  parentDescription?: string | null;
}

export interface ClientCategoryRule {
  description: string;
  /** Resolved description of `categoryId`. */
  category: string;
  categoryId: string;
  clientId: string;
  transactionType?: "DEBIT" | "CREDIT" | null;
  accountType?: "CHECKING_ACCOUNT" | "CREDIT_CARD" | null;
  /** exact (default) | contains | startsWith | endsWith */
  matchType?: string;
}

/* ------------------------------------------------------------------ */
/* Consents                                                            */
/* ------------------------------------------------------------------ */

export interface Consent {
  id: string;
  itemId: string;
  status: ConsentStatus;
  products: string[];
  /** Official Pluggy wire key (was `permissions`). */
  openFinancePermissionsGranted: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Merchants                                                           */
/* ------------------------------------------------------------------ */

export interface Merchant {
  name: string;
  businessName: string;
  /** Digits only. */
  cnpj: string;
  cnae: string;
  category: string;
}

export interface MerchantsResponse {
  foundMerchants: Merchant[];
  notFoundMerchants: string[];
  invalidCnpjs: string[];
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

/**
 * A registered webhook endpoint. `headers` are write-only (accepted on
 * create/update, never returned). `disabled` is the timestamp it was disabled,
 * or `null` when active.
 */
export interface Webhook {
  id: string;
  event: WebhookEventType;
  url: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Client & request options                                            */
/* ------------------------------------------------------------------ */

export interface MalvoClientOptions {
  /** Application clientId from the Malvo Dashboard. */
  clientId: string;
  /** Application clientSecret — keep server-side only. */
  clientSecret: string;
  /** API origin. Default `"https://api.malvo.io"`. */
  baseUrl?: string;
  /** Inject a custom `fetch` (tests / runtimes without a global fetch). */
  fetch?: typeof fetch;
  /**
   * How long to reuse an apiKey before proactively re-authenticating, in ms.
   * The apiKey TTL is 2h; default is ~1h50 (`6_600_000`).
   */
  apiKeyTtlMs?: number;
  /** Max retries on `429 Too Many Requests`. Default `4`. */
  maxRetries?: number;
}

export interface ConnectorFilters {
  /** Connector name or alike name. */
  name?: string;
  /** Country codes to filter available connectors (e.g. `["BR"]`). */
  countries?: string[];
  types?: ConnectorType[];
  /** Recover sandbox connectors. Default `false`. */
  sandbox?: boolean;
  /** Filter in (`true`) or out (`false`) Open Finance connectors. */
  isOpenFinance?: boolean;
  /** Filter in/out payment-initiation connectors (always data-only on Malvo). */
  supportsPaymentInitiation?: boolean;
  /** Malvo extension: filter by connector ids. */
  ids?: number[];
  /** Malvo extension: filter by supported products. */
  products?: Product[];
}

/** Plain `{ name: value }` map of connector credentials / MFA answers. */
export type Parameters = Record<string, string>;

/** Page-based list filters (`page` / `pageSize`, max `pageSize` 500). */
export interface PageFilters {
  page?: number;
  pageSize?: number;
}

/** Options for {@link MalvoClient.createConnectToken}. */
export interface ConnectTokenOptions {
  /** Url where item-event notifications will be sent. */
  webhookUrl?: string;
  /** A unique identifier for your end-user, echoed back on the item. */
  clientUserId?: string;
  /** Redirect URI for the Open Finance OAuth flow. */
  oauthRedirectUri?: string;
  /** Avoid creating duplicate items for the same user. */
  avoidDuplicates?: boolean;
  /** Restrict the products the widget may collect. */
  products?: Product[];
}

/** Options for {@link MalvoClient.createItem}. */
export interface CreateItemOptions {
  /** Url where item-event notifications will be sent. */
  webhookUrl?: string;
  /** A unique identifier for your end-user. */
  clientUserId?: string;
  /** Products to include in execution/collection. Defaults to the connector's. */
  products?: Product[];
  /** Avoid creating a duplicate item for the same user. */
  avoidDuplicates?: boolean;
  /** Redirect URI for the Open Finance OAuth flow. */
  oauthRedirectUri?: string;
}

/**
 * Options for {@link MalvoClient.updateItem}. Superset of {@link CreateItemOptions}:
 * `connectorId` binds an imported snapshot to a real Open Finance connector at
 * adoption time.
 */
export interface UpdateItemOptions extends CreateItemOptions {
  connectorId?: number;
}

/** Page-based transaction filters (`GET /transactions`). */
export interface TransactionFilters extends PageFilters {
  /** Filter `date <= to`. ISO date or `YYYY-MM-DD`. */
  to?: string;
  /** Filter `date >= from`. ISO date or `YYYY-MM-DD`. */
  from?: string;
  /** Filter `createdAt >= createdAtFrom`. Mutually exclusive with `from`. */
  createdAtFrom?: string;
  /** Filter to specific transaction ids (max 500). */
  ids?: string[];
}

/** Cursor transaction filters (`GET /v2/transactions`). */
export interface TransactionCursorFilters {
  /** Filter `date >= dateFrom`. Mutually exclusive with `createdAtFrom`. */
  dateFrom?: string;
  /** Filter `date <= dateTo`. */
  dateTo?: string;
  /** Filter `createdAt >= createdAtFrom`. Mutually exclusive with `dateFrom`. */
  createdAtFrom?: string;
  /** Opaque cursor from the previous page's `next`. */
  after?: string;
  /** Filter to specific transaction ids (max 500). */
  ids?: string[];
}

/** Investment list filters. */
export type InvestmentsFilters = PageFilters;

/** Consent list filters. */
export type ConsentFilters = PageFilters;

export interface CreateCategoryRuleRequest {
  description: string;
  categoryId: string;
  matchType?: "exact" | "contains" | "startsWith" | "endsWith";
  transactionType?: "DEBIT" | "CREDIT";
  accountType?: "CHECKING_ACCOUNT" | "CREDIT_CARD";
}

/** Params accepted by {@link MalvoClient.updateWebhook}. */
export interface UpdateWebhook {
  url?: string;
  event?: WebhookEventType;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface ConnectTokenResponse {
  accessToken: string;
}

/* ------------------------------------------------------------------ */
/* Account statements (`GET /accounts/{id}/statements`)                */
/* ------------------------------------------------------------------ */

/** A monthly account statement file (Open Finance connectors). */
export interface AccountStatement {
  id: string;
  /** Month and year of the statement, e.g. `"2025-01"`. */
  monthYear: string;
  /** Signed URL to download the statement file, valid ~30 minutes. */
  url: string;
}

/* ------------------------------------------------------------------ */
/* Intelligence & enrichment                                           */
/* ------------------------------------------------------------------ */

/** One transaction submitted to {@link MalvoClient.enrichTransactions} (`POST /categorization`). */
export interface EnrichTransactionInput {
  id: string;
  /** Signed amount. Credit-card convention: purchases positive, payments negative. */
  amount: number;
  /** ISO date or `YYYY-MM-DD`. */
  date: string;
  description: string;
  /** `CHECKING_ACCOUNT` | `SAVINGS_ACCOUNT` | `CREDIT_CARD`. */
  accountType?: AccountSubtype | string;
  isBusinessAccount?: boolean;
  paymentData?: {
    payer?: { document?: string };
    receiver?: { document?: string };
  };
  /** Merchant Category Code, used for credit-card enrichment. */
  creditCardMcc?: number;
}

/** Result of enriching one transaction. */
export interface EnrichedTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  merchant?: { name?: string; businessName?: string; cnpj?: string };
  category: string;
}

/** One aggregation window of {@link ItemInsights}. */
export interface InsightWindow {
  count: number;
  amount: number;
  avg: number;
  min: number;
  max: number;
  creditDebitRatio: number;
  categories: Record<string, number>;
  byDate: Record<string, number>;
  byAmount: Record<string, number>;
  bySubtype: Record<string, number>;
  byType: Record<string, number>;
}

/** Insight windows (`M1`, `M3`, `M12`, `allTime`). */
export interface InsightWindows {
  M1: InsightWindow;
  M3: InsightWindow;
  M12: InsightWindow;
  allTime: InsightWindow;
}

/** Per-item insights returned by {@link MalvoClient.fetchItemInsights} (`POST /book`). */
export interface ItemInsights {
  itemId: string;
  bankAccount?: InsightWindows;
  creditCard?: InsightWindows;
}

/** A detected recurring charge (`POST /recurring-payments`). */
export interface RecurringPayment {
  /** Normalized description the group was keyed on. */
  description: string;
  averageAmount: number;
  /** Transaction ids that make up the recurring series, oldest first. */
  occurrences: string[];
  /** Cadence regularity in `[0,1]`; 1 = perfectly even monthly cadence. */
  regularityScore: number;
}

/* ------------------------------------------------------------------ */
/* Type aliases                                                        */
/*                                                                     */
/* Short, un-prefixed names for the core data entities (the `Malvo*`   */
/* names remain exported too).                                         */
/* ------------------------------------------------------------------ */

export type Item = MalvoItem;
export type Account = MalvoAccount;
export type Transaction = MalvoTransaction;
export type Connector = MalvoConnector;
export type Investment = MalvoInvestment;
export type Loan = MalvoLoan;
export type Identity = MalvoIdentity;
/** Alias of {@link MalvoIdentity} for the identity payload. */
export type IdentityResponse = MalvoIdentity;
/** Alias of {@link CreditCardBill} (plural spelling). */
export type CreditCardBills = CreditCardBill;
/** Alias of {@link Product}. */
export type ProductType = Product;

/** @deprecated Use `(itemId, options)` positional args + {@link ConnectTokenOptions}. */
export interface CreateConnectTokenOptions extends ConnectTokenOptions {
  /** Pass an existing itemId to mint an update-mode token. */
  itemId?: string;
}

/** @deprecated Use `createItem(connectorId, parameters, options)`. */
export interface CreateItemRequest {
  connectorId: number;
  parameters?: Parameters;
  webhookUrl?: string;
  clientUserId?: string;
  products?: Product[];
  oauthRedirectUri?: string;
}

/** @deprecated Use `updateItem(id, parameters, options)`. */
export interface UpdateItemRequest extends UpdateItemOptions {
  parameters?: Parameters;
}

/** @deprecated Use {@link TransactionFilters} (the `accountId` is now positional). */
export type TransactionPageFilters = TransactionFilters & { accountId?: string };

/** @deprecated Use {@link InvestmentsFilters} (the `itemId`/`type` are now positional). */
export interface InvestmentFilters extends PageFilters {
  itemId?: string;
  type?: InvestmentType;
}

/** @deprecated Use `createWebhook(event, url, headers)`. */
export interface CreateWebhookRequest {
  url: string;
  event: WebhookEventType;
  headers?: Record<string, string>;
  enabled?: boolean;
}

/** @deprecated Use {@link UpdateWebhook}. */
export type UpdateWebhookRequest = UpdateWebhook;
