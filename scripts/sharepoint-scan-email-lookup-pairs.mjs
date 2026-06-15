/**
 * Varre TODOS os itens do site buscando e-mails (@) em campos
 * e LookupIds de person na mesma linha.
 */
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
const emailToLookup = new Map();

let lNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName&$top=200`;
const lists = [];
while (lNext) {
  const page = await fetch(lNext, { headers: h }).then((r) => r.json());
  lists.push(...(page.value ?? []));
  lNext = page['@odata.nextLink'] ?? null;
}

for (const list of lists) {
  let iNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${list.id}/items?expand=fields&$top=200`;
  let n = 0;
  while (iNext && n < 500) {
    const page = await fetch(iNext, { headers: h }).then((r) => r.json());
    if (page.error) break;
    for (const item of page.value ?? []) {
      n++;
      const f = item.fields ?? {};
      const emails = [];
      const lookups = [];
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'string' && v.includes('@') && /\.(com|br|net)/i.test(v)) {
          emails.push(v.trim().toLowerCase());
        }
        if (/LookupId$/.test(k) && !['AuthorLookupId', 'EditorLookupId', 'AppAuthorLookupId', 'AppEditorLookupId'].includes(k)) {
          lookups.push(String(v));
        }
      }
      if (emails.length === 1 && lookups.length >= 1) {
        const email = emails[0];
        for (const lid of lookups) {
          if (!emailToLookup.has(email)) emailToLookup.set(email, new Map());
          emailToLookup.get(email).set(lid, (emailToLookup.get(email).get(lid) ?? 0) + 1);
        }
      }
    }
    iNext = page['@odata.nextLink'] ?? null;
  }
}

console.log('Emails com LookupId candidato:', emailToLookup.size);
for (const [email, votes] of [...emailToLookup.entries()].slice(0, 30)) {
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(`  ${email} -> ${best[0]} (${best[1]}x)`);
}
