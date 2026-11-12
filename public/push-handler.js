/* global self */
function reminderDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gawin-reminders', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('receipts'); request.result.createObjectStore('settings'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function showTitles() {
  try {
    const db = await reminderDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const request = tx.objectStore('settings').get('showTitles');
      request.onsuccess = () => resolve(request.result === true);
      request.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    });
  } catch { return false; }
}
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { data = null; }
    const test = data?.type === 'test';
    const expired = typeof data?.expiresAt === 'number' && Date.now() > data.expiresAt;
    const taskId = typeof data?.taskId === 'string' ? data.taskId : '';
    const body = test ? 'Reminders are connected on this device.' : expired ? 'A scheduled reminder was missed.' : await showTitles() && typeof data?.body === 'string' ? data.body.slice(0, 80) : 'You have an upcoming task.';
    const url = test ? '/settings' : taskId ? `/?reminderTask=${encodeURIComponent(taskId)}` : '/';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Safari requires every push event to immediately produce a visible notification.
    await self.registration.showNotification('Gawin', {
      body, icon: '/gawin-192.png', badge: '/gawin-192.png', tag: taskId ? `gawin-${taskId}` : 'gawin-test', renotify: false,
      silent: windows.some((client) => client.visibilityState === 'visible'),
      data: { url, taskId, reminderAt: data?.reminderAt },
    });
    if (taskId && !expired) for (const client of windows) client.postMessage({ type: 'GAWIN_REMINDER', taskId, reminderAt: data?.reminderAt });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data ?? {};
    const url = new URL(data.url || '/', self.location.origin);
    if (url.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing && data.taskId) {
      existing.postMessage({ type: 'GAWIN_OPEN_TASK', taskId: data.taskId });
      await existing.focus();
    } else if (existing) { await existing.navigate(url.href); await existing.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});
