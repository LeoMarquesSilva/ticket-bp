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

console.log('Site:', site.webUrl);

// Tentativa 1: siteUsers via Graph
const siteUsers = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/users?$top=5`, {
  headers: { Authorization: `Bearer ${graphTok}` },
}).then((r) => r.json());
console.log('\nGraph site users:', siteUsers.error?.message ?? `${siteUsers.value?.length} users`);
if (siteUsers.value?.[0]) console.log('Sample:', siteUsers.value[0].displayName, siteUsers.value[0].email);

// Tentativa 2: SharePoint REST siteusers
const spHeaders = { Authorization: `Bearer ${spTok}`, Accept: 'application/json;odata=nometadata' };
const siteUsersSp = await fetch(
  `${site.webUrl.replace(/\/$/, '')}/_api/web/siteusers?$top=5`,
  { headers: spHeaders },
);
console.log('\nSP REST siteusers:', siteUsersSp.status, (await siteUsersSp.text()).slice(0, 300));

// Tentativa 3: listas com template userInfo
const lists = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list,hidden&$top=200`,
  { headers: { Authorization: `Bearer ${graphTok}` } },
).then((r) => r.json());
for (const l of lists.value ?? []) {
  if (l.list?.template === 'userInfo' || l.hidden) {
    console.log('List:', l.displayName, l.id, 'hidden:', l.hidden, 'template:', l.list?.template);
  }
}

// Tentativa 4: User Information List por nome conhecido
for (const name of ['User Information List', 'Lista de informações sobre o usuário', 'UserInfo']) {
  const enc = encodeURIComponent(name);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${enc}?$select=id,displayName`, {
    headers: { Authorization: `Bearer ${graphTok}` },
  });
  console.log(`List "${name}":`, r.status);
  if (r.ok) {
    const j = await r.json();
    console.log('  id:', j.id);
    const items = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${j.id}/items?$top=3&expand=fields`,
      { headers: { Authorization: `Bearer ${graphTok}` } },
    ).then((x) => x.json());
    console.log('  sample fields:', JSON.stringify(items.value?.[0]?.fields, null, 2)?.slice(0, 400));
  }
}
