/**
 * Exporta mapa e-mail → SharePoint LookupId.
 *
 * Uso:
 *   node scripts/export-sharepoint-lookup-ids.mjs usuarios
 *       Lista USUARIOS do site BISMARCHIPIRES (extração direta — melhor fonte).
 *
 *   node scripts/export-sharepoint-lookup-ids.mjs controladoria
 *       Mapa do site CONTROLADORIAJURDICA (treinamentos). Usa Supabase + mineração.
 *
 *   node scripts/export-sharepoint-lookup-ids.mjs controladoria --rebuild
 *       Reconstrói mapa CJ antes de exportar (protocolos + scan de e-mails).
 *
 *   node scripts/export-sharepoint-lookup-ids.mjs usuarios --save
 *       Salva em integration_settings (chave sharepoint_person_lookups_bp).
 *
 *   node scripts/export-sharepoint-lookup-ids.mjs controladoria --save
 *       Salva em integration_settings (chave sharepoint_person_lookups).
 *
 * Opções:
 *   --out arquivo.csv     Caminho do CSV (default: exports/lookups-<modo>-<data>.csv)
 *   --json arquivo.json   Caminho do JSON
 *   --dry-run             Não grava Supabase
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const argv = process.argv.slice(2);
const mode = argv.find((a) => !a.startsWith('--')) ?? 'help';
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const getArg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const dryRun = flags.has('--dry-run');
const rebuild = flags.has('--rebuild');
const save = flags.has('--save');

const BP_SITE =
  process.env.SHAREPOINT_BP_SITE_ID ??
  'bpplaw2.sharepoint.com,6b17bdcc-ac8f-4ceb-b85c-0003edaac18e,22808632-e691-4d75-a258-ad29be94ee25';
const CJ_SITE = process.env.SHAREPOINT_SITE_ID;
const USUARIOS_LIST =
  process.env.SHAREPOINT_USUARIOS_LIST_ID ?? 'f7d4fe37-a3fe-4487-b70e-6949311bfa23';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();

function norm(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function emailVariants(email) {
  const t = norm(email);
  if (!t) return [];
  const s = new Set([t]);
  if (t.endsWith('@bismarchipires.com.br')) s.add(t.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  if (t.endsWith('@bpplaw.com.br')) s.add(t.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  return [...s];
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function defaultOut(ext, label) {
  return path.join('exports', `lookups-${label}-${stamp()}.${ext}`);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = Object.keys(rows[0] ?? {});
  const lines = [header.join(',')];
  for (const row of rows) lines.push(header.map((k) => csvEscape(row[k])).join(','));
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

async function getToken() {
  const res = await fetch(
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
  );
  const json = await res.json();
  if (!json.access_token) throw new Error(json.error_description ?? 'Token Graph falhou');
  return json.access_token;
}

async function fetchAllListItems(siteId, listId, fieldsQuery = 'fields') {
  const token = await getToken();
  const h = { Authorization: `Bearer ${token}` };
  const items = [];
  let next = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=${fieldsQuery}&$top=200`;
  while (next) {
    const page = await fetch(next, { headers: h }).then((r) => r.json());
    if (page.error) throw new Error(page.error.message);
    items.push(...(page.value ?? []));
    next = page['@odata.nextLink'] ?? null;
  }
  return items;
}

/** Extração direta: lista USUARIOS (site BISMARCHIPIRES). */
async function extractUsuariosList() {
  const items = await fetchAllListItems(BP_SITE, USUARIOS_LIST);
  const rows = [];
  const map = {};

  for (const item of items) {
    const f = item.fields ?? {};
    const email = String(f.field_1 ?? '').trim();
    const lookupId = String(f.PESSOALookupId ?? '').trim();
    const name = String(f.Title ?? '').trim();
    const area = String(f.field_2 ?? '').trim();
    if (!email || !lookupId) continue;

    rows.push({
      site: 'BISMARCHIPIRES',
      name,
      email,
      lookupId,
      area,
      source: 'USUARIOS.PESSOA',
    });

    for (const v of emailVariants(email)) map[v] = lookupId;
    if (name) map[norm(name)] = lookupId;
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows, map, siteLabel: 'BISMARCHIPIRES' };
}

async function loadIntegrationMap(key) {
  if (!SUPABASE_URL || !SERVICE_KEY) return {};
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.${key}&select=value`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  const data = await res.json();
  try {
    return JSON.parse(data[0]?.value ?? '{}');
  } catch {
    return {};
  }
}

async function saveIntegrationMap(key, map) {
  if (dryRun || !save) return false;
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('VITE_SUPABASE_URL / SERVICE_ROLE_KEY ausentes');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_c009c0e4f1_integration_settings`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      key,
      value: JSON.stringify(map),
      updated_at: new Date().toISOString(),
    }),
  });
  return res.ok;
}

async function loadAppUsers() {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  return fetch(
    `${SUPABASE_URL}/rest/v1/app_c009c0e4f1_users?select=name,email&is_active=eq.true`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).then((r) => r.json());
}

function mapToRows(map, siteLabel, source) {
  const seen = new Set();
  const rows = [];
  for (const [key, lookupId] of Object.entries(map)) {
    if (!key.includes('@')) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      site: siteLabel,
      name: '',
      email: key,
      lookupId: String(lookupId),
      area: '',
      source,
    });
  }
  return rows.sort((a, b) => a.email.localeCompare(b.email));
}

function runRebuildScripts() {
  const root = process.cwd();
  const scripts = [
    'scripts/build-sharepoint-lookup-from-emails-in-site.mjs',
    'scripts/build-sharepoint-lookup-from-protocolos.mjs',
  ];
  for (const script of scripts) {
    console.log(`\n>> Rebuild: node ${script}`);
    const r = spawnSync(process.execPath, [path.join(root, script)], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    if (r.status !== 0) console.warn(`   (aviso: ${script} exit ${r.status})`);
  }
}

function printHelp() {
  console.log(`
Exportar LookupIds SharePoint
=============================

  node scripts/export-sharepoint-lookup-ids.mjs usuarios
      Extração DIRETA da lista USUARIOS (site BISMARCHIPIRES).
      Colunas: Email (field_1) + PESSOA (PESSOALookupId).
      Gera CSV + JSON em exports/

  node scripts/export-sharepoint-lookup-ids.mjs controladoria [--rebuild] [--save]
      Mapa do site CONTROLADORIAJURDICA (lista TREINAMENTOS).
      --rebuild  roda mineração (protocolos + e-mails no site) antes
      --save     grava em integration_settings (sharepoint_person_lookups)

  node scripts/export-sharepoint-lookup-ids.mjs compare
      Compara USUARIOS (BP) vs mapa Controladoria lado a lado.

IMPORTANTE: LookupId é por site. IDs do BISMARCHIPIRES ≠ CONTROLADORIAJURDICA.
Para treinamentos use sempre: controladoria

Para completar lacunas no site Controladoria (ensureUser):
  Configure SHAREPOINT_ENSURE_USER_WEBHOOK_URL no Supabase (workflow n8n OAuth delegado).
`);
}

async function exportCompare() {
  const bp = await extractUsuariosList();
  const cjMap = await loadIntegrationMap('sharepoint_person_lookups');
  const appUsers = await loadAppUsers();

  const rows = [];
  for (const u of appUsers) {
    if (!u.email || /@(example|gmail|uticomput)/i.test(u.email)) continue;
    let bpId = null;
    let cjId = null;
    for (const v of emailVariants(u.email)) {
      if (!bpId && bp.map[v]) bpId = bp.map[v];
      if (!cjId && cjMap[v]) cjId = cjMap[v];
      if (!cjId && cjMap[norm(v)]) cjId = cjMap[norm(v)];
    }
    rows.push({
      name: u.name,
      email: u.email,
      lookupId_BISMARCHIPIRES: bpId ?? '',
      lookupId_CONTROLADORIA: cjId ?? '',
      same: bpId && cjId ? (bpId === cjId ? 'sim' : 'nao') : '',
    });
  }

  const outCsv = getArg('--out') ?? defaultOut('csv', 'compare');
  writeCsv(outCsv, rows);
  console.log(`Comparação: ${rows.length} usuários app`);
  console.log(`  Com BP: ${rows.filter((r) => r.lookupId_BISMARCHIPIRES).length}`);
  console.log(`  Com CJ: ${rows.filter((r) => r.lookupId_CONTROLADORIA).length}`);
  console.log(`  CSV: ${outCsv}`);
}

async function main() {
  if (mode === 'help' || flags.has('--help')) {
    printHelp();
    return;
  }

  if (mode === 'compare') {
    await exportCompare();
    return;
  }

  if (mode === 'usuarios') {
    console.log('Extraindo lista USUARIOS (BISMARCHIPIRES)...');
    const { rows, map, siteLabel } = await extractUsuariosList();
    const outCsv = getArg('--out') ?? defaultOut('csv', 'usuarios-bp');
    const outJson = getArg('--json') ?? defaultOut('json', 'usuarios-bp');
    writeCsv(outCsv, rows);
    writeJson(outJson, { site: siteLabel, listId: USUARIOS_LIST, exportedAt: new Date().toISOString(), rows, map });
    console.log(`\n${rows.length} usuários exportados`);
    console.log(`CSV:  ${outCsv}`);
    console.log(`JSON: ${outJson}`);
    if (save) {
      const ok = await saveIntegrationMap('sharepoint_person_lookups_bp', map);
      console.log(ok ? 'Salvo: integration_settings.sharepoint_person_lookups_bp' : 'Falha ao salvar Supabase');
    } else {
      console.log('\n(dica: use --save para gravar em sharepoint_person_lookups_bp no Supabase)');
    }
    console.log('\n⚠ LookupIds deste export são do site BISMARCHIPIRES.');
    console.log('  Para TREINAMENTOS MINISTRADOS use: node scripts/export-sharepoint-lookup-ids.mjs controladoria');
    return;
  }

  if (mode === 'controladoria') {
    if (rebuild) runRebuildScripts();

    console.log('\nCarregando mapa CONTROLADORIAJURDICA...');
    const map = await loadIntegrationMap('sharepoint_person_lookups');
    const rows = mapToRows(map, 'CONTROLADORIAJURDICA', 'integration_settings+mineração');
    const appUsers = await loadAppUsers();

    const enriched = appUsers
      .filter((u) => u.email && !/@(example|gmail|uticomput)/i.test(u.email))
      .map((u) => {
        let lookupId = null;
        for (const v of emailVariants(u.email)) {
          if (map[v]) { lookupId = map[v]; break; }
        }
        if (!lookupId) lookupId = map[norm(u.name)] ?? null;
        return {
          site: 'CONTROLADORIAJURDICA',
          name: u.name,
          email: u.email,
          lookupId: lookupId ?? '',
          area: '',
          source: lookupId ? 'mapeado' : 'PENDENTE',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const outCsv = getArg('--out') ?? defaultOut('csv', 'controladoria-app');
    const outJson = getArg('--json') ?? defaultOut('json', 'controladoria');
    writeCsv(outCsv, enriched);
    writeJson(outJson, {
      site: CJ_SITE,
      treinamentosListId: process.env.SHAREPOINT_TREINAMENTOS_LIST_ID,
      exportedAt: new Date().toISOString(),
      totalKeys: Object.keys(map).length,
      appUsersMapped: enriched.filter((r) => r.lookupId).length,
      appUsersPending: enriched.filter((r) => !r.lookupId).length,
      map,
      appUsers: enriched,
    });

    console.log(`\nChaves no mapa: ${Object.keys(map).length}`);
    console.log(`App usuários mapeados: ${enriched.filter((r) => r.lookupId).length}/${enriched.length}`);
    console.log(`Pendentes:`);
    for (const r of enriched.filter((x) => !x.lookupId).slice(0, 15)) {
      console.log(`  - ${r.name} (${r.email})`);
    }
    const pending = enriched.filter((x) => !x.lookupId).length;
    if (pending > 15) console.log(`  ... +${pending - 15}`);
    console.log(`\nCSV (por usuário app): ${outCsv}`);
    console.log(`JSON (mapa completo):  ${outJson}`);

    if (save && rebuild) {
      console.log('\n(rebuild já atualizou sharepoint_person_lookups via scripts filhos)');
    }
    return;
  }

  printHelp();
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
