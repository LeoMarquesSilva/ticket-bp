# 🧪 Guia de Teste - Notificação de Deploy

## ✅ Checklist Antes de Testar

Antes de fazer o teste, certifique-se de ter:

- [ ] Configurado o secret `N8N_DEPLOY_WEBHOOK_URL` no GitHub
- [ ] Criado o workflow no n8n com webhook ativo
- [ ] Configurado o nó Code com o código de `N8N-CODE-DEPLOY-NOTIFICATION.js`
- [ ] Configurado o número do WhatsApp no código
- [ ] Testado o webhook do n8n manualmente (opcional)

## 🚀 Como Testar

### Método 1: Push Simples (Recomendado)

1. **Faça uma pequena alteração** (ex: adicionar um comentário ou ajustar texto)
2. **Commit e push:**
   ```bash
   git add .
   git commit -m "test: verificar notificação de deploy"
   git push
   ```

3. **Verifique:**
   - ✅ GitHub Actions: Vá em **Actions** no GitHub e veja se o workflow rodou
   - ✅ n8n: Veja se o webhook foi recebido
   - ✅ WhatsApp: Veja se a mensagem foi enviada

### Método 2: Verificar GitHub Actions

1. Após fazer push, vá em: `https://github.com/LeoMarquesSilva/ticket-bp/actions`
2. Clique no workflow **"Deploy Notification to n8n"**
3. Veja os logs para verificar se:
   - ✅ O workflow executou
   - ✅ O webhook foi enviado
   - ⚠️ Se houver erro, veja a mensagem

### Método 3: Testar Webhook Manualmente

Se quiser testar o webhook antes de configurar o GitHub Actions:

1. **Use curl ou Postman:**
   ```bash
   curl -X POST "https://seu-n8n.com/webhook/deploy-notification" \
     -H "Content-Type: application/json" \
     -d '{
       "event": "deploy",
       "data": {
         "repository": "LeoMarquesSilva/ticket-bp",
         "branch": "master",
         "commit": {
           "hash": "abc123",
           "message": "test: verificar notificação",
           "author": "Leo Marques",
           "date": "2026-01-13T18:00:00Z"
         },
         "pusher": "leonardo.marques"
       },
       "timestamp": "2026-01-13T18:00:00Z"
     }'
   ```

2. **Verifique no n8n** se recebeu o webhook
3. **Verifique no WhatsApp** se a mensagem foi enviada

## 🔍 Onde Verificar Logs

### GitHub Actions:
- URL: `https://github.com/LeoMarquesSilva/ticket-bp/actions`
- Veja os logs do workflow "Deploy Notification to n8n"

### n8n:
- Veja a execução do workflow no n8n
- Verifique se o webhook foi recebido
- Veja os dados processados pelo nó Code

### Console do Navegador:
- Se houver erro no envio do webhook, aparecerá nos logs do GitHub Actions

## ⚠️ Problemas Comuns

### Workflow não executa

**Causa:** GitHub Actions pode estar desabilitado ou o workflow tem erro de sintaxe.

**Solução:**
1. Vá em **Settings** → **Actions** → **General**
2. Certifique-se de que "Allow all actions and reusable workflows" está habilitado
3. Verifique se o arquivo `.github/workflows/deploy-notification.yml` está correto

### Webhook não recebe dados

**Causa:** URL do secret está incorreta ou webhook não está ativo.

**Solução:**
1. Verifique se o secret `N8N_DEPLOY_WEBHOOK_URL` está configurado corretamente
2. Certifique-se de que a URL está completa (com https://)
3. Teste a URL manualmente com curl

### Mensagem não chega no WhatsApp

**Causa:** Número do WhatsApp incorreto ou Evolution API com problema.

**Solução:**
1. Verifique o número no código (deve estar no formato `5511999999999`)
2. Verifique se a Evolution API está funcionando
3. Teste enviar uma mensagem manualmente pelo Evolution API

## 📝 Exemplo de Teste Completo

```bash
# 1. Fazer uma pequena alteração (opcional)
echo "# Teste" >> README.md

# 2. Commit
git add .
git commit -m "test: verificar notificação de deploy"

# 3. Push
git push

# 4. Aguardar alguns segundos

# 5. Verificar no GitHub Actions
# Vá em: https://github.com/LeoMarquesSilva/ticket-bp/actions

# 6. Verificar no n8n
# Veja se o webhook foi recebido

# 7. Verificar no WhatsApp
# Veja se a mensagem chegou
```

## 🎯 Próximos Passos

Após confirmar que está funcionando:

1. ✅ Remover commits de teste se necessário
2. ✅ Ajustar a mensagem no código se quiser personalizar
3. ✅ Configurar números adicionais se necessário
4. ✅ Documentar para a equipe
