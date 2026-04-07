# Sistema de Login do Sistema de Tickets

Este documento descreve como foi criado o sistema de login do sistema de tickets, quais recursos do **Supabase** são utilizados e como eles se integram à aplicação.  
**Objetivo:** servir como guia completo para **replicar** esse mesmo padrão de login em outro sistema (React/Vite + Supabase).

---

## Índice (replicação rápida)

- [Linguagens e tecnologias](#linguagens-e-tecnologias)
- [Visão geral](#visão-geral)
- [O que foi utilizado no Supabase](#o-que-foi-utilizado-no-supabase)
- [Guia de replicação](#guia-de-replicação) — pré-requisitos, env, SQL, arquivos, checklist Supabase, ordem de implementação
- [Fluxos detalhados](#fluxo-de-login-passo-a-passo) — login, registro, logout, reset e troca de senha
- [Armadilhas e dicas](#armadilhas-e-dicas)

---

## Linguagens e tecnologias

Stack utilizada neste sistema de tickets (para replicação em outro projeto, alinhe ao mesmo ou equivalente):

| Camada | Linguagem / tecnologia |
|--------|--------------------------|
| **Frontend (app)** | **TypeScript** + **React** (JSX/TSX) |
| **Build / bundler** | **Vite** 5.x |
| **Estilos** | **CSS** (global + módulos), **Tailwind CSS** 3.x, **PostCSS** |
| **Roteamento** | **React Router** (react-router-dom) 6.x |
| **Backend / API serverless** | **Node.js** (**JavaScript**) — ex.: `api/send-push.js` |
| **Banco / Auth** | **Supabase** (PostgreSQL + Auth); consultas via cliente JS/TS |
| **Gerenciador de pacotes** | **pnpm** (ou npm/yarn) |

**Resumo:** o núcleo da aplicação é **TypeScript** e **React** (`.ts` e `.tsx`), com **Vite** para build, **Tailwind** para UI e **Supabase** para banco e autenticação. Qualquer script ou API auxiliar pode ser em **JavaScript** (`.js`).

---

## Visão geral

O login utiliza **Supabase Auth** para autenticação (credenciais, sessão, tokens) e uma **tabela própria de usuários** no banco (`app_c009c0e4f1_users`) para perfil da aplicação (nome, papel, departamento, preferências, etc.). O vínculo entre os dois é a coluna **`auth_user_id`**, que armazena o UUID do usuário em `auth.users` do Supabase.

---

## O que foi utilizado no Supabase

### 1. **Supabase Auth (Authentication)**

- **Login com e-mail e senha**: `supabase.auth.signInWithPassword({ email, password })`
- **Registro**: `supabase.auth.signUp({ email, password, options: { data: { name } } })`
- **Logout**: `supabase.auth.signOut()`
- **Sessão**: `supabase.auth.getSession()` e `supabase.auth.getUser()`
- **Refresh de token**: automático via `autoRefreshToken: true`
- **Recuperação de senha**:
  - Envio do e-mail: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
  - Definição da nova senha: `supabase.auth.updateUser({ password })` (após validar o link)
- **Detecção de sessão na URL**: usada no fluxo de reset de senha (link no e-mail)
- **Fluxo PKCE**: `flowType: 'pkce'` no cliente para maior segurança

Ou seja: **credenciais, sessão, tokens e recuperação de senha** ficam 100% no Supabase Auth.

### 2. **Tabela de usuários da aplicação**

- **Nome da tabela**: `app_c009c0e4f1_users`
- **Função**: guardar dados de negócio do usuário (nome, papel, departamento, preferências, primeiro login, etc.).
- **Vínculo com o Auth**: coluna **`auth_user_id`** (UUID que referencia `auth.users.id`).

Campos relevantes para o login/fluxo de senha:

| Campo                    | Tipo      | Uso |
|--------------------------|-----------|-----|
| `id`                     | uuid (PK) | ID do usuário na aplicação |
| `auth_user_id`           | uuid      | ID do usuário no Supabase Auth (`auth.users.id`) |
| `email`                  | text      | E-mail (espelho do Auth) |
| `name`                  | text      | Nome exibido |
| `role`                  | text      | user, support, admin, lawyer |
| `department`            | text      | Departamento |
| `is_active`             | boolean   | Se o usuário pode logar |
| `first_login`           | boolean   | Primeiro acesso (força troca de senha) |
| `must_change_password`  | boolean   | Obriga alteração de senha |
| `password_changed_at`   | timestamp | Última alteração de senha |
| `is_online` / `last_active_at` | -   | Status de presença |
| `ticket_view_preference`| text      | Preferência de visualização (list/board/users) |

O **login** só é considerado válido se existir sessão no Auth **e** um registro correspondente nessa tabela (com `auth_user_id` ou e-mail) e com `is_active = true`.

### 3. **Configuração do cliente Supabase**

Arquivo: `src/lib/supabase.ts`

- **URL e chave**: `supabaseUrl` e `supabaseAnonKey` (chave anônima, segura no front).
- **Auth**:
  - `persistSession: true` — sessão persistida no navegador
  - `autoRefreshToken: true` — renovação automática do token
  - `detectSessionInUrl: true` — para o link de reset de senha funcionar
  - `storage: customStorage` — localStorage com prefixo por instância (evita conflito entre abas/ambientes)
  - `flowType: 'pkce'` — fluxo PKCE para auth
- **Tabelas**: constante `TABLES` com o nome real da tabela de usuários (`TABLES.USERS`).

---

## Fluxo de login (passo a passo)

1. **Tela de login** (`src/pages/Login.tsx`)
   - Usuário informa e-mail e senha e chama `login(email, password)` do `AuthContext`.

2. **AuthContext** (`src/contexts/AuthContext.tsx`)
   - Chama `supabase.auth.signInWithPassword({ email, password })`.
   - Se der erro, retorna a mensagem (ex.: “Invalid login credentials”).
   - Se sucesso, recebe `data.user` (Auth user) e chama `loadUserProfile(data.user.id)`.

3. **Carregamento do perfil**
   - Busca na tabela `app_c009c0e4f1_users`:
     - Primeiro por `auth_user_id = data.user.id`.
     - Se não achar, fallback por `email = data.user.email` e, ao encontrar, atualiza `auth_user_id` para esse usuário.
   - Verifica `is_active`; se inativo, faz `signOut` e bloqueia o login.
   - Monta o objeto `User` (id, name, email, role, department, firstLogin, mustChangePassword, etc.) e guarda no estado e no `sessionStorage` (cache de 24h).

4. **Redirecionamento e rotas**
   - O `App.tsx` usa `useAuth()`. Se há `user`, as rotas protegidas são liberadas; se não há, redireciona para `/login`.
   - Rotas protegidas usam o componente `ProtectedRoute`, que verifica permissões por papel/permissão e redireciona para a primeira rota permitida quando não tem acesso.

5. **Listener de auth**
   - `supabase.auth.onAuthStateChange` escuta `SIGNED_IN` e `SIGNED_OUT`:
     - Em `SIGNED_IN`: chama `loadUserProfile` com o `user.id` do Auth.
     - Em `SIGNED_OUT`: chama `handleLogout()` (limpa estado e storage).

---

## Fluxo de registro

1. Inserção na tabela de usuários **antes** de criar o usuário no Auth:
   - `supabase.from(TABLES.USERS).insert({ name, email, role: 'user', department: 'Geral', is_online: false, is_active: true, first_login: true, must_change_password: true }).select().single()`.
2. Com o registro criado, chama `supabase.auth.signUp({ email, password, options: { data: { name } } })`.
3. Se o signUp falhar, o registro na tabela é removido (`delete().eq('id', directProfile.id)`).
4. Se o signUp ok, atualiza o usuário na tabela com `auth_user_id: authData.user.id`.
5. O usuário é colocado no estado com `firstLogin: true` e `mustChangePassword: true`, e o `PasswordChangeHandler` exibe o modal de alteração de senha.

---

## Fluxo de logout

1. Atualiza na tabela `app_c009c0e4f1_users`: `is_online: false` onde `id = user.id`.
2. Chama `supabase.auth.signOut()`.
3. Remove dados do usuário do `sessionStorage` e limpa chaves de token no `localStorage` (prefixo `sb-` e `auth-token`).
4. Chama `handleLogout()` (estado `user = null`, etc.).

---

## Recuperação de senha (reset)

### Solicitar e-mail de redefinição

- Na tela de login há opção “Esqueci minha senha”, que chama `resetPassword(email)` no `AuthContext`.
- Verifica se o e-mail existe na tabela `app_c009c0e4f1_users`; se não existir, retorna mensagem amigável (ex.: “E-mail não encontrado no sistema”).
- URL de redirecionamento: `VITE_SITE_URL` ou `window.location.origin`, com path `/reset-password`.
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl })`.
- O Supabase envia o e-mail usando o template configurado no painel (Authentication > Email Templates > Reset Password).

### Redefinir a senha (página `/reset-password`)

- Página: `src/pages/ResetPassword.tsx`.
- O link do e-mail pode trazer parâmetros na URL (ex.: `access_token`, `refresh_token`, ou `token_hash` + `type=recovery`, ou `code` no fluxo PKCE).
- A página:
  - Lê os parâmetros da URL (query e hash).
  - Tenta estabelecer sessão, por exemplo com:
    - `supabase.auth.setSession({ access_token, refresh_token })`, ou
    - `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`, ou
    - `supabase.auth.exchangeCodeForSession(code)` (quando aplicável).
  - Se conseguir sessão, considera o link válido e permite informar a nova senha.
  - Ao submeter, chama `passwordService.resetPassword(newPassword)`:
    - Verifica sessão com `supabase.auth.getSession()`.
    - Atualiza a senha no Auth: `supabase.auth.updateUser({ password: newPassword })`.
    - Atualiza na tabela `app_c009c0e4f1_users`: `password_changed_at`, `must_change_password: false`, `first_login: false` (por `auth_user_id`).

Configurações importantes no Supabase para esse fluxo:

- **Authentication > URL Configuration**: Site URL e Redirect URLs devem incluir a URL da sua aplicação (ex.: `https://seusite.com/reset-password`).
- **Authentication > Email Templates**: template “Reset Password” usando `{{ .ConfirmationURL }}` no link.
- Variável de ambiente `VITE_SITE_URL` no projeto para montar a URL de redirect correta (ver `docs/email-templates/CORRECAO-URL-RESET-PASSWORD.md`).

---

## Alteração de senha (usuário já logado)

- Serviço: `src/services/passwordService.ts` (método `changePassword(currentPassword, newPassword)`).
- Usado no perfil e no modal de “primeiro login / deve alterar senha”.
- Fluxo:
  - Obtém sessão com `supabase.auth.getSession()`.
  - Busca o usuário na tabela por `auth_user_id` (ou e-mail como fallback).
  - Se não for primeiro login nem `must_change_password`, valida a senha atual via API REST do Supabase (`/auth/v1/token?grant_type=password`).
  - Chama `supabase.auth.updateUser({ password: newPassword })`.
  - Atualiza na tabela: `password_changed_at`, `must_change_password: false`, `first_login: false` por `auth_user_id`.

---

## Primeiro login e obrigação de trocar senha

- Campos na tabela: `first_login`, `must_change_password`, `password_changed_at`.
- No `AuthContext`, a função `checkPasswordChangeRequired(user)` define se o usuário “precisa trocar senha” (primeiro login, `must_change_password` ou ausência de `password_changed_at`).
- O componente `PasswordChangeHandler` (`src/components/PasswordChangeHandler.tsx`) envolve as rotas da aplicação e, quando `requiresPasswordChange` é true, exibe o `ChangePasswordModal`.
- No primeiro login ou quando `must_change_password` é true, o usuário não pode dispensar o modal; após alterar a senha, o serviço atualiza a tabela e o `refreshUserProfile()` atualiza o estado, escondendo o modal.

---

## Resumo do que o Supabase fornece

| Recurso Supabase        | Uso no sistema de tickets |
|-------------------------|----------------------------|
| **Auth: signInWithPassword** | Login com e-mail/senha |
| **Auth: signUp**        | Registro de novo usuário |
| **Auth: signOut**       | Logout |
| **Auth: getSession / getUser** | Verificar sessão e carregar perfil |
| **Auth: onAuthStateChange**   | Sincronizar estado da app com login/logout |
| **Auth: resetPasswordForEmail** | E-mail de recuperação de senha |
| **Auth: updateUser({ password })** | Nova senha (reset e troca logado) |
| **Auth: setSession / verifyOtp / exchangeCodeForSession** | Validar link de reset na página `/reset-password` |
| **Auth: persistSession + autoRefreshToken** | Manter usuário logado e renovar token |
| **Auth: detectSessionInUrl** | Processar parâmetros do link de reset na URL |
| **Auth: flowType pkce** | Fluxo de autorização mais seguro |
| **Tabela app_c009c0e4f1_users** | Perfil do usuário (nome, role, departamento, primeiro login, troca de senha, ativo, etc.) |
| **Coluna auth_user_id** | Ligação entre `auth.users` e a tabela de usuários da aplicação |

O sistema de login foi construído assim: **Supabase Auth** para identidade e senha; **tabela própria de usuários** para tudo que é específico do sistema de tickets (papéis, departamentos, preferências e regras de primeiro login e troca de senha).

---

## Guia de replicação

Use esta seção para replicar o mesmo padrão de login em outro projeto.

### Pré-requisitos

- Projeto **React** (ex.: Vite + TypeScript).
- Conta **Supabase** e um projeto criado no dashboard.
- **Authentication** habilitada no projeto (Email provider ativado).

### Dependência npm

```bash
npm install @supabase/supabase-js
# ou
pnpm add @supabase/supabase-js
```

Versão utilizada neste projeto: `@supabase/supabase-js` ^2.52.0 (ou superior compatível).

### Variáveis de ambiente

No frontend (ex.: `.env` na raiz, com prefixo `VITE_` para Vite):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto (ex.: `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave **anon/public** (Settings → API no painel Supabase) |
| `VITE_SITE_URL` | Recomendado | URL base do app (ex.: `https://seusite.com` ou `http://localhost:5173`). Usada no reset de senha para montar o `redirectTo`. |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Opcional | Só se for usar operações admin (ex.: deletar usuário do Auth). **Nunca exponha no cliente em produção**; idealmente usar em backend. |

Crie um `.env.example` sem valores reais e não commite o `.env`.

### Schema SQL da tabela de usuários

No Supabase, **SQL Editor**, execute um script equivalente ao abaixo. Ajuste o nome da tabela se quiser (ex.: `users` ou `app_xxx_users`). O importante é ter a coluna **`auth_user_id`** (UUID, nullable no início) para vincular ao `auth.users.id`.

```sql
-- Exemplo: tabela de usuários da aplicação (ajuste o nome se necessário)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,  -- preenchido após signUp; vincula a auth.users.id
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'support', 'admin', 'lawyer')),
  department text DEFAULT 'Geral',
  avatar_url text,
  is_active boolean DEFAULT true,
  is_online boolean DEFAULT false,
  last_active_at timestamptz,
  first_login boolean DEFAULT true,
  must_change_password boolean DEFAULT true,
  password_changed_at timestamptz,
  ticket_view_preference text DEFAULT 'list' CHECK (ticket_view_preference IN ('list', 'board', 'users')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices úteis para login e perfil
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- RLS (Row Level Security): ative e crie políticas conforme sua regra de negócio.
-- Exemplo: usuário autenticado pode ler/atualizar apenas o próprio registro (por auth_user_id = auth.uid()).
-- ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own row" ON app_users FOR SELECT USING (auth_user_id = auth.uid());
-- CREATE POLICY "Users can update own row" ON app_users FOR UPDATE USING (auth_user_id = auth.uid());
-- Para insert (registro) e operações admin, defina políticas específicas ou use service_role.
```

No código, use o **nome real** da tabela (neste projeto: `app_c009c0e4f1_users`; no exemplo acima: `app_users`) na constante `TABLES.USERS` no cliente Supabase.

### Estrutura de arquivos envolvidos no login

| Caminho | Função |
|---------|--------|
| `src/lib/supabase.ts` | Cliente Supabase (createClient), constante TABLES, opções de auth (persistSession, PKCE, storage, detectSessionInUrl). |
| `src/contexts/AuthContext.tsx` | Provider: login, register, logout, resetPassword, loadUserProfile, onAuthStateChange, estado user/loading/requiresPasswordChange, sessionStorage. |
| `src/pages/Login.tsx` | Tela de login (e-mail/senha) e botão/link “Esqueci minha senha” que abre fluxo de reset. |
| `src/pages/ResetPassword.tsx` | Página que recebe o link do e-mail; extrai token/code do hash/query; setSession/verifyOtp/exchangeCodeForSession; formulário nova senha. |
| `src/services/passwordService.ts` | requestPasswordReset, resetPassword (após link), changePassword (logado), checkFirstLogin, markPasswordChangeRequired; atualiza tabela após mudar senha. |
| `src/components/PasswordChangeHandler.tsx` | Envolve as rotas; se requiresPasswordChange, exibe modal de troca de senha. |
| `src/components/ChangePasswordModal.tsx` | Modal de alteração de senha (senha atual + nova); chama passwordService.changePassword. |
| `src/App.tsx` | AuthProvider no topo; rotas públicas (/login, /reset-password) vs protegidas; ProtectedRoute que usa useAuth() e redireciona se !user. |
| `src/types/index.ts` (ou similar) | Tipo User (id, name, email, role, department, firstLogin, mustChangePassword, passwordChangedAt, isActive, etc.). |

### Checklist no painel Supabase

- [ ] **Authentication → Providers**: Email habilitado (Email/Password).
- [ ] **Authentication → URL Configuration**:
  - **Site URL**: ex. `https://seusite.com` ou `http://localhost:5173`.
  - **Redirect URLs**: incluir `https://seusite.com/reset-password`, `https://seusite.com/**` (e equivalentes para localhost se for testar reset local).
- [ ] **Authentication → Email Templates**: template **Reset Password** com link usando `{{ .ConfirmationURL }}` (o Supabase preenche com redirect + token).
- [ ] **Database**: tabela de usuários criada (schema acima), com coluna `auth_user_id` e políticas RLS se necessário.

### Ordem sugerida para implementar

1. Criar projeto no Supabase e anotar URL + anon key.
2. Configurar `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL).
3. Criar `src/lib/supabase.ts` (createClient com auth persistSession, autoRefreshToken, detectSessionInUrl, flowType 'pkce', storage opcional).
4. Criar tabela de usuários no SQL Editor (schema acima) e definir `TABLES.USERS` no código.
5. Implementar **AuthContext**: getSession na inicialização, loadUserProfile(authUserId) buscando por auth_user_id e fallback por email, onAuthStateChange(SIGNED_IN/SIGNED_OUT), login (signInWithPassword + loadUserProfile), register (insert tabela → signUp → update auth_user_id), logout (signOut + limpeza), resetPassword (resetPasswordForEmail com redirectTo).
6. Implementar tela **Login** e rota pública `/login`.
7. No **App**, envolver rotas com AuthProvider; rotas protegidas checando user e redirecionando para `/login` se não houver usuário.
8. Implementar **passwordService**: resetPassword (updateUser + update na tabela), changePassword (getSession, updateUser, update tabela).
9. Implementar página **ResetPassword** (ler token/code da URL, setSession/verifyOtp/exchangeCodeForSession, depois formulário que chama passwordService.resetPassword).
10. Configurar **Site URL** e **Redirect URLs** no painel e testar “Esqueci minha senha”.
11. (Opcional) Primeiro login / obrigar troca de senha: checkPasswordChangeRequired no AuthContext, PasswordChangeHandler + ChangePasswordModal, e atualizar tabela (first_login, must_change_password, password_changed_at) no passwordService.

---

## Armadilhas e dicas

- **PKCE + link de reset**: Com `flowType: 'pkce'`, o link do e-mail pode vir com `code` em vez de `access_token`/`refresh_token`. A página de reset deve tratar vários formatos: `setSession({ access_token, refresh_token })`, `verifyOtp({ token_hash, type: 'recovery' })` e `exchangeCodeForSession(code)`. Implementar os três aumenta a chance de funcionar em qualquer configuração.
- **Site URL e redirect**: Se o link de reset abrir com “requested path is invalid”, confira **Site URL** e **Redirect URLs** no Supabase (URL absoluta, sem path relativo errado). Use `VITE_SITE_URL` no código para montar o `redirectTo` igual ao que está nas Redirect URLs.
- **detectSessionInUrl: true**: Obrigatório para o cliente processar o token/code que vem na URL ao abrir a página de reset. Sem isso, a sessão não é restaurada ao clicar no link do e-mail.
- **Usuário inativo**: Antes de considerar o login válido, buscar o perfil na tabela e checar `is_active`. Se inativo, fazer signOut e mostrar mensagem adequada.
- **Registro: ordem das operações**: Criar primeiro o registro na tabela de usuários (para ter um `id` da aplicação) e depois chamar `signUp`. Se o signUp falhar, remover o registro da tabela para não deixar “órfão”.
- **Chave service_role**: Só usar em backend ou em scripts seguros. No frontend, usar apenas para operações admin inevitáveis (ex.: deletar usuário do Auth) e nunca expor em repositório público.
- **Storage com prefixo**: Se houver múltiplas abas ou ambientes (dev/prod) no mesmo domínio, um storage customizado com prefixo (ex.: `instanceId`) evita conflito de sessão entre eles.
