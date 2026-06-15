import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const LIST = process.argv[2] ?? '4e115aab-39c5-4aab-8d5a-e905f4efd65d';
const siteId = process.env.SHAREPOINT_SITE_ID;
const url = process.env.VITE_SUPABASE_URL;
const sk = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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

const list = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST}?$select=displayName,name`,
  { headers: h },
).then((r) => r.json());
console.log('Lista:', list.displayName, `(${LIST})`);

const cols = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST}/columns?$select=name,displayName,personOrGroup`,
  { headers: h },
).then((r) => r.json());

const personCols = (cols.value ?? []).filter(
  (c) => c.personOrGroup && !['Author', 'Editor'].includes(c.name),
);
console.log('Colunas person:', personCols.map((c) => `${c.displayName} (${c.name})`).join(', '));

// User Information List
const allLists = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName,list&$top=200`,
  { headers: h },
).then((r) => r.json());
const uil = (allLists.value ?? []).find(
  (l) => l.list?.template === 'userInfo' || /user information/i.test(l.displayName ?? ''),
);
console.log('User Information List:', uil?.id ?? 'não encontrada');

const SKIP = new Set(['AuthorLookupId', 'EditorLookupId', 'AppAuthorLookupId', 'AppEditorLookupId']);
const lookupIds = new Set();

let items = [];
let next = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST}/items?expand=fields&$top=200`;
while (next && items.length < 8000) {
  const page = await fetch(next, { headers: h }).then((r) => r.json());
  if (page.error) {
    console.error(page.error.message);
    break;
  }
  items.push(...(page.value ?? []));
  next = page['@odata.nextLink'] ?? null;
}
console.log('Itens:', items.length);

for (const item of items) {
  for (const [k, v] of Object.entries(item.fields ?? {})) {
    if (k.endsWith('LookupId') && !SKIP.has(k) && v) lookupIds.add(String(v));
  }
}
console.log('LookupIds distintos:', lookupIds.size, [...lookupIds].sort((a, b) => Number(a) - Number(b)).join(', '));

// Map LookupId -> nome via User Information List
const idToMeta = new Map();
if (uil) {
  let uNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${uil.id}/items?expand=fields&$top=500`;
  while (uNext) {
    const page = await fetch(uNext, { headers: h }).then((r) => r.json());
    for (const row of page.value ?? []) {
      const f = row.fields ?? {};
      const id = String(f.id ?? f.ID ?? row.id ?? '');
      if (!id) continue;
      idToMeta.set(id, {
        title: f.Title ?? f.Name ?? f.LinkTitle ?? '',
        email: f.EMail ?? f.Email ?? f.UserEmail ?? '',
        sip: f.SipAddress ?? f.sipaddress ?? '',
      });
    }
    uNext = page['@odata.nextLink'] ?? null;
  }
  console.log('Entradas UIL:', idToMeta.size);
}

// Resolve lookup ids from protocolos list
console.log('\nLookupId -> UIL:');
const resolved = {};
for (const id of [...lookupIds].sort((a, b) => Number(a) - Number(b))) {
  const meta = idToMeta.get(id);
  if (meta) {
    resolved[id] = meta;
    console.log(`  ${id} -> ${meta.title} | ${meta.email || meta.sip || '(sem email)'}`);
  } else {
    console.log(`  ${id} -> (não na UIL)`);
  }
}

// Cross with app users
const graphUsers = [];
let gNext = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
while (gNext) {
  const p = await fetch(gNext, { headers: h }).then(r => r.json());
  graphUsers.push(...(p.value ?? []));
  gNext = p['@odata.nextLink'] ?? null;
}

const appUsers = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers: { apikey: sk, Authorization: `Bearer ${sk}` } },
).then((r) => r.json());

function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}
function emailVariants(email) {
  const t = norm(email);
  const s = new Set([t]);
  if (t.endsWith('@bismarchipires.com.br')) s.add(t.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  if (t.endsWith('@bpplaw.com.br')) s.add(t.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  return [...s];
}

const emailToLookup = {};
const nameToLookup = {};
for (const [id, meta] of Object.entries(resolved)) {
  if (meta.email) {
    for (const v of emailVariants(meta.email)) emailToLookup[v] = id;
  }
  if (meta.sip?.includes('@')) {
    const sipEmail = meta.sip.replace(/^sip:/i, '').split('|').pop()?.toLowerCase();
    if (sipEmail) for (const v of emailVariants(sipEmail)) emailToLookup[v] = id;
  }
  if (meta.title) nameToLookup[norm(meta.title)] = id;
}

const matched = [];
const unmapped = [];
for (const u of appUsers) {
  if (!u.email || /@(example|gmail|uticomput)/i.test(u.email)) continue;
  let lid = null;
  for (const v of emailVariants(u.email)) {
    if (emailToLookup[v]) { lid = emailToLookup[v]; break; }
  }
  if (!lid) lid = nameToLookup[norm(u.name)] ?? null;
  if (!lid) {
    const gu = graphUsers.find((g) =>
      emailVariants(u.email).some((ev) => norm(ev) === norm(g.mail ?? g.userPrincipalName ?? '')),
    );
    if (gu) lid = nameToLookup[norm(gu.displayName)] ?? null;
  }
  if (lid) matched.push({ name: u.name, email: u.email, lookupId: lid, sp: resolved[lid]?.title });
  else unmapped.push(u);
}

console.log(`\nApp users mapeáveis via esta lista+UIL: ${matched.length}/${appUsers.length}`);
for (const m of matched.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${m.name} -> ${m.lookupId} (${m.sp})`);
}
if (unmapped.length) {
  console.log(`\nSem match (${unmapped.length}):`);
  for (const u of unmapped.slice(0, 10)) console.log(`  ${u.name} (${u.email})`);
}

// Stats per person column
console.log('\nPor coluna person:');
for (const col of personCols) {
  const key = `${col.name}LookupId`;
  const counts = new Map();
  for (const item of items) {
    const lid = item.fields?.[key];
    if (lid) counts.set(String(lid), (counts.get(String(lid)) ?? 0) + 1);
  }
  console.log(`  ${col.displayName}: ${counts.size} LookupIds distintos, top:`,
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${id}(${n})`).join(', '));
}
