// Código para nó "Code" no n8n - Notificação de Deploy para WhatsApp
// Este código deve ser colado em um nó "Code" após o nó "Webhook" do GitHub

// Extrair dados do payload recebido do webhook
// n8n recebe os dados diretamente no body do JSON
const webhookData = $input.item.json.body || $input.item.json;

// Verificar se os dados estão no formato esperado
if (!webhookData || (!webhookData.commit && !webhookData.data)) {
  return {
    json: {
      error: 'Dados inválidos recebidos do webhook',
      received: webhookData
    }
  };
}

// Se os dados estão dentro de um objeto 'data', extrair
const data = webhookData.data || webhookData;
const { event, repository, branch, actor, commit, workflow, runId, url, timestamp } = data;

// Extrair informações do commit
const commitInfo = commit || data.commit || {};
const repositoryName = repository || data.repository || 'ticket-bp-2026';
const branchName = branch || data.branch || 'master';
const pusher = actor || data.actor || data.pusher || 'Desconhecido';
const workflowName = workflow || data.workflow || 'Deploy Notification';
const runIdValue = runId || data.runId || '';
const runUrl = url || data.url || '';

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

📦 *Repositório:* ${repositoryName}
🌿 *Branch:* ${branchName}
🔨 *Deploy realizado por:* ${pusher}

📝 *Commit:*
   • Hash: ${commitInfo.hash || 'N/A'}
   • Autor: ${commitInfo.author || 'Desconhecido'}
   • Mensagem: ${getCommitMessage(commitInfo.message)}
   • Data: ${formatDate(commitInfo.date || timestamp)}

⚙️ *Workflow:* ${workflowName}
🔗 *Run ID:* ${runIdValue ? `#${runIdValue}` : 'N/A'}

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
      repository: repositoryName,
      branch: branchName,
      commitHash: commitInfo.hash,
      commitAuthor: commitInfo.author,
      pusher: pusher,
      timestamp: timestamp
    }
  }
};
