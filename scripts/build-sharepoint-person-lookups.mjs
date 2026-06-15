/**
 * Cruza usuários do Graph (Azure AD) + app + histórico SharePoint
 * para gerar mapa e-mail/nome -> SharePoint LookupId (Responsável).
 *
 * Uso: node scripts/build-sharepoint-person-lookups.mjs [--dry-run]
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
const tenant = process.env.MICROSOFT_TENANT_ID;
const clientId = process.env.MICROSOFT_CLIENT_ID;
const secret = process.env.MICROSOFT_CLIENT_SECRET;
const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;

/** LookupIds confirmados manualmente (prioridade máxima). */
const MANUAL_OVERRIDES = {
  'felipe@bismarchipires.com.br': '411',
  'felipe@bpplaw.com.br': '411',
  'gabriela.consul@bismarchipires.com.br': '12',
  'controladoria@bpplaw.com.br': '15',
  'mariaponce@bismarchipires.com.br': '227',
  'renato@bismarchipires.com.br': '40',
  'wagner.armani@bismarchipires.com.br': '199',
};

/** Lookup compartilhado — só atribuir ao responsável default. */
const SHARED_DEFAULT_LOOKUP = '15';

const SKIP_EMAIL = /@(example\.com|gmail\.com)$/i;
const SKIP_UTI = /@uticomputadores\.com$/i;

function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

function tokens(name) {
  return norm(name)
    .split(/[\s,&]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function firstLast(name) {
  const t = tokens(name);
  if (t.length === 0) return [];
  if (t.length === 1) return t;
  return [t[0], t[t.length - 1]];
}

function nameMatches(label, personName) {
  const a = norm(label);
  const b = norm(personName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const flA = firstLast(a);
  const flB = firstLast(b);
  if (flA.length >= 2 && flB.length >= 2 && flA[0] === flB[0] && flA[1] === flB[1]) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  const overlap = ta.filter((x) => tb.includes(x));
  if (overlap.length >= 2) return true;
  if (overlap.length === 1 && (ta.length === 1 || tb.length === 1)) return true;
  return false;
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

function addAssignment(assignments, user, lookupId, score, reason) {
  if (!user?.id || !lookupId) return;
  if (!assignments.has(user.id)) assignments.set(user.id, []);
  assignments.get(user.id).push({ lookupId: String(lookupId), score, reason, user });
}

function labelsForUser(user) {
  const labels = new Set([user.name, user.graphDisplayName].filter(Boolean));
  return [...labels];
}

function itemMatchesUser(facilitador, user) {
  if (!facilitador) return false;
  for (const part of String(facilitador).split(/\s*&\s*/)) {
    for (const label of labelsForUser(user)) {
      if (nameMatches(part, label)) return true;
    }
  }
  return false;
}

// --- Auth Graph ---
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

if (!tok.access_token) {
  console.error('Falha ao obter token Graph');
  process.exit(1);
}

const graphHeaders = { Authorization: `Bearer ${tok.access_token}` };

// --- Usuários Graph (tenant) ---
const graphByMail = new Map();
let graphNext = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
while (graphNext) {
  const page = await fetch(graphNext, { headers: graphHeaders }).then((r) => r.json());
  if (page.error) {
    console.error('Graph /users:', page.error.message);
    process.exit(1);
  }
  for (const u of page.value ?? []) {
    for (const addr of [u.mail, u.userPrincipalName]) {
      if (addr) graphByMail.set(norm(addr), u);
    }
  }
  graphNext = page['@odata.nextLink'] ?? null;
}

// --- Usuários app ---
const appUsersRaw = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true&order=name`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
).then((r) => r.json());

const appUsers = appUsersRaw
  .filter((u) => u.email && !SKIP_EMAIL.test(u.email) && !SKIP_UTI.test(u.email))
  .map((u) => {
    let graphUser = null;
    for (const variant of emailVariants(u.email)) {
      graphUser = graphByMail.get(norm(variant));
      if (graphUser) break;
    }
    return {
      ...u,
      graphId: graphUser?.id ?? null,
      graphDisplayName: graphUser?.displayName ?? null,
      graphMail: graphUser?.mail ?? graphUser?.userPrincipalName ?? null,
    };
  });

const withGraph = appUsers.filter((u) => u.graphId);
console.log(`Graph tenant: ${graphByMail.size} e-mails | App BP: ${appUsers.length} | Com Graph: ${withGraph.length}`);

// --- Itens SharePoint ---
let spNext = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
const spItems = [];
while (spNext) {
  const page = await fetch(spNext, { headers: graphHeaders }).then((r) => r.json());
  if (page.error) throw new Error(page.error.message);
  spItems.push(...(page.value ?? []));
  spNext = page['@odata.nextLink'] ?? null;
}

const byLookup = new Map();
for (const item of spItems) {
  const f = item.fields ?? {};
  const lookupId = f.Respons_x00e1_velLookupId;
  if (!lookupId) continue;
  const key = String(lookupId);
  if (!byLookup.has(key)) {
    byLookup.set(key, {
      facilitadores: new Map(),
      editorMatches: 0,
      count: 0,
      editors: new Map(),
    });
  }
  const entry = byLookup.get(key);
  entry.count++;
  const fac = String(f.Facilitador ?? '').trim();
  if (fac) entry.facilitadores.set(fac, (entry.facilitadores.get(fac) ?? 0) + 1);
  const editor = f.EditorLookupId ? String(f.EditorLookupId) : null;
  if (editor) entry.editors.set(editor, (entry.editors.get(editor) ?? 0) + 1);
  if (editor === key) entry.editorMatches++;
}

const assignments = new Map();

function uniqueAppMatch(label) {
  return appUsers.filter((u) => labelsForUser(u).some((l) => nameMatches(label, l)));
}

// --- Heurística por LookupId ---
for (const [lookupId, data] of byLookup.entries()) {
  const facCount = data.facilitadores.size;
  const editorRatio = data.editorMatches / data.count;

  if (lookupId === SHARED_DEFAULT_LOOKUP) {
    const samuel = appUsers.find((u) => norm(u.email) === 'controladoria@bpplaw.com.br');
    if (samuel) addAssignment(assignments, samuel, lookupId, 90, 'default-controladoria');
    continue;
  }

  // Dono: editor === lookup na maioria + facilitador único ou nome bate com um usuário
  if (editorRatio >= 0.5 && facCount <= 2) {
    const topFac = [...data.facilitadores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topFac) {
      for (const part of topFac.split(/\s*&\s*/)) {
        const matches = uniqueAppMatch(part);
        if (matches.length === 1) {
          addAssignment(assignments, matches[0], lookupId, 100, 'editor===lookup');
        }
      }
    }
  }
}

for (const [lookupId, data] of byLookup.entries()) {
  const facCount = data.facilitadores.size;

  if (lookupId === SHARED_DEFAULT_LOOKUP) continue;

  // Lookup com único facilitador
  if (facCount === 1) {
    const facName = [...data.facilitadores.keys()][0];
    for (const part of facName.split(/\s*&\s*/)) {
      const matches = uniqueAppMatch(part);
      if (matches.length === 1) {
        addAssignment(assignments, matches[0], lookupId, 85, 'facilitador-unico');
      }
    }
  }

  // Lookup 199 / similares: editor bate com lookup em parte dos itens
  if (data.editors.has(lookupId) && data.editorMatches > 0 && facCount <= 4) {
    for (const [facName] of data.facilitadores.entries()) {
      if (/[,;&]| e /i.test(facName)) continue;
      const matches = uniqueAppMatch(facName);
      if (matches.length === 1) {
        addAssignment(assignments, matches[0], lookupId, 92, 'editor-parcial+fac');
      }
    }
  }
}

// --- Heurística por usuário: vota em LookupIds via histórico + Graph displayName ---
for (const user of withGraph) {
  const votes = new Map();

  for (const item of spItems) {
    const f = item.fields ?? {};
    const lookupId = f.Respons_x00e1_velLookupId ? String(f.Respons_x00e1_velLookupId) : null;
    const fac = String(f.Facilitador ?? '').trim();
    const editor = f.EditorLookupId ? String(f.EditorLookupId) : null;
    if (!lookupId || !fac) continue;

    const lookupMeta = byLookup.get(lookupId);
    const facCount = lookupMeta?.facilitadores.size ?? 0;

    if (lookupId === SHARED_DEFAULT_LOOKUP && norm(user.email) !== 'controladoria@bpplaw.com.br') {
      continue;
    }

    // Lookups compartilhados com vários facilitadores — não inferir por voto
    if (facCount > 1) continue;

    if (!itemMatchesUser(fac, user)) continue;

    // Lookup muito compartilhado: só conta se editor === lookup
    if (facCount > 3 && editor !== lookupId) continue;

    let weight = 1;
    if (editor === lookupId) weight = 3;
    if (facCount === 1) weight += 1;

    votes.set(lookupId, (votes.get(lookupId) ?? 0) + weight);
  }

  if (votes.size === 0) continue;

  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [bestId, bestScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;
  const lookupMeta = byLookup.get(bestId);
  const facCount = lookupMeta?.facilitadores.size ?? 99;

  if (bestScore >= 3 && bestScore > secondScore && facCount <= 2) {
    addAssignment(assignments, user, bestId, 78, `votos-historico:${bestScore}`);
  } else if (bestScore >= 2 && secondScore === 0 && facCount === 1) {
    addAssignment(assignments, user, bestId, 72, `votos-historico:${bestScore}`);
  }
}

// --- Overrides manuais ---
for (const user of appUsers) {
  for (const ev of emailVariants(user.email)) {
    const override = MANUAL_OVERRIDES[ev];
    if (override) addAssignment(assignments, user, override, 200, 'manual');
  }
}

// --- Melhor score por usuário (detecta conflito) ---
const userToLookup = new Map();
const conflicts = [];

for (const [userId, opts] of assignments.entries()) {
  const sorted = opts.sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const alt = sorted.find((o) => o.lookupId !== best.lookupId && o.score >= best.score - 10);
  if (alt && alt.lookupId !== best.lookupId) {
    conflicts.push({ user: best.user.name, a: best, b: alt });
  }
  userToLookup.set(userId, best);
}

const map = {};
for (const [, { user, lookupId }] of userToLookup.entries()) {
  map[norm(user.email)] = lookupId;
  map[norm(user.name)] = lookupId;
  if (user.graphDisplayName) map[norm(user.graphDisplayName)] = lookupId;
  for (const ev of emailVariants(user.email)) map[norm(ev)] = lookupId;
  if (user.graphMail) map[norm(user.graphMail)] = lookupId;
}

const mappedUsers = appUsers.filter((u) => userToLookup.has(u.id));
const unmapped = appUsers.filter((u) => !userToLookup.has(u.id));
const unmappedWithGraph = unmapped.filter((u) => u.graphId);

console.log(`\nSharePoint: ${spItems.length} itens | ${byLookup.size} LookupIds distintos`);
console.log(`LookupId mapeados: ${mappedUsers.length}/${appUsers.length}`);
console.log(`Sem LookupId (com Graph): ${unmappedWithGraph.length}`);

console.log('\n--- Mapeamentos ---');
for (const u of mappedUsers.sort((a, b) => a.name.localeCompare(b.name))) {
  const a = userToLookup.get(u.id);
  const graphHint = u.graphDisplayName ? ` | Graph: ${u.graphDisplayName}` : '';
  console.log(`  ${u.name} -> ${a.lookupId} [${a.reason}]${graphHint}`);
}

if (conflicts.length) {
  console.log('\n--- Conflitos (prevalece maior score) ---');
  for (const c of conflicts.slice(0, 8)) {
    console.log(`  ${c.user}: ${c.a.lookupId}(${c.a.score}) vs ${c.b.lookupId}(${c.b.score})`);
  }
}

if (unmappedWithGraph.length) {
  console.log('\n--- Sem LookupId (existem no Graph, sem histórico SP) ---');
  for (const u of unmappedWithGraph) {
    console.log(`  ${u.name} (${u.email})${u.graphDisplayName ? ` — ${u.graphDisplayName}` : ''}`);
  }
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
