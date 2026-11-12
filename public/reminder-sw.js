/* Development fallback. Production imports the same handler into Workbox. */
importScripts('/push-handler.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
