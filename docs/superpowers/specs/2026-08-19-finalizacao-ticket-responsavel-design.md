# Finalização de ticket por usuário diferente do responsável

## Objetivo

Garantir que a contabilização de tickets finalizados reflita a pessoa que efetivamente realizou o atendimento quando ela optar por assumir o ticket antes da conclusão, sem retirar a possibilidade de concluir em nome do responsável atual.

## Regras de produto

- A regra vale para qualquer usuário com permissão de finalizar tickets, independentemente do cargo.
- Quando o ticket já estiver atribuído ao usuário que está finalizando, o fluxo atual de confirmação é mantido.
- Quando o ticket estiver atribuído a outra pessoa, o sistema deve exibir o responsável atual e oferecer três ações:
  - finalizar mantendo o responsável atual;
  - transferir para o usuário atual e finalizar;
  - cancelar.
- Quando o ticket não tiver responsável, ele deve ser automaticamente atribuído ao usuário que está finalizando.
- Para tickets de auditoria FATAL, a decisão de responsável acontece antes da pergunta sobre envio de evidência.
- Escolher manter o responsável atual não altera os campos de atribuição.
- Escolher assumir, ou finalizar um ticket sem responsável, grava o identificador e o nome do usuário atual como responsável antes da conclusão lógica do fluxo.

## Interface

O componente de finalização receberá o identificador e o nome do responsável atual.

Ao abrir o fluxo:

1. Se houver outro responsável, será exibida uma caixa de decisão com o nome dele e duas ações de finalização claramente distintas.
2. Se não houver responsável, a confirmação informará que o ticket será atribuído automaticamente ao usuário atual.
3. Se o ticket já pertencer ao usuário atual, a confirmação existente será usada sem etapa adicional.
4. Se for uma auditoria FATAL, depois de definida a atribuição será exibida a etapa de evidência já existente.

Durante a operação, as ações ficam desabilitadas e o texto indica que a finalização está em andamento.

## Serviço e fluxo de dados

`TicketService.finishTicket` aceitará uma opção explícita para atribuir o ticket ao usuário que está finalizando. O serviço continuará consultando o estado atual antes da alteração e montará uma única atualização contendo:

- `status: resolved`;
- `assigned_to`, `assigned_to_name` e o horário de atribuição, somente quando for necessário assumir o ticket;
- os campos de decisão de evidência, quando aplicáveis.

A atualização conjunta impede estados intermediários em que o ticket foi transferido mas não finalizado, ou finalizado antes de a atribuição ser gravada.

A mensagem automática de NPS e o callback do SIOE permanecem no fluxo existente. A decisão do usuário sobre a atribuição é propagada até o serviço antes da finalização.

## Concorrência e erros

O responsável considerado pela interface é o estado carregado do ticket. O serviço consulta novamente o ticket no início da finalização e aplica a escolha explícita:

- na opção de assumir, o usuário atual se torna responsável mesmo que a atribuição tenha mudado desde a abertura da caixa;
- na opção de manter, nenhum campo de atribuição é enviado e prevalece o responsável presente no banco no momento da atualização;
- em ticket sem responsável, a interface solicita atribuição automática ao usuário atual.

Se a atualização falhar, a caixa permanece disponível, o callback de conclusão da interface não é executado e uma mensagem de erro é exibida. Nenhum toast de sucesso deve aparecer.

## Compatibilidade

As duas utilizações atuais de `FinishTicketButton`, em `TicketChatPanel` e `ChatModal`, fornecerão os dados do responsável. O comportamento de permissões, NPS, evidência FATAL e atualização visual após finalizar será preservado.

Não será criada migration nem função RPC, pois a alteração necessária pode ser feita em uma única atualização da linha do ticket usando a infraestrutura atual.

## Testes

Os testes automatizados validarão pelo menos:

- ticket do próprio usuário segue diretamente para a confirmação existente;
- ticket de outra pessoa exige uma decisão;
- manter o responsável finaliza sem alterar a atribuição;
- assumir o ticket envia a atribuição do usuário atual junto com a resolução;
- ticket sem responsável é atribuído automaticamente ao usuário atual;
- auditoria FATAL preserva a decisão de evidência depois da escolha de responsável;
- falha da atualização não executa o callback de sucesso.

Além dos testes direcionados, serão executados a suíte completa, o lint e o build do projeto.
