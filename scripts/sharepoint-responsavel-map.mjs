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

const h = { Authorization: `Bearer ${tok.access_token}` };

const res = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`,
  { headers: h },
);
const json = await res.json();

const byLookup = new Map();
for (const item of json.value ?? []) {
  const f = item.fields ?? {};
  const lookupId = f.Respons_x00e1_velLookupId;
  const resp = f.Respons_x00e1_vel;
  if (!lookupId) continue;
  if (Array.isArray(resp)) {
    for (const p of resp) {
      byLookup.set(String(lookupId), p);
    }
  } else if (resp) {
    byLookup.set(String(lookupId), { LookupValue: resp, Email: resp });
  }
}

console.log('Lookup IDs encontrados:', byLookup.size);
for (const [id, p] of [...byLookup.entries()].slice(0, 15)) {
  console.log(id, '->', p.Email ?? p.LookupValue ?? JSON.stringify(p));
}

const item78 = (json.value ?? []).find((i) => i.id === '78');
if (item78) {
  console.log('\nItem 78 fields:');
  console.log(JSON.stringify(item78.fields, null, 2));
}
