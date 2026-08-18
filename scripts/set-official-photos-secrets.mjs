/**
 * Configura secrets da Edge Function official-photos no Supabase.
 * Uso: node scripts/set-official-photos-secrets.mjs
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const PROJECT_REF = 'jhgbrbarfpvgdaaznldj';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const secrets = {
  OFFICIAL_PHOTOS_API_KEY: process.env.OFFICIAL_PHOTOS_API_KEY?.trim(),
  ORQESTRAI_PHOTOS_URL:
    process.env.ORQESTRAI_PHOTOS_URL?.trim() ||
    'https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api',
};

const missing = Object.entries(secrets).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Variáveis ausentes no .env:', missing.join(', '));
  process.exit(1);
}

const args = Object.entries(secrets)
  .map(([k, v]) => `${k}=${v}`)
  .join(' ');

console.log('Configurando secrets no Supabase (project:', PROJECT_REF, ')...');
execSync(`npx supabase secrets set ${args} --project-ref ${PROJECT_REF}`, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
console.log('Secrets configurados com sucesso.');
