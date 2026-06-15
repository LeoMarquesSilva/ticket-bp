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

let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
const rows = [];
while (url) {
  const page = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  rows.push(...(page.value ?? []));
  url = page['@odata.nextLink'] ?? null;
}

const byLookup = new Map();
for (const item of rows) {
  const f = item.fields ?? {};
  const lookupId = f.Respons_x00e1_velLookupId;
  if (!lookupId) continue;
  const key = String(lookupId);
  if (!byLookup.has(key)) byLookup.set(key, { facilitadores: new Set(), count: 0, editors: new Set() });
  const entry = byLookup.get(key);
  entry.count++;
  if (f.Facilitador) entry.facilitadores.add(String(f.Facilitador).trim());
  if (f.EditorLookupId) entry.editors.add(String(f.EditorLookupId));
}

console.log('Unique LookupIds:', byLookup.size);
for (const [id, e] of [...byLookup.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`\nLookupId ${id} (${e.count} items)`);
  console.log('  Facilitadores:', [...e.facilitadores].join(' | '));
  console.log('  Editors:', [...e.editors].join(', '));
}
