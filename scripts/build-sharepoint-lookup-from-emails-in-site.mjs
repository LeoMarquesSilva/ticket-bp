/**
 * Extrai pares e-mail -> LookupId de TODAS as listas do site.
 * Procura e-mails válidos (@bpplaw / @bismarchipires) no mesmo item que Person LookupIds.
 */
import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const dryRun = process.argv.includes('--dry-run');
const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const siteId = process.env.SHAREPOINT_SITE_ID;

const EMAIL_RE = /[a-z0-9._+-]+@(?:bpplaw\.com\.br|bismarchipires\.com\.br)/gi;
const SKIP_LOOKUP = new Set(['AuthorLookupId', 'EditorLookupId', 'AppAuthorLookupId', 'AppEditorLookupId']);

const MANUAL = {
  'felipe@bismarchipires.com.br': '411',
  'felipe@bpplaw.com.br': '411',
  'controladoria@bpplaw.com.br': '15',
  'vinicius.marques@bismarchipires.com.br': '217',
  'vinicius.marques@bpplaw.com.br': '217',
  'gabriela.consul@bpplaw.com.br': '12',
  'gabriela.consul@bismarchipires.com.br': '12',
  'maria.heloiza@bismarchipires.com.br': '227',
  'renato@bismarchipires.com.br': '40',
  'wagner@bismarchipires.com.br': '199',
  'lavinia@bismarchipires.com.br': '163',
  'vinicius.hecksher@bismarchipires.com.br': '159',
};

/** LookupId genérico da controladoria — não usar para pessoas reais. */
const SHARED_LOOKUP_IDS = new Set(['15']);

function norm(v) { return String(v ?? '').trim().toLowerCase(); }

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
const emailVotes = new Map(); // email -> Map<lookupId, count>

function extractEmails(text) {
  return [...new Set((String(text).match(EMAIL_RE) ?? []).map((e) => norm(e)))];
}

function recordItem(f) {
  const emails = new Set();
  for (const v of Object.values(f)) {
    if (typeof v === 'string') extractEmails(v).forEach((e) => emails.add(e));
  }
  const lookups = [];
  for (const [k, v] of Object.entries(f)) {
    if (k.endsWith('LookupId') && !SKIP_LOOKUP.has(k) && v) lookups.push(String(v));
  }
  if (emails.size === 0 || lookups.length === 0) return;

  for (const email of emails) {
    if (!emailVotes.has(email)) emailVotes.set(email, new Map());
    const votes = emailVotes.get(email);
    for (const lid of lookups) votes.set(lid, (votes.get(lid) ?? 0) + 1);
  }
}

let lNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName&$top=200`;
const lists = [];
while (lNext) {
  const page = await fetch(lNext, { headers: h }).then((r) => r.json());
  lists.push(...(page.value ?? []));
  lNext = page['@odata.nextLink'] ?? null;
}

let total = 0;
for (const list of lists) {
  let iNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${list.id}/items?expand=fields&$top=200`;
  let n = 0;
  while (iNext && n < 600) {
    const page = await fetch(iNext, { headers: h }).then((r) => r.json());
    if (page.error) break;
    for (const item of page.value ?? []) {
      n++;
      total++;
      recordItem(item.fields ?? {});
    }
    iNext = page['@odata.nextLink'] ?? null;
  }
}

// Pedidos de Acesso: DisplayName (sem @) — cruza depois com Graph
const arId = 'c383d939-0b4c-4348-b870-c2de3ed332c2';
let arNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${arId}/items?expand=fields&$top=200`;
while (arNext) {
  const page = await fetch(arNext, { headers: h }).then((r) => r.json());
  for (const item of page.value ?? []) {
    const f = item.fields ?? {};
    const name = f.RequestedForDisplayNameDisp;
    const lid = f.ReqForUserLookupId;
    if (!name || !lid) continue;
    // será cruzado via Graph abaixo
    recordItem({ _name: name, _lookup: lid, FacilitadorLookupId: lid, Facilitador: name });
  }
  arNext = page['@odata.nextLink'] ?? null;
}

const graphUsers = [];
let gNext = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
while (gNext) {
  const page = await fetch(gNext, { headers: h }).then((r) => r.json());
  graphUsers.push(...(page.value ?? []));
  gNext = page['@odata.nextLink'] ?? null;
}

const appUsers = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
).then((r) => r.json());

function bestLookup(email) {
  for (const v of emailVariants(email)) {
    if (MANUAL[v]) return MANUAL[v];
  }
  const votes = emailVotes.get(norm(email));
  const pick = (m) => {
    if (!m || m.size === 0) return null;
    const sorted = [...m.entries()]
      .filter(([lid]) => !SHARED_LOOKUP_IDS.has(lid) || norm(email) === 'controladoria@bpplaw.com.br')
      .sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  };
  let id = pick(votes);
  if (!id) {
    for (const v of emailVariants(email)) {
      id = pick(emailVotes.get(v));
      if (id) break;
    }
  }
  if (id && SHARED_LOOKUP_IDS.has(id) && norm(email) !== 'controladoria@bpplaw.com.br') return null;
  return id;
}

const map = {};
const mapped = [];
const unmapped = [];

for (const app of appUsers) {
  if (!app.email || /@(example\.com|gmail\.com|uticomput)/i.test(app.email)) continue;
  let lid = bestLookup(app.email);
  if (!lid) {
    const gu = graphUsers.find((g) => emailVariants(app.email).some((ev) => norm(ev) === norm(g.mail ?? g.userPrincipalName ?? '')));
    if (gu) lid = bestLookup(gu.mail ?? gu.userPrincipalName ?? '');
  }
  if (lid) {
    for (const v of emailVariants(app.email)) map[norm(v)] = lid;
    map[norm(app.name)] = lid;
    mapped.push({ name: app.name, email: app.email, lookupId: lid });
  } else {
    unmapped.push(app);
  }
}

console.log(`Itens analisados: ${total} | Emails com votos: ${emailVotes.size}`);
console.log(`Mapeados: ${mapped.length}/${appUsers.length} | Sem LookupId: ${unmapped.length}`);

for (const m of mapped.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${m.name} -> ${m.lookupId}`);
}
if (unmapped.length) {
  console.log('\nSem LookupId:');
  for (const u of unmapped.slice(0, 15)) console.log(`  ${u.name} (${u.email})`);
  if (unmapped.length > 15) console.log(`  ... +${unmapped.length - 15}`);
}

if (dryRun) process.exit(0);

const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_integration_settings`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify({
    key: 'sharepoint_person_lookups',
    value: JSON.stringify(map),
    updated_at: new Date().toISOString(),
  }),
});
console.log(res.ok ? '\nSalvo.' : '\nErro: ' + (await res.text()));
