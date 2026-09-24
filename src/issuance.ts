/**
 * NF-e issuance in the homologation environment. Every operation is scoped to
 * one issuer, which binds application, client reference, CNPJ and environment.
 *
 * Write operations require an `Idempotency-Key`; the client generates one when
 * the caller does not supply it, so a retried call never issues twice.
 */

export type FiscalIssuerStatus = "ACTIVE" | "INACTIVE";

export interface FiscalIssuer {
  id: string;
  environment: string;
  clientUserId: string;
  cnpj: string;
  authorState: string;
  name: string;
  status: FiscalIssuerStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFiscalIssuerRequest {
  environment: "homologation";
  clientUserId: string;
  cnpj: string;
  authorState: string;
  name: string;
}

export interface FiscalIssuerPage {
  data: FiscalIssuer[];
  nextCursor: string;
}

export interface FiscalAuthorizationRequest {
  representativeName: string;
  representativeTaxId: string;
  permissions: string[];
  evidenceReference: string;
  evidenceSha256: string;
  expiresAt: string;
  termsVersion: "fiscal-issuance-hml-v1";
}

export interface FiscalAuthorization {
  id: string;
  issuerId: string;
  state: string;
  permissions: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type FiscalIssuanceState =
  | "Queued"
  | "Submitting"
  | "AwaitingProtocol"
  | "PendingResolution"
  | "Authorized"
  | "Rejected"
  | "Aborted";

export interface FiscalIssuance {
  id: string;
  taxResolution?: FiscalIssuanceTaxResolution | null;
  currentRevisionId: string | null;
  model: number;
  series: number;
  number: number;
  state: FiscalIssuanceState;
  version: number;
  externalReference: string;
  accessKey: string | null;
  protocolNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalIssuancePage {
  items: FiscalIssuance[];
  nextCursor: string | null;
}

export interface FiscalIssuanceFilters {
  cursor?: string;
  limit?: number;
  state?: FiscalIssuanceState;
  series?: number;
  externalReference?: string;
}

export type FiscalIssuanceMode = "EXPLICIT" | "PROFILE";

/**
 * EXPLICIT carries the whole NF-e. PROFILE names the company's tax profile
 * and the operation and leaves CFOP, ICMS and the platform-owned totals out:
 * the platform derives them and records the calculation as evidence.
 */
export interface CreateFiscalIssuanceRequest {
  mode: FiscalIssuanceMode;
  series: number;
  invoice: Record<string, unknown>;
  settingsVersionId?: string;
  taxProfile?: string;
  operation?: "SALE";
}

export interface FiscalIssuanceTaxResolution {
  mode: FiscalIssuanceMode;
  profileId: string | null;
  profileVersionId: string | null;
  rulesHash: string | null;
  calculationId: string | null;
  resolvedAt: string;
}

export interface FiscalIssuanceDraft {
  id: string;
  series: number;
  externalReference: string;
  snapshotJson: string;
  snapshotHash: string;
  version: number;
  promotedOperationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalValidationCheck {
  name: string;
  satisfied: boolean;
  code: string | null;
  message: string | null;
}

export interface FiscalValidationResult {
  valid: boolean;
  checks: FiscalValidationCheck[];
}

export interface FiscalEventRequest {
  id: string;
  sourceOperationId: string;
  accessKey: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancelFiscalIssuanceRequest {
  /** 15 to 255 characters, as the SEFAZ layout requires. */
  reason: string;
  operationDidNotOccur: boolean;
}

export interface CreateNumberInvalidationRequest {
  series: number;
  firstNumber: number;
  lastNumber: number;
  reason: string;
}

export interface CreateCorrectionLetterRequest {
  /** 15 to 1000 characters, as the SEFAZ layout requires. */
  correction: string;
}

export interface TaxProfile {
  id: string;
  externalReference: string;
  name: string;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxProfilePage {
  items: TaxProfile[];
  nextCursor: string | null;
}

export type TaxProfileVersionState = "DRAFT" | "ACTIVE" | "RETIRED";

export interface TaxProfileVersion {
  id: string;
  profileId: string;
  ordinal: number;
  state: TaxProfileVersionState;
  rulesJson: string;
  rulesHash: string;
  version: number;
  effectiveFrom: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxProfileVersionPage {
  items: TaxProfileVersion[];
  nextCursor: string | null;
}

export interface TaxProfileValidation {
  versionId: string;
  rulesHash: string;
  valid: boolean;
  code: string | null;
  message: string | null;
  schemaVersion: string;
  schemaHash: string;
}

export interface TaxCalculationItem {
  number: number;
  ncm: string;
  unitAmount: string;
  quantity: string;
  freight?: string;
  insurance?: string;
  other?: string;
  discount?: string;
  taxableBase?: string;
  includeInTotal?: boolean;
  freightFromIssuer?: boolean;
}

export interface CreateTaxCalculationRequest {
  profileVersionId: string;
  externalReference: string;
  operation: { items: TaxCalculationItem[] };
}

export interface TaxCalculation {
  id: string;
  profileVersionId: string;
  externalReference: string;
  requestJson: string;
  requestHash: string;
  resultJson: string;
  resultHash: string;
  schemaVersion: string;
  schemaHash: string;
  createdAt: string;
}

export interface TaxCalculationPage {
  items: TaxCalculation[];
  nextCursor: string | null;
}

export interface FiscalReferenceTableSummary {
  name: string;
  source: string;
  version: string;
  entryCount: number;
}

export interface FiscalReferenceTable {
  name: string;
  source: string;
  version: string;
  schemaHash: string;
  entries: { code: string; description: string }[];
}

export type SimulationScenarioName =
  | "AUTHORIZED"
  | "REJECTED_DUPLICATE"
  | "REJECTED_SCHEMA"
  | "REJECTED_ICMS_MISMATCH"
  | "REJECTED_HOMOLOGATION_RECIPIENT"
  | "PENDING_THEN_AUTHORIZED"
  | "SERVICE_UNAVAILABLE"
  | "EVENT_REGISTERED"
  | "EVENT_REJECTED_DUPLICATE"
  | "EVENT_REJECTED_LATE_CANCELLATION"
  | "EVENT_REJECTED_ALREADY_CANCELLED"
  | "EVENT_REJECTED_OUT_OF_TERM"
  | "INVALIDATION_HOMOLOGATED"
  | "INVALIDATION_REJECTED_NUMBER_USED"
  | "INVALIDATION_REJECTED_DUPLICATE_RANGE";

export type SimulationService = "AUTHORIZATION" | "EVENT" | "INVALIDATION";

export interface SimulationScenarioOption {
  scenario: SimulationScenarioName;
  service: SimulationService;
  code: string;
  reason: string;
}

export interface SimulationScenario {
  scenario: SimulationScenarioName;
  service: SimulationService;
  outcome: { code: string; reason: string };
  available: SimulationScenarioOption[];
}

export interface SelectSimulationScenarioRequest {
  scenario: SimulationScenarioName;
}

export type ReconciliationMode = "PAYABLE" | "RECEIVABLE";

export interface ReconciliationCandidate {
  transactionId: string;
  transactionDate: string;
  amountExact: string;
  candidateToken: string;
  eligible: boolean;
  reason?: string;
  amountCents?: string;
  requiresPaymentTermsConfirmation?: boolean;
}

export interface ReconciliationCandidates {
  status: string;
  reason?: string;
  window: { from: string; to: string };
  mode: ReconciliationMode;
  ruleVersion: string;
  observedAt: string;
  scanned: number;
  excluded: Record<string, number>;
  candidates: ReconciliationCandidate[];
}

export type ReconciliationStatus = "CONFIRMED" | "REQUIRES_REVIEW" | "REVERSED";

export interface ReconciliationEvent {
  id: string;
  type: ReconciliationStatus;
  reason?: string;
  actor: string;
  occurredAt: string;
}

export interface Reconciliation {
  id: string;
  connectionId: string;
  clientUserId: string;
  cnpj: string;
  accessKey: string;
  transactionId: string;
  transactionDate: string;
  amountCents: string;
  mode: ReconciliationMode;
  status: ReconciliationStatus;
  reason?: string;
  ruleVersion: string;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  events: ReconciliationEvent[];
}

export interface ReconciliationPage {
  data: Reconciliation[];
  nextCursor: string;
}

export interface ReconciliationChange {
  cursor: string;
  event: ReconciliationEvent;
  record: Reconciliation;
}

export interface ReconciliationChangePage {
  data: ReconciliationChange[];
  nextCursor: string;
}

export interface ConfirmReconciliationRequest {
  accessKey: string;
  transactionId: string;
  transactionDate: string;
  candidateToken: string;
  window: { from: string; to: string };
  mode?: ReconciliationMode;
  actor: string;
  confirmedByHuman: true;
  paymentTermsConfirmed?: boolean;
}

/** The official enviNFe layout accepts up to fifty NF-e in one lote. */
export const MAXIMUM_BATCH_DOCUMENTS = 50;

export interface IssuanceBatchDocument {
  idempotencyKey: string;
  mode: FiscalIssuanceMode;
  series: number;
  settingsVersionId?: string;
  taxProfile?: string;
  operation?: "SALE";
  invoice: Record<string, unknown>;
}

export interface IssuanceBatchItem {
  position: number;
  idempotencyKey: string;
  operationId: string | null;
  code: string | null;
  message: string | null;
}

export interface IssuanceBatch {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  items: IssuanceBatchItem[];
  createdAt: string;
}

export interface IssuanceBatchPage {
  items: IssuanceBatch[];
  nextCursor: string | null;
}

export interface WebhookSecretRotation {
  secret: string;
  hint: string;
  /** The signing secret belongs to the application, not to one webhook. */
  scope: "APPLICATION";
  previousSecretExpiresAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string | null;
  /** Null on a test delivery, which has no business event behind it. */
  eventId: string | null;
  eventType: string;
  attempt: number;
  targetUrl: string;
  statusCode: number | null;
  error: string | null;
  responseExcerpt: string | null;
  durationMs: number;
  test: boolean;
  replayedFrom: string | null;
  occurredAt: string;
}

export interface WebhookDeliveryPage {
  results: WebhookDelivery[];
  nextCursor: string;
}

export interface PlatformWebhookEvent {
  id: string;
  eventType: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  attempts: number;
  lastStatusCode: number | null;
  createdAt: string;
  deliveredAt: string | null;
  payload: Record<string, unknown>;
}

export interface FiscalEventPage {
  results: PlatformWebhookEvent[];
  nextCursor: string;
}

export type FiscalSandboxScenarioId =
  | "DEFAULT"
  | "NO_DOCUMENTS"
  | "DOCUMENT_CANCELLED"
  | "SYNC_FAILED"
  | "CERTIFICATE_EXPIRING"
  | "CERTIFICATE_EXPIRED";

export interface FiscalSandboxScenario {
  id: string;
  connectionId: string | null;
  scenario: FiscalSandboxScenarioId;
  createdAt: string;
  updatedAt: string;
  resetAt: string | null;
}

export interface FiscalSandboxScenarioState {
  scenario: FiscalSandboxScenario;
  available: FiscalSandboxScenarioId[];
}
