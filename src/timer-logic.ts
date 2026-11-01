export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type TimerSnapshot = {
  status: TimerStatus;
  selectedSeconds: number;
  remainingMs: number;
  deadline: number | null;
};

export const QUICK_DURATIONS = [3, 5, 10] as const;
export const DEFAULT_DURATION_SECONDS = 5 * 60;
export const LAST_MINUTE_MS = 60_000;
export const MAX_TIMER_SECONDS = 99 * 60 * 60 + 59 * 60 + 59;
const SECOND_MS = 1_000;

export function createInitialTimer(): TimerSnapshot {
  return {
    status: 'idle',
    selectedSeconds: DEFAULT_DURATION_SECONDS,
    remainingMs: DEFAULT_DURATION_SECONDS * SECOND_MS,
    deadline: null,
  };
}

export function remainingTime(timer: TimerSnapshot, now = Date.now()): number {
  if (timer.status === 'running' && timer.deadline !== null) {
    return Math.max(0, timer.deadline - now);
  }

  return Math.max(0, timer.remainingMs);
}

export function advanceTimer(timer: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (timer.status !== 'running') return timer;

  const remainingMs = remainingTime(timer, now);
  if (remainingMs === 0) {
    return { ...timer, status: 'finished', remainingMs: 0, deadline: null };
  }

  if (Math.ceil(remainingMs / SECOND_MS) === Math.ceil(timer.remainingMs / SECOND_MS)) return timer;
  return { ...timer, remainingMs };
}

export function selectDuration(timer: TimerSnapshot, seconds: number): TimerSnapshot {
  if (!QUICK_DURATIONS.some((minutes) => minutes * 60 === seconds)) return timer;
  if (timer.status !== 'idle' && timer.status !== 'finished') return timer;

  return setTimerDuration(timer, seconds);
}

export function setTimerDuration(timer: TimerSnapshot, seconds: number): TimerSnapshot {
  if (timer.status === 'running') return timer;
  if (!Number.isFinite(seconds)) return timer;

  const durationSeconds = Math.min(MAX_TIMER_SECONDS, Math.max(0, Math.trunc(seconds)));

  return {
    status: timer.status === 'paused' ? 'paused' : 'idle',
    selectedSeconds: durationSeconds,
    remainingMs: durationSeconds * SECOND_MS,
    deadline: null,
  };
}

export function startTimer(timer: TimerSnapshot, now = Date.now()): TimerSnapshot {
  const remainingMs = timer.status === 'finished'
    ? timer.selectedSeconds * SECOND_MS
    : remainingTime(timer, now);
  if (remainingMs <= 0) return timer;

  return { ...timer, status: 'running', remainingMs, deadline: now + remainingMs };
}

export function pauseTimer(timer: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (timer.status !== 'running') return timer;
  const remainingMs = remainingTime(timer, now);
  if (remainingMs === 0) return { ...timer, status: 'finished', remainingMs: 0, deadline: null };

  return { ...timer, status: 'paused', remainingMs, deadline: null };
}

export function resumeTimer(timer: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (timer.status !== 'paused' || timer.remainingMs <= 0) return timer;
  return { ...timer, status: 'running', deadline: now + timer.remainingMs };
}

export function resetTimer(timer: TimerSnapshot): TimerSnapshot {
  return {
    status: 'idle',
    selectedSeconds: timer.selectedSeconds,
    remainingMs: timer.selectedSeconds * SECOND_MS,
    deadline: null,
  };
}

export function restoreTimer(status: 'running' | 'paused', remainingMs: number, selectedSeconds: number, now = Date.now()): TimerSnapshot {
  const safeRemainingMs = Math.min(MAX_TIMER_SECONDS * SECOND_MS, Math.max(0, remainingMs));
  const safeSelectedSeconds = Math.min(MAX_TIMER_SECONDS, Math.max(1, Math.ceil(selectedSeconds)));
  return {
    status,
    selectedSeconds: safeSelectedSeconds,
    remainingMs: safeRemainingMs,
    deadline: status === 'running' ? now + safeRemainingMs : null,
  };
}

export function formatTimerTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / SECOND_MS);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}
