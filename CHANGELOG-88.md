# Changelog — Issue #88

## Empêcher l'indexation de l'environnement dev (#88)

Ajout d'un en-tête `X-Robots-Tag: noindex, nofollow` sur toutes les réponses
de l'environnement dev (`dev.frederiqueferette.be`), sans toucher au HTML ni à
`_headers` (partagés avec la prod) et sans affecter la prod.

### Contexte
- `index.html` / `galerie.html` portent en dur `<meta name="robots"
  content="index, follow">`, identiques sur `dev` et `main`.
- La prod (`frederiqueferette.be`) est servie par **GitHub Pages**
  (`.github/workflows/deploy.yml`) et doit rester indexable.
- Dev est servi par le **Worker Cloudflare `ffgalerie`**
  (`.github/workflows/deploy-dev.yml` → `wrangler deploy` depuis la racine sur
  push vers `dev`), dont la config se limitait à un bloc `[assets]` sans script.
- Correction faite au niveau du Worker : elle ne cible donc que dev.

### Modifications
- **`worker.js`** (nouveau) : Worker racine minimal. Invoqué pour toutes les
  requêtes, il délègue le service du fichier à `env.ASSETS.fetch()` puis ajoute
  `X-Robots-Tag: noindex, nofollow` sur la réponse. `env.ASSETS.fetch()`
  conserve `html_handling` / `not_found_handling` : le redirect connu
  `/x.html` → `/x` sur dev n'est **pas** cassé.
- **`wrangler.toml`** : ajout de `main = "worker.js"` et, dans `[assets]`,
  de `binding = "ASSETS"` + `run_worker_first = true`. Le bloc `[assets]` et
  `directory = "./"` sont conservés.
- **`.assetsignore`** : ajout de `worker.js` pour que la source du Worker ne
  soit pas servie comme asset public à `/worker.js`.

### Vérification
- `node --check worker.js` : OK (validé en module ES, format Cloudflare Worker,
  identique aux Workers existants `app-worker/` et `data-worker/`).
- Non déployé (Alain déploie après relecture).

### À vérifier par Alain après `wrangler deploy` (sur dev)
1. `curl -sI https://dev.frederiqueferette.be/` → `x-robots-tag: noindex, nofollow`.
2. `curl -sI https://dev.frederiqueferette.be/galerie.html` → redirect 301/308
   vers `/galerie` toujours présent (non cassé) + en-tête.
3. `curl -sI https://dev.frederiqueferette.be/galerie` → 200 + en-tête.
4. Un asset non-HTML (`/favicon.ico`, `/assets/...`) → 200 + en-tête.
5. Une URL inexistante → 404 inchangé + en-tête.
6. Contrôle croisé : `https://frederiqueferette.be/` (prod) NE porte PAS
   l'en-tête (reste indexable).
