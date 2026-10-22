import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { collectReport, dateRange, renderTable, run } from './search-console.mjs';

const now = new Date('2026-10-22T12:00:00Z');
const env = {
  SEARCH_CONSOLE_ENABLED: 'true',
  PAPERCLIP_API_URL: 'https://control.example.test',
  PAPERCLIP_API_KEY: 'synthetic-run-token',
  PAPERCLIP_RUN_ID: 'synthetic-run',
};
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const credentials = {
  type: 'service_account',
  client_email: 'synthetic@example.test',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};
const row = { keys: ['synthetic'], clicks: 2, impressions: 10, ctr: 0.2, position: 3.5 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('28 inclusive days handle year, leap day and provider timezone', () => {
  assert.deepEqual(dateRange(now), { startDate: '2026-09-24', endDate: '2026-10-21' });
  assert.deepEqual(dateRange(new Date('2024-03-01T12:00:00Z')), { startDate: '2024-02-02', endDate: '2024-02-29' });
  assert.deepEqual(dateRange(new Date('2026-01-01T02:00:00Z')), { startDate: '2025-12-03', endDate: '2025-12-30' });
});

test('disabled default and mock mode never access secrets or network', async () => {
  const fetcher = () => { assert.fail('network forbidden'); };
  await assert.rejects(run({ env: {}, fetcher, now }), /desativada/);
  const report = await run({ env: {}, fetcher, now, mock: true });
  assert.equal(report.synthetic, true);
  assert.equal(report.byPage[0].clicks, 12);
  assert.match(renderTable(report), /CTR/);
  assert.match(renderTable(report), /12,00%/);
});

test('missing or inaccessible company secret fails clearly before Google', async () => {
  let calls = 0;
  await assert.rejects(run({ env, now, fetcher: async (url) => {
    calls++;
    assert.match(url, /\/api\/agents\/me\/secrets\/search-console-service-account\/value$/);
    return json({ error: 'sensitive-provider-error' }, 403);
  } }), /Secret ausente ou sem acesso/);
  assert.equal(calls, 1);
});

test('real flow reads secret through scoped API, signs readonly JWT and queries both dimensions', async () => {
  const requests = [];
  const report = await run({ env, now, fetcher: async (url, options) => {
    requests.push(url);
    assert.equal(options.redirect, 'error');
    if (requests.length === 1) {
      assert.equal(options.headers.Authorization, 'Bearer synthetic-run-token');
      assert.equal(options.headers['X-Paperclip-Run-Id'], 'synthetic-run');
      return json({ value: JSON.stringify(credentials) });
    }
    if (requests.length === 2) {
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      const assertion = options.body.get('assertion');
      const [header, payload, signature] = assertion.split('.');
      assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')), true);
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/webmasters.readonly');
      assert.equal(claims.exp - claims.iat, 3600);
      return json({ access_token: 'synthetic-google-token', token_type: 'Bearer' });
    }
    assert.match(url, /sites\/sc-domain%3Amalvo.io\/searchAnalytics\/query$/);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-google-token');
    const body = JSON.parse(options.body);
    assert.equal(body.startDate, '2026-09-24');
    assert.equal(body.endDate, '2026-10-21');
    assert.equal(body.dataState, 'final');
    assert.deepEqual(body.dimensions, [requests.length === 3 ? 'page' : 'query']);
    return json({ rows: [row] });
  } });
  assert.equal(requests.length, 4);
  assert.deepEqual(report.byQuery[0], { query: 'synthetic', clicks: 2, impressions: 10, ctr: 0.2, position: 3.5 });
  assert.equal(JSON.stringify(report).includes('private_key'), false);
});

test('pagination and empty results preserve metrics', async () => {
  const offsets = [];
  const report = await collectReport({ now, token: 'synthetic', rowLimit: 1, fetcher: async (_url, options) => {
    const body = JSON.parse(options.body);
    offsets.push([body.dimensions[0], body.startRow]);
    return json({ rows: body.startRow === 0 ? [row] : [] });
  } });
  assert.deepEqual(offsets, [['page', 0], ['page', 1], ['query', 0], ['query', 1]]);
  assert.equal(report.byPage[0].ctr, 0.2);
  const empty = await collectReport({ now, token: 'synthetic', fetcher: async () => json({}) });
  assert.deepEqual(empty.byPage, []);
});

test('malformed secret, Google failures and network errors never expose original content', async () => {
  for (const fetcher of [async () => json({ value: 'sensitive-invalid-json' }), async () => { throw new Error('sensitive-network-error'); }]) {
    await assert.rejects(run({ env, now, fetcher }), (error) => !error.message.includes('sensitive'));
  }
  await assert.rejects(collectReport({ now, token: 'synthetic', fetcher: async () => json({ error: 'sensitive-google-error' }, 403) }), /Search Console.*403/);
  await assert.rejects(collectReport({ now, token: 'synthetic', fetcher: async () => json({ rows: [{ ...row, ctr: 'invalid' }] }) }), /Resposta inválida/);
});

test('secret access rejects insecure URLs and ignores credentials from the environment', async () => {
  for (const url of ['http://remote.example.test', 'https://user:password@example.test', 'https://example.test/path']) {
    await assert.rejects(run({ env: { ...env, PAPERCLIP_API_URL: url }, now, fetcher: () => assert.fail('network forbidden') }), /HTTPS/);
  }
  await assert.rejects(run({ env: { SEARCH_CONSOLE_ENABLED: 'true', GOOGLE_APPLICATION_CREDENTIALS: 'synthetic.json' }, now, fetcher: () => assert.fail('network forbidden') }), /heartbeat/);
});

test('invalid key or token response cannot leak provider credentials', async () => {
  await assert.rejects(run({ env, now, fetcher: async () => json({ value: JSON.stringify({ ...credentials, private_key: 'sensitive-invalid-key' }) }) }), /Chave inválida/);
  let calls = 0;
  await assert.rejects(run({ env, now, fetcher: async () => {
    calls++;
    return calls === 1 ? json({ value: JSON.stringify(credentials) }) : json({ error: 'sensitive-auth-response' }, 401);
  } }), /Falha de autenticação Google \(HTTP 401\)/);
});

test('CLI accepts only known options and emits synthetic JSON', () => {
  const result = spawnSync(process.execPath, ['scripts/search-console/search-console.mjs', '--mock', '--format', 'json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).synthetic, true);
  const invalid = spawnSync(process.execPath, ['scripts/search-console/search-console.mjs', '--credentials', 'synthetic'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stderr.includes('synthetic'), false);
});
