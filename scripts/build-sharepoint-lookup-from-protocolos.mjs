/**
 * Extrai LookupId da lista CONTROLE DE PROTOCOLOS (ou outra via argv).
 * Método: quando AuthorLookupId == PROTOCOLADOPOR/CHECKADOPOR, usa createdBy.email.
 * Evita falso positivo do LookupId 31 (automação em massa).
 */
import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const LIST = args[0] ?? '4e115aab-39c5-4aab-8d5a-e905f4efd65d';
const dryRun = process.argv.includes('--dry-run');
const MIN_VOTES = Number(process.env.MIN_VOTES ?? 2);
const siteId = process.env.SHAREPOINT_SITE_ID;
const url = process.env.VITE_SUPABASE_URL;
const sk = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function emailVariants(email) {
  const t = norm(email);
  const s = new Set([t]);
  if (t.endsWith('@bismarchipires.com.br')) s.add(t.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  if (t.endsWith('@bpplaw.com.br')) s.add(t.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  return [...s];
}

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

const listMeta = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST}?$select=displayName`,
  { headers: h },
).then((r) => r.json());
console.log('Lista:', listMeta.displayName, LIST);

const votes = new Map(); // lookupId -> Map<email, count>

function vote(lookupId, email) {
  if (!lookupId || !email) return;
  const id = String(lookupId);
  if (!votes.has(id)) votes.set(id, new Map());
  const m = votes.get(id);
  const e = norm(email);
  m.set(e, (m.get(e) ?? 0) + 1);
}

let items = 0;
let next = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST}/items?expand=fields(select=PROTOCOLADOPORLookupId,CHECKADOPORLookupId,AuthorLookupId,EditorLookupId)&select=id,createdBy,lastModifiedBy&$top=200`;
while (next && items < 12000) {
  const page = await fetch(next, { headers: h }).then((r) => r.json());
  if (page.error) {
    console.error(page.error.message);
    break;
  }
  for (const item of page.value ?? []) {
    items++;
    const f = item.fields ?? {};
    const author = f.AuthorLookupId;
    const editor = f.EditorLookupId;
    const proto = f.PROTOCOLADOPORLookupId;
    const check = f.CHECKADOPORLookupId;
    const cEmail = item.createdBy?.user?.email;
    const mEmail = item.lastModifiedBy?.user?.email;

    if (author && cEmail) {
      if (proto && String(proto) === String(author)) vote(proto, cEmail);
      if (check && String(check) === String(author)) vote(check, cEmail);
    }
    if (editor && mEmail) {
      if (proto && String(proto) === String(editor)) vote(proto, mEmail);
      if (check && String(check) === String(editor)) vote(check, mEmail);
    }
  }
  next = page['@odata.nextLink'] ?? null;
}
console.log('Itens analisados:', items);

const lookupToEmail = {};
for (const [id, emailVotes] of votes) {
  const best = [...emailVotes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best[1] >= MIN_VOTES) lookupToEmail[id] = { email: best[0], votes: best[1] };
}

console.log(`LookupIds confiáveis (>= ${MIN_VOTES} votos):`, Object.keys(lookupToEmail).length);
for (const [id, meta] of Object.entries(lookupToEmail).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  ${id} -> ${meta.email} (${meta.votes}x)`);
}

const appUsers = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers: { apikey: sk, Authorization: `Bearer ${sk}` } },
).then((r) => r.json());

const emailToLookup = {};
for (const [id, meta] of Object.entries(lookupToEmail)) {
  for (const v of emailVariants(meta.email)) emailToLookup[v] = id;
}

const matched = [];
for (const u of appUsers) {
  if (!u.email || /@(example|gmail|uticomput)/i.test(u.email)) continue;
  let lid = null;
  for (const v of emailVariants(u.email)) {
    if (emailToLookup[v]) {
      lid = emailToLookup[v];
      break;
    }
  }
  if (lid) matched.push({ name: u.name, email: u.email, lookupId: lid });
}

console.log(`\nApp users cobertos: ${matched.length}/${appUsers.length}`);
for (const m of matched.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${m.name} -> ${m.lookupId}`);
}

if (dryRun) process.exit(0);

const existingRes = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups&select=value`,
  { headers: { apikey: sk, Authorization: `Bearer ${sk}` } },
).then((r) => r.json());

let merged = {};
try {
  merged = JSON.parse(existingRes[0]?.value ?? '{}');
} catch {
  merged = {};
}

let added = 0;
for (const [id, meta] of Object.entries(lookupToEmail)) {
  for (const v of emailVariants(meta.email)) {
    if (!merged[v]) {
      merged[v] = id;
      added++;
    }
  }
}

const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_integration_settings`, {
  method: 'POST',
  headers: {
    apikey: sk,
    Authorization: `Bearer ${sk}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify({
    key: 'sharepoint_person_lookups',
    value: JSON.stringify(merged),
    updated_at: new Date().toISOString(),
  }),
});

console.log(`\nMerge: +${added} chaves (${Object.keys(merged).length} total). Salvo:`, res.ok);
