import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
const email = 'leonardo.marques@bismarchipires.com.br';

const tok = await fetch(
  `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  },
).then((r) => r.json());

const h = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
const ts = Date.now();
const base = {
  Title: `FMT ${ts}`,
  NomedoTreinamento: 'FMT',
  Facilitador: 'Test',
  Data: '2026-06-20',
  Status: 'Futuro',
  Area: 'Operações Legais',
  Categoria: 'Equipe',
  TipodoTreinamento: 'NÃO',
};

const uid = '413d9a20-7768-41c5-8ec8-892663d31979';
const formats = [
  ['claims', { Respons_x00e1_vel: `i:0#.f|membership|${email}` }],
  ['upn only', { Respons_x00e1_vel: email }],
  ['@odata.bind users', { 'Respons_x00e1_vel@odata.bind': `users('${uid}')` }],
  ['@odata.bind full', { 'Respons_x00e1_vel@odata.bind': `https://graph.microsoft.com/v1.0/users('${uid}')` }],
  ['FieldValueSet user', {
    Respons_x00e1_vel: {
      '@odata.type': 'microsoft.graph.sharePointIdentitySet',
      user: { '@odata.type': 'microsoft.graph.sharePointIdentity', email },
    },
  }],
  ['FieldValueSet aad', {
    Respons_x00e1_vel: {
      '@odata.type': 'microsoft.graph.sharePointIdentitySet',
      user: { '@odata.type': 'microsoft.graph.identity', id: uid },
    },
  }],
];

for (const [label, extra] of formats) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ fields: { ...base, Title: `${base.Title} ${label}`, ...extra } }),
  });
  const json = await res.json();
  console.log(label, res.status, json.error?.message ?? `id=${json.id} lookup=${json.fields?.Respons_x00e1_velLookupId} resp=${JSON.stringify(json.fields?.Respons_x00e1_vel)}`);
}

// Coluna person - metadados
const col = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns/Respons_x00e1_vel`,
  { headers: { Authorization: `Bearer ${tok.access_token}` } },
).then((r) => r.json());
console.log('\nColumn meta:', JSON.stringify(col, null, 2).slice(0, 800));
