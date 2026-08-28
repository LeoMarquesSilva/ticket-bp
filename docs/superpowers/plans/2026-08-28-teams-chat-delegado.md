# Teams 1:1 Delegado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar os avisos de chamados em chats individuais do Teams sem exigir a instalação de um aplicativo pelos destinatários.

**Architecture:** O e-mail e a resolução do destinatário continuam usando o token de aplicação atual. Uma conta corporativa autoriza o Responsum por Authorization Code; o refresh token fica criptografado no banco e gera tokens delegados para criar/recuperar chats e publicar mensagens 1:1. O painel de Comunicações permite conectar, visualizar e desconectar a conta.

**Tech Stack:** Supabase Edge Functions/Deno, Microsoft Graph v1.0, Web Crypto AES-GCM/HMAC-SHA-256, PostgreSQL/RLS, React, TypeScript e Vitest.

## Global Constraints

- Destinatário sempre é `ticket.created_by`; o cliente nunca fornece o endereço de entrega.
- Escopos delegados: `openid profile offline_access User.Read Chat.Create ChatMessage.Send`.
- Callback exato: `https://jhgbrbarfpvgdaaznldj.supabase.co/functions/v1/notify-ticket-communications/oauth/callback`.
- O refresh token nunca pode aparecer em respostas, logs ou no frontend.
- Falha ou desconexão do Teams não bloqueia e-mail, chamado ou avaliação.
- Alterações não relacionadas que já existem no worktree devem ser preservadas.

---

### Task 1: Contrato OAuth e criptografia

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/teamsDelegatedAuth.mjs`
- Create: `api/shared/ticketCommunicationTeamsDelegatedAuth.test.ts`
- Modify: `supabase/functions/notify-ticket-communications/_shared/runtimeConfig.mjs`
- Modify: `api/shared/ticketCommunicationConfig.test.ts`

**Interfaces:**
- Produces: `createAuthorizationUrl(config, now, randomBytes)`, `validateOAuthState(config, state, now)`, `encryptRefreshToken(key, token, crypto)` e `decryptRefreshToken(key, record, crypto)`.

- [ ] Escrever testes com valores literais para URL, expiração/assinatura do state, adulteração, AES-GCM e configuração ausente.
- [ ] Executar `npm test -- api/shared/ticketCommunicationTeamsDelegatedAuth.test.ts api/shared/ticketCommunicationConfig.test.ts` e confirmar falha por módulo/comportamento ausente.
- [ ] Implementar URL com `response_type=code`, `response_mode=query`, callback exato e os seis escopos; usar state assinado com validade de dez minutos.
- [ ] Implementar AES-GCM com IV aleatório de 12 bytes e chave base64 de 32 bytes; retornar somente ciphertext e IV em base64url.
- [ ] Reexecutar os testes direcionados até passarem.

### Task 2: Persistência protegida da conta conectada

**Files:**
- Create: `supabase/migrations/20260828190000_ticket_communications_delegated_teams.sql`
- Create: `supabase/functions/notify-ticket-communications/_shared/teamsDelegatedStore.ts`
- Modify: `api/shared/ticketCommunicationMigration.test.ts`
- Create: `api/shared/ticketCommunicationTeamsDelegatedStore.test.ts`

**Interfaces:**
- Produces: `createTeamsDelegatedStore(supabaseAdmin)` com `get()`, `save(record)` e `disconnect()`.

- [ ] Escrever testes que exijam tabela singleton, RLS sem políticas públicas, revogação de `anon/authenticated` e mapeamento integral do store.
- [ ] Executar os testes e observar a falha esperada pela migration/store ausentes.
- [ ] Criar `app_c009c0e4f1_ticket_teams_oauth` com conta, token cifrado, IV e datas; permitir acesso somente por service role.
- [ ] Implementar o store sem devolver o token em métodos de status.
- [ ] Reexecutar os testes direcionados até passarem.

### Task 3: Troca, renovação e envio no chat individual

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/teamsChatClient.mjs`
- Create: `api/shared/ticketCommunicationTeamsChat.test.ts`
- Modify: `supabase/functions/notify-ticket-communications/_shared/graphClient.mjs`
- Modify: `supabase/functions/notify-ticket-communications/_shared/processor.mjs`
- Modify: `api/shared/ticketCommunicationGraph.test.ts`
- Modify: `api/shared/ticketCommunicationProcessor.test.ts`

**Interfaces:**
- Produces: `createTeamsChatClient({ config, store, fetchImpl, crypto })` com `exchangeCode(code)`, `getStatus()`, `disconnect()` e `sendChat({ recipientUserId, html })`.
- Consumes: conta conectada e token criptografado do Task 2.

- [ ] Escrever testes para troca do código, `/me`, renovação/rotação do refresh token, `POST /chats` com exatamente dois membros e `POST /chats/{id}/messages` com link direto.
- [ ] Escrever regressões que comprovem que o processador usa o chat e mantém canais independentes.
- [ ] Executar os testes direcionados e confirmar falhas pelo envio antigo de Activity Notification.
- [ ] Implementar renovação delegada com retry sanitizado, cache de access token apenas em memória e persistência da rotação cifrada.
- [ ] Substituir `sendTeamsActivity` por `sendTeamsChat`, reutilizando `resolveUserId` do token de aplicação.
- [ ] Reexecutar os testes direcionados até passarem.

### Task 4: Endpoints administrativos e callback

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/teamsOAuthHandler.mjs`
- Modify: `supabase/functions/notify-ticket-communications/index.ts`
- Modify: `api/shared/ticketCommunicationHandler.test.ts`

**Interfaces:**
- Produces ações autenticadas `teams_oauth_status`, `teams_oauth_start`, `teams_oauth_disconnect` e callback público GET protegido por state.

- [ ] Escrever testes para autorização `manage_categories`, corpos estritos, status sanitizado, URL de conexão e callback com sucesso/erro.
- [ ] Executar os testes e confirmar que falham porque as ações/rota ainda não existem.
- [ ] Autorizar ações somente para usuário com `manage_categories`; manter `daily` exclusivo à secret key.
- [ ] Interceptar apenas o caminho GET `/oauth/callback`, validar state, trocar o código, salvar a conta e redirecionar para `/categories?tab=comunicacoes&teams=connected`.
- [ ] Garantir respostas `Cache-Control: no-store` e ausência de tokens nos corpos.
- [ ] Reexecutar os testes direcionados até passarem.

### Task 5: Painel de conexão do Teams

**Files:**
- Create: `src/services/ticketCommunicationTeamsService.ts`
- Create: `src/services/ticketCommunicationTeamsService.test.ts`
- Modify: `src/components/categories/TicketCommunicationsTab.tsx`
- Modify: `src/components/categories/TicketCommunicationsTab.test.ts`
- Modify: `src/pages/CategoryManagement.tsx`

**Interfaces:**
- Produces: serviço `getStatus()`, `startConnection()` e `disconnect()`; card de estado no painel.

- [ ] Escrever testes do serviço e renderização para estados conectado, desconectado e carregando.
- [ ] Executar os testes e confirmar falha por serviço/card ausentes.
- [ ] Adicionar card “Microsoft Teams” com conta, última conexão e botões Conectar novamente/Desconectar.
- [ ] Abrir a URL devolvida pelo backend na mesma janela e selecionar a aba Comunicações pelo parâmetro `tab` após o callback.
- [ ] Reexecutar os testes direcionados até passarem.

### Task 6: Implantação e verificação real

**Files:**
- Modify: `.env.example`
- Modify: `docs/DEPLOY-TICKET-COMMUNICATIONS.md`

- [ ] Gerar uma chave aleatória de 32 bytes sem exibi-la e configurar `TICKET_COMMUNICATIONS_MICROSOFT_TOKEN_ENCRYPTION_KEY` nos secrets do projeto Supabase.
- [ ] Aplicar a migration e publicar `notify-ticket-communications`.
- [ ] Executar `npm test`, `npm run lint` e `npm run build`; corrigir qualquer falha dentro do escopo.
- [ ] Abrir o painel, conectar `leonardo.marques@bismarchipires.com.br` e confirmar o status sem expor tokens.
- [ ] Enviar uma mensagem de teste 1:1 para `leonardo.marques@bismarchipires.com.br` e confirmar o retorno Graph.
- [ ] Revisar `git diff`, stagear somente os arquivos do recurso, criar commit e publicar por fast-forward na branch principal conforme as regras do repositório.
