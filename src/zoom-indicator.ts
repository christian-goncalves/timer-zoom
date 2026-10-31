import zoomSdk from '@zoom/appssdk';
import type { Apis, ConfigResponse } from '@zoom/appssdk';

export const requestedApis: Apis[] = [
  'getSupportedJsApis',
  'setDynamicIndicator',
  'getDynamicIndicator',
  'removeDynamicIndicator',
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

let indicatorQueue: Promise<void> = Promise.resolve();

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

function isSuccess(response: { message: string }): boolean {
  return response.message === 'Success';
}

async function setCountdown(seconds: number): Promise<IndicatorResult> {
  const response = await zoomSdk.setDynamicIndicator({
    text: TIMER_INDICATOR_TEXT,
    timer: {
      action: 'start',
      direction: 'down',
      start: Math.max(1, Math.ceil(seconds)),
      withSound: false,
      showNotification: false,
    },
  });

  return isSuccess(response)
    ? successResult('O cliente aceitou a atualização do indicador. A visibilidade entre participantes não foi confirmada nesta sessão.')
    : failureResult(`O Zoom recusou a atualização do indicador (resposta: ${JSON.stringify(response) ?? String(response)}). A contagem local continua ativa.`);
}

export async function initializeZoom(): Promise<ZoomSession> {
  const config = await zoomSdk.config({ capabilities: requestedApis });
  const { supportedApis } = await zoomSdk.getSupportedJsApis();
  return { config, supportedApis };
}

export function setIndicatorTimer(session: ZoomSession, seconds: number, paused = false): Promise<IndicatorResult> {
  if (!supports(session, 'setDynamicIndicator')) {
    return Promise.resolve(failureResult('Este cliente não oferece setDynamicIndicator. O timer continua apenas neste app.'));
  }

  return serializeIndicatorAction(async () => {
    try {
      const started = await setCountdown(seconds);
      if (!started.ok || !paused) return started;

      const pauseResponse = await zoomSdk.setDynamicIndicator({
        text: TIMER_INDICATOR_TEXT,
        timer: { action: 'pause' },
      });

      return isSuccess(pauseResponse)
        ? successResult('Tempo atualizado e mantido pausado no indicador do Zoom.')
        : failureResult('O tempo foi publicado, mas o cliente não confirmou a pausa do indicador. O timer local continua pausado.');
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
      const response = await zoomSdk.setDynamicIndicator({
        text: TIMER_INDICATOR_TEXT,
        timer: { action },
      });
      return isSuccess(response)
        ? successResult(`${successMessage} A visibilidade entre participantes não foi confirmada nesta sessão.`)
        : failureResult(`${failureMessage} Resposta do Zoom: ${JSON.stringify(response) ?? String(response)}. O timer local continua ativo.`);
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
        if (currentIndicator.text !== TIMER_INDICATOR_TEXT) {
          return failureResult('Timer local encerrado. O indicador atual não pertence a este timer e foi preservado.');
        }
      }

      if (supports(session, 'removeDynamicIndicator')) {
        try {
          const response = await zoomSdk.removeDynamicIndicator();
          if (isSuccess(response)) return successResult('Timer encerrado e indicador removido do Zoom.');
        } catch {
          // If removal is rejected but setDynamicIndicator is available, end its timer below.
        }
      }

      if (supports(session, 'setDynamicIndicator')) {
        try {
          const response = await zoomSdk.setDynamicIndicator({
            text: TIMER_INDICATOR_TEXT,
            timer: { action: 'end' },
          });
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
