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

const SAMUEL = {
  id: '5aa7646f-9d80-4478-bf50-ce1cfc5a5d8a',
  name: 'Samuel Willian Silva',
  department: 'Operações Legais',
};

const LEONARDO = {
  id: '7a46ad55-0945-49e0-9239-984ed82f0b34',
  name: 'Leonardo Marques Silva',
};

const title = 'Fluxo inverso — Auditoria de Excludentes / Envio de Evidência';
const description = `Olá, Leonardo.

Solicito a atualização do sistema Responsum para suportar o fluxo inverso na subcategoria Validação de Indicadores → Auditoria de Excludentes / Envio de Evidência.

Hoje o jurídico abre o ticket e o suporte atende. Precisamos inverter esse fluxo para que:
- o suporte (Operações Legais) abra o ticket e selecione o jurídico responsável;
- o jurídico atribuído realize o atendimento e finalize o ticket;
- o suporte que abriu o ticket avalie o atendimento (NPS) após a finalização.

Também precisamos da importação em lote dos tickets pendentes da planilha SLA Fatal, com atribuição correta aos jurídicos.

Obrigado!`;

const leonardoMessage = `Olá, Samuel! Tudo certo por aqui.

Implementei a melhoria solicitada no Responsum. Resumo do que foi feito:

1. Fluxo inverso (Validação de Indicadores → Auditoria de Excludentes / Envio de Evidência)
- O suporte passa a abrir o ticket pelo fluxo normal (Novo Ticket), com seletor de atendente jurídico (usuários com perfil user).
- O jurídico atribuído atende e é o único que pode finalizar nesse fluxo.
- Quem abriu o ticket (suporte) avalia o NPS após a finalização.
- A subcategoria inversa foi bloqueada no "Criar ticket para usuário" para evitar uso incorreto.

2. Visibilidade e regras
- Suporte operacional vê apenas tickets em que é solicitante ou atendente.
- Dashboard de feedback ajustado: Solicitante = quem abriu; Atendente = jurídico atribuído.

3. Importação SLA Fatal
- 24 tickets importados da planilha, com atribuição aos jurídicos (Gabriela, Lavínia e Caroline), todos abertos em seu nome.

Se quiser validar, pode testar abrindo um ticket de teste pelo Novo Ticket nessa subcategoria. Qualquer ajuste, me avise!`;

const now = new Date().toISOString();

const ticketRes = await fetch(`${url}/rest/v1/app_c009c0e4f1_tickets`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    title,
    description,
    category: 'melhorias',
    subcategory: 'responsum',
    priority: 'medium',
    status: 'open',
    created_by: SAMUEL.id,
    created_by_name: SAMUEL.name,
    created_by_department: SAMUEL.department,
    assigned_to: LEONARDO.id,
    assigned_to_name: LEONARDO.name,
    assigned_at: now,
    created_at: now,
    updated_at: now,
  }),
});

const ticketData = await ticketRes.json();
if (!ticketRes.ok) {
  console.error('Ticket error:', JSON.stringify(ticketData, null, 2));
  process.exit(1);
}

const ticket = Array.isArray(ticketData) ? ticketData[0] : ticketData;

const msgRes = await fetch(`${url}/rest/v1/app_c009c0e4f1_chat_messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    ticket_id: ticket.id,
    user_id: LEONARDO.id,
    user_name: LEONARDO.name,
    message: leonardoMessage,
    attachments: null,
    created_at: now,
    read: false,
  }),
});

const msgData = await msgRes.json();
if (!msgRes.ok) {
  console.error('Message error:', JSON.stringify(msgData, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ticketId: ticket.id,
      title: ticket.title,
      status: ticket.status,
      createdBy: ticket.created_by_name,
      assignedTo: ticket.assigned_to_name,
      messageFrom: LEONARDO.name,
    },
    null,
    2,
  ),
);
