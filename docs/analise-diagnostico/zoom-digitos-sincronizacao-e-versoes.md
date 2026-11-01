# Dígitos nativos do Zoom, sincronização e divergência de versões

## Objeto da investigação

Determinar o que as evidências sustentam sobre a ausência dos dígitos no indicador nativo do Timer Zoom, a sincronização entre painel e indicador e a correspondência entre arquivos locais, GitHub e Vercel.

Inspeção realizada em **1º de novembro de 2026**, até aproximadamente **12h26, America/Sao_Paulo**. Raiz confirmada por `git rev-parse --show-toplevel`: `/home/cg/Documentos/01-DEV/PROJETOS/timer-zoom`.

## Contexto

O requisito é um operador abrir o app e controlar uma contagem nativa visível aos participantes sem que eles abram a aplicação. O usuário relata várias rodadas sem os dígitos no operador, desktop e iPhone. Pediu análise fundamentada e acrescentou a conferência do código local, GitHub e Vercel, pois não está claro qual versão está sendo utilizada.

Esta investigação preservou o código e as configurações existentes. A única escrita no projeto é este documento. Não foram executados testes, build, publicação, push, merge ou comandos do SDK em reunião. As instruções de implementação contidas em `docs/pesquisa/prompt.md` foram examinadas como registro de uma etapa anterior.

## Evidências examinadas

### Material do projeto

- `AGENTS.md` e `README.md`, integralmente. `docs/references/` não existe neste checkout; as referências estão na raiz, conforme o README.
- `docs/pesquisa/prompt.md:1-22` e `docs/pesquisa/resultado.md:1-262`, integralmente. O resultado contém marcadores de citações de outra conversa, sem URLs recuperáveis para várias afirmações; as afirmações centrais foram verificadas novamente em fontes primárias.
- `docs/especificacoes/indicador-nativo-sincronizacao.md:1-130`, integralmente.
- Diagnósticos anteriores: `app-not-support-no-zoom-android.md`, `zoom-desktop-blank-webview.md`, `zoom-oauth-code-e-indicador.md` e `zoom-indicador-unidade-e-publicacao.md`, integralmente. São registros históricos; suas configurações e deployments não foram tratados como estado atual sem conferência.
- Imagens abertas nesta investigação: `timer-client-desktop.jpeg`, `timer-client-iphone.jpeg`, `timer-idle-reference.jpeg` e `timer-running-reference.jpeg`.
- Código atual: `src/zoom-timer-payload.ts`, `src/zoom-indicator.ts`, trechos de integração de `src/App.tsx`, `src/use-timer.ts`, `src/timer-logic.ts`, e `tests/zoom-timer-payload.test.mjs`. Também foram examinados o diff e o código commitado em `HEAD`.
- SDK instalado `@zoom/appssdk` 0.16.42: `node_modules/@zoom/appssdk/dist/sdk.es.js:1641-1675,1733-1764,2170-2173,3011-3033` e tipos correspondentes.

### Fontes consultadas ao vivo

- [Repositório GitHub](https://github.com/christian-goncalves/timer-zoom), branches `main` e `codex/timer-v1-preview`; consulta de branches, commits, comparação entre refs, arquivos e hashes da árvore remota.
- [Deployment atual na Vercel](https://vercel.com/christian-goncalves-projects/timer-zoom/613oAwPzinDkG78cvVd9ZQg9WUa1): metadados, árvore de fontes, identificadores dos arquivos e conteúdo do payload. Painel do usuário: origem da publicação, Git conectado e ambiente Production.
- [HTML público do app](https://timer-zoom.vercel.app/) e [bundle público atual](https://timer-zoom.vercel.app/assets/index-Dz5SD0cF.js), ambos HTTP 200.
- Marketplace do app **NA TIMER**, Surface, ambientes Development e Production, na aba existente do Chrome. Foram lidos Home URL, suporte Mobile, seleção de APIs e eventos; nenhum checkbox ou campo foi alterado.
- [Referência do SDK](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html), [opções de entrada](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html), [estado temporal](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorTimerOptions.html), [leitura](https://appssdk.zoom.us/types/ZoomSdkTypes.GetDynamicIndicatorOutput.html) e [evento](https://appssdk.zoom.us/types/ZoomSdkTypes.OnSetDynamicIndicatorEvent.html).
- [Ajuda oficial do Zoom Timer](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068677), [HTML do produto](https://timer.zoomapp.cloud/) e [JavaScript público oficial](https://timer.zoomapp.cloud/static/js/main.2139f3da.js), obtidos sem executar o código.
- [Relato do autor do CrowdTimer no fórum Zoom](https://devforum.zoom.us/t/unsupported-apis/146509), de setembro de 2026, e código público atual do produto: [aplicação](https://live.crowdtimer.app/assets/App-hepJ6X54.js) e [inicialização](https://live.crowdtimer.app/assets/zoom-boot-Bto4uw34.js). O relato e o build atual são evidências distintas.

## Estado observado

### 1. As imagens distinguem o rótulo do app dos dígitos

- `timer-client-desktop.jpeg` mostra a reunião com o rótulo **Timer Zoom** na barra superior e uma janela do app **NA TIMER**. O painel está em `00:05:00`, com botão **Iniciar** e mensagem **Preparando o timer…**. Não há dígitos na entrada da barra superior.
- `timer-client-iphone.jpeg` mostra o rótulo **Timer Zoom** destacado à mão e sem dígitos junto dele. A imagem não mostra o painel do operador nem informa se o timer estava ativo naquele instante.
- As duas referências mostram a interface interna do Timer em repouso e execução. Elas não mostram uma contagem nativa compartilhada em outro cliente.

Essas imagens demonstram os elementos visíveis. A captura desktop está em repouso; isoladamente ela não prova falha de renderização durante uma contagem ativa. O sintoma em execução está sustentado pelo relato do usuário e pelos registros históricos, sem uma captura atual correlacionada ao log completo da mesma ação.

### 2. Local, GitHub e Vercel estão em estados diferentes

| Localização | Estado verificado | Conteúdo relevante |
| --- | --- | --- |
| Git local | Branch `main`, HEAD `86c13b8`; `git remote -v` não retorna remoto | Seis arquivos rastreados modificados e arquivos/documentos não rastreados. O nome `main` local não identifica o mesmo commit da `main` remota. |
| GitHub `main` | `701b49322b36ad2932ec8c42a538bdf729d7c04a` | Prova inicial: a chamada está em `src/App.tsx`, com `start: 30`. Não contém `src/zoom-indicator.ts`. |
| GitHub `codex/timer-v1-preview` | `c334e865cc23c834100e6e16623abba7f41b328e`, cinco commits à frente da `main` | Possui o timer e a conversão para milissegundos. Não contém a extração `src/zoom-timer-payload.ts` nem a restauração inicial atual. |
| Vercel Production atual | `dpl_613oAwPzinDkG78cvVd9ZQg9WUa1`, **READY**, criado em 01/11/2026 às 11h32min51s BRT | Alias `timer-zoom.vercel.app`. A interface identifica origem **vercel deploy**; os metadados retornados não vinculam um commit Git. |

O projeto Vercel **está conectado** a `christian-goncalves/timer-zoom`. O ambiente Production rastreia a branch **main**, com atribuição automática dos domínios ativada. A publicação atual por CLI coexistiu com publicações anteriores originadas de commits da branch `codex/timer-v1-preview`.

Os 16 identificadores de conteúdo da árvore de fontes desse deployment coincidem com os SHA-1 dos respectivos arquivos locais: `index.html`, `package-lock.json`, `package.json`, os oito arquivos de `src/`, os três `tsconfig`, `vercel.json` e `vite.config.ts`. O payload curto foi também recuperado integralmente e corresponde ao local. O bundle público contém os mesmos recursos relevantes da ponte atual.

Exemplos de hashes SHA-1 dos bytes locais coincidentes com os identificadores das fontes na Vercel:

| Arquivo | SHA-1 |
| --- | --- |
| `src/App.tsx` | `327bcf02a6f029fb602b9190ca282ca310a2e5f2` |
| `src/zoom-indicator.ts` | `a2107bd291bfad7d812e6b0601b12b993f7f9d9a` |
| `src/zoom-timer-payload.ts` | `d6edb325aee1d387bd23f3f82f375fa059b7de8c` |

Na comparação por hashes Git com `codex/timer-v1-preview`, diferem `App.tsx`, `zoom-indicator.ts`, `timer-logic.ts` e `use-timer.ts`; `zoom-timer-payload.ts` está ausente no remoto. `TimeUnitControl.tsx`, `style.css`, README, `package.json` e `vercel.json` coincidem com essa branch.

### 3. O payload atual já usa `start` em milissegundos

`src/zoom-timer-payload.ts:5-19` produz, para cinco minutos:

```json
{
  "text": "Timer Zoom",
  "timer": {
    "action": "start",
    "direction": "down",
    "start": 300000,
    "withSound": false,
    "showNotification": false
  }
}
```

O bundle servido contém a multiplicação por `1e3`. SHA-256 do bundle `index-Dz5SD0cF.js`: `22cc0020685a6667791df996bcbcd557831afce7209d30d52af9c799080a68da`.

### 4. A ponte distingue aceitação de confirmação visual, mas mantém contagem própria

- `src/zoom-indicator.ts:116-118` aceita string `Success` e objeto `{message: "Success"}`. O falso negativo registrado anteriormente para Android foi tratado no código atual.
- `:139-172` registra envio, retorno, exceção, leitura imediata e, após iniciar, outra leitura em dois segundos, quando a API está disponível.
- `:178-184` classifica a operação pelo retorno da chamada. A presença ou evolução do `timer` na leitura não condiciona o resultado.
- `:201-222` tenta recuperar um contador nativo com texto `Timer Zoom`, direção regressiva, ação esperada e `current` positivo.
- `src/App.tsx:124-138` usa essa recuperação somente na inicialização; `src/zoom-indicator.ts:351-368` apenas registra eventos posteriores.
- `src/App.tsx:168-194` altera primeiro o timer local e encaminha o comando nativo. Uma falha nativa não desfaz o estado local.
- Os logs ficam na memória da página e são limitados a 30 entradas (`src/zoom-indicator.ts:48-55`); não há histórico persistente de ensaios.

### 5. Marketplace atual: há seis seleções, mas não são as seis solicitadas

Development e Production têm a mesma seleção observada:

| Capacidade | Código atual solicita | Marketplace seleciona |
| --- | --- | --- |
| `getSupportedJsApis` | Sim | Sim |
| `setDynamicIndicator` | Sim | Sim |
| `getDynamicIndicator` | Sim | Sim |
| `removeDynamicIndicator` | Sim | **Não** |
| `onSetDynamicIndicator` | Sim | Sim |
| `onMeeting` | Sim | Sim |
| `onRemoveDynamicIndicator` | Não | **Sim** |

Home URL é `https://timer-zoom.vercel.app/` nos dois ambientes; SDK e Mobile estão habilitados. Isso atualiza os registros antigos que apontavam somente duas APIs selecionadas. Seleção no Marketplace não comprova a lista efetivamente autorizada em uma sessão específica do cliente.

## Análise

### Versionamento e integração Zoom são problemas distintos

**Fato observado:** as fontes locais de execução correspondem às fontes da produção atual, mas o estado mais novo não está preservado nas duas branches remotas observadas. A `main` do GitHub continua sendo a prova inicial e é a branch rastreada por Production.

**Inferência:** o fluxo atual permite versões publicadas sem correspondência com o histórico GitHub e permite que uma nova publicação da `main` leve conteúdo antigo ao domínio. Isso explica a dificuldade de relacionar uma mudança a uma versão e a um ensaio. Não prova que o Zoom em uso esteja com cache antigo nem que essa divergência cause os dígitos ausentes.

### A pesquisa antiga não descreve o payload que está no ar

`resultado.md:5,51-75,179-218` constrói sua hipótese a partir de `duration` e propõe valores como `start: 60` e `start: 300`. O material posterior (`prompt.md:9` e a especificação) já registra a conversão para milissegundos. A inspeção atual confirma essa conversão no local, nas fontes da Vercel e no bundle público.

O [tipo de entrada](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html) aceita `start`, sem `duration`, mas não documenta a unidade. O código público do Timer oficial multiplica a duração em segundos por 1.000 e divide `start`/`current` por 1.000 na leitura. O CrowdTimer atual faz a mesma multiplicação. Portanto, a recomendação antiga de usar `60` para um minuto não é uma referência confiável para o contrato observado.

### Há suporte documentado para o resultado pretendido

A [referência do SDK](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html) descreve o indicador como visível aos participantes, lista mínimos desktop 5.17.5 e Android/iOS 5.16.0 e inclui papéis além de host. A mesma entrada mantém a etiqueta `product: desktop`; essa inconsistência não deve ser convertida em garantia de equivalência entre plataformas.

A [ajuda oficial do Timer](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068677) atribui a `setDynamicIndicator` o pequeno contador compartilhado e a `setVirtualForeground` a imagem sobre o vídeo. São superfícies diferentes. O requisito deste projeto corresponde ao primeiro recurso. Não há demonstração de que um backend ou abrir o app em todos os participantes seja necessário para esse indicador.

O [autor do CrowdTimer](https://devforum.zoom.us/t/unsupported-apis/146509) relata countdown nativo funcional em macOS/Zoom 7.1.0, com falha separada na API de estilo. Esse testemunho é evidência de viabilidade para terceiro naquele cenário, não homologação de Android/iPhone nem do nosso app.

### Existe uma diferença concreta de payload, ainda sem causalidade demonstrada

| Aspecto | Timer Zoom atual | Timer oficial examinado | CrowdTimer atual examinado |
| --- | --- | --- | --- |
| Unidade inicial | Milissegundos | Milissegundos | Milissegundos |
| Texto no mesmo start | `Timer Zoom` | Ausente | Ausente |
| Cores no start | Ausentes | Borda, texto e fundo | Texto e fundo |
| `showNotification` | `false` | `true` | `false` no caminho examinado |
| `countNegativeAfterAlarm` | Ausente | `true` | Ausente |
| Entrada no SDK | Método público | `callZoomApi` | Método público |
| Versão em `config` | Omitida | `0.16` | `0.16` |

O SDK instalado encaminha o objeto do método público para a mesma operação nativa, sem conversão específica de timer. O uso de `callZoomApi` pelo oficial não demonstra a necessidade de substituir a API pública. A exceção interna para Timer em clientes anteriores a 5.17.5 não explica os clientes 7.x registrados.

**Hipótese:** o texto, os estilos ou outra diferença de entrada podem influenciar a apresentação em algum cliente. O fato de os dois exemplos não enviarem `text` torna essa combinação uma diferença relevante. Entretanto, o tipo permite texto e timer juntos, e não foi encontrada confirmação de exclusão entre eles. Não há base para afirmar que remover o rótulo resolverá. A configuração de cores e a versão em `config` também não foram demonstradas como requisitos para os dígitos.

### O descompasso do painel tem explicação concreta no código

**Fato observado:** o React mantém um `deadline` próprio; o Zoom recebe comandos. A leitura inicial pode restaurar um valor, mas eventos e leituras posteriores servem apenas ao diagnóstico.

**Diagnóstico confirmado da arquitetura:** o app não mantém o painel continuamente reconciliado com o estado nativo. Uma instância reaberta pode permanecer em cinco minutos quando a recuperação não satisfaz as condições, e uma rejeição do SDK permite que os estados se separem. Latência e fila também podem introduzir diferença, embora sua magnitude não tenha sido medida.

Isso explica a possibilidade de descompasso do painel. Não explica sozinho a ausência de todos os dígitos na superfície nativa, que é renderizada pelo cliente Zoom.

### O que as respostas permitem concluir

O [tipo de leitura](https://appssdk.zoom.us/types/ZoomSdkTypes.GetDynamicIndicatorOutput.html) e o [evento](https://appssdk.zoom.us/types/ZoomSdkTypes.OnSetDynamicIndicatorEvent.html) tornam `timer` opcional. Uma resposta sem esse campo é insuficiente para afirmar que houve contagem nativa. Também não prova, sozinha, se o cliente descartou o timer ou se omitiu o estado da leitura.

Os registros anteriores apresentam sucesso de chamada, avisos falsos e ausência visual em momentos diferentes. Não há neste material um registro completo, da produção atual, que una contexto, payload, retorno bruto, evento, duas leituras e imagem durante a mesma contagem. Essa é a lacuna que impede atribuir a falha a contrato, autorização, persistência/propagação ou renderização do Zoom.

## Hipóteses avaliadas

| Explicação | Avaliação | Evidência e limite |
| --- | --- | --- |
| O código atual envia `duration` ou segundos | **Descartada para o bundle público examinado** | Envia `start` com multiplicação por 1.000. Não identifica qual bundle cada ensaio antigo executou. |
| Todas as alterações atuais ainda estão só no computador | **Descartada para os 16 arquivos de execução** | Identificadores das fontes na Vercel coincidem com hashes locais; GitHub continua diferente. |
| `Success` comprova dígitos compartilhados | **Descartada como critério de comprovação** | Confirma resposta da chamada; não demonstra conteúdo temporal nem sua apresentação. |
| `text` interfere na exibição de `timer` | **Plausível, não confirmada** | Difere dos dois exemplos públicos; o contrato permite ambos e não estabelece precedência. |
| A notificação sonora/visual precisa estar ativada | **Enfraquecida** | CrowdTimer usa notificação desativada no caminho examinado; não há requisito documental identificado. |
| Timer nativo é exclusivo do app oficial | **Enfraquecida** | API pública, wrapper público e relato de funcionamento por terceiro. Não comprova paridade móvel. |
| Falta de backend explica o indicador vazio | **Sem sustentação no material** | O mecanismo documentado publica o indicador nativo; estado colaborativo entre painéis é outro requisito. |
| Falta de `removeDynamicIndicator` causa a ausência inicial | **Sem sustentação causal** | Divergência atual confirmada, mas afeta limpeza; publicação e leitura estão selecionadas. |
| Defeito/limitação do cliente, autorização ou ambiente | **Em aberto** | Faltam os estados completos da execução atual; propriedade do app não determina o papel na reunião. |
| O painel está continuamente sincronizado por eventos | **Descartada no código atual** | O listener apenas registra; a restauração do estado ocorre na abertura. |
| OAuth ou tela vazia ainda são a causa central | **Enfraquecida pelos registros posteriores** | Documentos registram resolução de acesso e imagens mostram o painel; não há nova evidência ligando OAuth aos dígitos. |

## Diagnóstico

1. **Divergência de versionamento confirmada:** a produção atual corresponde aos arquivos locais de execução, mas está mais atualizada que as branches do GitHub. A `main` remota ainda contém a prova inicial e é rastreada por Production. A publicação por CLI não fornece, nos metadados consultados, um commit correspondente. Isso compromete rastreabilidade e torna insuficiente dizer apenas que algo foi publicado no GitHub ou na Vercel.
2. **Sincronização do painel incompleta por arquitetura confirmada:** há timer local e timer nativo separados, uma recuperação inicial condicionada e nenhum uso posterior dos eventos para reconciliar a contagem. O código permite divergência mesmo com interface local funcional.
3. **Dígitos nativos: causa ainda inconclusiva.** A operação pretendida é documentada e há evidência de uso por terceiro. O payload atual já usa o campo e a escala temporal encontrados nos exemplos públicos. A diferença entre texto e timer é uma hipótese específica, não uma correção comprovada. Nenhuma evidência permite prometer que alinhar o GitHub ou republicar a mesma versão fará aparecer os dígitos.
4. **Divergência de capacidades confirmada e limitada à sua função:** o código pede remoção direta, mas os dois ambientes habilitam o evento de remoção em seu lugar. Isso limita o fluxo de limpeza e não demonstra a causa da falha inicial de exibição.

## Grau de certeza

- **Alto** para estado local/remoto, fontes da Vercel, payload atual, configuração visível do Marketplace e ausência de reconciliação posterior no código: foram inspecionados diretamente.
- **Médio** para o suporte prático ao indicador por terceiros: documentação e relato do autor convergem, mas não houve reprodução independente nesta investigação.
- **Baixo** para a causa dos dígitos ausentes e a hipótese de interferência do texto: falta uma execução atual correlacionada e os exemplos públicos não demonstram causalidade.

## Pontos ainda não comprovados

- Qual bundle foi carregado pelo WebView em cada ensaio que falhou, incluindo os ensaios após a publicação atual de 11h32.
- O conteúdo bruto de leitura/evento da mesma execução atual: se existe `timer`, se `current` evolui e se o estado pertence ao publicador esperado. O prompt menciona omissões, mas não fornece o JSON completo correlacionado.
- Se o operador possui papel de host, co-host ou participante naquela execução; ser proprietário do app não responde a isso. Faltam também versões exatas atuais do iPhone e dos observadores associados ao mesmo ensaio.
- Se alguma diferença de entrada entre o nosso app e os exemplos públicos altera a apresentação, especialmente `text` junto de `timer`. Não há comparação controlada disponível.
- Se o estado temporal válido chega a um cliente observador e deixa de ser desenhado, ou se nem chega a existir/ser propagado. As evidências disponíveis não distinguem essas situações.
- A exibição e as cores do indicador nativo em Android/iPhone reais. O êxito documentado no macOS e a cor do visor React não comprovam esses comportamentos móveis.
