# Configuração passo a passo: Web Push API

Siga na ordem. Você já instalou `web-push` no projeto.

---

## Passo 1: Gerar chaves VAPID

No terminal, na raiz do projeto:

```bash
node scripts/generate-vapid.cjs
```

Você verá algo como:

```
=== Chaves VAPID (guarde em .env) ===

VAPID_PUBLIC_KEY=BLx...
VAPID_PRIVATE_KEY=xyz...

# Frontend (.env) - só a pública
VITE_VAPID_PUBLIC_KEY=BLx...
```

- **Nunca** commite a chave privada.
- A **pública** vai no frontend; a **privada** só no backend (API).

---

## Passo 2: Criar a tabela no Supabase

1. Abra o **SQL Editor** do seu projeto no Supabase.
2. Execute o conteúdo do arquivo **`docs/SQL_PUSH_SUBSCRIPTIONS.sql`**.

Isso cria a tabela `app_c009c0e4f1_push_subscriptions` e a política RLS. A policy usa a coluna **`auth_user_id`** da tabela `app_c009c0e4f1_users` para garantir que cada usuário só insere/atualiza/deleta a própria inscrição (comparando com `auth.uid()`). A comparação é feita em `::text` para funcionar tanto se `auth_user_id` for UUID quanto TEXT.

---

## Passo 3: Variáveis de ambiente

### No frontend (Vite)

Crie ou edite o arquivo **`.env`** na raiz (e **`.env.example`** sem valores reais):

```env
VITE_VAPID_PUBLIC_KEY=sua_chave_publica_aqui
```

Recarregue o app (`pnpm dev` ou `npm run dev`) para carregar a variável.

### Na Vercel (API serverless)

No projeto na Vercel: **Settings → Environment Variables**. Adicione:

| Nome | Valor | Observação |
|------|--------|------------|
| `VAPID_PUBLIC_KEY` | (a mesma pública do passo 1) | |
| `VAPID_PRIVATE_KEY` | (a chave privada do passo 1) | Não exponha em frontend |
| `SUPABASE_URL` | `https://seu-projeto.supabase.co` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | (chave service_role do Supabase) | Em Settings → API do Supabase |
| `APP_URL` | `https://seu-dominio.vercel.app` | URL do app (para o link da notificação) |

Salve e faça um novo deploy se o app já estiver no ar.

---

## Passo 4: Webhook no Supabase (disparar a API)

Para que a API envie push quando houver **nova mensagem** ou **novo ticket**:

1. No Supabase: **Database → Webhooks** (ou **Database → Triggers** dependendo da versão).
2. Crie um **Database Webhook**:
   - **Name:** ex. `send-push-on-message`
   - **Table:** `app_c009c0e4f1_chat_messages`
   - **Events:** marque **Insert**
   - **Type:** HTTP Request
   - **URL:** `https://SEU_DOMINIO_VERCEL.vercel.app/api/send-push`
   - **HTTP Headers:** `Content-Type: application/json`
   - O corpo (body) costuma ser enviado automaticamente com o registro inserido (formato depende do Supabase; a API aceita `record` ou `new` com os campos da linha).

3. Repita para **novos tickets** (opcional):
   - **Table:** `app_c009c0e4f1_tickets`
   - **Events:** Insert
   - **URL:** mesma `.../api/send-push`

Se o Supabase enviar o payload em outro formato (ex.: `payload.record` ou nome de tabela diferente), ajuste em `api/send-push.js` na leitura de `body.table` e `body.record` / `body.new`.

---

## Passo 5: Testar no app

1. Faça deploy do projeto (incluindo a pasta `api/`) na Vercel ou rode localmente com `vercel dev`.
2. Acesse o app em **HTTPS** (obrigatório para Service Worker e Push).
3. Faça login e vá em **Perfil**.
4. Na seção **Notificações push**, clique em **Ativar notificações push**.
5. Aceite a permissão no navegador.
6. Em outro usuário (ou outra aba anônima), envie uma mensagem em um ticket que o primeiro usuário participa, ou crie um novo ticket.
7. O primeiro usuário deve receber a notificação (mesmo com a aba em segundo plano ou fechada).

---

## Resumo do fluxo

1. **Frontend:** usuário ativa push no Perfil → Service Worker registrado → `PushManager.subscribe(VAPID_PUBLIC_KEY)` → subscription salva em `app_c009c0e4f1_push_subscriptions`.
2. **Supabase:** INSERT em `chat_messages` ou `tickets` → Webhook chama `POST /api/send-push` com o registro.
3. **API (Vercel):** lê quem notificar, busca subscriptions na tabela, envia com `web-push` (VAPID private key). O Service Worker recebe o push e mostra a notificação; ao clicar, abre a URL do ticket.

---

## Arquivos criados/alterados

| Arquivo | Função |
|---------|--------|
| `scripts/generate-vapid.js` | Gera par VAPID (rodar uma vez) |
| `docs/SQL_PUSH_SUBSCRIPTIONS.sql` | Cria tabela e RLS no Supabase |
| `docs/PUSH-API-SETUP.md` | Este guia |
| `public/sw.js` | Service Worker: recebe push e mostra notificação |
| `src/services/pushService.ts` | Registro do SW, subscribe, salvar no Supabase |
| `src/pages/Profile.tsx` | Card “Notificações push” (ativar/desativar) |
| `src/main.tsx` | Registra o SW na carga do app |
| `api/send-push.js` | API serverless que envia o push (Vercel) |
| `src/lib/supabase.ts` | Adicionada constante `TABLES.PUSH_SUBSCRIPTIONS` |

Se algo falhar, confira o console do navegador (F12), os logs da função na Vercel e as variáveis de ambiente.
