# Correção: URL Inválida no Reset de Senha

## Problema Identificado

Quando o usuário clica no link do email de reset de senha, aparece o erro:
```
{"error":"requested path is invalid"}
```

A URL gerada está incorreta:
```
https://jhgbrbarfpvgdaaznldj.supabase.co/www.responsum.com.br?code=...
```

O Supabase está interpretando `www.responsum.com.br` como um caminho relativo ao invés de um domínio absoluto.

## Causa

O problema está em **duas configurações**:

1. **Site URL no Painel do Supabase** - está configurado incorretamente
2. **Template de Email** - pode estar usando variáveis incorretas

## Soluções Implementadas no Código

### 1. Processamento do Parâmetro `code`

O código agora processa corretamente o parâmetro `code` que o Supabase envia usando `exchangeCodeForSession()`:

```typescript
if (code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  // ...
}
```

### 2. Suporte a Variável de Ambiente

O código agora suporta a variável de ambiente `VITE_SITE_URL` para definir a URL base:

```typescript
const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
const resetUrl = `${baseUrl}/reset-password`;
```

## Configurações Necessárias

### Passo 1: Configurar Variável de Ambiente (Recomendado)

Crie um arquivo `.env` na raiz do projeto (ou `.env.production` para produção):

```env
VITE_SITE_URL=https://www.responsum.com.br
```

**Para desenvolvimento local:**
```env
VITE_SITE_URL=http://localhost:5173
```

### Passo 2: Configurar Site URL no Painel do Supabase

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Vá em **Authentication** > **URL Configuration**
3. Configure:
   - **Site URL**: `https://www.responsum.com.br` (ou `http://localhost:5173` para dev)
   - **Redirect URLs**: Adicione:
     - `https://www.responsum.com.br/reset-password`
     - `https://www.responsum.com.br/**` (wildcard para aceitar todas as rotas)
     - `http://localhost:5173/reset-password` (para desenvolvimento)

### Passo 3: Verificar Template de Email

No painel do Supabase:
1. Vá em **Authentication** > **Email Templates**
2. Selecione **Reset Password**
3. Certifique-se de que o template usa `{{ .ConfirmationURL }}` no link:

```html
<a href="{{ .ConfirmationURL }}">Redefinir Senha</a>
```

**NÃO use:**
```html
<!-- ❌ ERRADO -->
<a href="{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery">
```

**USE:**
```html
<!-- ✅ CORRETO -->
<a href="{{ .ConfirmationURL }}">
```

## Como Testar

1. Solicite um reset de senha através do sistema
2. Verifique o email recebido
3. O link deve ser algo como:
   - `https://www.responsum.com.br/reset-password?code=...` (correto)
   - **NÃO** deve ser: `https://jhgbrbarfpvgdaaznldj.supabase.co/www.responsum.com.br?code=...` (errado)
4. Clique no link - deve redirecionar corretamente e processar o código

## Debug

Se ainda houver problemas, verifique:

1. **Console do navegador** - a página `ResetPassword.tsx` tem logs detalhados:
   - `🔍 === PROCESSANDO LINK DE RESET ===`
   - `🔑 Parâmetros extraídos` - mostra se o código foi encontrado
   - `🔄 Método 2: Usando código (code)...` - mostra tentativa de processar código

2. **Variável de ambiente** - verifique se `VITE_SITE_URL` está configurada:
   ```javascript
   console.log('VITE_SITE_URL:', import.meta.env.VITE_SITE_URL);
   ```

3. **Configuração do Supabase** - verifique se Site URL e Redirect URLs estão corretas no painel

## Arquivos Modificados

- ✅ `src/pages/ResetPassword.tsx` - Adicionado processamento do parâmetro `code`
- ✅ `src/contexts/AuthContext.tsx` - Suporte a `VITE_SITE_URL`
- ✅ `src/services/passwordService.ts` - Suporte a `VITE_SITE_URL`

## Notas Importantes

1. **A variável de ambiente `VITE_SITE_URL` é opcional** - se não estiver configurada, o código usa `window.location.origin` como fallback.

2. **A configuração mais importante é no painel do Supabase** - o Site URL deve estar correto para que o Supabase gere os links corretamente.

3. **O template de email deve usar `{{ .ConfirmationURL }}`** - esta variável já vem formatada corretamente pelo Supabase com todos os parâmetros necessários.

4. **Após alterar variáveis de ambiente**, você precisa reiniciar o servidor de desenvolvimento (`npm run dev` ou `pnpm dev`).
