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
let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list,hidden&$top=100`;
const lists = [];
while (url) {
  const page = await fetch(url, { headers: h }).then((r) => r.json());
  if (page.error) {
    console.error(page.error.message);
    break;
  }
  lists.push(...(page.value ?? []));
  url = page['@odata.nextLink'] ?? null;
}

console.log('Lists:', lists.length);
for (const l of lists) {
  const cols = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${l.id}/columns?$select=name,displayName,columnGroup,personOrGroup&$top=50`,
    { headers: h },
  ).then((r) => r.json());
  const personCols = (cols.value ?? []).filter((c) => c.personOrGroup);
  if (personCols.length === 0) continue;
  console.log(`\n${l.displayName} (${l.id}) person cols:`, personCols.map((c) => c.displayName).join(', '));
}
