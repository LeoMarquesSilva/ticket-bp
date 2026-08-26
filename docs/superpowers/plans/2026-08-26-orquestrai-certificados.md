# Certificados DC → ORQESTRAI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No modal de envio DC → ORQESTRAI, criar cards PPT e/ou Certificados (prazo D+1) e, depois do prazo, gravar no card de certificados quem preencheu a presença no SharePoint — ou que não foi preenchida.

**Architecture:** Política pura no front (`sendMode`, prazo, textos, marcador de presença) alimenta o modal e a Edge Function `orquestrai-treinamento`, que passa a criar até dois `marketing_requests` com dedup por ticket + `request_type`. Um job diário `orquestrai-certificados-presenca` lê TREINAMENTOS MINISTRADOS + TREINAMENTOS OPERAÇÕES LEGAIS via Graph e atualiza a descrição uma única vez.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase Edge Functions (Deno), Microsoft Graph, ORQESTRAI `marketing_requests`.

## Global Constraints

- Envio restrito a Leonardo e Valentina.
- Ticket Responsum não é alterado pelo envio.
- Tipos oficiais: `PPT` e `Certificados`. Não usar `Evento`.
- Prazo certificados = data do workshop + 1 dia civil (`DD/MM/AAAA`).
- Presença só depois do D+1; uma checagem; vazio → `Presença: não preenchida`; sem retry.
- Falha de Graph/ORQESTRAI/treinamento não localizado não grava o marcador.
- Lista de presença `30ea2880-475e-489c-8600-ae541d29faf3`.
- Timezone do job: `America/Sao_Paulo`.
- Não commitar a menos que o usuário peça.
- Não mexer em alterações não relacionadas do worktree.

---

## File Structure

- Create: `src/utils/orquestraiSendMode.ts` — modos, prazo D+1, títulos, marcador de presença.
- Create: `src/utils/orquestraiSendMode.test.ts`
- Modify: `src/utils/desenvolvimentoContinuoForm.ts` — `sendMode` no payload.
- Modify: `src/utils/orquestraiTreinamentoPreview.ts` — prévia por modo.
- Modify: `src/components/SendToOrquestraiButton.tsx` — seletor de modo e campos condicionais.
- Modify: `src/services/orquestraiTreinamentosService.ts` — envia `sendMode`.
- Modify: `supabase/functions/orquestrai-treinamento/_shared/orquestraiClient.ts` — criar PPT e/ou Certificados, dedup por tipo.
- Modify: `supabase/functions/orquestrai-treinamento/index.ts` — aceitar `sendMode`.
- Create: `supabase/functions/orquestrai-certificados-presenca/` — job diário.
- Modify: `supabase/config.toml` — registrar a function.
- Create: `src/utils/orquestraiPresenca.ts` — regras puras do job (candidatos, texto, marcador).
- Create: `src/utils/orquestraiPresenca.test.ts`

### Task 1: Política de modo, prazo e textos

**Files:**
- Create: `src/utils/orquestraiSendMode.ts`
- Create: `src/utils/orquestraiSendMode.test.ts`
- Create: `src/utils/orquestraiPresenca.ts`
- Create: `src/utils/orquestraiPresenca.test.ts`

**Interfaces:**
- Produces: `OrquestraiSendMode = 'ppt' | 'certificados' | 'ppt_e_certificados'`
- Produces: `sendModesFor(mode): Array<'PPT' | 'Certificados'>`
- Produces: `certificadosDeadlineIso(dataRealizacaoBr: string): string | null` — D+1
- Produces: `buildCertificadosTitle(payload)`, `PRESENCA_MARKER`, `formatPresencaBlock(names: string[]): string`, `descriptionAlreadyHasPresenca(description: string): boolean`, `isPresencaDue(deadlineIso: string, todayIso: string): boolean`

- [ ] **Step 1: Testes da política**

```ts
import { describe, expect, it } from 'vitest';
import { certificadosDeadlineIso, sendModesFor } from './orquestraiSendMode';
import {
  descriptionAlreadyHasPresenca,
  formatPresencaBlock,
  isPresencaDue,
} from './orquestraiPresenca';

it('PPT só emite PPT', () => {
  expect(sendModesFor('ppt')).toEqual(['PPT']);
});
it('certificados só emite Certificados', () => {
  expect(sendModesFor('certificados')).toEqual(['Certificados']);
});
it('misto emite os dois', () => {
  expect(sendModesFor('ppt_e_certificados')).toEqual(['PPT', 'Certificados']);
});
it('soma um dia civil', () => {
  expect(certificadosDeadlineIso('26/08/2026')).toBe('2026-08-27');
});
it('vira o mês', () => {
  expect(certificadosDeadlineIso('31/08/2026')).toBe('2026-09-01');
});
it('vazio vira não preenchida', () => {
  expect(formatPresencaBlock([])).toBe('Presença: não preenchida');
});
it('lista nomes', () => {
  expect(formatPresencaBlock(['Ana', 'Bia'])).toBe('Presença:\n- Ana\n- Bia');
});
it('detecta marcador', () => {
  expect(descriptionAlreadyHasPresenca('x\nPresença: não preenchida')).toBe(true);
});
it('D+1 ainda não processa no próprio dia do prazo', () => {
  expect(isPresencaDue('2026-08-27', '2026-08-27')).toBe(false);
  expect(isPresencaDue('2026-08-27', '2026-08-28')).toBe(true);
});
```

- [ ] **Step 2: Implementar as funções até os testes passarem**

`npm test -- src/utils/orquestraiSendMode.test.ts src/utils/orquestraiPresenca.test.ts`

### Task 2: Modal e payload de envio

**Files:**
- Modify: `src/utils/desenvolvimentoContinuoForm.ts` — `sendMode?: OrquestraiSendMode` em `SharepointTreinamentoPayload`
- Modify: `src/utils/orquestraiTreinamentoPreview.ts`
- Modify: `src/components/SendToOrquestraiButton.tsx`
- Modify: `src/services/orquestraiTreinamentosService.ts`

**Interfaces:**
- Consumes: `OrquestraiSendMode`, `certificadosDeadlineIso`, `sendModesFor`
- Produces: body `{ ticketId, ticketAppUrl, payload, sendMode }`

- [ ] **Step 1: Seletor “O que enviar” no topo do modal, default `ppt` se `precisaAjustePpt`, senão `certificados`**
- [ ] **Step 2: Ocultar PPT quando modo = certificados; validar link só se o modo inclui PPT e `precisaAjustePpt`**
- [ ] **Step 3: Prévia lista cada card (tipo + prazo)**
- [ ] **Step 4: `submitOrquestraiTreinamento` envia `sendMode`**

### Task 3: Edge Function cria PPT e/ou Certificados

**Files:**
- Modify: `supabase/functions/orquestrai-treinamento/_shared/orquestraiClient.ts`
- Modify: `supabase/functions/orquestrai-treinamento/index.ts`

**Interfaces:**
- Consumes: `sendMode`, payload DC
- Produces: `{ ok, results: Array<{ requestType, created, marketingRequestId }> }`
- `findExistingRequestId(orquestrai, ticketId, requestType)`
- URL da lista: `https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/TREINAMENTOS%20%20OPERAES%20LEGAIS?env=WebViewList`

- [ ] **Step 1: Dedup por ticket + request_type**
- [ ] **Step 2: Loop nos tipos de `sendModesFor(sendMode)`**
- [ ] **Step 3: Certificados: título `[DC] Certificados — {tema}`, deadline D+1, `link` = lista de presença, `request_type = Certificados`**
- [ ] **Step 4: PPT: comportamento atual (sem `Evento`)**
- [ ] **Step 5: Modo misto define `parent_request_id` do certificados para o PPT**

### Task 4: Job diário de presença

**Files:**
- Create: `supabase/functions/orquestrai-certificados-presenca/index.ts`
- Create: `supabase/functions/orquestrai-certificados-presenca/_shared/cors.ts`
- Create: `supabase/functions/orquestrai-certificados-presenca/_shared/graph.ts` (token + fetch, mesmo padrão `sharepoint-treinamentos`)
- Create: `supabase/functions/orquestrai-certificados-presenca/_shared/presenca.ts` (Graph: achar item MINISTRADOS pelo Ticket ID nas Observações; listar OPERAÇÕES LEGAIS por lookup; resolver nomes)
- Modify: `supabase/config.toml` — `[functions.orquestrai-certificados-presenca]` `verify_jwt = false`
- Modify: `.env.example` — `SHAREPOINT_PRESENCA_LIST_ID=30ea2880-475e-489c-8600-ae541d29faf3` (já pode cair no default)

**Auth:** header `apikey` = secret do projeto (mesmo padrão das outras crons). Sem JWT de usuário.

**Seleção:** `marketing_requests` no ORQESTRAI onde `request_type = 'Certificados'`, description ilike `%Origem: Responsum%`, description not ilike `%Presença:%`, `deadline < hoje SP`.

**Update:** `description = description + '\n\n' + formatPresencaBlock(names)`.

- [ ] **Step 1: Implementar busca + resolução de nomes**
- [ ] **Step 2: Zero nomes → `Presença: não preenchida` e update**
- [ ] **Step 3: Treinamento não encontrado ou Graph error → skip sem update**
- [ ] **Step 4: Deploy da function + cron `12 12 * * *` UTC (`0 9 * * *` em São Paulo no inverno; documentar 09:00 America/Sao_Paulo). Usar `0 12 * * *` UTC = 09:00 BRT como as outras rotinas.**

### Task 5: Verificação

- [ ] `npm test -- src/utils/orquestraiSendMode.test.ts src/utils/orquestraiPresenca.test.ts`
- [ ] `npm run lint`
- [ ] Conferir modal (PPT / Apenas certificados / PPT + certificados) se o app estiver no ar
