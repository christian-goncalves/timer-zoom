# Timer compartilhado para Zoom

## Estado da integração

Consulte o [diagnóstico dos dígitos, da sincronização e das versões](docs/analise-diagnostico/zoom-digitos-sincronizacao-e-versoes.md) para identificar a base de código examinada, o deployment correspondente e as limitações comprovadas. A causa dos dígitos nativos ausentes permanece inconclusiva; o funcionamento do painel e a resposta `Success` do SDK não confirmam a exibição aos participantes.

Os registros por etapa abaixo e os documentos anteriores preservam o histórico. A [pesquisa](docs/pesquisa/resultado.md) contém exemplos com escala temporal antiga; suas recomendações devem ser confrontadas com o diagnóstico de referência.

## Objetivo

Criar um Zoom App simples para controlar um cronômetro de reunião com opções rápidas de 3, 5 e 10 minutos. O timer deve aparecer na interface do Zoom por meio do indicador dinâmico do Zoom Apps SDK. Durante a contagem, o visor deve ficar verde e mudar para vermelho quando restar 1 minuto ou menos.

O projeto será desenvolvido no VS Code com apoio do Codex. A primeira versão será mobile-first, com foco no Zoom para Android, e também deverá funcionar no cliente Zoom para desktop quando os recursos usados estiverem disponíveis.

## Referências visuais

As imagens de referência fornecidas neste checkout estão na raiz (`timer-idle-reference.jpeg` e `timer-running-reference.jpeg`). O caminho `docs/references/` descrito no plano ainda não existe.

- `timer-idle-reference.jpeg`: estado parado, visor em 00:05:00, botão principal e seletores de duração.
- `timer-running-reference.jpeg`: estado em execução, visor verde e controles de pausar e encerrar. O controle de acréscimo de tempo da referência não faz parte da interface solicitada.

Use essas imagens para reproduzir a hierarquia, o contraste, o espaçamento e a simplicidade da tela. O cabeçalho do Zoom, a barra de status do celular e elementos de reunião ao redor do app pertencem ao cliente Zoom/SO. Eles não devem ser redesenhados como parte da página.

## Escopo inicial

- Exibir a duração selecionada no formato `HH:MM:SS`, com cinco minutos como valor inicial.
- Oferecer seletores rápidos de 3, 5 e 10 minutos. Esses valores substituem os botões 1, 3 e 10 minutos vistos na captura parada.
- Permitir ajustar horas, minutos e segundos pelos chevrons em cada campo. O hover do mouse mostra contorno e setas apenas no campo apontado; no toque, tocar no valor seleciona o campo. Ocultar os nomes das unidades durante a pausa.
- Permitir iniciar, pausar, retomar e encerrar/zerar a contagem.
- Durante a contagem, usar verde para o tempo acima de 1 minuto e vermelho quando o tempo restante for igual ou inferior a 60 segundos.
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
3. Os campos de horas, minutos e segundos podem ser selecionados e alterados pelos chevrons antes de iniciar e durante a pausa.
4. Iniciar, pausar, retomar e zerar funcionam.
5. O visor do app muda para vermelho ao entrar no último minuto.
6. O indicador dinâmico é publicado e visto por participantes em cliente compatível.
7. O comportamento visual e a disponibilidade das APIs são conferidos em Android real; limitações do SDK ficam registradas, sem simular controles nativos que o Zoom não oferece.

## Documentação oficial

- [Zoom Apps para dispositivos móveis](https://developers.zoom.us/docs/zoom-apps/guides/mobile/)
- [Guia rápido para criar um app Zoom](https://developers.zoom.us/docs/build-flow/quick-start-guide/)
- [Referência do Zoom Apps SDK](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [Teste local de Zoom Apps](https://developers.zoom.us/docs/build-flow/local-test/)
- [Depuração de Zoom Apps em Android e iOS](https://developers.zoom.us/docs/zoom-apps/guides/zoom-apps-for-mobile-debug/)

## Etapa 1 — prova de integração

A estrutura React, TypeScript e Vite está preparada. Na Etapa 1, a página de prova chamou `zoomSdk.config()` com `getSupportedJsApis` e `setDynamicIndicator`, mostrou o produto/versão/contexto retornados pelo cliente e consultou `getSupportedJsApis()`. A seção recolhida “Diagnóstico da integração Zoom” preserva a inicialização e a consulta das APIs; o botão de prova isolada foi substituído pela publicação vinculada ao timer na Etapa 3. A validação inicial em 2026-10-31 no Zoom Android 7.2.1.43844 retornou `Success`; em seguida, o cliente Zoom Workplace desktop exibiu “Prova do Timer Zoom” na barra da reunião.

## Etapa 2 — interface visual

**Concluída em 2026-10-31:** a tela visual foi implementada com estado inicial parado em `00:05:00`, presets de 3, 5 e 10 minutos e aparências distintas para execução, pausa e último minuto. A interface local foi conferida em largura mobile (320 px) e desktop (1280 px). A Etapa 3 abaixo conectou os controles à contagem real.

## Etapa 3 — timer e indicador Zoom

**Implementada localmente em 2026-10-31:** os presets e controles operam o timer local por prazo final; horas, minutos e segundos também podem ser ajustados individualmente em repouso ou durante a pausa. No mouse, o contorno e chevrons acompanham o hover; no toque, a seleção persiste. Durante a pausa, os nomes das unidades desaparecem e os dígitos mantêm o alinhamento da execução. O visor fica vermelho nos últimos 60 segundos. O app consulta as APIs atuais e tenta sincronizar o indicador com `setDynamicIndicator`. Erros e APIs ausentes não interrompem a contagem local. A remoção consulta o indicador atual antes de apagar um com o rótulo do Timer Zoom; o encerramento da reunião usa `onMeeting` quando disponível.

A implementação ainda não foi validada no Zoom Android ou desktop. A resposta de uma chamada do SDK não confirma visibilidade aos demais participantes. A cor vermelha é aplicada ao visor web; não foi implementada mudança de estilo do indicador nativo no Android. A limpeza no fim da reunião depende de `onMeeting` estar disponível no cliente. O código solicita `getDynamicIndicator` e `removeDynamicIndicator` além das capacidades da prova inicial; as permissões correspondentes no Marketplace não foram alteradas nesta etapa.

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
5. No Zoom Android, entre em uma reunião de teste e abra o app. Confira Produto, Versão do Zoom e Contexto, além das APIs disponíveis na seção “Diagnóstico da integração Zoom”.
6. Para validar a Etapa 3, use os controles do timer e confira o visor e as mensagens de sincronização. Confirme a visibilidade do indicador em outro participante; a resposta `Success` do SDK, sozinha, não confirma essa visibilidade.

**Etapa 1 validada em 2026-10-31:** o app abriu no Zoom Android em contexto `inMeeting`; `getSupportedJsApis` e `setDynamicIndicator` foram reportadas como disponíveis. Após habilitar também `getSupportedJsApis` no Marketplace (o código já solicitava essa API), a chamada de `setDynamicIndicator` respondeu `Success`. A barra de reunião do Zoom Workplace desktop mostrou “Prova do Timer Zoom”. A visibilidade foi confirmada no cliente desktop; a validação com um participante independente ainda não foi registrada. O aviso `unsupportedApis: setVirtualBackground` também apareceu, mas essa API não é solicitada nem usada pela prova.
