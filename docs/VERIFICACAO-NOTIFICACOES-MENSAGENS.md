# Verificação: Notificações de Mensagens no Sistema

## Resumo do funcionamento atual

### 1. Som de notificação

- **Onde:** `src/hooks/useNotificationSound.ts` + `Layout.tsx` (realtime).
- **Arquivo de áudio:** `public/notification.mp3` (volume 0.5).
- **Quando toca:**
  - **Aba em segundo plano (não visível):** sempre toca para novas mensagens e novos tickets.
  - **Aba visível:**
    - **Novo ticket:** sempre toca (não há “chat aberto” ainda).
    - **Nova mensagem:** toca só se a mensagem for de **outro** ticket (ou seja, o chat daquele ticket não está aberto). Se o chat do ticket da mensagem estiver aberto, o som **não** toca.
- **Quem dispara:** inscrições Realtime do Supabase em `Layout.tsx`:
  - Canal `public:app_c009c0e4f1_tickets` (INSERT) → novo ticket → `playNotificationSound()`.
  - Canal `public:app_c009c0e4f1_chat_messages` (INSERT) → nova mensagem (e não é do usuário atual) → `playNotificationSound(payload.new.ticket_id)`.

O hook usa `useTabVisibility()` e `useChatContext().activeChatId`. Com 100 ms de delay antes de decidir se toca o som, o estado da aba e do chat ativo já está atualizado.

---

### 2. Notificação na tela (toast)

- **Onde:** Sonner em `App.tsx` (`<Toaster position="top-right" ... />`), disparos em `Layout.tsx`.
- **Comportamento:**
  - **Novo ticket:** `toast.info('Novo ticket criado!', { action: { label: 'Ver', onClick: () => navigate('/tickets') } })`.
  - **Nova mensagem:** `toast.info('Nova mensagem recebida!', { action: { label: 'Ver', onClick: () => navigate(`/tickets/${ticket_id}`) } })`. O botão **Ver** leva para `/tickets/:ticketId` e a página de Tickets abre o chat desse ticket automaticamente.
- **Duração:** 4 segundos (configurado em `App.tsx`).
- **Quando a aba não está aberta:** o toast **é** criado no DOM assim que o evento Realtime chega; quando o usuário volta para a aba, ele só vê o toast se ainda estiver dentro dos 4 s. Se ficar muito tempo em outra aba, o toast pode já ter sumido.

Som e toast funcionam mesmo com a aba em segundo plano (usuário logado em outra aba do mesmo navegador); o toast pode “passar batido” se o usuário demorar a voltar.

**Observação:** O `Layout` mostra toast para **toda** nova mensagem de outro usuário, inclusive quando o chat daquele ticket está aberto. O `ChatModal` apenas evita lógica extra de toast local; o toast global do Layout continua aparecendo. Se quiser não mostrar toast quando o chat do ticket estiver aberto, seria necessário usar `ChatContext.activeChatId` no `Layout` e só chamar `toast.info` quando `payload.new.ticket_id !== activeChatId`.

---

### 3. Aba não visível, mas app aberto no navegador (logado)

- **Realtime:** as inscrições são globais no `Layout` (enquanto o usuário está logado). O Supabase mantém a conexão; quando a aba está em background, o navegador pode restringir timers e rede, mas em geral os eventos Realtime ainda chegam.
- **Som:** como `document.hidden === true`, `useTabVisibility()` retorna `false`, então `shouldPlaySound` fica `true` e o som **toca**.
- **Toast:** é exibido no DOM; ao voltar para a aba, o usuário vê o toast apenas se não tiver expirado (4 s).
- **Não implementado hoje quando a aba está em background:**
  - Atualização do **título da página** (ex.: “(1) Nova mensagem – Sistema”).
  - **Notificações push do navegador** (Push API).

---

## Fluxo resumido

| Situação                                  | Som   | Toast na tela                    |
|-------------------------------------------|-------|----------------------------------|
| Aba em segundo plano                      | Toca  | Sim (se voltar em ≤ 4 s)        |
| Aba visível, chat desse ticket aberto     | Não   | Sim (Layout sempre mostra)      |
| Aba visível, outro chat aberto            | Toca  | Sim                             |
| Aba visível, nenhum chat aberto           | Toca  | Sim                             |

---

## Arquivos envolvidos

| Arquivo | Função |
|---------|--------|
| `src/hooks/useNotificationSound.ts` | Decide se reproduz o som (aba visível + chat ativo). |
| `src/hooks/useTabVisibility.ts` | Expõe se a aba está visível (`document.hidden`). |
| `src/contexts/ChatContext.tsx` | Guarda `activeChatId` (qual chat está aberto). |
| `src/components/Layout.tsx` | Inscrição Realtime (tickets + mensagens), chama som e toast. |
| `src/App.tsx` | Renderiza `<Toaster>` (Sonner) e opções de toast. |
| `docs/notas-tecnicas/controle-som-notificacoes.md` | Documentação do controle de som. |

---

## Possíveis melhorias

1. **Toast só quando fizer sentido:** no `Layout`, ao receber nova mensagem, só exibir `toast.info` se `payload.new.ticket_id !== activeChatId` (evitar toast com o chat daquele ticket já aberto).
2. **Título da aba:** ao receber mensagem/ticket com aba em background, alterar `document.title` (ex.: “(1) Nova mensagem”) e restaurar ao voltar.
3. **Duração do toast:** aumentar um pouco (ex.: 6 s) ou manter toasts “não lidos” até o usuário voltar à aba (requer lógica extra).
4. **Push API:** para avisar quando a aba está fechada ou o navegador em segundo plano, exigiria serviço (ex.: Firebase Cloud Messaging ou Web Push no backend).
