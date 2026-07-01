/* ===========================================================================
   FF_Galerie — Worker « app.frederiqueferette.be »
   ---------------------------------------------------------------------------
   Rôle : loger la PWA sur un sous-domaine DÉDIÉ, pour qu'elle cesse
   d'interférer avec le site principal (frederiqueferette.be).

   Principe : reverse-proxy transparent du site de prod (GitHub Pages), avec
   DEUX ajouts, et RIEN d'autre :
     1. il sert son propre /manifest.webmanifest (scope "/", propre au sous-domaine) ;
     2. il injecte dans le <head> de chaque page HTML le lien manifest + les
        métas PWA + l'enregistrement du service worker (assets/js/pwa-register.js).

   Conséquence :
     • frederiqueferette.be        → AUCUNE trace de PWA (manifest retiré du head-template).
     • app.frederiqueferette.be    → miroir intégral du site + PWA complète.
   Tout ce que l'app charge (galerie, JSON, images, sw.js) reste SAME-ORIGIN
   sous app.frederiqueferette.be → le cache du service worker marche sans CORS.

   /admin* n'est PAS servi ici : redirigé vers le domaine principal (la
   détection de branche de l'admin se base sur le hostname → Fred doit rester
   sur frederiqueferette.be pour écrire au bon endroit).
   =========================================================================== */

const ORIGINE = 'https://frederiqueferette.be';   // site de prod (GitHub Pages)

/* Bloc injecté dans le <head> de chaque page HTML (hors admin). */
const PWA_HEAD = `
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#1a1a1a">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Galerie Ferette">
    <link rel="apple-touch-icon" href="/assets/images/icons/icon-192.png">
    <script src="/assets/js/pwa-register.js" defer></script>`;

/* Manifest propre au sous-domaine : scope "/" (toute la galerie est dans l'app). */
const MANIFEST = {
  name: 'Frédérique Ferette — Galerie',
  short_name: 'Galerie Ferette',
  description: "La galerie virtuelle de Frédérique Ferette, artiste peintre belge — consultable hors connexion.",
  lang: 'fr-BE',
  dir: 'ltr',
  start_url: '/?source=pwa',
  scope: '/',
  id: '/app.html',
  display: 'standalone',
  orientation: 'any',
  background_color: '#1a1a1a',
  theme_color: '#1a1a1a',
  categories: ['art', 'lifestyle', 'education'],
  icons: [
    { src: '/assets/images/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/assets/images/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/assets/images/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};

/* Réécrit le <head> pour y ajouter les balises PWA. */
class InjecteurPWA {
  element(el) { el.append(PWA_HEAD, { html: true }); }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    /* 1. Admin : jamais sur le sous-domaine → renvoi vers le domaine principal. */
    if (url.pathname.startsWith('/admin')) {
      return Response.redirect(ORIGINE + url.pathname + url.search, 302);
    }

    /* 2. Manifest : servi par le Worker (scope propre au sous-domaine). */
    if (url.pathname === '/manifest.webmanifest') {
      return new Response(JSON.stringify(MANIFEST, null, 2), {
        headers: {
          'content-type': 'application/manifest+json; charset=utf-8',
          'cache-control': 'public, max-age=3600'
        }
      });
    }

    /* 3. Tout le reste : reverse-proxy transparent de la prod. */
    const cible = ORIGINE + url.pathname + url.search;
    const reponse = await fetch(cible, {
      method: request.method,
      headers: request.headers,
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
      redirect: 'manual'
    });

    /* 3a. Injection PWA uniquement sur les réponses HTML. */
    const ct = reponse.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      return new HTMLRewriter()
        .on('head', new InjecteurPWA())
        .transform(reponse);
    }

    /* 3b. Sinon on renvoie tel quel (images, JSON, CSS, JS, sw.js…). */
    return reponse;
  }
};
