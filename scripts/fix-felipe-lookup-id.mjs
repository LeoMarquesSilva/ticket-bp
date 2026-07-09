/**
 * Corrige mapa Felipe Camargo: 411 (Juliana) -> 15 (Felipe).
 * Atualiza integration_settings e opcionalmente item SharePoint.
 * Uso: node scripts/fix-felipe-lookup-id.mjs [--patch-sp-item=95]
 */
import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

const FELIPE_KEYS = [
  'felipe@bismarchipires.com.br',
  'felipe@bpplaw.com.br',
  'felipe camargo',
  'felipe soares de camargo',
];
const JULIANA_KEYS = [
  'juliana.pires@bismarchipires.com.br',
  'juliana herculano bangart pires',
  'juliana pires',
];

const patchItem = process.argv.find((a) => a.startsWith('--patch-sp-item='))?.split('=')[1];

const settingsRes = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups&select=key,value`,
  { headers },
);
const row = (await settingsRes.json())?.[0];
if (!row?.value) throw new Error('sharepoint_person_lookups não encontrado');

const map = JSON.parse(row.value);
let changed = 0;
for (const k of FELIPE_KEYS) {
  if (map[k] !== '15') {
    map[k] = '15';
    changed++;
  }
}
for (const k of JULIANA_KEYS) {
  if (map[k] !== '411') {
    map[k] = '411';
    changed++;
  }
}

const up = await fetch(`${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ value: JSON.stringify(map), updated_at: new Date().toISOString() }),
});
console.log('Mapa atualizado:', changed, 'chaves corrigidas. HTTP', up.status);
console.log('Felipe ->', map['felipe@bismarchipires.com.br'], '| Juliana ->', map['juliana.pires@bismarchipires.com.br']);

if (patchItem) {
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

  const siteId = process.env.SHAREPOINT_SITE_ID;
  const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
  const gh = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const patch = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${patchItem}/fields`,
    {
      method: 'PATCH',
      headers: gh,
      body: JSON.stringify({ Respons_x00e1_velLookupId: '15' }),
    },
  );
  console.log(`SharePoint item ${patchItem} Responsável -> LookupId 15:`, patch.status);
}
