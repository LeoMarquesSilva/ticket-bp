/**
 * Sincroniza e-mail -> Graph user id (Azure AD) para todos os usuários do app.
 * Requer User.Read.All no app registration (mesmo do n8n).
 *
 * Uso: node scripts/sync-graph-user-map.mjs [--dry-run]
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
  console.error('Falha ao obter token:', tok.error_description ?? tok);
  process.exit(1);
}

const h = { Authorization: `Bearer ${tok.access_token}` };

// Puxa todos os usuários do tenant (como no n8n)
const graphUsers = [];
let next = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
while (next) {
  const page = await fetch(next, { headers: h }).then((r) => r.json());
  if (page.error) {
    console.error('\nGraph /users falhou:', page.error.message);
    console.error('\nO app registration usado no .env precisa de User.Read.All (Application)');
    console.error('Use o MESMO Client ID / Secret do n8n, ou peça admin consent no Azure Portal.');
    process.exit(1);
  }
  graphUsers.push(...(page.value ?? []));
  next = page['@odata.nextLink'] ?? null;
}

console.log(`Usuários no Graph (tenant): ${graphUsers.length}`);

const byMail = new Map();
for (const u of graphUsers) {
  for (const addr of [u.mail, u.userPrincipalName]) {
    if (addr) byMail.set(norm(addr), u);
  }
}

const appUsers = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true&email=not.is.null`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
).then((r) => r.json());

const map = {};
const matched = [];
const unmatched = [];

for (const user of appUsers) {
  let graphUser = null;
  for (const variant of emailVariants(user.email)) {
    graphUser = byMail.get(norm(variant));
    if (graphUser) break;
  }
  if (graphUser) {
    map[norm(user.email)] = graphUser.id;
    map[norm(user.name)] = graphUser.id;
    for (const v of emailVariants(user.email)) map[norm(v)] = graphUser.id;
    matched.push({ name: user.name, email: user.email, graphId: graphUser.id });
  } else {
    unmatched.push({ name: user.name, email: user.email });
  }
}

console.log(`Usuários app: ${appUsers.length}`);
console.log(`Mapeados via Graph: ${matched.length}`);
console.log(`Sem match no Graph: ${unmatched.length}`);

console.log('\n--- Amostra mapeados ---');
for (const m of matched.slice(0, 10)) {
  console.log(`  ${m.name} -> ${m.graphId}`);
}
if (matched.length > 10) console.log(`  ... +${matched.length - 10}`);

if (unmatched.length) {
  console.log('\n--- Sem match ---');
  for (const u of unmatched.slice(0, 15)) console.log(`  ${u.name} (${u.email})`);
  if (unmatched.length > 15) console.log(`  ... +${unmatched.length - 15}`);
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
    key: 'sharepoint_graph_user_ids',
    value: JSON.stringify(map),
    updated_at: new Date().toISOString(),
  }),
});

if (!res.ok) {
  console.error('Erro ao salvar:', await res.text());
  process.exit(1);
}

console.log('\nSalvo em integration_settings (sharepoint_graph_user_ids)');
