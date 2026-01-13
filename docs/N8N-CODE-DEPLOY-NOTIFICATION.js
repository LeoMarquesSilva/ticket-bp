// Código para nó "Code" no n8n - Notificação de Deploy para WhatsApp
// Este código deve ser colado em um nó "Code" após o nó "Webhook" do GitHub

// Extrair dados do payload recebido do webhook
const webhookData = $input.item.json.body || $input.item.json;

// Verificar se os dados estão no formato esperado
if (!webhookData || !webhookData.data) {
  return {
    json: {
      error: 'Dados inválidos recebidos do webhook'
    }
  };
}

const { event, data, timestamp } = webhookData;

// Extrair informações do commit
const commit = data.commit || {};
const repository = data.repository || 'ticket-bp-2026';
const branch = data.branch || 'master';
const pusher = data.pusher || data.actor || 'Desconhecido';
const workflow = data.workflow || 'Deploy Notification';
const runId = data.runId || '';
const runUrl = data.url || '';

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

// Limitar tamanho da mensagem do commit (primeira linha apenas)
const getCommitMessage = (message) => {
  if (!message) return 'Sem mensagem';
  // Pegar apenas a primeira linha do commit
  const firstLine = message.split('\n')[0];
  // Limitar a 100 caracteres
  return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
};

// Montar mensagem formatada para WhatsApp
const message = `
🚀 *Nova Atualização no Sistema Responsum*

📦 *Repositório:* ${repository}
🌿 *Branch:* ${branch}
🔨 *Deploy realizado por:* ${pusher}

📝 *Commit:*
   • Hash: ${commit.hash || 'N/A'}
   • Autor: ${commit.author || 'Desconhecido'}
   • Mensagem: ${getCommitMessage(commit.message)}
   • Data: ${formatDate(commit.date || timestamp)}

⚙️ *Workflow:* ${workflow}
🔗 *Run ID:* ${runId ? `#${runId}` : 'N/A'}

✅ *Status:* Deploy realizado com sucesso

📅 *Data do deploy:* ${formatDate(timestamp || new Date().toISOString())}

🔍 *Ver detalhes:* ${runUrl || 'Não disponível'}
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
      repository: repository,
      branch: branch,
      commitHash: commit.hash,
      commitAuthor: commit.author,
      pusher: pusher,
      timestamp: timestamp
    }
  }
};
