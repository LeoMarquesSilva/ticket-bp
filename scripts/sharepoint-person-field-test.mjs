import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const tenant = process.env.MICROSOFT_TENANT_ID;
const clientId = process.env.MICROSOFT_CLIENT_ID;
const secret = process.env.MICROSOFT_CLIENT_SECRET;
const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
const email = process.argv[2] ?? 'felipe@bismarchipires.com.br';

async function getToken(scope) {
  return fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      scope,
      grant_type: 'client_credentials',
    }),
  }).then((r) => r.json());
}

const graphTok = (await getToken('https://graph.microsoft.com/.default')).access_token;
const spTok = (await getToken('https://bpplaw2.sharepoint.com/.default')).access_token;

const site = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}?$select=webUrl`, {
  headers: { Authorization: `Bearer ${graphTok}` },
}).then((r) => r.json());

console.log('Site:', site.webUrl);

const spHeaders = {
  Authorization: `Bearer ${spTok}`,
  Accept: 'application/json;odata=verbose',
  'Content-Type': 'application/json;odata=verbose',
};

const ensureRes = await fetch(`${site.webUrl.replace(/\/$/, '')}/_api/web/ensureUser`, {
  method: 'POST',
  headers: spHeaders,
  body: JSON.stringify({ logonName: `i:0#.f|membership|${email}` }),
});
const ensureText = await ensureRes.text();
let ensureJson;
try {
  ensureJson = JSON.parse(ensureText);
} catch {
  ensureJson = { raw: ensureText };
}
console.log('\nensureUser:', ensureRes.status);
const spUserId = ensureJson.d?.Id ?? ensureJson.d?.id;
console.log('SP User Id:', spUserId, ensureJson.d?.Email ?? ensureJson.d?.Title);

if (spUserId) {
  const fields = {
    Title: `TEST LOOKUP ${Date.now()}`,
    NomedoTreinamento: 'TEST LOOKUP',
    Facilitador: 'Test Facilitador',
    Data: '2026-06-20',
    Status: 'Futuro',
    Area: 'Operações Legais',
    Categoria: 'Equipe',
    TipodoTreinamento: 'NÃO',
    Respons_x00e1_velLookupId: String(spUserId),
  };

  const createRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${graphTok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  );
  const createJson = await createRes.json();
  console.log('\nCreate item:', createRes.status);
  console.log('Item id:', createJson.id);
  console.log('Responsavel lookup:', createJson.fields?.Respons_x00e1_velLookupId);
  console.log('Facilitador:', createJson.fields?.Facilitador);
  if (createJson.error) console.log('Error:', createJson.error.message);
}
