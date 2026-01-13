# Problema: PKCE e Reset de Senha

## Erro Encontrado

```
❌ Erro ao trocar código: invalid request: both auth code and code verifier should be non-empty
```

## Causa

O Supabase está configurado para usar **PKCE flow** (`flowType: 'pkce'`), mas o código de reset de senha que vem no email não inclui o `code_verifier` necessário para o fluxo PKCE.

Quando você usa `exchangeCodeForSession(code)`, o Supabase espera tanto o `code` quanto o `code_verifier`, mas o reset de senha não fornece o `code_verifier`.

## Soluções Implementadas

### 1. Usar `verifyOtp` com `token_hash`

O código agora tenta usar `verifyOtp` com `token_hash` primeiro:

```typescript
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: code,
  type: 'recovery'
});
```

### 2. Fallback para API REST

Se `verifyOtp` falhar, o código tenta usar a API REST diretamente:

```typescript
const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({
    token_hash: code,
    type: 'recovery'
  }),
});
```

## Possíveis Soluções Adicionais

### Opção 1: Desabilitar PKCE para Recovery (Recomendado)

No arquivo `src/lib/supabase.ts`, você pode criar um cliente separado sem PKCE para recovery:

```typescript
// Cliente sem PKCE para recovery
export const supabaseRecovery = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
    flowType: 'implicit' // Sem PKCE
  }
});
```

E usar este cliente apenas para processar o código de recovery.

### Opção 2: Configurar Supabase para Não Usar PKCE em Recovery

No painel do Supabase:
1. Vá em **Authentication** > **URL Configuration**
2. Verifique se há opções para desabilitar PKCE para recovery
3. Ou configure o template de email para usar um formato diferente

### Opção 3: Usar Token Hash ao Invés de Code

Se possível, configure o Supabase para enviar um `token_hash` ao invés de um `code` no email de reset. Isso funcionaria diretamente com `verifyOtp`.

## Como Testar

1. Solicite um reset de senha
2. Verifique o console do navegador ao clicar no link
3. Procure por:
   - `🔄 Método 2: Usando código (code) com verifyOtp recovery...`
   - `✅ Sucesso com verifyOtp recovery!` ou
   - `🔄 Tentando via API REST...`

## Debug

Se ainda não funcionar, verifique:

1. **Formato do código**: O código que vem na URL deve ser um UUID (ex: `f9f83184-268d-4c31-8a05-7a14cfab6c14`)
2. **Tipo de código**: Verifique se é um `code` ou um `token_hash`
3. **Configuração do Supabase**: Verifique se o Site URL está correto e se o template usa `{{ .ConfirmationURL }}`

## Notas

- O PKCE é uma medida de segurança importante, mas pode causar problemas com reset de senha
- A solução ideal seria o Supabase suportar recovery sem PKCE automaticamente
- Enquanto isso, as soluções implementadas devem funcionar na maioria dos casos
