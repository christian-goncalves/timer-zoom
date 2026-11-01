# Diagnóstico dos códigos OAuth e do indicador nativo do Timer Zoom

## Objeto da investigação

Identificar a origem do parâmetro `code` que aparece ao abrir o Timer Zoom no navegador e distinguir esse redirecionamento da publicação do cronômetro nativo na barra da reunião Zoom.

## Contexto

O app é um Zoom App com uma página React/Vite hospedada em `https://timer-zoom.vercel.app/`. O objetivo é uma pessoa iniciar o timer e o indicador nativo aparecer para os demais participantes, sem que eles abram o app. O usuário observou que ações recentes abriram a página no Chrome com valores diferentes em `?code=...` e que, no Zoom Android, a contagem local funciona, mas o indicador nativo não foi confirmado.

## Evidências examinadas

- Captura enviada nesta conversa do Zoom Marketplace, página **Basic information** do app `NA TIMER`, ambiente **Development**: OAuth redirect URL configurada como `https://timer-zoom.vercel.app/`; OAuth allow list contém o mesmo host; o campo OAuth URL mostra um endereço `zoom.us/oauth/authorize` com `response_type=code` e `redirect_uri` para essa Home URL.
- Leitura somente de campos da página **Surface** do mesmo app: Home URL `https://timer-zoom.vercel.app/`; Zoom App SDK habilitado, dois APIs selecionados, Mobile habilitado; opção **In-client OAuth** desmarcada.
- Leitura visual da página **Local Test** do Marketplace: o botão exibido é **Remove App**, indicando que o app Development já está adicionado à conta; a seção Authorization URL é um fluxo separado para autorizar/compartilhar o app.
- Captura enviada nesta conversa do Chrome: várias abas chamadas “Timer Zoom” no mesmo host, cada uma com um valor diferente no parâmetro `code`. A página mostra `00:05:00` e o estado `Timer local`.
- Captura enviada nesta conversa do Zoom Android: o app renderiza dentro da reunião, mostra `Zoom conectado` e um timer local em andamento; o aviso informa `O Zoom recusou a atualização do indicador (resposta: undefined). A contagem local continua ativa.` Os valores dos códigos não foram copiados para este documento.
- `src/zoom-indicator.ts`, linhas 47–67: a resposta é considerada sucesso somente quando `response.message === 'Success'`; a publicação chama `setDynamicIndicator` com texto e opções de timer. Se a mensagem não for `Success`, a interface mostra `response.message`.
- `src/App.tsx`, linhas 79–125 e 257–259: o app chama `zoomSdk.config()` e consulta as APIs ao iniciar; fora de um contexto Zoom, apresenta `Timer local` e mantém a interface local disponível.
- Busca no código de execução (`src/App.tsx`, `src/zoom-indicator.ts`): não há chamadas a `authorize`, listener `onAuthorized` nem leitura de `location.search` para processar OAuth.
- Documentação oficial Zoom sobre [OAuth de Zoom Apps](https://developers.zoom.us/docs/zoom-apps/authentication/), [OAuth Redirect URL](https://developers.zoom.us/docs/build-flow/basic-info/oauth-info/), [Surface/Home URL](https://developers.zoom.us/docs/build-flow/surface/) e [erros de OAuth](https://developers.zoom.us/docs/integrations/oauth-error-messages/).
- Referência oficial do SDK para [`setDynamicIndicator`](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html) e tipo [`DynamicIndicatorOptions`](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html).

## Estado observado

1. A Home URL e o OAuth Redirect URL de desenvolvimento estão configurados para o mesmo endereço raiz da Vercel.
2. O Marketplace gerou para esse app um fluxo OAuth de autorização que pede `response_type=code` e redireciona de volta à URL raiz.
3. O recurso In-client OAuth está desativado. O frontend atual não chama as APIs `authorize`/`onAuthorized` e não usa o parâmetro de query `code`.
4. Ao abrir as URLs com `code` no Chrome normal, o app mostra `Timer local`, indicando que essa página não foi inicializada no WebView/contexto do Zoom.
5. Dentro do Zoom Android, a tela do app está conectada e o timer local funciona, mas a API não devolveu a mensagem de sucesso esperada para a publicação do indicador; a captura mostra `response: undefined`.
6. A chamada atual envia `text` e `timer`. O tipo oficial `DynamicIndicatorOptions` lista texto, timer e estilos, mas não contém uma propriedade para definir um ícone por chamada.

## Análise

O parâmetro `code` corresponde ao padrão de código de autorização OAuth do Zoom: o Marketplace mostra a URL de autorização com `response_type=code`, e o Redirect URL registrado é exatamente a Home URL. Quando o fluxo de autorização é executado, o Zoom retorna o navegador a esse endereço com um código. Um valor novo a cada execução é compatível com uma nova tentativa de autorização; não é identificador do timer, do deployment, do Zoom App ou da reunião. A documentação do Zoom informa que códigos de autorização expiram em cinco minutos.

Há uma distinção importante: a Home URL é a página que o cliente Zoom deve embutir quando o usuário abre o Zoom App; o OAuth Redirect URL é o destino usado depois da autorização OAuth. Como ambos foram apontados para `/`, executar o fluxo OAuth abre a própria página do timer com `?code=...` no navegador. Isso explica a URL observada, mas não demonstra qual clique específico iniciou o fluxo; a captura sozinha não registra a sequência de navegação.

O projeto não consome esse código e não implementa OAuth. Além disso, o In-client OAuth está desligado. Portanto, os valores variáveis não são usados pelo timer e não causam nem corrigem a publicação do indicador.

O indicador é um segundo problema. Fora do WebView do Zoom, `zoomSdk.config()` não pode estabelecer contexto de reunião e a tela mantém apenas o timer local. Uma única instância do app, aberta por quem inicia a contagem em contexto `inMeeting`, deve chamar `setDynamicIndicator`; a documentação define o indicador como visível a todos os participantes. Os demais participantes não devem precisar abrir o app. Dentro do Android, `setDynamicIndicator` é invocada, mas a captura diagnóstica apresenta `response: undefined`, em vez do valor `Success` exigido pela checagem no código. Assim, a causa ainda não está demonstrada como falta de suporte ou ausência de chamada; o retorno observado é simplesmente incompatível com o sucesso reconhecido pela implementação. A publicação não deve ser considerada concluída até o cliente retornar sucesso e o indicador aparecer nos outros clientes da reunião.

O termo “relógio lá em cima” neste caso refere-se à contagem regressiva nativa que deve ser propagada aos participantes. Separadamente, o ícone ao lado do nome do app identifica o próprio aplicativo e vem da identidade visual/configuração do app; `setDynamicIndicator` não oferece um campo de ícone. O ícone do app e a contagem nativa não são a mesma coisa.

## Hipóteses avaliadas

- **Os valores `code` são IDs diferentes de timer ou versões diferentes do site:** descartada. A URL OAuth gerada no Marketplace usa `response_type=code` e volta à mesma URL raiz; o código da página não trata `code` como identificador.
- **Os códigos são códigos de autorização OAuth do Zoom:** sustentada diretamente pela configuração visível da URL OAuth e pelo padrão oficial de redirecionamento. Não foi observado o clique exato que iniciou cada fluxo.
- **O app precisa ser adicionado/autorizado novamente a cada início:** enfraquecida pela tela Local Test atual, que mostra `Remove App`; o app já está adicionado. Ainda não foi observado o clique exato que abre as novas abas com `code`.
- **Abrir a URL com `code` no Chrome publica o timer na reunião:** descartada. A página aparece como `Timer local`; o fluxo de publicação depende do SDK dentro do cliente Zoom e do contexto de reunião.
- **O indicador nativo já foi publicado com sucesso no teste Android atual:** descartada para a captura atual. A mensagem exibida informa que o Zoom recusou a atualização e mostra `response: undefined`.
- **A resposta `undefined` prova que o Zoom Android não suporta `setDynamicIndicator`:** não demonstrada. A documentação lista suporte para Android, e a captura anterior mostra a API como disponível; falta descobrir por que a resposta real não tem a mensagem esperada.
- **O ícone do app pode ser escolhido por `setDynamicIndicator`:** descartada pelo tipo documentado, que não possui opção de ícone.

## Diagnóstico

Os valores variáveis em `?code=` são códigos de autorização OAuth do Zoom, produzidos porque o OAuth Redirect URL de desenvolvimento está apontado para a mesma raiz usada como Home URL. Cada código é temporário, não representa um timer ou uma versão. O frontend não implementa OAuth nem usa esse parâmetro. Abrir essa URL no Chrome leva à página em modo local e não é o fluxo que publica o indicador da reunião.

O objetivo do contador compartilhado é atendido por `setDynamicIndicator` dentro do Zoom. No teste Android atual, essa chamada ainda não está confirmada: a captura mostra `response: undefined`, portanto o Zoom não retornou o `Success` que o código exige. O ícone ao lado do nome do app é a marca do aplicativo; o contador nativo é um recurso separado do Zoom e não tem um ícone customizável por essa chamada.

## Grau de certeza

Alto para a origem OAuth do parâmetro `code`, para a colisão entre Home URL e Redirect URL, para a ausência de consumo desse parâmetro no frontend, e para a distinção entre ícone do app e API de indicador. Médio para a interpretação de que cada valor diferente veio de uma nova autorização, pois as capturas mostram códigos diferentes e a configuração do fluxo, mas não registram a ação que os gerou. Baixo para a causa exata da resposta `undefined` do indicador Android.

## Pontos ainda não comprovados

- Qual ação específica no fluxo Zoom abriu o OAuth URL em cada ocasião.
- Se o retorno `undefined` é um objeto de resposta incompleto, divergência de versão/SDK ou comportamento do cliente Android.
- Se a resposta bem-sucedida (`Success`) exibirá visualmente o timer no dropdown/toolbar para todos os participantes nessa reunião.
- Se a resposta bem-sucedida do Android aparecer como indicador para outros dispositivos na mesma reunião; o retorno atual não chegou ao sucesso.

## Atualização após publicação diagnóstica e novas capturas — 2026-10-31

### Evidências desta atualização

- Relato do usuário: após fechar e reabrir o app publicado, o Timer Zoom ainda aparece no desktop e no telefone como indicador branco, sem dígitos legíveis. A URL deixou de abrir uma aba do navegador; o redirecionamento é considerado resolvido nesta etapa.
- Captura do Zoom Workplace desktop enviada nesta conversa: a barra da reunião mostra “Timer Zoom” com ícone azul e menu suspenso. A captura não mostra dígitos de contagem.
- Captura do Zoom Android enviada nesta conversa: há uma área branca horizontal na região superior da reunião, sem dígitos legíveis. A captura não identifica se o aparelho está observando como participante independente ou se o timer estava ativo naquele instante.
- Relato do usuário sobre publicação: commit `cfb338b488256427f7c35a91e6225bf34c1224cb`, branch `codex/timer-v1-preview`; deployment Vercel `dpl_3HHeMAS3d5csTpAn8DJFNA76TF6t` em `READY`, com alias `https://timer-zoom.vercel.app/`. O deploy acrescentou serialização da resposta e foi confirmado por HTTP 200 e inspeção do JavaScript servido. O usuário informa que ainda não repetiu o teste dentro do Zoom após esse deployment.
- Checkout local inspecionado: branch `main`, HEAD `86c13b8`; `src/zoom-indicator.ts` está modificado localmente. As linhas 48–57 serializam o retorno; linhas 69–84 enviam `text: 'Timer Zoom'` e `timer.action: 'start'` com direção `down`; a resposta é tratada como sucesso somente se `message === 'Success'` (linhas 59–66). A inicialização solicita `setDynamicIndicator`, mas não solicita nem registra `onSetDynamicIndicator` (linhas 4–10 e 86–89). Nenhuma ocorrência de `onSetDynamicIndicator` foi encontrada em `src/`.
- Referência oficial atual do SDK, versão documentada `0.16.42`: `setDynamicIndicator` recebe `text` e `timer` e é descrita como visível a todos os participantes, em contexto `inMeeting`, com versões mínimas Android/iOS 5.16.0 e desktop 5.17.5 ([referência da API](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)). O tipo documentado não inclui campo de ícone ([DynamicIndicatorOptions](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html)). A documentação lista `onSetDynamicIndicator` como evento de alteração, mas também indica `product: desktop`; sua disponibilidade em Android não deve ser presumida.

### Estado observado atualizado

O nome/ícone do Timer Zoom aparece na barra/menu do desktop, enquanto as capturas disponíveis não exibem os dígitos. No Android, a região mostrada está branca e sem dígitos legíveis. A última mensagem diagnóstica completa retornada por `setDynamicIndicator` após o deployment ainda não foi registrada nesta conversa. Também não há observação confirmada de um segundo participante sem o app aberto.

### Análise e diagnóstico atualizado

A presença do rótulo “Timer Zoom” confirma que o cliente identifica o app, mas não demonstra por si só que o timer nativo foi publicado ou que seus dígitos foram distribuídos. O retorno HTTP 200 e a presença da serialização no JavaScript servido confirmam a disponibilidade da versão diagnóstica, não a resposta da API Zoom nem a visibilidade para os participantes. O código local mostra o formato enviado e a regra de sucesso, mas, por estar em outro checkout/branch e modificado, não comprova sozinho o código exato servido pelo deployment.

**Diagnóstico inconclusivo:** as evidências atuais demonstram a identificação do app e a ausência visual de dígitos legíveis nas capturas, mas não determinam se a API aceitou o timer depois do deployment nem se um segundo participante o recebeu. Não há evidência suficiente para atribuir a falha ao payload, à versão do cliente ou a uma limitação de plataforma. O listener `onSetDynamicIndicator` não existe neste checkout; além disso, a referência atual o marca como `product: desktop`, então ele não constitui prova disponível para observação no Android.

### Grau de certeza

Alto para a distinção entre identificação do app e confirmação dos dígitos, para o estado dos arquivos locais e para o conteúdo do payload deste checkout. Baixo para a causa do sintoma nos clientes Zoom, pois falta o retorno diagnóstico da execução atual e a confirmação em participante independente.

### Pontos ainda não comprovados

- O retorno completo de `setDynamicIndicator` no Android e no desktop depois de recarregar a versão diagnóstica publicada.
- Se um segundo participante, sem abrir o app, vê os dígitos no indicador durante uma contagem ativa.
- Cliente/dispositivo e versão em que ocorreu cada observação, contexto da reunião e papel do operador.
- Se `onSetDynamicIndicator` está efetivamente disponível no produto/cliente em uso; a documentação atual lista `product: desktop` apesar de enumerar versões móveis.

## Verificação pública do deployment — 2026-10-31

- A consulta somente de leitura à Vercel confirmou que `dpl_3HHeMAS3d5csTpAn8DJFNA76TF6t` está `READY`, em produção, no projeto `timer-zoom`, com alias `timer-zoom.vercel.app`.
- A Vercel informou commit `cfb338b488256427f7c35a91e6225bf34c1224cb`, branch `codex/timer-v1-preview` e mensagem `debug: exibe retorno completo da API de indicador`.
- A página pública e o bundle JavaScript retornaram HTTP 200. O bundle servido contém a chamada `setDynamicIndicator` com `timer.action: 'start'` e a mensagem de erro que serializa o retorno com `JSON.stringify(...) ?? String(...)`; a operação de pausa também serializa seu retorno.
- A resposta HTML contém CSP com `frame-ancestors https://*.zoom.us https://*.zoomdev.us`, `script-src` permitindo `https://appssdk.zoom.us` e `connect-src` para o SDK. Isso comprova os cabeçalhos entregues na URL pública consultada, mas não como cada cliente Zoom recebeu ou executou a página.

Essa consulta confirma que o deployment diagnóstico está publicado e que o código de diagnóstico está no bundle público. Ela não executa o SDK no contexto Zoom, não revela a resposta de `setDynamicIndicator` durante uma reunião e não confirma a distribuição aos participantes.

## Atualização após retorno do Zoom Android — 2026-10-31

### Evidências examinadas

- Captura enviada nesta conversa do Zoom Android: produto `mobile`, versão `7.2.1.43844`, contexto `inMeeting`; `setDynamicIndicator` aparece como disponível.
- A mensagem de integração da captura mostra o retorno entre aspas: `resposta: "Success"`, enquanto o aviso afirma que a atualização foi recusada.
- A mesma captura informa APIs indisponíveis `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting`; informa ainda que `config()` recusou essas APIs e `setVirtualBackground`.
- No checkout local, `src/zoom-indicator.ts`, linhas 48–66: `responseSummary` usa `JSON.stringify` e `isSuccess` só aceita um objeto cuja propriedade `message` seja exatamente `Success`.
- Referência oficial atual do SDK 0.16.42: `GeneralMessageResponse` é documentada como `{ message: GeneralMessage }`, e `GeneralMessage` como `"Success" | "Failure"` ([tipo de resposta](https://appssdk.zoom.us/types/ZoomSdkTypes.GeneralMessageResponse.html), [tipo da mensagem](https://appssdk.zoom.us/types/ZoomSdkTypes.GeneralMessage.html)).

### Análise e diagnóstico atualizado

Na tela, `"Success"` com aspas é a serialização JSON de uma string simples (`Success`), não de um objeto com a forma `{"message":"Success"}`. Se o valor recebido é essa string, `responseMessage()` retorna `undefined`, pois rejeita qualquer valor que não seja objeto; `isSuccess()` retorna falso e o app apresenta o aviso de recusa. A captura, correlacionada com a implementação, confirma um falso negativo na mensagem da interface: o Android devolveu `Success`, mas a checagem local classificou a resposta como falha.

Isso confirma que, nessa chamada Android, a API respondeu com sucesso no formato observado. Não confirma por si só que os dígitos foram renderizados no indicador para os demais participantes. A documentação tipa o retorno como objeto `{message: ...}`, enquanto a execução observada mostra uma string simples; há uma divergência entre o tipo documentado e o valor real deste cliente/caminho.

### Diagnóstico

O aviso de recusa mostrado na captura Android é causado por uma incompatibilidade de formato no detector de sucesso: ele só reconhece `{ message: "Success" }`, mas a chamada retornou a string `"Success"`. A mensagem de erro é, portanto, incorreta para essa execução. A publicação visual do contador para um segundo participante continua sem comprovação.

### Grau de certeza

Alto para o falso negativo da mensagem, pois a captura mostra a resposta serializada e o código confirma a condição que a rejeita. Médio para a interpretação de que o Zoom aceitou a operação subjacente, baseada no retorno `Success` e na documentação que define `Success` como retorno sem erro. Ainda não há evidência direta de exibição dos dígitos a outro participante.

### Pontos ainda não comprovados

- Se um participante independente, sem abrir o app, vê os dígitos durante a contagem.
- Se o retorno em string simples ocorre somente neste cliente Android ou também em desktop/ outros clientes.

## Atualização: observadores iPhone e Ubuntu sem dígitos — 2026-10-31

### Evidências examinadas

- Relato do usuário: durante o teste, tanto o iPhone 11 quanto o desktop Ubuntu mostram os indicadores do Timer Zoom, mas nenhum apresenta os dígitos do timer.
- Captura do iPhone enviada nesta conversa: mostra a reunião no Zoom e um pequeno ícone de cronômetro/indicador perto do bloco de vídeo, sem números visíveis nesse elemento.
- Captura do desktop Ubuntu enviada nesta conversa: a barra mostra o rótulo “Timer Zoom”; o menu aberto mostra “Duração da reunião” com `08:59` e “Zoom App: Timer Zoom”, mas não mostra a contagem regressiva do Timer Zoom. O valor `08:59` está rotulado como duração da reunião e não é evidência do timer do app.
- Evidência anterior da mesma sessão Android: `setDynamicIndicator` retornou a string `"Success"` em produto mobile, contexto `inMeeting`, versão 7.2.1.43844. O checkout local envia timer regressivo com `action: 'start'`, `direction: 'down'` e segundos em `start` (`src/zoom-indicator.ts:69-79`).
- Documentação oficial atual descreve `setDynamicIndicator` como indicador visível a todos os participantes, suporta timer com ações `start`, `pause`, `resume` e `end`, e lista mínimos Android/iOS 5.16.0 e desktop 5.17.5 ([API](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html), [opções](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html)).

### Estado e análise

O falso aviso Android foi explicado pela forma da resposta e não é evidência de rejeição: a chamada retornou `Success`. Agora há evidência observacional em dois clientes distintos de que o identificador do app/indicador aparece, mas os números não são renderizados. A captura Ubuntu distingue explicitamente o indicador do app da duração padrão da reunião.

O payload de código local inclui timer regressivo, e o deployment público foi verificado anteriormente com a mesma estrutura. Portanto, os dígitos ausentes não são explicados por falta do campo `timer` no código examinado nem pela indisponibilidade de `setDynamicIndicator` no Android. Ainda não está demonstrado se os clientes recebem o campo de timer, se a chamada é feita pelo papel de reunião aceito na execução observada ou se há uma limitação/defeito do cliente Zoom ao exibir esse campo. O retorno `Success` confirma a resposta de sucesso da chamada, mas não confirma renderização nem entrega visual.

### Diagnóstico atualizado

Há um problema de apresentação/propagação do timer nativo: os clientes observadores exibem o rótulo/ícone do app sem os dígitos, apesar de o operador Android receber `Success` ao chamar `setDynamicIndicator` com opções de contagem regressiva. A causa técnica permanece inconclusiva. As capturas não mostram o retorno de `getDynamicIndicator`, o payload recebido por evento no cliente observador, nem papel do operador e versões exatas dos dois observadores. O listener `onSetDynamicIndicator` não está habilitado na configuração Development observada e a referência do SDK o classifica como `product: desktop`, então não se pode usá-lo como evidência disponível no iPhone.

### Grau de certeza

Alto para a ausência de dígitos visíveis nos dois observadores relatados/capturados e para o sucesso literal retornado pelo Android. Médio para a conclusão de que o timer está sendo aceito pelo SDK mas não aparece visualmente, pois o payload efetivamente recebido pelos clientes observadores não foi lido. Baixo para a causa subjacente dessa diferença.

### Pontos ainda não comprovados

- O papel do operador que iniciou o cronômetro na reunião.
- As versões exatas do Zoom no iPhone 11 e no Ubuntu.
- Se a estrutura do indicador armazenada no cliente inclui `timer` e seu estado de contagem regressiva.
- Se o comportamento se repete em um cliente desktop diferente, em contexto/role controlado, ou é específico destas versões de Zoom.

## Atualização: hipótese de confirmação sem estado persistido — 2026-10-31

### Esclarecimento do operador

O usuário esclarece que quem iniciou o timer foi o proprietário do aplicativo, conectado à própria conta de desenvolvedor. Essa informação substitui qualquer suposição anterior de que o timer foi iniciado por outra pessoa. Não foi solicitado repetir esse teste.

### Evidência técnica adicional

- A referência do SDK define `getDynamicIndicator()` como leitura do indicador dinâmico atual e seu retorno inclui `text` e `timer` opcionais ([método](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html), [tipo de retorno](https://appssdk.zoom.us/types/ZoomSdkTypes.GetDynamicIndicatorOutput.html)). O `timer` pode expor `action`, `direction`, `current` e `start` ([tipo do timer](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorTimerOptions.html)).
- A configuração Development lida anteriormente seleciona somente `getSupportedJsApis` e `setDynamicIndicator`; `getDynamicIndicator` não está selecionada e apareceu indisponível na execução Android.
- O código local só usa `getDynamicIndicator()` no fluxo de encerramento, para decidir se deve remover o indicador. Ele não mostra nem registra o estado do timer retornado após a publicação.

### Análise e diagnóstico atualizado

A hipótese levantada pelo usuário é compatível com as evidências: `setDynamicIndicator` devolve `Success`, mas isso pode confirmar somente que a chamada foi aceita, sem provar que o estado nativo ficou com `timer.start`/`timer.current` válidos. Até aqui, nenhum retorno de leitura do estado nativo foi capturado. O erro falso de interface já foi explicado separadamente: a resposta Android como string é rejeitada pela checagem que espera objeto.

**Diagnóstico permanece inconclusivo quanto ao estado no Zoom:** as capturas provam que os clientes observadores não exibem os dígitos; a resposta `Success` prova o retorno de sucesso da chamada; mas não há leitura independente do indicador nativo para saber se o Zoom armazenou os campos `timer` ou somente o texto do app. Esta é uma lacuna distinta da inspeção visual e do falso negativo do aviso.

### Grau de certeza

Alto para a necessidade de distinguir a confirmação da chamada do estado armazenado: a API de leitura documentada retorna os campos de texto e timer, mas não foi habilitada/consultada nesta execução. Baixo para afirmar que o Zoom descartou os dígitos, pois o objeto de leitura ainda não foi obtido.

### Ponto ainda não comprovado

- O conteúdo de `getDynamicIndicator()` no operador após iniciar o timer, especialmente se `timer` contém `action: "start"`, `direction: "down"` e os valores `start`/`current` esperados.

## Atualização: APIs solicitadas versus habilitadas — 2026-10-31

O usuário ressalta que quem inicia é o proprietário do aplicativo, conectado à própria conta, e pergunta sobre as três APIs que aparecem indisponíveis: `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting`.

No código local, `requestedApis` inclui essas APIs (`src/zoom-indicator.ts:4-10`). `getDynamicIndicator` é consultada antes de remover o indicador, para preservar o indicador se pertencer a outro app (`src/zoom-indicator.ts:149-160`); `removeDynamicIndicator` é chamada no encerramento, com fallback para `setDynamicIndicator({timer:{action:'end'}})` (`src/zoom-indicator.ts:163-186`); `onMeeting` é usada para limpar o timer ao terminar a reunião (`src/zoom-indicator.ts:193-205`, `src/App.tsx:102-109`). A tela Surface do Marketplace lida anteriormente mostrava somente `getSupportedJsApis` e `setDynamicIndicator` selecionadas.

As três capacidades devem estar habilitadas se o app precisa executar esses caminhos sem receber `unsupportedApis`: `getDynamicIndicator` é necessária para a leitura diagnóstica proposta e para a guarda de remoção; `removeDynamicIndicator` permite remover diretamente; `onMeeting` permite a limpeza automática no fim da reunião. A falta delas explica os avisos de indisponibilidade e limita leitura/limpeza.

Essa configuração não explica, por si só, a ausência inicial dos dígitos: `setDynamicIndicator`, a API que publica o timer, já estava selecionada e retornou `Success`. Portanto, habilitar `getDynamicIndicator` pode revelar se o Zoom guardou `timer.start/current`; habilitar as outras duas corrige capacidades dos fluxos de remoção/fim, sem provar nem corrigir automaticamente a renderização da contagem.

## Verificação do Marketplace no navegador — 2026-10-31

Leitura da página Surface e do seletor de APIs/eventos do app **NA TIMER**, ambiente Development:

- A Home URL está em `https://timer-zoom.vercel.app/`, e a allowlist inclui `timer-zoom.vercel.app`.
- O SDK Zoom está habilitado, Mobile está marcado e In-client OAuth está desmarcado.
- O Marketplace mostra 2 APIs selecionadas: `getSupportedJsApis` e `setDynamicIndicator`. A descrição do Marketplace para `setDynamicIndicator` diz que é chamada pelo host.
- `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting` aparecem desmarcadas. `onSetDynamicIndicator` está disponível na lista de eventos, mas desmarcada.
- A página Local test mostra `Remove App`, sinal de que o app Development já está adicionado à conta.
- A navegação e a abertura/fechamento do seletor foram somente leitura; nenhum checkbox ou configuração foi alterado. A aba foi restaurada à página Local test.

Há uma divergência de configuração observável: o checkout local em `src/zoom-indicator.ts` solicita cinco APIs, enquanto o Marketplace atualmente seleciona apenas `getSupportedJsApis` e `setDynamicIndicator`. Isso pode explicar avisos de APIs não suportadas/recusadas para `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting`; não demonstra a causa dos dígitos ausentes, pois `setDynamicIndicator` está selecionada. A descrição de host no Marketplace também torna necessário registrar o papel do operador no próximo teste, sem concluir por esta tela se participante ou co-host falhará.
