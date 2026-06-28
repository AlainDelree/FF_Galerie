/* ===========================================================================
   FF_Galerie — Service Worker (PWA)
   ---------------------------------------------------------------------------
   Deux caches :
   - SHELL (versionné, léger)  : pages, CSS, JS, données, icônes, textures.
     Pré-caché à l'installation du SW → tout visiteur l'a, c'est petit.
     Remplacé à chaque déploiement (bump VERSION).
   - MEDIA (persistant)        : images des toiles + musique (~24 Mo).
     NE se télécharge PAS d'office. Deux façons de le remplir :
       • au fil de l'eau : chaque image regardée est mise en cache ;
       • en bloc : message PRECACHE_FULL (déclenché à l'installation de l'app
         ou par le bouton « Préparer hors connexion »).
     Survit aux changements de version → l'app installée reste hors-ligne
     même après un déploiement de code.

   Modèle de fraîcheur : cache-first partout (snapshot). L'app installée se met
   à jour à la demande (bouton ⟳ → REFRESH). Le site web (non installé) prend
   la nouvelle version au déploiement suivant.

   ADMIN/aperçu/édition/invités/API : jamais interceptés ni mis en cache.
   =========================================================================== */

const VERSION     = '2026-06-28b';     // identifiant du CODE du SW (force la détection de MAJ)
const SHELL_CACHE = 'ff-shell';        // STABLE : le contenu ne change qu'à la demande (⟳)
const MEDIA_CACHE = 'ff-media';        // STABLE : images + musique, persistant

/* --- SHELL léger (PAS les toiles, PAS la musique) ------------------------- */
const SHELL = [
  '/', '/index.html',
  '/galerie.html', '/contact.html', '/infos.html', '/apropos.html',
  '/app.html', '/choix-cadres.html', '/offline.html',
  '/manifest.webmanifest',

  '/assets/css/style.css',
  '/assets/css/galerie.css',
  '/assets/css/galerie-sculpture.css',
  '/assets/css/plan.css',
  '/assets/css/infos.css',
  '/assets/css/contact.css',

  '/assets/js/main.js',
  '/assets/js/plan.js',
  '/assets/js/nav-artistes.js',
  '/assets/js/infos.js',
  '/assets/js/contact.js',
  '/assets/js/galerie-core.js',
  '/assets/js/galerie-peinture.js',
  '/assets/js/galerie-sculpture.js',
  '/assets/js/galerie-local-edit.js',
  '/assets/js/salle-immersive.js',
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
  '/assets/images/about/frederique-ferette.jpg'
];

/* --- Médias lourds (cache persistant, à la demande) ---------------------- */
function estMedia(pathname) {
  return (pathname.startsWith('/assets/images/toiles/') &&
          /\.(jpe?g|png|webp)$/i.test(pathname)) ||
         pathname === '/assets/music/musique.mp3';
}

/* --- Exclusions : jamais interceptées (réseau strict) -------------------- */
function estExclu(pathname) {
  return (
    pathname === '/sw.js' ||
    pathname.includes('admin') ||
    pathname.startsWith('/artistes/') ||
    pathname.startsWith('/build/') ||
    pathname.startsWith('/tests/') ||
    pathname.startsWith('/tools/') ||
    pathname.includes('apercu') ||
    pathname.includes('galerie-edit')
  );
}
function estContexteAdmin(referrer) {
  if (!referrer) return false;
  return referrer.includes('/admin') ||
         referrer.includes('apercu') ||
         referrer.includes('galerie-edit');
}

/* --- Liste des images de toiles (depuis peinture.json) ------------------- */
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
  } catch (e) { /* hors ligne */ }
  return [...urls];
}

/* --- Mise en cache d'une URL en "dépliant" les redirections --------------
   Cloudflare (html_handling) peut rediriger /x.html → /x. Une réponse
   redirigée renvoyée à une navigation fait échouer la page dans une PWA.
   On reconstruit donc une réponse propre (non redirigée) avant de cacher. */
async function mettreEnCache(cache, url) {
  try {
    const rep = await fetch(new Request(url, { cache: 'reload' }));
    if (!rep || !rep.ok) return;
    let propre = rep;
    if (rep.redirected) {
      const corps = await rep.blob();
      propre = new Response(corps, {
        status: 200, statusText: 'OK', headers: rep.headers
      });
    }
    await cache.put(new Request(url), propre);
  } catch (e) { /* ignoré */ }
}

/* --- Pré-cache du shell (léger) ------------------------------------------ */
async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(SHELL.map((url) => mettreEnCache(cache, url)));
}

/* --- Pré-cache complet des médias (lourd, à la demande) ------------------ */
async function precacheMedias() {
  const cache = await caches.open(MEDIA_CACHE);
  const urls = await urlsImagesToiles();
  urls.push('/assets/music/musique.mp3');
  await Promise.allSettled(urls.map((url) => mettreEnCache(cache, url)));
}

/* === INSTALL : shell léger, UNIQUEMENT à la première installation ========= */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cles = await cache.keys();
    // Une simple mise à jour du SW ne télécharge RIEN : l'app s'ouvre
    // instantanément, le contenu ne bouge qu'à la demande (⟳ → REFRESH).
    if (cles.length === 0) await precacheShell();
  })());
});

/* === ACTIVATE : purge des vieux shells, on GARDE le cache média ========== */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => n.startsWith('ff-shell-') && n !== SHELL_CACHE)
          .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* === FETCH ================================================================ */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(cacheFirst(req, SHELL_CACHE));
    }
    return;
  }

  if (estExclu(url.pathname) || estContexteAdmin(req.referrer)) return;

  // Médias lourds → cache persistant (rempli au fil de l'eau ou en bloc).
  if (estMedia(url.pathname)) {
    event.respondWith(cacheFirst(req, MEDIA_CACHE));
    return;
  }

  // Reste (shell) → cache versionné.
  event.respondWith(cacheFirst(req, SHELL_CACHE));
});

/* --- Stratégie : cache-first (ignoreSearch → cohabite avec ?v=...) ------- */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    let rep = await fetch(req);
    if (rep && rep.redirected) {           // déplie la redirection (cf. mettreEnCache)
      const corps = await rep.blob();
      rep = new Response(corps, { status: 200, statusText: 'OK', headers: rep.headers });
    }
    if (rep && rep.ok && (rep.type === 'basic' || rep.type === 'cors' || rep.type === 'opaque')) {
      cache.put(req, rep.clone());
    }
    return rep;
  } catch (e) {
    if (req.mode === 'navigate') {
      const shell = await caches.open(SHELL_CACHE);
      const offline = await shell.match('/offline.html');
      if (offline) return offline;
    }
    return Response.error();
  }
}

/* === MESSAGES ============================================================= */
self.addEventListener('message', (event) => {
  const d = event.data || {};

  if (d.type === 'SKIP_WAITING') { self.skipWaiting(); return; }

  // Téléchargement complet du snapshot média (à la demande / à l'installation).
  if (d.type === 'PRECACHE_FULL') {
    event.waitUntil((async () => {
      await precacheMedias();
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true });
    })());
    return;
  }

  // Mise à jour à la demande (app installée) : shell frais + médias frais.
  if (d.type === 'REFRESH') {
    event.waitUntil((async () => {
      await precacheShell();
      await precacheMedias();
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
});
