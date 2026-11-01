import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNativeIndicatorUpdate } from '../src/native-timer-state.ts';

test('reconhece timer nativo sem texto e restaura o tempo do Zoom Mobile', () => {
  assert.deepEqual(parseNativeIndicatorUpdate({
    textStyle: '',
    timer: { action: 'start', current: 96_000, direction: 'down', start: 300_000 },
  }), {
    kind: 'timer',
    reading: { status: 'running', remainingMs: 96_000, selectedSeconds: 300 },
  });
});

test('converte atualizações nativas de pausa e retomada', () => {
  assert.equal(parseNativeIndicatorUpdate({
    text: 'Timer Zoom',
    timer: { action: 'pause', current: 45_000, direction: 'down', start: 300_000 },
  }).reading.status, 'paused');

  assert.equal(parseNativeIndicatorUpdate({
    timer: { action: 'resume', current: 45_000, direction: 'down', start: 300_000 },
  }).reading.status, 'running');
});

test('ignora um indicador com outro rótulo ou sem timer', () => {
  assert.equal(parseNativeIndicatorUpdate({
    text: 'Outro app',
    timer: { action: 'start', current: 45_000, direction: 'down', start: 300_000 },
  }), null);
  assert.equal(parseNativeIndicatorUpdate({ text: 'Timer Zoom' }), null);
});

test('reconhece encerramento mesmo quando o timer não tem texto', () => {
  assert.deepEqual(parseNativeIndicatorUpdate({ timer: { action: 'end' } }), { kind: 'end' });
});
