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

const h = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

// Graph search for people
const searchBody = {
  requests: [
    {
      entityTypes: ['person'],
      query: { queryString: 'felipe' },
      from: 0,
      size: 5,
    },
  ],
};
const search = await fetch('https://graph.microsoft.com/v1.0/search/query', {
  method: 'POST',
  headers: h,
  body: JSON.stringify(searchBody),
}).then((r) => r.json());
console.log('Search person:', JSON.stringify(search, null, 2).slice(0, 1200));

// Site permissions
const perms = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/permissions`, {
  headers: { Authorization: `Bearer ${tok.access_token}` },
}).then((r) => r.json());
console.log('\nPermissions:', perms.error?.message ?? `${perms.value?.length} entries`);
if (perms.value?.[0]) console.log('Sample:', JSON.stringify(perms.value[0], null, 2).slice(0, 400));

// All lists including hidden - full scan for userInfo template
let next = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list,hidden&$top=100`;
const allLists = [];
while (next) {
  const page = await fetch(next, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  allLists.push(...(page.value ?? []));
  next = page['@odata.nextLink'] ?? null;
}
console.log('\nTotal lists:', allLists.length);
for (const l of allLists) {
  if (l.hidden || l.list?.template === 'userInfo' || /user|usu/i.test(l.displayName)) {
    console.log(' -', l.displayName, '| hidden:', l.hidden, '| template:', l.list?.template, '| id:', l.id);
  }
}

// Try beta site users endpoint
const betaUsers = await fetch(`https://graph.microsoft.com/beta/sites/${siteId}/users?$top=3`, {
  headers: { Authorization: `Bearer ${tok.access_token}` },
}).then((r) => r.json());
console.log('\nBeta site users:', betaUsers.error?.message ?? betaUsers.value?.length);
