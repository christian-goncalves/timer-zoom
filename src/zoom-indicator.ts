import zoomSdk from '@zoom/appssdk';
import type { Apis, ConfigResponse } from '@zoom/appssdk';

export const requestedApis: Apis[] = [
  'getSupportedJsApis',
  'setDynamicIndicator',
  'getDynamicIndicator',
  'removeDynamicIndicator',
  'onSetDynamicIndicator',
  'onMeeting',
];

export const TIMER_INDICATOR_TEXT = 'Timer Zoom';

export type ZoomSession = {
  config: ConfigResponse;
  supportedApis: Apis[];
};

export type IndicatorResult = {
  ok: boolean;
  message: string;
};

export type IndicatorDiagnostic = {
  id: number;
  timestamp: string;
  operation: string;
  details: string;
};

let indicatorQueue: Promise<void> = Promise.resolve();
let nextDiagnosticId = 1;
const diagnosticEntries: IndicatorDiagnostic[] = [];
const diagnosticListeners = new Set<(entries: IndicatorDiagnostic[]) => void>();

function publishDiagnostics() {
  const snapshot = [...diagnosticEntries];
  diagnosticListeners.forEach((listener) => listener(snapshot));
}

function recordDiagnostic(operation: string, details: unknown) {
  diagnosticEntries.unshift({
    id: nextDiagnosticId++,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    operation,
    details: responseSummary(details),
  });
  diagnosticEntries.splice(30);
  publishDiagnostics();
}

export function getIndicatorDiagnostics(): IndicatorDiagnostic[] {
  return [...diagnosticEntries];
}

export function subscribeToIndicatorDiagnostics(
  listener: (entries: IndicatorDiagnostic[]) => void,
): () => void {
  diagnosticListeners.add(listener);
  listener(getIndicatorDiagnostics());
  return () => diagnosticListeners.delete(listener);
}

function serializeIndicatorAction<T>(action: () => Promise<T>): Promise<T> {
  const result = indicatorQueue.then(action, action);
  indicatorQueue = result.then(() => undefined, () => undefined);
  return result;
}

function supports(session: ZoomSession, api: Apis): boolean {
  return session.supportedApis.includes(api);
}

function successResult(message: string): IndicatorResult {
  return { ok: true, message };
}

function failureResult(message: string): IndicatorResult {
  return { ok: false, message };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'erro não detalhado pelo cliente Zoom';
}

function responseSummary(response: unknown): string {
  if (response === undefined) return 'undefined';
  if (response === null) return 'null';

  try {
    return JSON.stringify(response) ?? String(response);
  } catch {
    return String(response);
  }
}

function isSuccess(response: unknown): boolean {
  return typeof response === 'object' && response !== null && 'message' in response
    && response.message === 'Success';
}

async function callSetDynamicIndicator(
  session: ZoomSession,
  operation: string,
  options: Parameters<typeof zoomSdk.setDynamicIndicator>[0],
): Promise<unknown> {
  recordDiagnostic(`${operation} · envio`, { request: options });
  let response: unknown;

  try {
    response = await zoomSdk.setDynamicIndicator(options);
    recordDiagnostic(`${operation} · retorno`, { response });
  } catch (error) {
    recordDiagnostic(`${operation} · erro`, { error: errorMessage(error) });
    throw error;
  }

  if (supports(session, 'getDynamicIndicator')) {
    try {
      const current = await zoomSdk.getDynamicIndicator();
      recordDiagnostic('getDynamicIndicator · leitura após atualização', current);
    } catch (error) {
      recordDiagnostic('getDynamicIndicator · erro na leitura', { error: errorMessage(error) });
    }
  } else {
    recordDiagnostic('getDynamicIndicator · não disponível', {});
  }

  return response;
}

async function setCountdown(session: ZoomSession, seconds: number): Promise<IndicatorResult> {
  const options: Parameters<typeof zoomSdk.setDynamicIndicator>[0] = {
    text: TIMER_INDICATOR_TEXT,
    timer: {
      action: 'start',
      direction: 'down',
      start: Math.max(1, Math.ceil(seconds)),
      withSound: false,
      showNotification: false,
    },
  };
  let response: unknown;

  try {
    response = await callSetDynamicIndicator(session, 'setDynamicIndicator · start', options);
  } catch (error) {
    return failureResult(`Falha ao atualizar o indicador: ${errorMessage(error)}. A contagem local continua ativa.`);
  }

  return isSuccess(response)
    ? successResult('O cliente aceitou a atualização do indicador. A visibilidade entre participantes não foi confirmada nesta sessão.')
    : failureResult(`O Zoom não confirmou a atualização do indicador (resposta: ${responseSummary(response)}). Isso não confirma recusa. A contagem local continua ativa.`);
}

export async function initializeZoom(): Promise<ZoomSession> {
  const config = await zoomSdk.config({ capabilities: requestedApis });
  const { supportedApis } = await zoomSdk.getSupportedJsApis();
  recordDiagnostic('Zoom SDK · sessão inicializada', {
    product: config.product,
    clientVersion: config.clientVersion,
    runningContext: config.runningContext,
    supportedApis: supportedApis.filter((api) => requestedApis.includes(api)),
    unsupportedApis: config.unsupportedApis,
  });
  return { config, supportedApis };
}

export function setIndicatorTimer(session: ZoomSession, seconds: number, paused = false): Promise<IndicatorResult> {
  if (!supports(session, 'setDynamicIndicator')) {
    return Promise.resolve(failureResult('Este cliente não oferece setDynamicIndicator. O timer continua apenas neste app.'));
  }

  return serializeIndicatorAction(async () => {
    try {
      const started = await setCountdown(session, seconds);
      if (!started.ok || !paused) return started;

      const pauseOptions: Parameters<typeof zoomSdk.setDynamicIndicator>[0] = {
        text: TIMER_INDICATOR_TEXT,
        timer: { action: 'pause' },
      };
      const pauseResponse = await callSetDynamicIndicator(session, 'setDynamicIndicator · pause após start', pauseOptions);

      return isSuccess(pauseResponse)
        ? successResult('Tempo atualizado e mantido pausado no indicador do Zoom.')
        : failureResult(`O Zoom não confirmou a pausa do indicador (resposta: ${responseSummary(pauseResponse)}). O timer local continua pausado.`);
    } catch (error) {
      return failureResult(`Falha ao atualizar o indicador: ${errorMessage(error)}. A contagem local continua ativa.`);
    }
  });
}

export function pauseIndicator(session: ZoomSession): Promise<IndicatorResult> {
  return sendTimerAction(session, 'pause', 'Pausa local ativa; o cliente aceitou a pausa do indicador.', 'O cliente não confirmou a pausa do indicador.');
}

export function resumeIndicator(session: ZoomSession): Promise<IndicatorResult> {
  return sendTimerAction(session, 'resume', 'O cliente aceitou a retomada do indicador.', 'O cliente não confirmou a retomada do indicador.');
}

function sendTimerAction(
  session: ZoomSession,
  action: 'pause' | 'resume',
  successMessage: string,
  failureMessage: string,
): Promise<IndicatorResult> {
  if (!supports(session, 'setDynamicIndicator')) {
    return Promise.resolve(failureResult(`Este cliente não oferece setDynamicIndicator. ${failureMessage} O timer local continua ativo.`));
  }

  return serializeIndicatorAction(async () => {
    try {
      const options: Parameters<typeof zoomSdk.setDynamicIndicator>[0] = {
        text: TIMER_INDICATOR_TEXT,
        timer: { action },
      };
      const response = await callSetDynamicIndicator(session, `setDynamicIndicator · ${action}`, options);
      return isSuccess(response)
        ? successResult(`${successMessage} A visibilidade entre participantes não foi confirmada nesta sessão.`)
        : failureResult(`${failureMessage} Resposta do Zoom: ${responseSummary(response)}. O timer local continua ativo.`);
    } catch (error) {
      return failureResult(`${failureMessage} ${errorMessage(error)} O timer local continua ativo.`);
    }
  });
}

export function removeTimerIndicator(session: ZoomSession): Promise<IndicatorResult> {
  if (!supports(session, 'removeDynamicIndicator') && !supports(session, 'setDynamicIndicator')) {
    return Promise.resolve(failureResult('Timer encerrado localmente; este cliente não oferece APIs para encerrar o indicador.'));
  }

  return serializeIndicatorAction(async () => {
    try {
      if (supports(session, 'getDynamicIndicator')) {
        const currentIndicator = await zoomSdk.getDynamicIndicator();
        recordDiagnostic('getDynamicIndicator · antes de remover', currentIndicator);
        if (currentIndicator.text !== TIMER_INDICATOR_TEXT) {
          return failureResult('Timer local encerrado. O indicador atual não pertence a este timer e foi preservado.');
        }
      }

      if (supports(session, 'removeDynamicIndicator')) {
        try {
          const response = await zoomSdk.removeDynamicIndicator();
          recordDiagnostic('removeDynamicIndicator · retorno', { response });
          if (isSuccess(response)) return successResult('Timer encerrado e indicador removido do Zoom.');
        } catch (error) {
          recordDiagnostic('removeDynamicIndicator · erro', { error: errorMessage(error) });
          // If removal is rejected but setDynamicIndicator is available, end its timer below.
        }
      }

      if (supports(session, 'setDynamicIndicator')) {
        try {
          const options: Parameters<typeof zoomSdk.setDynamicIndicator>[0] = {
            text: TIMER_INDICATOR_TEXT,
            timer: { action: 'end' },
          };
          const response = await callSetDynamicIndicator(session, 'setDynamicIndicator · end', options);
          return isSuccess(response)
            ? successResult('Timer encerrado; o indicador continua visível sem contagem neste cliente.')
            : failureResult('Timer encerrado localmente; o cliente não confirmou o encerramento do indicador.');
        } catch (error) {
          return failureResult(`Timer encerrado localmente; não foi possível encerrar o indicador: ${errorMessage(error)}.`);
        }
      }

      return failureResult('Timer encerrado localmente; o cliente não confirmou a remoção do indicador.');
    } catch (error) {
      return failureResult(`Timer encerrado localmente; não foi possível remover o indicador: ${errorMessage(error)}.`);
    }
  });
}

export function subscribeToMeetingEnd(session: ZoomSession, onEnd: () => void): (() => void) | null {
  if (!supports(session, 'onMeeting')) return null;

  const handler = (event: { action: string }) => {
    if (event.action === 'ended') onEnd();
  };

  try {
    zoomSdk.onMeeting(handler);
    return () => zoomSdk.removeEventListener('onMeeting', handler);
  } catch {
    return null;
  }
}

export function subscribeToIndicatorSet(session: ZoomSession): (() => void) | null {
  if (!supports(session, 'onSetDynamicIndicator')) {
    recordDiagnostic('onSetDynamicIndicator · não disponível', {});
    return null;
  }

  const handler: Parameters<typeof zoomSdk.onSetDynamicIndicator>[0] = (event) => {
    const { participantUUID: _participantUUID, screenName: _screenName, ...indicatorPayload } = event;
    recordDiagnostic('onSetDynamicIndicator · evento recebido', indicatorPayload);
  };

  try {
    zoomSdk.onSetDynamicIndicator(handler);
    recordDiagnostic('onSetDynamicIndicator · listener registrado', {});
    return () => zoomSdk.removeEventListener('onSetDynamicIndicator', handler);
  } catch (error) {
    recordDiagnostic('onSetDynamicIndicator · erro ao registrar', { error: errorMessage(error) });
    return null;
  }
}
