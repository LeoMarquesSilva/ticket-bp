/**
 * Salva a conexão ORQESTRAI em app_c009c0e4f1_integration_settings (key: orquestrai_config).
 *
 * Uso:
 *   node scripts/seed-orquestrai-settings.mjs
 *
 * Lê, nesta ordem:
 * 1) ORQESTRAI_SUPABASE_URL + ORQESTRAI_SERVICE_ROLE_KEY do .env do ticket-bp
 * 2) NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY do .env do marketing-system
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const ticketEnv = loadEnvFile(resolve(process.cwd(), '.env'));
const marketingEnv = loadEnvFile(resolve(process.cwd(), '../marketing-system/.env'));

const responsumUrl = ticketEnv.VITE_SUPABASE_URL?.trim();
const responsumServiceKey = ticketEnv.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();

const orquestraiUrl = (
  ticketEnv.ORQESTRAI_SUPABASE_URL ||
  marketingEnv.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim();
const orquestraiServiceKey = (
  ticketEnv.ORQESTRAI_SERVICE_ROLE_KEY ||
  marketingEnv.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();
const defaultDesignerName = (
  ticketEnv.ORQESTRAI_DEFAULT_DESIGNER ||
  'Valentina Iacovacci'
).trim();

if (!responsumUrl || !responsumServiceKey) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY no .env do Responsum');
  process.exit(1);
}
if (!orquestraiUrl || !orquestraiServiceKey) {
  console.error(
    'Defina ORQESTRAI_SUPABASE_URL + ORQESTRAI_SERVICE_ROLE_KEY no .env do Responsum, ou garanta o .env do marketing-system',
  );
  process.exit(1);
}

const admin = createClient(responsumUrl, responsumServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const value = {
  supabaseUrl: orquestraiUrl.replace(/\/$/, ''),
  serviceRoleKey: orquestraiServiceKey,
  defaultDesignerName,
};

const { error } = await admin.from('app_c009c0e4f1_integration_settings').upsert(
  {
    key: 'orquestrai_config',
    value: JSON.stringify(value),
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'key' },
);

if (error) {
  console.error('Falha ao salvar orquestrai_config:', error.message);
  process.exit(1);
}

console.log('orquestrai_config salvo com sucesso.');
console.log('URL:', value.supabaseUrl);
console.log('Designer padrão:', value.defaultDesignerName);
