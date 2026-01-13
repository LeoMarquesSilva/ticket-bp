# 🔧 Troubleshooting - Webhook não chega no n8n

## ❌ Problema: Workflow executa mas webhook não chega

### Causa Mais Comum

O secret `N8N_DEPLOY_WEBHOOK_URL` **NÃO está configurado no GitHub**.

Quando o secret não está configurado:
- A variável `${{ secrets.N8N_DEPLOY_WEBHOOK_URL }}` fica vazia
- O curl tenta fazer POST para uma URL vazia
- O workflow falha silenciosamente (porque tem `continue-on-error: true`)
- O webhook nunca chega no n8n

## ✅ Solução

### Passo 1: Verificar Logs do GitHub Actions

1. Vá em: `https://github.com/LeoMarquesSilva/ticket-bp/actions`
2. Clique no workflow **"Deploy Notification to n8n"**
3. Clique na execução mais recente (ex: "#1")
4. Clique no step **"Send webhook to n8n"**
5. Veja os logs - você verá um erro como:
   ```
   curl: (3) URL using bad/illegal format or missing URL
   ```
   Ou:
   ```
   curl: (6) Could not resolve host: 
   ```

### Passo 2: Configurar o Secret

1. **Acesse diretamente pela URL:**
   ```
   https://github.com/LeoMarquesSilva/ticket-bp/settings/secrets/actions
   ```

2. **Ou navegue:**
   - Settings → Secrets and variables → Actions
   - Ou: Settings → Security → Secrets and variables → Actions

3. **Clique em "New repository secret"**

4. **Preencha:**
   - **Name**: `N8N_DEPLOY_WEBHOOK_URL`
   - **Secret**: `https://ia-n8n.a8fvaf.easypanel.host/webhook/responsum-deploy`

5. **Clique em "Add secret"**

### Passo 3: Testar Novamente

Após configurar o secret:

1. Faça um novo commit e push:
   ```bash
   git commit --allow-empty -m "test: verificar webhook após configurar secret"
   git push
   ```

2. Aguarde alguns segundos

3. Verifique:
   - ✅ GitHub Actions: Veja se o step "Send webhook to n8n" executou sem erro
   - ✅ n8n: Veja se recebeu o webhook
   - ✅ WhatsApp: Veja se a mensagem foi enviada

## 🔍 Verificar se o Secret Está Configurado

**Método 1: Via Interface**

1. Vá em: `https://github.com/LeoMarquesSilva/ticket-bp/settings/secrets/actions`
2. Você deve ver o secret `N8N_DEPLOY_WEBHOOK_URL` na lista
3. Se não estiver lá, significa que não foi configurado

**Método 2: Via Logs**

1. Vá nos logs do GitHub Actions
2. Se o step "Send webhook to n8n" mostrar erro de URL vazia, o secret não está configurado

## 📝 Exemplo de Erro nos Logs

Se o secret não estiver configurado, você verá nos logs algo como:

```
Run curl -X POST "" \
  -H "Content-Type: application/json" \
  ...
curl: (3) URL using bad/illegal format or missing URL
```

**⚠️ Nota:** Como o workflow tem `continue-on-error: true`, ele não falha completamente, apenas o step falha silenciosamente.

## ✅ Quando Estiver Configurado Corretamente

Nos logs do GitHub Actions, você verá:

```
Run curl -X POST "https://ia-n8n.a8fvaf.easypanel.host/webhook/responsum-deploy" \
  -H "Content-Type: application/json" \
  ...
curl: (0) ...
```

E no n8n, você verá o webhook ser recebido.

## 🚀 URL do Webhook

Seu webhook é:
```
https://ia-n8n.a8fvaf.easypanel.host/webhook/responsum-deploy
```

Certifique-se de copiar exatamente esta URL (sem espaços extras no início ou fim).
