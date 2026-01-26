// Código para nó "Code" no n8n - Formatar mensagem para Evolution API (WhatsApp)
// Este código deve ser colocado em um nó "Code" após o nó "Webhook"
// Evento: unfulfilled_request - Quando um feedback indica que a solicitação não foi atendida

// Extrair dados do payload recebido do webhook
const webhookData = $input.item.json.body;

// Verificar se os dados estão no formato esperado
if (!webhookData || !webhookData.data) {
  return {
    json: {
      error: 'Dados inválidos recebidos do webhook'
    }
  };
}

const { event, data, timestamp } = webhookData;

// Verificar se é o evento correto
if (event !== 'unfulfilled_request') {
  return {
    json: {
      error: 'Evento não corresponde a unfulfilled_request',
      receivedEvent: event
    }
  };
}

// Extrair informações relevantes
const ticket = data.ticket || {};
const feedback = data.feedback || {};
const user = data.user || {};
const assignedTo = data.assignedTo || 'Não atribuído';

// Formatar data para português (ajustar para UTC-3, horário de Brasília)
const formatDate = (dateString) => {
  if (!dateString) return 'Não informado';
  const date = new Date(dateString);
  // Subtrair 3 horas (UTC-3, horário de Brasília)
  date.setHours(date.getHours() - 3);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Determinar emoji baseado na nota
const getScoreEmoji = (score) => {
  if (score <= 2) return '🔴';
  if (score <= 4) return '🟠';
  if (score <= 6) return '🟡';
  return '🟢';
};

// Formatar categoria
const formatCategory = (category, subcategory) => {
  const categories = {
    'protocolo': 'Protocolo',
    'cadastro': 'Cadastro',
    'agendamento': 'Agendamento',
    'publicacoes': 'Publicações',
    'assinatura_digital': 'Assinatura Digital',
    'outros': 'Outros'
  };
  const catLabel = categories[category] || category;
  const subcatLabel = subcategory || '';
  return subcatLabel ? `${catLabel} / ${subcatLabel}` : catLabel;
};

// Montar mensagem formatada para WhatsApp
const message = `
❌ *ALERTA: Solicitação NÃO Foi Atendida*

📋 *Ticket:* ${ticket.title || 'Sem título'}
🆔 *ID:* ${ticket.id?.slice(-8) || 'N/A'}
📁 *Categoria:* ${formatCategory(ticket.category, ticket.subcategory)}

👤 *Cliente:*
   • Nome: ${user.name || 'Não informado'}
   • Email: ${user.email || 'Não informado'}

👨‍💼 *Atendente:* ${assignedTo}

${getScoreEmoji(feedback.serviceScore)} *Nota do Atendimento:* ${feedback.serviceScore}/10

❌ *Motivo da Não Atendimento:*
${feedback.notFulfilledReason || 'Não informado'}

💬 *Comentário Adicional:*
${feedback.comment || 'Nenhum comentário adicional'}

📅 *Criado em:* ${formatDate(ticket.createdAt)}
📅 *Resolvido em:* ${formatDate(ticket.resolvedAt)}
📅 *Avaliado em:* ${formatDate(feedback.submittedAt)}

🚨 *AÇÃO URGENTE NECESSÁRIA:*
   • Entre em contato imediato com o cliente
   • Verifique o motivo da não atendimento
   • Tome medidas corretivas para resolver a situação
   • Reabra o ticket se necessário
`.trim();

// Retornar objeto formatado para Evolution API
return {
  json: {
    // Dados para Evolution API
    number: '5511999999999', // ⚠️ ALTERE: Número do WhatsApp (com código do país, sem +)
    textMessage: {
      text: message
    },
    
    // Dados adicionais para referência (opcional)
    metadata: {
      event: event,
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      userId: user.email,
      userName: user.name,
      serviceScore: feedback.serviceScore,
      requestFulfilled: false,
      notFulfilledReason: feedback.notFulfilledReason,
      timestamp: timestamp
    }
  }
};
