# Leitura editorial do Search Console

Script interno para o Diego, na company MALA. Requer Node.js 18 ou superior,
sem instalação de dependências e sem build. Não faz parte do pacote publicado
do SDK. Consulta exclusivamente a propriedade de domínio `sc-domain:malvo.io`,
com o escopo OAuth `https://www.googleapis.com/auth/webmasters.readonly`.

## Uso imediato com dados sintéticos

Na raiz do checkout:

```sh
node scripts/search-console/search-console.mjs --mock
node scripts/search-console/search-console.mjs --mock --format json
node --test scripts/search-console/search-console.test.mjs
```

`--mock` não lê secrets e não faz chamadas de rede. A saída é identificada por
`synthetic: true` no JSON e `DADOS SINTÉTICOS` na tabela. Não exige banco ou Redis.

## Preparação pelo operador responsável

A consulta real fica desativada por padrão. Só habilitar após as provas de
MAL-1898 e MAL-427 e a entrega da credencial solicitada no plano MAL-2240.
Este script não autoriza nem verifica a aprovação desses tickets; essa
verificação é responsabilidade do operador antes de habilitar a flag.

1. No fluxo de secrets da **company MALA**, guardar a chave JSON completa da
   service account em um secret com chave `search-console-service-account`.
   A conta precisa ter leitura na propriedade de domínio `malvo.io` e a API
   Search Console precisa estar habilitada no projeto Google correspondente.
2. Vincular esse secret somente ao Diego, com entrega `api`. Fazer isso na
   company MALA; não copiar a credencial nem conceder acesso à company MAL.
3. Depois das liberações, configurar `SEARCH_CONSOLE_ENABLED=true` no ambiente
   do Diego. Até lá, manter a variável ausente ou `false` e as rotinas pausadas.

Nunca colar a chave em ticket, comentário, instrução, argumento de terminal,
arquivo `.env`, configuração em texto ou log. Não exportar a chave como variável
de ambiente. O script não aceita arquivo de credenciais, credencial em argumento,
stdin, `GOOGLE_APPLICATION_CREDENTIALS` nem autenticação Google padrão da máquina.

## Execução pelo Diego após liberação

Executar dentro do heartbeat autenticado do Diego na MALA. O ambiente do runtime
fornece `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY` e `PAPERCLIP_RUN_ID`; não preencher
esses valores manualmente no terminal nem imprimi-los.

```sh
node scripts/search-console/search-console.mjs
node scripts/search-console/search-console.mjs --format json
```

O script chama `POST /api/agents/me/secrets/search-console-service-account/value`
com a identidade do próprio heartbeat. A chave e o token Google permanecem
somente na memória do processo. A autorização Google usa JWT RS256 com validade
de uma hora e o endpoint fixo `https://oauth2.googleapis.com/token`. O script
não segue redirecionamentos e limita cada requisição a 30 segundos. Erros não
reproduzem corpo de resposta, credenciais ou mensagens originais de provedores.
O POST da Search Analytics é uma operação de leitura; não altera o site.

Se faltar o secret ou o vínculo de acesso, aparece `Secret ausente ou sem acesso`.
O operador deve corrigir o cadastro/vínculo no cofre, sem enviar a chave na tarefa.
Em `401`/`403` Google, conferir validade da chave, API habilitada e acesso da conta
à propriedade. O processo termina com código 1 em erro e não imprime relatório
parcial. Não há retry automático.

## Intervalo, agrupamentos e interpretação

- São **28 dias corridos inclusivos**, terminando ontem no calendário do
  Search Console. Por exemplo, em 22/10/2026 ao meio-dia UTC: 24/09 a 21/10.
- A API define datas em horário do Pacífico (`America/Los_Angeles`), mesmo que
  a operação editorial seja em `America/Sao_Paulo`. O fuso vem explícito na saída.
- `dataState: final` exclui dados ainda não finalizados; por isso os dias mais
  recentes da janela podem não ter métricas. Não substituímos a janela por
  “28 dias com dados”. O tipo de pesquisa é `web`.
- `byPage` agrupa por página e `byQuery` por consulta, em relatórios separados.
  Não são pares página/consulta e suas linhas não devem ser somadas entre si.
- Cada linha contém `clicks`, `impressions`, `ctr` e `position` conforme a API.
  No JSON, CTR é fração (0,12 significa 12%); a tabela formata números em pt-BR.
  Posição é média, não uma posição absoluta. Os resultados vazios são válidos.
- Paginação usa até 25.000 linhas por chamada. O script para com erro se atingir
  100.000 linhas em um agrupamento sem encontrar o final. A API só garante suas
  principais linhas, podendo omitir consultas por privacidade ou limites internos;
  os resultados não são um extrato completo de todo o tráfego da propriedade.

Para guardar um relatório, publicar a saída como artefato na tarefa editorial,
indicando o período e se é sintético. Não incluir logs de autenticação.

## Validação de desenvolvimento e QA

```sh
npm ci
npm run typecheck
npm test
node --test scripts/search-console/search-console.test.mjs
npm run build
```

Remover `dist/` ao terminar a validação. Não há servidor, usuário de teste ou
infraestrutura a manter. O teste de autenticação gera uma chave RSA sintética
em memória; o transporte HTTP inteiro é simulado. A execução real permanece
pendente das liberações e não é requisito para rodar o QA sintético.

## Fontes do contrato

- [Search Analytics: query — Google](https://developers.google.com/webmaster-tools/v1/searchanalytics/query):
  propriedade, escopo de leitura, datas inclusivas em PT, dimensões, paginação,
  métricas, dados finais e limitações.
- [OAuth 2.0 service accounts — Google](https://developers.google.com/identity/protocols/oauth2/service-account):
  JWT RS256, claims, validade e troca por access token.
- OpenAPI da instalação do coordenador: `GET /api/openapi.json`, operação
  `POST /api/agents/me/secrets/{key}/value`, leitura limitada à identidade do run.

Contratos consultados em 22/10/2026. Nenhuma consulta à propriedade real foi
executada nesta entrega.
