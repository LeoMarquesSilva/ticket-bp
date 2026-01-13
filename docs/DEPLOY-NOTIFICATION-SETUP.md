# Configuração de Notificação de Deploy via WhatsApp

Este documento explica como configurar notificações automáticas via WhatsApp quando houver deploy para produção.

## 📋 Pré-requisitos

1. **GitHub Actions habilitado no repositório**
2. **n8n configurado e acessível**
3. **Evolution API configurada para WhatsApp**
4. **Webhook do n8n configurado**

## 🔧 Configuração

### Passo 1: Configurar Secret no GitHub

1. No seu repositório GitHub, vá em **Settings** → **Secrets and variables** → **Actions**
2. Clique em **New repository secret**
3. Adicione:
   - **Name**: `N8N_DEPLOY_WEBHOOK_URL`
   - **Value**: URL do webhook do n8n (ex: `https://seu-n8n.com/webhook/deploy-notification`)

### Passo 2: Criar Webhook no n8n

1. No n8n, crie um novo workflow
2. Adicione um nó **"Webhook"**
3. Configure:
   - **HTTP Method**: POST
   - **Path**: `/webhook/deploy-notification` (ou o caminho desejado)
   - **Response Mode**: "Using 'Respond to Webhook' Node"
4. Copie a URL completa do webhook
5. Cole essa URL no secret `N8N_DEPLOY_WEBHOOK_URL` do GitHub

### Passo 3: Adicionar Nó Code no n8n

1. Após o nó Webhook, adicione um nó **"Code"**
2. Cole o código do arquivo `N8N-CODE-DEPLOY-NOTIFICATION.js`
3. **IMPORTANTE**: Altere o número do WhatsApp na linha:
   ```javascript
   number: '5511999999999', // ⚠️ ALTERE: Número do WhatsApp
   ```
   - Formato: código do país + DDD + número (sem espaços, sem +)
   - Exemplo Brasil: `5511999999999`

### Passo 4: Adicionar Nó Evolution API

1. Adicione o nó **"Evolution API"** (ou "HTTP Request")
2. Configure conforme a documentação da Evolution API
3. Use os dados do nó Code anterior

### Passo 5: Adicionar Nó Respond to Webhook

1. Adicione um nó **"Respond to Webhook"**
2. Configure a resposta (opcional):
   ```json
   {
     "success": true,
     "message": "Notificação de deploy processada"
   }
   ```

## 🔄 Workflow Completo

```
[GitHub Push] → [GitHub Actions] → [Webhook n8n] → [Code] → [Evolution API] → [Respond to Webhook]
```

## 📱 Exemplo de Mensagem Enviada

A mensagem enviada no WhatsApp terá o seguinte formato:

```
🚀 Nova Atualização no Sistema Responsum

📦 Repositório: LeoMarquesSilva/ticket-bp
🌿 Branch: master
🔨 Deploy realizado por: leonardo.marques

📝 Commit:
   • Hash: 71c298b
   • Autor: Leonardo Marques
   • Mensagem: feat: adicionar webhook para n8n quando feedback de detrator é recebido
   • Data: 13/01/2026 17:30

⚙️ Workflow: Deploy Notification
🔗 Run ID: #123456789

✅ Status: Deploy realizado com sucesso

📅 Data do deploy: 13/01/2026 17:30

🔍 Ver detalhes: https://github.com/LeoMarquesSilva/ticket-bp/actions/runs/123456789
```

## ⚙️ Personalização

### Alterar Número Destinatário

No nó Code, altere:
```javascript
number: '5511999999999', // Número do WhatsApp
```

### Enviar para Múltiplos Números

No nó Code, retorne um array (similar ao código de feedback de detrator).

### Filtrar Commits

Para evitar notificações desnecessárias, você pode:

1. **Ignorar commits de documentação** (já configurado no workflow):
   ```yaml
   paths-ignore:
     - 'docs/**'
     - '*.md'
   ```

2. **Filtrar por prefixo de commit**:
   Edite o workflow para verificar se o commit começa com `feat:`, `fix:`, etc.

3. **Filtrar no n8n**:
   No nó Code, adicione uma verificação:
   ```javascript
   if (!commit.message.startsWith('feat:') && !commit.message.startsWith('fix:')) {
     return { json: { skip: true } };
   }
   ```

## 🔒 Segurança

- **Webhook URL**: Use HTTPS para o webhook
- **Secret**: Mantenha a URL do webhook como secret no GitHub
- **Validação**: O n8n pode validar a origem do webhook se necessário

## 🐛 Troubleshooting

### Notificação não é enviada

1. Verifique se o GitHub Actions está habilitado
2. Verifique os logs do GitHub Actions
3. Verifique se o secret `N8N_DEPLOY_WEBHOOK_URL` está configurado
4. Verifique se o webhook no n8n está ativo

### Webhook não recebe dados

1. Verifique a URL do webhook
2. Verifique os logs do n8n
3. Teste o webhook manualmente com um POST

### Erro no GitHub Actions

1. Verifique os logs do workflow
2. Certifique-se de que os secrets estão configurados
3. Verifique se a URL do webhook está correta

## 📚 Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Evolution API Documentation](https://doc.evolution-api.com/)
- [n8n Documentation](https://docs.n8n.io/)

## 🚀 Exemplo de Workflow GitHub Actions

O workflow já está configurado no arquivo `.github/workflows/deploy-notification.yml`.

Ele:
- ✅ Dispara quando há push para `master`
- ✅ Ignora mudanças em `docs/` e arquivos `.md`
- ✅ Coleta informações do commit
- ✅ Envia webhook para o n8n
- ✅ Não falha o workflow se o webhook falhar (`continue-on-error: true`)
