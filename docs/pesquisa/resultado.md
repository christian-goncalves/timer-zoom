# Pesquisa aprofundada: timer compartilhado para Zoom Apps no Android

## Conclusão

Há um caminho oficial e tecnicamente adequado para fazer exatamente o que você quer, e a investigação encontrou um ponto que pode explicar diretamente o comportamento que você está vendo: **a estrutura atualmente documentada de `setDynamicIndicator()` não possui um campo `duration` dentro de `timer`; ela usa `start`**. O tipo oficial atual é `timer: { action, direction, start, withSound, countNegativeAfterAlarm, showNotification, songChoice }`. Portanto, se sua implementação estiver realmente enviando `duration: 300`, esse valor não corresponde ao contrato atual do SDK. O Zoom pode aceitar a chamada e criar o contêiner visual do indicador, mas não receber o valor inicial necessário para renderizar a contagem. Isso é consistente — embora ainda seja uma hipótese que precisa ser reproduzida — com o seu sintoma de **aparecer o indicador branco, mas não os números**. citeturn112262view1turn994169search1

A segunda conclusão importante é que você **não precisa sincronizar manualmente o contador para cada participante para produzir o indicador nativo no canto da reunião**. A própria referência do SDK define `setDynamicIndicator()` como a API que cria um indicador “visto por todos os participantes”, e a documentação oficial do Timer da Zoom confirma que ela é usada para colocar a pequena contagem no canto superior direito para todos. Isso é diferente de sincronizar a interface do seu próprio Zoom App entre vários usuários. citeturn211550search0turn994169search2

A terceira descoberta é que **não encontrei o código-fonte do Timer oficial da Zoom publicado como projeto open source**. Entretanto, a Zoom revela publicamente a arquitetura dele: o Timer oficial combina `setDynamicIndicator()` para o contador nativo compartilhado e `setVirtualForeground()` para desenhar o contador grande sobre o vídeo do usuário. Um membro experiente do fórum da Zoom também confirmou que o Timer oficial gera essa imagem com um `<canvas>` e envia o resultado como `ImageData` para `setVirtualForeground()`. citeturn994169search2turn876921view4

Existe ainda um caso muito relevante de setembro/outubro de 2026: um Zoom App chamado **CrowdTimer**, desenvolvido independentemente com Svelte 5, Vite e `@zoom/appssdk 0.16.41`, relata que **o Dynamic Indicator com countdown funciona**, mas `setDynamicIndicatorStyle()` retorna `app_not_support`. Ou seja: outro desenvolvedor está implementando praticamente a mesma arquitetura que você está tentando implementar e conseguiu iniciar o contador nativo; o problema dele está especificamente na alteração de estilo. citeturn112262view3

A pesquisa foi realizada em **1º de novembro de 2026**.

## O que a Zoom realmente oferece

O SDK atual da Zoom documenta `setDynamicIndicator()` para desktop a partir do cliente 5.17.5 e para iOS e Android a partir do 5.16.0. A API funciona em `inMeeting`, `inCollaborate`, `inCamera` e `inWebinar`, pode ser chamada por host, co-host, participante ou panelista e possui suporte a Guest Mode. A descrição explícita é que o indicador é mostrado a **todos os participantes**. O seu Android 7.2.1, portanto, está muito acima da versão mínima declarada. citeturn299588search0turn994169search3

O formato documentado atualmente é conceitualmente este:

```javascript
await zoomSdk.setDynamicIndicator({
  timer: {
    action: "start",
    direction: "down",
    start: 300,
    withSound: false,
    showNotification: false
  }
})
```

O ponto crítico é `start`. O tipo oficial não contém `duration`. Também não há indicação de que `text` seja obrigatório; tanto `text` quanto `timer` são opcionais. Portanto, para o primeiro teste, eu eliminaria completamente `"Timer Zoom"` e qualquer configuração estética e enviaria **somente o timer mínimo**, para reduzir o número de variáveis. citeturn112262view1

A documentação pública do tipo não explica textualmente qual é a unidade de `start`, o que é uma falha real da documentação. O próprio evento `onSetDynamicIndicator` devolve tanto `start` quanto `current`, mostrando que o cliente Zoom mantém internamente o estado temporal do indicador. citeturn813775search2

Por isso, existe uma distinção importante entre dois tipos de sincronização.

Quando você usa `setDynamicIndicator()`, você está pedindo ao **cliente Zoom** que produza um recurso nativo da reunião. A documentação diz que esse recurso é visto por todos. Assim, não faz sentido enviar `04:59`, depois `04:58`, depois `04:57` pelo seu React a cada segundo. O comportamento pretendido é iniciar o timer uma vez, e o cliente Zoom executar a contagem. citeturn211550search0turn994169search2

Já quando vários participantes abrem **a sua aplicação**, aí sim você precisa sincronizar estado entre instâncias. A Zoom documenta convites para outros participantes e recomenda usar estado em backend associado ao Meeting UUID para experiências colaborativas. `sendAppInvitation()` serve para abrir a aplicação para outros participantes; isso é uma coisa diferente do Dynamic Indicator. citeturn211550search4turn211550search5

Portanto, para o seu caso inicial:

**Operador abre seu app → inicia 5 minutos → seu app chama `setDynamicIndicator()` → o Zoom distribui/renderiza o indicador nativo para os outros clientes.**

Os outros participantes **não deveriam precisar abrir seu app apenas para visualizar o indicador nativo**, porque a própria API afirma que ele é visto por todos, e é exatamente assim que a documentação do Timer oficial descreve seu contador de canto. citeturn211550search0turn994169search2

Isso não significa que qualquer interface React criada por você automaticamente apareça para eles. Somente o indicador produzido pelo Zoom.

## O provável problema da sua implementação atual

O ponto mais suspeito é o parâmetro que você descreveu.

Você informou que atualmente envia algo equivalente a:

```text
timer:
  action: start
  direction: down
  duration: segundos
```

Mas o contrato atual do SDK espera:

```text
timer:
  action: start
  direction: down
  start: número
```

`duration` simplesmente não aparece em `DynamicIndicatorOptions`. citeturn112262view1turn994169search1

Isso produz uma hipótese bastante forte: o Zoom está reconhecendo que você solicitou um Dynamic Indicator e cria sua superfície gráfica, mas não recebe o valor inicial da contagem no campo que ele espera. O resultado pode ser exatamente uma cápsula/indicador sem os dígitos. Isso é uma inferência a partir do contrato oficial e do comportamento que você relatou; ainda não encontrei uma documentação da Zoom dizendo explicitamente “se usar `duration`, aparece uma cápsula vazia”. citeturn112262view1

Há outro detalhe importante: **não use `setInterval()` como mecanismo de sincronização do indicador nativo**. Seu timer React pode usar seu próprio relógio para desenhar a interface dentro da aplicação, mas o Dynamic Indicator deve receber o tempo inicial e deixar o cliente Zoom cuidar do contador nativo. O evento `onSetDynamicIndicator` inclusive expõe `start`, `current`, `action`, `direction` e timestamp, indicando que o Zoom mantém esse estado internamente. citeturn813775search2

O `text: "Timer Zoom"` também deve ser removido durante o diagnóstico. Não há evidência de que o texto impeça o timer, mas misturar texto e timer torna o teste desnecessariamente ambíguo. O tipo oficial aceita ambos independentemente. citeturn112262view1

`withSound` e `showNotification` são flags opcionais. Não há documentação indicando que precisem estar ativadas para que os dígitos apareçam; elas são características adicionais do timer. citeturn112262view1

Também vale diferenciar retorno da chamada de confirmação real. O SDK declara retorno `Promise<GeneralMessageResponse>`, portanto um `undefined` inesperado não deve ser considerado prova suficiente de sucesso. Para diagnóstico, você deve combinar resposta da Promise, `getDynamicIndicator()` e o evento `onSetDynamicIndicator`. citeturn299588search0turn813775search2

No seu caso, eu considero `getDynamicIndicator()` especialmente importante. Ele também é documentado para Android e iOS desde 5.16.0 e desktop desde 5.17.5. Portanto, se ele continuar aparecendo como unsupported no Samsung com Zoom 7.2.1, isso aponta mais para **configuração/capability/autorização do seu Zoom App** do que para versão do cliente. citeturn813775search1

Há precedente para problemas reais nessa camada. Em 2025, a própria Zoom confirmou um bug de engenharia que fazia `setDynamicIndicator` não aparecer adequadamente na configuração de APIs do Marketplace; o problema foi corrigido no fluxo de criação posteriormente. citeturn299588search2

E em 2026 existe ainda uma inconsistência ativa: o CrowdTimer consegue executar `setDynamicIndicator`, mas `setDynamicIndicatorStyle` aparece em `unsupportedApis` e retorna código 80004 mesmo estando selecionado no Marketplace. citeturn112262view3

Isso significa que seu diagnóstico deve separar cuidadosamente **“meu código está errado”** de **“o Zoom não expôs essa capability para esse app/cliente”**.

## Código aberto e projetos reaproveitáveis

Não encontrei, nas buscas realizadas, um repositório open source maduro que seja simplesmente “clone o Timer oficial da Zoom e altere as cores”. A própria lista oficial atual de exemplos da Zoom contém vários Zoom Apps de referência, mas nenhum timer completo baseado em Dynamic Indicator. citeturn876921view3

| Projeto | Tipo | Licença | Zoom Apps SDK | Sincronização / indicador | Utilidade para seu projeto |
|---|---|---|---|---|---|
| `zoom/appssdk` | SDK oficial | MIT | Sim | Implementa as APIs do Dynamic Indicator | Essencial como referência, mas não é um app Timer. citeturn968302search1 |
| `zoom/zoomapps-advancedsample-react` | Zoom App oficial de exemplo | MIT | Sim | Demonstra configuração, capabilities, auth, eventos, Meeting UUID e estrutura React/Node | **Melhor base arquitetural oficial** para seu projeto. Não contém Timer pronto. citeturn570417view2turn876921view2 |
| `Arty2/tick` | Timer web open source | MIT | Não | Timer local em HTML/JS; possui controles, presets e lógica de countdown | Muito útil para reutilizar lógica/interface do timer, mas você teria que adicionar toda a camada Zoom Apps SDK. Última versão indicada: 1.8, março de 2023. citeturn570417view0 |
| `nomumu/timer_movie` | Timer visual para Zoom | CC0-1.0 | Não | Vídeo usado como virtual background | Não serve para Dynamic Indicator ou sincronização. É mais uma curiosidade/alternativa visual. citeturn570417view1 |
| CrowdTimer | Zoom App real de terceiro | Código público não localizado na pesquisa | Sim | Usa Dynamic Indicator countdown com sucesso; relata problema apenas no style API | **Extremamente relevante como prova de viabilidade**, mas não encontrei repositório open source associado. citeturn112262view3 |
| Timer oficial da Zoom | Produto oficial | Código-fonte não localizado/publicado | Sim | `setDynamicIndicator` + `setVirtualForeground` | É a arquitetura de referência, mas não há repositório público encontrado. citeturn994169search2turn876921view4 |

O projeto `Arty2/tick` é particularmente interessante para a parte que **não depende do Zoom**. Ele é um único HTML, sem dependências, possui presets, pause/resume, overtime, toque, teclado e lógica de countdown. Ele também menciona sincronização entre janelas usando `BroadcastChannel`, mas isso é sincronização do navegador, não sincronização de participantes Zoom. Sua licença MIT permite adaptação. citeturn570417view0

Para a camada Zoom, entretanto, eu não usaria o Tick como base principal. Usaria sua lógica apenas como inspiração e manteria seu React/Vite atual.

A base técnica oficial mais valiosa é `zoomapps-advancedsample-react`. Ela demonstra exatamente as partes em que normalmente um Zoom App quebra: domínio HTTPS, allowlist, capabilities do SDK, `config()`, scopes, Meeting UUID, autenticação e lifecycle da aplicação. citeturn876921view2

Repositório oficial:

https://github.com/zoom/zoomapps-advancedsample-react

SDK oficial:

https://github.com/zoom/appssdk

Timer web Tick:

https://github.com/Arty2/tick

Timer virtual-background:

https://github.com/nomumu/timer_movie

Existe ainda um material oficial muito recente da própria Zoom no GitHub chamado `zoom/skills`, que contém documentação operacional sobre Zoom Apps SDK e até um exemplo conceitual de Meeting Timer/Agenda. Esse exemplo, porém, usa o estado da aplicação e `shareApp`; não é uma implementação completa do Dynamic Indicator. citeturn968302search2turn968302search6

## Como o Timer oficial da Zoom funciona

Esta parte esclarece bastante o que você viu nas imagens.

O Timer oficial possui **dois elementos diferentes**.

O número grande que aparece sobre a câmera do usuário não é o Dynamic Indicator. A documentação oficial informa que o Timer usa `setVirtualForeground` para colocar a visualização sobre o vídeo. citeturn994169search2

O fórum da Zoom explica como isso é feito: o app desenha o contador em um `<canvas>`, obtém um `ImageData` e passa essa imagem para `setVirtualForeground()`. citeturn876921view4

Já o pequeno contador que aparece no canto superior direito da janela da reunião é o **Dynamic Indicator** gerado por `setDynamicIndicator()`. A própria página de segurança do Timer oficial revela explicitamente isso. citeturn994169search2

Portanto, se você quiser reproduzir fielmente o Timer oficial, sua arquitetura final é aproximadamente:

**React/Vite**
→ controla duração, iniciar, pausar, retomar e encerrar.

**Dynamic Indicator**
→ cria o pequeno contador nativo visível para todos.

**Canvas + setVirtualForeground**
→ opcionalmente cria o contador grande sobre a câmera do operador.

Essa descoberta também significa que você estava possivelmente tentando resolver duas coisas como se fossem uma só.

O Dynamic Indicator não desenha o elemento grande sobre sua câmera.

O Virtual Foreground não cria automaticamente aquele contador nativo no canto da reunião.

O Timer oficial usa os dois. citeturn994169search2turn876921view4

Isso também explica por que a documentação do Timer oficial lista `onMyMediaChange`: ela observa alterações no vídeo para ajustar corretamente o foreground às dimensões/aspect ratio do vídeo do operador. citeturn994169search2

E há uma inconsistência documental importante. A página atual do Marketplace do Timer oficial lista suporte de cliente para desktop 7.0.5+, enquanto a documentação geral do Apps SDK permite Zoom Apps no Android e iOS e documenta `setDynamicIndicator` para ambos. Portanto, **o fato de a API existir no Android não significa automaticamente que o próprio produto Timer oficial esteja distribuído como um aplicativo móvel equivalente**. citeturn649574search3turn649574search0turn299588search0

Essa distinção é exatamente a razão pela qual faz sentido você criar seu próprio Zoom App.

## Caminho recomendado e teste mínimo

Eu não mexeria mais na interface, sincronização React ou backend neste momento.

O primeiro objetivo deve ser provar isoladamente que o cliente Zoom consegue renderizar **um Dynamic Indicator de 60 segundos com números**.

Configure o app no Marketplace com Mobile Client habilitado, como exige a documentação oficial para Zoom Apps em iOS/Android. citeturn649574search0

No Zoom App SDK, habilite no mínimo `setDynamicIndicator`, `getDynamicIndicator`, `removeDynamicIndicator`, `onSetDynamicIndicator` e `onRemoveDynamicIndicator`. Essas APIs constam atualmente na lista oficial do SDK. citeturn813775search7turn299588search0

No `zoomSdk.config()`, solicite exatamente essas mesmas capabilities. A documentação e o exemplo oficial da Zoom deixam claro que as APIs usadas pela aplicação precisam estar selecionadas no build flow e solicitadas em `config()`. citeturn876921view2turn649574search1

Depois faça um único teste mínimo:

```javascript
const result = await zoomSdk.setDynamicIndicator({
  timer: {
    action: "start",
    direction: "down",
    start: 60,
    withSound: false,
    showNotification: false,
    countNegativeAfterAlarm: false
  }
});
```

Não coloque `text`.

Não coloque estilos.

Não coloque `duration`.

Não use React state para atualizar o Dynamic Indicator a cada segundo.

Depois, imediatamente consulte `getDynamicIndicator()` e registre o resultado. A API está documentada para Android 5.16.0+, iOS 5.16.0+ e desktop 5.17.5+. citeturn813775search1

Também registre o evento `onSetDynamicIndicator`. O payload desse evento deve trazer `participantUUID`, `timestamp`, `timer.start`, `timer.current`, `direction` e `action` quando aplicável. citeturn813775search2

O teste deveria seguir esta matriz:

| Operador | Observador | Observador abriu o app? | Resultado esperado |
|---|---|---:|---|
| Desktop | Desktop | Não | Indicador nativo com contagem. citeturn211550search0 |
| Desktop | Android | Não | Indicador nativo, pois Android 5.16+ é documentado como suportado. citeturn299588search0 |
| Android | Desktop | Não | Deve ser testado; Android é documentado como capaz de chamar a API. citeturn299588search0 |
| Android | iOS | Não | Deve ser testado; ambos estão acima das versões mínimas declaradas. citeturn299588search0 |
| Operador | Outro usuário | Sim | Além do indicador, passa a ser possível testar eventos/estado da aplicação colaborativa. citeturn211550search5turn211550search4 |

Se esse teste de 60 segundos funcionar, então a sincronização fundamental está resolvida e você não precisa construir WebSocket, Firebase ou backend apenas para o pequeno indicador.

Depois implemente 180, 300 e 600 como `start`.

Depois pause/resume/end.

Depois coloque `text`, se ainda desejar.

Depois experimente estilo.

E **somente depois** volte à interface completa.

Há uma razão concreta para deixar estilo por último. `setDynamicIndicatorStyle()` possui atualmente apenas versão mínima de desktop listada na referência, enquanto `setDynamicIndicator()` está explicitamente listado para Android e iOS. Além disso, o caso CrowdTimer de setembro/outubro de 2026 mostra `setDynamicIndicatorStyle()` retornando `app_not_support` mesmo em desktop macOS 7.1.0. citeturn299588search0turn112262view3

Portanto, para seu requisito “ficar vermelho quando faltar um minuto”, eu separaria duas coisas.

Sua interface React pode ficar vermelha sem problema.

Seu `setVirtualForeground` pode desenhar o contador vermelho sobre seu vídeo, caso você implemente essa parte.

Mas mudar dinamicamente a cor do **Dynamic Indicator nativo** exatamente aos 60 segundos ainda merece validação separada; há evidência recente de problema real nessa API de estilo. citeturn112262view3

A alternativa é tentar reinvocar `setDynamicIndicator()` com cores alteradas, já que `DynamicIndicatorOptions` também possui `textColor`, `borderColor` e `backgroundColor`, mas eu não trataria isso como comportamento confirmado até ser reproduzido, porque a documentação não descreve claramente o efeito de atualizar um timer já em andamento dessa maneira. citeturn112262view1

## Diagnóstico final e próximos passos técnicos

O cenário que eu considero mais provável hoje é este:

**Seu problema não parece ser a ausência de uma arquitetura complexa de sincronização. O primeiro suspeito é a chamada do Dynamic Indicator.**

O contrato atual usa `start`, e não `duration`. citeturn112262view1

O Dynamic Indicator já é o mecanismo de sincronização visual nativo da Zoom para o pequeno contador e é documentado como visível para todos. citeturn211550search0

Os outros participantes não precisam abrir seu React apenas para ver esse indicador nativo, segundo a descrição da própria API e do Timer oficial. citeturn211550search0turn994169search2

`getDynamicIndicator()` e `onSetDynamicIndicator` devem ser usados para provar que o estado entrou corretamente no Zoom. citeturn813775search1turn813775search2

A sincronização por backend só passa a ser relevante quando você quer que **várias pessoas tenham a aplicação aberta e interajam com o mesmo estado**, algo diferente do seu caso básico. A própria Zoom recomenda Meeting UUID + backend para esse tipo de experiência colaborativa. citeturn211550search4

Para reproduzir o Timer oficial de forma completa, o alvo técnico passa a ser:

**controle local em React → `setDynamicIndicator` para o contador universal → Canvas/ImageData + `setVirtualForeground` para o contador na câmera.** Essa é a arquitetura pública mais próxima que conseguimos reconstruir do Timer oficial sem engenharia reversa. citeturn994169search2turn876921view4

E existe uma evidência contemporânea particularmente útil para você: o CrowdTimer está usando Dynamic Indicator em produção/desenvolvimento em 2026 e declara explicitamente que **iniciar o countdown funciona**. O defeito relatado é a alteração de estilo, não a contagem. Isso enfraquece bastante a hipótese de que “o Zoom simplesmente não suporta isso para terceiros”. citeturn112262view3

Em outras palavras: antes de continuar quebrando a cabeça com sincronização, eu substituiria `duration` por `start`, removeria tudo exceto os cinco campos mínimos do timer e faria o teste de 60 segundos com `getDynamicIndicator` e `onSetDynamicIndicator`. Esse é, com base nas fontes atuais, o experimento com maior chance de separar em poucos minutos um erro de implementação de um problema real do Zoom. citeturn112262view1turn813775search2