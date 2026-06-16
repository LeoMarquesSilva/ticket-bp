/**
 * Envia ticket DC para SharePoint via Graph (mesma lógica da edge function local).
 * Uso: node scripts/sharepoint-push-dc-ticket.mjs <ticketId>
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const key = t.slice(0, i);
  const val = t.slice(i + 1);
  if (val || !(key in process.env)) process.env[key] = val;
}

const ticketId = process.argv[2];
if (!ticketId) {
  console.error('Uso: node scripts/sharepoint-push-dc-ticket.mjs <ticketId>');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID?.trim();
const siteUrl = (process.env.VITE_SITE_URL || 'https://www.responsum.com.br').replace(/\/$/, '');

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const skHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

function norm(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function emailVariants(email) {
  const t = email.trim().toLowerCase();
  const s = new Set([t]);
  if (t.endsWith('@bismarchipires.com.br')) s.add(t.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  if (t.endsWith('@bpplaw.com.br')) s.add(t.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  return [...s];
}

function brDate(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v.trim();
}

function pick(label, text) {
  const re = new RegExp(`${label}:\\s*(.+)$`, 'm');
  return re.exec(text)?.[1]?.trim() ?? '';
}

async function getGraphToken() {
  const j = await fetch(
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
  return j.access_token;
}

const { data: ticket } = await admin
  .from('app_c009c0e4f1_tickets')
  .select('id,title,description,subcategory')
  .eq('id', ticketId)
  .maybeSingle();

if (!ticket) {
  console.error('Ticket não encontrado');
  process.exit(1);
}

const desc = ticket.description ?? '';
const responsavelName = pick('Responsável \\(Gerente da área\\)', desc) || pick('Responsável', desc);
let responsavelEmail = '';

if (responsavelName) {
  const { data: users } = await admin
    .from('app_c009c0e4f1_users')
    .select('email,name')
    .ilike('name', responsavelName);
  responsavelEmail = users?.find((u) => u.name === responsavelName)?.email?.trim()
    ?? users?.[0]?.email?.trim()
    ?? '';
}

const payload = {
  tema: pick('Tema', desc) || ticket.title.replace(/^Treinamento — /, ''),
  facilitador: pick('Facilitador', desc) || responsavelName,
  responsavelEmail,
  responsavelName,
  dataRealizacao: pick('Data da realização', desc),
  area: pick('Área', desc),
  subcategory: ticket.subcategory === 'workshop' ? 'Workshop' : 'Treinamento',
  duracaoMinutos: (pick('Duração', desc).match(/\d+/) ?? ['30'])[0],
  precisaAjustePpt: /Precisa de ajuste em PPT\?:\s*Sim/i.test(desc),
  linkPpt: pick('Link do PPT', desc) || undefined,
  ticketAppUrl: `${siteUrl}/tickets/${ticketId}`,
};

const mapRaw = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_integration_settings?key=eq.sharepoint_person_lookups&select=value`,
  { headers: skHeaders },
).then((r) => r.json());
let lookups = {};
try {
  lookups = JSON.parse(mapRaw[0]?.value ?? '{}');
} catch {
  lookups = {};
}

let lookupId = null;
for (const v of emailVariants(payload.responsavelEmail)) {
  if (lookups[norm(v)]) {
    lookupId = lookups[norm(v)];
    break;
  }
}
if (!lookupId && payload.responsavelName) lookupId = lookups[norm(payload.responsavelName)] ?? null;

const token = await getGraphToken();
const gh = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const cols = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly`,
  { headers: gh },
).then((r) => r.json());

const writable = (cols.value ?? []).filter((c) => !c.readOnly && c.name !== 'id');
const byDisplay = new Map(writable.map((c) => [norm(c.displayName), c]));

const fields = { Title: payload.tema };
const set = (display, value) => {
  const col = byDisplay.get(norm(display));
  if (col && value != null && value !== '') fields[col.name] = String(value);
};

set('Nome do treinamento', payload.tema);
set('Facilitador', payload.facilitador);
set('Data', brDate(payload.dataRealizacao));
set('Status', 'Futuro');
set('Área', payload.area);
set('Categoria', 'Equipe');
set('Tipo do Treinamento', payload.precisaAjustePpt ? 'SIM' : 'NÃO');
set('Duração (Minutos)', payload.duracaoMinutos);

const obsParts = [
  `Precisa de ajuste em PPT: ${payload.precisaAjustePpt ? 'Sim' : 'Não'}`,
  payload.linkPpt ? `Link do PPT: ${payload.linkPpt}` : '',
  `Ticket: ${payload.ticketAppUrl}`,
];
if (!lookupId) {
  obsParts.push(
    `Responsável (pendente LookupId): ${payload.responsavelName} <${payload.responsavelEmail}>`,
  );
}
set('Observações', obsParts.filter(Boolean).join('\n'));

const respCol = [...byDisplay.entries()].find(([d]) =>
  ['responsavel', 'responsavel (gerente da area)', 'gerente da area'].includes(d),
)?.[1];

if (lookupId && respCol) {
  fields[`${respCol.name}LookupId`] = lookupId;
}

const createRes = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
  { method: 'POST', headers: gh, body: JSON.stringify({ fields }) },
);
const createJson = await createRes.json();

if (!createRes.ok) {
  console.error('Erro SharePoint:', createJson.error?.message ?? createRes.status);
  process.exit(1);
}

const verify = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${createJson.id}?expand=fields`,
  { headers: gh },
).then((r) => r.json());
const f = verify.fields ?? {};

console.log('Ticket:', ticketId);
console.log('SharePoint item:', createJson.id);
console.log('Responsável LookupId:', f.Respons_x00e1_velLookupId ?? '(vazio — esperado se sem mapa)');
console.log('Ticket URL nas Obs:', payload.ticketAppUrl);
console.log('Observações:', (f.Observa_x00e7__x00f5_es ?? '').slice(0, 350));
