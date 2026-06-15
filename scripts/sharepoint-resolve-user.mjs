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

const emails = process.argv.slice(2);
if (!emails.length) {
  console.error('Uso: node scripts/sharepoint-resolve-user.mjs email1 email2');
  process.exit(1);
}

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

const h = {
  Authorization: `Bearer ${tok.access_token}`,
  Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
};

const lists = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName&$filter=displayName eq 'User Information List'`,
  { headers: h },
).then((r) => r.json());

const userListId = lists.value?.[0]?.id;
if (!userListId) {
  console.error('User Information List não encontrada');
  process.exit(1);
}

for (const email of emails) {
  const filter = encodeURIComponent(`fields/EMail eq '${email}'`);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${userListId}/items?$filter=${filter}&$expand=fields&$select=id`,
    { headers: h },
  );
  const json = await res.json();
  const item = json.value?.[0];
  console.log(email, '-> lookupId:', item?.id ?? 'NOT FOUND', item?.fields?.Title ?? '');
}
