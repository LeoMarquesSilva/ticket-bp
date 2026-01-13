# Configuração n8n + Evolution API (WhatsApp)

Este documento explica como configurar o n8n para enviar mensagens via Evolution API quando um feedback de detrator é recebido.

## 📋 Pré-requisitos

1. **Evolution API configurada e funcionando**
2. **n8n instalado e acessível**
3. **Webhook do Responsum configurado no n8n**

## 🔧 Configuração no n8n

### Passo 1: Criar Workflow

1. Crie um novo workflow no n8n
2. Adicione um nó **"Webhook"**
3. Configure o webhook:
   - **HTTP Method**: POST
   - **Path**: `/webhook-test/responsum` (ou o caminho desejado)
   - **Response Mode**: "Using 'Respond to Webhook' Node"

### Passo 2: Adicionar Nó "Code"

1. Após o nó Webhook, adicione um nó **"Code"**
2. Cole o código do arquivo `N8N-CODE-EVOLUTION-API.js`
3. **IMPORTANTE**: Altere o número do WhatsApp na linha:
   ```javascript
   number: '5511999999999', // ⚠️ ALTERE: Número do WhatsApp
   ```
   - Formato: código do país + DDD + número (sem espaços, sem +, sem parênteses)
   - Exemplo Brasil: `5511999999999` (11 é o DDD, 999999999 é o número)

### Passo 3: Adicionar Nó Evolution API

1. Adicione o nó **"Evolution API"** (ou "HTTP Request" se usar API REST)
2. Configure:
   - **Method**: POST
   - **URL**: `https://sua-evolution-api.com/message/sendText/{instanceName}`
   - **Headers**:
     - `Content-Type`: `application/json`
     - `apikey`: `{sua-api-key}` (se necessário)
   - **Body**: Use os dados do nó Code anterior

#### Exemplo de configuração HTTP Request:

**URL:**
```
https://sua-evolution-api.com/message/sendText/minha-instancia
```

**Method:** POST

**Headers:**
```
Content-Type: application/json
apikey: sua-api-key-aqui
```

**Body (JSON):**
```json
{
  "number": "{{ $json.number }}",
  "textMessage": {
    "text": "{{ $json.textMessage.text }}"
  }
}
```

### Passo 4: Adicionar Nó "Respond to Webhook"

1. Adicione um nó **"Respond to Webhook"**
2. Configure a resposta (opcional):
   ```json
   {
     "success": true,
     "message": "Webhook processado com sucesso"
   }
   ```

## 📱 Exemplo de Mensagem Enviada

A mensagem enviada no WhatsApp terá o seguinte formato:

```
🚨 ALERTA: Feedback de Detrator Recebido

📋 Ticket: TESTE TICKET
🆔 ID: fe0de
📁 Categoria: Outros / outros

🟡 Nota: 3/10

👤 Cliente:
   • Nome: Leo Marques
   • Email: leonardo.marques@bpplaw.com.br

👨‍💼 Atendente: Isadora Godoy Conte

✅ Solicitação Atendida: Sim

💬 Comentário:
Não atendeu minhas solicitações além de ser grosso - TESTE

📅 Resolvido em: 13/01/2026 17:51
📅 Avaliado em: 13/01/2026 17:52

⚠️ Ação necessária: Entre em contato com o cliente para melhorar a experiência.
```

## 🔄 Workflow Completo

```
[Webhook] → [Code] → [Evolution API] → [Respond to Webhook]
```

## ⚙️ Personalização

### Alterar Número Destinatário

No nó Code, altere:
```javascript
number: '5511999999999', // Número do WhatsApp
```

### Enviar para Múltiplos Números

No nó Code, retorne um array:
```javascript
return [
  {
    json: {
      number: '5511999999999',
      textMessage: { text: message }
    }
  },
  {
    json: {
      number: '5511888888888',
      textMessage: { text: message }
    }
  }
];
```

Depois, use o nó "Split In Batches" antes do Evolution API.

### Personalizar Mensagem

Edite a variável `message` no nó Code para alterar o formato da mensagem.

## 🔒 Segurança

- **API Key**: Não exponha sua API key do Evolution API
- **Números**: Certifique-se de que os números estão corretos
- **Validação**: Adicione validação no nó Code se necessário

## 🐛 Troubleshooting

### Mensagem não é enviada

1. Verifique se o número está no formato correto (sem +, sem espaços)
2. Verifique se a instância do Evolution API está ativa
3. Verifique os logs do n8n para erros
4. Verifique se a API key está correta

### Erro de CORS

Se houver erro de CORS, certifique-se de que:
- O Evolution API está configurado para aceitar requisições do n8n
- Os headers estão corretos

### Dados não chegam

1. Verifique se o webhook está recebendo os dados corretamente
2. Use `console.log()` no nó Code para debugar
3. Verifique o formato do payload no n8n

## 📚 Recursos

- [Documentação Evolution API](https://doc.evolution-api.com/)
- [Documentação n8n](https://docs.n8n.io/)
- [n8n Code Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/)
