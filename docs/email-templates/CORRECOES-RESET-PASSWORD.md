# Correções no Sistema de Reset de Senha

## Problema Identificado

O link de reset de senha estava aparecendo como inválido ao clicar no email. O problema estava em dois pontos:

### 1. Template de Email Incorreto

**Problema:** O template estava tentando construir o link manualmente usando `{{ .TokenHash }}`:
```html
<a href="{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery">
```

**Solução:** O Supabase fornece a variável `{{ .ConfirmationURL }}` que já contém a URL completa formatada corretamente com todos os parâmetros necessários.

### 2. Processamento do Link na Página

**Problema:** A página `ResetPassword.tsx` não estava lidando corretamente com todos os formatos de URL que o Supabase pode enviar, especialmente quando os tokens vêm no hash da URL (`#access_token=...&refresh_token=...`).

**Solução:** 
- Adicionado listener `onAuthStateChange` para detectar quando o Supabase processa automaticamente a sessão
- Melhorado processamento de parâmetros tanto na query string quanto no hash
- Aumentado tempo de espera para processamento automático (15 tentativas de 500ms cada)
- Limpeza adequada do listener quando o componente desmonta

## Arquivos Alterados

### 1. `src/pages/ResetPassword.tsx`
- ✅ Adicionado listener `onAuthStateChange` para eventos `PASSWORD_RECOVERY` e `SIGNED_IN`
- ✅ Melhorado processamento de tokens do hash da URL
- ✅ Aumentado tempo de espera para processamento automático
- ✅ Adicionado cleanup adequado do listener

### 2. Template de Email (`docs/email-templates/reset-password-template.html`)
- ✅ Substituído `{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery` por `{{ .ConfirmationURL }}`
- ✅ Link de fallback também atualizado para usar `{{ .ConfirmationURL }}`

## Como Configurar no Supabase

### Passo 1: Copiar o Template
1. Acesse o painel do Supabase
2. Vá em **Authentication** > **Email Templates**
3. Selecione o template **Reset Password**
4. Cole o conteúdo do arquivo `docs/email-templates/reset-password-template.html`

### Passo 2: Verificar URLs de Redirecionamento
1. No Supabase, vá em **Authentication** > **URL Configuration**
2. Certifique-se de que a URL de redirecionamento está configurada:
   - **Site URL**: `https://seu-dominio.com` (ou `http://localhost:5173` para desenvolvimento)
   - **Redirect URLs**: Adicione `https://seu-dominio.com/reset-password` (ou `http://localhost:5173/reset-password` para desenvolvimento)

### Passo 3: Verificar Configuração do Cliente Supabase
No arquivo `src/lib/supabase.ts`, certifique-se de que:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // ✅ DEVE estar habilitado
    storage: customStorage,
    flowType: 'pkce' // ✅ PKCE flow para maior segurança
  },
  // ...
});
```

## Variáveis Disponíveis no Template do Supabase

Quando você usa templates customizados no Supabase, as seguintes variáveis estão disponíveis:

- `{{ .ConfirmationURL }}` - **USE ESTA** - URL completa com todos os parâmetros já formatados
- `{{ .SiteURL }}` - URL base do site
- `{{ .Token }}` - Token de confirmação (pode não funcionar em todos os casos)
- `{{ .TokenHash }}` - Hash do token (pode não funcionar em todos os casos)
- `{{ .Email }}` - Email do usuário
- `{{ .RedirectTo }}` - URL de redirecionamento configurada

**Recomendação:** Sempre use `{{ .ConfirmationURL }}` para links de reset de senha, pois ela já vem formatada corretamente pelo Supabase.

## Testando

Após fazer as alterações:

1. Solicite um reset de senha através do sistema
2. Verifique o email recebido - o link deve usar `{{ .ConfirmationURL }}`
3. Clique no link - deve redirecionar para `/reset-password` com os tokens no hash
4. A página deve processar automaticamente e permitir redefinir a senha

## Debug

Se ainda houver problemas, verifique o console do navegador. A página `ResetPassword.tsx` agora inclui logs detalhados:

- `🔍 === PROCESSANDO LINK DE RESET ===` - Início do processamento
- `🔑 Parâmetros extraídos` - Parâmetros encontrados na URL
- `🔄 Método X` - Qual método está sendo tentado
- `✅ Sucesso` - Quando o link foi processado com sucesso
- `❌ Falha` - Quando algum método falha

## Notas Importantes

1. O Supabase pode enviar o link com tokens tanto na query string (`?token=...`) quanto no hash (`#access_token=...`). O código agora suporta ambos.

2. O Supabase processa automaticamente sessões criadas via URL quando `detectSessionInUrl: true` está habilitado, mas pode levar alguns segundos. O código agora aguarda até 7.5 segundos (15 tentativas de 500ms).

3. O listener `onAuthStateChange` captura eventos `PASSWORD_RECOVERY` que são disparados quando o Supabase detecta um link de reset válido.

4. Sempre limpe o hash da URL após processar o link para não expor tokens na barra de endereços.
