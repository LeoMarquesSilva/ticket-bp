import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) throw new Error('Missing Supabase env vars');

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const TEST_EMAIL = 'juridico.teste.excludentes@bismarchipires.com.br';
const TEST_PASSWORD = '123456';
const TEST_NAME = 'Jurídico Teste Excludentes';
const SUPPORT_USER_ID = '7a46ad55-0945-49e0-9239-984ed82f0b34'; // Leonardo Marques Silva
const SUPPORT_NAME = 'Leonardo Marques Silva';
const SUPPORT_DEPT = 'Operações Legais';
const CATEGORY = 'validacao_de_indicadores';
const SUBCATEGORY = 'auditoria_de_excludentes_envio_de_evidencia';

async function findUserByEmail(email) {
  const res = await fetch(
    `${url}/rest/v1/app_c009c0e4f1_users?email=eq.${encodeURIComponent(email)}&select=*`,
    { headers },
  );
  const rows = await res.json();
  if (!res.ok) throw new Error(`find user failed: ${JSON.stringify(rows)}`);
  return rows[0] ?? null;
}

async function createAuthUser(email, password, metadata) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`auth create failed: ${JSON.stringify(data)}`);
  return data;
}

async function insertAppUser(payload) {
  const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`app user insert failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

async function updateAppUser(id, payload) {
  const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_users?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`app user update failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

async function createTicket(payload) {
  const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ticket insert failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

let appUser = await findUserByEmail(TEST_EMAIL);

if (!appUser) {
  const authUser = await createAuthUser(TEST_EMAIL, TEST_PASSWORD, {
    name: TEST_NAME,
    role: 'user',
    department: 'Geral',
  });

  appUser = await insertAppUser({
    auth_user_id: authUser.id,
    name: TEST_NAME,
    email: TEST_EMAIL,
    role: 'user',
    department: 'Geral',
    is_online: false,
    is_active: true,
    first_login: false,
    must_change_password: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  console.log('Usuário jurídico de teste criado.');
} else {
  await updateAppUser(appUser.id, {
    is_active: true,
    must_change_password: false,
    first_login: false,
    name: TEST_NAME,
    role: 'user',
    updated_at: new Date().toISOString(),
  });

  // Garante senha 123456 no auth
  const authId = appUser.auth_user_id;
  if (authId) {
    const res = await fetch(`${url}/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { name: TEST_NAME, role: 'user', department: 'Geral' },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`auth update failed: ${JSON.stringify(data)}`);
  }

  console.log('Usuário jurídico de teste já existia — reativado e senha resetada.');
}

const now = new Date().toISOString();
const ticket = await createTicket({
  title: 'Teste fluxo inverso — Auditoria de excludentes',
  description:
    'Ticket de teste criado automaticamente para validar o fluxo inverso. O jurídico atribuído deve ver, atender e finalizar este chamado.',
  category: CATEGORY,
  subcategory: SUBCATEGORY,
  priority: 'medium',
  status: 'open',
  created_by: SUPPORT_USER_ID,
  created_by_name: SUPPORT_NAME,
  created_by_department: SUPPORT_DEPT,
  assigned_to: appUser.id,
  assigned_to_name: appUser.name,
  assigned_at: now,
  created_at: now,
  updated_at: now,
});

console.log('\n========== DADOS DE TESTE ==========');
console.log(`E-mail: ${TEST_EMAIL}`);
console.log(`Senha: ${TEST_PASSWORD}`);
console.log(`Usuário ID: ${appUser.id}`);
console.log(`Ticket ID: ${ticket.id}`);
console.log(`Aberto por: ${SUPPORT_NAME}`);
console.log(`Atribuído a: ${appUser.name}`);
console.log('====================================\n');
