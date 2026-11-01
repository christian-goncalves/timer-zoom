import zoomSdk from '@zoom/appssdk';
import type { Apis, ConfigResponse } from '@zoom/appssdk';
import { createCountdownPayload, createTimerActionPayload, TIMER_INDICATOR_TEXT } from './zoom-timer-payload';
import { parseNativeIndicatorUpdate, type NativeIndicatorUpdate, type NativeTimerReading } from './native-timer-state';

export const requestedApis: Apis[] = [
  'getSupportedJsApis',
  'setDynamicIndicator',
  'getDynamicIndicator',
  'removeDynamicIndicator',
  'onSetDynamicIndicator',
  'onMeeting',
];

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
let nextCallId = 1;
const diagnosticEntries: IndicatorDiagnostic[] = [];
const diagnosticListeners = new Set<(entries: IndicatorDiagnostic[]) => void>();

function publishDiagnostics() {
  const snapshot = [...diagnosticEntries];
  diagnosticListeners.forEach((listener) => listener(snapshot));
}

function recordDiagnostic(operation: string, details: unknown) {
  diagnosticEntries.unshift({
    id: nextDiagnosticId++,
    timestamp: new Date().toISOString(),
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

function errorDetails(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: error };
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

function responseMessage(response: unknown): string | undefined {
  if (typeof response !== 'object' || response === null || !('message' in response)) return undefined;
  const { message } = response;
  return typeof message === 'string' ? message : undefined;
}

function isSuccess(response: unknown): boolean {
  return response === 'Success' || responseMessage(response) === 'Success';
}

function recordIndicatorRead(operation: string, response: unknown) {
  const timer = typeof response === 'object' && response !== null && 'timer' in response
    ? response.timer
    : undefined;
  const timerValues = typeof timer === 'object' && timer !== null
    ? timer as { start?: unknown; current?: unknown }
    : null;

  recordDiagnostic(operation, {
    response,
    timerState: timerValues
      ? {
          startSeconds: typeof timerValues.start === 'number' ? timerValues.start / 1_000 : undefined,
          currentSeconds: typeof timerValues.current === 'number' ? timerValues.current / 1_000 : undefined,
        }
      : 'estado do timer ausente na leitura',
  });
}

async function callSetDynamicIndicator(
  session: ZoomSession,
  operation: string,
  options: Parameters<typeof zoomSdk.setDynamicIndicator>[0],
  readAgainAfterTwoSeconds = false,
): Promise<unknown> {
  const call = `${operation} #${nextCallId++}`;
  recordDiagnostic(`${call} · envio`, { request: options });
  let response: unknown;
  try {
    response = await zoomSdk.setDynamicIndicator(options);
    recordDiagnostic(`${call} · retorno`, { type: typeof response, response, accepted: isSuccess(response) });
  } catch (error) {
    recordDiagnostic(`${call} · exceção`, errorDetails(error));
    throw error;
  }

  if (supports(session, 'getDynamicIndicator')) {
    try {
      const current = await zoomSdk.getDynamicIndicator();
      recordIndicatorRead(`${call} · leitura após atualização`, current);
    } catch (error) {
      recordDiagnostic(`${call} · erro na leitura`, errorDetails(error));
    }
  } else {
    recordDiagnostic(`${call} · getDynamicIndicator indisponível`, {});
  }

  if (readAgainAfterTwoSeconds && supports(session, 'getDynamicIndicator')) {
    window.setTimeout(() => {
      void zoomSdk.getDynamicIndicator()
        .then((current) => recordIndicatorRead(`${call} · segunda leitura após 2s (pode refletir ação posterior)`, current))
        .catch((error: unknown) => recordDiagnostic(`${call} · erro na segunda leitura`, errorDetails(error)));
    }, 2_000);
  }

  return response;
}

async function setCountdown(session: ZoomSession, seconds: number, readAgainAfterTwoSeconds: boolean): Promise<IndicatorResult> {
  const options = createCountdownPayload(seconds, session.config.product === 'mobile');
  const response = await callSetDynamicIndicator(session, 'setDynamicIndicator · start', options, readAgainAfterTwoSeconds);

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
    browserVersion: config.browserVersion,
    runningContext: config.runningContext,
    unsupportedApis: config.unsupportedApis,
    supportedApis,
  });
  return { config, supportedApis };
}

export async function readNativeTimer(session: ZoomSession): Promise<NativeTimerReading | null> {
  if (!supports(session, 'getDynamicIndicator')) {
    recordDiagnostic('getDynamicIndicator · leitura inicial indisponível', {});
    return null;
  }

  try {
    const response = await zoomSdk.getDynamicIndicator();
    recordIndicatorRead('getDynamicIndicator · leitura inicial', response);
    const update = parseNativeIndicatorUpdate(response);
    return update?.kind === 'timer' ? update.reading : null;
  } catch (error) {
    recordDiagnostic('getDynamicIndicator · exceção na leitura inicial', errorDetails(error));
    return null;
  }
}

export function setIndicatorTimer(session: ZoomSession, seconds: number, paused = false): Promise<IndicatorResult> {
  if (!supports(session, 'setDynamicIndicator')) {
    return Promise.resolve(failureResult('Este cliente não oferece setDynamicIndicator. O timer continua apenas neste app.'));
  }

  return serializeIndicatorAction(async () => {
    try {
      const started = await setCountdown(session, seconds, !paused);
      if (!started.ok || !paused) return started;

      const pauseOptions = createTimerActionPayload('pause');
      const pauseResponse = await callSetDynamicIndicator(session, 'setDynamicIndicator · pause após start', pauseOptions);

      return isSuccess(pauseResponse)
        ? successResult('O cliente aceitou a atualização e a pausa. Os dígitos para participantes ainda não foram confirmados.')
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
      const options = createTimerActionPayload(action);
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
    let canRemove = false;
    if (supports(session, 'getDynamicIndicator')) {
      try {
        const currentIndicator = await zoomSdk.getDynamicIndicator();
        recordIndicatorRead('getDynamicIndicator · antes de encerrar', currentIndicator);
        if (currentIndicator?.text && currentIndicator.text !== TIMER_INDICATOR_TEXT) {
          return failureResult('Timer local encerrado. O indicador atual não pertence a este timer e foi preservado.');
        }
        canRemove = currentIndicator?.text === TIMER_INDICATOR_TEXT;
      } catch (error) {
        recordDiagnostic('getDynamicIndicator · exceção antes de encerrar', errorDetails(error));
      }
    }

    let ended = false;
    if (supports(session, 'setDynamicIndicator')) {
      try {
        const response = await callSetDynamicIndicator(session, 'setDynamicIndicator · end', createTimerActionPayload('end'));
        if (!isSuccess(response)) {
          return failureResult(`Timer encerrado localmente; o cliente não confirmou o encerramento nativo (resposta: ${responseSummary(response)}).`);
        }
        ended = true;
      } catch (error) {
        return failureResult(`Timer encerrado localmente; a chamada de encerramento nativo falhou: ${errorMessage(error)}.`);
      }
    }

    if (!canRemove || !supports(session, 'removeDynamicIndicator')) {
      return ended
        ? successResult('O cliente aceitou encerrar o timer nativo. A remoção da entrada e o resultado visual não foram confirmados.')
        : failureResult('Timer encerrado localmente; não foi possível confirmar o encerramento ou a remoção nativa.');
    }

    try {
      const response: unknown = await zoomSdk.removeDynamicIndicator();
      recordDiagnostic('removeDynamicIndicator · retorno', { type: typeof response, response, accepted: isSuccess(response) });
      return isSuccess(response)
        ? successResult(ended
          ? 'O cliente aceitou encerrar o timer e remover o indicador. O resultado visual não foi confirmado.'
          : 'O cliente aceitou remover o indicador. O resultado visual não foi confirmado.')
        : failureResult(`${ended ? 'O timer nativo foi encerrado, mas a remoção' : 'A remoção do indicador'} não foi confirmada (resposta: ${responseSummary(response)}).`);
    } catch (error) {
      recordDiagnostic('removeDynamicIndicator · exceção', errorDetails(error));
      return failureResult(`${ended ? 'O timer nativo foi encerrado, mas a remoção' : 'A remoção do indicador'} falhou: ${errorMessage(error)}.`);
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

export function subscribeToIndicatorSet(
  session: ZoomSession,
  onUpdate?: (update: NativeIndicatorUpdate) => void,
): (() => void) | null {
  if (!supports(session, 'onSetDynamicIndicator')) {
    recordDiagnostic('onSetDynamicIndicator · não disponível', {});
    return null;
  }

  const handler = (event: Parameters<typeof zoomSdk.onSetDynamicIndicator>[0] extends (event: infer T) => void ? T : never) => {
    recordIndicatorRead('onSetDynamicIndicator · evento recebido', event);
    const update = parseNativeIndicatorUpdate(event);
    if (update) onUpdate?.(update);
  };

  try {
    zoomSdk.onSetDynamicIndicator(handler);
    recordDiagnostic('onSetDynamicIndicator · listener registrado', {});
    return () => zoomSdk.removeEventListener('onSetDynamicIndicator', handler);
  } catch (error) {
    recordDiagnostic('onSetDynamicIndicator · erro ao registrar', errorDetails(error));
    return null;
  }
}
