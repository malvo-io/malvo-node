import { sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const property = 'sc-domain:malvo.io';
const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const secretKey = 'search-console-service-account';

export function dateRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type).value;
  const today = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const day = 86_400_000;
  return {
    startDate: new Date(today - 28 * day).toISOString().slice(0, 10),
    endDate: new Date(today - day).toISOString().slice(0, 10),
  };
}

async function requestJson(fetcher, url, options, label) {
  let response;
  try {
    response = await fetcher(url, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`${label}: falha de rede.`);
  }
  if (!response.ok) throw new Error(`${label} (HTTP ${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: resposta inválida.`);
  }
}

async function readCredentials(env, fetcher) {
  if (!env.PAPERCLIP_API_URL || !env.PAPERCLIP_API_KEY || !env.PAPERCLIP_RUN_ID) {
    throw new Error('Execute no heartbeat do Diego com autenticação do Paperclip.');
  }
  let base;
  try {
    base = new URL(env.PAPERCLIP_API_URL);
  } catch {
    throw new Error('URL do Paperclip inválida.');
  }
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) {
    throw new Error('Use a URL HTTPS do Paperclip ou HTTP local do heartbeat.');
  }
  const result = await requestJson(fetcher, `${base.origin}/api/agents/me/secrets/${secretKey}/value`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
      'X-Paperclip-Run-Id': env.PAPERCLIP_RUN_ID,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }, 'Secret ausente ou sem acesso: solicite o vínculo de leitura ao Diego na company MALA');
  try {
    const credentials = JSON.parse(result.value);
    if (credentials.type !== 'service_account' || typeof credentials.client_email !== 'string' ||
        !credentials.client_email || typeof credentials.private_key !== 'string' || !credentials.private_key ||
        (credentials.token_uri !== undefined && credentials.token_uri !== tokenUrl)) {
      throw new Error('invalid');
    }
    return credentials;
  } catch {
    throw new Error('Secret inválido: esperado JSON de service account; corrija pelo cofre da company MALA.');
  }
}

async function accessToken(credentials, fetcher, now) {
  let assertion;
  try {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const issuedAt = Math.floor(now.getTime() / 1000);
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: credentials.client_email, scope, aud: tokenUrl, iat: issuedAt, exp: issuedAt + 3600,
    })}`;
    assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url')}`;
  } catch {
    throw new Error('Chave inválida no secret da company MALA.');
  }
  const result = await requestJson(fetcher, tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  }, 'Falha de autenticação Google');
  if (typeof result?.access_token !== 'string' || !result.access_token || result.token_type !== 'Bearer') {
    throw new Error('Resposta inválida da autenticação Google.');
  }
  return result.access_token;
}

function parseRows(result, dimension) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Resposta inválida do Search Console.');
  const rows = result.rows ?? [];
  if (!Array.isArray(rows)) throw new Error('Resposta inválida do Search Console.');
  return rows.map((row) => {
    if (!row || !Array.isArray(row.keys) || row.keys.length !== 1 || typeof row.keys[0] !== 'string' ||
        !['clicks', 'impressions', 'ctr', 'position'].every((key) => typeof row[key] === 'number' && Number.isFinite(row[key]) && row[key] >= 0) || row.ctr > 1) {
      throw new Error('Resposta inválida do Search Console.');
    }
    return { [dimension]: row.keys[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position };
  });
}

export async function collectReport({ token, fetcher = fetch, now = new Date(), rowLimit = 25_000 }) {
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 25_000) throw new Error('Limite de linhas inválido.');
  const range = dateRange(now);
  const report = { property, ...range, timeZone: 'America/Los_Angeles', dataState: 'final', searchType: 'web', synthetic: false };
  for (const [dimension, key] of [['page', 'byPage'], ['query', 'byQuery']]) {
    const rows = [];
    for (let startRow = 0; ; startRow += rowLimit) {
      const result = await requestJson(fetcher, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...range, dimensions: [dimension], type: 'web', dataState: 'final', rowLimit, startRow }),
      }, 'Falha na consulta Search Console');
      const page = parseRows(result, dimension);
      rows.push(...page);
      if (page.length < rowLimit) break;
      if (startRow + rowLimit >= 100_000) throw new Error('Limite de paginação atingido; relatório não emitido para evitar truncamento silencioso.');
    }
    report[key] = rows;
  }
  return report;
}

export async function run({ env = process.env, fetcher = fetch, now = new Date(), mock = false } = {}) {
  if (mock) {
    const metrics = { clicks: 12, impressions: 100, ctr: 0.12, position: 4.5 };
    return { property, ...dateRange(now), timeZone: 'America/Los_Angeles', dataState: 'final', searchType: 'web', synthetic: true,
      byPage: [{ page: 'https://malvo.io/blog/exemplo-sintetico', ...metrics }],
      byQuery: [{ query: 'consulta sintética', ...metrics }],
    };
  }
  if (env.SEARCH_CONSOLE_ENABLED !== 'true') throw new Error('Consulta real desativada. Aguarde credencial e liberação dos gates MAL-1898 e MAL-427.');
  const credentials = await readCredentials(env, fetcher);
  const token = await accessToken(credentials, fetcher, now);
  return collectReport({ token, fetcher, now });
}

export function renderTable(report) {
  const escape = (value) => String(value).replace(/[\x00-\x1f\x7f-\x9f|]/g, ' ');
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  const sections = [`${report.synthetic ? 'DADOS SINTÉTICOS — ' : ''}${report.property}: ${report.startDate} a ${report.endDate} (${report.timeZone})`];
  for (const [key, dimension, title] of [['byPage', 'page', 'Página'], ['byQuery', 'query', 'Consulta']]) {
    sections.push(`| ${title} | Cliques | Impressões | CTR | Posição |`, '| --- | ---: | ---: | ---: | ---: |');
    for (const row of report[key]) sections.push(`| ${escape(row[dimension])} | ${number.format(row.clicks)} | ${number.format(row.impressions)} | ${percent.format(row.ctr)} | ${number.format(row.position)} |`);
    if (!report[key].length) sections.push('Sem dados para este agrupamento.');
  }
  return sections.join('\n');
}

async function main() {
  let mock = false;
  let format = 'table';
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--mock') mock = true;
    else if (args[index] === '--format' && ['table', 'json'].includes(args[index + 1])) format = args[++index];
    else throw new Error('Uso: node scripts/search-console/search-console.mjs [--mock] [--format table|json]');
  }
  const report = await run({ mock });
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderTable(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
