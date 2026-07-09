import fs from 'node:fs';
import XLSX from 'xlsx';

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

const CATEGORY = 'validacao_de_indicadores';
const SUBCATEGORY = 'auditoria_de_excludentes_envio_de_evidencia';

/** Quem abre o ticket (suporte atendido no fluxo inverso). */
const OPENED_BY = {
  id: '5aa7646f-9d80-4478-bf50-ce1cfc5a5d8a',
  name: 'Samuel Willian Silva',
  department: 'Operações Legais',
};

const EMAIL_ALIASES = {
  'gabriela.consul@bpplaw.com.br': 'gabriela.consul@bismarchipires.com.br',
  'carolineabdalla@bpplaw.com.b': 'carolineabdalla@bismarchipires.com.br',
};

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return EMAIL_ALIASES[email] ?? email;
}

async function fetchUsersByEmails(emails) {
  const unique = [...new Set(emails)];
  const res = await fetch(
    `${url}/rest/v1/app_c009c0e4f1_users?email=in.(${unique.map((e) => `"${e}"`).join(',')})&select=id,name,email,role,is_active`,
    { headers },
  );
  const rows = await res.json();
  if (!res.ok) throw new Error(`users fetch failed: ${JSON.stringify(rows)}`);
  const map = new Map();
  for (const row of rows) map.set(row.email.toLowerCase(), row);
  return map;
}

async function createTicket(payload) {
  const res = await fetch(`${url}/rest/v1/app_c009c0e4f1_tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return Array.isArray(data) ? data[0] : data;
}

const workbook = XLSX.readFile('tickets_sla_fatal.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const juridicoEmails = rows.map((row) => normalizeEmail(row['JURIDICO ATRIBUIDO']));
const userMap = await fetchUsersByEmails(juridicoEmails);

const created = [];
const failed = [];

for (const [index, row] of rows.entries()) {
  const title = String(row['TITULO DO TICKET'] ?? '').trim();
  const description = String(row['DESCRIÇÃO'] ?? '').trim();
  const juridicoEmail = normalizeEmail(row['JURIDICO ATRIBUIDO']);
  const juridico = userMap.get(juridicoEmail);

  if (!title || !description) {
    failed.push({ line: index + 2, title, reason: 'Título ou descrição vazios' });
    continue;
  }

  if (!juridico) {
    failed.push({ line: index + 2, title, reason: `Jurídico não encontrado: ${juridicoEmail}` });
    continue;
  }

  if (juridico.is_active === false || juridico.role !== 'user') {
    failed.push({
      line: index + 2,
      title,
      reason: `Usuário inválido para atendimento: ${juridico.email} (role=${juridico.role})`,
    });
    continue;
  }

  try {
    const now = new Date().toISOString();
    const ticket = await createTicket({
      title,
      description,
      category: CATEGORY,
      subcategory: SUBCATEGORY,
      priority: 'high',
      status: 'open',
      created_by: OPENED_BY.id,
      created_by_name: OPENED_BY.name,
      created_by_department: OPENED_BY.department,
      assigned_to: juridico.id,
      assigned_to_name: juridico.name,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    });

    created.push({
      line: index + 2,
      id: ticket.id,
      title,
      assignedTo: juridico.name,
      assignedEmail: juridico.email,
    });
  } catch (error) {
    failed.push({ line: index + 2, title, reason: String(error) });
  }
}

console.log(`\nImportação concluída: ${created.length} criados, ${failed.length} falhas (total ${rows.length}).\n`);

if (created.length > 0) {
  console.log('--- CRIADOS ---');
  for (const item of created) {
    console.log(`#${item.line} | ${item.id.slice(0, 8)} | ${item.assignedTo} | ${item.title.slice(0, 70)}...`);
  }
}

if (failed.length > 0) {
  console.log('\n--- FALHAS ---');
  for (const item of failed) {
    console.log(`#${item.line} | ${item.title?.slice(0, 50)} | ${item.reason}`);
  }
}
