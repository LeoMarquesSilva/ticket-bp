# Handoff técnico — Sidebar, layout full-bleed e densidade da tela de tickets

Documento para outra IA continuar o trabalho sem desfazer o que já foi feito.  
Projeto: **Responsum / ticket-bp-2026** (React + Vite + Tailwind + Radix).  
Data das mudanças: **2026-09-01**.  
Referência visual da navegação: **sidebar do ORQESTRAI** (escura, ícones no estado recolhido, labels no estado aberto, avatar no rodapé).

---

## 1. Objetivo

1. Tirar o header horizontal global (`Header.tsx`) e virar **sidebar esquerda**, no estilo ORQESTRAI.
2. Colocar o conteúdo **direto na tela** — sem container `max-w-[1760px]` / `max-w-7xl` na rota de tickets.
3. Evitar o bug antigo: chrome (header + filtros + header do chat + compositor) **comendo a altura** do notebook (~911px). A área de mensagens precisava de ~70% da viewport, não ~40%.
4. Sidebar recolhida = só ícone. Hover / aberta = logo completa + labels, **por cima** do conteúdo, sem empurrar o layout.
5. Header da página de tickets (`TicketHeader`) proporcional ao layout novo: uma linha só, botões `h-8`.

---

## 2. Arquitetura atual do shell

### Antes

```
div.flex.flex-col.min-h-screen
  Header (sticky top, h-16 + barra de 4px)
  main.pt-4
    div.container.max-w-7xl  |  div.max-w-[1760px]
      {children}
```

`--layout-chrome-height` = header + `pt-4`.  
`Tickets.tsx` usava `h-[calc(100dvh-var(--layout-chrome-height))]`.

### Agora

```
AppNavShell                    // src/components/AppSidebar.tsx
  aside overlay z-30           // fixed, hover-expand; modais ficam acima
  spacer lg:block              // 72px (recolhida) ou 248px (fixada aberta)
  column flex-1 min-h-0
    AppMobileTopBar            // só < lg
    main                       // tickets: overflow-hidden, sem padding
      {children}
    ConnectionStatus
```

`Layout.tsx` **não** renderiza mais `Header`. Importa `AppNavShell`.

```tsx
<AppNavShell>
  <main className={cn(
    'min-h-0 min-w-0 flex-1',
    isTicketsWorkspace ? 'overflow-hidden' : 'overflow-y-auto px-4 py-4 sm:px-6 lg:px-8'
  )}>
    {children}
  </main>
  <ConnectionStatus />
</AppNavShell>
```

`isTicketsWorkspace` = `location.pathname.startsWith('/tickets')`.

`src/index.css`:

```css
--layout-header-height: 0px;
--layout-main-padding-top: 0px;
--layout-chrome-height: 0px;
```

`Tickets.tsx` root:

```tsx
<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
```

**Não** voltar para `calc(100dvh - var(--layout-chrome-height))` enquanto o shell for `h-dvh` + `main.flex-1.min-h-0`.

`Header.tsx` e `LayoutNavigationWrapper.tsx` foram removidos depois da consolidação do shell novo.

---

## 3. Sidebar — contrato de comportamento

Arquivo: `src/components/AppSidebar.tsx`.  
Dependência de animação: **`framer-motion` já no `package.json`** (`^11.0.0`). Import: `from 'framer-motion'`.

### Constantes

| Nome | Valor | Uso |
|---|---|---|
| `STORAGE_KEY` | `responsum-nav-collapsed` | `'1'` recolhida, `'0'` fixada aberta |
| `COLLAPSED_WIDTH` | `72` | rail + ícones |
| `EXPANDED_WIDTH` | `248` | hover ou pin |
| `logoEase` | `[0.22, 1, 0.36, 1]` | logo e labels |

### Estados

- `collapsed` — preferência persistida. `true` = rail de 72px.
- `hovered` — mouse sobre a `<aside>`. Delay de saída **160ms**.
- `mobileOpen` — drawer no `< lg`.
- `menuOpen` — dropdown do usuário; impede recolher no hover-leave.
- `keyboardExpanded` — expande a rail quando a navegação recebe foco pelo teclado.
- `density` — preferência persistida (`comfortable` padrão ou `compact`).

```ts
showLabels = !collapsed || mobileOpen || hovered || menuOpen
hoverExpanded = collapsed && showLabels && !mobileOpen
railWidth = collapsed ? 72 : 248          // spacer no fluxo
sidebarWidth = showLabels ? 248 : 72      // largura visual da aside
```

### Overlay (obrigatório)

A aside **não** é `lg:static`. Recolhida + hover ela **abre por cima** do conteúdo.

```
div.hidden.lg:block.shrink-0          // spacer = railWidth (não pulsa no hover)
div.pointer-events-none.fixed.inset-y-0.left-0.z-30.w-0.overflow-visible
  aside.pointer-events-auto           // width = sidebarWidth
```

`z-30` — labels ficam acima do conteúdo e abaixo de overlays/modais (`z-50+`).

Não voltar para tooltip de item (`Categorias`, etc.) no estado ícone. O hover já mostra o nome.

### Pin

- Recolhida + hover: seta `»` = `setCollapsed(false)` (fixa aberta).
- Aberta fixada: seta `«` = `setCollapsed(true)`.
- Mobile: `X` fecha o drawer.

### Logo — regra rígida

| Estado | Asset | Tamanho |
|---|---|---|
| Recolhida (`!showLabels`) | `/assets/logotipo.png` | 40×40, só o símbolo |
| Aberta (hover **ou** pin) | `/assets/logo-horizontal.png` | `h-12`, max 188px, **centralizada** |

**Nunca** mostrar os dois ao mesmo tempo.  
Componente: `SidebarLogo` + `AnimatePresence mode="wait"`.

Header da sidebar:

- `h-[72px]`, `flex items-center justify-center`.
- Logo no centro.
- Botão recolher `absolute right-2 top-1/2 -translate-y-1/2` — não desloca a logo.

Arquivos em `public/assets/`:

- `logotipo.png` — existe (não usar `/favicon.svg` nem `/assets/logo.png`; `logo.png` 404 / devolve HTML).
- `logo-horizontal.png` — wordmark.
- `logo-bp.png` — rodapé, só com sidebar aberta.

### Nav

Itens (filtrados por `usePermissions`):

`Dashboard /dashboard` · `Tickets /tickets` · `Usuários /users` · `Categorias /categories` · `Configurações /settings` · `Permissões /users` (só se não tiver `manage_users`).

Ativo: `bg-[#F69F19] text-[#141516]`.  
`/tickets` e `/tickets/:id` são o mesmo item (`startsWith`).

Labels e bloco nome/email do usuário: `AnimatePresence` + `motion` (opacity + x).

### Mobile

- Barra `h-14` com hamburger + wordmark + avatar (`lg:hidden`).
- Aside `fixed` + backdrop `z-40`.
- Sem hover-expand no mobile.
- Drawer prende o foco, fecha com `Escape` e devolve o foco ao botão que o abriu.

### Tooltips globais

`src/components/ui/tooltip.tsx`: `z-[55]` no `TooltipContent`.  
Dropdown do perfil: `z-[60]` no desktop e `z-[80]` no drawer mobile.

### Preferências e contagem

- Sem preferência salva, a sidebar inicia recolhida abaixo de 1440px e aberta em monitores largos.
- O menu do perfil oferece densidade **Confortável** (padrão) e **Compacta**.
- A preferência fica em `responsum-interface-density`.
- O badge de tickets consulta a contagem inicial de `open / assigned / in_progress` e atualiza via Realtime; a RLS mantém a contagem no escopo do usuário.

---

## 4. Densidade / “não espremer o chat”

### Causa medida (notebook 1920×911)

Antes do compact, com chat aberto:

| Bloco | px | % |
|---|---|---|
| TicketHeader + filtros | 321 | 35% |
| Header do chat | 71 | |
| Mensagens | **367** | **40%** |
| Compositor | 152 | |

Depois:

| Bloco | px | % |
|---|---|---|
| TicketHeader (filtros fechados) | ~103 | |
| Header do chat | 59 | |
| Mensagens | **~642** | **~70%** |
| Compositor | ~107 | |

### Regras que sustentam isso

1. **`tall` em Tailwind = `min-height: 1100px`** (`tailwind.config.ts`, variante customizada).  
   Antes era `850px` e notebooks de 911px ganhavam `tall:py-5`, subtítulo, compositor `tall:p-4` e textarea `tall:min-h-[52px]`. **Não baixar de 1100.**

2. **`openChat` fecha filtros** e `closeChat` restaura a preferência anterior do usuário.

3. **`TicketHeader` compacto** (`src/components/TicketHeader.tsx`):
   - Faixa escura: **uma linha**, `py-2 px-3 sm:px-4`, título `text-[15px]`, sem subtítulo, sem blurs.
   - Botões (`Equipe Online`, `Novo Ticket`, `+ Ticket`, filtros): `h-8`, `text-xs`, `px-2.5`.
   - `Equipe Online` não pode voltar a ~242px de largura.
   - Toolbar branca: `py-1.5`, badges `text-[11px]`, view toggles `h-8 w-8`.
   - A prop residual `compact` foi removida; a densidade agora vem da preferência global.

4. **`TicketChatPanel`**:
   - Header do chat: `py-1.5`, título `text-sm`.
   - Mensagens: **`div` nativo** `overflow-y-auto custom-scrollbar [scrollbar-gutter:stable]` — **não** voltar `ScrollArea` do Radix (quebra wrap / `display:table`).
   - `space-y-3` entre mensagens (não `space-y-6`).
   - Compositor: `p-2`, controles orientados pela densidade, textarea `text-base min-h-[44px]` e botão de envio com alvo confortável.
   - Sem faixa “Enter envia…”. Hint no `title` do botão enviar.

5. Na visualização em lista, usuários de uma única frente veem `Categoria → Tickets`. Usuários com `view_all_tickets` (admin/gestor) ou acesso explícito a mais de uma frente veem `Frente de atuação → Categoria → Tickets`.

   - Frentes fechadas mantêm cards altos com badges de categorias e tickets. Ao abrir, a frente ocupa toda a largura e seu cabeçalho fica compacto, com nome, ícone, contadores e ação de recolher.
   - Categorias usam cards com nomes de até duas linhas e badge textual de tickets. `TicketCategoryGrid` mede sua largura real: uma coluna abaixo de 576px, duas a partir de 576px e três a partir de 992px. Com chat aberto, sempre uma coluna.
   - Os cards de categorias permanecem na mesma ordem e posição ao expandir. Os painéis de tickets ocupam toda a largura logo abaixo da linha correspondente. Várias categorias podem permanecer abertas; não usar `grid-auto-flow: dense` nem encaixar tickets dentro de uma coluna estreita de categoria.
   - “Expandir categorias”/“Recolher categorias” atua somente na frente correspondente, preservando as outras. Os controles mantêm teclado, foco visível e `aria-expanded`/`aria-controls`. A expansão manual preserva a posição vertical do botão clicado, dentro dos limites da rolagem.
   - Filtrar uma frente abre somente o nível da frente, sem forçar a abertura das categorias. Busca, filtro de categoria e abertura direta de um ticket revelam o caminho até os tickets. Categorias abertas manualmente são preservadas. As ações globais “Expandir todas” e “Recolher todas” continuam disponíveis.
   - Ícone: primeiro o cadastro, depois inferência pela chave/nome e, sem correspondência, maleta neutra. LAB usa laboratório, Controladoria usa checklist e MKT usa megafone. O cadastro permite escolher o ícone e a administração usa a mesma identidade visual.
   - Categorias legadas continuam visíveis com rótulo legível, tickets sem categoria ficam em “Sem categoria” e categorias sem vínculo ficam em “Sem frente de atuação”. Contadores refletem os tickets visíveis após os filtros.

6. Lista com chat aberto: `TicketList` `isChatOpen` → 1 coluna dentro da categoria.  
   Sem chat: 1–4 colunas por **container query**, usando a largura real restante após a sidebar.

7. Cards: padding e metadados respondem à densidade; datas aparecem na visualização sem chat.

---

## 5. Dashboard (contexto da mesma linha de trabalho)

Ainda vale se a outra IA for no dashboard:

- `RankedBarRow` em `Dashboard.tsx` com `UserAvatar` (Top Solicitantes, Tempo de Resposta por Atendente).
- `dashboardService.tsx` devolve `userId` / `avatarUrl` em `topUsers` e `responseTimeByAgent`.
- Categorias: slug cru no service; `getCategoryLabel` no front (`replace(/_/g, ' ')`); merge de duplicatas tipo “Outros”.
- `ExpandableFeedbackCell` + `ResizeObserver` para “Ver mais” quando `line-clamp` estoura (não por contagem de caracteres).
- Modal de chat do dashboard / `RecentFeedbackList`: mesmo padrão de scroll nativo + `formatChatMessageText` (normaliza `\n` do Outlook).
- Feedback Pendente: avatar do atendente (`assignedTo`, `assignedToName`, `assignedToAvatarUrl`).

---

## 6. Arquivos tocados (esta linha)

| Arquivo | O quê |
|---|---|
| `src/components/AppSidebar.tsx` | Shell + sidebar hover/foco + densidade + badge real + drawer acessível |
| `src/components/Layout.tsx` | `AppNavShell`, tickets full-bleed |
| `src/components/TicketHeader.tsx` | Controles acessíveis e estatísticas responsivas à largura disponível |
| `src/components/TicketChatPanel.tsx` | Chrome do chat + scroll nativo |
| `src/components/TicketList.tsx` | Frentes/categorias expansíveis, contadores e grid de 1–4 colunas por container query |
| `src/components/TicketCategoryGrid.tsx` | Categorias em linhas responsivas estáveis, com painéis de tickets em largura total abaixo da linha |
| `src/components/FrenteIcon.tsx` | Vocabulário visual compartilhado e ícones semânticos das frentes |
| `src/components/categories/FrenteFormDialog.tsx` | Escolha do ícone ao criar ou editar uma frente |
| `src/components/categories/FrentesTab.tsx` | Identidade visual da frente na administração |
| `src/utils/ticketCategoryGroups.ts` | Hierarquia frente/categoria, ordem, rótulos e ícones de fallback e expansão automática |
| `src/components/TicketFilters.tsx` | Padding menor |
| `src/pages/Tickets.tsx` | `h-full`, fecha/restaura filtros e define o container do workspace |
| `src/pages/Profile.tsx` | Tirou `min-h-screen` (evita scroll duplo) |
| `src/index.css` | Densidade, tamanhos mínimos, container queries e redução de movimento |
| `src/components/ui/tooltip.tsx` | camada compatível com sidebar e modais (`z-[55]`) |
| `tailwind.config.ts` | `tall` = 1100px |
| `src/pages/Dashboard.tsx` | Avatares, expand, chat modal |
| `src/services/dashboardService.tsx` | Enriquecimento de avatar / slugs |
| `src/components/RecentFeedbackList.tsx` | Chat modal alinhado ao dashboard |

`src/components/Header.tsx` e `LayoutNavigationWrapper.tsx` — removidos.

---

## 7. Assets

```
public/assets/logotipo.png          # ícone (sidebar recolhida)
public/assets/logo-horizontal.png   # wordmark (sidebar aberta)
public/assets/logo-bp.png           # rodapé sidebar aberta
public/assets/logo-bp-azul.png      # login
```

Não usar `/assets/logo.png` (não existe de verdade).

---

## 8. O que não desfazer

- Religar `Header` no topo.
- Container `max-w-*` em `/tickets`.
- `tall` < 1100px.
- Tooltip de nav no lugar do hover-expand.
- Logo pequena + wordmark juntos no estado aberto.
- `ScrollArea` Radix na lista de mensagens do ticket.
- Sidebar `lg:static` + `z-auto` (labels atrás da lista).
- Abrir chat mantendo o painel de filtros aberto por padrão.
- Usar faixa ou borda vertical colorida à esquerda de cards, frentes ou categorias. A hierarquia deve vir de tipografia, espaçamento e superfícies; a cor da frente pode aparecer apenas como marcador pequeno junto ao ícone.

---

## 9. Como validar

Notebook ~1920×911, sidebar recolhida (72px):

1. Hover ou foco na sidebar → largura 248, wordmark centralizado `h-12`, items com texto, overlay sobre a lista. Soltar o mouse/sair com foco → volta a 72 sem pular o conteúdo.
2. `/tickets` → faixa “Tickets de Suporte” legível; controles de 40px na densidade confortável, 36px na compacta e mínimo de 44px em telas touch/estreitas.
3. Visualização em lista com usuário comum/de uma frente → categorias aparecem recolhidas com seus contadores; clique, `Enter` ou `Espaço` expande os cards.
4. Visualização em lista com admin/gestor ou usuário de múltiplas frentes → cada frente mostra quantidade de categorias e tickets; ao expandir, compacta o cabeçalho e revela a grade de categorias. Abrir a segunda categoria não deve deslocar os cards vizinhos. Ações locais não devem afetar outras frentes. Filtrar uma frente revela somente suas categorias; buscar ou filtrar uma categoria revela os tickets correspondentes.
5. Abrir um ticket → frente e categoria permanecem expandidas, filtros fecham; mensagens ≥ ~60% da viewport; compositor ~100–110px; texto das bolhas não quebra por `table` do ScrollArea.
6. `/dashboard` → sidebar igual; conteúdo com padding do `main` (não full-bleed).
7. `< lg` → hamburger + drawer; sem hover; `Tab` fica no drawer e `Escape` fecha.

---

## 10. Validação automatizada executada

- `npm test`: **41 arquivos e 289 testes aprovados**.
- `npx tsc --noEmit -p tsconfig.app.json`: **9 erros de tipagem fora da alteração de expansão**, em `TicketChatPanel.tsx`, `useNotificationOrchestrator.ts`, upload de `Tickets.tsx`, `dashboardService.tsx`, `pushService.ts` e `ticketCommunicationSettingsService.test.ts`. Nenhum erro apontado em `TicketCategoryGrid.tsx`, `TicketList.tsx` ou `ticketCategoryGroups.ts`. O comando sem `-p` não substitui esta validação: o `tsconfig.json` raiz tem `files: []`.
- ESLint do escopo alterado: **0 erros**; permanecem 8 avisos históricos de dependências de hooks em `Tickets.tsx`.
- `npm run build`: aprovado; 4.942 módulos transformados e assets estáticos copiados para `dist`. Permanece o aviso de bundle maior que 500 kB.
- `git diff --check`: aprovado.
- CSS compilado: variante `tall` presente, 4 container queries presentes e nenhuma variante quebrada de 380px.

Validação visual local em 1366×900, 900×900 e 390×844, usando os componentes reais `TicketList`/`SimpleTicketCard` com dados fictícios: grades de 3/2/1 colunas, tickets em largura total, posição do card preservada ao expandir, teclado, ausência de overflow horizontal, expansão local independente entre frentes, filtro de frente sem abrir categorias, busca abrindo o caminho e chat em coluna única. A página temporária de validação foi removida.

Como conferência de aceite, ainda é recomendável navegar com um usuário real, pois dados e permissões dependem da sessão autenticada; a validação local não substitui esse cenário.
