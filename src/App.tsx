import { useEffect, useState } from 'react';
import zoomSdk from '@zoom/appssdk';
import type { ConfigResponse, Apis } from '@zoom/appssdk';

type CheckState = 'loading' | 'ready' | 'outside-zoom' | 'error';

const requestedApis: Apis[] = ['getSupportedJsApis', 'setDynamicIndicator'];

export default function App() {
  const [checkState, setCheckState] = useState<CheckState>('loading');
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [supportedApis, setSupportedApis] = useState<Apis[]>([]);
  const [message, setMessage] = useState('Inicializando Zoom Apps SDK…');
  const [indicatorPending, setIndicatorPending] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const response = await zoomSdk.config({ capabilities: requestedApis });
        const apiResponse = await zoomSdk.getSupportedJsApis();
        if (!active) return;

        setConfig(response);
        setSupportedApis(apiResponse.supportedApis);
        setCheckState('ready');
        setMessage('SDK inicializado. A lista abaixo veio do cliente Zoom atual.');
      } catch (error) {
        if (!active) return;
        setCheckState('outside-zoom');
        setMessage(
          error instanceof Error
            ? `Não foi possível inicializar o SDK neste contexto: ${error.message}`
            : 'Não foi possível inicializar o SDK neste contexto. Abra pelo Zoom App Marketplace.',
        );
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const indicatorAvailable = supportedApis.includes('setDynamicIndicator');

  async function publishTestIndicator() {
    if (!indicatorAvailable || indicatorPending) return;
    setIndicatorPending(true);
    setMessage('Enviando um indicador de teste de 30 segundos…');

    try {
      const response = await zoomSdk.setDynamicIndicator({
        text: 'Prova do Timer Zoom',
        timer: {
          action: 'start',
          direction: 'down',
          start: 30,
          withSound: false,
          showNotification: false,
        },
      });
      setMessage(`O cliente respondeu à chamada setDynamicIndicator: ${JSON.stringify(response)}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `O cliente recusou ou não concluiu setDynamicIndicator: ${error.message}`
          : 'O cliente recusou ou não concluiu setDynamicIndicator.',
      );
    } finally {
      setIndicatorPending(false);
    }
  }

  return (
    <main className="proof-page">
      <section className="proof-card" aria-labelledby="page-title">
        <p className="eyebrow">Etapa 1 · prova de integração</p>
        <h1 id="page-title">Timer compartilhado para Zoom</h1>
        <p className="intro">
          Esta página confirma a abertura no cliente Zoom, consulta as APIs oferecidas por ele e
          permite enviar um indicador de teste de 30 segundos.
        </p>

        <div className={`status status-${checkState}`} role="status" aria-live="polite">
          <span className="status-dot" />
          <span>{message}</span>
        </div>

        <dl className="details">
          <div>
            <dt>Produto</dt>
            <dd>{config?.product ?? 'Aguardando cliente Zoom'}</dd>
          </div>
          <div>
            <dt>Versão do Zoom</dt>
            <dd>{config?.clientVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Contexto</dt>
            <dd>{config?.runningContext ?? '—'}</dd>
          </div>
        </dl>

        <h2>APIs relevantes disponíveis</h2>
        <ul className="api-list">
          {requestedApis.map((api) => (
            <li key={api}>
              <code>{api}</code>
              <span className={supportedApis.includes(api) ? 'available' : 'unavailable'}>
                {checkState === 'ready'
                  ? supportedApis.includes(api)
                    ? 'disponível'
                    : 'indisponível'
                  : 'não verificada'}
              </span>
            </li>
          ))}
        </ul>

        {config?.unsupportedApis?.length ? (
          <p className="unsupported">
            APIs recusadas por <code>config()</code>: {config.unsupportedApis.join(', ')}
          </p>
        ) : null}

        <button
          className="test-button"
          type="button"
          onClick={() => void publishTestIndicator()}
          disabled={!indicatorAvailable || indicatorPending}
        >
          {indicatorPending ? 'Enviando…' : 'Publicar indicador de teste'}
        </button>
        <p className="note">
          O botão só é habilitado quando o cliente informa suporte à API. A resposta da chamada não
          comprova, sozinha, que outros participantes visualizaram o indicador.
        </p>
      </section>
    </main>
  );
}
