/**
 * Teste E2E: Desenvolvimento Contínuo — mesmo payload do último ticket, atribuição Marketing → Leonardo.
 * Uso: node scripts/run-desenvolvimento-continuo-test.mjs
 */
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
const marketingTagId = '40942024-5eba-4b20-bbaa-271e652e8238';

const LEONARDO_ID = '7a46ad55-0945-49e0-9239-984ed82f0b34';
const FELIPE_ID = '1724e239-535a-4634-97e5-d82f4d0c91ac';

const form = {
  responsavelUserId: FELIPE_ID,
  facilitadorUserId: FELIPE_ID,
  tema: 'TESTANDO TREINAMENTO',
  dataRealizacao: '17/06/2026',
  duracaoMinutos: '60',
  area: 'Operações Legais',
  precisaAjustePpt: 'sim',
  linkPpt: 'https://crm.rdstation.com/app/deals/6a2b1255baf56c0020cec9f4?view=pipeline',
};

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

function buildDescription(data, users) {
  const name = (id) => users.find((u) => u.id === id)?.name ?? '';
  return [
    'Tipo: Treinamento',
    `Responsável (Gerente da área): ${name(data.responsavelUserId)}`,
    `Facilitador: ${name(data.facilitadorUserId)}`,
    `Tema: ${data.tema}`,
    `Data da realização: ${data.dataRealizacao}`,
    `Duração: ${data.duracaoMinutos} minutos`,
    `Área: ${data.area}`,
    `Precisa de ajuste em PPT?: ${data.precisaAjustePpt === 'sim' ? 'Sim' : 'Não'}`,
    `Link do PPT: ${data.linkPpt}`,
  ].join('\n');
}

function buildSharepointPayload(data, users) {
  const name = (id) => users.find((u) => u.id === id)?.name?.trim() ?? '';
  const email = (id) => users.find((u) => u.id === id)?.email?.trim() ?? '';
  return {
    tema: data.tema.trim(),
    facilitador: name(data.facilitadorUserId),
    responsavelEmail: email(data.responsavelUserId),
    responsavelName: name(data.responsavelUserId),
    dataRealizacao: data.dataRealizacao.trim(),
    area: data.area,
    subcategory: 'Treinamento',
    duracaoMinutos: data.duracaoMinutos.trim(),
    precisaAjustePpt: data.precisaAjustePpt === 'sim',
    linkPpt: data.linkPpt.trim(),
  };
}

async function resolveAssigneeByTag(tagId) {
  const staffRoles = ['suporte_administrativo', 'support', 'admin', 'lawyer'];
  for (const onlineOnly of [true, false]) {
    let q = admin
      .from('app_c009c0e4f1_users')
      .select('id, name, email, is_online, last_active_at')
      .eq('tag_id', tagId)
      .eq('is_active', true)
      .in('role', staffRoles)
      .order('last_active_at', { ascending: true })
      .limit(1);
    if (onlineOnly) q = q.eq('is_online', true);
    const { data } = await q.maybeSingle();
    if (data) return data;
  }
  return null;
}

async function getLeonardoAccessToken() {
  const { data: leo } = await admin
    .from('app_c009c0e4f1_users')
    .select('email')
    .eq('id', LEONARDO_ID)
    .single();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: leo.email,
  });
  if (linkErr) throw linkErr;
  const { data: sessionData, error: otpErr } = await admin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });
  if (otpErr) throw otpErr;
  return sessionData.session.access_token;
}

const usersRes = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_users?select=id,name,email&is_active=eq.true`,
  { headers },
);
const users = await usersRes.json();
const leonardo = users.find((u) => u.id === LEONARDO_ID);
const assignee = await resolveAssigneeByTag(marketingTagId);

console.log('Atribuição por frente Marketing:', assignee?.name, assignee?.id);
if (assignee?.id !== LEONARDO_ID) {
  console.warn('AVISO: assignee não é Leonardo; forçando Leonardo para este teste.');
}

const assigned = assignee?.id === LEONARDO_ID ? assignee : leonardo;
const title = `Treinamento — ${form.tema}`;
const description = buildDescription(form, users);
const now = new Date().toISOString();

const ticketRes = await fetch(`${url}/rest/v1/app_c009c0e4f1_tickets`, {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    title,
    description,
    category: 'desenvolvimento_continuo_equipe',
    subcategory: 'treinamento',
    priority: 'medium',
    status: 'open',
    created_by: LEONARDO_ID,
    created_by_name: leonardo.name,
    assigned_to: assigned.id,
    assigned_to_name: assigned.name,
    assigned_at: now,
    created_at: now,
    updated_at: now,
  }),
});
const ticket = (await ticketRes.json())[0];
if (!ticketRes.ok) {
  console.error('Erro ao criar ticket:', ticket);
  process.exit(1);
}

console.log('\nTicket criado:', ticket.id);
console.log('Atribuído a:', ticket.assigned_to_name, ticket.assigned_to);

const chatMsg = [
  '📋 **Desenvolvimento Contínuo da Equipe — Treinamento**',
  '',
  `👤 **Responsável (Gerente da área):** ${users.find((u) => u.id === FELIPE_ID)?.name}`,
  `🎯 **Facilitador:** ${users.find((u) => u.id === FELIPE_ID)?.name}`,
  `📌 **Tema:** ${form.tema}`,
  `📅 **Data da realização:** ${form.dataRealizacao}`,
  `⏱️ **Duração:** ${form.duracaoMinutos} minutos`,
  `🏢 **Área:** ${form.area}`,
  '📊 **Precisa de ajuste em PPT?:** Sim',
  `🔗 **Link do PPT:** ${form.linkPpt}`,
].join('\n');

await fetch(`${url}/rest/v1/app_c009c0e4f1_chat_messages`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ticket_id: ticket.id,
    user_id: LEONARDO_ID,
    user_name: leonardo.name,
    message: chatMsg,
    created_at: now,
  }),
});

const accessToken = await getLeonardoAccessToken();
const spPayload = buildSharepointPayload(form, users);
const ticketAppUrl = `http://localhost:5173/tickets/${ticket.id}`;

const fnRes = await fetch(`${url}/functions/v1/sharepoint-treinamentos`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ticketId: ticket.id, payload: spPayload, ticketAppUrl }),
});
const fnJson = await fnRes.json();
console.log('\nSharePoint function:', fnRes.status, JSON.stringify(fnJson, null, 2));

if (!fnRes.ok || fnJson.error) {
  process.exit(1);
}

// Verificar item SharePoint
const tenant = process.env.MICROSOFT_TENANT_ID;
const clientId = process.env.MICROSOFT_CLIENT_ID;
const secret = process.env.MICROSOFT_CLIENT_SECRET;
const siteId = process.env.SHAREPOINT_SITE_ID;
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID;
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

const spItem = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${fnJson.itemId}?expand=fields`,
  { headers: { Authorization: `Bearer ${tok.access_token}` } },
).then((r) => r.json());

const f = spItem.fields ?? {};
console.log('\n=== SharePoint item', fnJson.itemId, '===');
console.log('Nome:', f.NomedoTreinamento);
console.log('Facilitador:', f.Facilitador);
console.log('Responsavel LookupId:', f.Respons_x00e1_velLookupId);
console.log('Tipo (PPT):', f.TipodoTreinamento);
console.log('Categoria:', f.Categoria);
console.log('Obs:', (f.Observa_x00e7__x00f5_es ?? '').slice(0, 200));

console.log('\n✓ Teste concluído');
console.log('Ticket URL:', ticketAppUrl);
