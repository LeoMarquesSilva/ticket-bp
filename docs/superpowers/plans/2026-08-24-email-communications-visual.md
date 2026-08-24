# Email Communications Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar e-mails Responsum profissionais e uma aba administrativa para visualizar e ajustar seus textos.

**Architecture:** Um módulo compartilhado define defaults, valida overrides e renderiza conteúdo. A Edge Function lê configuração global saneada; o frontend usa o mesmo contrato para edição e preview, persistindo apenas texto na tabela de configurações existente.

**Tech Stack:** React, TypeScript, Supabase, Deno Edge Functions, Vitest, HTML de e-mail com tabelas e CSS inline.

## Global Constraints

- Não aceitar HTML arbitrário nem configuração de destinatário ou URL.
- Assunto: máximo 140 caracteres; motivo: 320; CTA: 48.
- Links sempre derivados de `APP_PUBLIC_URL` e `ticket.id`.
- Outlook e clientes sem CSS moderno devem manter leitura e CTA funcional.
- Ausência ou corrupção da configuração deve usar os defaults versionados.

---

### Task 1: Contrato, defaults e novo HTML

**Files:**
- Modify: `supabase/functions/notify-ticket-communications/_shared/templates.mjs`
- Modify: `api/shared/ticketCommunicationTemplates.test.ts`

- [ ] Escrever testes RED para estrutura Outlook-safe, identidade Responsum, três variantes, escaping, texto puro e overrides limitados.
- [ ] Implementar defaults, normalização e renderer com tabelas/estilos inline.
- [ ] Rodar `npm test -- --run api/shared/ticketCommunicationTemplates.test.ts` e confirmar GREEN.
- [ ] Commitar o módulo visual e seus testes.

### Task 2: Persistência e uso na Edge Function

**Files:**
- Modify: `supabase/functions/notify-ticket-communications/_shared/repository.ts`
- Modify: `supabase/functions/notify-ticket-communications/_shared/processor.mjs`
- Modify: `api/shared/ticketCommunicationProcessor.test.ts`
- Create: `src/services/ticketCommunicationSettingsService.ts`
- Create: `src/services/ticketCommunicationSettingsService.test.ts`

- [ ] Escrever testes RED para leitura, fallback, saneamento, salvamento e aplicação por entrega.
- [ ] Implementar chave JSON versionada `ticket_communication_email_templates_v1` na tabela existente.
- [ ] Carregar uma vez por execução e passar overrides saneados ao renderer.
- [ ] Rodar os testes focados e confirmar GREEN.
- [ ] Commitar persistência e integração.

### Task 3: Aba administrativa e preview

**Files:**
- Create: `src/components/categories/TicketCommunicationsTab.tsx`
- Create: `src/components/categories/TicketCommunicationsTab.test.tsx`
- Modify: `src/pages/CategoryManagement.tsx`

- [ ] Escrever testes RED para seletor de variante, edição, preview, salvar e restaurar.
- [ ] Implementar aba `Comunicações` seguindo o padrão visual da página existente.
- [ ] Renderizar preview desktop/mobile com dados fictícios e o renderer compartilhado.
- [ ] Rodar os testes do componente e confirmar GREEN.
- [ ] Commitar a tela.

### Task 4: Verificação integrada

**Files:**
- Modify: `docs/DEPLOY-TICKET-COMMUNICATIONS.md`

- [ ] Documentar a chave, permissão e comportamento de fallback.
- [ ] Rodar `npm test -- --run` e o Deno check da Edge Function.
- [ ] Validar HTML sem conteúdo não escapado, JSON/manifesto e `git diff --check`.
- [ ] Confirmar worktree limpo e commit final.

