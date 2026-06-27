/* ===========================================================================
   FF_Galerie — Service Worker (PWA Phase 1 : consultation hors connexion)
   ---------------------------------------------------------------------------
   Modèle : SNAPSHOT figé, rafraîchi À LA DEMANDE.
   - Tout (pages, CSS, JS, données, images) est servi depuis le cache
     (cache-first) : l'app installée ne change JAMAIS toute seule.
   - La mise à jour du contenu se fait uniquement quand l'utilisateur tape
     « Mettre à jour la galerie » dans l'app → message REFRESH → re-télécharge
     tout le snapshot, puis recharge.
   - Le site web normal (non installé) bascule lui aussi cache-first ; pour le
     garder frais automatiquement, bumper VERSION à chaque déploiement.
   - L'ADMIN, l'API GitHub, EmailJS, les aperçus/édition et les galeries
     invités ne sont JAMAIS interceptés ni mis en cache (réseau strict).
   =========================================================================== */

const VERSION = '2026-06-27c';
const CACHE   = 'ff-galerie-' + VERSION;

/* --- Shell applicatif : tout ce qui doit marcher hors connexion ----------- */
const SHELL = [
  '/', '/index.html',
  '/galerie.html',
  '/contact.html',
  '/infos.html',
  '/apropos.html',
  '/choix-cadres.html',
  '/offline.html',
  '/manifest.webmanifest',

  '/assets/css/style.css',
  '/assets/css/galerie.css',
  '/assets/css/galerie-sculpture.css',
  '/assets/css/plan.css',
  '/assets/css/infos.css',
  '/assets/css/contact.css',

  '/assets/js/main.js',
  '/assets/js/galerie-core.js',
  '/assets/js/galerie-peinture.js',
  '/assets/js/galerie-sculpture.js',
  '/assets/js/pwa-register.js',

  '/data/salles.json',
  '/data/oeuvres/peinture.json',
  '/data/artistes.json',
  '/data/infos.json',
  '/data/contact.json',
  '/data/emailjs.json',

  '/favicon.ico',
  '/assets/images/icons/icon-192.png',
  '/assets/images/icons/icon-512.png',
  '/assets/images/icons/icon-512-maskable.png',

  '/assets/images/textures/ecorce-grosse.jpg',
  '/assets/images/textures/ecorcelignes.jpg',
  '/assets/images/textures/texture-bleu.jpg',
  '/assets/images/about/frederique-ferette.jpg',

  '/assets/music/musique.mp3'
];

/* --- Exclusions : jamais interceptées (réseau strict) --------------------- */
function estExclu(pathname) {
  return (
    pathname === '/sw.js' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/artistes/') ||
    pathname.startsWith('/build/') ||
    pathname.startsWith('/tests/') ||
    pathname.startsWith('/tools/') ||
    pathname.includes('apercu') ||
    pathname.includes('galerie-edit')
  );
}

/* --- Récupère toutes les URLs d'images des toiles depuis peinture.json ----- */
async function urlsImagesToiles() {
  const urls = new Set();
  try {
    const rep = await fetch('/data/oeuvres/peinture.json', { cache: 'reload' });
    if (rep && rep.ok) {
      const data = await rep.json();
      const toiles = (data && Array.isArray(data.toiles)) ? data.toiles : [];
      for (const t of toiles) {
        for (const v of Object.values(t)) {
          if (typeof v === 'string' && /\.(jpe?g|png|webp)$/i.test(v)) {
            const jpg = '/' + v.replace(/^\.?\//, '');
            const sansExt = jpg.replace(/\.(jpe?g|png|webp)$/i, '');
            urls.add(jpg);
            urls.add(sansExt + '.webp');
            urls.add(sansExt + '-thumb.webp');
          }
        }
      }
    }
  } catch (e) { /* hors ligne : rien à ajouter */ }
  return [...urls];
}

/* --- Précache complet : shell + données + images (tolérant) --------------- */
async function precacheTout(cache) {
  await Promise.allSettled(
    SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))
  );
  const images = await urlsImagesToiles();
  await Promise.allSettled(
    images.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    )
  );
}

/* === INSTALL : snapshot initial =========================================== */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await precacheTout(cache);
  })());
  // Pas de skipWaiting : la nouvelle version attend (site web : activée auto par
  // pwa-register ; app installée : activée uniquement via le bouton « Mettre à jour »).
});

/* === ACTIVATE : purge des anciens caches ================================== */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => n.startsWith('ff-galerie-') && n !== CACHE)
          .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* === FETCH : cache-first partout (snapshot) =============================== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Cross-origin
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(cacheFirst(req));
    }
    return; // API GitHub, EmailJS, GoatCounter… : réseau direct, jamais caché
  }

  if (estExclu(url.pathname)) return;          // admin, aperçu, invités, outils

  event.respondWith(cacheFirst(req));          // tout le reste : snapshot
});

/* --- Stratégie : cache-first (ignoreSearch → cohabite avec ?v=...) -------- */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  // Pas en cache : on tente le réseau (utile en navigation normale en ligne).
  try {
    const rep = await fetch(req);
    if (rep && rep.ok && (rep.type === 'basic' || rep.type === 'cors' || rep.type === 'opaque')) {
      cache.put(req, rep.clone());
    }
    return rep;
  } catch (e) {
    if (req.mode === 'navigate') {
      const offline = await cache.match('/offline.html');
      if (offline) return offline;
    }
    return Response.error();
  }
}

/* === MESSAGES : bascule de version + rafraîchissement à la demande ========= */
self.addEventListener('message', (event) => {
  const d = event.data || {};

  if (d.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (d.type === 'REFRESH') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await precacheTout(cache);               // re-télécharge tout le snapshot
      // Réponse au port (si fourni) pour que la page sache que c'est fini.
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ ok: true });
      }
    })());
  }
});
