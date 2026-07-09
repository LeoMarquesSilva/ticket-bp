/**
 * Corrige conflitos detectados na auditoria:
 * - Gabriela Consul: 12 (Samuel) -> 92
 * - controladoria@bpplaw.com.br: 15 (Felipe) -> 12 (Samuel)
 *
 * Uso: node scripts/fix-lookup-conflicts.mjs [--dry-run]
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
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

const GABRIELA_KEYS = [
  'gabriela.consul@bismarchipires.com.br',
  'gabriela.consul@bpplaw.com.br',
  'gabriela nicolau olmedo consul',
  'gabriela consul',
];
const SAMUEL_KEYS = [
  'controladoria@bpplaw.com.br',
  'controladoria@bismarchipires.com.br',
  'samuel willian silva',
];

const settingsRes = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups&select=key,value`,
  { headers },
);
const row = (await settingsRes.json())?.[0];
if (!row?.value) throw new Error('sharepoint_person_lookups não encontrado');

const map = JSON.parse(row.value);
let changed = 0;

for (const k of GABRIELA_KEYS) {
  if (map[k] !== '92') {
    console.log(`Gabriela: ${k} ${map[k] ?? '(vazio)'} -> 92`);
    map[k] = '92';
    changed++;
  }
}
for (const k of SAMUEL_KEYS) {
  if (map[k] !== '12') {
    console.log(`Samuel/controladoria: ${k} ${map[k] ?? '(vazio)'} -> 12`);
    map[k] = '12';
    changed++;
  }
}

if (changed === 0) {
  console.log('Nenhuma alteração necessária.');
  process.exit(0);
}

if (dryRun) {
  console.log(`\n[dry-run] ${changed} chave(s) seriam atualizadas.`);
  process.exit(0);
}

const up = await fetch(`${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ value: JSON.stringify(map), updated_at: new Date().toISOString() }),
});
if (!up.ok) throw new Error(`PATCH falhou: ${up.status} ${await up.text()}`);
console.log(`\nSupabase atualizado: ${changed} chave(s).`);
