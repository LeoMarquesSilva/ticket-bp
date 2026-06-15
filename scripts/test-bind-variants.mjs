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
const uid = '413d9a20-7768-41c5-8ec8-892663d31979';

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
  Title: `IDENTITY ${ts}`,
  NomedoTreinamento: 'IDENTITY TEST',
  Facilitador: 'Test',
  Data: '2026-06-20',
  Status: 'Futuro',
  Area: 'Operações Legais',
  Categoria: 'Equipe',
  TipodoTreinamento: 'NÃO',
};

const variants = [
  {
    label: 'identitySet email',
    extra: {
      Respons_x00e1_vel: [{
        '@odata.type': 'microsoft.graph.sharePointIdentitySet',
        user: {
          '@odata.type': 'microsoft.graph.sharePointIdentity',
          displayName: 'Felipe Soares de Camargo',
          email: 'felipe@bpplaw.com.br',
        },
      }],
    },
  },
  {
    label: 'identitySet graph id',
    extra: {
      Respons_x00e1_vel: [{
        '@odata.type': 'microsoft.graph.sharePointIdentitySet',
        user: {
          '@odata.type': 'microsoft.graph.identity',
          id: uid,
          displayName: 'Felipe Soares de Camargo',
        },
      }],
    },
  },
  {
    label: 'single identitySet',
    extra: {
      Respons_x00e1_vel: {
        '@odata.type': 'microsoft.graph.sharePointIdentitySet',
        user: {
          '@odata.type': 'microsoft.graph.sharePointIdentity',
          email: 'felipe@bpplaw.com.br',
        },
      },
    },
  },
];

for (const v of variants) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ fields: { ...base, Title: `${base.Title} ${v.label}`, ...v.extra } }),
  });
  const json = await res.json();
  console.log(v.label, res.status, json.error?.message ?? `id=${json.id} lookup=${json.fields?.Respons_x00e1_velLookupId}`);
}
