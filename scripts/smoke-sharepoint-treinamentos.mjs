/** Smoke test: sharepoint-treinamentos + Graph direto */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 1) Graph direto
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

const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
const colsRes = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly`,
  { headers: { Authorization: `Bearer ${tok.access_token}` } },
);
const colsJson = await colsRes.json();
const cols = colsJson.value ?? [];
console.log(`Graph OK — ${cols.length} colunas na lista TREINAMENTOS MINISTRADOS`);

// 2) Edge function OPTIONS
const optRes = await fetch(`${url}/functions/v1/sharepoint-treinamentos`, {
  method: 'OPTIONS',
  headers: { Origin: 'https://www.responsum.com.br' },
});
console.log(`Edge OPTIONS: ${optRes.status}${optRes.status === 200 ? ' OK' : ' FALHOU'}`);
if (optRes.status !== 200) {
  console.error('Edge function parece quebrada — redeploy necessário.');
  process.exit(1);
}

// 3) listColumns autenticado
const LEONARDO_ID = '7a46ad55-0945-49e0-9239-984ed82f0b34';
const { data: user } = await admin
  .from('app_c009c0e4f1_users')
  .select('email')
  .eq('id', LEONARDO_ID)
  .single();

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email,
});
if (linkErr) throw linkErr;

const { data: sessionData, error: otpErr } = await admin.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'email',
});
if (otpErr) throw otpErr;

const res = await fetch(`${url}/functions/v1/sharepoint-treinamentos`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${sessionData.session.access_token}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'listColumns' }),
});

const fnJson = await res.json();
if (!res.ok || fnJson.error) {
  console.error('Edge listColumns FALHOU', res.status, fnJson);
  process.exit(1);
}

const fnCols = fnJson.columns ?? [];
console.log('Edge listColumns OK');
console.log(`Colunas writable: ${fnCols.filter((c) => !c.readOnly).length}/${fnCols.length}`);
console.log(
  'Amostra:',
  fnCols
    .filter((c) => !c.readOnly)
    .slice(0, 6)
    .map((c) => c.displayName)
    .join(', '),
);
