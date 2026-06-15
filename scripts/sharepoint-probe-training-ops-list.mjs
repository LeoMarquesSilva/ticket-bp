import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const siteId = process.env.SHAREPOINT_SITE_ID;
const trainingOpsListId = '30ea2880-475e-489c-8600-ae541d29faf3';

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

const h = { Authorization: `Bearer ${tok.access_token}` };

const cols = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${trainingOpsListId}/columns?$select=name,displayName,personOrGroup`,
  { headers: h },
).then((r) => r.json());
console.log('Columns person:', (cols.value ?? []).filter((c) => c.personOrGroup).map((c) => c.name));

let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${trainingOpsListId}/items?expand=fields&$top=200`;
const items = [];
while (url) {
  const page = await fetch(url, { headers: h }).then((r) => r.json());
  items.push(...(page.value ?? []));
  url = page['@odata.nextLink'] ?? null;
}
console.log('Items:', items.length);

const byLookup = new Map();
for (const item of items) {
  const f = item.fields ?? {};
  const lid = f.ColaboradorLookupId;
  if (!lid) continue;
  byLookup.set(String(lid), f);
}
console.log('Unique Colaborador LookupIds:', byLookup.size);
for (const [id, f] of [...byLookup.entries()].slice(0, 15)) {
  console.log(id, JSON.stringify(f).slice(0, 150));
}

// Single item full fields
if (items[0]) {
  const one = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${trainingOpsListId}/items/${items[0].id}?expand=fields`,
    { headers: h },
  ).then((r) => r.json());
  console.log('\nFull item fields keys:', Object.keys(one.fields ?? {}));
  console.log(JSON.stringify(one.fields, null, 2).slice(0, 800));
}
