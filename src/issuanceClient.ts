import type { HttpClient } from "./http";
import type {
  CancelFiscalIssuanceRequest,
  ConfirmReconciliationRequest,
  CreateCorrectionLetterRequest,
  CreateFiscalIssuanceRequest,
  CreateFiscalIssuerRequest,
  CreateNumberInvalidationRequest,
  CreateTaxCalculationRequest,
  FiscalAuthorization,
  FiscalAuthorizationRequest,
  FiscalEventRequest,
  FiscalIssuance,
  FiscalIssuanceDraft,
  FiscalIssuanceFilters,
  FiscalIssuancePage,
  FiscalIssuer,
  FiscalIssuerPage,
  FiscalReferenceTable,
  FiscalReferenceTableSummary,
  SelectSimulationScenarioRequest,
  SimulationScenario,
  FiscalValidationResult,
  IssuanceBatch,
  IssuanceBatchDocument,
  IssuanceBatchPage,
  Reconciliation,
  ReconciliationCandidates,
  ReconciliationChangePage,
  ReconciliationMode,
  ReconciliationPage,
  TaxCalculation,
  TaxCalculationPage,
  TaxProfile,
  TaxProfilePage,
  TaxProfileValidation,
  TaxProfileVersion,
  TaxProfileVersionPage,
} from "./issuance";

interface Page {
  cursor?: string;
  limit?: number;
}

const command = (key?: string) => ({
  headers: { "Idempotency-Key": key ?? crypto.randomUUID() },
});

const precondition = (version: number, key?: string) => ({
  headers: { "Idempotency-Key": key ?? crypto.randomUUID(), "If-Match": `"${version}"` },
});

/**
 * NF-e issuance surface, reached as `malvo.issuance`. Every path is scoped to
 * one issuer, and every write carries an `Idempotency-Key` — supply your own to
 * make a retry provably the same command.
 *
 * ```ts
 * const issuer = await malvo.issuance.createIssuer({
 *   environment: "homologation", clientUserId: "erp-1",
 *   cnpj: "34163943000157", authorState: "SP", name: "Empresa",
 * });
 * const issuance = await malvo.issuance.create(issuer.id, {
 *   series: 1, externalReference: "pedido-42", invoice,
 * });
 * ```
 */
export class FiscalIssuanceApi {
  constructor(private readonly http: HttpClient) {}

  private path(issuerId: string, suffix = ""): string {
    return `/fiscal/issuers/${encodeURIComponent(issuerId)}${suffix}`;
  }

  /* ----- Issuers ---------------------------------------------------- */

  createIssuer(body: CreateFiscalIssuerRequest, idempotencyKey?: string): Promise<FiscalIssuer> {
    return this.http.request("POST", "/fiscal/issuers", { body, ...command(idempotencyKey) });
  }

  fetchIssuers(filters: Page & { cnpj?: string; clientUserId?: string } = {}): Promise<FiscalIssuerPage> {
    return this.http.request("GET", "/fiscal/issuers", { query: { ...filters } });
  }

  fetchIssuer(issuerId: string): Promise<FiscalIssuer> {
    return this.http.request("GET", this.path(issuerId));
  }

  updateIssuer(issuerId: string, version: number, body: { name: string }, idempotencyKey?: string): Promise<FiscalIssuer> {
    return this.http.request("PATCH", this.path(issuerId), { body, ...precondition(version, idempotencyKey) });
  }

  deactivateIssuer(issuerId: string, version: number, idempotencyKey?: string): Promise<FiscalIssuer> {
    return this.http.request("POST", this.path(issuerId, "/deactivations"), { body: {}, ...precondition(version, idempotencyKey) });
  }

  fetchCapabilities(): Promise<unknown> {
    return this.http.request("GET", "/fiscal/capabilities");
  }

  /* ----- Authorizations --------------------------------------------- */

  requestAuthorization(issuerId: string, body: FiscalAuthorizationRequest, idempotencyKey?: string): Promise<FiscalAuthorization> {
    return this.http.request("POST", this.path(issuerId, "/authorizations"), { body, ...command(idempotencyKey) });
  }

  fetchAuthorization(issuerId: string, authorizationId: string): Promise<FiscalAuthorization> {
    return this.http.request("GET", this.path(issuerId, `/authorizations/${encodeURIComponent(authorizationId)}`));
  }

  revokeAuthorization(issuerId: string, authorizationId: string, version: number, idempotencyKey?: string): Promise<FiscalAuthorization> {
    return this.http.request("DELETE", this.path(issuerId, `/authorizations/${encodeURIComponent(authorizationId)}`), precondition(version, idempotencyKey));
  }

  /* ----- Readiness and certificates --------------------------------- */

  fetchReadiness(issuerId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/readiness"));
  }

  createReadinessCheck(issuerId: string, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, "/readiness-checks"), { body: {}, ...command(idempotencyKey) });
  }

  fetchReadinessCheck(issuerId: string, checkId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/readiness-checks/${encodeURIComponent(checkId)}`));
  }

  uploadCertificate(issuerId: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, "/certificates"), { body, ...command(idempotencyKey) });
  }

  fetchCertificates(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/certificates"), { query: { ...filters } });
  }

  fetchCertificate(issuerId: string, certificateId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}`));
  }

  activateCertificate(issuerId: string, certificateId: string, version: number, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}/activations`), { body: {}, ...precondition(version, idempotencyKey) });
  }

  revokeCertificate(issuerId: string, certificateId: string, version: number, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("DELETE", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}`), precondition(version, idempotencyKey));
  }

  evaluateCertificate(issuerId: string, certificateId: string, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}/evaluations`), { body: {}, ...command(idempotencyKey) });
  }

  fetchCertificateEvaluation(issuerId: string, certificateId: string, evaluationId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}/evaluations/${encodeURIComponent(evaluationId)}`));
  }

  fetchLatestCertificateEvaluation(issuerId: string, certificateId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/certificates/${encodeURIComponent(certificateId)}/evaluations/latest`));
  }

  fetchCertificateBinding(issuerId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/certificate-binding"));
  }

  /* ----- Numbering series ------------------------------------------- */

  createNumberingSeries(issuerId: string, body: { series: number; nextNumber: number }, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, "/numbering-series"), { body, ...command(idempotencyKey) });
  }

  fetchNumberingSeries(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/numbering-series"), { query: { ...filters } });
  }

  fetchNumberingSeriesById(issuerId: string, seriesId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/numbering-series/${encodeURIComponent(seriesId)}`));
  }

  /* ----- Drafts and validation -------------------------------------- */

  createDraft(issuerId: string, body: CreateFiscalIssuanceRequest, idempotencyKey?: string): Promise<FiscalIssuanceDraft> {
    return this.http.request("POST", this.path(issuerId, "/issuance-drafts"), { body, ...command(idempotencyKey) });
  }

  fetchDrafts(issuerId: string, filters: Page = {}): Promise<{ items: FiscalIssuanceDraft[]; nextCursor: string | null }> {
    return this.http.request("GET", this.path(issuerId, "/issuance-drafts"), { query: { ...filters } });
  }

  fetchDraft(issuerId: string, draftId: string): Promise<FiscalIssuanceDraft> {
    return this.http.request("GET", this.path(issuerId, `/issuance-drafts/${encodeURIComponent(draftId)}`));
  }

  updateDraft(issuerId: string, draftId: string, version: number, body: Omit<CreateFiscalIssuanceRequest, "externalReference">, idempotencyKey?: string): Promise<FiscalIssuanceDraft> {
    return this.http.request("PATCH", this.path(issuerId, `/issuance-drafts/${encodeURIComponent(draftId)}`), { body, ...precondition(version, idempotencyKey) });
  }

  deleteDraft(issuerId: string, draftId: string, version: number, idempotencyKey?: string): Promise<void> {
    return this.http.request("DELETE", this.path(issuerId, `/issuance-drafts/${encodeURIComponent(draftId)}`), precondition(version, idempotencyKey));
  }

  validate(issuerId: string, body: { series: number; invoice: Record<string, unknown> }, idempotencyKey?: string): Promise<FiscalValidationResult> {
    return this.http.request("POST", this.path(issuerId, "/validations"), { body, ...command(idempotencyKey) });
  }

  /* ----- Issuances --------------------------------------------------- */

  create(issuerId: string, body: CreateFiscalIssuanceRequest, idempotencyKey?: string): Promise<FiscalIssuance> {
    return this.http.request("POST", this.path(issuerId, "/issuances"), { body, ...command(idempotencyKey) });
  }

  fetchAll(issuerId: string, filters: FiscalIssuanceFilters = {}): Promise<FiscalIssuancePage> {
    return this.http.request("GET", this.path(issuerId, "/issuances"), { query: { ...filters } });
  }

  fetch(issuerId: string, issuanceId: string): Promise<FiscalIssuance> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}`));
  }

  revise(issuerId: string, issuanceId: string, body: CreateFiscalIssuanceRequest, idempotencyKey?: string): Promise<FiscalIssuance> {
    return this.http.request("POST", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/revisions`), { body, ...command(idempotencyKey) });
  }

  fetchRevisions(issuerId: string, issuanceId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/revisions`), { query: { ...filters } });
  }

  fetchRevision(issuerId: string, issuanceId: string, revisionId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/revisions/${encodeURIComponent(revisionId)}`));
  }

  fetchAttempts(issuerId: string, issuanceId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/attempts`), { query: { ...filters } });
  }

  resolve(issuerId: string, issuanceId: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/resolution-requests`), { body, ...command(idempotencyKey) });
  }

  abort(issuerId: string, issuanceId: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/aborts`), { body, ...command(idempotencyKey) });
  }

  /**
   * Up to fifty documents in one request, the ceiling the official enviNFe
   * layout sets. Each document keeps its own idempotency key and its own
   * result: a failure does not sink the documents beside it.
   */
  createBatch(issuerId: string, documents: IssuanceBatchDocument[], idempotencyKey?: string): Promise<IssuanceBatch> {
    return this.http.request("POST", this.path(issuerId, "/issuance-batches"), { body: { documents }, ...command(idempotencyKey) });
  }

  fetchBatch(issuerId: string, batchId: string): Promise<IssuanceBatch> {
    return this.http.request("GET", this.path(issuerId, `/issuance-batches/${encodeURIComponent(batchId)}`));
  }

  fetchBatches(issuerId: string, filters: Page = {}): Promise<IssuanceBatchPage> {
    return this.http.request("GET", this.path(issuerId, "/issuance-batches"), { query: { ...filters } });
  }

  /* ----- Artifacts ---------------------------------------------------- */

  fetchArtifacts(issuerId: string, issuanceId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/artifacts`), { query: { ...filters } });
  }

  fetchArtifact(issuerId: string, issuanceId: string, artifactId: string): Promise<string> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/artifacts/${encodeURIComponent(artifactId)}`), { responseType: "text" });
  }

  /** The authorized XML, materialized once and identical on every read. */
  fetchXml(issuerId: string, issuanceId: string): Promise<string> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/xml`), { responseType: "text" });
  }

  /**
   * DANFE fields and barcode composed as the MOC defines. The platform does not
   * render the PDF: this returns the data model, not a file.
   */
  fetchDanfe(issuerId: string, issuanceId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/pdf`));
  }

  /* ----- Events ------------------------------------------------------- */

  cancel(issuerId: string, issuanceId: string, body: CancelFiscalIssuanceRequest, idempotencyKey?: string): Promise<FiscalEventRequest> {
    return this.http.request("POST", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/cancellations`), { body, ...command(idempotencyKey) });
  }

  createCorrectionLetter(issuerId: string, issuanceId: string, body: CreateCorrectionLetterRequest, idempotencyKey?: string): Promise<FiscalEventRequest> {
    return this.http.request("POST", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/correction-letters`), { body, ...command(idempotencyKey) });
  }

  fetchCorrectionLetters(issuerId: string, issuanceId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/issuances/${encodeURIComponent(issuanceId)}/correction-letters`), { query: { ...filters } });
  }

  createNumberInvalidation(issuerId: string, body: CreateNumberInvalidationRequest, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, "/number-invalidations"), { body, ...command(idempotencyKey) });
  }

  fetchNumberInvalidations(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/number-invalidations"), { query: { ...filters } });
  }

  fetchNumberInvalidation(issuerId: string, invalidationId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/number-invalidations/${encodeURIComponent(invalidationId)}`));
  }

  fetchEventRequests(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/event-requests"), { query: { ...filters } });
  }

  fetchEventRequest(issuerId: string, eventRequestId: string): Promise<FiscalEventRequest> {
    return this.http.request("GET", this.path(issuerId, `/event-requests/${encodeURIComponent(eventRequestId)}`));
  }

  /* ----- Issued and received documents -------------------------------- */

  fetchDocuments(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/documents"), { query: { ...filters } });
  }

  fetchDocumentChanges(issuerId: string, filters: Page = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, "/documents/changes"), { query: { ...filters } });
  }

  fetchDocument(issuerId: string, accessKey: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/documents/${encodeURIComponent(accessKey)}`));
  }

  fetchDocumentXml(issuerId: string, accessKey: string): Promise<string> {
    return this.http.request("GET", this.path(issuerId, `/documents/${encodeURIComponent(accessKey)}/xml`), { responseType: "text" });
  }

  /* ----- Catalogs ------------------------------------------------------ */

  createCatalogRecord(issuerId: string, resource: "products" | "services" | "customers", body: { externalReference: string; record: Record<string, unknown> }, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/${resource}`), { body, ...command(idempotencyKey) });
  }

  fetchCatalogRecords(issuerId: string, resource: "products" | "services" | "customers", filters: Page & { includeArchived?: boolean } = {}): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/${resource}`), { query: { ...filters } });
  }

  fetchCatalogRecord(issuerId: string, resource: "products" | "services" | "customers", recordId: string): Promise<unknown> {
    return this.http.request("GET", this.path(issuerId, `/${resource}/${encodeURIComponent(recordId)}`));
  }

  updateCatalogRecord(issuerId: string, resource: "products" | "services" | "customers", recordId: string, version: number, body: { record: Record<string, unknown> }, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("PATCH", this.path(issuerId, `/${resource}/${encodeURIComponent(recordId)}`), { body, ...precondition(version, idempotencyKey) });
  }

  archiveCatalogRecord(issuerId: string, resource: "products" | "services" | "customers", recordId: string, version: number, idempotencyKey?: string): Promise<unknown> {
    return this.http.request("POST", this.path(issuerId, `/${resource}/${encodeURIComponent(recordId)}/archivals`), { body: {}, ...precondition(version, idempotencyKey) });
  }

  /* ----- Tax profiles --------------------------------------------------- */

  createTaxProfile(issuerId: string, body: { externalReference: string; name: string }, idempotencyKey?: string): Promise<TaxProfile> {
    return this.http.request("POST", this.path(issuerId, "/tax-profiles"), { body, ...command(idempotencyKey) });
  }

  fetchTaxProfiles(issuerId: string, filters: Page = {}): Promise<TaxProfilePage> {
    return this.http.request("GET", this.path(issuerId, "/tax-profiles"), { query: { ...filters } });
  }

  fetchTaxProfile(issuerId: string, profileId: string): Promise<TaxProfile> {
    return this.http.request("GET", this.path(issuerId, `/tax-profiles/${encodeURIComponent(profileId)}`));
  }

  updateTaxProfile(issuerId: string, profileId: string, version: number, body: { name: string }, idempotencyKey?: string): Promise<TaxProfile> {
    return this.http.request("PATCH", this.path(issuerId, `/tax-profiles/${encodeURIComponent(profileId)}`), { body, ...precondition(version, idempotencyKey) });
  }

  archiveTaxProfile(issuerId: string, profileId: string, version: number, idempotencyKey?: string): Promise<TaxProfile> {
    return this.http.request("POST", this.path(issuerId, `/tax-profiles/${encodeURIComponent(profileId)}/archivals`), { body: {}, ...precondition(version, idempotencyKey) });
  }

  createTaxProfileVersion(issuerId: string, body: { profileId: string; rules: Record<string, unknown> }, idempotencyKey?: string): Promise<TaxProfileVersion> {
    return this.http.request("POST", this.path(issuerId, "/tax-profile-versions"), { body, ...command(idempotencyKey) });
  }

  fetchTaxProfileVersions(issuerId: string, filters: Page & { profileId?: string } = {}): Promise<TaxProfileVersionPage> {
    return this.http.request("GET", this.path(issuerId, "/tax-profile-versions"), { query: { ...filters } });
  }

  fetchTaxProfileVersion(issuerId: string, versionId: string): Promise<TaxProfileVersion> {
    return this.http.request("GET", this.path(issuerId, `/tax-profile-versions/${encodeURIComponent(versionId)}`));
  }

  updateTaxProfileVersion(issuerId: string, versionId: string, version: number, body: { rules: Record<string, unknown> }, idempotencyKey?: string): Promise<TaxProfileVersion> {
    return this.http.request("PATCH", this.path(issuerId, `/tax-profile-versions/${encodeURIComponent(versionId)}`), { body, ...precondition(version, idempotencyKey) });
  }

  validateTaxProfileVersion(issuerId: string, versionId: string, idempotencyKey?: string): Promise<TaxProfileValidation> {
    return this.http.request("POST", this.path(issuerId, `/tax-profile-versions/${encodeURIComponent(versionId)}/validations`), { body: {}, ...command(idempotencyKey) });
  }

  activateTaxProfileVersion(issuerId: string, versionId: string, version: number, effectiveFrom: string, idempotencyKey?: string): Promise<TaxProfileVersion> {
    return this.http.request("POST", this.path(issuerId, `/tax-profile-versions/${encodeURIComponent(versionId)}/activations`), { body: { effectiveFrom }, ...precondition(version, idempotencyKey) });
  }

  retireTaxProfileVersion(issuerId: string, versionId: string, version: number, idempotencyKey?: string): Promise<TaxProfileVersion> {
    return this.http.request("POST", this.path(issuerId, `/tax-profile-versions/${encodeURIComponent(versionId)}/retirements`), { body: {}, ...precondition(version, idempotencyKey) });
  }

  /* ----- Tax calculation and official tables ---------------------------- */

  createTaxCalculation(issuerId: string, body: CreateTaxCalculationRequest, idempotencyKey?: string): Promise<TaxCalculation> {
    return this.http.request("POST", this.path(issuerId, "/tax-calculations"), { body, ...command(idempotencyKey) });
  }

  fetchTaxCalculations(issuerId: string, filters: Page = {}): Promise<TaxCalculationPage> {
    return this.http.request("GET", this.path(issuerId, "/tax-calculations"), { query: { ...filters } });
  }

  fetchTaxCalculation(issuerId: string, calculationId: string): Promise<TaxCalculation> {
    return this.http.request("GET", this.path(issuerId, `/tax-calculations/${encodeURIComponent(calculationId)}`));
  }

  fetchReferenceTables(issuerId: string): Promise<{ items: FiscalReferenceTableSummary[] }> {
    return this.http.request("GET", this.path(issuerId, "/reference-tables"));
  }

  fetchReferenceTable(issuerId: string, name: string): Promise<FiscalReferenceTable> {
    return this.http.request("GET", this.path(issuerId, `/reference-tables/${encodeURIComponent(name)}`));
  }

  /* ----- Simulated SEFAZ ------------------------------------------------- */

  fetchSimulationScenario(issuerId: string): Promise<SimulationScenario> {
    return this.http.request("GET", this.path(issuerId, "/simulation-scenarios"));
  }

  selectSimulationScenario(issuerId: string, body: SelectSimulationScenarioRequest): Promise<SimulationScenario> {
    return this.http.request("POST", this.path(issuerId, "/simulation-scenarios"), { body });
  }

  resetSimulationScenario(issuerId: string): Promise<SimulationScenario> {
    return this.http.request("POST", this.path(issuerId, "/simulation-scenarios/resets"), { body: {} });
  }

  /* ----- Reconciliation -------------------------------------------------- */

  fetchReconciliationCandidates(issuerId: string, accessKey: string, mode: ReconciliationMode, window: { from?: string; to?: string } = {}): Promise<ReconciliationCandidates> {
    return this.http.request("GET", this.path(issuerId, `/documents/${encodeURIComponent(accessKey)}/reconciliation-candidates`), { query: { mode, ...window } });
  }

  confirmReconciliation(issuerId: string, body: ConfirmReconciliationRequest, idempotencyKey?: string): Promise<Reconciliation> {
    return this.http.request("POST", this.path(issuerId, "/reconciliations"), { body, ...command(idempotencyKey) });
  }

  fetchReconciliations(issuerId: string, filters: Page = {}): Promise<ReconciliationPage> {
    return this.http.request("GET", this.path(issuerId, "/reconciliations"), { query: { ...filters } });
  }

  fetchReconciliation(issuerId: string, reconciliationId: string): Promise<Reconciliation> {
    return this.http.request("GET", this.path(issuerId, `/reconciliations/${encodeURIComponent(reconciliationId)}`));
  }

  fetchReconciliationChanges(issuerId: string, filters: Page = {}): Promise<ReconciliationChangePage> {
    return this.http.request("GET", this.path(issuerId, "/reconciliations/changes"), { query: { ...filters } });
  }

  reverseReconciliation(issuerId: string, reconciliationId: string, body: { actor: string; reason: string }, idempotencyKey?: string): Promise<Reconciliation> {
    return this.http.request("POST", this.path(issuerId, `/reconciliations/${encodeURIComponent(reconciliationId)}/reverse`), { body, ...command(idempotencyKey) });
  }

  revalidateReconciliation(issuerId: string, reconciliationId: string, idempotencyKey?: string): Promise<Reconciliation> {
    return this.http.request("POST", this.path(issuerId, `/reconciliations/${encodeURIComponent(reconciliationId)}/revalidate`), { body: {}, ...command(idempotencyKey) });
  }
}
