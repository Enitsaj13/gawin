module.exports = {
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  globDirectory: 'dist',
  globPatterns: [
    '**/*.{css,html,ico,js,json,png,svg,ttf,woff,woff2}',
  ],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/_expo\//],
  skipWaiting: true,
  swDest: 'dist/sw.js',
};
