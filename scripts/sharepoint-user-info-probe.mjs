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

const paths = [
  `/sites/${siteId}/lists/User Information List`,
  `/sites/${siteId}/lists/Usu%C3%A1rios`,
];

for (const path of paths) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: h });
  console.log(path, res.status, (await res.text()).slice(0, 150));
}

const aad = await fetch(
  `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${email}'&$select=id,mail,userPrincipalName,displayName`,
  { headers: h },
).then((r) => r.json());
console.log('AAD user:', aad.value?.[0] ?? aad.error);

// Try ensureUser via SharePoint REST through graph proxy - use site web endpoint
const siteWeb = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/sites`, { headers: h }).catch(() => null);

// Hidden lists
const hidden = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=hidden eq true&$select=id,displayName,list`,
  { headers: h },
).then((r) => r.json());
console.log('Hidden lists:');
for (const l of hidden.value ?? []) {
  console.log(' -', l.displayName, l.id, l.list?.template);
}
