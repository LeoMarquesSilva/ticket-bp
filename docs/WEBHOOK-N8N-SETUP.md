# Configuração de Webhook para n8n - Notificação de Detratores

Este documento explica como configurar o webhook no n8n para receber notificações quando um feedback de detrator (nota 0-7) é enviado.

## 📋 Visão Geral

Quando um usuário avalia o atendimento com nota 0-7 (detrator), o sistema envia automaticamente um webhook para o n8n com todas as informações relevantes.

## ⚙️ Configuração

### 1. Variável de Ambiente

Adicione a URL do webhook do n8n no arquivo `.env`:

```env
VITE_WEBHOOK_URL=https://seu-n8n.com/webhook/detractor-feedback
```

**⚠️ Importante:** A URL deve ser acessível publicamente para receber os webhooks.

### 2. Criar Workflow no n8n

#### Passo 1: Criar Webhook
1. No n8n, crie um novo workflow
2. Adicione um nó **"Webhook"**
3. Configure:
   - **HTTP Method**: POST
   - **Path**: `/detractor-feedback` (ou o caminho desejado)
   - **Response Mode**: "Using 'Respond to Webhook' Node"
4. Copie a URL completa do webhook (ex: `https://seu-n8n.com/webhook/detractor-feedback`)
5. Cole essa URL na variável `VITE_WEBHOOK_URL` do `.env`

#### Passo 2: Estrutura dos Dados Recebidos

O n8n receberá um JSON com a seguinte estrutura:

```json
{
  "event": "detractor_feedback",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "ticket": {
      "id": "uuid-do-ticket",
      "title": "Título do ticket",
      "category": "protocolo",
      "subcategory": "duvidas",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "resolvedAt": "2024-01-15T10:00:00.000Z"
    },
    "feedback": {
      "serviceScore": 3,
      "comment": "Comentário do usuário",
      "requestFulfilled": false,
      "notFulfilledReason": "Razão por não ter sido atendido",
      "submittedAt": "2024-01-15T10:30:00.000Z"
    },
    "user": {
      "name": "Nome do Usuário",
      "email": "usuario@exemplo.com"
    },
    "assignedTo": "Nome do Atendente"
  }
}
```

#### Passo 3: Processar os Dados

Após receber o webhook, você pode:

1. **Enviar E-mail**:
   - Use o nó "Send Email" (Gmail, SMTP, SendGrid, etc.)
   - Configure o destinatário (ex: gestor, equipe de qualidade)
   - Use os dados do payload para personalizar o e-mail

2. **Enviar Notificação (Slack, Teams, WhatsApp, etc.)**:
   - Use o nó correspondente ao serviço desejado
   - Formate a mensagem usando os dados recebidos

3. **Salvar em Banco de Dados**:
   - Use nó SQL ou banco de dados
   - Armazene os dados para análises futuras

#### Passo 4: Exemplo de Workflow

```
[Webhook] → [Function/Code] → [Send Email] → [Respond to Webhook]
                ↓
         [Format Message]
```

### 3. Exemplo de Mensagem de E-mail

Você pode criar um template de e-mail no n8n usando os dados:

```
Assunto: ⚠️ Feedback de Detrator Recebido - Ticket #{{ $json.data.ticket.id.slice(-8) }}

Olá,

Recebemos um feedback negativo (nota {{ $json.data.feedback.serviceScore }}/10) do ticket:

Ticket: {{ $json.data.ticket.title }}
Categoria: {{ $json.data.ticket.category }}
Solicitante: {{ $json.data.user.name }} ({{ $json.data.user.email }})
Atendente: {{ $json.data.assignedTo }}

Feedback:
- Nota: {{ $json.data.feedback.serviceScore }}/10
- Solicitação atendida: {{ $json.data.feedback.requestFulfilled ? 'Sim' : 'Não' }}
- Comentário: {{ $json.data.feedback.comment }}

Por favor, entre em contato com o cliente para melhorar a experiência.
```

## 🔒 Segurança (Opcional)

Para maior segurança, você pode:

1. **Adicionar autenticação no webhook**:
   - Configure um token secreto no n8n
   - Envie o token no header do webhook
   - Valide o token no n8n antes de processar

2. **Usar HTTPS**:
   - Certifique-se de que o n8n está acessível via HTTPS

## 🧪 Testando

1. Configure a URL do webhook no `.env`
2. Reinicie o servidor de desenvolvimento
3. Crie um ticket e avalie com nota 0-6
4. Verifique no n8n se o webhook foi recebido
5. Verifique os logs do navegador (Console) para ver se houve erros

## 📝 Logs

O sistema registra no console:
- ✅ `Webhook enviado com sucesso` - Quando o webhook é enviado
- ⚠️ `VITE_WEBHOOK_URL não configurada` - Quando a URL não está configurada
- ❌ `Erro ao enviar webhook` - Quando há erro no envio

## 🚀 Próximos Passos

Você pode expandir a automação para:
- Notificar diferentes pessoas baseado na categoria
- Criar tickets automáticos em outros sistemas
- Enviar relatórios periódicos
- Integrar com CRM
- Enviar para múltiplos canais simultaneamente
