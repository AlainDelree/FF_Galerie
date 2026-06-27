/* ===========================================================================
   FF_Galerie — Service Worker (PWA Phase 1 : consultation hors connexion)
   ---------------------------------------------------------------------------
   Modèle : offline-first, lecture seule.
   - Le shell (pages/CSS/JS) est servi depuis le cache (cache-first).
   - Les données (JSON) et images sont en stale-while-revalidate :
     affichage instantané depuis le cache, rafraîchissement en tâche de fond
     quand le réseau est là → le contenu de Frédérique se met à jour tout seul
     dès qu'on est en ligne, et reste consultable hors connexion.
   - L'ADMIN, l'API GitHub, EmailJS, les pages d'aperçu/édition et les galeries
     invités ne sont JAMAIS interceptés ni mis en cache (réseau strict).

   Mise à jour de l'app : bump de VERSION ci-dessous (+ cache-busters habituels).
   Le navigateur re-télécharge ce fichier, réinstalle, et bascule au prochain
   lancement (ou via le bandeau « nouvelle version » de pwa-register.js).
   =========================================================================== */

const VERSION = '2026-06-27a';
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
    pathname.startsWith('/artistes/') ||   // galeries invités (hors périmètre Phase 1)
    pathname.startsWith('/build/') ||
    pathname.startsWith('/tests/') ||
    pathname.startsWith('/tools/') ||
    pathname.includes('apercu') ||          // pages d'aperçu admin
    pathname.includes('galerie-edit')       // page d'édition admin
  );
}

function estDonnee(pathname) {
  return pathname.startsWith('/data/') && pathname.endsWith('.json');
}

function estImage(pathname) {
  return pathname.startsWith('/assets/images/') &&
         /\.(jpe?g|png|webp|svg|gif|avif)$/i.test(pathname);
}

/* === INSTALL : précache tolérant ========================================== */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // 1) Shell — tolérant : un fichier manquant ne fait pas échouer l'install.
    await Promise.allSettled(
      SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))
    );

    // 2) Images des toiles — lues depuis peinture.json (s'adapte aux ajouts de Fred).
    try {
      const rep = await fetch('/data/oeuvres/peinture.json', { cache: 'reload' });
      if (rep && rep.ok) {
        const data = await rep.json();
        const toiles = (data && Array.isArray(data.toiles)) ? data.toiles : [];
        const urls = new Set();
        for (const t of toiles) {
          // Récupère tout champ ressemblant à un chemin d'image.
          for (const v of Object.values(t)) {
            if (typeof v === 'string' && /\.(jpe?g|png|webp)$/i.test(v)) {
              const base = v.replace(/^\.?\//, '');
              const jpg  = '/' + base;
              urls.add(jpg);
              // Variantes dérivées (mur = thumb webp, plein écran = webp).
              const sansExt = jpg.replace(/\.(jpe?g|png|webp)$/i, '');
              urls.add(sansExt + '.webp');
              urls.add(sansExt + '-thumb.webp');
            }
          }
        }
        await Promise.allSettled(
          [...urls].map((url) => cache.add(new Request(url, { cache: 'reload' }))
            .catch(() => {}))  // 404 sur une variante absente = ignoré
        );
      }
    } catch (e) {
      // Pas de réseau à l'install : le runtime cachera les images au fil de l'eau.
    }
  })());
  // Pas de skipWaiting : la nouvelle version s'active au prochain lancement,
  // ou immédiatement si pwa-register.js envoie SKIP_WAITING.
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

/* === FETCH : routage ====================================================== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // écritures : réseau direct

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Cross-origin
  if (url.origin !== self.location.origin) {
    // Polices Google en best-effort (pour garder la typo hors connexion).
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(cacheFirst(req));
    }
    return; // API GitHub, EmailJS, GoatCounter… : réseau direct, jamais caché
  }

  // Même origine : exclusions dures (admin, aperçu, invités, outils)
  if (estExclu(url.pathname)) return;

  // Données + images : stale-while-revalidate
  if (estDonnee(url.pathname) || estImage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Shell (HTML/CSS/JS/manifest) : cache-first
  event.respondWith(cacheFirst(req));
});

/* --- Stratégies ----------------------------------------------------------- */

// ignoreSearch:true → un cache-buster ?v=... matche l'entrée précachée.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
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

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const reseau = fetch(req).then((rep) => {
    if (rep && rep.ok && (rep.type === 'basic' || rep.type === 'cors')) {
      cache.put(req, rep.clone());
    }
    return rep;
  }).catch(() => null);
  if (hit) { reseau; return hit; }                  // sert le cache, rafraîchit en fond
  const rep = await reseau;
  if (rep) return rep;
  if (req.mode === 'navigate') {
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
  }
  return Response.error();
}

/* --- Bascule de version pilotée par la page ------------------------------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
