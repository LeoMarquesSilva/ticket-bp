# Guia Completo: Como Adicionar Secrets no GitHub

## 📍 Localização dos Secrets

Os Secrets do GitHub Actions podem estar em locais ligeiramente diferentes dependendo da versão do GitHub e do tipo de repositório.

## 🔍 Caminho Completo

1. **Acesse o repositório no GitHub:**
   ```
   https://github.com/LeoMarquesSilva/ticket-bp
   ```

2. **Clique na aba "Settings"**
   - Fica no topo da página, ao lado de: Code | Issues | Pull requests | Actions | Projects | Wiki | Security | Insights | Settings

3. **No menu lateral ESQUERDO, procure por:**
   - **"Secrets and variables"** → clique
   - Depois clique em **"Actions"**

4. **Ou tente estes caminhos alternativos:**
   - **Settings** → **Security** → **Secrets and variables** → **Actions**
   - **Settings** → **Secrets** → **Actions**

## 🎯 Passo a Passo Visual

```
GitHub Repository
  └─ Settings (aba no topo)
      └─ Menu lateral esquerdo:
          ├─ General
          ├─ Access
          ├─ Code and automation
          │   └─ Actions
          │       └─ Secrets and variables ← AQUI
          │           └─ Actions
          │               └─ New repository secret ← CLIQUE AQUI
```

## ✅ Verificação

Se você não encontrar "Secrets and variables", verifique:

1. **Você tem permissão de administrador?**
   - Apenas administradores podem ver/editar secrets
   - Se você for colaborador, peça acesso ao dono do repositório

2. **O repositório é privado ou público?**
   - Secrets aparecem em ambos os casos
   - Mas apenas administradores veem em repositórios públicos

3. **Tente acessar diretamente:**
   ```
   https://github.com/LeoMarquesSilva/ticket-bp/settings/secrets/actions
   ```

## 🔧 Configuração do Secret

Quando encontrar a página de Secrets:

1. Clique em **"New repository secret"** (botão verde)
2. Preencha:
   - **Name**: `N8N_DEPLOY_WEBHOOK_URL`
   - **Secret**: `https://seu-n8n.com/webhook/deploy-notification`
3. Clique em **"Add secret"**

## 📸 Localização Alternativa (GitHub mais antigo)

Em versões antigas do GitHub, pode estar em:

**Settings** → **Secrets** → **New secret**

## 🆘 Se ainda não encontrar

1. **Verifique se GitHub Actions está habilitado:**
   - **Settings** → **Actions** → **General**
   - Certifique-se de que está habilitado

2. **Contate o administrador do repositório:**
   - Peça para adicionar o secret
   - Ou peça permissões de administrador

3. **Use variáveis de ambiente locais:**
   - Alternativa: não usar GitHub Actions
   - Fazer deploy manual e configurar webhook localmente

## 🔗 Links Úteis

- [Documentação Oficial GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Gerenciar Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository)
