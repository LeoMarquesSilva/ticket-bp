# Push API (notificações com aba fechada)

## O que é

A **Web Push API** permite que o navegador mostre notificações **mesmo com a aba fechada ou o app em segundo plano**. Hoje o sistema usa:

- **Som** e **toast** quando a aba está aberta ou em background (Supabase Realtime).
- **Nada** quando a aba está fechada — o usuário não recebe aviso.

Com Push API, o backend envia um payload para um serviço do navegador; o **Service Worker** recebe e exibe a notificação nativa (barra do SO). O usuário pode clicar e abrir o app no ticket certo.

---

## O que você precisa configurar

### 1. Visão geral

| Onde | O quê |
|------|--------|
| **Frontend (este app)** | Registrar Service Worker, pedir permissão de notificação, inscrever no push (com chave pública VAPID) e enviar a inscrição (`PushSubscription`) para o backend. |
| **Backend** | Gerar/guardar par de chaves **VAPID**, guardar as inscrições por usuário e, quando houver nova mensagem/ticket, chamar a API de push (com a chave privada) para cada inscrição. |
| **Servidor / hospedagem** | HTTPS obrigatório; o Service Worker precisa ser servido na mesma origem (ex.: `https://seu-dominio.com/sw.js`). |

Não dá para fazer “só no frontend”: **sempre existe um backend** que envia o push (usando a chave privada VAPID).

---

### 2. Chaves VAPID (backend)

**VAPID** = par de chaves que identifica seu servidor perante o navegador.

- **Uso:** a chave **pública** vai para o frontend e é usada na inscrição; a chave **privada** fica só no backend e assina cada envio.
- **Geração (Node.js):** use o pacote `web-push`:

```bash
npm install web-push
node -e "const webpush = require('web-push'); const v = webpush.generateVAPIDKeys(); console.log('Public:', v.publicKey); console.log('Private:', v.privateKey);"
```

- **Armazenamento:** guarde em variáveis de ambiente (ex.: `.env`), nunca no repositório:
  - `VAPID_PUBLIC_KEY` → usado no frontend.
  - `VAPID_PRIVATE_KEY` → usado só no backend.

---

### 3. Backend que envia o push

Quando uma **nova mensagem** ou **novo ticket** for criado, o backend deve:

1. Buscar as **PushSubscription** dos usuários que devem ser notificados (ex.: atendentes para novo ticket; criador do ticket ou atendente para nova mensagem).
2. Chamar a API de envio usando a chave privada VAPID.

**Exemplo em Node.js com `web-push`:**

```js
const webpush = require('web-push');

webpush.setVAPIDDetails(
  'mailto:seu-email@dominio.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushNotification(subscription, payload) {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
```

Onde:

- **subscription** = objeto `PushSubscription` que o frontend salvou (endpoint + keys).
- **payload** = ex.: `{ title: 'Nova mensagem', url: '/tickets/123', ticketId: '123' }`.

Você precisa **persistir** as inscrições (ex.: tabela `user_push_subscriptions`: `user_id`, `subscription` JSON, `created_at`). Ao criar mensagem/ticket, disparar esse envio (em função/serverless ou job).

**Opções de onde rodar esse backend:**

- **Supabase Edge Function:** pode chamar `web-push` (ou lib equivalente) e ser acionada por Realtime/Webhook/DB trigger.
- **Servidor Node (VPS, Railway, Render, etc.):** API que recebe eventos (webhook do Supabase ou Realtime) e envia o push.
- **Firebase Cloud Messaging (FCM):** alternativa à Web Push “pura”; também exige backend para enviar e um projeto Firebase.

---

### 4. Frontend (este projeto)

1. **Service Worker** (ex.: `public/sw.js` na raiz do build):
   - Escutar evento `push`.
   - Mostrar notificação com `registration.showNotification(title, { body, data: { url, ticketId }, tag, requireInteraction })`.
   - No evento `notificationclick`, abrir `clients.openWindow(url)` (ex.: `https://seu-dominio.com/tickets/123`).

2. **Registro do SW:** no app (ex.: em `main.tsx` ou Layout), registrar com `navigator.serviceWorker.register('/sw.js')`.

3. **Permissão e inscrição:**
   - Pedir `Notification.requestPermission()`.
   - Com permissão concedida, obter o `PushManager` do Service Worker e chamar `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`.
   - Enviar o objeto da inscrição (JSON) para seu backend (API que salva em `user_push_subscriptions`).

4. **Quando inscrever:** por exemplo ao fazer login ou em uma tela “Configurações / Notificações”. Só inscrever se o usuário aceitar notificações.

5. **Variável de ambiente no frontend:** `VITE_VAPID_PUBLIC_KEY` (ou similar) com a chave **pública** VAPID, usada em `applicationServerKey`.

---

### 5. Fluxo resumido

```
[Frontend]
  → Usuário aceita notificações
  → SW registrado, pushManager.subscribe(VAPID_PUBLIC_KEY)
  → Envia PushSubscription para o backend (salva por user_id)

[Backend]
  → Nova mensagem/ticket (Supabase Realtime / Webhook / Trigger)
  → Para cada usuário a notificar: busca PushSubscription(s)
  → webpush.sendNotification(subscription, payload) com VAPID_PRIVATE_KEY

[Navegador]
  → Service Worker recebe evento "push"
  → showNotification(...)
  → Usuário clica → notificationclick → openWindow(/tickets/:id)
```

---

### 6. Checklist de configuração

- [ ] Gerar par VAPID e colocar em env (backend).
- [ ] Backend: salvar e recuperar `PushSubscription` por usuário.
- [ ] Backend: ao criar mensagem/ticket, enviar push (web-push ou FCM) para os inscritos.
- [ ] Frontend: criar `public/sw.js` (handler `push` + `notificationclick`).
- [ ] Frontend: registrar o SW e pedir permissão.
- [ ] Frontend: inscrever com `VAPID_PUBLIC_KEY` e enviar subscription para o backend.
- [ ] Deploy em **HTTPS** e servir o SW na mesma origem.

---

### 7. Referências

- [Web Push (web.dev)](https://web.dev/articles/push-notifications-client-codelab)
- [web-push (npm)](https://www.npmjs.com/package/web-push) — Node.js
- [Push API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

Se quiser, o próximo passo pode ser um esqueleto de `sw.js` e da função de inscrição no frontend (com `VITE_VAPID_PUBLIC_KEY`) e um exemplo de Edge Function no Supabase que envia o push ao inserir em `chat_messages`.
