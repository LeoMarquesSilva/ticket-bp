/**
 * Reenvia ticket de Desenvolvimento Contínuo para SharePoint via Graph API.
 * Uso: node scripts/sharepoint-backfill-ticket.mjs [ticketId]
 */
import fs from 'node:fs';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const ticketId = process.argv[2] ?? 'f72883a3-26ab-4d3e-9d1c-d6c9a9b1a77d';
const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();

const tenant = process.env.MICROSOFT_TENANT_ID?.trim();
const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
const secret =
  process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? process.env.MICROSOFT_SECRET_ID?.trim();
const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID?.trim();

const ticketRes = await fetch(
  `${url}/rest/v1/app_c009c0e4f1_tickets?id=eq.${ticketId}&select=id,title,description,subcategory,created_by`,
  {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  },
);
const tickets = await ticketRes.json();
const ticket = tickets[0];
if (!ticket) {
  console.error('Ticket não encontrado:', ticketId);
  process.exit(1);
}

function pick(label, text) {
  const re = new RegExp(`${label}:\\s*(.+)$`, 'm');
  return re.exec(text)?.[1]?.trim() ?? '';
}

const desc = ticket.description ?? '';
const responsavelName = pick('Responsável \\(Gerente da área\\)', desc);
let responsavelEmail = responsavelName;

if (responsavelName) {
  const userRes = await fetch(
    `${url}/rest/v1/app_c009c0e4f1_users?select=email,name&name=eq.${encodeURIComponent(responsavelName)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const users = await userRes.json();
  if (users[0]?.email) responsavelEmail = users[0].email.trim();
}

const appBase = (process.env.VITE_SITE_URL || 'https://www.responsum.com.br').replace(/\/$/, '');
const payload = {
  tema: pick('Tema', desc) || ticket.title.replace(/^Treinamento — /, ''),
  facilitador: pick('Facilitador', desc),
  responsavelEmail,
  responsavelName,
  dataRealizacao: pick('Data da realização', desc),
  area: pick('Área', desc),
  subcategory: ticket.subcategory === 'workshop' ? 'Workshop' : 'Treinamento',
  duracaoMinutos: (pick('Duração', desc).match(/\d+/) ?? ['60'])[0],
  precisaAjustePpt: /Precisa de ajuste em PPT\?:\s*Sim/i.test(desc),
  linkPpt: pick('Link do PPT', desc) || undefined,
  ticketId,
  ticketAppUrl: `${appBase}/tickets/${ticketId}`,
};

console.log('Payload:', payload);

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

const headers = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

const cols = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly`,
  { headers },
).then((r) => r.json());

const writable = (cols.value ?? []).filter((c) => !c.readOnly && c.name !== 'id');
const byDisplay = new Map(
  writable.map((c) => [
    c.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(),
    c,
  ]),
);

const brToIso = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
};

const map = {
  'nome do treinamento': payload.tema,
  facilitador: payload.facilitador,
  data: brToIso(payload.dataRealizacao),
  status: 'Futuro',
  area: payload.area,
  categoria: 'Equipe',
  responsavel: payload.responsavelEmail,
  'duracao (minutos)': payload.duracaoMinutos,
  'tipo do treinamento': payload.precisaAjustePpt ? 'SIM' : 'NÃO',
  observacoes: [
    `Precisa de ajuste em PPT: ${payload.precisaAjustePpt ? 'Sim' : 'Não'}`,
    payload.linkPpt ? `Link do PPT: ${payload.linkPpt}` : '',
    `Ticket: ${payload.ticketAppUrl}`,
  ]
    .filter(Boolean)
    .join('\n'),
};

const fields = { Title: payload.tema };
for (const [display, value] of Object.entries(map)) {
  const col = byDisplay.get(display);
  if (col && value) fields[col.name] = value;
}

const createRes = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
  { method: 'POST', headers, body: JSON.stringify({ fields }) },
);
const createJson = await createRes.json();
if (!createRes.ok) {
  console.error('Erro SharePoint:', createJson.error?.message ?? createRes.status);
  process.exit(1);
}

console.log('Item criado no SharePoint, id:', createJson.id);
console.log('Campos:', JSON.stringify(fields, null, 2));
