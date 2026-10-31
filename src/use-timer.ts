import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advanceTimer,
  createInitialTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  selectDuration,
  setTimerDuration,
  startTimer,
  type TimerSnapshot,
} from './timer-logic';

export function useTimer() {
  const [timer, setTimer] = useState(createInitialTimer);
  const timerRef = useRef(timer);

  const commit = useCallback((next: TimerSnapshot) => {
    timerRef.current = next;
    setTimer(next);
    return next;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = timerRef.current;
      const next = advanceTimer(current);
      if (next !== current) commit(next);
    }, 200);

    return () => window.clearInterval(interval);
  }, [commit]);

  const start = useCallback(() => commit(startTimer(timerRef.current)), [commit]);
  const pause = useCallback(() => commit(pauseTimer(timerRef.current)), [commit]);
  const resume = useCallback(() => commit(resumeTimer(timerRef.current)), [commit]);
  const reset = useCallback(() => commit(resetTimer(timerRef.current)), [commit]);
  const chooseDuration = useCallback((seconds: number) => commit(selectDuration(timerRef.current, seconds)), [commit]);
  const setDuration = useCallback((seconds: number) => commit(setTimerDuration(timerRef.current, seconds)), [commit]);

  return { timer, timerRef, start, pause, resume, reset, chooseDuration, setDuration };
}
