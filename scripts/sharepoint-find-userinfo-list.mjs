import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const siteId = process.env.SHAREPOINT_SITE_ID;
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

let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list&$top=200`;
while (url) {
  const page = await fetch(url, { headers: h }).then((r) => r.json());
  for (const l of page.value ?? []) {
    const items = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${l.id}/items?expand=fields&$top=2&$select=id,fields`,
      { headers: h },
    ).then((r) => r.json());
    const f0 = items.value?.[0]?.fields ?? {};
    const keys = Object.keys(f0);
    const hasEmail = keys.some((k) => /mail|email|em/i.test(k));
    const hasUser = keys.some((k) => /user|name|title|account/i.test(k));
    if (hasEmail || l.list?.template === 'userInfo') {
      console.log('\nLIST:', l.displayName, '|', l.id, '| template:', l.list?.template);
      console.log('  fields sample:', keys.slice(0, 15).join(', '));
      if (items.value?.[0]) console.log('  sample:', JSON.stringify(f0).slice(0, 200));
    }
  }
  url = page['@odata.nextLink'] ?? null;
}

// Try known SharePoint paths for user info list via Graph site path syntax
for (const path of [
  '/Lists/User Information List',
  '/_catalogs/users',
  '/User Information List',
]) {
  const enc = encodeURIComponent(path);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/getByPath('${enc}')`, { headers: h });
  console.log('\ngetByPath', path, r.status, (await r.text()).slice(0, 150));
}
