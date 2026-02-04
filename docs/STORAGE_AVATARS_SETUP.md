# Configuração do bucket de avatars no Supabase Storage

## 1. Criar o bucket

No **Supabase Dashboard** → **Storage** → **New bucket**:

- **Name:** `avatars`
- **Public:** ✅ Sim (avatares precisam ser públicos para exibir no app)
- **File size limit:** 20 MB (opcional)
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`

## 2. Políticas RLS (Row Level Security)

No bucket `avatars`, em **Policies**:

### SELECT (leitura pública)
```
Policy name: Public read avatars
Operation: SELECT
Target roles: all
Policy: true
```
(Ou use a policy padrão de bucket público)

### INSERT, UPDATE, DELETE (upload para usuários autenticados)
Para permitir que **admin** faça upload ao editar usuário e que o **usuário** faça upload no próprio perfil:

```
Policy name: Authenticated users can manage avatars
Operation: INSERT (e repita para UPDATE, DELETE)
Target roles: authenticated
Policy: bucket_id = 'avatars'
```
Ou seja: qualquer usuário autenticado pode inserir/atualizar/remover arquivos no bucket `avatars`. O path `avatars/{userId}/*` garante que cada usuário tenha sua pasta.

## 3. Estrutura de pastas

- `avatars/{userId}/{filename}` — ex: `avatars/abc-123-uuid/avatar.jpg`

O `userId` é o ID do usuário na tabela `app_c009c0e4f1_users`. Admins podem fazer upload em nome de qualquer usuário (usa service_role ou policy específica para admin).

## 4. URL pública

Após upload, a URL será:
```
https://{project-ref}.supabase.co/storage/v1/object/public/avatars/{userId}/{filename}
```
