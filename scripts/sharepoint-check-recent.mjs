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
const secret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MICROSOFT_SECRET_ID;
const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;

const tok = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  }),
}).then((r) => r.json());

const h = { Authorization: `Bearer ${tok.access_token}` };
const base = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields`;

const res = await fetch(`${base}&$top=200&$orderby=createdDateTime desc`, { headers: h });
const json = await res.json();
const items = json.value ?? [];

const searchTerms = ['TESTANDO', 'Leo Marques', 'f72883a3'];
console.log('=== Busca pelo ticket de teste ===');
for (const item of items) {
  const f = item.fields ?? {};
  const blob = JSON.stringify(f);
  if (searchTerms.some((t) => blob.includes(t))) {
    console.log('ENCONTRADO item', item.id, item.createdDateTime);
    console.log(JSON.stringify(f, null, 2));
  }
}

const futuro = items.filter((i) => i.fields?.Status === 'Futuro');
console.log('\n=== Itens com Status Futuro ===', futuro.length);
for (const item of futuro.slice(0, 10)) {
  const f = item.fields ?? {};
  console.log(item.createdDateTime, '|', f.NomedoTreinamento, '|', f.Facilitador);
}

const dayAgo = Date.now() - 6 * 60 * 60 * 1000;
const recent = items.filter((i) => new Date(i.createdDateTime).getTime() > dayAgo);
console.log('\n=== Criados ultimas 6h ===', recent.length);
for (const item of recent) {
  const f = item.fields ?? {};
  console.log(item.createdDateTime, '|', f.NomedoTreinamento, '|', f.Status);
}
