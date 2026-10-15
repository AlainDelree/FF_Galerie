# CONTEXTE — FF_Galerie

## Statut (sept. 2026)
Projet **en pause, hors ligne** (GitHub Pages dépublié, domaines Cloudflare `dev.`/`app.` retirés, workflows Deploy désactivés). Rien n'est supprimé : code, données et KV intacts. Objectif actuel : **conserver et recycler** le travail, pas développer.

## Le projet
Galerie web multi-artistes de Frédérique Ferette (« Fred », peintre) : salles virtuelles en perspective où l'artiste accroche et arrange ses œuvres elle-même depuis un admin mobile. Artistes invités dans `artistes/<nom>/` (dinso = sculpteur, daw = en pause, testtester = compte de test à ne jamais merger sur main).

## Stack
HTML/CSS/JS vanilla, données JSON, **zéro framework, zéro build JS**. Python seulement pour le SEO (`build/`).
- Prod : GitHub Pages (branche `main`, `deploy.yml`) ; dev : worker Cloudflare `ffgalerie` (`worker.js`, branche `dev`, `deploy-dev.yml`)
- `data-worker/` : worker `ff-data` = API KV (namespace `FF_DATA`) + auth par personne (PBKDF2, `gerer-utilisateurs.sh`)
- `app-worker/` : worker `ff-app` = PWA reverse-proxy, déployé à la main, pas par la CI

## Briques réutilisables (le cœur du recyclage)
- `assets/js/galerie-core.js` : rendu des salles en perspective
- `assets/js/galerie-sculpture.js` : sculptures 3D (GLB), anti-chevauchement par ellipses, vitrines procédurales
- `assets/js/admin-galerie.js` + `admin*.js` : admin mobile (Arrangeur, catalogue, médias, textures), commit GitHub via API ou KV
- `assets/js/salle-immersive.js`, `sw.js` (service worker / hors ligne)
- `templates/` : génération d'un nouvel artiste invité
- `build/` : SEO statique (sitemap, JSON-LD, head commun)

## Documentation de référence
`docs/AUDIT.md` (document vivant, à lire en premier), `docs/BUGS.md`, `docs/SMOKE_TEST.md`, `AMELIORATIONS.md`.

## Branches et merge
`dev` est la plus avancée (vitrines, salles masquables, migration KV). `main` = prod, en retard.
- `dev→main` UNIQUEMENT via `tools/merge-code-to-main.sh` (code seul, jamais les données) — jamais `git merge dev` naïf
- `artistes/dinso/galerie.html` = faux conflit systématique (garder la version main)
- `tools/compare-branches.sh` avant toute bascule

## Pièges connus
- `chargerTout()` (admin.js) : tout nouveau champ de salle doit être ajouté à sa whitelist, sinon perdu
- Ne jamais persister les champs `_*` (ex. `_preview` en base64) dans `sauvegarder()`
- Sculpture PC/GSM : `positions` et `positions_mobile` sont tout-ou-rien, séparation voulue — ne pas ajouter de repli pièce par pièce
- Modif de `galerie-sculpture.js` → bumper le `?v=` dans les 3 `galerie-edit.html`
- Tirets cadratins (U+2014) dans un header HTTP cassent `fetch()`
- Fixes mobiles : toujours dans un `@media`, ne jamais toucher le rendu PC ; hauteurs en `dvh`
- Ne pas supprimer `googlec5e9e7a8be59949e.html` (Search Console)

## Règles pour CCL
- Lire les fichiers concernés avant de modifier ; `node --check` sur tout JS modifié
- Ne jamais pousser ; ne jamais toucher à `main` directement
- Données de Fred (`data/`, KV) : lecture seule sauf demande explicite
- Aucun secret dans le dépôt (public)
