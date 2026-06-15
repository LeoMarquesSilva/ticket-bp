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

const queries = [
  'Felipe Camargo',
  'felipe@bismarchipires.com.br',
  'path:https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA AND Felipe',
];

for (const q of queries) {
  for (const region of ['NAM', 'BRA']) {
    const body = {
      requests: [
        {
          entityTypes: ['listItem'],
          query: { queryString: q },
          from: 0,
          size: 3,
          region,
          fields: ['title', 'Facilitador', 'Responsavel', 'Respons_x00e1_vel', 'Respons_x00e1_velLookupId'],
        },
      ],
    };
    const res = await fetch('https://graph.microsoft.com/v1.0/search/query', {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body),
    }).then((r) => r.json());
    const err = res.error?.message;
    const hits = res.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
    console.log(`\nQ="${q}" region=${region}:`, err ?? `${hits.length} hits`);
    if (hits[0]) {
      console.log(JSON.stringify(hits[0], null, 2).slice(0, 800));
    }
  }
}
