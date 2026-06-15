/**
 * Grava credenciais SharePoint em app_c009c0e4f1_integration_settings
 * (fallback quando secrets da Edge Function não estão no Supabase).
 * Uso: node scripts/seed-sharepoint-settings.mjs
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
const serviceKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim() ??
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const config = {
  tenantId: process.env.MICROSOFT_TENANT_ID?.trim() ?? '',
  clientId: process.env.MICROSOFT_CLIENT_ID?.trim() ?? '',
  clientSecret:
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ??
    process.env.MICROSOFT_SECRET_ID?.trim() ??
    '',
  siteId: process.env.SHAREPOINT_SITE_ID?.trim() ?? '',
  listId: process.env.SHAREPOINT_TREINAMENTOS_LIST_ID?.trim() ?? '',
};

const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
if (!url || !serviceKey) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}
if (missing.length) {
  console.error('Variáveis SharePoint ausentes no .env:', missing.join(', '));
  process.exit(1);
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
    key: 'sharepoint_graph_config',
    value: JSON.stringify(config),
    updated_at: new Date().toISOString(),
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error('Erro ao salvar config:', res.status, text);
  process.exit(1);
}

console.log('Config SharePoint salva em integration_settings (key: sharepoint_graph_config)');
