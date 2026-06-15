/**
 * Mapa LookupId via Pedidos de Acesso (DisplayName + LookupId exatos)
 * + Graph users + overrides manuais.
 *
 * Uso: node scripts/build-sharepoint-lookup-from-site.mjs [--dry-run]
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
const accessRequestsListId = 'c383d939-0b4c-4348-b870-c2de3ed332c2';

const MANUAL_OVERRIDES = {
  'felipe@bismarchipires.com.br': '411',
  'felipe@bpplaw.com.br': '411',
  'gabriela.consul@bismarchipires.com.br': '12',
  'controladoria@bpplaw.com.br': '15',
  'mariaponce@bismarchipires.com.br': '227',
  'renato@bismarchipires.com.br': '40',
  'wagner.armani@bismarchipires.com.br': '199',
  'vinicius.marques@bismarchipires.com.br': '217',
};

const SKIP_EMAIL = /@(example\.com|gmail\.com)$/i;

function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function emailVariants(email) {
  const trimmed = email.trim().toLowerCase();
  const variants = new Set([trimmed]);
  if (trimmed.endsWith('@bismarchipires.com.br')) {
    variants.add(trimmed.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  }
  if (trimmed.endsWith('@bpplaw.com.br')) {
    variants.add(trimmed.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  }
  return [...variants];
}

function cleanName(name) {
  return String(name ?? '')
    .replace(/^ex\s+func\s+/i, '')
    .replace(/^ex\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatches(a, b) {
  const x = norm(cleanName(a));
  const y = norm(cleanName(b));
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const ta = x.split(/\s+/);
  const tb = y.split(/\s+/);
  if (ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]) return true;
  return false;
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

const graphUsers = [];
let gNext = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
while (gNext) {
  const page = await fetch(gNext, { headers: h }).then((r) => r.json());
  graphUsers.push(...(page.value ?? []));
  gNext = page['@odata.nextLink'] ?? null;
}

const appUsers = (await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
).then((r) => r.json())).filter((u) => u.email && !SKIP_EMAIL.test(u.email));

/** displayName -> lookupId (maioria dos pedidos de acesso) */
const lookupByDisplay = new Map();

let arNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${accessRequestsListId}/items?expand=fields&$top=200`;
while (arNext) {
  const page = await fetch(arNext, { headers: h }).then((r) => r.json());
  for (const item of page.value ?? []) {
    const f = item.fields ?? {};
    const name = cleanName(f.RequestedForDisplayNameDisp ?? f.RequestedByDisplayNameDisp);
    const lookupId = f.ReqForUserLookupId ?? f.ReqByUserLookupId;
    if (!name || !lookupId) continue;
    const key = norm(name);
    if (!lookupByDisplay.has(key)) lookupByDisplay.set(key, new Map());
    const votes = lookupByDisplay.get(key);
    votes.set(String(lookupId), (votes.get(String(lookupId)) ?? 0) + 1);
  }
  arNext = page['@odata.nextLink'] ?? null;
}

function lookupForDisplayName(name) {
  const key = norm(cleanName(name));
  const votes = lookupByDisplay.get(key);
  if (!votes) return null;
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function findAppUserByGraphOrName(displayName, email) {
  for (const gu of graphUsers) {
    if (email && emailVariants(email).some((ev) => norm(ev) === norm(gu.mail ?? gu.userPrincipalName ?? ''))) {
      const app = appUsers.find((u) => emailVariants(u.email).some((ev) => norm(ev) === norm(gu.mail ?? gu.userPrincipalName ?? '')));
      if (app) return { app, graph: gu };
    }
  }
  for (const gu of graphUsers) {
    if (nameMatches(displayName, gu.displayName)) {
      const app = appUsers.find((u) => emailVariants(u.email).some((ev) => norm(ev) === norm(gu.mail ?? gu.userPrincipalName ?? '')));
      if (app) return { app, graph: gu };
    }
  }
  for (const app of appUsers) {
    if (nameMatches(displayName, app.name)) return { app, graph: null };
  }
  return null;
}

const userToLookup = new Map();

// Pedidos de Acesso -> app users
for (const [nameKey, votes] of lookupByDisplay.entries()) {
  const lookupId = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const displayLabel = [...votes.keys()][0]; // placeholder
  // recover original casing from first graph match
  let displayName = nameKey;
  for (const gu of graphUsers) {
    if (norm(cleanName(gu.displayName)) === nameKey) {
      displayName = gu.displayName;
      break;
    }
  }

  const found = findAppUserByGraphOrName(displayName);
  if (!found) continue;
  userToLookup.set(found.app.id, { lookupId, reason: 'pedidos-acesso' });
}

// Manual overrides
for (const app of appUsers) {
  for (const ev of emailVariants(app.email)) {
    const manual = MANUAL_OVERRIDES[norm(ev)];
    if (manual) userToLookup.set(app.id, { lookupId: manual, reason: 'manual' });
  }
}

// Graph users com match direto por displayName nos pedidos
for (const app of appUsers) {
  if (userToLookup.has(app.id)) continue;
  const gu = graphUsers.find((g) =>
    emailVariants(app.email).some((ev) => norm(ev) === norm(g.mail ?? g.userPrincipalName ?? '')),
  );
  if (!gu) continue;
  const lid = lookupForDisplayName(gu.displayName) ?? lookupForDisplayName(app.name);
  if (lid) userToLookup.set(app.id, { lookupId: lid, reason: 'graph+pedidos' });
}

const map = {};
const mapped = [];
for (const [userId, { lookupId, reason }] of userToLookup.entries()) {
  const app = appUsers.find((u) => u.id === userId);
  if (!app) continue;
  map[norm(app.email)] = lookupId;
  map[norm(app.name)] = lookupId;
  for (const ev of emailVariants(app.email)) map[norm(ev)] = lookupId;
  const gu = graphUsers.find((g) =>
    emailVariants(app.email).some((ev) => norm(ev) === norm(g.mail ?? g.userPrincipalName ?? '')),
  );
  if (gu?.displayName) map[norm(gu.displayName)] = lookupId;
  mapped.push({ name: app.name, email: app.email, lookupId, reason });
}

const unmapped = appUsers.filter((u) => !userToLookup.has(u.id));

console.log(`Pedidos de Acesso: ${lookupByDisplay.size} nomes`);
console.log(`Mapeados: ${mapped.length}/${appUsers.length} | Sem LookupId: ${unmapped.length}`);

console.log('\n--- Mapeamentos ---');
for (const m of mapped.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${m.name} -> ${m.lookupId} [${m.reason}]`);
}

if (unmapped.length) {
  console.log('\n--- Sem LookupId ---');
  for (const u of unmapped) console.log(`  ${u.name} (${u.email})`);
}

console.log('\nChaves no mapa:', Object.keys(map).length);

if (dryRun) {
  console.log('\n(dry-run)');
  process.exit(0);
}

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

if (!res.ok) {
  console.error('Erro ao salvar:', await res.text());
  process.exit(1);
}

console.log('\nSalvo em integration_settings (sharepoint_person_lookups)');
