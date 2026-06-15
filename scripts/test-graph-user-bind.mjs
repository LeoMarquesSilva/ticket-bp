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

const h = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

async function resolveUser(mail) {
  const upn = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mail)}?$select=id,displayName,mail,userPrincipalName`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  if (upn.ok) return upn.json();

  const escaped = mail.replace(/'/g, "''");
  const filter = encodeURIComponent(`mail eq '${escaped}' or userPrincipalName eq '${escaped}'`);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users?$filter=${filter}&$select=id,displayName,mail,userPrincipalName&$top=1`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  const json = await res.json();
  return json.value?.[0] ?? json;
}

const user = await resolveUser(email);
console.log('Graph user:', JSON.stringify(user, null, 2));

if (user.id) {
  const fields = {
    Title: `GRAPH BIND TEST ${Date.now()}`,
    NomedoTreinamento: 'GRAPH BIND TEST',
    Facilitador: 'Test Graph Bind',
    Data: '2026-06-20',
    Status: 'Futuro',
    Area: 'Operações Legais',
    Categoria: 'Equipe',
    TipodoTreinamento: 'NÃO',
    'Respons_x00e1_vel@odata.bind': `https://graph.microsoft.com/v1.0/users('${user.id}')`,
  };

  const create = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
    { method: 'POST', headers: h, body: JSON.stringify({ fields }) },
  ).then((r) => r.json());

  console.log('SharePoint create:', create.error?.message ?? `item ${create.id}`);
  console.log('Responsavel LookupId:', create.fields?.Respons_x00e1_velLookupId);
}
