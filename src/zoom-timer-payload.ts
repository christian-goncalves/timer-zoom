export const TIMER_INDICATOR_TEXT = 'Timer Zoom';

export type NativeTimerAction = 'pause' | 'resume' | 'end';

export function toZoomMilliseconds(seconds: number): number {
  return Math.max(1, Math.ceil(seconds)) * 1_000;
}

export function createCountdownPayload(seconds: number) {
  return {
    text: TIMER_INDICATOR_TEXT,
    timer: {
      action: 'start' as const,
      direction: 'down' as const,
      start: toZoomMilliseconds(seconds),
      withSound: false,
      showNotification: false,
    },
  };
}

export function createTimerActionPayload(action: NativeTimerAction) {
  return { text: TIMER_INDICATOR_TEXT, timer: { action } };
}
