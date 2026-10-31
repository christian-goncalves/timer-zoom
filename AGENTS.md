# Instruções para o Codex neste projeto

## Propósito

Este projeto é um Zoom App de cronômetro compartilhado para reuniões. Leia `README.md` e as imagens em `docs/references/` antes de alterar a interface ou a integração.

## Direção de implementação

- Desenvolva a aplicação como web app em React, TypeScript e Vite, usando `@zoom/appssdk` para a integração com o cliente Zoom.
- Priorize uma tela mobile-first e adaptável ao painel do Zoom. Teste também a largura de desktop.
- Reproduza o conteúdo do app mostrado nas referências: fundo preto, tipografia clara, azul para ações principais, verde durante a contagem e vermelho no último minuto, divisórias discretas e botões arredondados.
- Use os tempos rápidos 3, 5 e 10 minutos, conforme o requisito do projeto, mesmo que a captura parada mostre 1, 3 e 10.
- O valor inicial deve ser cinco minutos, exibido como `00:05:00`.
- Inclua os controles de iniciar, pausar/retomar, encerrar/zerar e acrescentar 30 segundos. Não implemente cronômetro progressivo nem fila de próximos timers na primeira versão.
- Traduza os rótulos da interface para português do Brasil, preservando a hierarquia visual das imagens.
- Não recrie barra de status do iOS/Android, cabeçalho do Zoom, moldura da reunião, vídeo de participante ou controles do sistema. Eles não pertencem ao conteúdo web do app. A origem e a função do avatar e do seletor na parte inferior das capturas ainda não foram confirmadas; não os interprete como controles do timer sem evidência.

## Regras para integração Zoom

- Inicialize o SDK com `zoomSdk.config()` antes de usar outras APIs.
- Solicite e habilite somente as capacidades necessárias para o protótipo, incluindo `setDynamicIndicator` e, quando necessário, `getDynamicIndicator` e `removeDynamicIndicator`.
- Consulte as APIs suportadas no cliente atual; não suponha que desktop e Android ofereçam o mesmo conjunto.
- Use `setDynamicIndicator` para publicar o timer nativo do Zoom quando estiver disponível. Trate erros e APIs ausentes com uma mensagem clara no app.
- Não prometa que `setDynamicIndicatorStyle` muda a cor do indicador compartilhado no Android: a documentação consultada lista essa operação para desktop. Valide no Android antes de depender dela.
- Se o indicador nativo não puder mudar de cor no Android, mantenha correta a mudança de cor no visor do app e registre a limitação. Não desenhe uma falsa cópia da interface nativa do Zoom.
- Encerre/remova o indicador nos fluxos de parada e fim de reunião, se a API suportada permitir.
- Não adicione backend, banco de dados, autenticação própria ou dependências grandes sem necessidade demonstrada.
- Nunca coloque segredos do Zoom no código do navegador.

## Lógica do cronômetro

- Calcule o tempo restante com base em um prazo final (`deadline`), não decrementando um contador fixo a cada intervalo.
- Ao pausar, guarde o tempo restante; ao retomar, gere um novo prazo final.
- Ao acrescentar 30 segundos, atualize o prazo final e a contagem publicada.
- Considere concluído quando o tempo restante chegar a zero; evite valores negativos, salvo se um requisito futuro pedir contagem excedente.
- A transição visual para vermelho ocorre quando restarem 60 segundos ou menos.
- Mantenha a lógica do timer separada dos componentes visuais e da ponte com o SDK do Zoom.

## Forma de trabalhar

- Antes de alterar arquivos existentes, inspecione a estrutura atual do projeto.
- Faça mudanças pequenas e coerentes com o escopo da primeira versão.
- Não instale dependências nem altere configurações sem explicar por que são necessárias.
- Não invente resultados de testes. Só execute verificações quando forem solicitadas ou necessárias para validar uma mudança concreta, e informe exatamente o que foi verificado.
- Ao terminar uma etapa, resuma os arquivos alterados, o comportamento implementado e as limitações ainda não verificadas no Android.
