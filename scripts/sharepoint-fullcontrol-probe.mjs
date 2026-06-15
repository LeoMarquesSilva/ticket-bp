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
const email = process.argv[2] ?? 'felipe@bpplaw.com.br';

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

// Graph: invite/resolve user on site
for (const path of [
  `/sites/${siteId}/users`,
  `/sites/${siteId}/permissions`,
]) {
  const getRes = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: h });
  console.log('GET', path, getRes.status, (await getRes.text()).slice(0, 300));
}

// POST site user (documented in some Graph versions)
const postUser = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/users`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({ email }),
});
console.log('\nPOST /sites/.../users', postUser.status, (await postUser.text()).slice(0, 400));

// Beta ensureUser equivalent?
const beta = await fetch(`https://graph.microsoft.com/beta/sites/${siteId}/microsoft.graph.ensureUser`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({ userPrincipalName: email }),
}).catch(() => null);
if (beta) console.log('\nBeta ensureUser', beta.status, (await beta.text()).slice(0, 400));

// All lists - find userinfo
let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list&$top=200`;
const lists = [];
while (url) {
  const page = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  if (page.error) { console.log('Lists error', page.error.message); break; }
  lists.push(...(page.value ?? []));
  url = page['@odata.nextLink'] ?? null;
}
console.log('\nLists total:', lists.length);
for (const l of lists) {
  const t = l.list?.template ?? '';
  if (/user|info|person/i.test(l.displayName) || t === 'userInfo' || l.displayName === 'User Information List') {
    console.log(' ->', l.displayName, l.id, t);
  }
}

// Try hidden user info by known GUID patterns - get site root lists with expand
const siteLists = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=contains(displayName,'User')`,
  { headers: { Authorization: `Bearer ${tok.access_token}` } },
).then((r) => r.json());
console.log('\nFilter User lists:', siteLists.value?.length ?? siteLists.error?.message);

// SharePoint REST via Graph proxy - different accept
const site = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}?$select=webUrl`, {
  headers: { Authorization: `Bearer ${tok.access_token}` },
}).then((r) => r.json());
const base = site.webUrl.replace(/\/$/, '');

for (const [label, accept] of [
  ['verbose', 'application/json;odata=verbose'],
  ['nometadata', 'application/json;odata=nometadata'],
  ['minimal', 'application/json;odata=minimalmetadata'],
]) {
  const res = await fetch(`${base}/_api/web/ensureUser`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      Accept: accept,
      'Content-Type': accept,
    },
    body: JSON.stringify({ logonName: `i:0#.f|membership|${email}` }),
  });
  console.log(`\nensureUser ${label}:`, res.status, (await res.text()).slice(0, 250));
}

// siteusers with graph token
const su = await fetch(`${base}/_api/web/siteusers?$top=3`, {
  headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json;odata=nometadata' },
});
console.log('\nsiteusers top3:', su.status, (await su.text()).slice(0, 400));
