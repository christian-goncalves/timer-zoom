# Timer compartilhado para Zoom

## Objetivo

Criar um Zoom App simples para controlar um cronômetro de reunião com opções rápidas de 3, 5 e 10 minutos. O timer deve aparecer na interface do Zoom por meio do indicador dinâmico do Zoom Apps SDK. Durante a contagem, o visor deve ficar verde e mudar para vermelho quando restar 1 minuto ou menos.

O projeto será desenvolvido no VS Code com apoio do Codex. A primeira versão será mobile-first, com foco no Zoom para Android, e também deverá funcionar no cliente Zoom para desktop quando os recursos usados estiverem disponíveis.

## Referências visuais

As imagens de referência fornecidas neste checkout estão na raiz (`timer-idle-reference.jpeg` e `timer-running-reference.jpeg`). O caminho `docs/references/` descrito no plano ainda não existe.

- `timer-idle-reference.jpeg`: estado parado, visor em 00:05:00, botão principal e seletores de duração.
- `timer-running-reference.jpeg`: estado em execução, visor verde, controles de acrescentar tempo, pausar e encerrar.

Use essas imagens para reproduzir a hierarquia, o contraste, o espaçamento e a simplicidade da tela. O cabeçalho do Zoom, a barra de status do celular e elementos de reunião ao redor do app pertencem ao cliente Zoom/SO. Eles não devem ser redesenhados como parte da página.

## Escopo inicial

- Exibir a duração selecionada no formato `HH:MM:SS`, com cinco minutos como valor inicial.
- Oferecer seletores rápidos de 3, 5 e 10 minutos. Esses valores substituem os botões 1, 3 e 10 minutos vistos na captura parada.
- Permitir iniciar, pausar, retomar e encerrar/zerar a contagem.
- Durante a contagem, usar verde para o tempo acima de 1 minuto e vermelho quando o tempo restante for igual ou inferior a 60 segundos.
- Permitir acrescentar 30 segundos, conforme o controle visível na captura em execução.
- Publicar o timer como indicador dinâmico do Zoom, visível aos participantes, quando a API estiver disponível.
- Remover ou encerrar o indicador ao zerar/encerrar o timer e tratar o encerramento da reunião.
- Construir uma interface responsiva, com alvos de toque confortáveis e contraste alto.

## Fora do escopo da primeira versão

O cronômetro progressivo, a fila “Up next”, autenticação própria, banco de dados, painel administrativo e sincronização por servidor não são necessários para o primeiro protótipo. O controle de som aparece na referência e pode ser avaliado depois da validação do timer compartilhado. Não incluir recursos que pareçam funcionais se ainda forem apenas visuais.

## Stack sugerida

- React, TypeScript e Vite para a aplicação web.
- `@zoom/appssdk` para comunicação entre a página e o cliente Zoom.
- CSS responsivo para reproduzir a interface de referência sem dependências visuais pesadas.
- Sem backend ou banco de dados na primeira versão. O app deve usar o indicador dinâmico do Zoom para publicar o timer na reunião.

O app será servido por uma URL HTTPS configurada como Home URL no Zoom App Marketplace. O cadastro precisa habilitar o Zoom Apps SDK, o uso em Meetings e o suporte a Mobile Client. Para testes, usar o fluxo Local Test e depois validar no aplicativo Zoom para Android.

## Integração e validação técnica

A API central é `setDynamicIndicator`, que configura um indicador visível aos participantes. A referência do SDK lista suporte dessa API para clientes Android e iOS a partir da versão 5.16.0. O app deve chamar `zoomSdk.config()` no início, solicitar apenas as capacidades necessárias e consultar `getSupportedJsApis()` ou a resposta de configuração para detectar APIs indisponíveis.

A API separada `setDynamicIndicatorStyle`, que altera somente o estilo de um indicador existente, aparece documentada para o cliente desktop. Por isso, ainda não se deve presumir que a cor do indicador nativo compartilhado mudará para vermelho em todos os clientes Android. O protótipo deve validar esse comportamento. A mudança para vermelho no visor próprio do app é requisito da interface; a mudança de cor no indicador nativo compartilhado depende do teste no cliente Android.

O contador local deve calcular o tempo restante a partir de um horário final, em vez de subtrair um segundo por chamada de intervalo. Isso reduz deriva quando a página perde foco ou o dispositivo fica ocupado.

## Critérios de aceite do protótipo

1. O app abre dentro do Zoom em uma reunião de teste.
2. Os botões de 3, 5 e 10 minutos atualizam o visor corretamente.
3. Iniciar, pausar, retomar, acrescentar 30 segundos e zerar funcionam.
4. O visor do app muda para vermelho ao entrar no último minuto.
5. O indicador dinâmico é publicado e visto por participantes em cliente compatível.
6. O comportamento visual e a disponibilidade das APIs são conferidos em Android real; limitações do SDK ficam registradas, sem simular controles nativos que o Zoom não oferece.

## Documentação oficial

- [Zoom Apps para dispositivos móveis](https://developers.zoom.us/docs/zoom-apps/guides/mobile/)
- [Guia rápido para criar um app Zoom](https://developers.zoom.us/docs/build-flow/quick-start-guide/)
- [Referência do Zoom Apps SDK](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [Teste local de Zoom Apps](https://developers.zoom.us/docs/build-flow/local-test/)
- [Depuração de Zoom Apps em Android e iOS](https://developers.zoom.us/docs/zoom-apps/guides/zoom-apps-for-mobile-debug/)

## Etapa 1 — prova de integração

A estrutura React, TypeScript e Vite está preparada. A página atual é somente uma prova técnica: chama `zoomSdk.config()` com `getSupportedJsApis` e `setDynamicIndicator`, mostra o produto/versão/contexto retornados pelo cliente e consulta `getSupportedJsApis()`. O botão de prova publica um indicador descendente de 30 segundos apenas quando o cliente declara a API disponível. Esta resposta não confirma a visibilidade do indicador para outros participantes; isso depende do teste em reunião.

### Executar localmente

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Para abrir a aplicação no Zoom Android, a URL precisa estar acessível ao aparelho por HTTPS. Use um túnel HTTPS para a porta local 5173 e configure a URL pública gerada como Home URL no Zoom App Marketplace. Não coloque credenciais ou segredos do Zoom no projeto.

### Preparar o teste no Zoom

1. No Zoom App Marketplace, crie ou selecione um app do tipo Zoom App, gerenciado pelo usuário (User-managed), no ambiente Development.
2. Nas configurações de Surface/Zoom Client Support, habilite o Mobile Client. Configure a superfície de Meetings para abrir o app durante uma reunião.
3. Defina a Home URL com a URL HTTPS do túnel que aponta para o servidor Vite.
4. No fluxo Local Test, complete os campos obrigatórios e adicione/autorize o app no cliente Zoom usado para testar.
5. No Zoom Android, entre em uma reunião de teste e abra o app. Confira Produto, Versão do Zoom e Contexto, além do resultado para `getSupportedJsApis` e `setDynamicIndicator`.
6. Se `setDynamicIndicator` estiver disponível, toque em “Publicar indicador de teste”. Verifique o indicador no cliente e peça a um participante da reunião que confirme se também o vê. O indicador enviado tem duração de 30 segundos.

**Validação Android pendente:** este ambiente não está conectado a uma conta do Marketplace nem a um cliente Zoom Android. Portanto, não foi possível observar a resposta real de `config()`, a lista de APIs do aparelho, a abertura no Android ou a visualização por participantes. Consulte a versão instalada no aparelho; a documentação do SDK lista `setDynamicIndicator` para Android a partir da versão 5.16.0. Se a API não aparecer como disponível, confira a versão do cliente e a configuração do app no Marketplace antes de avançar.
