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

for (const region of ['BRA', 'NAM', 'EUR', 'APC']) {
  const body = {
    requests: [
      {
        entityTypes: ['person'],
        query: { queryString: email },
        from: 0,
        size: 3,
        region,
      },
    ],
  };
  const res = await fetch('https://graph.microsoft.com/v1.0/search/query', {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  }).then((r) => r.json());
  const err = res.error?.message;
  const hits = res.value?.[0]?.hitsContainers?.[0]?.hits?.length ?? 0;
  console.log(`Region ${region}:`, err ?? `${hits} hits`);
  if (hits > 0) {
    console.log(JSON.stringify(res.value[0].hitsContainers[0].hits[0].resource, null, 2).slice(0, 600));
  }
}

// Paginate all list items
let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200&$select=id,fields`;
let total = 0;
const facilitadores = new Set();
while (url) {
  const page = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  if (page.error) {
    console.error('List error:', page.error.message);
    break;
  }
  for (const item of page.value ?? []) {
    total++;
    const f = item.fields ?? {};
    if (f.Facilitador) facilitadores.add(String(f.Facilitador).trim());
  }
  url = page['@odata.nextLink'] ?? null;
}
console.log('\nTotal SP items:', total);
console.log('Unique facilitadores:', facilitadores.size);
console.log([...facilitadores].slice(0, 20).join('\n'));
