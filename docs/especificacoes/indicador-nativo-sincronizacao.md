# Especificação: contador nativo do Zoom sincronizado com o Timer Zoom

**Escopo:** fazer o contador do indicador nativo mostrar os dígitos e acompanhar os comandos do Timer Zoom. O painel web do app permanece uma superfície separada.

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **Status**     | Rascunho para implementação                                     |
| **Responsável**| Implementação do Timer Zoom                                     |
| **Público**    | Implementador e responsável pelo produto                       |
| **Relacionado**| `src/zoom-indicator.ts`, `src/App.tsx`, documentação do Zoom Apps SDK |

---

## 1. Resumo

O Zoom já mostra o rótulo **Timer Zoom** nos clientes observados, mas não mostra os dígitos do contador nativo. Clicar no rótulo no desktop abre a janela web do app, cujo contador local não demonstra sincronização com o Zoom. A tarefa deve publicar um timer nativo regressivo e encaminhar iniciar, pausar, retomar e encerrar para o SDK, mantendo a janela local identificada como interface do operador.

A unidade de `timer.start` está confirmada pela implementação publicada do Timer oficial do Zoom: enviar duração em segundos multiplicada por 1.000 e ler `timer.start`/`timer.current` divididos por 1.000. A produção do Timer Zoom já envia `300000` para cinco minutos. Não se deve reabrir a hipótese de segundos versus milissegundos sem nova evidência.

## 2. Termos e comportamento atual

| Termo | Definição nesta tarefa |
| --- | --- |
| **Entrada do app** | Nome/ícone “Timer Zoom” mostrado na interface da reunião. Sua presença não prova que exista uma contagem nativa. |
| **Indicador nativo** | Elemento do Zoom que deve exibir os dígitos regressivos aos participantes sem que abram o Timer Zoom. |
| **Painel do app** | Webview do Timer Zoom aberta pelo operador. Seu estado local React não é prova de estado nativo compartilhado. |
| **Timer local** | Contagem mantida pela instância web do app, inclusive quando o SDK falha. |
| **Aceitação da chamada** | Retorno normal de sucesso da API. Não equivale a confirmação visual dos dígitos aos participantes. |

Fatos que fundamentam a tarefa:

| Fato | Evidência |
| --- | --- |
| O rótulo aparece em desktop e iPhone, sem dígitos nativos observáveis; tocar no iPhone não abre o app. | Relato e capturas do responsável pelo produto nesta conversa. |
| No desktop, clicar no rótulo abre o painel web com `00:05:00`, sem sincronização observada com o contador nativo. | Captura enviada nesta conversa. |
| O deployment Production `c334e865cc23c834100e6e16623abba7f41b328e` serve payload com `timer.start` multiplicado por 1.000 e segunda leitura após dois segundos. | Metadados Vercel e bundle servido em `timer-zoom.vercel.app`, inspecionados nesta investigação. |
| O Timer oficial envia `start` em milissegundos e lê `start` e `current` dividindo por 1.000. | [JavaScript publicado do Timer oficial](https://timer.zoomapp.cloud/static/js/main.2139f3da.js); o [guia oficial](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068677) identifica `setDynamicIndicator` como a API que exibe o timer nativo para participantes. |
| A referência do SDK aceita `action` `start`, `pause`, `resume` e `end`; o tipo declara `start` como número, sem unidade textual. | [DynamicIndicatorTimerOptions](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorTimerOptions.html). A unidade fica determinada pelo comportamento do Timer oficial, não pelo comentário do tipo. |
| O Android observado informou `product: mobile`, Zoom `7.2.1.43844`, contexto `inMeeting` e API disponível. | Registro fornecido pelo responsável pelo produto. |

## 3. Objetivos e limites

### Objetivos

1. Exibir dígitos regressivos no indicador nativo da reunião para participantes que não abrem o app.
2. Manter contador nativo e controles do operador coerentes em iniciar, pausar, retomar e encerrar.
3. Distinguir na telemetria e nas mensagens da interface uma chamada aceita, uma chamada lançada como exceção e a confirmação visual do observador.
4. Aproveitar os ensaios já realizados como evidência. Repetir teste em cliente real somente depois de uma alteração diagnóstica concreta e específica.

### Fora de escopo

- Fazer o app web abrir no iPhone. O iPhone é tratado como cliente observador do indicador nativo quando a API estiver disponível.
- Redesenhar a tela, o cabeçalho do Zoom, o ícone ou o nome do aplicativo.
- Adicionar backend, banco de dados, autenticação ou sincronização própria por servidor.
- Tratar a janela web aberta no desktop como o indicador nativo.
- Repetir uma bateria genérica de testes já realizada pelo responsável pelo produto.

## 4. Proposta de integração

> **Why & What - um estado de timer nativo**
>
> **What:** a instância do operador publica cada transição do contador por `setDynamicIndicator`; o contador web espelha a mesma duração e os mesmos comandos.
>
> **Why:** o objetivo é que o Zoom distribua uma única contagem nativa aos observadores, sem eles abrirem o app. A documentação oficial do Zoom descreve esse uso para `setDynamicIndicator`.
>
> **Alternativa considerada:** adicionar sincronização por backend. Isso criaria um segundo canal de estado e dependências que o requisito não demonstra serem necessárias.
>
> **Limite:** retorno de sucesso ou leitura local não substitui a confirmação de que os dígitos estão visíveis no cliente observador.

### 4.1 Payload e transições

- **Iniciar ou publicar duração nova:** enviar `timer.action: "start"`, `timer.direction: "down"` e `timer.start: Math.max(1, Math.ceil(segundos)) * 1000`.
- **Pausar:** enviar `timer.action: "pause"` sem iniciar um contador local independente no Zoom.
- **Retomar:** enviar `timer.action: "resume"`.
- **Encerrar ou zerar:** enviar `timer.action: "end"`; usar `removeDynamicIndicator` apenas quando estiver disponível e quando a política de ciclo de vida do app exigir remover também a entrada do app.
- **Editar duração enquanto pausado:** publicar a nova duração em milissegundos e manter o timer nativo pausado, seguindo o padrão já implementado pelo app.
- Manter `text: "Timer Zoom"` se o rótulo for desejado. A documentação aceita `text` e `timer` no mesmo objeto; não remover o texto sem evidência de que ele interfere no timer.
- Usar a API pública atual `zoomSdk.setDynamicIndicator`, documentada na referência do SDK v0.16.42.

### 4.2 Estado e feedback

- O timer local continua usando prazo final, como definido em `src/timer-logic.ts`, e espelha as transições enviadas ao Zoom.
- Uma resposta normal `Success`, seja objeto `{ message: "Success" }` ou a string literal observada no Android, deve ser classificada como **chamada aceita**. O feedback não deve afirmar que os participantes veem os dígitos.
- Uma exceção como `Fail to set the dynamic indicator` deve permanecer identificada como falha da chamada, separada de uma resposta de sucesso cuja confirmação visual está ausente.
- Registrar payload enviado, tipo e valor bruto do retorno, exceção completa, payload completo de `onSetDynamicIndicator` e retorno de `getDynamicIndicator`, incluindo `timer` quando existir.
- Converter `timer.start` e `timer.current` de milissegundos para segundos apenas na camada de leitura/apresentação. Se o Zoom omitir `timer`, registrar “estado do timer ausente na leitura”; não inferir que o timer está sincronizado.
- Não tratar `removeDynamicIndicator` ou `onMeeting` indisponível como prova de que `setDynamicIndicator` não funciona.

## 5. Diagnóstico direcionado

O problema já não é “qual unidade usar”. O próximo diagnóstico deve explicar por que o cliente mostra o rótulo sem apresentar a contagem. A execução deve comparar:

1. O objeto exato emitido pelo bundle Production com o payload funcional do Timer oficial: ação, direção, `start`, texto, cores e opções.
2. O retorno bruto de `setDynamicIndicator` e os campos efetivamente presentes em `getDynamicIndicator` e `onSetDynamicIndicator`.
3. Se o cliente mantém o objeto `timer` depois de receber um payload válido, distinguindo isso de uma resposta que contém somente `text`/nome do app.
4. O que as versões e o `product` retornados em runtime indicam no Android, iPhone e desktop. A referência lista versões móveis mínimas, embora algumas entradas apresentem metadados `product: desktop`; essa discrepância deve ser registrada, não resolvida por suposição.

Usar as evidências existentes dos ensaios anteriores. Um novo ensaio de reunião só é necessário depois que a comparação indicar uma mudança de payload ou código capaz de distinguir hipóteses; registrar qual hipótese o ensaio pretende separar antes de executá-lo.

## 6. Critérios de aceite

1. Com o app aberto somente pelo operador, o participante observador vê os dígitos do timer no indicador nativo, sem abrir o Timer Zoom.
2. O indicador nativo começa com o valor publicado pelo operador e diminui em sincronia; uma pausa, retomada e encerramento do operador refletem no indicador.
3. O painel web e o indicador nativo são identificados separadamente nas evidências. Abrir o painel não conta como prova do indicador.
4. O iPhone é validado como observador do indicador nativo quando o cliente reportar suporte. A ausência de abertura do app no iPhone não reprova esse requisito.
5. O caminho de sucesso aceita os formatos documentado e observado do retorno, sem apresentar sucesso visual não comprovado.
6. Se a API estiver ausente ou lançar exceção, o timer local continua funcional e a interface informa que a publicação nativa falhou ou não pôde ser confirmada.
7. Logs permitem relacionar uma ação do operador ao payload, retorno, leitura e evento recebidos, com timestamps e sem remover os campos do timer.

## 7. Entregáveis e custo

- Alteração limitada à ponte do SDK e ao feedback de diagnóstico, principalmente `src/zoom-indicator.ts` e os pontos correspondentes de `src/App.tsx`.
- Cobertura de código para conversão segundos/milissegundos e mapeamento de start, pause, resume e end.
- Evidência final composta por bundle Production identificado, logs da chamada e leitura, e captura do indicador nativo do observador.
- Custo: a tela local poderá mostrar uma contagem ativa mesmo quando o Zoom não a publicou. A interface precisa manter essa diferença explícita para não prometer compartilhamento.

## 8. Questões abertas

- A combinação de `text: "Timer Zoom"` e `timer` no mesmo payload altera a apresentação em algum cliente? A documentação permite ambos, então isso só deve virar correção se uma comparação reproduzível indicar interferência.
- O campo `timer` está ausente porque a API não armazenou a contagem ou porque aquele cliente não o expõe na leitura/evento? Os dados atuais não distinguem essas causas.
- A renderização do contador nativo é consistente entre Android, iPhone e desktop nas versões concretas usadas? A documentação e o relato confirmam disponibilidade de API, mas não substituem a validação visual por plataforma.

## 9. Referências

- [Zoom Apps SDK: `setDynamicIndicator`, leitura e eventos](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [Tipo `DynamicIndicatorTimerOptions`](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorTimerOptions.html)
- [Timer oficial do Zoom, JavaScript publicado](https://timer.zoomapp.cloud/static/js/main.2139f3da.js)
- [Ajuda oficial: usando o Zoom Timer](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068677)

Esta especificação separa fatos observados, contrato documentado e decisões propostas. A unidade de `start` está ancorada no JavaScript oficial do Timer; a causa da ausência dos dígitos permanece em investigação.
