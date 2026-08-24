# Comunicações de chamados por e-mail e Microsoft Teams

## Objetivo

Avisar exclusivamente a pessoa que abriu o chamado quando o atendimento for finalizado, quando o suporte estiver aguardando uma resposta dela há mais de 48 horas e quando uma avaliação estiver pendente há mais de 72 horas. Os avisos serão enviados por Supabase Edge Functions usando Microsoft Graph, sem dependência de n8n ou Power Automate.

## Escopo e regras de produto

O sistema terá três tipos de comunicação:

1. `resolved_feedback_invite`: um e-mail enviado assim que o chamado for finalizado, com link que abre diretamente a avaliação.
2. `awaiting_requester`: e-mail e notificação do Teams quando a última mensagem humana do chamado tiver sido enviada pelo suporte há pelo menos 48 horas e a pessoa que abriu o chamado ainda não tiver respondido.
3. `awaiting_feedback`: e-mail e notificação do Teams quando o chamado estiver finalizado há pelo menos 72 horas e continuar sem avaliação.

As durações são horas corridas. O processamento recorrente acontece diariamente às 09:00 no fuso `America/Sao_Paulo`.

Os dois lembretes recorrentes são repetidos uma vez por dia enquanto a condição permanecer verdadeira. Uma execução repetida no mesmo dia não pode gerar uma segunda entrega do mesmo tipo e canal.

Todos os avisos têm como único destinatário o usuário de `ticket.created_by`, resolvido na tabela `app_c009c0e4f1_users`. Um chamado sem usuário ou sem e-mail válido é registrado como falha de configuração e não é enviado a outra pessoa.

Mensagens automáticas preservam um `user_id` UUID válido do ator e são marcadas por `is_system = true`; elas não participam da determinação da última resposta humana. Para a regra `awaiting_requester`, uma mensagem humana é considerada do solicitante quando `message.user_id = ticket.created_by`; qualquer outra mensagem humana é considerada resposta do suporte. O lembrete só é elegível quando a mensagem humana mais recente for do suporte. Assim que o solicitante responder, a condição deixa de existir. Se o suporte enviar uma nova mensagem depois disso, um novo prazo de 48 horas começa na data dessa mensagem.

Chamados reconhecidos por `isNpsExemptTicket` não recebem `resolved_feedback_invite` nem `awaiting_feedback`. A isenção não afeta `awaiting_requester` enquanto o chamado estiver ativo.

Na ativação, será gravada a configuração `ticket_communications_enabled_at` em `app_c009c0e4f1_integration_settings`. Convites de finalização e lembretes de avaliação só considerarão chamados cujo `resolved_at` seja igual ou posterior a esse instante. Isso evita um disparo em massa para chamados históricos. Chamados ainda ativos poderão participar normalmente de `awaiting_requester` na primeira execução, pois representam pendências atuais.

## Experiência do destinatário

O e-mail de finalização e o lembrete de avaliação usam:

`{APP_PUBLIC_URL}/tickets/{ticketId}?showFeedback=true`

Essa rota já abre o chamado e solicita a exibição do modal de avaliação. O lembrete de resposta usa:

`{APP_PUBLIC_URL}/tickets/{ticketId}`

Os e-mails terão assunto específico, resumo do chamado, motivo do contato, chamada para ação e link textual de contingência. O HTML será simples, responsivo e terá também uma versão textual equivalente.

No Teams, o aviso aparecerá no feed Atividade e poderá gerar banner, som e notificação do sistema conforme as preferências pessoais do usuário. Como tópicos com `source = text` exigem URL Teams, o clique usará `https://teams.microsoft.com/l/entity/{teamsAppId}/ticket-detail?webUrl={ticketUrl codificada}&label={label codificada}` para a tab pessoal estática `ticket-detail`. O link HTTPS direto do chamado continuará explícito no conteúdo e no parâmetro `webUrl`. Não será criada uma mensagem em chat. O `chainId` será derivado deterministicamente da entrega e do ciclo.

## Arquitetura

### Edge Function

Será criada a Edge Function `notify-ticket-communications`, com autenticação explícita pelo `@supabase/server` e dois comandos:

- `ticket_resolved`, recebido do cliente após uma finalização bem-sucedida, contendo apenas `ticketId`;
- `daily`, autorizado somente para a rotina administrativa agendada.

O comando nunca confiará em dados de destinatário ou conteúdo enviados pelo cliente. A Function carregará chamado, usuário e mensagens diretamente do banco e recalculará a elegibilidade.

`ticket_resolved` tentará enviar imediatamente o convite de avaliação. O fluxo de finalização continuará concluído mesmo se a comunicação falhar. A falha será persistida e recuperada pela rotina diária.

`daily` fará quatro trabalhos na mesma execução:

1. recuperar convites imediatos que estejam ausentes ou tenham falhado;
2. selecionar chamados ativos aguardando o solicitante há pelo menos 48 horas;
3. selecionar chamados finalizados sem avaliação há pelo menos 72 horas;
4. processar entregas pendentes ou retentáveis.

As regras de elegibilidade ficarão em funções SQL/RPC para que seleção, reserva de trabalho e deduplicação ocorram no banco. A montagem de conteúdo e a comunicação com o Graph ficarão na Edge Function.

### Persistência e idempotência

Será criada a tabela `app_c009c0e4f1_ticket_notification_deliveries` com:

- `id uuid`;
- `ticket_id uuid`;
- `notification_type text` limitado aos três tipos definidos;
- `channel text` limitado a `email` e `teams`;
- `cycle_key text`;
- `status text` limitado a `pending`, `processing`, `sent`, `failed` e `cancelled`;
- `attempt_count integer`;
- `claim_token uuid`;
- `next_attempt_at timestamptz`;
- `processing_started_at timestamptz`;
- `sent_at timestamptz`;
- `last_error text` sanitizado;
- `created_at` e `updated_at`.

A restrição única `(ticket_id, notification_type, channel, cycle_key)` impedirá duplicações. Para o convite imediato, `cycle_key` será o valor de `resolved_at`, permitindo novo convite caso um chamado seja reaberto e finalizado novamente. Para lembretes recorrentes, a chave representará a data local da rodada no formato `YYYY-MM-DD`.

Se uma entrega diária anterior ainda não tiver sido enviada, ela será retentada antes de criar uma nova entrega do mesmo tipo e canal. O sucesso tardio valerá como a comunicação daquele dia; outra entrega só poderá ser criada numa rodada posterior. E-mail e Teams terão linhas separadas, de modo que sucesso em um canal não provoque reenvio quando apenas o outro falhar.

Uma RPC de reserva usará atualização atômica, token de claim, versão por `attempt_count` e prazo de processamento. A conclusão só será aceita para o item ainda em `processing` cujo token e versão coincidam; um worker antigo não poderá sobrescrever um lease renovado. Itens presos em `processing` por mais de 15 minutos voltarão a ser elegíveis. Convites de resolução cujo `cycle_key` não seja exatamente o `resolved_at` atual serão cancelados como stale antes da reserva. O processador drenará vários lotes sob orçamento explícito de entregas, lotes e tempo, retornando e registrando o backlog se o orçamento terminar.

A transição para `resolved` e a definição de `resolved_at` ocorrerão numa RPC condicional única. Ela informará se a chamada venceu a transição; somente o vencedor persistirá a mensagem automática e disparará o preparo imediato. Isso cobre também o fluxo de criação de ticket já resolvido.

### Microsoft Graph

A Function obterá token pelo fluxo OAuth 2.0 `client_credentials`, usando:

- `TICKET_COMMUNICATIONS_MICROSOFT_TENANT_ID`;
- `TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID`;
- `TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_SECRET`;
- `TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER`;
- `TICKET_COMMUNICATIONS_MICROSOFT_TEAMS_APP_ID`;
- `APP_PUBLIC_URL`.

O registro e as credenciais são dedicados a comunicações de tickets e não reutilizam `MICROSOFT_*` do SharePoint. `APP_PUBLIC_URL` exige HTTPS, rejeita userinfo, query e fragment, e normaliza o pathname/base. O token respeitará `expires_in`, será renovado uma vez após `401` e nunca será persistido no banco ou em logs.

Além do privilégio de envio escolhido, a aplicação terá `User.Read.All` para resolver o identificador Microsoft Entra do destinatário. A resolução verificará primeiro o endereço original como UPN e como `mail`; somente sem correspondência original tentará variantes corporativas `@bpplaw.com.br` e `@bismarchipires.com.br`. Uma variante nunca vencerá antes do `mail` original. O envio do Teams usará o ID Microsoft Entra resolvido; a falha de resolução não afetará o envio por e-mail.

E-mails serão enviados por `POST /users/{TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER}/sendMail`. O caminho recomendado é Exchange Online Application RBAC, atribuindo `Application Mail.Send` apenas à mailbox/grupo remetente, sem consentimento global Entra `Mail.Send`; a alternativa de compatibilidade é `Mail.Send` global no Entra acompanhado obrigatoriamente de Application Access Policy `RestrictAccess`. Os caminhos são mutuamente exclusivos porque grants são aditivos: o `Mail.Send` global não pode coexistir com RBAC, mas é necessário no caminho AAP; `User.Read.All` permanece consentido para a resolução de destinatários.

Notificações do Teams serão enviadas por `POST /users/{userId-or-UPN}/teamwork/sendActivityNotification`, com a permissão de aplicação de consentimento específico ao recurso `TeamsActivity.Send.User`, que é a opção de menor privilégio para um app instalado no escopo pessoal do usuário. O manifesto declara a tab pessoal estática `ticket-detail` e o activity type `ticketCommunication`, com os parâmetros `notificationText` e `ticketUrl`; o tópico textual usa o deep link Teams e o conteúdo mantém o link direto do chamado. A permissão ampla `TeamsActivity.Send` não será solicitada por padrão.

O Microsoft Entra app ID deverá constar em `webApplicationInfo` no manifesto do aplicativo Teams. O aplicativo Teams deverá estar instalado no escopo pessoal do destinatário. O repositório conterá o manifesto versionado e instruções de empacotamento, publicação no catálogo da organização e instalação. A instalação pode ser feita administrativamente pelo Graph, mas não fará parte do envio de cada aviso.

## Agendamento

O primeiro comando `daily` será agendado às 12:00 UTC, equivalente a 09:00 em `America/Sao_Paulo`. Disparos de continuação poderão ocorrer em intervalos curtos após 12:00 UTC para drenar backlog; todos recalculam o mesmo `cycle_key` diário local e são idempotentes, sem criar uma segunda comunicação diária.

A chamada agendada usará uma secret key nomeada `ticket-communications`, armazenada no Vault/ambiente seguro do Supabase e enviada somente no header `apikey`; nenhum JWT, service role key ou segredo Microsoft será gravado em migrations ou arquivos versionados. As instruções de implantação descreverão a criação do agendamento no painel do Supabase e uma chamada manual de verificação.

## Retentativas e tratamento de erros

Respostas `429`, `408` e `5xx` do Graph são transitórias. A Function respeitará `Retry-After` quando presente e fará até três tentativas na execução, com espera limitada. Persistindo a falha, a entrega ficará `failed` e terá `next_attempt_at` calculado para nova tentativa pela próxima execução.

Erros `4xx` de configuração, usuário inexistente, aplicativo Teams não instalado ou permissão ausente serão registrados de forma sanitizada. A rotina voltará a tentar no processamento diário para permitir recuperação depois de uma correção administrativa, mas não criará uma segunda entrega para contornar a primeira.

O campo `last_error` armazenará código HTTP, categoria e mensagem truncada. Headers, tokens, segredos e corpo completo de respostas do Graph não serão persistidos nem registrados no console.

Falhas de e-mail ou Teams não alteram o estado do chamado, não revertem avaliação e não bloqueiam a interface. A invocação imediata exibirá apenas telemetria técnica; o usuário que finaliza continuará vendo o resultado da operação principal. Requests Graph e aquisição de token têm timeout, retries transitórios limitados e teto para `Retry-After`.

As entregas externas têm semântica residual **at-least-once**, não exactly-once. O Graph pode aceitar `sendMail` e a Function perder a resposta ou falhar antes de concluir a linha; o retry poderá duplicar o e-mail. Fencing evita workers locais stale, mas não cria transação distribuída com o Graph.

## Segurança e autorização

O comando `ticket_resolved` exigirá usuário autenticado e verificará no banco se o chamado está realmente finalizado. Repetições são seguras pela chave única.

O comando `daily` não será acessível como ação administrativa comum da interface. Ele exigirá `authMode = secret` validado pelo `@supabase/server` contra a secret key nomeada `ticket-communications` e executará consultas privilegiadas somente dentro da Edge Function. O comando `ticket_resolved` exigirá `authMode = user`. Como secret keys não são JWTs, a configuração da Function terá `verify_jwt = false`; isso não a torna pública, pois o SDK valida ambos os modos antes do handler.

Todas as tabelas novas terão RLS habilitada e nenhuma política de leitura ou escrita para `anon` ou `authenticated`. O acesso ocorrerá apenas por service role e por RPCs restritas ao service role.

Conteúdo inserido em HTML será escapado. URLs serão construídas somente a partir da base configurada e do UUID do chamado. O destinatário sempre será obtido da tabela de usuários, nunca do corpo da requisição.

## Componentes e responsabilidades

- Migration SQL: cria tabela, índices, restrições, RLS e RPCs de seleção/reserva/conclusão.
- `notify-ticket-communications/_shared/rules`: regras puras de elegibilidade, ciclo diário e isenção de avaliação.
- `notify-ticket-communications/_shared/templates`: assuntos e corpos de e-mail/Teams, links e escape de HTML.
- `notify-ticket-communications/_shared/graphClient`: autenticação, envio, classificação de erros e retentativas.
- `notify-ticket-communications/index.ts`: autenticação da requisição, leitura do banco e orquestração.
- serviço do frontend: invoca `ticket_resolved` depois que a finalização do chamado for confirmada.
- manifesto e guia do Teams: artefato administrativo necessário para notificações no feed Atividade.

Cada unidade terá interface própria e não dependerá de componentes React para aplicar regras de prazo ou construir mensagens.

## Observabilidade

O retorno da Function informará quantidade selecionada, enviada, ignorada e com falha por tipo e canal, sem dados pessoais. Logs estruturados incluirão `ticketId`, tipo, canal, tentativa e categoria do resultado.

A tabela de entregas permitirá auditoria operacional sem armazenar o conteúdo integral das mensagens. Consultas de diagnóstico poderão identificar falhas recentes e itens presos, mas não serão expostas na interface nesta entrega.

## Testes e critérios de aceitação

Os testes automatizados validarão:

- convite imediato somente para chamado finalizado e não isento;
- novo convite depois de reabertura e nova finalização;
- elegibilidade exatamente ao completar 48 horas;
- ausência de lembrete quando a última mensagem humana for do solicitante;
- início de novo prazo após uma nova mensagem do suporte;
- mensagens de sistema ignoradas;
- elegibilidade exatamente ao completar 72 horas sem avaliação;
- interrupção dos lembretes depois da avaliação;
- exclusão de NPS nos dois avisos de avaliação;
- repetição em dias diferentes e deduplicação no mesmo dia;
- independência entre e-mail e Teams;
- recuperação de item preso em processamento;
- links diretos corretos, inclusive `showFeedback=true`;
- escape de conteúdo HTML;
- classificação de falhas permanentes e transitórias do Graph;
- respeito a `Retry-After` e limite de tentativas;
- falha da comunicação sem falha ou reversão da finalização.

Antes da entrega serão executados os testes direcionados, a suíte completa, lint e build. A verificação de integração incluirá um e-mail de teste e uma notificação do Teams para um usuário de homologação com o aplicativo Teams instalado.

## Fora de escopo

- mensagens em chats ou canais do Teams;
- painel administrativo de templates ou histórico de entregas;
- preferências individuais de opt-out dentro do Responsum;
- regras de dias úteis ou calendário de feriados;
- anexos nos e-mails;
- substituição das notificações push e WhatsApp existentes.
