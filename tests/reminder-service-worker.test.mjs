import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/push-handler.js', import.meta.url), 'utf8');
function setup({ titles = false, visible = false } = {}) {
  const handlers = {}, notices = [], messages = [], opened = [];
  const client = { url: 'https://gawin.example/', visibilityState: visible ? 'visible' : 'hidden', postMessage: (message) => messages.push(message), focus: async () => undefined };
  const self = { location: { origin: 'https://gawin.example' }, addEventListener: (type, handler) => { handlers[type] = handler; }, registration: { showNotification: async (title, options) => notices.push({ title, options }) }, clients: { matchAll: async () => [client], openWindow: async (url) => opened.push(url) } };
  const indexedDB = { open: () => {
    const request = {};
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        return { objectStore: () => ({ get: () => { const read = {}; queueMicrotask(() => { read.result = titles; read.onsuccess(); }); return read; } }) };
      } };
      request.onsuccess();
    });
    return request;
  } };
  vm.runInNewContext(source, { self, indexedDB, URL, Date });
  const push = async (data) => {
    let done;
    handlers.push({ data: { json: () => data }, waitUntil: (promise) => { done = promise; } });
    await done;
  };
  return { handlers, notices, messages, opened, push, self };
}
test('pushes display a visible generic notification by default, even with a secret payload title', async () => {
  const f = setup({ visible: true });
  await f.push({ type: 'reminder', taskId: 'task-a', reminderAt: '2099-01-01T12:00:00Z', body: 'Private medical appointment' });
  assert.equal(f.notices[0].options.body, 'You have an upcoming task.');
  assert.equal(f.notices[0].options.silent, true);
  assert.equal(f.messages[0].type, 'GAWIN_REMINDER');
  assert.equal(f.notices[0].options.renotify, false);
});
test('task titles require the local opt-in, and expired pushes do not raise an in-app alarm', async () => {
  const f = setup({ titles: true });
  await f.push({ type: 'reminder', taskId: 'a', body: 'Meeting' });
  assert.equal(f.notices[0].options.body, 'Meeting');
  await f.push({ type: 'reminder', taskId: 'a', body: 'Meeting', expiresAt: Date.now() - 1 });
  assert.equal(f.notices[1].options.body, 'A scheduled reminder was missed.');
  assert.equal(f.messages.length, 1);
  await f.push(null);
  assert.equal(f.notices.length, 3, 'malformed pushes still meet Safari visibility requirements');
});
test('clicks request navigation through the app and never open a cross-origin URL', async () => {
  const f = setup();
  let done;
  const click = (url, taskId) => f.handlers.notificationclick({ notification: { data: { url, taskId }, close() {} }, waitUntil: (promise) => { done = promise; } });
  click('/?reminderTask=task-a', 'task-a'); await done;
  assert.equal(f.messages[0].type, 'GAWIN_OPEN_TASK');
  click('https://evil.example', 'task-a'); await done;
  assert.equal(f.messages.length, 1);
  assert.deepEqual(f.opened, []);
});
