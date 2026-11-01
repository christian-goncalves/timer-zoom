import { TIMER_INDICATOR_TEXT } from './zoom-timer-payload.ts';

export type NativeTimerReading = {
  status: 'running' | 'paused';
  remainingMs: number;
  selectedSeconds: number;
};

export type NativeIndicatorUpdate =
  | { kind: 'timer'; reading: NativeTimerReading }
  | { kind: 'end' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseNativeIndicatorUpdate(response: unknown): NativeIndicatorUpdate | null {
  if (!isRecord(response)) return null;
  if (response.text !== undefined && response.text !== TIMER_INDICATOR_TEXT) return null;
  if (!isRecord(response.timer)) return null;

  const timer = response.timer;
  if (timer.action === 'end') return { kind: 'end' };
  if (timer.direction !== 'down' || !['start', 'resume', 'pause'].includes(String(timer.action ?? ''))) return null;
  if (typeof timer.current !== 'number' || !Number.isFinite(timer.current) || timer.current <= 0) return null;

  const selectedSeconds = typeof timer.start === 'number' && Number.isFinite(timer.start)
    ? Math.ceil(timer.start / 1_000)
    : Math.ceil(timer.current / 1_000);

  return {
    kind: 'timer',
    reading: {
      status: timer.action === 'pause' ? 'paused' : 'running',
      remainingMs: timer.current,
      selectedSeconds,
    },
  };
}
