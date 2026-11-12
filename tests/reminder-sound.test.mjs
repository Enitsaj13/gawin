import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/reminders/notifications.web.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(values = new Map(), blocked = false) {
  const oscillators = [], intervals = new Map(), timeouts = new Map();
  const document = { visibilityState: 'visible' };
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class AudioContext {
    state = 'suspended'; currentTime = 0; destination = {};
    async resume() { if (!blocked) this.state = 'running'; }
    createOscillator() {
      const oscillator = { frequency: {}, connect() {}, disconnect() {}, start(at) { this.at = at; }, stop() { this.stopped = true; this.onended?.(); } };
      oscillators.push(oscillator); return oscillator;
    }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
  }
  const exports = {};
  new Function('exports', 'process', 'localStorage', 'AudioContext', 'document', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', compiled)(
    exports, { env: {} }, { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, AudioContext, document,
    (callback) => { const key = {}; intervals.set(key, callback); return key; }, (key) => intervals.delete(key),
    (callback) => { const key = {}; timeouts.set(key, callback); return key; }, (key) => timeouts.delete(key),
  );
  return { client: exports, values, document, oscillators, intervals, timeouts };
}
test('alarm preference survives a new app instance and an audio permission block', async () => {
  const first = fixture();
  assert.equal(first.client.alarmSoundEnabled(), false);
  first.client.setAlarmSoundEnabled(true);
  const reopened = fixture(first.values, true);
  assert.equal(reopened.client.alarmSoundEnabled(), true);
  await assert.rejects(reopened.client.enableAlarmSound(), /saved as on/);
  assert.equal(reopened.client.alarmSoundEnabled(), true);
  reopened.client.setAlarmSoundEnabled(false);
  assert.equal(fixture(first.values).client.alarmSoundEnabled(), false);
});
test('alarm repeats a distinct pattern and stopping cancels every pending pulse and timer', async () => {
  const f = fixture();
  await f.client.enableAlarmSound();
  f.client.playAlarmSound();
  assert.equal(f.oscillators.length, 4);
  assert.equal(new Set(f.oscillators.map((item) => item.frequency.value)).size, 2);
  assert.equal(f.intervals.size, 1);
  assert.equal(f.timeouts.size, 1);
  const tick = [...f.intervals.values()][0];
  tick();
  assert.equal(f.oscillators.length, 8);
  f.client.stopAlarmSound();
  assert.ok(f.oscillators.every((item) => item.stopped));
  assert.equal(f.intervals.size, 0);
  assert.equal(f.timeouts.size, 0);
});
test('preview does not loop and audio is never played on a hidden page', async () => {
  const f = fixture();
  await f.client.enableAlarmSound();
  f.client.previewAlarmSound();
  assert.equal(f.oscillators.length, 4);
  assert.equal(f.intervals.size, 0);
  f.document.visibilityState = 'hidden';
  f.client.previewAlarmSound();
  assert.equal(f.oscillators.length, 4);
  assert.ok(f.oscillators.every((item) => item.stopped));
});
