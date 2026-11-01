# Erro `app_not_support` ao iniciar o Zoom Apps SDK no Android

## Objeto da investigação

Identificar por que o Timer Zoom abre no cliente Android, mas mostra `No Permission for this API [code:80004, reason:app_not_support]` durante a inicialização do SDK.

## Contexto

O aplicativo é um Zoom App gerenciado pelo usuário, aberto em uma reunião no Zoom para Android. A etapa de integração chama `zoomSdk.config()` solicitando `getSupportedJsApis` e `setDynamicIndicator`.

## Evidências examinadas

- Captura Android enviada por Christian nesta conversa: o app abriu dentro do Zoom e apresentou o erro `No Permission for this API. [code:80004, reason:app_not_support]`; Produto continuou como “Aguardando cliente Zoom”.
- `src/App.tsx`, linhas 7 e 21–22: `config()` recebe `getSupportedJsApis` e `setDynamicIndicator`; em seguida o app chama `getSupportedJsApis()`.
- Página Surface > Zoom App SDK do app `General app 171`, ambiente Development, inspecionada no Zoom App Marketplace: inicialmente havia somente uma API selecionada. O seletor mostrava `setDynamicIndicator` marcado e `getSupportedJsApis` desmarcado.
- Capturas Android enviadas após habilitar a segunda API: Produto `mobile`, Zoom `7.2.1.43844`, Contexto `inMeeting`; ambas as APIs aparecem como disponíveis e a chamada de `setDynamicIndicator` retorna `Success`.
- Captura do Zoom Workplace desktop enviada em seguida: a barra superior da reunião exibe `Prova do Timer Zoom` como indicador ativo.
- Documentação oficial da classe `ZoomSdk.config`: a lista `capabilities` deve corresponder às APIs e eventos adicionados ao app no fluxo do Marketplace: https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html
- Documentação oficial de permissões: `getSupportedJsApis()` informa as APIs permitidas no contexto do usuário e `config()` retorna APIs sem permissão em `unsupportedApis`: https://developers.zoom.us/docs/zoom-apps/guides/roles-and-permissions/

## Estado observado

O app carregou no Zoom Android, mas a configuração do SDK não concluiu; por isso, não apresentou produto, versão do Zoom ou contexto. No Marketplace, o app estava com suporte Mobile ativo e `setDynamicIndicator` selecionada, mas a segunda capacidade solicitada pelo código não estava habilitada.

Durante a investigação, `getSupportedJsApis` foi habilitada no app de desenvolvimento. A confirmação visual do Marketplace mostrou `getSupportedJsApis` marcado e o seletor com `2 Selected`; a leitura do estado acessível confirmou também `setDynamicIndicator` marcado.

## Análise

O código solicita duas capacidades no `config()`, enquanto a configuração do Marketplace autorizava apenas uma. O próprio Zoom documenta que essas listas precisam corresponder. A chamada de inicialização foi recusada antes de `getSupportedJsApis()` e antes de qualquer tentativa de publicar o indicador; portanto, a captura não demonstra indisponibilidade de `setDynamicIndicator` no Android.

## Diagnóstico

**Causa confirmada:** `getSupportedJsApis` era solicitada pelo código, mas não estava habilitada nas APIs do Zoom Apps SDK no Marketplace. Essa divergência explica a recusa de permissão durante `config()`.

A permissão ausente foi habilitada no app Development. Na reabertura, o Android inicializou o SDK, informou as duas APIs como disponíveis e respondeu `Success` à publicação do indicador. A captura subsequente do Zoom Workplace desktop mostra `Prova do Timer Zoom` na barra da reunião.

## Grau de certeza

Alto: a divergência foi constatada diretamente no código e no seletor do Marketplace; após habilitar a capacidade faltante, as capturas mostram inicialização bem-sucedida no Android, disponibilidade das APIs, resposta `Success` e indicador visível na barra do Zoom Workplace desktop.

## Pontos ainda não comprovados

- Se um participante independente, em outra conta/dispositivo, também visualiza o indicador; a evidência disponível é a barra da reunião no cliente desktop.
- Se a resposta `unsupportedApis: setVirtualBackground` no Android representa somente capacidade não disponível nesse contexto; essa API não é solicitada nem utilizada pelo protótipo.
