/**
 * Audita sharepoint_person_lookups vs fontes confiáveis (Pedidos de Acesso + protocolos).
 * Uso: node scripts/audit-sharepoint-lookup-map.mjs
 */
import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const siteId = process.env.SHAREPOINT_SITE_ID;
const accessListId = 'c383d939-0b4c-4348-b870-c2de3ed332c2';
const protocolosListId = '4e115aab-39c5-4aab-8d5a-e905f4efd65d';
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function emailVariants(email) {
  const t = norm(email);
  const s = new Set([t]);
  if (t.endsWith('@bismarchipires.com.br')) s.add(t.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  if (t.endsWith('@bpplaw.com.br')) s.add(t.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  return [...s];
}

function cleanName(name) {
  return String(name ?? '').replace(/^ex\s+func\s+/i, '').replace(/^ex\s+/i, '').replace(/\s+/g, ' ').trim();
}

function nameMatches(a, b) {
  const x = norm(cleanName(a));
  const y = norm(cleanName(b));
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const ta = x.split(/\s+/);
  const tb = y.split(/\s+/);
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
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
const gh = { Authorization: `Bearer ${tok.access_token}` };

// --- Pedidos de Acesso: displayName -> lookupId (votos) ---
const pedidosByName = new Map();
let arNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${accessListId}/items?expand=fields&$top=200`;
while (arNext) {
  const page = await fetch(arNext, { headers: gh }).then((r) => r.json());
  for (const item of page.value ?? []) {
    const f = item.fields ?? {};
    const name = cleanName(f.RequestedForDisplayNameDisp ?? f.RequestedByDisplayNameDisp);
    const lookupId = f.ReqForUserLookupId ?? f.ReqByUserLookupId;
    if (!name || !lookupId) continue;
    const key = norm(name);
    if (!pedidosByName.has(key)) pedidosByName.set(key, new Map());
    const votes = pedidosByName.get(key);
    votes.set(String(lookupId), (votes.get(String(lookupId)) ?? 0) + 1);
  }
  arNext = page['@odata.nextLink'] ?? null;
}

function bestLookup(votes) {
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0] ? { id: sorted[0][0], votes: sorted[0][1] } : null;
}

// --- Protocolos: lookupId -> email (votos, min 2) ---
const protoVotes = new Map();
let protoNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${protocolosListId}/items?expand=fields(select=PROTOCOLADOPORLookupId,CHECKADOPORLookupId,AuthorLookupId)&select=id,createdBy&$top=200`;
let protoItems = 0;
while (protoNext && protoItems < 15000) {
  const page = await fetch(protoNext, { headers: gh }).then((r) => r.json());
  for (const item of page.value ?? []) {
    protoItems++;
    const f = item.fields ?? {};
    const email = item.createdBy?.user?.email;
    if (!email) continue;
    const author = f.AuthorLookupId;
    for (const lid of [f.PROTOCOLADOPORLookupId, f.CHECKADOPORLookupId]) {
      if (lid && author && String(lid) === String(author)) {
        const id = String(lid);
        if (!protoVotes.has(id)) protoVotes.set(id, new Map());
        const m = protoVotes.get(id);
        const e = norm(email);
        m.set(e, (m.get(e) ?? 0) + 1);
      }
    }
  }
  protoNext = page['@odata.nextLink'] ?? null;
}

const protoEmailToLookup = new Map();
for (const [lid, emailVotes] of protoVotes) {
  const best = [...emailVotes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) {
    for (const ev of emailVariants(best[0])) protoEmailToLookup.set(ev, lid);
  }
}

// --- Mapa atual + usuários app ---
const settings = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups&select=value`,
  { headers },
).then((r) => r.json());
const currentMap = JSON.parse(settings[0]?.value ?? '{}');

const appUsers = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers },
).then((r) => r.json());

const graphUsers = [];
let gNext = 'https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName&$top=999';
while (gNext) {
  const page = await fetch(gNext, { headers: gh }).then((r) => r.json());
  graphUsers.push(...(page.value ?? []));
  gNext = page['@odata.nextLink'] ?? null;
}

function currentLookupForUser(user) {
  for (const ev of emailVariants(user.email)) {
    const byEmail = currentMap[norm(ev)];
    if (byEmail) return byEmail;
  }
  return currentMap[norm(user.name)] ?? null;
}

function pedidosLookupForUser(user) {
  const gu = graphUsers.find((g) =>
    emailVariants(user.email).some((ev) => norm(ev) === norm(g.mail ?? g.userPrincipalName ?? '')),
  );
  const names = [user.name, gu?.displayName].filter(Boolean);
  for (const name of names) {
    for (const [nameKey, votes] of pedidosByName.entries()) {
      if (nameMatches(name, nameKey)) {
        const b = bestLookup(votes);
        if (b) return { ...b, source: 'pedidos', matchedName: nameKey };
      }
    }
  }
  return null;
}

function protoLookupForUser(user) {
  for (const ev of emailVariants(user.email)) {
    const lid = protoEmailToLookup.get(norm(ev));
    if (lid) return { id: lid, source: 'protocolos' };
  }
  return null;
}

const conflicts = [];
const ok = [];
const onlyCurrent = [];
const noMap = [];

for (const user of appUsers.filter((u) => u.email && !/@(example\.com|gmail\.com)$/i.test(u.email))) {
  const current = currentLookupForUser(user);
  const pedidos = pedidosLookupForUser(user);
  const proto = protoLookupForUser(user);

  if (!current) {
    noMap.push({ name: user.name, email: user.email, pedidos: pedidos?.id, proto: proto?.id });
    continue;
  }

  const refs = [];
  if (pedidos) refs.push({ id: pedidos.id, source: `pedidos(${pedidos.votes}x)`, name: pedidos.matchedName });
  if (proto) refs.push({ id: proto.id, source: 'protocolos' });

  const refIds = new Set(refs.map((r) => r.id));
  const disagree = refs.filter((r) => r.id !== current);

  if (disagree.length > 0) {
    conflicts.push({
      name: user.name,
      email: user.email,
      current,
      refs,
      disagree,
    });
  } else if (refs.length > 0) {
    ok.push({ name: user.name, email: user.email, current, refs });
  } else {
    onlyCurrent.push({ name: user.name, email: user.email, current });
  }
}

// LookupIds usados por múltiplos e-mails no mapa atual (suspeito)
const lookupToEmails = new Map();
for (const [key, lid] of Object.entries(currentMap)) {
  if (!lid || !key.includes('@')) continue;
  if (!lookupToEmails.has(lid)) lookupToEmails.set(lid, new Set());
  lookupToEmails.get(lid).add(key);
}
const sharedLookups = [...lookupToEmails.entries()]
  .filter(([, emails]) => emails.size > 1)
  .map(([lid, emails]) => ({ lid, emails: [...emails] }));

console.log('\n========== AUDITORIA sharepoint_person_lookups ==========\n');
console.log(`Usuários app: ${appUsers.length}`);
console.log(`Chaves no mapa: ${Object.keys(currentMap).length}`);
console.log(`Pedidos de Acesso (nomes): ${pedidosByName.size}`);
console.log(`Protocolos analisados: ${protoItems} | e-mails confiáveis: ${protoEmailToLookup.size}`);

console.log(`\n--- CONFLITOS (mapa atual ≠ fonte confiável) [${conflicts.length}] ---`);
for (const c of conflicts.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`\n* ${c.name} <${c.email}>`);
  console.log(`  Mapa atual: ${c.current}`);
  for (const r of c.refs) {
    const mark = r.id !== c.current ? '⚠' : '✓';
    console.log(`  ${mark} ${r.source}: LookupId ${r.id}${r.name ? ` (nome SP: ${r.name})` : ''}`);
  }
}

console.log(`\n--- SEM MAPA [${noMap.length}] ---`);
for (const u of noMap.slice(0, 25)) {
  console.log(`  ${u.name} <${u.email}> | pedidos:${u.pedidos ?? '-'} proto:${u.proto ?? '-'}`);
}
if (noMap.length > 25) console.log(`  ... +${noMap.length - 25}`);

console.log(`\n--- SÓ MAPA (sem confirmação pedidos/protocolos) [${onlyCurrent.length}] ---`);
for (const u of onlyCurrent.slice(0, 20)) {
  console.log(`  ${u.name} -> ${u.current}`);
}
if (onlyCurrent.length > 20) console.log(`  ... +${onlyCurrent.length - 20}`);

console.log(`\n--- OK (confirmado) [${ok.length}] ---`);
for (const u of ok.slice(0, 15)) {
  console.log(`  ${u.name} -> ${u.current} (${u.refs.map((r) => r.source).join(', ')})`);
}
if (ok.length > 15) console.log(`  ... +${ok.length - 15}`);

console.log(`\n--- MESMO LookupId para vários e-mails [${sharedLookups.length}] ---`);
for (const s of sharedLookups.slice(0, 15)) {
  console.log(`  LookupId ${s.lid}: ${s.emails.join(', ')}`);
}

// Salvar relatório
const report = {
  generatedAt: new Date().toISOString(),
  conflicts,
  noMap,
  onlyCurrent,
  ok,
  sharedLookups,
};
const outPath = `exports/audit-lookups-${new Date().toISOString().slice(0, 10)}.json`;
fs.mkdirSync('exports', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nRelatório salvo: ${outPath}`);
