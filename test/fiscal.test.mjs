import assert from 'node:assert/strict';
import test from 'node:test';
import { MalvoClient, parseWebhookEvent } from '../dist/index.js';

test('fiscal requests reuse application authentication and preserve XML', async () => {
  const calls = [];
  const client = new MalvoClient({
    clientId: 'client', clientSecret: 'test-secret',
    fetch: async (url, init) => {
      const request = new URL(String(url));
      calls.push({ path: request.pathname, query: request.searchParams, ...init });
      if (request.pathname === '/auth') return Response.json({ apiKey: 'api-test-key' });
      assert.equal(init.headers['X-API-KEY'], 'api-test-key');
      if (request.pathname.endsWith('/xml')) return new Response('<sandboxFiscalDocument/>', { headers: { 'Content-Type': 'application/xml' } });
      if (init.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({ id: 'connection', data: [], nextCursor: 'next' });
    },
  });
  await client.createFiscalConnection({ cnpj: '11222333000181', clientUserId: 'customer', purpose: 'Conciliação' });
  await client.createFiscalConnectToken('connection', { integratorOrigin: 'https://erp.example' });
  await client.fetchFiscalDocuments('connection', { type: 'NFe', direction: 'outbound', limit: 20, cursor: 'opaque+/=' });
  await client.fetchFiscalDocumentChanges('connection', { cursor: 'next', limit: 100 });
  assert.equal(await client.fetchFiscalDocumentXml('connection', 'key'), '<sandboxFiscalDocument/>');
  await client.revokeFiscalConnection('connection');
  assert.equal(calls.filter((call) => call.path === '/auth').length, 1);
  const listing = calls.find((call) => call.path.endsWith('/documents'));
  assert.equal(listing.query.get('cursor'), 'opaque+/=');
  assert.equal(listing.query.get('direction'), 'outbound');
});

test('fiscal XML errors keep the API error envelope', async () => {
  const client = new MalvoClient({ clientId: 'client', clientSecret: 'secret', fetch: async (url) => {
    if (String(url).endsWith('/auth')) return Response.json({ apiKey: 'key' });
    return Response.json({ message: 'XML unavailable', codeDescription: 'XML_NOT_AVAILABLE' }, { status: 404 });
  }});
  await assert.rejects(client.fetchFiscalDocumentXml('connection', 'key'), (error) => error.statusCode === 404 && error.codeDescription === 'XML_NOT_AVAILABLE');
});

test('fiscal webhook parsing requires connection identity', () => {
  for (const event of ['fiscal/connection_updated', 'fiscal/documents_updated', 'fiscal/sync_completed', 'fiscal/sync_failed']) {
    const payload = { event, eventId: 'event-1', connectionId: 'connection', clientUserId: 'customer' };
    assert.deepEqual(parseWebhookEvent(payload), payload);
    assert.throws(() => parseWebhookEvent({ event, eventId: 'event-1' }), TypeError);
  }
});

test('certificate notification contact can be set and removed per fiscal connection', async () => {
  const calls=[];
  const client=new MalvoClient({clientId:'client',clientSecret:'test-secret',fetch:async (url,init)=>{
    if(String(url).endsWith('/auth')) return Response.json({apiKey:'api-test-key'});
    calls.push({url:String(url),...init});
    return Response.json({id:'connection',notificationEmail:JSON.parse(init.body).notificationEmail});
  }});
  await client.createFiscalConnection({cnpj:'11222333000181',clientUserId:'customer',purpose:'Conciliação',notificationEmail:'responsavel@example.com'});
  assert.equal((await client.updateFiscalConnection('connection',{notificationEmail:''})).notificationEmail,'');
  assert.equal(calls[1].method,'PATCH');
  assert.ok(calls[1].url.endsWith('/fiscal/connections/connection'));
  assert.deepEqual(JSON.parse(calls[1].body),{notificationEmail:''});
  assert.equal(JSON.parse(calls[0].body).notificationEmail,'responsavel@example.com');
});
