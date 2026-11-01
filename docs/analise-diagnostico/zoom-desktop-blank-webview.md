# Tela vazia do Timer Zoom no cliente desktop

## Objeto da investigação

Identificar por que o app aparece como painel escuro vazio no Zoom Workplace desktop, apesar de a URL abrir e renderizar o cronômetro em navegador comum. A investigação considera também dependências, configuração do SDK, cabeçalhos HTTP e diferença entre navegadores.

## Contexto

O usuário abriu `General app 171` durante uma reunião de teste no Zoom Workplace desktop. Nas capturas, o painel do app é escuro e não mostra a interface nem uma mensagem de erro. O mesmo app foi aberto em um navegador fora do Zoom durante a verificação anterior: o React renderizou o timer, os controles do teclado alteraram os campos e os alinhamentos foram conferidos em 1024, 768 e 425 px.

O objetivo desta etapa é diagnóstico. Nenhum código, dependência, configuração de Marketplace ou deployment foi alterado nesta investigação. O checkout já tinha alterações locais em `src/App.tsx`, `src/TimeUnitControl.tsx` e `src/style.css`; elas foram preservadas.

## Evidências examinadas

- Capturas enviadas pelo usuário nesta conversa: Zoom Workplace desktop em reunião, app identificado como `General app 171`, conteúdo do painel vazio. Não há mensagem de erro visível.
- Verificação Playwright feita anteriormente neste projeto: a página do deployment carregou fora do Zoom e exibiu `00:05:00`; teclado e campos responderam. O console registrou um erro CSP da barra de feedback da Vercel (`vercel.live`), enquanto a interface da aplicação permaneceu renderizada. Esse ensaio não reproduz o WebView do Zoom.
- Cabeçalhos obtidos nesta investigação por `curl -I https://timer-zoom.vercel.app/`: resposta HTTP 200 e presença de `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy` e `Referrer-Policy`. Esse endereço é o alias público; não é evidência dos cabeçalhos retornados pela URL Preview protegida atualmente configurada como Home URL.
- `vercel.json`, linhas 1–24: os quatro cabeçalhos exigidos pela documentação Zoom estão definidos para as rotas do app. A CSP permite scripts próprios e `https://appssdk.zoom.us`, além de `frame-ancestors https://*.zoom.us https://*.zoomdev.us`.
- `package.json`, linhas 11–21, e `npm ls --depth=0`: dependências instaladas são `@zoom/appssdk` 0.16.42, React/React DOM 19.3.1, Vite 8.3.5, TypeScript 5.9.3 e plugin React 6.1.2. Não há registro de erro de instalação ou resolução de dependências nesta inspeção.
- `src/main.tsx`, linhas 1–10: o React monta `<App />` em `#root` dentro de `StrictMode`.
- `index.html`, linhas 9–12: o bundle é iniciado por `/src/main.tsx`; a página não depende de uma rota SPA específica.
- `src/App.tsx`, linhas 82–125: o timer já é montado pelo React; a inicialização do SDK roda em `useEffect`. Se `initializeZoom()` rejeitar, o código registra estado e mensagem de erro, sem condicionar a renderização inicial do timer ao SDK.
- `src/zoom-indicator.ts`, linhas 4–10 e 69–72: o código pede cinco capacidades (`getSupportedJsApis`, `setDynamicIndicator`, `getDynamicIndicator`, `removeDynamicIndicator`, `onMeeting`), configura o SDK e consulta APIs suportadas.
- Captura anterior da página Surface no Marketplace, registrada na investigação anterior: o seletor mostrava “2 Selected”. O README registra que `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting` foram acrescentadas depois da prova inicial e que as permissões correspondentes não foram alteradas (`README.md`, linha 80). A configuração exata atual do Marketplace não foi relida nesta etapa.
- Documentação oficial Zoom do SDK: a lista de `capabilities` enviada a `config()` deve corresponder às APIs/eventos habilitados no Marketplace; `config()` informa `unsupportedApis`. A resposta também informa `clientVersion`, `browserVersion`, produto e contexto, úteis para distinguir engines e versões: https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html e https://appssdk.zoom.us/types/ZoomSdkTypes.ConfigResponse.html
- Documentação oficial Zoom de cabeçalhos de segurança: https://developers.zoom.us/docs/zoom-apps/security/owasp/ . Documentação de teste local: https://developers.zoom.us/docs/build-flow/local-test/ .
- `git status`: permaneciam modificados localmente os três arquivos de interface citados acima. Não foram editados durante a análise.

### Atualização da investigação com Playwright

- Na tela Surface atual do app `General app 171`, uma leitura somente de campos confirmou que a Home URL aponta para `timer-zoom-4sq72byzq-christian-goncalves-projects.vercel.app/` e contém os parâmetros `x-vercel-protection-bypass` e `x-vercel-set-bypass-cookie`. Os valores dos parâmetros foram omitidos deste registro. O Marketplace mostrava `Saved` e `2 Selected`.
- Abri essa Home URL no Chrome do usuário por Playwright, sem imprimir o token. A página carregou com título `Timer Zoom`, mostrando visor `00:05:00`, controles e texto `Timer local`. A checagem de logs do navegador retornou zero erros e avisos. Isso confirma que o endereço Preview atual contém o app novo e que o bypass funciona nesse Chrome.
- Em um contexto Playwright separado, abri o mesmo host Preview sem os parâmetros de bypass. A cadeia observada foi `302` para `vercel.com/sso-api`, `307` para `/login` e `200` na página `Login – Vercel`. A resposta final traz `X-Frame-Options: DENY` e CSP `frame-ancestors 'none'`.
- Reproduzi a navegação como conteúdo embutido numa página de teste servida sob uma origem simulada `https://diagnostic.zoom.us`. O alias público `timer-zoom.vercel.app` abriu, mas mostrou a antiga página `Prova de integração — Timer Zoom`; o Preview sem bypass foi bloqueado pelo Chrome, com `net::ERR_BLOCKED_BY_RESPONSE` e violação de `frame-ancestors 'none'` na resposta da Vercel.
- A navegação direta ao alias público também retornou HTTP 200 e o título antigo `Prova de integração — Timer Zoom`; portanto, ele não serve a versão atual do timer. A captura da Marketplace confirma que o Home URL selecionado está apontando para o Preview, não para esse alias público.
- A reprodução de iframe acima usou Preview sem bypass. Ainda não reproduzimos dentro do Zoom Desktop o caminho com bypass/cookie nem observamos a requisição emitida pelo WebView real.
- O ambiente do cliente é Linux (`uname -s`) e o log local identifica Zoom Workplace Linux 7.2.1 (5760). A tabela de suporte Zoom Apps em reuniões da Zoom lista Windows, macOS, VDI, Android e iOS, mas não Linux: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059804 . Uma resposta de funcionário Zoom no fórum informa que suporte a Apps em reuniões no Linux chegaria na versão 7.1.0; por isso, 7.2.1 enfraquece a hipótese de cliente simplesmente antigo, mas a documentação de suporte ainda deixa a plataforma ambígua: https://community.zoom.com/meetings-2/apps-missing-from-toolbar-no-matter-if-enabled-online-or-not-79651
- A documentação oficial para habilitar o menu de ferramentas de desenvolvedor do WebView descreve configuração para Windows e macOS, sem instruções Linux: https://developers.zoom.us/docs/zoom-apps/create/ . A inspeção de console do WebView não foi possível pelas ferramentas disponíveis nesta sessão.
- Depois do teste sugerido de abrir o app em uma janela separada, o usuário enviou nova captura: a janela destacada `General app 171` também permanece totalmente escura, sem timer ou mensagem de erro. Portanto, tirar o app do painel lateral não resolveu nem tornou visível uma tela de login. A captura mostra a reunião ainda ativa e a lista de apps aberta.
- Nova captura enviada pelo usuário mostra o Zoom Android com a superfície web do app `General app 171` totalmente branca, ainda sem interface ou erro visível. O usuário esclareceu que a validação Android anteriormente descrita no README foi somente a exibição do indicador nativo do Zoom; a tela web do timer não foi validada nessa ocasião. Portanto, aquela prova não demonstra que a página do app abriu no Android.

## Estado observado

O comportamento confirmado é diferente entre contextos: o Chrome do usuário renderiza a Home URL Preview quando o bypass está presente, enquanto o painel do Zoom apresentado nas capturas não mostra conteúdo. Sem bypass, o Preview redireciona para o login da Vercel; essa tela proíbe exibição em iframe. O alias público é acessível, mas entrega uma versão antiga de prova de integração. O cliente Zoom ainda não forneceu nesta sessão console do WebView, versão do cliente ou versão do browser interno.

## Análise

1. **Dependências:** o inventário não indica pacote ausente ou conflito direto entre React, Vite e `@zoom/appssdk`. Isso reduz a probabilidade de uma falha geral de build/import, mas não prova compatibilidade do bundle com a engine embutida na versão instalada do Zoom. A documentação do SDK informa que APIs disponíveis variam por versão do cliente e recomenda observar `clientVersion` e `browserVersion` retornados por `config()`.
2. **Permissões do SDK:** há uma divergência potencial concreta entre cinco capacidades solicitadas no código e as duas selecionadas na captura histórica do Marketplace. Isso pode fazer o SDK recusar ou marcar capacidades como não suportadas. Porém, a lógica da página trata a inicialização do SDK como efeito posterior à montagem e exibe uma mensagem de falha; isoladamente, essa divergência não explica por que o painel inteiro fica vazio.
3. **Cabeçalhos/CSP:** os cabeçalhos requeridos estão presentes no alias público, e a CSP é compatível com os domínios de script e de frame documentados. O erro CSP observado no Playwright bloqueava somente a barra opcional de feedback da Vercel, sem impedir a renderização fora do Zoom. Ainda não há leitura da resposta HTML e dos cabeçalhos da URL Preview protegida dentro do caminho real de acesso do cliente Zoom.
4. **Proteção da Vercel e cookies:** o Preview sem bypass redireciona ao login e esse login é bloqueado em iframe. A Home URL no Marketplace contém os dois parâmetros de bypass e carrega no Chrome do usuário, mas o Zoom continua vazio também na janela separada. Isso reduz a hipótese de um problema restrito ao painel lateral; ainda aponta para diferença no processamento da URL, cookie ou redirecionamento dentro do WebView Zoom. Não observamos o pedido de rede emitido pelo Zoom nem foi exibida uma tela de login no pop-out.
5. **Plataforma/engine do Zoom:** o cliente é Linux 7.2.1 (5760). A tabela atual de requisitos de Zoom Apps em reuniões não lista Linux, enquanto uma resposta de funcionário Zoom indicava suporte no Linux a partir de 7.1.0. Portanto, não atribuímos o sintoma à falta geral de suporte, mas a matriz oficial e a falta do `browserVersion` deixam compatibilidade da engine como hipótese em aberto. A execução em Chrome comum não substitui essa medição.
6. **StrictMode:** a montagem extra de efeitos do React StrictMode é específica de desenvolvimento; não é evidência de que a página publicada em produção falhe por esse motivo. A renderização local e a separação entre montagem e SDK também tornam essa hipótese fraca.

## Hipóteses avaliadas

- **Dependência ausente ou conflito npm global:** enfraquecida. `npm ls --depth=0` resolveu o conjunto instalado e o bundle renderizou no Playwright; ainda não foi reproduzido o build do deployment dentro do cliente Zoom.
- **Versão do SDK incompatível com o cliente desktop:** possível, mas sem evidência específica. O pacote está instalado e importado; faltam as versões reais reportadas pelo Zoom e uma mensagem de falha do SDK.
- **Capacidades não autorizadas no Marketplace:** divergência provável a confirmar; pode afetar a inicialização e o indicador, mas o código deveria manter a interface local visível após falha do SDK.
- **CSP ou cabeçalhos inválidos:** enfraquecida para o alias público, onde os quatro cabeçalhos aparecem e o app abre no navegador. Continua em aberto para a URL Preview protegida efetivamente usada.
- **Bloqueio de proteção Vercel dentro do WebView:** hipótese principal. O Preview sem bypass redireciona ao login e a resposta do login impede iframe; a URL com bypass funciona no Chrome do usuário, mas ainda não foi observado qual resposta o WebView Zoom recebe.
- **Erro de carregamento/executação específico do WebView ou cliente Zoom desatualizado:** possível e atualmente sem evidência direta, pois não há console ou versão do browser interno.
- **Limitação específica do Zoom Apps no Linux:** ambígua. A documentação de requisitos para Meetings não lista Linux; ao mesmo tempo, o cliente deste computador é 7.2.1 e há resposta de funcionário Zoom associando suporte a reuniões Linux à versão 7.1.0. Não confirma nem descarta uma limitação ou regressão no WebView Linux.

## Diagnóstico

**Causa ainda não confirmada.** O Preview sem bypass redireciona para autenticação da Vercel, e o login é bloqueado quando embutido; isso reproduz uma tela vazia em iframe. A tela web fica vazia tanto no Zoom desktop quanto no Android, enquanto a Home URL com bypass funciona no Chrome. Isso desloca a investigação de uma hipótese exclusiva de Linux para uma falha comum ao acesso dentro do Zoom, como proteção/redirecionamento ou bloqueio/erro de carregamento do WebView. O domínio público alternativo não serve a versão atual do timer.

## Grau de certeza

Alto para a cadeia de redirecionamento do Preview sem bypass, o bloqueio em iframe, a versão antiga no alias público, a Home URL com bypass carregar no Chrome e as capturas mostrarem a tela web vazia no desktop e Android. A validação anterior do Android cobre apenas o indicador nativo e não a tela web. Baixo a médio para as causas específicas do WebView ou bypass/cookie, pois o cliente Zoom não forneceu console ou resposta de rede.

## Pontos ainda não comprovados

- Se o WebView do Zoom envia o parâmetro de bypass no primeiro pedido e recebe o app, ou se segue o redirecionamento para a página de login da Vercel.
- Quais cabeçalhos e corpo foram retornados pela URL Preview protegida ao cliente Zoom.
- `clientVersion`, `browserVersion`, `userAgent`, `product`, `runningContext` e `unsupportedApis` retornados no desktop.
- Se o Zoom Marketplace atualmente habilita todas as cinco capacidades solicitadas pelo código.
- Se o console do WebView registra erro de CSP, módulo JavaScript, import, handshake ou navegação.
- Se a captura Android representa uma resposta de autenticação/bloqueio da Vercel ou uma falha de carregamento da página; a barra do Zoom não revela a URL efetivamente solicitada nem o corpo recebido.
- Se o Zoom conserva o cookie SameSite=None criado pelo parâmetro `x-vercel-set-bypass-cookie` entre a abertura inicial e os pedidos seguintes.
- Se o app abriu após atualização/reinício completo do Zoom Workplace e limpeza dos dados locais do app; essa ação não foi executada nesta análise.

## Publicação para remover a proteção do Preview

- Em 2026-10-31, foi criado um deployment de produção no projeto Vercel `timer-zoom`, a partir do commit `5ac98d67083b38ddc655b0ff9dd3f51c09e5dab3` da branch `codex/timer-v1-preview`. O deployment ficou `READY` e recebeu o alias público `https://timer-zoom.vercel.app/`.
- Acesso somente de leitura pelo navegador confirmou que esse domínio entrega a tela atual do Timer Zoom sem tela de login. A verificação Vercel da janela de uma hora não encontrou erros de runtime.
- Em seguida, o usuário confirmou que a mesma versão pública abriu no Chrome do Android. Isso confirma que o deployment, HTTPS e acesso de rede no celular funcionam fora do Zoom; a diferença observada permanece no contexto embutido do Zoom.
- Na página Surface do app Development `General app 171`, a Home URL foi alterada para `https://timer-zoom.vercel.app/`. Após recarregar a página do Marketplace, o valor permaneceu salvo. O domínio já constava na allowlist.
- Os arquivos de execução locais (`src/App.tsx`, `src/TimeUnitControl.tsx`, `src/style.css`, lógica e SDK) tiveram os hashes Git comparados com os da branch publicada; todos conferem. `npm run build` passou localmente.
- A tela do timer dentro do Zoom ainda precisa ser reaberta depois da troca da Home URL. Se continuar vazia, a proteção do Preview deixa de ser explicação suficiente e a investigação deve se concentrar no WebView do Zoom, políticas do cliente e inicialização dentro dele.
- A branch `main` do GitHub não foi atualizada. A tentativa de criar um PR pelo conector foi recusada com HTTP 403 (`Resource not accessible by integration`). A produção atual está publicada diretamente do commit da branch de Preview; um deployment futuro da branch `main` pode substituir este deployment até a versão ser integrada nela.

## Atualização após teste no Zoom — 2026-10-31

As observações anteriores de tela vazia foram superadas pelo teste depois da troca da Home URL para o alias público:

- O usuário confirmou que a URL pública abriu no Chrome Android.
- Novas capturas confirmam que o conteúdo do Timer Zoom também renderiza dentro da reunião no Zoom Android e no Zoom Workplace desktop. O visor local conta, fica verde durante a execução e os controles de pausa/retomada aparecem. Portanto, a falha da página em branco não se reproduz com a Home URL pública atual.
- O diagnóstico embutido mostra Android `mobile` 7.2.1.43844 e desktop `desktop` 7.2.1.5760, ambos em `inMeeting`. Em ambos, `setDynamicIndicator` aparece disponível. `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting` aparecem indisponíveis; `config()` também lista esses nomes entre os recusados. Isso afeta leitura/limpeza e evento de fim, mas não explica sozinho a recusa de `setDynamicIndicator`.
- O aviso da app informa que o Zoom não aceitou a atualização do indicador, embora o timer local continue. A documentação atual do SDK lista `setDynamicIndicator` para Android a partir de 5.16.0 e desktop a partir de 5.17.5, no contexto `inMeeting`; as versões mostradas superam esses mínimos. A documentação também diz que a resposta da API é `GeneralMessageResponse`, cujo resultado de sucesso é `Success`.
- Foi identificado que `src/zoom-indicator.ts` descartava o conteúdo de uma resposta não-success e mostrava somente uma mensagem genérica. O código local agora inclui `response.message` nos avisos de falha de publicação, pausa e retomada. `npm run build` passou após essa mudança. Essa instrumentação ainda não está publicada nem validada no Zoom.

Referências Zoom: [setDynamicIndicator](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html), [DynamicIndicatorOptions](https://appssdk.zoom.us/types/ZoomSdkTypes.DynamicIndicatorOptions.html) e [GeneralMessageResponse](https://appssdk.zoom.us/types/ZoomSdkTypes.GeneralMessageResponse.html).

**Próxima evidência necessária:** obter a resposta exata de `setDynamicIndicator` no Zoom. Para isso, a alteração local que revela `response.message` precisa ser publicada e testada; depois, comparar a resposta no Android e no desktop. Ainda não foi confirmado se outros participantes veem/atualizam o indicador nativo.
