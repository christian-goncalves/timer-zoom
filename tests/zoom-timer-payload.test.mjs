import assert from 'node:assert/strict';
import test from 'node:test';
import { createCountdownPayload, createTimerActionPayload, toZoomMilliseconds } from '../src/zoom-timer-payload.ts';

test('duração em segundos vira milissegundos para o Zoom', () => {
  assert.equal(toZoomMilliseconds(300), 300_000);
  assert.equal(toZoomMilliseconds(1.2), 2_000);
  assert.equal(toZoomMilliseconds(0), 1_000);
});

test('start publica uma contagem regressiva de cinco minutos', () => {
  assert.deepEqual(createCountdownPayload(300), {
    timer: {
      action: 'start',
      direction: 'down',
      start: 300_000,
      withSound: false,
      showNotification: false,
    },
  });
});

test('start inclui o texto do indicador somente quando solicitado para o teste Mobile', () => {
  assert.equal(createCountdownPayload(300, true).text, 'Timer Zoom');
  assert.equal('text' in createCountdownPayload(300), false);
});

test('pause, resume e end preservam a ação nativa', () => {
  for (const action of ['pause', 'resume', 'end']) {
    assert.deepEqual(createTimerActionPayload(action), {
      text: 'Timer Zoom',
      timer: { action },
    });
  }
});
