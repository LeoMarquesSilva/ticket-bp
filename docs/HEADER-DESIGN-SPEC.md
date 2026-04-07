# Especificação de Design do Header (sem cores)

Documento de referência com todas as informações de layout, tipografia, espaçamento e estrutura do header atual, para replicação ou ajuste em outro sistema. **Cores não estão incluídas.**

---

## 1. Estrutura geral

- **Elemento raiz:** `<header>`
- **Posicionamento:** `sticky top-0` (fixo no topo ao rolar)
- **Z-index:** `50`
- **Largura:** `w-full` (100%)
- **Sombra:** `shadow-lg`

---

## 2. Barra superior (faixa no topo)

- **Altura:** `h-1` (4px)
- **Largura:** `w-full`
- **Função visual:** Faixa fina contínua no topo (gradiente no sistema original; pode ser substituído por uma linha ou barra sólida em outro sistema).

---

## 3. Container principal

- **Classe:** `container`
- **Comportamento do container (Tailwind):** `center: true`, `padding: 2rem` (32px), `max-width` em breakpoint `2xl: 1400px`
- **Layout:** `flex`
- **Altura:** `h-16` (64px)
- **Alinhamento vertical:** `items-center`

---

## 4. Logo principal

- **Margem à direita:** `mr-6` (24px)
- **Layout:** `flex items-center`
- **Comportamento:** Área clicável (cursor pointer) para navegação (ex.: para “/tickets”).
- **Envoltório do logo:**
  - `relative`
  - Efeito atrás do logo: `absolute inset-0`, `rounded-full`, `blur-lg` (brilho/diffuse)
- **Imagem do logo:**
  - Altura: `h-12` (48px)
  - Largura: `w-auto` (proporcional)
  - Posição: `relative` (acima do efeito de brilho)
- **Borda do avatar (referência):** `border-2` (no sistema atual usa token de cor; em outro sistema usar apenas espessura).

---

## 5. Navegação (desktop)

- **Exibição:** `hidden md:flex` (oculto em mobile, flex a partir de `md`)
- **Flex:** `flex-1` (ocupa espaço entre logo e área direita)
- **Alinhamento:** `items-center justify-center`
- **Espaçamento entre itens:** `space-x-2` (8px)

**Item de link (NavLink):**

- **Layout:** `flex items-center`
- **Padding:** `px-4 py-2` (16px horizontal, 8px vertical)
- **Border radius:** `rounded-md` (6px no Tailwind padrão; no projeto `--radius` = 0.5rem, `md` = calc(var(--radius) - 2px))
- **Tipografia:** `text-sm font-medium`
- **Transição:** `transition-all duration-200`
- **Estado ativo:** `shadow-md` (sombra média)
- **Conteúdo do link:**
  - Ícone + texto: `flex items-center gap-2` (8px entre ícone e texto)
  - Ícones: `h-5 w-5` (20px)
  - Badge (contador): `ml-1` (4px à esquerda), `animate-pulse` opcional para destaque

---

## 6. Badge (contador no nav)

- **Variante:** `gradient` (no sistema atual); em outro sistema usar um estilo de destaque.
- **Tamanho:** `size="sm"` → no componente Badge: `h-4 text-[10px] px-1.5`
- **Posição:** `ml-1` em relação ao texto do item.

---

## 7. Bloco de status online/offline (desktop)

- **Exibição:** `hidden md:flex`
- **Layout:** `items-center`
- **Margem à direita:** `mr-4` (16px)
- **Envoltório:**
  - Padding: `py-1.5 px-4` (6px vertical, 16px horizontal)
  - Border radius: `rounded-md`
  - Sombra: `shadow-inner` + intensidade equivalente a `shadow-black/20`
- **Conteúdo:** Toggle de status (ícone + switch + label).
  - Ícones: `h-4 w-4`
  - Label: `text-sm`
- **Exibido apenas para perfis “staff” (ex.: support/lawyer).**

---

## 8. Logo do cliente (ex.: BP)

- **Exibição:** `hidden md:flex`
- **Layout:** `items-center`
- **Margem:** `mr-4 pl-4` (16px direita, 16px esquerda)
- **Separador:** `border-l` (1px), altura `h-10` (40px) para alinhar à barra
- **Imagem:**
  - Altura: `h-8` (32px)
  - Largura: `w-auto`
  - `object-contain`
  - Transição de opacidade no hover: `opacity-90 hover:opacity-100 transition-opacity`

---

## 9. Área do usuário (avatar + dropdown)

**Envoltório:**

- **Layout:** `flex items-center gap-2` (8px entre avatar e botão mobile)

**Botão do avatar (trigger do dropdown):**

- **Variante:** `ghost`
- **Dimensões:** `h-10 w-10` (40px)
- **Border radius:** `rounded-full`
- **Overflow:** `overflow-hidden`
- **Hover:** `hover:scale-105`, `transition-all duration-200`
- **Avatar dentro do botão:**
  - Tamanho: `size="md"` → `h-8 w-8` (32px); no Header está `h-9 w-9` (36px) por classe
  - Borda: `border-2`
- **Camada decorativa atrás do avatar (opcional):** `absolute inset-0`, `opacity-20`, `animate-pulse-slow` (animação suave)

**Dropdown (menu do usuário):**

- **Largura:** `w-80` (320px) + `minWidth: 320px` em estilo inline
- **Alinhamento:** `align="end"`, `side="bottom"`
- **Offset:** `sideOffset={8}` (8px abaixo do trigger), `alignOffset={0}`
- **Colisão:** `avoidCollisions={true}`, `collisionPadding={20}`
- **Sombra:** `shadow-xl`
- **Faixa superior do dropdown:** `h-1 w-full` (mesma altura da barra do header)
- **Área do perfil no dropdown:**
  - Padding: `p-4` (16px)
  - Layout: `flex items-start gap-3` (12px)
  - Avatar: `h-10 w-10` (40px), `border-2`, `flex-shrink-0`
  - Nome: `text-sm font-medium leading-none`, `truncate`
  - Email: `text-xs leading-none`, `mt-1`, `break-all`
  - Badge de role: `mt-2`, `w-fit`
- **Separadores:** entre seções (ex.: Departamento, Status, Meu Perfil, Sair)
- **Itens de menu:**
  - Padding: `px-4 py-2.5` (16px horizontal, 10px vertical)
  - Ícones: `h-4 w-4`, `mr-2` (8px à direita do ícone)
- **Seção “Departamento” (se existir):** `px-4 py-2`; label `text-xs`, `mb-1`
- **Seção “Status” (staff):** `px-4 py-2`; mesmo padding e label `text-xs`, `mb-1`

---

## 10. Botão do menu mobile (hambúrguer)

- **Exibição:** `md:hidden` (apenas em viewports menores que `md`)
- **Variante:** `ghost`
- **Tamanho:** `size="sm"`
- **Ícones:** `h-5 w-5` (Menu / X)
- **Transição:** `transition-colors` (para hover/focus)

---

## 11. Menu mobile (painel expandido)

- **Exibição:** `md:hidden`; visível quando `mobileMenuOpen === true`
- **Borda superior:** `border-t` (1px)
- **Backdrop:** `backdrop-blur-md`
- **Sombra:** `shadow-lg`
- **Container interno:** `container`, `py-3`, `space-y-2` (12px vertical entre blocos)

**Logo do cliente no mobile:**

- `flex justify-center py-2 mb-2`
- `border-b` (1px), opacidade reduzida na imagem (ex.: 80%)
- Imagem: `h-8 w-auto`

**Links do menu mobile:**

- Mesmo padrão de link do desktop: `flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200`
- Conteúdo: `gap-3` (12px entre ícone e texto), ícones `h-5 w-5`
- Badge: mesmo que desktop (`size="sm"`, `ml-1`, `animate-pulse` opcional)

**Botão “Meu Perfil” (mobile):**

- `w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium`, `transition-all duration-200`
- Conteúdo: `gap-3`, ícone `h-5 w-5`

**Bloco de status (staff) no mobile:**

- `px-4 py-3 flex items-center justify-between`, `rounded-md mt-2` (8px acima)
- Label: `text-sm font-medium`

**Botão “Sair” (mobile):**

- `w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium`, `mt-2`
- Conteúdo: `gap-3`, ícone `h-5 w-5`

---

## 12. Tipografia (referência geral)

- **Fonte do projeto:** Montserrat, sans-serif (`fontFamily.sans` no Tailwind).
- **Tamanhos usados no header:**
  - `text-xs`: 12px (email, labels no dropdown, badge sm)
  - `text-sm`: 14px (links de nav, botões do menu mobile, labels)
  - `text-sm font-medium`: links e botões
- **Pesos:** `font-medium` (500) para itens de navegação e ações.
- **Line-height:** `leading-none` onde o design exige linha mais compacta (ex.: nome e email no dropdown).

---

## 13. Espaçamento resumido (valores em px)

| Token / Classe | Valor (px) |
|----------------|------------|
| Container padding | 32 (2rem) |
| Altura do header | 64 (h-16) |
| Barra superior | 4 (h-1) |
| Logo principal altura | 48 (h-12) |
| mr-6 (logo) | 24 |
| space-x-2 (nav) | 8 |
| px-4 py-2 (link nav) | 16 / 8 |
| gap-2 (ícone + texto) | 8 |
| Ícones nav | 20 (h-5 w-5) |
| mr-4 (status, logo BP) | 16 |
| py-1.5 px-4 (status box) | 6 / 16 |
| Logo cliente altura | 32 (h-8) |
| pl-4 border-l (logo cliente) | 16 |
| gap-2 (avatar + menu mobile) | 8 |
| Botão avatar | 40×40 (h-10 w-10) |
| Avatar no header | 36×36 (h-9 w-9) |
| sideOffset dropdown | 8 |
| collisionPadding | 20 |
| Dropdown min-width | 320 |
| p-4 (área perfil dropdown) | 16 |
| gap-3 (avatar + dados) | 12 |
| Avatar no dropdown | 40×40 (h-10 w-10) |
| px-4 py-2.5 (itens menu) | 16 / 10 |
| Ícones dropdown | 16 (h-4 w-4) |
| mr-2 (ícone em item) | 8 |
| py-3 space-y-2 (menu mobile) | 12 / 8 entre itens |
| py-2.5 (links mobile) | 10 |
| gap-3 (mobile) | 12 |

---

## 14. Border radius

- **Projeto (CSS):** `--radius: 0.5rem` (8px).
- **Uso no header:**
  - Links e botões do menu: `rounded-md` (6px no tema: calc(var(--radius) - 2px)).
  - Badge: `rounded-full`.
  - Botão do avatar: `rounded-full`.
  - Caixa de status: `rounded-md`.
  - Efeito atrás do logo: `rounded-full`.

---

## 15. Sombras

- **Header:** `shadow-lg`
- **Link ativo:** `shadow-md`
- **Dropdown:** `shadow-xl`
- **Caixa de status (desktop):** `shadow-inner` + equivalente a 20% de opacidade
- **Menu mobile:** `shadow-lg`

(Valores exatos de cor das sombras não especificados; usar as classes ou equivalentes em outro sistema.)

---

## 16. Transições e animações

- **Links e botões:** `transition-all duration-200` (200ms).
- **Botão avatar hover:** `transition-all duration-200`, escala 105%.
- **Logo cliente:** `transition-opacity` no hover.
- **Badge (contador):** `animate-pulse` (opcional).
- **Camada decorativa atrás do avatar:** `animate-pulse-slow` (opcional).

---

## 17. Breakpoints

- **md:** navegação desktop, status, logo do cliente e avatar visíveis; botão hambúrguer oculto.
- **&lt; md:** botão hambúrguer visível; nav, status e logo do cliente ocultos na barra; menu expandido abaixo com os mesmos itens.

Breakpoint `md` no Tailwind padrão: **768px**.

---

## 18. Z-index

- **Header:** `z-50` para ficar acima do conteúdo.

---

## 19. Ordem dos elementos (esquerda → direita no desktop)

1. Logo principal (clicável)
2. Nav (flex-1, centralizado)
3. Status online (se staff)
4. Logo do cliente (BP)
5. Avatar + dropdown
6. Botão menu mobile (apenas &lt; md)

No menu mobile (vertical):

1. Logo do cliente
2. Links de navegação
3. Meu Perfil
4. Status (se staff)
5. Sair

---

## 20. Acessibilidade e conteúdo

- **Logo principal:** `alt="RESPONSUM"` (ou equivalente).
- **Logo cliente:** `alt="BP"` (ou equivalente), `title="Ambiente BP"` (ou equivalente).
- **Avatar:** usar nome do usuário para fallback/initials e acessibilidade.
- **Dropdown:** `forceMount` no Radix; garantir foco e teclado conforme padrão do componente usado.
- **Menu mobile:** fechar ao escolher um link ou ação (ex.: `onClick` que define `mobileMenuOpen(false)`).

---

*Documento gerado a partir do componente `Header.tsx` e do sistema de design do projeto. Cores omitidas conforme solicitado.*
