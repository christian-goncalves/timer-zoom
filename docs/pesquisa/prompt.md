Implemente a tarefa especificada em
`docs/especificacoes/indicador-nativo-sincronizacao.md`.

Antes de editar, leia `AGENTS.md`, `README.md`, a especificação e inspecione o estado e as diferenças locais do Git. Preserve as alterações existentes, principalmente em `src/App.tsx`, `src/zoom-indicator.ts`, `src/TimeUnitControl.tsx`, `src/style.css` e nos diagnósticos em `docs/analise-diagnostico/`. Não descarte nem sobrescreva trabalho sem necessidade.

Contexto confirmado:
- Android, iPhone e desktop mostram o rótulo “Timer Zoom”, mas não os dígitos do indicador nativo.
- Clicar no rótulo no desktop abre o painel web, cujo contador local não está sincronizado com o contador nativo. No iPhone, o app não abre; isso não é o objetivo desta tarefa.
- O Timer oficial do Zoom envia `timer.start` em milissegundos e divide `timer.start`/`timer.current` por 1.000 ao ler. A produção já envia `300000` para cinco minutos. Não volte a tratar segundos versus milissegundos como hipótese principal sem nova evidência.
- As respostas e leituras observadas podem omitir `timer`; `"Success"` não prova que os dígitos apareceram. A exceção “Fail to set the dynamic indicator” é um caminho diferente.
- Já fiz cerca de dez ensaios. Não me peça para repetir uma bateria de testes. Primeiro avance pela inspeção do código, do bundle e das evidências existentes. Só proponha um ensaio novo se uma alteração concreta precisar distinguir hipóteses, explicando qual.
- Não publique nem faça deploy. Não altere o Marketplace.

Objetivos separados:
1. Fazer os dígitos aparecerem no indicador nativo para participantes sem que abram o app.
2. Sincronizar iniciar, pausar, retomar e encerrar entre os controles do operador e o timer nativo.
3. Manter explícita a diferença entre chamada aceita, timer local e publicação visual confirmada.

Compare a integração atual com o Timer oficial:
https://timer.zoomapp.cloud/static/js/main.2139f3da.js

Implemente somente mudanças justificadas pela especificação e por evidências. Não confunda o painel web aberto no desktop com o indicador nativo. Ao concluir, informe os arquivos alterados, o que mudou, o que foi verificado e o que ainda exige confirmação no cliente Zoom. Não execute testes sem me consultar.