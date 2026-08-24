# Implantação das comunicações de chamados

Este runbook publica o envio de e-mail e o aviso no feed **Atividade** do Teams da Edge Function `notify-ticket-communications`. Não crie ícones, ZIPs ou valores secretos no repositório.

## Escopo e pré-requisitos

- O template usa o [schema Teams 1.28](https://developer.microsoft.com/json-schemas/teams/v1.28/MicrosoftTeams.schema.json), uma única RSC `TeamsActivity.Send.User`/`Application` e o activity type templado `ticketCommunication`. Não contém bot, chat, canal, conectores, permissões de dispositivo nem `TeamsActivity.Send` amplo.
- O código envia `POST /users/{id}/teamwork/sendActivityNotification` com `activityType: "ticketCommunication"`, `templateParameters`, tópico textual e `teamsAppId`. O `topic.webUrl` é um deep link `https://teams.microsoft.com/l/entity/{teamsAppId}/ticket-detail?...`; o conteúdo também leva o link HTTPS direto do chamado. Consulte [notificações de atividade](https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications) e a [operação para usuário](https://learn.microsoft.com/en-us/graph/api/userteamwork-sendactivitynotification?view=graph-rest-1.0).
- A Function usa client credentials para Graph e `User.Read.All` de aplicação para resolver o destinatário. Consulte as [permissões Graph](https://learn.microsoft.com/en-us/graph/permissions-reference), [Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac) e a [autorização de Edge Functions](https://supabase.com/docs/guides/functions/auth).

Antes do upload, o proprietário deve aprovar URLs legais e ícones oficiais. Valide que as páginas de privacidade e termos do pacote estão publicadas e aprovadas; se o tenant exigir URLs corporativas diferentes, altere-as somente no `manifest.json` gerado para o pacote aprovado. Não altere o template versionado sem a aprovação correspondente.

## 1. Preparar homologação isolada

O comando `daily` processa todos os candidatos do projeto: ele **não** aceita destinatário, ticket ou usuário de teste. Antes de qualquer smoke `daily`, use um projeto Supabase e tenant Teams/Entra de homologação isolados, contendo apenas usuários e tickets de teste. Se esse ambiente não existir, não execute `daily`; teste apenas o fluxo dirigido `ticket_resolved` com uma sessão de homologação e um ticket de teste resolvido.

Não faça uma chamada `daily` em produção para testar um usuário. O cron só será criado/ativado depois de migration, deploy e smoke bem-sucedidos em homologação.

## 2. Escolher exatamente um modelo de menor privilégio para e-mail

`User.Read.All` continua sendo uma permissão de aplicação Graph com consentimento administrativo nos dois caminhos, pois o código resolve UPN/e-mail. Para envio, escolha **um e somente um** dos caminhos abaixo. Grants são aditivos: nunca misture os caminhos. No Caminho A, não deixe `Mail.Send` global do Entra ativo junto com RBAC; no Caminho B, o `Mail.Send` global do Entra é obrigatório e deve sempre vir acompanhado da Application Access Policy `RestrictAccess`.

### Caminho A — recomendado: Exchange Online Application RBAC

Não conceda `Mail.Send` global no Microsoft Entra. No Exchange Online, registre o service principal dedicado e atribua somente o papel `Application Mail.Send` a um escopo que contenha exclusivamente a mailbox/grupo de `TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER`.

Em uma sessão Exchange Online administrativa, substitua os placeholders por identificadores do ambiente (nunca os comite):

```powershell
Connect-ExchangeOnline
New-ServicePrincipal -AppId <TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID> -ObjectId <ENTRA_SERVICE_PRINCIPAL_OBJECT_ID> -DisplayName 'Responsum Ticket Communications'
New-ManagementScope -Name 'ResponsumNotificationSenderScope' -RecipientRestrictionFilter { PrimarySmtpAddress -eq '<TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER>' }
New-ManagementRoleAssignment -Name 'ResponsumTicketMailSend' -App <EXCHANGE_SERVICE_PRINCIPAL_IDENTITY> -Role 'Application Mail.Send' -CustomResourceScope 'ResponsumNotificationSenderScope'
Test-ServicePrincipalAuthorization -Identity <EXCHANGE_SERVICE_PRINCIPAL_IDENTITY> -Resource <TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER>
```

Valide que o teste retorna autorização para a mailbox permitida e que uma mailbox fora do escopo não é autorizada. Também confira no registro Entra que não há grant de aplicação `Mail.Send`; mantenha apenas o consentimento de `User.Read.All` necessário à resolução.

### Caminho B — compatibilidade: Entra `Mail.Send` + Application Access Policy

Use este caminho apenas quando Application RBAC não estiver disponível. Conceda `Mail.Send` de aplicação e o consentimento administrativo no Entra, crie uma Application Access Policy `RestrictAccess` para um grupo que contenha somente a mailbox remetente e teste a política antes do envio.

```powershell
Connect-ExchangeOnline
New-ApplicationAccessPolicy -AppId <TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID> -PolicyScopeGroupId <MAIL_ENABLED_SECURITY_GROUP> -AccessRight RestrictAccess -Description 'Responsum ticket sender only'
Test-ApplicationAccessPolicy -AppId <TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID> -Identity <TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER>
```

O teste deve permitir a mailbox remetente e negar uma mailbox fora do grupo. Não crie uma atribuição `Application Mail.Send` de Exchange RBAC neste caminho; remova/revise grants conflitantes antes de liberar produção.

## 3. Preparar o aplicativo Teams

1. Exporte somente ativos oficiais aprovados: `color.png` (192 × 192 PNG colorido) e `outline.png` (32 × 32 PNG transparente com contorno branco). Valide dimensões, transparência e direitos de uso.
2. Copie `teams/responsum-notifications/manifest.template.json` para `teams/responsum-notifications/manifest.json`.
3. Substitua `${TICKET_COMMUNICATIONS_MICROSOFT_TEAMS_APP_ID}` pelo App ID Teams, `${TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID}` pelo Client ID Entra e `${APP_PUBLIC_URL}` pela mesma base HTTPS normalizada configurada na Function. Os IDs devem ser GUIDs do tenant; a URL não pode conter userinfo, query ou fragment.
4. No Developer Portal, valide o JSON, as URLs legais aprovadas, os dois ícones, a tab pessoal estática `ticket-detail`, `ticketCommunication` e a única RSC `TeamsActivity.Send.User`/`Application`. O template usa `{notificationText}` e `{ticketUrl}`; confirme que o clique abre o deep link Teams e que o link direto abre o chamado correto.
5. Crie um ZIP com exatamente `manifest.json`, `color.png` e `outline.png` na raiz, sem diretório-pai, e publique-o no catálogo da organização conforme a política do tenant.

No Teams Admin Center, aprove a RSC e instale o app por política no escopo **pessoal** dos destinatários, concedendo o consentimento específico ao recurso. Instale-o também para o usuário de homologação. Não substitua instalação ausente por bot, chat, canal ou permissão ampla.

Os PNGs, `manifest.json` e ZIP são ignorados pelo Git. Não faça upload antes da aprovação formal das URLs legais e dos ícones.

## 4. Configurar a Function e o banco em homologação

No projeto Supabase de homologação, configure em Edge Function Secrets somente os valores destes seis nomes dedicados, já listados em `.env.example`. Não reutilize as credenciais `MICROSOFT_*` da integração SharePoint:

| Secret | Uso |
| --- | --- |
| `TICKET_COMMUNICATIONS_MICROSOFT_TENANT_ID` | Tenant Microsoft Entra. |
| `TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID` | Registro dedicado de aplicativo Graph/Teams. |
| `TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_SECRET` | Credencial client-secret dedicada. |
| `TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER` | Mailbox remetente autorizada no caminho escolhido. |
| `TICKET_COMMUNICATIONS_MICROSOFT_TEAMS_APP_ID` | App ID Teams publicado. |
| `APP_PUBLIC_URL` | Base HTTPS dos links, sem userinfo, query ou fragment. |

Não copie valores para `.env.example`, migrations, documentação, comandos versionados ou logs. Aplique `supabase/migrations/20260824150304_ticket_communications.sql` pelo fluxo aprovado (por exemplo, `supabase db push`) e publique `supabase/functions/notify-ticket-communications/` (por exemplo, `supabase functions deploy notify-ticket-communications`).

Confirme em `supabase/config.toml` que a Function usa `verify_jwt = false`: o handler `@supabase/server` autoriza `auth: ['user', 'secret:ticket-communications']`, portanto a configuração não torna o endpoint público.

## 5. Criar a key e executar o smoke antes do cron

Crie no painel Supabase de homologação uma secret key chamada `ticket-communications`, guardando o valor apenas no Vault/painel seguro. Para o smoke `daily` isolado, envie `POST` a `{SUPABASE_URL}/functions/v1/notify-ticket-communications` com corpo `{ "action": "daily" }` e somente os headers `Content-Type: application/json` e `apikey: <valor seguro da key>`. Não envie `Authorization`, service-role key ou segredo Microsoft.

Espere `200` com `ok`, `prepared`, `sent` e `failed` numéricos; confirme o e-mail da mailbox autorizada e a atividade Teams do usuário de homologação. Para testar o fluxo dirigido de interface, faça `ticket_resolved` com sessão de usuário e ticket de homologação resolvido; esse comando exige RLS e não substitui o smoke `daily` isolado.

Audite as entregas em sessão administrativa:

```sql
select
  ticket_id,
  notification_type,
  channel,
  status,
  attempt_count,
  claim_token,
  next_attempt_at,
  sent_at,
  last_error
from public.app_c009c0e4f1_ticket_notification_deliveries
order by created_at desc
limit 50;
```

Espere uma linha `sent` por canal elegível. Observe também `backlog` e `budgetExhausted` na resposta: se houver backlog, os disparos de continuação abaixo o drenam no mesmo ciclo. Falhas são registradas e reagendadas; fencing por `claim_token`/`attempt_count` impede um worker antigo de concluir um lease novo.

## 6. Criar e ativar o cron em produção

Somente após o smoke isolado aprovado, replique a configuração aprovada no ambiente de produção, usando a secret key de produção e os controles Exchange do caminho escolhido. Crie/ative disparos **`0,10,20,30,40,50 12 * * *`** (12:00–12:50 UTC): o primeiro preserva o ciclo das 09:00 em `America/Sao_Paulo` e os demais drenam backlog. Todos usam `POST {SUPABASE_URL}/functions/v1/notify-ticket-communications`, corpo `{ "action": "daily" }`, `Content-Type: application/json` e a key de produção somente no header `apikey`. A mesma data local gera o mesmo `cycle_key`, portanto continuações são idempotentes e não criam outra entrega diária.

Não registre essa key em SQL, Git ou logs. Não agende fora da janela documentada sem revisar orçamento, timeout e observabilidade do backlog.

## 7. Diagnóstico

| Sintoma | Verificação e ação |
| --- | --- |
| HTTP `401` da Function | Confirme a secret key `ticket-communications` no header `apikey`, seu ambiente correto e ausência de valor truncado. Para `401` Graph, valide tenant, client ID, client secret e consentimentos sem registrar credenciais. |
| Graph `403` | Verifique `User.Read.All`; no Caminho A, `Application Mail.Send` e o escopo RBAC; no Caminho B, `Mail.Send` consentido e o teste da AAP. Para Teams, confira RSC, publicação e instalação pessoal. |
| App Teams não instalado | Aplique a política pessoal ao destinatário e aguarde propagação; não adicione bot/chat/canal nem permissões amplas. |
| UPN não resolvido ou Graph `404` | Verifique `userPrincipalName`/`mail`. O código tenta os domínios corporativos e filtro por `mail`; sem resultado único, grava `entra_user_not_found` e tenta novamente no próximo dia. |
| Graph `429` | Respeite `Retry-After`. A Function tenta até três vezes; se esgotar, grava `graph_http_429` e reagenda a próxima execução diária. |
| `budgetExhausted: true` | Confira o `backlog` sanitizado e os disparos de continuação pós-09h. Não altere `cycle_key` nem crie jobs com payload diferente para drenar a fila. |

Após o rollout, acompanhe a tabela de entregas nas primeiras execuções. Preserve os artefatos e segredos fora do repositório.

## 8. Semântica de entrega externa

A fila oferece deduplicação local, revalidação por entrega e fencing de leases, mas o envio externo é **at-least-once residual**, não exactly-once. Se o Graph aceitar `sendMail` e a resposta ou a conclusão no banco se perder, o retry poderá duplicar o e-mail. Não prometa ausência absoluta de duplicatas distribuídas; investigue pelo horário Graph, `attempt_count` e auditoria da entrega.
