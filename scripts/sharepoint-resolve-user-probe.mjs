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
const email = process.argv[2] ?? 'felipe@bismarchipires.com.br';

async function getToken(scope) {
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      scope,
      grant_type: 'client_credentials',
    }),
  });
  return r.json();
}

const graphTok = (await getToken('https://graph.microsoft.com/.default')).access_token;
const spTok = (await getToken('https://bpplaw2.sharepoint.com/.default')).access_token;

const site = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}?$select=webUrl`, {
  headers: { Authorization: `Bearer ${graphTok}` },
}).then((r) => r.json());

const base = site.webUrl.replace(/\/$/, '');
const account = encodeURIComponent(`i:0#.f|membership|${email}`);

const attempts = [
  ['Graph user by UPN', `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id,displayName,mail`],
  ['SP GetUserByEmail graph', `${base}/_api/web/GetUserByEmail('${email}')`],
  ['SP ensureUser graph tok', `${base}/_api/web/ensureUser`, 'POST', graphTok],
  ['SP ensureUser sp tok', `${base}/_api/web/ensureUser`, 'POST', spTok],
  ['SP PeopleManager graph', `${base}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${account}'`],
  ['SP siteusers filter graph', `${base}/_api/web/siteusers?$filter=Email eq '${email}'`],
  ['SP siteusers filter sp', `${base}/_api/web/siteusers?$filter=Email eq '${email}'`, 'GET', spTok],
];

for (const [label, url, method = 'GET', token = graphTok] of attempts) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=nometadata',
      ...(method === 'POST' ? { 'Content-Type': 'application/json;odata=nometadata' } : {}),
    },
    ...(method === 'POST'
      ? { body: JSON.stringify({ logonName: `i:0#.f|membership|${email}` }) }
      : {}),
  };
  const res = await fetch(url, opts);
  const text = await res.text();
  console.log(`\n=== ${label} (${res.status}) ===`);
  console.log(text.slice(0, 500));
}

// Person field object formats on create (dry - only if --try-create passed)
if (process.argv.includes('--try-create')) {
  const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
  const baseFields = {
    Title: `PERSON OBJ TEST ${Date.now()}`,
    NomedoTreinamento: 'PERSON OBJ TEST',
    Facilitador: 'Test',
    Data: '2026-06-20',
    Status: 'Futuro',
    Area: 'Operações Legais',
    Categoria: 'Equipe',
    TipodoTreinamento: 'NÃO',
  };
  const formats = [
    { Respons_x00e1_vel: [{ Email: email, LookupId: 0 }] },
    { Respons_x00e1_vel: { Email: email } },
    { 'Respons_x00e1_vel@odata.type': 'Collection(Edm.String)', Respons_x00e1_vel: [email] },
  ];
  for (const extra of formats) {
    const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${graphTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ...baseFields, ...extra } }),
    });
    const json = await res.json();
    console.log('\nCreate format', JSON.stringify(extra), res.status, json.error?.message ?? json.id);
  }
}
