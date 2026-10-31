# Plano de execução — Timer compartilhado para Zoom

Este documento organiza o desenvolvimento em quatro etapas. O trabalho deve avançar uma etapa por vez, mantendo a aplicação pequena e validando primeiro a integração com o Zoom para Android.

## Etapa 1 — Preparar o projeto e comprovar a integração

**Andamento neste checkout (2026-10-31): Etapa 1 concluída.** O app abriu em reunião no Zoom Android 7.2.1.43844 (`product: mobile`, `runningContext: inMeeting`). As APIs `getSupportedJsApis` e `setDynamicIndicator` foram reportadas disponíveis; a chamada de teste retornou `Success`. O indicador “Prova do Timer Zoom” foi visto na barra da reunião do cliente Zoom Workplace desktop. A primeira tentativa falhou porque `getSupportedJsApis` era pedida no código mas não estava selecionada no Marketplace; essa permissão foi alinhada. A checagem com um participante independente não foi registrada.

**Objetivo:** deixar a estrutura pronta no VS Code e confirmar que uma página web consegue abrir como Zoom App no cliente Android.

**Especificação mínima:**

- Inspecionar a pasta atual antes de criar ou substituir arquivos.
- Preparar React, TypeScript e Vite somente se o projeto ainda não tiver uma estrutura equivalente.
- Adicionar o Zoom Apps SDK e inicializá-lo com `zoomSdk.config()`.
- Criar uma página de prova simples, sem tentar reproduzir ainda o design final.
- Consultar as APIs disponíveis no cliente e tentar publicar um indicador dinâmico curto em uma reunião de teste.
- Registrar o que depende de configuração manual no Zoom App Marketplace, como Home URL, permissão para Meetings, SDK e suporte a Mobile Client.

**Resultado esperado:** projeto executável localmente e procedimento claro para abrir a prova de integração no Zoom Android. Se a conta, a versão do cliente ou uma configuração impedir o teste, registrar o bloqueio e as instruções exatas para resolvê-lo. Não avançar para a interface final nesta etapa.

## Etapa 2 — Reproduzir a interface das referências

**Andamento neste checkout (2026-10-31): Etapa 2 concluída.** A interface local foi conferida em largura mobile (320 px) e desktop (1280 px), incluindo prévias dos estados em execução e no último minuto; `npm run build` passou. Os controles do timer e os valores de tempo são apenas visuais, sem contagem, pausa, acréscimo ou sincronização com o indicador. A aparência dentro do Zoom Android ainda não foi revalidada após esta etapa.

**Objetivo:** montar a tela visual do timer, adaptada ao espaço disponível dentro do Zoom.

**Especificação mínima:**

- Usar como referência `docs/references/timer-idle-reference.jpeg` e `docs/references/timer-running-reference.jpeg`.
- Reproduzir fundo preto, visor amplo, tipografia clara, azul nas ações principais, verde durante a contagem e vermelho para o último minuto.
- Usar os tempos rápidos **3, 5 e 10 minutos** e iniciar com **5 minutos**; os valores do projeto substituem os valores diferentes mostrados na captura.
- Preparar estados visuais parado e em execução, com botões de iniciar, pausar/retomar e encerrar. O estado em execução alinha Pausar/Retomar e Zerar ao lado do visor na mesma linha.
- Usar rótulos em português do Brasil e manter a interface responsiva, priorizando celular.
- Não redesenhar a barra de status do celular, o cabeçalho do Zoom, o vídeo/avatar do participante ou outros elementos do cliente Zoom.

**Resultado esperado:** interface responsiva reconhecível em relação às imagens, ainda sem implementar cronômetro progressivo, fila de próximos timers ou alarme sonoro.

## Etapa 3 — Implementar o cronômetro e sincronizar com o Zoom

**Andamento neste checkout (2026-10-31): implementação local concluída.** Os controles usam contagem por prazo final; horas, minutos e segundos também podem ser ajustados individualmente antes de iniciar ou enquanto pausado. O contorno e chevrons seguem o hover do mouse e a seleção por toque. Durante a pausa, os nomes das unidades ficam ocultos e o visor mantém o alinhamento da execução. As cores do visor acompanham o último minuto e o app solicita/consulta `setDynamicIndicator`, `getDynamicIndicator`, `removeDynamicIndicator` e `onMeeting`. Falhas da ponte Zoom deixam o cronômetro local funcionando. Por solicitação do usuário, o controle de acréscimo de 30 segundos foi removido; Pausar/Retomar e Zerar ficam ao lado do visor. `npm run build` passou. Ainda não foi validado em cliente Zoom após a implementação; a confirmação de visibilidade por outro participante e o comportamento do indicador no Android pertencem à Etapa 4.

**Objetivo:** ligar os controles da tela à contagem real e ao indicador dinâmico compartilhado.

**Especificação mínima:**

- Implementar seleção de 3, 5 e 10 minutos, iniciar, pausar, retomar e zerar.
- Permitir selecionar e alterar horas, minutos e segundos com chevrons centralizados; o hover destaca temporariamente o campo no desktop e o toque mantém o campo selecionado no celular. Ocultar os nomes das unidades durante a pausa.
- Calcular o tempo por horário final, evitando depender de subtrair um segundo por intervalo.
- Mudar o visor próprio do app para vermelho quando faltarem 60 segundos ou menos.
- Usar `setDynamicIndicator` para publicar o timer no Zoom quando a API estiver disponível.
- Tratar APIs indisponíveis e erros sem travar o cronômetro local.
- Encerrar/remover o indicador quando o timer for zerado ou a reunião terminar, se a API permitir.
- Não adicionar backend, banco de dados ou autenticação própria nesta versão.

**Resultado esperado:** timer funcional no app e indicador compartilhado nos clientes Zoom compatíveis. A mudança de cor do indicador nativo compartilhado no Android deve ser considerada pendente até ser comprovada; a mudança de cor do visor do app continua obrigatória.

## Etapa 4 — Validar e preparar para uso

**Objetivo:** verificar o comportamento nos clientes previstos e deixar instruções de uso e configuração.

**Especificação mínima:**

- Conferir os estados de seleção, início, pausa, retomada, último minuto e encerramento.
- Validar o carregamento e as APIs no Zoom Android e no Zoom desktop, anotando diferenças por cliente.
- Confirmar se o indicador é visível aos participantes e se a cor do indicador nativo muda no último minuto em Android.
- Corrigir os problemas encontrados dentro do escopo das etapas anteriores.
- Documentar como iniciar localmente e quais configurações do Zoom são necessárias.
- Preparar hospedagem HTTPS e Home URL se necessário para teste; não publicar no Marketplace sem uma solicitação específica.

**Resultado esperado:** versão pronta para teste em reunião, com limitações conhecidas registradas e instruções suficientes para configurar o app no Zoom.

## Restrições gerais

- Desenvolver no VS Code como aplicação web, usando React, TypeScript, Vite e `@zoom/appssdk`, salvo se a inspeção da Etapa 1 mostrar uma estrutura equivalente já existente.
- Fazer mudanças pequenas e concluir uma etapa antes de começar a seguinte.
- Manter `README.md`, `AGENTS.md` e este plano coerentes com o que realmente foi implementado.
- Não inventar compatibilidade: consultar as APIs suportadas em tempo de execução e registrar limitações do cliente.
- Não colocar segredos do Zoom no código executado no navegador.

## Prompt inicial para o Codex

Leia `README.md`, `AGENTS.md`, este plano e as duas imagens em `docs/references/`. Execute **somente a Etapa 1** deste plano. Primeiro inspecione a estrutura atual da pasta e preserve qualquer trabalho existente. Prepare ou ajuste a estrutura mínima React + TypeScript + Vite e integre o Zoom Apps SDK apenas no necessário para criar uma prova simples de abertura do app e chamada do indicador dinâmico. Não implemente ainda a interface final, os presets, a lógica completa do cronômetro nem as etapas 2, 3 ou 4. Verifique quais APIs estão disponíveis no cliente atual. Se alguma parte depender de configuração ou acesso ao Zoom App Marketplace ou a um Android real, não invente o resultado: deixe o projeto preparado, descreva o bloqueio e forneça os passos exatos que Christian precisa executar. Não solicite segredos, tokens ou senhas. Ao concluir, informe os arquivos criados/alterados, como iniciar localmente e o próximo passo manual necessário para validar no Zoom Android.
