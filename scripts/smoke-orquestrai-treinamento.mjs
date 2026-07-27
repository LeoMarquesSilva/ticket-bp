import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnv(resolve(process.cwd(), '.env'));
const admin = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin
  .from('app_c009c0e4f1_integration_settings')
  .select('value')
  .eq('key', 'orquestrai_config')
  .maybeSingle();

if (error || !data?.value) {
  console.error('orquestrai_config ausente:', error?.message);
  process.exit(1);
}

const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
console.log('config ok', Boolean(parsed.supabaseUrl), Boolean(parsed.serviceRoleKey), parsed.defaultDesignerName);

const oq = createClient(parsed.supabaseUrl, parsed.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ticketId = '00000000-0000-4000-8000-smokeorquestrai01';
const { data: existing } = await oq
  .from('marketing_requests')
  .select('id')
  .ilike('description', `%Ticket ID: ${ticketId}%`)
  .limit(1)
  .maybeSingle();

if (existing) {
  console.log('already exists', existing.id);
  process.exit(0);
}

const { data: designer } = await oq
  .from('users')
  .select('id, name')
  .ilike('name', parsed.defaultDesignerName)
  .maybeSingle();

const { data: created, error: insertError } = await oq
  .from('marketing_requests')
  .insert({
    title: '[DC] Smoke — teste integração Responsum',
    description: `Origem: Responsum — Desenvolvimento Contínuo\nTicket ID: ${ticketId}\nTema: Smoke test`,
    requesting_area: 'Marketing',
    request_type: 'PPT',
    status: 'pending',
    workflow_stage: 'tarefas',
    priority: 'normal',
    assignee: designer?.name ?? parsed.defaultDesignerName,
    assignee_id: designer?.id ?? null,
    created_by: 'Responsum',
  })
  .select('id, title, workflow_stage, assignee')
  .single();

if (insertError) {
  console.error('insert failed:', insertError.message);
  process.exit(1);
}

console.log('created', created);
