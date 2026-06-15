/**
 * Diagnóstico da lista SharePoint de treinamentos (Microsoft Graph).
 * Uso: node scripts/sharepoint-probe.mjs
 *
 * Requer no .env:
 * - MICROSOFT_TENANT_ID
 * - MICROSOFT_CLIENT_ID
 * - MICROSOFT_CLIENT_SECRET (ou MICROSOFT_SECRET_ID com o valor do secret)
 * - SHAREPOINT_SITE_ID
 * - SHAREPOINT_TREINAMENTOS_LIST_ID
 */

import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() ?? '';
const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? '';
const clientSecret = (
  process.env.MICROSOFT_CLIENT_SECRET ?? process.env.MICROSOFT_SECRET_ID ?? ''
).trim();
const siteId = process.env.SHAREPOINT_SITE_ID?.trim() ?? '';
const listId = process.env.SHAREPOINT_TREINAMENTOS_LIST_ID?.trim() ?? '';

const REQUIRED = [
  ['MICROSOFT_TENANT_ID', tenantId],
  ['MICROSOFT_CLIENT_ID', clientId],
  ['MICROSOFT_CLIENT_SECRET', clientSecret],
  ['SHAREPOINT_SITE_ID', siteId],
  ['SHAREPOINT_TREINAMENTOS_LIST_ID', listId],
];

const missing = REQUIRED.filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Variáveis ausentes no .env:', missing.join(', '));
  console.error('\nNo .env atual só há SHAREPOINT_* e MICROSOFT_SECRET_ID (valor do secret).');
  console.error('Adicione também MICROSOFT_TENANT_ID e MICROSOFT_CLIENT_ID do App Registration Azure.');
  process.exit(1);
}

const tokenRes = await fetch(
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  },
);

const tokenJson = await tokenRes.json();
if (!tokenRes.ok) {
  console.error('Erro ao autenticar:', tokenJson.error_description ?? tokenJson.error);
  process.exit(1);
}

const token = tokenJson.access_token;
const headers = { Authorization: `Bearer ${token}` };

const listRes = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}?$select=displayName,name`,
  { headers },
);
const listJson = await listRes.json();
if (!listRes.ok) {
  console.error('Erro ao acessar lista:', listJson.error?.message ?? listRes.status);
  process.exit(1);
}

console.log('Lista:', listJson.displayName ?? listJson.name);

const colsRes = await fetch(
  `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly`,
  { headers },
);
const colsJson = await colsRes.json();
if (!colsRes.ok) {
  console.error('Erro ao listar colunas:', colsJson.error?.message ?? colsRes.status);
  process.exit(1);
}

const columns = (colsJson.value ?? []).filter((c) => !c.readOnly && c.name !== 'id');

const mapped = new Set([
  'nome do treinamento',
  'facilitador',
  'data',
  'status',
  'area',
  'categoria',
  'title',
  'responsavel',
  'responsavel (gerente da area)',
  'gerente da area',
  'duracao',
  'duracao (minutos)',
  'tipo do treinamento',
  'sim',
  'nao',
  'não',
  'observacoes',
  'link do ppt',
  'precisa de ajuste em ppt?',
  'id do ticket',
  'ticket',
]);

const normalize = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

console.log('\nColunas graváveis na lista:');
for (const col of columns) {
  const known = mapped.has(normalize(col.displayName)) || col.name === 'Title';
  console.log(`- ${col.displayName} (${col.name})${known ? '' : '  ← SEM MAPEAMENTO'}`);
}

const expected = [
  'Nome do treinamento',
  'Facilitador',
  'Data',
  'Status',
  'Área',
  'Categoria',
];
const byDisplay = new Map(columns.map((c) => [normalize(c.displayName), c]));
console.log('\nCampos obrigatórios do mapeamento:');
for (const label of expected) {
  const col = byDisplay.get(normalize(label));
  console.log(col ? `✓ ${label} → ${col.name}` : `✗ ${label} — NÃO ENCONTRADO NA LISTA`);
}

console.log('\nCampos do formulário do ticket ainda sem mapeamento fixo (preenche se existir na lista):');
console.log('- Responsável (Gerente da área)');
console.log('- Duração (Minutos)');
console.log('- Tipo / Subcategoria (Treinamento ou Workshop)');
console.log('- Precisa de ajuste em PPT?');
console.log('- Link do PPT');
