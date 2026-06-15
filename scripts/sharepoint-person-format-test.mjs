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

const h = {
  Authorization: `Bearer ${tok.access_token}`,
  'Content-Type': 'application/json',
};

const base = {
  Title: 'PERSON FORMAT TEST',
  NomedoTreinamento: 'PERSON FORMAT TEST',
  Facilitador: 'Felipe Soares de Camargo',
  Data: '2026-06-20',
  Status: 'Futuro',
  Area: 'Operações Legais',
  Categoria: 'Equipe',
  TipodoTreinamento: 'NÃO',
};

const variants = [
  { name: 'lookupId 15', fields: { ...base, Respons_x00e1_velLookupId: '15' } },
  {
    name: 'email bpplaw in Responsavel field',
    fields: { ...base, Respons_x00e1_vel: 'felipe@bpplaw.com.br' },
  },
  {
    name: 'email bismarchi in Responsavel field',
    fields: { ...base, Respons_x00e1_vel: 'felipe@bismarchipires.com.br' },
  },
  {
    name: 'claims login',
    fields: {
      ...base,
      Respons_x00e1_vel: 'i:0#.f|membership|felipe@bpplaw.com.br',
    },
  },
];

for (const v of variants) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ fields: v.fields }),
  });
  const json = await res.json();
  console.log('\n===', v.name, res.status);
  if (!res.ok) {
    console.log(json.error?.message ?? json);
    continue;
  }
  console.log('id:', json.id);
  console.log('lookup:', json.fields?.Respons_x00e1_velLookupId);
  console.log('resp field:', json.fields?.Respons_x00e1_vel);
}
