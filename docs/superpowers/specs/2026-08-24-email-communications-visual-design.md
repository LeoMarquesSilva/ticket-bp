# Design — visual e administração dos e-mails de chamados

## Objetivo

Transformar os avisos de chamados em e-mails claros, confiáveis e alinhados à identidade Responsum, além de oferecer uma área administrativa para visualizar e ajustar os textos das três comunicações.

## Direção visual aprovada

- Layout editorial corporativo de 600 px, responsivo e construído com tabelas/estilos inline para Outlook.
- Cabeçalho grafite `#2C2D2F`, assinatura visual Responsum e filete de marca `#F69F19` → `#DE5532` → `#BD2D29`.
- Hierarquia: tipo do aviso, saudação, motivo, cartão do chamado, CTA destacado, URL alternativa e rodapé de segurança.
- O estado muda por comunicação: finalizado/avaliação, aguardando resposta e avaliação atrasada, sem alterar a identidade central.
- HTML e texto puro continuam disponíveis; todos os valores dinâmicos são escapados.

## Administração no Responsum

- Adicionar a aba `Comunicações` em `Estrutura de atendimento`, protegida pela permissão existente `manage_categories`.
- Exibir as três variantes lado a lado com seletor: `Chamado finalizado`, `Aguardando resposta` e `Avaliação pendente`.
- Permitir editar assunto, motivo e texto do botão de cada variante.
- Mostrar preview real do HTML com dados fictícios e opções desktop/mobile.
- Salvar somente texto em `app_c009c0e4f1_integration_settings`; HTML arbitrário não será aceito.
- Oferecer restauração dos textos padrão e estado explícito de carregamento/erro/salvamento.

## Fluxo

1. A tela lê um JSON versionado da configuração global.
2. O administrador edita campos de texto e vê a prévia local usando o mesmo gerador do e-mail.
3. Ao salvar, a configuração validada é persistida.
4. A Edge Function carrega a configuração uma vez por execução, aplica fallback por campo e gera e-mail/Teams.

## Segurança e compatibilidade

- Limites: assunto 140, motivo 320 e CTA 48 caracteres.
- Nenhum destinatário, URL, HTML ou segredo é configurável pela tela.
- Links continuam derivados exclusivamente de `APP_PUBLIC_URL` e do ID do chamado.
- Configuração inválida ou ausente usa os padrões versionados no código.
- O e-mail deve permanecer legível com imagens bloqueadas e em modo escuro.

## Testes

- Snapshot estrutural/asserções do HTML para identidade, CTA, fallback URL, escaping e as três variantes.
- Validação e normalização da configuração salva.
- Serviço de leitura/escrita e fallback.
- Componente administrativo: alternância de variante, preview e salvar/restaurar.
- Processador: configuração carregada e aplicada sem aceitar destinatário ou link do banco.

