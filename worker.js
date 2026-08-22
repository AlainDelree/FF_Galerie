/* ===========================================================================
   FF_Galerie — Worker RACINE « ffgalerie » (sert dev.frederiqueferette.be)
   ---------------------------------------------------------------------------
   RÔLE : servir l'environnement de développement EXACTEMENT comme avant, mais
   en ajoutant sur CHAQUE réponse un en-tête `X-Robots-Tag: noindex, nofollow`
   pour empêcher toute indexation / suivi de liens de dev par les moteurs.

   POURQUOI ICI (et pas dans _headers ou dans le HTML) : les fichiers HTML et
   `_headers` sont partagés entre les branches `dev` et `main`. La prod
   (frederiqueferette.be) est servie par GitHub Pages (workflow deploy.yml) et
   DOIT rester indexable. Seul dev est servi par ce Worker Cloudflare
   « ffgalerie » (workflow deploy-dev.yml, `wrangler deploy` depuis la racine
   sur push vers `dev`). Poser l'en-tête ici cible donc dev, et dev seulement.

   CE QUI CHANGE DANS LA CHAÎNE DE SERVICE DE DEV :
     • AVANT : wrangler.toml ne contenait qu'un bloc [assets] sans script. Les
       assets statiques étaient servis directement par le runtime Cloudflare.
     • APRÈS : `main = "worker.js"` + `[assets] binding = "ASSETS"` +
       `run_worker_first = true`. Le Worker est désormais invoqué pour TOUTES
       les requêtes ; il délègue le service du fichier à `env.ASSETS.fetch()`
       (le pipeline natif des assets), puis ajoute l'en-tête sur la réponse.

   COMPORTEMENT PRÉSERVÉ (important) : `env.ASSETS.fetch()` applique la même
   configuration `html_handling` / `not_found_handling` que le service direct.
   Le redirect connu `/x.html` → `/x` sur dev est donc conservé tel quel — on
   ne fait que rattacher l'en-tête à la réponse (y compris aux redirects 3xx
   et aux 404). Mêmes fichiers servis, même gestion des chemins.

   À VÉRIFIER PAR ALAIN APRÈS DÉPLOIEMENT (`wrangler deploy` sur dev) :
     1. `curl -sI https://dev.frederiqueferette.be/` → présence de
        `x-robots-tag: noindex, nofollow`.
     2. `curl -sI https://dev.frederiqueferette.be/galerie.html` → toujours un
        redirect (301/308) vers `/galerie` (redirect NON cassé), avec l'en-tête.
     3. `curl -sI https://dev.frederiqueferette.be/galerie` → 200, HTML servi,
        avec l'en-tête.
     4. Un asset non-HTML (ex. `/assets/...` ou `/favicon.ico`) → 200 + en-tête.
     5. Une URL inexistante → comportement 404 inchangé, en-tête présent.
     6. Contrôle croisé : la PROD (https://frederiqueferette.be/) NE porte PAS
        cet en-tête (elle reste indexable).
   =========================================================================== */

export default {
  async fetch(request, env) {
    // Service natif de l'asset : conserve html_handling (redirect /x.html→/x)
    // et not_found_handling, exactement comme le service direct d'aujourd'hui.
    const reponse = await env.ASSETS.fetch(request);

    // Recopie la réponse pour rendre les en-têtes mutables, puis interdit
    // indexation et suivi des liens sur TOUTES les réponses de dev.
    const sortie = new Response(reponse.body, reponse);
    sortie.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return sortie;
  }
};
