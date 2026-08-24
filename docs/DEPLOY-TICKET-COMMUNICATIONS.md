# Implantação das comunicações de chamados

Este runbook publica o envio de e-mail e o aviso no feed **Atividade** do Teams da Edge Function `notify-ticket-communications`. Ele não cria ícones, não gera o ZIP e não registra valores secretos no repositório.

## Escopo e referências

- O template usa o [schema Teams 1.28](https://developer.microsoft.com/json-schemas/teams/v1.28/MicrosoftTeams.schema.json). Ele contém somente o RSC de aplicação `TeamsActivity.Send.User`, para instalação pessoal; não contém bot, chat, canal nem a permissão ampla `TeamsActivity.Send`.
- O código chama `POST /users/{id}/teamwork/sendActivityNotification` com `activityType: "systemDefault"`. Esse tipo interno não deve ser declarado como activity no manifesto. Consulte [enviar notificações de atividade](https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications) e a [referência da operação para usuário](https://learn.microsoft.com/en-us/graph/api/userteamwork-sendactivitynotification?view=graph-rest-1.0).
- A Function usa credenciais de aplicação do Microsoft Graph. Consulte a [referência de permissões Microsoft Graph](https://learn.microsoft.com/graph/permissions-reference) e a orientação para [restringir acesso de apps a caixas de correio](https://learn.microsoft.com/exchange/permissions-exo/application-rbac).

Antes do upload, a equipe proprietária deve aprovar as URLs legais e os ícones oficiais. Em particular, confirme que as páginas de privacidade e termos usadas no pacote estão publicadas e aprovadas; se o catálogo do tenant exigir outras páginas corporativas aprovadas, substitua-as **no `manifest.json` do pacote**. Não altere o template versionado sem a aprovação correspondente.

## 1. Conceder permissões Microsoft Entra

No registro de aplicativo correspondente a `MICROSOFT_CLIENT_ID`, adicione as permissões de **aplicação** Microsoft Graph `Mail.Send` e `User.Read.All`, e execute o consentimento administrativo do tenant. A Function obtém token client-credentials com o escopo `https://graph.microsoft.com/.default`, envia e-mail como `MICROSOFT_NOTIFICATION_SENDER` e resolve o usuário Teams por UPN/e-mail.

Não solicite `TeamsActivity.Send` amplo. A permissão para atividade é a RSC `TeamsActivity.Send.User` do manifesto Teams, aprovada durante a instalação pessoal descrita no passo 5.

## 2. Restringir a caixa remetente

Quando o tenant disponibilizar Application Access Policy para a aplicação, restrinja `Mail.Send` exclusivamente à caixa definida por `MICROSOFT_NOTIFICATION_SENDER`. A associação deve cobrir somente o grupo/caixa autorizada e o AppId do registro usado pela Function; valide a política com a equipe Exchange antes do smoke test. Isso limita o uso de `Mail.Send` mesmo que o consentimento Graph seja de aplicação. Para tenants que já migraram o controle para RBAC for Applications, aplique o controle equivalente de escopo de caixa segundo a orientação oficial.

## 3. Preparar os ícones oficiais

Parta apenas dos ativos oficiais aprovados do Responsum. Exporte PNGs sem gerar novas artes:

- `color.png`: 192 × 192 pixels, colorido;
- `outline.png`: 32 × 32 pixels, PNG transparente com contorno branco.

Valide dimensões, transparência e direitos de uso antes de copiá-los para `teams/responsum-notifications/`. Esses arquivos finais são deliberadamente ignorados pelo Git.

## 4. Montar e publicar o pacote Teams

1. Copie `teams/responsum-notifications/manifest.template.json` para `teams/responsum-notifications/manifest.json`.
2. Substitua apenas `${MICROSOFT_TEAMS_APP_ID}` pelo App ID Teams e `${MICROSOFT_CLIENT_ID}` pelo Client ID Entra; ambos devem ser GUIDs do tenant.
3. Revalide o JSON no Developer Portal e confirme as URLs legais aprovadas, os dois ícones e o RSC. O schema exige `color.png` e `outline.png` no nível raiz do pacote.
4. Crie um ZIP contendo exatamente `manifest.json`, `color.png` e `outline.png` na raiz, sem diretório-pai. Publique-o no catálogo da organização pelo Teams Admin Center/Developer Portal conforme a política do tenant.

Não comite `manifest.json`, os PNGs ou o ZIP; `.gitignore` cobre esses artefatos. Não faça upload até a aprovação formal das URLs legais e dos ícones.

## 5. Aprovar e instalar o app Teams

No Teams Admin Center, revise a permissão RSC `TeamsActivity.Send.User` com tipo `Application`. Publique/aprove o aplicativo e use uma política de instalação para disponibilizá-lo no escopo **pessoal** dos usuários que receberão avisos, concedendo o consentimento específico ao recurso na instalação. A atividade `systemDefault` enviada pelo Graph não cria uma seção `activities` no manifesto.

Para o primeiro teste, instale o app também para o usuário de homologação. Um envio para usuário sem o aplicativo pessoal instalado deve ser tratado como configuração pendente, não como motivo para ampliar a permissão ou criar bot/canal.

## 6. Configurar os seis secrets da Edge Function

No Supabase, em Edge Function Secrets, configure somente os valores de produção destes nomes (também documentados em `.env.example`):

| Secret | Uso |
| --- | --- |
| `MICROSOFT_TENANT_ID` | Tenant do Microsoft Entra. |
| `MICROSOFT_CLIENT_ID` | Registro de aplicativo usado no Graph e no pacote Teams. |
| `MICROSOFT_CLIENT_SECRET` | Credencial client-secret do registro. |
| `MICROSOFT_NOTIFICATION_SENDER` | Caixa autorizada como remetente. |
| `MICROSOFT_TEAMS_APP_ID` | App ID do pacote Teams publicado. |
| `HELPDESK_APP_BASE_URL` | URL HTTP(S) base do Responsum para links dos avisos. |

Não copie valores para `.env.example`, migrations, documentação, logs ou comandos versionados.

## 7. Aplicar banco e publicar a Function

1. Aplique a migration `supabase/migrations/20260824150304_ticket_communications.sql` no projeto Supabase de destino (por exemplo, via fluxo aprovado `supabase db push`). Ela cria `app_c009c0e4f1_ticket_notification_deliveries` e as RPCs de fila.
2. Publique `supabase/functions/notify-ticket-communications/` (por exemplo, `supabase functions deploy notify-ticket-communications`).
3. Confirme no `supabase/config.toml` que `notify-ticket-communications` está com `verify_jwt = false`. Isto é necessário porque a Function usa `@supabase/server` para aceitar `auth: ['user', 'secret:ticket-communications']`; não torna o endpoint público. Esse uso de secret key no header `apikey` segue a [autorização de Edge Functions](https://supabase.com/docs/guides/functions/auth).

O comando `ticket_resolved` exige sessão de usuário e visibilidade RLS do ticket. O comando agendado `daily` exige a secret key do passo seguinte.

## 8. Criar a key e o cron diário

1. Crie no painel Supabase uma secret key chamada `ticket-communications` e guarde seu valor somente no Vault/painel de segredos aprovado.
2. Crie no agendador do Supabase um job com cron **`0 12 * * *`** (12:00 UTC), que faça `POST` para `{SUPABASE_URL}/functions/v1/notify-ticket-communications`.
3. Use corpo JSON exatamente `{ "action": "daily" }` e headers `Content-Type: application/json` e `apikey: <valor da key ticket-communications>`. Não envie `Authorization`, service-role key ou qualquer segredo Microsoft; não grave o valor da key em SQL, Git ou logs.

O horário está alinhado ao processador, que reagenda falhas para a próxima execução diária às 12:00 UTC.

## 9. Smoke test e auditoria

Com um usuário de homologação que tenha e-mail válido, usuário Entra resolvível e o app Teams pessoal instalado:

1. Execute uma chamada controlada ao endpoint com a key segura e `{ "action": "daily" }`; espere `200` com `ok`, `prepared`, `sent` e `failed` numéricos.
2. Confirme o e-mail vindo exclusivamente de `MICROSOFT_NOTIFICATION_SENDER` e o aviso no feed Atividade do Teams com link para o Responsum.
3. Em uma sessão administrativa de banco, consulte a auditoria sem expor dados pessoais além do necessário:

```sql
select
  ticket_id,
  notification_type,
  channel,
  status,
  attempt_count,
  next_attempt_at,
  sent_at,
  last_error
from public.app_c009c0e4f1_ticket_notification_deliveries
order by created_at desc
limit 50;
```

Espere uma linha `sent` por canal elegível. Falhas são registradas e reagendadas para a próxima rotina diária; a fila impede uma segunda entrega pendente para o mesmo ticket, tipo e canal.

## 10. Diagnóstico

| Sintoma | Verificação e ação |
| --- | --- |
| HTTP `401` da Function | Confirme que a chamada `daily` enviou exclusivamente a secret key `ticket-communications` no header `apikey`, que a key existe e que não houve valor copiado/truncado. Para `401` do Graph, valide tenant, client ID, client secret e consentimento administrativo sem registrar a credencial. |
| Graph `403` | Confirme `Mail.Send` e `User.Read.All` como permissões de aplicação com consentimento; valide o escopo de `MICROSOFT_NOTIFICATION_SENDER` na Application Access Policy/RBAC. Para Teams, confirme o RSC `TeamsActivity.Send.User` e o consentimento na instalação pessoal. |
| App Teams não instalado | Instale/aplique a política no escopo pessoal do destinatário e aguarde a propagação. Não substitua isso por bot, chat, canal ou permissão ampla. |
| UPN não resolvido ou Graph `404` | Verifique a correspondência entre o e-mail do solicitante e `userPrincipalName`/`mail` no Entra. O código tenta os domínios `bpplaw.com.br` e `bismarchipires.com.br`, depois filtro por `mail`; se não houver único resultado, registra `entra_user_not_found` e tenta novamente no próximo dia. |
| Graph `429` | Respeite `Retry-After`. A Function tenta até três vezes com backoff; se esgotar, registra `graph_http_429` e agenda a próxima tentativa diária. Não aumente a frequência do cron para contornar throttling. |

Após o smoke, preserve o pacote e os valores secretos fora do repositório e acompanhe a tabela de entregas nas primeiras execuções diárias.
