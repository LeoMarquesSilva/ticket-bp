# Login único para todos os sistemas do escritório

Este documento explica como usar **o mesmo sistema de login** (o do Responsum / sistema de tickets) em **todos os sistemas** que vocês criaram no escritório. A ideia é ter **um único Supabase como “central”** para autenticação: o usuário tem uma única conta e pode acessar todos os apps com o mesmo e-mail e senha.

---

## Índice

- [Visão geral](#visão-geral)
- [É boa prática? Quando faz sentido?](#é-boa-prática-quando-faz-sentido)
- [Cenário: um login, vários sistemas](#cenário-um-login-vários-sistemas)
- [Arquitetura recomendada](#arquitetura-recomendada)
- [Onde ficam os dados de cada sistema](#onde-ficam-os-dados-de-cada-sistema)
- [Passos para usar o login central nos outros projetos](#passos-para-usar-o-login-central-nos-outros-projetos)
- [Configurações no Supabase central](#configurações-no-supabase-central)
- [Sessão entre vários domínios](#sessão-entre-vários-domínios)
- [Resumo rápido](#resumo-rápido)

---

## Visão geral

- **Hoje:** cada sistema (Responsum, outro app, etc.) pode ter seu próprio Supabase (Auth + banco).
- **Objetivo:** um único **Supabase “central”** (por exemplo o do Responsum) para **login**. Todos os sistemas fazem autenticação contra esse mesmo projeto; os dados de cada sistema podem ficar no central ou cada app manter seu próprio Supabase só para dados (com um backend validando o JWT do central).

---

## É boa prática? Quando faz sentido?

**Resposta curta:** não é “errado”. É um **padrão válido** de centralizar identidade (um provedor de Auth para vários apps). Muitas empresas fazem isso para sistemas internos. O que importa é usar onde faz sentido e conhecer os trade-offs.

### Quando essa abordagem é uma boa escolha

- **Mesma organização, mesmos usuários:** vários sistemas do escritório, mesma equipe acessando tudo (Responsum, outro sistema, etc.).
- **Simplicidade:** um único lugar para gerenciar usuários, senhas, “esqueci minha senha” e roles; menos duplicação de código e de configuração.
- **Escopo controlado:** número de usuários e de sistemas dentro do que um projeto Supabase aguenta bem (Supabase tem limites por projeto, mas para uso interno costuma ser suficiente).

Nesse contexto, **um Supabase central para Auth (e opcionalmente para dados)** é uma solução **pragmática e correta**. Não é gambiarra.

### Trade-offs (o que você “perde” ou aceita)

| Ponto | O que significa |
|-------|-----------------|
| **Ponto único de falha** | Se o Supabase central cair ou ficar indisponível, ninguém faz login em nenhum app. Para sistemas internos isso costuma ser aceitável; para missão crítica, dá para ter monitoramento e SLA. |
| **Acoplamento** | Todos os apps dependem do mesmo projeto e da mesma tabela de usuários. Mudar schema de usuário (roles, departamentos) impacta todos. Isso é exatamente o que você quer quando “é a mesma empresa, mesmos usuários”. |
| **Escala** | Se no futuro tiverem dezenas de apps ou milhares de usuários externos, pode fazer sentido separar Auth em um serviço dedicado (IdP). Para escritório com poucos sistemas, não costuma ser necessário. |
| **Requisitos por app** | Se um app precisar de 2FA e outro não, ou de fluxos de login muito diferentes, a tabela e o fluxo únicos podem precisar de extensões (campos opcionais, flags por app). Ainda assim é viável. |

### Quando considerar algo “mais formal”

Vale pensar em **provedor de identidade dedicado** (Auth0, Keycloak, etc.) ou **SSO/OAuth** se:

- Vocês precisarem de **single sign-on real** (logar em um lugar e entrar em todos os outros sem digitar senha de novo, entre domínios diferentes).
- Houver **clientes ou parceiros externos** acessando alguns sistemas, com políticas de segurança e auditoria mais rígidas.
- **Cada sistema** for um “produto” diferente, com times diferentes e necessidade de evoluir Auth de forma independente.

Para **vários sistemas internos do mesmo escritório, mesma equipe, mesma conta de usuário**, o modelo “um Supabase central para login (e opcionalmente dados)” é **uma boa forma de programação**: simples, mantível e alinhada com o problema. Não fica “errado”; fica adequado ao contexto.

---

## Cenário: um login, vários sistemas

- **Sistema A (Responsum / tickets):** já usa Supabase X (Auth + tabela de usuários + tickets, etc.).
- **Sistema B, C, D:** hoje podem usar Supabase Y, Z, etc.

**Escolha:** o Supabase do **Responsum** (ou um projeto novo só para identidade) vira o **central**. Todos os apps passam a usar:

- **Mesma URL do Supabase** (central).
- **Mesma chave anon** (central).
- **Mesma tabela de usuários** no central (ou uma tabela única “company_users” com controle de acesso por app, se quiserem).

Assim, um único cadastro (e-mail/senha) no central vale para todos os sistemas.

---

## Arquitetura recomendada

### Opção 1 – Tudo no Supabase central (mais simples)

- **Um único projeto Supabase** (ex.: o do Responsum).
- **Auth:** sempre nesse projeto (`auth.users`).
- **Tabela de usuários:** uma só (ex.: `app_c009c0e4f1_users` ou `company_users`) com os campos que vocês já usam (nome, email, role, department, etc.).
- **Dados dos outros sistemas:** ficam no **mesmo** Supabase, em outras tabelas (ex.: `sistema_b_pedidos`, `sistema_c_documentos`). RLS usa `auth.uid()` do central para proteger por usuário.

**Vantagem:** um lugar para Auth + todos os dados; não precisa de backend extra para “ligar” login ao banco.  
**Nos outros projetos:** basta trocar a URL e a anon key para a do central e usar a mesma tabela de usuários (e o mesmo código de login do Responsum, adaptando só o nome da tabela se mudar).

### Opção 2 – Auth central + cada sistema com seu próprio Supabase (só dados)

- **Auth:** só no Supabase central (Responsum). Todos os apps fazem login lá (mesma URL, mesma anon key).
- **Dados:** cada sistema continua com seu próprio projeto Supabase para as tabelas daquele app.

Nesse caso, o **JWT** que o usuário recebe é do projeto **central**. O Supabase do Sistema B não “conhece” esse JWT (cada projeto Supabase só valida o próprio JWT). Então:

- Ou o **front do Sistema B** usa o central só para login e, para ler/escrever dados, chama **uma API sua** (backend) que:
  - Valida o JWT do central (com a chave JWT do projeto central).
  - Usa a **service_role** do Supabase do Sistema B para fazer as queries em nome do usuário.
- Ou vocês **migram os dados** do Sistema B para o central (tabelas específicas no mesmo projeto) e aí caem na Opção 1.

**Resumo:** para “um login para todos” com vários Supabase de dados, é necessário um backend que recebe o token do central e fala com cada Supabase. A opção mais simples é **Opção 1**.

---

## Onde ficam os dados de cada sistema

| Abordagem | Auth | Dados Responsum | Dados Sistema B, C… |
|-----------|------|------------------|----------------------|
| **Tudo no central** | Central | Mesmo Supabase (ex.: tabelas de tickets) | Mesmo Supabase (outras tabelas ou schemas) |
| **Auth central + 1 Supabase por app** | Central | Central (ou Responsum continua como está) | Cada app: seu Supabase + backend que valida JWT do central |

Recomendação: **usar o Supabase do Responsum como central e, nos novos sistemas, criar as tabelas deles no mesmo projeto** (com prefixos ou schemas por app). Assim não precisam de backend extra só para Auth.

---

## Passos para usar o login central nos outros projetos

Objetivo: no **Sistema B** (e nos demais), o login passar a ser o do **Supabase central** (Responsum), usando a mesma tabela de usuários.

### 1. Definir o Supabase central

- Usar o projeto Supabase do **Responsum** como central (ou criar um novo só para identidade e migrar usuários depois).
- Anotar:
  - **URL:** `https://xxxxx.supabase.co`
  - **Chave anon (public):** em Settings → API do projeto.

### 2. No projeto do outro sistema (ex.: Sistema B)

- **Instalar** (se ainda não tiver): `@supabase/supabase-js`.
- **Variáveis de ambiente** (ex.: `.env`):

```env
# Supabase CENTRAL (Responsum) – Auth + tabela de usuários
VITE_SUPABASE_URL=https://jhgbrbarfpvgdaaznldj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key_do_projeto_central>

# URL deste app (para reset de senha e redirects)
VITE_SITE_URL=https://sistema-b.empresa.com
```

- **Cliente Supabase:** usar **sempre** a URL e a anon key do **central**. Exemplo em `src/lib/supabase.ts` (ou equivalente):

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const TABLES = {
  USERS: 'app_c009c0e4f1_users',  // mesma tabela do central
  // tabelas específicas do Sistema B, se estiverem no mesmo Supabase:
  // PEDIDOS: 'sistema_b_pedidos',
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
```

Ou seja: no Sistema B, **não** usar mais a URL/anon key do Supabase que era “dele”; usar a do central.

### 3. Copiar/adaptar o fluxo de login do Responsum

- Copiar (ou referenciar) do Responsum:
  - **AuthContext** (login, logout, registro, resetPassword, loadUserProfile, onAuthStateChange).
  - **Tela de Login** e, se quiser, **ResetPassword** e **troca de senha**.
  - **passwordService** (ou equivalente) que atualiza a tabela de usuários após troca de senha.
- Ajustar no Sistema B:
  - Nome da tabela de usuários: deve ser a **mesma** do central (`app_c009c0e4f1_users` ou a que estiver no `TABLES.USERS` do central).
  - Tipo `User` e roles: alinhar com o que existe na tabela (role, department, etc.), ou simplificar se o Sistema B precisar só de id/nome/email.

Assim, no Sistema B o usuário faz login com **e-mail e senha já cadastrados no central** (Responsum). Não é necessário cadastrar de novo.

### 4. Tabela de usuários no central

- A tabela de usuários fica **só no central** (já é a do Responsum). Todos os apps que usam login central leem essa mesma tabela (por `auth_user_id` ou email).
- Se no Sistema B existia uma tabela “usuários” no outro Supabase, vocês podem:
  - Parar de usar essa tabela para Auth e passar a usar só a do central; ou
  - Migrar usuários para o central (criar em `auth.users` + linha na tabela do central) e desativar o Auth do outro projeto.

### 5. Dados do Sistema B

- **Se optarem por “tudo no central”:** criar as tabelas do Sistema B no **mesmo** projeto Supabase (ex.: com prefixo `sistema_b_`). No código do Sistema B, além de `TABLES.USERS`, apontar para essas tabelas. RLS pode usar `auth.uid()` normalmente.
- **Se o Sistema B continuar com outro Supabase só para dados:** aí entra a Opção 2 (backend que valida JWT do central e chama o Supabase do Sistema B com service_role). Não é necessário se tudo estiver no central.

---

## Configurações no Supabase central

Para o login e o reset de senha funcionarem em **todos** os sistemas:

1. **Authentication → URL Configuration**
   - **Site URL:** pode ser a do Responsum (ex.: `https://responsum.empresa.com`) ou uma URL genérica.
   - **Redirect URLs:** adicionar a URL de **cada** sistema, em especial a página de reset de senha:
     - `https://responsum.empresa.com/reset-password`
     - `https://sistema-b.empresa.com/reset-password`
     - `https://sistema-c.empresa.com/reset-password`
     - Para dev: `http://localhost:5173/reset-password`, `http://localhost:3000/reset-password`, etc.

2. **Authentication → Email Templates**
   - No template **Reset Password**, o link deve usar `{{ .ConfirmationURL }}`. O Supabase já cola a redirect URL configurada; assim o link de “esqueci minha senha” leva o usuário para a página de reset do app que ele estava (se todos usarem a mesma `VITE_SITE_URL` por build, cada app tem sua própria URL de redirect).

3. **Variável `VITE_SITE_URL` por app**
   - Em cada projeto (Responsum, Sistema B, Sistema C), defina `VITE_SITE_URL` com a URL **daquele** app. Assim o fluxo de “esqueci minha senha” envia o usuário para o domínio correto (e esse domínio precisa estar em Redirect URLs).

---

## Sessão entre vários domínios

- O Supabase guarda a sessão (token) no **localStorage** (ou no storage que vocês configuraram) **por origem** (domínio + porta). Ou seja:
  - **responsum.empresa.com** tem um localStorage;
  - **sistema-b.empresa.com** tem outro.
- Consequência: o usuário **não fica “logado automaticamente”** em todos os sistemas ao logar em um. Ele usa **a mesma conta** (mesmo e-mail e senha no central), mas precisa fazer **login uma vez em cada domínio** (uma vez por app). Depois disso, em cada app a sessão persiste normalmente naquele domínio.
- Se no futuro quiserem “single sign-on” (logar em um e abrir o outro já logado), aí seria preciso algo a mais (ex.: redirect com token entre domínios, ou um portal que abre os apps em iframes no mesmo domínio). Para “mesmo usuário e mesma senha em todos”, só trocar URL/anon key e tabela de usuários já atende.

---

## Resumo rápido

| O quê | Onde / como |
|-------|-------------|
| **Login único** | Um Supabase “central” (ex.: Responsum). Todos os apps usam a **mesma** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` desse projeto. |
| **Nos outros projetos** | Trocar env para URL e anon key do central; usar a **mesma** tabela de usuários (`app_c009c0e4f1_users` ou a que estiver no central); copiar/adaptar AuthContext, Login, reset de senha e passwordService do Responsum. |
| **Redirect URLs** | No central, em Authentication → URL Configuration, adicionar a URL de reset de senha de **cada** sistema (e de cada ambiente de dev, se quiser). |
| **Dados dos outros sistemas** | Recomendado: criar tabelas no **mesmo** Supabase central (ex.: prefixo por app). Alternativa: manter um Supabase por app só para dados e usar um backend que valida o JWT do central. |
| **Sessão** | Uma sessão por domínio. Mesma conta (e-mail/senha) em todos; login feito uma vez por app (por domínio). |

Assim vocês conseguem usar o **mesmo sistema de login do Responsum** em todos os sistemas do escritório, com um único Supabase principal para Auth (e, se quiserem, para todos os dados também).

---

**Documentos relacionados**

- [SISTEMA-DE-LOGIN-SUPABASE.md](./SISTEMA-DE-LOGIN-SUPABASE.md) — detalhes do fluxo de login, tabela de usuários, reset de senha e guia de replicação do código.
