const CACHE_NAME = 'bulletdasher-v1';

const ASSETS = [
  'index.html',
  'manifest.json',

  // Modos de juego
  'ClassicMode.html',
  'History.html',
  'InfernoMode.html',
  'MetroMode.html',
  'PracticeMode.html',
  'SquasteroidsMode.html',

  // Scripts
  'Cartas.js',
  'cosmetics.js',
  'highscores.js',
  'Pecera.js',

  // Datos
  'rewards.json',

  // PDF
  'guia_bldh.pdf',

  // Audio
  'musicabullet.mp3',
  'musicaINFERNO.mp3',
  'musicametro.mp3',
  'musicapractice.mp3',
  'musicasquasteroids.mp3',

  // Iconos PWA (ya estaban en la raíz, no en /icons/)
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',

  // SVGs de jugador
  'player-icon.svg',
  'player-icon-inferno.svg',
  'player-icon-practice.svg',
  'player-icon-squasteroids.svg',
];

// Instalación: descarga y cachea todo de una
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: borra caches de versiones viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache primero, si no está va a la red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
