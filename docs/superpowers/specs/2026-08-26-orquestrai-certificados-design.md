# Certificados no envio DC → ORQESTRAI

## Objetivo

No modal **Enviar para ORQESTRAI** de tickets de Desenvolvimento Contínuo, permitir criar card(s) de Marketing com três modos: só PPT, só certificados, ou os dois. O card de certificados usa o tipo oficial `Certificados`, vence 1 dia após o workshop e, depois que esse prazo passou, recebe a lista de presença do SharePoint — ou o registro de que ninguém preencheu.

## Regras de produto

- O envio continua restrito a Leonardo e Valentina (`canSendToOrquestrai`).
- O ticket no Responsum não é alterado pelo envio.
- Três modos no modal, mutuamente exclusivos no envio:
  - **PPT** — um card `request_type = PPT`, prazo = data do workshop.
  - **Apenas certificados** — um card `request_type = Certificados`, prazo = data do workshop + 1 dia civil.
  - **PPT + certificados** — os dois cards no mesmo envio.
- O tipo `Evento` deixa de ser usado. Não é tipo oficial no ORQESTRAI.
- Cada ticket pode ter no máximo um card `PPT` e um card `Certificados`. Reenvio do mesmo tipo é idempotente (não duplica). Modo misto cria só o tipo que ainda não existe.
- Card de certificados: estágio `tarefas`, assignee Valentina Iacovacci, título `[DC] Certificados — {tema}`, descrição com os dados do DC e o link da lista de presença.
- Lista de presença: [TREINAMENTOS - OPERAÇÕES LEGAIS](https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/TREINAMENTOS%20%20OPERAES%20LEGAIS?env=WebViewList) (`listId` `30ea2880-475e-489c-8600-ae541d29faf3`), no mesmo site CONTROLADORIAJURDICA já usado pela automação.
- A presença só existe depois do workshop. O envio **não** consulta nomes.
- Um job diário processa cards de certificados cujo prazo (D+1) **já passou** (data de hoje em `America/Sao_Paulo` > `deadline`).
- Uma única checagem por card:
  - com preenchimentos → grava os nomes no card;
  - sem preenchimentos → grava `Presença: não preenchida`;
  - em ambos os casos marca como processado e **não tenta de novo**.
- Falha de infraestrutura (Graph, ORQESTRAI, treinamento não localizado) **não** marca como processado, para o próximo ciclo tentar de novo. Isso não é “ninguém preencheu”.

## Interface

No modal existente (`SendToOrquestraiButton`):

1. Seletor **O que enviar** com as três opções acima, no topo, antes dos campos.
2. Prévia mostra tipo(s), estágio Tarefas, assignee e prazo de cada card.
3. Modo **Apenas certificados** oculta “Precisa de ajuste em PPT?” e o link do PPT. Tema e data continuam obrigatórios.
4. Modos **PPT** e **PPT + certificados** mantêm os campos de PPT; se PPT estiver marcado como sim, o link do PPT continua obrigatório.
5. Toasts: sucesso distinto para um card, dois cards, ou “já existe” por tipo.

## Cards no ORQESTRAI

Tabela `marketing_requests` do projeto ORQESTRAI.

- Deduplicação passa a ser por `Ticket ID` na descrição **e** `request_type`.
- Card `PPT` (modo PPT ou misto): igual ao fluxo atual de PPT (`precisaAjustePpt` define se há link). Prazo = `dataRealizacao` em ISO.
- Card `Certificados`: `request_type = Certificados`, `deadline` = dia civil seguinte a `dataRealizacao`, `link` = URL da lista de presença, descrição inclui a mesma origem Responsum + `Ticket ID` + instrução de presença.
- No modo misto, o card de certificados pode apontar `parent_request_id` para o card PPT quando este for criado ou já existir.
- Data: parse `DD/MM/AAAA` e somar 1 dia no calendário (não UTC+24h).

## Presença (job)

Nova Edge Function `orquestrai-certificados-presenca`, disparada por cron diário após o D+1 ter acabado (09:00 `America/Sao_Paulo` = `12 12 * * *` UTC, alinhado às outras rotinas). Autorização por secret key no header `apikey`, sem JWT de usuário.

Fluxo por card candidato (`request_type = Certificados`, descrição com origem Responsum, sem marcador `Presença:`, `deadline < hoje`):

1. Extrair `Ticket ID` da descrição.
2. Localizar o item em **TREINAMENTOS MINISTRADOS** (lista já gravada na criação do ticket) cujo campo Observações contém o ticket.
3. Listar itens em **TREINAMENTOS - OPERAÇÕES LEGAIS** com `NomedoTreinamento0LookupId` igual ao id desse item.
4. Resolver `ColaboradorLookupId` para nome via mapa `sharepoint_person_lookups` (e-mail/nome ↔ LookupId) já usado na automação; se não houver nome, usar o displayName do `createdBy` quando não for a conta genérica da controladoria; senão omitir o id cru e listar “Colaborador não identificado”.
5. Atualizar a descrição do card: anexar bloco `Presença:` com nomes ordenados, ou `Presença: não preenchida`.
6. Não alterar `workflow_stage` nem assignee.

Idempotência: presença do marcador `Presença:` no início de uma linha da descrição.

## Erros

- Envio: validação de tema/data (e link PPT quando o modo inclui PPT com ajuste). Falha de um tipo no modo misto não impede tentar o outro; o toast descreve o que foi criado e o que falhou.
- Job: erro de Graph/ORQESTRAI logado; card permanece sem marcador `Presença:` para nova tentativa no dia seguinte.
- Treinamento não encontrado no SharePoint: tratado como falha de infraestrutura (não grava “não preenchida”), para não perder presença de um item que ainda vá aparecer.

## Fora de escopo

- Alterar o formulário de criação do ticket DC.
- Puxar presença na hora do envio.
- Reprocessar cards já marcados.
- Criar tipo novo no ORQESTRAI (`Certificados` já existe).
- Mudar a lista de presença ou o formulário do SharePoint.

## Testes

Cobrir pelo menos:

- `dataRealizacao` 26/08/2026 → deadline certificados `2026-08-27`.
- Modo PPT cria só `PPT`; modo certificados só `Certificados`; misto os dois.
- Reenvio do mesmo tipo não duplica; misto após PPT existente cria só certificados.
- Marcador `Presença:` impede segundo processamento.
- Zero itens de presença → texto `Presença: não preenchida`.
- Itens encontrados → nomes na descrição.
- Falha ao localizar o treinamento não grava o marcador.

Além dos testes unitários: lint e build do front.
