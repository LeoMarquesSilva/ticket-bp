# Correção: Variáveis do Template de Email

## Problema Identificado

O template estava usando `{{ .ConfirmationURL }}`, mas para reset de senha, o Supabase requer variáveis específicas:
- `{{ .TokenHash }}` - Hash do token de recovery
- `{{ .RedirectTo }}` - URL de redirecionamento configurada
- `{{ .SiteURL }}` - URL base do site (opcional)

## Correção Aplicada

### Template Antigo (Incorreto):
```html
<a href="{{ .ConfirmationURL }}">Redefinir Senha</a>
```

### Template Novo (Correto):
```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Redefinir Senha</a>
```

## Variáveis do Supabase para Reset de Senha

Para templates de reset de senha, o Supabase fornece:

- `{{ .TokenHash }}` - Hash do token de recovery (OBRIGATÓRIO)
- `{{ .RedirectTo }}` - URL de redirecionamento (OBRIGATÓRIO)
- `{{ .SiteURL }}` - URL base do site (opcional)
- `{{ .Email }}` - Email do usuário (opcional)

## Como Atualizar no Supabase

1. Acesse o painel do Supabase
2. Vá em **Authentication** > **Email Templates**
3. Selecione o template **Reset Password**
4. Substitua o conteúdo pelo arquivo: `docs/email-templates/reset-password-template.html`
5. Certifique-se de que o link usa: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`

## Código Atualizado

O código em `src/pages/ResetPassword.tsx` foi atualizado para processar `token_hash`:

```typescript
const tokenHash = urlParams.get('token_hash') || hashParams.get('token_hash');
const type = urlParams.get('type') || hashParams.get('type');

if (tokenHash && type === 'recovery') {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery'
  });
  // ...
}
```

## Testando

Após atualizar o template:

1. Solicite um novo reset de senha
2. Verifique o email - o link deve ser: `https://www.responsum.com.br/reset-password?token_hash=...&type=recovery`
3. Clique no link - deve processar corretamente com `verifyOtp`

## Notas Importantes

- O `{{ .RedirectTo }}` já contém a URL completa configurada (ex: `https://www.responsum.com.br/reset-password`)
- O `{{ .TokenHash }}` é o hash do token gerado pelo Supabase
- O parâmetro `type=recovery` é necessário para identificar que é um reset de senha
- O código agora processa `token_hash` primeiro, com fallback para `code` se necessário
