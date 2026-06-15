/**
 * Configura secrets da Edge Function sharepoint-treinamentos no Supabase.
 * Uso: node scripts/set-supabase-sharepoint-secrets.mjs
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
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID?.trim(),
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID?.trim(),
  MICROSOFT_CLIENT_SECRET:
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? process.env.MICROSOFT_SECRET_ID?.trim(),
  SHAREPOINT_SITE_ID: process.env.SHAREPOINT_SITE_ID?.trim(),
  SHAREPOINT_TREINAMENTOS_LIST_ID: process.env.SHAREPOINT_TREINAMENTOS_LIST_ID?.trim(),
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
});
console.log('Secrets configurados com sucesso.');
