import { useEffect, useRef, useState } from 'react';
import {
  formatTimerTime,
  LAST_MINUTE_MS,
  MAX_TIMER_SECONDS,
  QUICK_DURATIONS,
  remainingTime,
  type TimerSnapshot,
} from './timer-logic';
import { TimeUnitControl, type TimeUnit } from './TimeUnitControl';
import { useTimer } from './use-timer';
import {
  getIndicatorDiagnostics,
  initializeZoom,
  pauseIndicator,
  removeTimerIndicator,
  requestedApis,
  resumeIndicator,
  setIndicatorTimer,
  subscribeToIndicatorDiagnostics,
  subscribeToIndicatorSet,
  subscribeToMeetingEnd,
  type IndicatorDiagnostic,
  type IndicatorResult,
  type ZoomSession,
} from './zoom-indicator';

type CheckState = 'loading' | 'ready' | 'outside-zoom';
type NoticeTone = 'info' | 'success' | 'warning';
type Notice = { tone: NoticeTone; text: string };

export default function App() {
  const { timer, timerRef, start, pause, resume, reset, chooseDuration, setDuration } = useTimer();
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit | null>(null);
  const [checkState, setCheckState] = useState<CheckState>('loading');
  const [session, setSession] = useState<ZoomSession | null>(null);
  const [sdkMessage, setSdkMessage] = useState('Inicializando Zoom Apps SDK…');
  const [indicatorDiagnostics, setIndicatorDiagnostics] = useState<IndicatorDiagnostic[]>(getIndicatorDiagnostics);
  const [notice, setNotice] = useState<Notice>({ tone: 'info', text: 'Preparando o timer…' });
  const noticeSequence = useRef(0);
  const sessionRef = useRef<ZoomSession | null>(null);
  const meetingEndUnsubscribe = useRef<(() => void) | null>(null);
  const indicatorEventUnsubscribe = useRef<(() => void) | null>(null);
  const previousStatus = useRef(timer.status);
  const isEditable = timer.status === 'idle' || timer.status === 'finished' || timer.status === 'paused';

  function reportIndicatorOperation(operation: Promise<IndicatorResult>, pendingText: string) {
    const sequence = ++noticeSequence.current;
    setNotice({ tone: 'info', text: pendingText });

    void operation.then((result) => {
      if (sequence !== noticeSequence.current) return;
      setNotice({ tone: result.ok ? 'success' : 'warning', text: result.message });
    });
  }

  function reportLocalOnly(text: string) {
    noticeSequence.current += 1;
    setNotice({ tone: 'warning', text });
  }

  function syncCurrentTimer(next: TimerSnapshot, paused = next.status === 'paused') {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      reportLocalOnly(paused
        ? 'Timer pausado localmente. O Zoom ainda está verificando se o indicador está disponível.'
        : 'Contagem local ativa. O Zoom ainda está verificando se o indicador está disponível.');
      return;
    }

    const seconds = Math.ceil(remainingTime(next) / 1_000);
    reportIndicatorOperation(
      setIndicatorTimer(currentSession, seconds, paused),
      'Atualizando o indicador compartilhado do Zoom…',
    );
  }

  function clearIndicator() {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      reportLocalOnly('Timer encerrado localmente. Nenhum indicador foi publicado nesta sessão.');
      return;
    }

    reportIndicatorOperation(removeTimerIndicator(currentSession), 'Encerrando o timer e removendo o indicador…');
  }

  useEffect(() => subscribeToIndicatorDiagnostics(setIndicatorDiagnostics), []);

  useEffect(() => {
    let active = true;

    void initializeZoom()
      .then((initializedSession) => {
        if (!active) return;
        sessionRef.current = initializedSession;
        setSession(initializedSession);
        setCheckState('ready');

        const unsupported = initializedSession.config.unsupportedApis ?? [];
        const missingRequested = requestedApis.filter((api) => !initializedSession.supportedApis.includes(api));
        const detail = missingRequested.length
          ? ` APIs não disponíveis neste cliente: ${missingRequested.join(', ')}.`
          : '';
        const configWarnings = unsupported.length
          ? ` config() recusou: ${unsupported.join(', ')}.`
          : '';
        setSdkMessage(`SDK inicializado. As APIs foram consultadas neste cliente.${detail}${configWarnings}`);

        const unsubscribe = subscribeToMeetingEnd(initializedSession, () => {
          reset();
          reportIndicatorOperation(
            removeTimerIndicator(initializedSession),
            'A reunião terminou; encerrando o timer e removendo o indicador…',
          );
        });
        meetingEndUnsubscribe.current = unsubscribe;
        indicatorEventUnsubscribe.current = subscribeToIndicatorSet(initializedSession) ?? null;

        const currentTimer = timerRef.current;
        if (currentTimer.status === 'running' || currentTimer.status === 'paused') {
          const seconds = Math.ceil(remainingTime(currentTimer) / 1_000);
          reportIndicatorOperation(
            setIndicatorTimer(initializedSession, seconds, currentTimer.status === 'paused'),
            'Publicando o timer local no Zoom…',
          );
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCheckState('outside-zoom');
        setSdkMessage(
          error instanceof Error
            ? `Não foi possível inicializar o SDK neste contexto: ${error.message}`
            : 'Não foi possível inicializar o SDK. Abra o app pelo cliente Zoom.',
        );
        setNotice({ tone: 'warning', text: 'O timer local continua disponível; o indicador exige um cliente Zoom compatível.' });
      });

    return () => {
      active = false;
      meetingEndUnsubscribe.current?.();
      meetingEndUnsubscribe.current = null;
      indicatorEventUnsubscribe.current?.();
      indicatorEventUnsubscribe.current = null;
    };
  }, [reset, timerRef]);

  useEffect(() => {
    const justFinished = timer.status === 'finished' && previousStatus.current === 'running';
    previousStatus.current = timer.status;
    if (justFinished) clearIndicator();
  }, [timer.status]);

  function handleStart() {
    setSelectedUnit(null);
    const next = start();
    if (next.status === 'running') syncCurrentTimer(next, false);
  }

  function handlePauseOrResume() {
    setSelectedUnit(null);
    if (timer.status === 'running') {
      const next = pause();
      if (next.status === 'paused') {
        reportIndicatorOperation(
          sessionRef.current ? pauseIndicator(sessionRef.current) : Promise.resolve({ ok: false, message: 'Contagem pausada localmente; o SDK Zoom ainda está inicializando.' }),
          'Pausando o indicador do Zoom…',
        );
      }
      return;
    }

    if (timer.status === 'paused') {
      const next = resume();
      if (next.status === 'running') {
        reportIndicatorOperation(
          sessionRef.current ? resumeIndicator(sessionRef.current) : Promise.resolve({ ok: false, message: 'Contagem retomada localmente; o SDK Zoom ainda está inicializando.' }),
          'Retomando o indicador do Zoom…',
        );
      }
    }
  }

  function handleReset() {
    setSelectedUnit(null);
    reset();
    clearIndicator();
  }

  function handleAdjustUnit(unit: TimeUnit, direction: -1 | 1) {
    if (!isEditable) return;

    const currentSeconds = Math.ceil(remainingTime(timerRef.current) / 1_000);
    const [currentHours, currentMinutes, currentRemainder] = formatTimerTime(currentSeconds * 1_000)
      .split(':')
      .map(Number);
    let hours = currentHours;
    let minutes = currentMinutes;
    let seconds = currentRemainder;

    if (unit === 'hours') hours = (hours + direction + 100) % 100;
    if (unit === 'minutes') minutes = (minutes + direction + 60) % 60;
    if (unit === 'seconds') seconds = (seconds + direction + 60) % 60;

    const nextSeconds = Math.min(MAX_TIMER_SECONDS, hours * 3_600 + minutes * 60 + seconds);
    const previous = timerRef.current;
    const next = setDuration(nextSeconds);
    if (next === previous) return;

    if (next.status === 'paused') {
      if (nextSeconds === 0) clearIndicator();
      else syncCurrentTimer(next, true);
    }
  }

  function handleSetUnitValue(unit: TimeUnit, value: number) {
    if (!isEditable) return;

    const currentSeconds = Math.ceil(remainingTime(timerRef.current) / 1_000);
    const [currentHours, currentMinutes, currentRemainder] = formatTimerTime(currentSeconds * 1_000)
      .split(':')
      .map(Number);
    const hours = unit === 'hours' ? Math.min(99, value) : currentHours;
    const minutes = unit === 'minutes' ? Math.min(59, value) : currentMinutes;
    const seconds = unit === 'seconds' ? Math.min(59, value) : currentRemainder;
    const nextSeconds = Math.min(MAX_TIMER_SECONDS, hours * 3_600 + minutes * 60 + seconds);
    const previous = timerRef.current;
    const next = setDuration(nextSeconds);
    if (next === previous) return;

    if (next.status === 'paused') {
      if (nextSeconds === 0) clearIndicator();
      else syncCurrentTimer(next, true);
    }
  }

  const remainingMs = remainingTime(timer);
  const isRunning = timer.status === 'running';
  const isRed = (timer.status === 'running' || timer.status === 'paused')
    && remainingMs > 0
    && remainingMs <= LAST_MINUTE_MS;
  const isConfigurable = timer.status === 'idle' || timer.status === 'finished';
  const isActive = timer.status === 'running' || timer.status === 'paused';
  const [hours, minutes, seconds] = formatTimerTime(remainingMs).split(':');
  const stateLabel = timer.status === 'running'
    ? 'Em andamento'
    : timer.status === 'paused'
      ? 'Pausado'
      : timer.status === 'finished'
        ? 'Concluído'
        : null;

  return (
    <main className="app-shell">
      <div className="timer-app">
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="13" r="8.25" />
              <path d="M9.5 2.75h5M12 8v5l3 1.75M17.8 5.4l1.6-1.6" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">Timer compartilhado</p>
            <h1>Timer</h1>
          </div>
          <span className={`connection-indicator connection-${checkState}`} title={checkState === 'ready' ? 'Zoom conectado' : 'Estado da conexão Zoom'}>
            <span />
            {checkState === 'ready' ? 'Zoom conectado' : checkState === 'loading' ? 'Conectando' : 'Timer local'}
          </span>
        </header>

        <section className={`timer-panel ${isRunning ? 'timer-panel-running' : ''} ${isActive ? 'timer-panel-active' : ''}`} aria-label="Cronômetro">
          <div className={`timer-display ${isRunning ? 'timer-display-running' : ''} ${isActive ? 'timer-display-active' : ''} ${isRed ? 'timer-display-danger' : ''}`}>
            <div className={`time-readout ${isEditable ? 'time-readout-editable' : ''} ${timer.status === 'paused' ? 'time-readout-paused' : ''}`} role="group" aria-label={`Tempo ${formatTimerTime(remainingMs)}${stateLabel ? `; estado ${stateLabel.toLowerCase()}` : ''}`}>
              <TimeUnitControl
                unit="hours"
                label="horas"
                value={hours}
                editable={isEditable}
                selected={selectedUnit === 'hours'}
                showLabel={timer.status !== 'paused'}
                onSelect={setSelectedUnit}
                onAdjust={handleAdjustUnit}
                onSetValue={handleSetUnitValue}
              />
              <span className="time-separator">:</span>
              <TimeUnitControl
                unit="minutes"
                label="minutos"
                value={minutes}
                editable={isEditable}
                selected={selectedUnit === 'minutes'}
                showLabel={timer.status !== 'paused'}
                onSelect={setSelectedUnit}
                onAdjust={handleAdjustUnit}
                onSetValue={handleSetUnitValue}
              />
              <span className="time-separator">:</span>
              <TimeUnitControl
                unit="seconds"
                label="segundos"
                value={seconds}
                editable={isEditable}
                selected={selectedUnit === 'seconds'}
                showLabel={timer.status !== 'paused'}
                onSelect={setSelectedUnit}
                onAdjust={handleAdjustUnit}
                onSetValue={handleSetUnitValue}
              />
            </div>
            {stateLabel ? (
              <p className="timer-state-label">{isRed ? 'Último minuto · ' : ''}{stateLabel}</p>
            ) : null}
          </div>

          {isConfigurable ? (
            <div className="idle-controls">
              <button className="primary-action" type="button" onClick={handleStart} disabled={timer.selectedSeconds === 0}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 10 6-10 6V6Z" /></svg>
                {timer.status === 'finished' ? 'Iniciar novamente' : 'Iniciar'}
              </button>
              <div className="preset-group" aria-label="Durações rápidas">
                {QUICK_DURATIONS.map((minutes) => (
                  <button
                    className={`preset-button ${timer.selectedSeconds === minutes * 60 ? 'selected' : ''}`}
                    type="button"
                    key={minutes}
                    onClick={() => {
                      setSelectedUnit(null);
                      chooseDuration(minutes * 60);
                    }}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="running-controls" aria-label="Controles do cronômetro">
              <button className="icon-action" type="button" onClick={handlePauseOrResume} aria-label={timer.status === 'paused' ? 'Retomar' : 'Pausar'} disabled={timer.status === 'paused' && remainingMs === 0}>
                {timer.status === 'paused' ? (
                  <svg className="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
                )}
                <span>{timer.status === 'paused' ? 'Retomar' : 'Pausar'}</span>
              </button>
              <button className="icon-action end-action" type="button" onClick={handleReset} aria-label="Encerrar e zerar">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
                <span>Zerar</span>
              </button>
            </div>
          )}

          {isRed ? <p className="last-minute-note">Falta 1 minuto ou menos</p> : null}
        </section>

        <p className={`operation-notice operation-${notice.tone}`} role="status" aria-live="polite">
          <span className="notice-dot" />
          {notice.text}
        </p>

        <div className="panel-divider" />

        <details className="zoom-diagnostics">
          <summary>Diagnóstico da integração Zoom · Etapa 1</summary>
          <div className="diagnostic-content">
            <div className={`sdk-message sdk-${checkState}`} role="status">
              <span className="sdk-dot" />
              <span>{sdkMessage}</span>
            </div>
            <dl className="client-details">
              <div><dt>Produto</dt><dd>{session?.config.product ?? '—'}</dd></div>
              <div><dt>Versão</dt><dd>{session?.config.clientVersion ?? '—'}</dd></div>
              <div><dt>Contexto</dt><dd>{session?.config.runningContext ?? '—'}</dd></div>
            </dl>
            <ul className="api-list">
              {requestedApis.map((api) => (
                <li key={api}>
                  <code>{api}</code>
                  <span className={session?.supportedApis.includes(api) ? 'api-available' : 'api-unavailable'}>
                    {checkState === 'ready' ? session?.supportedApis.includes(api) ? 'disponível' : 'indisponível' : 'não verificada'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="indicator-log-header">
              <h2>Registro do indicador</h2>
              <span>{indicatorDiagnostics.length} eventos · mais recentes primeiro</span>
            </div>
            {indicatorDiagnostics.length ? (
              <ol className="indicator-log" aria-live="polite">
                {indicatorDiagnostics.map((entry) => (
                  <li key={entry.id}>
                    <div className="indicator-log-meta">
                      <time>{entry.timestamp}</time>
                      <strong>{entry.operation}</strong>
                    </div>
                    <pre>{entry.details}</pre>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="indicator-log-empty">Inicie o timer para registrar envio, retorno e leitura do indicador.</p>
            )}
          </div>
        </details>
      </div>
    </main>
  );
}
