import assert from 'node:assert/strict';
import test from 'node:test';
import { MalvoClient } from '../dist/index.js';

function harness(respond) {
  const calls = [];
  const client = new MalvoClient({
    clientId: 'client',
    clientSecret: 'test-secret',
    fetch: async (url, init) => {
      const request = new URL(String(url));
      if (request.pathname === '/auth') return Response.json({ apiKey: 'api-test-key' });
      calls.push({ path: request.pathname, method: init.method, query: request.searchParams, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
      return respond(request, init) ?? Response.json({});
    },
  });

  return { client, calls };
}

test('every issuance write carries an idempotency key the caller can pin', async () => {
  const { client, calls } = harness(() => Response.json({ id: 'issuance' }));
  const issuer = '0f9f1f1e-6c4f-4f0a-9a4c-2d0f7a0f0a12';

  await client.issuance.create(issuer, { series: 1, externalReference: 'pedido-42', invoice: {} });
  await client.issuance.create(issuer, { series: 1, externalReference: 'pedido-42', invoice: {} }, 'chave-do-erp');
  await client.issuance.cancel(issuer, 'issuance', { reason: 'Operação não realizada pelo cliente.', operationDidNotOccur: true });

  const [generated, pinned, cancellation] = calls;
  assert.match(generated.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.equal(pinned.headers['Idempotency-Key'], 'chave-do-erp');
  assert.notEqual(generated.headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.equal(cancellation.path, `/fiscal/issuers/${issuer}/issuances/issuance/cancellations`);
  assert.equal(cancellation.body.reason, 'Operação não realizada pelo cliente.');
});

test('operations with optimistic concurrency send the expected version', async () => {
  const { client, calls } = harness(() => Response.json({ id: 'version', state: 'ACTIVE' }));
  const issuer = '0f9f1f1e-6c4f-4f0a-9a4c-2d0f7a0f0a12';

  await client.issuance.activateTaxProfileVersion(issuer, 'version', 2, '2026-10-01T03:00:00Z');
  await client.issuance.archiveTaxProfile(issuer, 'profile', 3);
  await client.issuance.updateIssuer(issuer, 4, { name: 'Novo nome' });

  assert.equal(calls[0].headers['If-Match'], '"2"');
  assert.equal(calls[0].body.effectiveFrom, '2026-10-01T03:00:00Z');
  assert.equal(calls[1].headers['If-Match'], '"3"');
  assert.equal(calls[2].method, 'PATCH');
  assert.equal(calls[2].headers['If-Match'], '"4"');
  for (const call of calls) assert.equal(call.headers['X-API-KEY'], 'api-test-key');
});

test('the authorized XML comes through as text and keeps the error envelope', async () => {
  const { client } = harness((request) =>
    request.pathname.endsWith('/xml')
      ? new Response('<nfeProc/>', { headers: { 'Content-Type': 'application/xml' } })
      : Response.json({ message: 'not found', codeDescription: 'FISCAL_ISSUANCE_NOT_FOUND' }, { status: 404 }),
  );

  assert.equal(await client.issuance.fetchXml('issuer', 'issuance'), '<nfeProc/>');
  await assert.rejects(
    client.issuance.fetch('issuer', 'issuance'),
    (error) => error.statusCode === 404 && error.codeDescription === 'FISCAL_ISSUANCE_NOT_FOUND',
  );
});

test('filters and the reconciliation mode travel in the query', async () => {
  const { client, calls } = harness(() => Response.json({ items: [], data: [], nextCursor: null, candidates: [] }));
  const issuer = '0f9f1f1e-6c4f-4f0a-9a4c-2d0f7a0f0a12';

  await client.issuance.fetchAll(issuer, { state: 'Authorized', series: 1, externalReference: 'pedido-42', limit: 10 });
  await client.issuance.fetchTaxProfileVersions(issuer, { profileId: 'profile', limit: 50 });
  await client.issuance.fetchReconciliationCandidates(issuer, 'chave', 'RECEIVABLE', { from: '2026-09-01' });

  assert.equal(calls[0].query.get('state'), 'Authorized');
  assert.equal(calls[0].query.get('series'), '1');
  assert.equal(calls[0].query.get('externalReference'), 'pedido-42');
  assert.equal(calls[1].query.get('profileId'), 'profile');
  assert.equal(calls[2].query.get('mode'), 'RECEIVABLE');
  assert.equal(calls[2].query.get('from'), '2026-09-01');
  assert.equal(calls[2].path, `/fiscal/issuers/${issuer}/documents/chave/reconciliation-candidates`);
});

test('identifiers are escaped so a crafted key cannot leave the issuer scope', async () => {
  const { client, calls } = harness(() => Response.json({}));

  await client.issuance.fetchDocument('issuer/../outro', '../../admin');

  assert.equal(calls[0].path, '/fiscal/issuers/issuer%2F..%2Foutro/documents/..%2F..%2Fadmin');
});

test('the DANFE answer is the data model, not a rendered file', async () => {
  const { client, calls } = harness(() => Response.json({ accessKey: '352609', barcode: '123' }));

  const danfe = await client.issuance.fetchDanfe('issuer', 'issuance');

  assert.equal(calls[0].path, '/fiscal/issuers/issuer/issuances/issuance/pdf');
  assert.equal(danfe.accessKey, '352609');
});

test('webhook operation reaches the published routes and keeps the rotation scope', async () => {
  const { client, calls } = harness((request) => {
    if (request.pathname.endsWith('/secret-rotations')) {
      return Response.json({ secret: 'whsec_abc', hint: 'cabc', scope: 'APPLICATION', previousSecretExpiresAt: '2026-09-15T00:00:00Z' }, { status: 201 });
    }
    if (request.pathname.endsWith('/tests')) {
      return Response.json({ id: 'delivery', test: true, eventId: null, statusCode: 200 }, { status: 201 });
    }
    if (request.pathname.endsWith('/replays')) return Response.json({ id: 'event', status: 'PENDING' }, { status: 202 });

    return Response.json({ results: [], nextCursor: '' });
  });

  const rotation = await client.rotateWebhookSecret('webhook');
  assert.equal(rotation.scope, 'APPLICATION');

  const delivery = await client.testWebhookDelivery('webhook');
  assert.equal(delivery.test, true);
  assert.equal(delivery.eventId, null);

  await client.fetchWebhookDeliveries('webhook', { limit: 10 });
  await client.fetchWebhookDelivery('webhook', 'delivery');
  await client.replayWebhookDelivery('webhook', 'delivery');
  await client.fetchFiscalEvents({ cursor: 'last' });

  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
    'POST /webhooks/webhook/secret-rotations',
    'POST /webhooks/webhook/tests',
    'GET /webhooks/webhook/deliveries',
    'GET /webhooks/webhook/deliveries/delivery',
    'POST /webhooks/webhook/deliveries/delivery/replays',
    'GET /fiscal/events',
  ]);
  assert.equal(calls[2].query.get('limit'), '10');
  assert.equal(calls[5].query.get('cursor'), 'last');
});

test('sandbox scenarios travel with and without a connection', async () => {
  const { client, calls } = harness(() =>
    Response.json({ scenario: { id: 'scenario', scenario: 'NO_DOCUMENTS', connectionId: null }, available: ['DEFAULT'] }, { status: 201 }),
  );

  await client.createFiscalSandboxScenario('NO_DOCUMENTS');
  await client.createFiscalSandboxScenario('DOCUMENT_CANCELLED', 'connection');
  await client.fetchFiscalSandboxScenario('scenario');
  await client.resetFiscalSandboxScenario('scenario');

  assert.deepEqual(calls[0].body, { scenario: 'NO_DOCUMENTS' });
  assert.deepEqual(calls[1].body, { scenario: 'DOCUMENT_CANCELLED', connectionId: 'connection' });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
    'POST /fiscal/sandbox/scenarios',
    'POST /fiscal/sandbox/scenarios',
    'GET /fiscal/sandbox/scenarios/scenario',
    'POST /fiscal/sandbox/scenarios/scenario/resets',
  ]);
});
