import assert from 'node:assert/strict';
import test from 'node:test';
import { MalvoClient } from '../dist/index.js';

/**
 * The SDK promises one method per published issuance route. This test drives
 * every method and compares the paths it produces with the routes the fiscal
 * API publishes, so a new route without an SDK method is visible here.
 */

const ISSUER = 'issuer';
const ID = 'id';
const VERSION = 1;
const body = {};

function surface(api) {
  return [
    () => api.fetchCapabilities(),
    () => api.createIssuer(body),
    () => api.fetchIssuers(),
    () => api.fetchIssuer(ISSUER),
    () => api.updateIssuer(ISSUER, VERSION, { name: 'Nome' }),
    () => api.deactivateIssuer(ISSUER, VERSION),

    () => api.requestAuthorization(ISSUER, body),
    () => api.fetchAuthorization(ISSUER, ID),
    () => api.revokeAuthorization(ISSUER, ID, VERSION),

    () => api.fetchReadiness(ISSUER),
    () => api.createReadinessCheck(ISSUER),
    () => api.fetchReadinessCheck(ISSUER, ID),
    () => api.uploadCertificate(ISSUER, body),
    () => api.fetchCertificates(ISSUER),
    () => api.fetchCertificate(ISSUER, ID),
    () => api.activateCertificate(ISSUER, ID, VERSION),
    () => api.revokeCertificate(ISSUER, ID, VERSION),
    () => api.evaluateCertificate(ISSUER, ID),
    () => api.fetchCertificateEvaluation(ISSUER, ID, 'evaluation'),
    () => api.fetchLatestCertificateEvaluation(ISSUER, ID),
    () => api.fetchCertificateBinding(ISSUER),

    () => api.createNumberingSeries(ISSUER, { series: 1, nextNumber: 1 }),
    () => api.fetchNumberingSeries(ISSUER),
    () => api.fetchNumberingSeriesById(ISSUER, ID),

    () => api.createDraft(ISSUER, body),
    () => api.fetchDrafts(ISSUER),
    () => api.fetchDraft(ISSUER, ID),
    () => api.updateDraft(ISSUER, ID, VERSION, body),
    () => api.deleteDraft(ISSUER, ID, VERSION),
    () => api.validate(ISSUER, body),

    () => api.create(ISSUER, body),
    () => api.fetchAll(ISSUER),
    () => api.fetch(ISSUER, ID),
    () => api.revise(ISSUER, ID, body),
    () => api.fetchRevisions(ISSUER, ID),
    () => api.fetchRevision(ISSUER, ID, 'revision'),
    () => api.fetchAttempts(ISSUER, ID),
    () => api.resolve(ISSUER, ID, body),
    () => api.abort(ISSUER, ID, body),
    () => api.createBatch(ISSUER, []),
    () => api.fetchBatch(ISSUER, ID),
    () => api.fetchBatches(ISSUER),
    () => api.fetchArtifacts(ISSUER, ID),
    () => api.fetchArtifact(ISSUER, ID, 'artifact'),
    () => api.fetchXml(ISSUER, ID),
    () => api.fetchDanfe(ISSUER, ID),

    () => api.cancel(ISSUER, ID, body),
    () => api.createCorrectionLetter(ISSUER, ID, body),
    () => api.fetchCorrectionLetters(ISSUER, ID),
    () => api.createNumberInvalidation(ISSUER, body),
    () => api.fetchNumberInvalidations(ISSUER),
    () => api.fetchNumberInvalidation(ISSUER, ID),
    () => api.fetchEventRequests(ISSUER),
    () => api.fetchEventRequest(ISSUER, ID),

    () => api.fetchDocuments(ISSUER),
    () => api.fetchDocumentChanges(ISSUER),
    () => api.fetchDocument(ISSUER, 'chave'),
    () => api.fetchDocumentXml(ISSUER, 'chave'),

    ...['products', 'services', 'customers'].flatMap((resource) => [
      () => api.createCatalogRecord(ISSUER, resource, body),
      () => api.fetchCatalogRecords(ISSUER, resource),
      () => api.fetchCatalogRecord(ISSUER, resource, ID),
      () => api.updateCatalogRecord(ISSUER, resource, ID, VERSION, body),
      () => api.archiveCatalogRecord(ISSUER, resource, ID, VERSION),
    ]),

    () => api.createTaxProfile(ISSUER, body),
    () => api.fetchTaxProfiles(ISSUER),
    () => api.fetchTaxProfile(ISSUER, ID),
    () => api.updateTaxProfile(ISSUER, ID, VERSION, { name: 'Nome' }),
    () => api.archiveTaxProfile(ISSUER, ID, VERSION),
    () => api.createTaxProfileVersion(ISSUER, body),
    () => api.fetchTaxProfileVersions(ISSUER),
    () => api.fetchTaxProfileVersion(ISSUER, ID),
    () => api.updateTaxProfileVersion(ISSUER, ID, VERSION, body),
    () => api.validateTaxProfileVersion(ISSUER, ID),
    () => api.activateTaxProfileVersion(ISSUER, ID, VERSION, '2026-10-01T03:00:00Z'),
    () => api.retireTaxProfileVersion(ISSUER, ID, VERSION),

    () => api.createTaxCalculation(ISSUER, body),
    () => api.fetchTaxCalculations(ISSUER),
    () => api.fetchTaxCalculation(ISSUER, ID),
    () => api.fetchReferenceTables(ISSUER),
    () => api.fetchReferenceTable(ISSUER, 'CST_ICMS'),

    () => api.fetchSimulationScenario(ISSUER),
    () => api.selectSimulationScenario(ISSUER, { scenario: 'REJECTED_ICMS_MISMATCH' }),
    () => api.resetSimulationScenario(ISSUER),

    () => api.fetchReconciliationCandidates(ISSUER, 'chave', 'RECEIVABLE'),
    () => api.confirmReconciliation(ISSUER, body),
    () => api.fetchReconciliations(ISSUER),
    () => api.fetchReconciliation(ISSUER, ID),
    () => api.fetchReconciliationChanges(ISSUER),
    () => api.reverseReconciliation(ISSUER, ID, body),
    () => api.revalidateReconciliation(ISSUER, ID),
  ];
}

const PUBLISHED = [
  'GET /fiscal/capabilities',
  'GET /fiscal/issuers',
  'POST /fiscal/issuers',
  'GET /fiscal/issuers/{issuerId}',
  'PATCH /fiscal/issuers/{issuerId}',
  'POST /fiscal/issuers/{issuerId}/deactivations',
  'POST /fiscal/issuers/{issuerId}/authorizations',
  'GET /fiscal/issuers/{issuerId}/authorizations/{id}',
  'DELETE /fiscal/issuers/{issuerId}/authorizations/{id}',
  'GET /fiscal/issuers/{issuerId}/readiness',
  'POST /fiscal/issuers/{issuerId}/readiness-checks',
  'GET /fiscal/issuers/{issuerId}/readiness-checks/{id}',
  'POST /fiscal/issuers/{issuerId}/certificates',
  'GET /fiscal/issuers/{issuerId}/certificates',
  'GET /fiscal/issuers/{issuerId}/certificates/{id}',
  'DELETE /fiscal/issuers/{issuerId}/certificates/{id}',
  'POST /fiscal/issuers/{issuerId}/certificates/{id}/activations',
  'POST /fiscal/issuers/{issuerId}/certificates/{id}/evaluations',
  'GET /fiscal/issuers/{issuerId}/certificates/{id}/evaluations/{id}',
  'GET /fiscal/issuers/{issuerId}/certificates/{id}/evaluations/latest',
  'GET /fiscal/issuers/{issuerId}/certificate-binding',
  'POST /fiscal/issuers/{issuerId}/numbering-series',
  'GET /fiscal/issuers/{issuerId}/numbering-series',
  'GET /fiscal/issuers/{issuerId}/numbering-series/{id}',
  'POST /fiscal/issuers/{issuerId}/issuance-drafts',
  'GET /fiscal/issuers/{issuerId}/issuance-drafts',
  'GET /fiscal/issuers/{issuerId}/issuance-drafts/{id}',
  'PATCH /fiscal/issuers/{issuerId}/issuance-drafts/{id}',
  'DELETE /fiscal/issuers/{issuerId}/issuance-drafts/{id}',
  'POST /fiscal/issuers/{issuerId}/validations',
  'POST /fiscal/issuers/{issuerId}/issuances',
  'GET /fiscal/issuers/{issuerId}/issuances',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}',
  'POST /fiscal/issuers/{issuerId}/issuances/{id}/revisions',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/revisions',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/revisions/{id}',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/attempts',
  'POST /fiscal/issuers/{issuerId}/issuances/{id}/resolution-requests',
  'POST /fiscal/issuers/{issuerId}/issuances/{id}/aborts',
  'POST /fiscal/issuers/{issuerId}/issuance-batches',
  'GET /fiscal/issuers/{issuerId}/issuance-batches',
  'GET /fiscal/issuers/{issuerId}/issuance-batches/{id}',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/artifacts',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/artifacts/{id}',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/xml',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/pdf',
  'POST /fiscal/issuers/{issuerId}/issuances/{id}/cancellations',
  'POST /fiscal/issuers/{issuerId}/issuances/{id}/correction-letters',
  'GET /fiscal/issuers/{issuerId}/issuances/{id}/correction-letters',
  'POST /fiscal/issuers/{issuerId}/number-invalidations',
  'GET /fiscal/issuers/{issuerId}/number-invalidations',
  'GET /fiscal/issuers/{issuerId}/number-invalidations/{id}',
  'GET /fiscal/issuers/{issuerId}/event-requests',
  'GET /fiscal/issuers/{issuerId}/event-requests/{id}',
  'GET /fiscal/issuers/{issuerId}/documents',
  'GET /fiscal/issuers/{issuerId}/documents/changes',
  'GET /fiscal/issuers/{issuerId}/documents/{id}',
  'GET /fiscal/issuers/{issuerId}/documents/{id}/xml',
  'GET /fiscal/issuers/{issuerId}/documents/{id}/reconciliation-candidates',
  ...['products', 'services', 'customers'].flatMap((resource) => [
    `POST /fiscal/issuers/{issuerId}/${resource}`,
    `GET /fiscal/issuers/{issuerId}/${resource}`,
    `GET /fiscal/issuers/{issuerId}/${resource}/{id}`,
    `PATCH /fiscal/issuers/{issuerId}/${resource}/{id}`,
    `POST /fiscal/issuers/{issuerId}/${resource}/{id}/archivals`,
  ]),
  'POST /fiscal/issuers/{issuerId}/tax-profiles',
  'GET /fiscal/issuers/{issuerId}/tax-profiles',
  'GET /fiscal/issuers/{issuerId}/tax-profiles/{id}',
  'PATCH /fiscal/issuers/{issuerId}/tax-profiles/{id}',
  'POST /fiscal/issuers/{issuerId}/tax-profiles/{id}/archivals',
  'POST /fiscal/issuers/{issuerId}/tax-profile-versions',
  'GET /fiscal/issuers/{issuerId}/tax-profile-versions',
  'GET /fiscal/issuers/{issuerId}/tax-profile-versions/{id}',
  'PATCH /fiscal/issuers/{issuerId}/tax-profile-versions/{id}',
  'POST /fiscal/issuers/{issuerId}/tax-profile-versions/{id}/validations',
  'POST /fiscal/issuers/{issuerId}/tax-profile-versions/{id}/activations',
  'POST /fiscal/issuers/{issuerId}/tax-profile-versions/{id}/retirements',
  'POST /fiscal/issuers/{issuerId}/tax-calculations',
  'GET /fiscal/issuers/{issuerId}/tax-calculations',
  'GET /fiscal/issuers/{issuerId}/tax-calculations/{id}',
  'GET /fiscal/issuers/{issuerId}/reference-tables',
  'GET /fiscal/issuers/{issuerId}/reference-tables/{id}',
  'GET /fiscal/issuers/{issuerId}/simulation-scenarios',
  'POST /fiscal/issuers/{issuerId}/simulation-scenarios',
  'POST /fiscal/issuers/{issuerId}/simulation-scenarios/resets',
  'POST /fiscal/issuers/{issuerId}/reconciliations',
  'GET /fiscal/issuers/{issuerId}/reconciliations',
  'GET /fiscal/issuers/{issuerId}/reconciliations/changes',
  'GET /fiscal/issuers/{issuerId}/reconciliations/{id}',
  'POST /fiscal/issuers/{issuerId}/reconciliations/{id}/reverse',
  'POST /fiscal/issuers/{issuerId}/reconciliations/{id}/revalidate',
];

function template(method, path) {
  const normalized = path
    .replace(`/fiscal/issuers/${ISSUER}`, '/fiscal/issuers/{issuerId}')
    .replace(/\/(chave|artifact|revision|evaluation|CST_ICMS)(?=\/|$)/g, '/{id}')
    .replace(new RegExp(`/${ID}(?=/|$)`, 'g'), '/{id}');

  return `${method} ${normalized}`;
}

test('the SDK reaches every published issuance route', async () => {
  const seen = new Set();
  const client = new MalvoClient({
    clientId: 'client',
    clientSecret: 'secret',
    fetch: async (url, init) => {
      const request = new URL(String(url));
      if (request.pathname === '/auth') return Response.json({ apiKey: 'key' });
      seen.add(template(init.method, request.pathname));

      return Response.json({});
    },
  });

  for (const call of surface(client.issuance)) await call();

  const published = new Set(PUBLISHED);
  const missing = [...published].filter((route) => !seen.has(route)).sort();
  const extra = [...seen].filter((route) => !published.has(route)).sort();

  assert.deepEqual(missing, [], `rotas publicadas sem método no SDK: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `métodos do SDK fora do contrato: ${extra.join(', ')}`);
  assert.equal(published.size, 100);
});

test('the issuance surface exposes one method per route and nothing else', () => {
  const client = new MalvoClient({ clientId: 'c', clientSecret: 's', fetch: async () => Response.json({}) });
  const names = Object.getOwnPropertyNames(Object.getPrototypeOf(client.issuance))
    .filter((name) => name !== 'constructor' && name !== 'path');

  assert.equal(names.length, 90);
  for (const name of names) assert.equal(typeof client.issuance[name], 'function');
});
