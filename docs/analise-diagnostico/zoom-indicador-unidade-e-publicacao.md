# Diagnóstico do indicador Zoom: unidade do timer e publicação

## Objeto da investigação

Entender por que o indicador do Timer Zoom continua sem os dígitos após habilitar `onSetDynamicIndicator`.

## Contexto

O operador relata que, ao abrir o Zoom, o indicador continua branco no telefone e aparece como “Timer NA” no desktop. A hipótese em avaliação é que `timer.start` deve ser enviado em milissegundos, enquanto a versão atualmente servida ainda envia segundos.

## Evidências examinadas

- Relato do usuário nesta conversa: indicador branco no telefone e “Timer NA” no desktop.
- Painel Zoom Marketplace do app NA TIMER, ambiente Development: `onSetDynamicIndicator` marcado; APIs/Eventos totalizam 6 selecionados.
- Painel Zoom Marketplace do app NA TIMER, ambiente Production: `onSetDynamicIndicator` marcado; `setDynamicIndicator` e `getDynamicIndicator` marcados; total de 6 selecionados.
- `src/zoom-indicator.ts:4-10`: a lista local `requestedApis` inclui `onSetDynamicIndicator`.
- `src/zoom-indicator.ts:142-168`: o código local envia `start` multiplicado por 1.000 e chama `zoomSdk.config()` com `requestedApis`.
- `src/zoom-indicator.ts:129-135`: o código local faz uma segunda leitura de `getDynamicIndicator` após dois segundos.
- Bundle atualmente servido por `https://timer-zoom.vercel.app/`, identificado em `/assets/index-Y3Hh3ql1.js`: contém `start:Math.max(1,Math.ceil(t))`, sem multiplicação por 1.000; também contém o listener `onSetDynamicIndicator`.
- `npm run build` no checkout local concluiu com sucesso.

## Estado observado

O evento está marcado nos ambientes Development e Production do Marketplace. O código local solicita esse evento e converte `start` para milissegundos. O bundle público observado ainda envia `start` sem essa conversão. A interface do Zoom segue sem exibir os dígitos, segundo relato do usuário.

## Análise

O painel confirma a seleção do evento, mas isso não demonstra que o cliente Zoom carregou a configuração atual nem que `config()` aceitou a capacidade em execução. A diferença entre código local e bundle público explica por que o teste recente pode continuar executando a lógica antiga: a correção da unidade ainda não chegou à versão pública observada. O build local bem-sucedido confirma compilação, não comportamento no cliente Zoom.

## Hipóteses avaliadas

- **Versão pública ainda envia segundos — sustentada.** O bundle público observado contém `start` sem `* 1000`, ao contrário do código local.
- **Unidade errada causa a ausência dos dígitos — plausível, não confirmada.** A diferença de escala está demonstrada, mas ainda não houve teste do bundle corrigido dentro de uma reunião.
- **Falta de `onSetDynamicIndicator` no Marketplace — enfraquecida.** O evento está marcado em Development e Production.
- **Cliente Zoom carregou a configuração e o código mais recentes — não verificada.** Não há leitura do bundle executado pelo WebView da reunião.

## Diagnóstico

A configuração do evento foi habilitada, mas o app público continua servindo código que envia `timer.start` em segundos. Portanto, o teste relatado não valida a hipótese de milissegundos. A unidade é a principal hipótese técnica em aberto para os dígitos ausentes.

## Grau de certeza

Alto quanto à divergência entre o bundle público observado e o código local; baixo quanto a essa divergência ser a causa definitiva da falha visual.

## Pontos ainda não comprovados

- Se a reunião carregou exatamente o bundle público observado ou manteve uma cópia em cache.
- Se o Zoom interpreta `timer.start` em milissegundos em todas as versões/clientes considerados.
- Se `onSetDynamicIndicator` foi registrado e qual payload o cliente emitiu.
- Se o segundo participante vê os dígitos depois da correção publicada.
