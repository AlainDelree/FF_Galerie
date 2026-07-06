# Audit de stabilité — FF_Galerie

> Audit réalisé le **26/06/2026** sur `dev` au SHA `75ba028` (== `main`).
> Objectif : photographier l'état du site (jugé abouti) et lister la dette résiduelle
> pour durcir sans casser. Ce fichier est un **instantané daté**, pas un journal courant
> (les bugs ponctuels vont dans `BUGS.md`).

## Verdict global

Fondations saines. **Tout le JS passe `node --check`, les 18 JSON sont valides, aucun
secret n'est committé.** Les risques restants sont soit à faible probabilité, soit
cosmétiques. Site mûr avec une petite dette bien identifiée — pas un site fragile.

---

## Suivi des corrections

**Session 26/06/2026** — H1, A3, A1 traités sur `dev` puis mergés en prod :
- **H1 — Dead code chips** : ✅ résolu (`b919539`). `_initChipsDrag` + `deplacerSalleVers` + CSS associé retirés.
- **A3 — innerHTML nom de salle** : ✅ résolu (`a23345b`). `galerie-core.js:230` passe le nom en `textContent`. Bonus : cache-buster `galerie-core.js` uniformisé sur les 12 HTML (H3 partiel).
- **A1 — Accolade orpheline `style.css`** : ✅ résolu (`2be22d9`). Cause diagnostiquée via `git blame` (origine `fbcab00c`, seuil `@media max-width:540px`). Enveloppe `@media` restaurée, accolades 66/66. Vérifié sur PC (`.plan-galerie` reprend `max-width:400px` au lieu de 320). Aucune régression.
- **A2 — `commitMulti` force:true** : 1ʳᵉ tentative `e06b088` (force:true → boucle d'optimistic concurrency, max 3 tentatives relisant HEAD + rebuild arbre/commit + backoff). ⚠️ **Le « validé en réel le 27/06 » était FAUX** : la validation sur dev n'était qu'un coup de chance (le réplica rattrapait dans la fenêtre des 3 essais). **Réouvert puis corrigé pour de bon le 27/06 (`08e8270`).**
  - **Incident révélateur (27/06 02:33, prod)** : pendant la refonte des salles de Fred, 2 mails *bloquant* « ECHEC commitMulti après 3 tentatives ». Le journal montrait `headAttendu` **identique** (`cb4cae4`) aux 3 tentatives, alors qu'un commit concurrent (`97ab5f7`, « Apparence salle ») avait déjà déplacé HEAD à `02:33:11`. Preuve : les 2 commits orphelins du journal (`90749da`, `b6323db`) sont **tous deux parentés sur `cb4cae4`** — un parent déjà mort.
  - **Cause racine (affinee le 27/06 apres récidive sur dev 12:53)** : le coupable dominant n'est pas le lag de réplica mais le **cache HTTP du navigateur**. `apiGH` faisait un `fetch` sans option `cache` → GitHub renvoie `Cache-Control: private, max-age=60` sur les GET authentifiés → le `GET /git/refs` était **resservi gelé jusqu'à 60 s**. Preuve : journal du 12:53, `headLu` figé sur `08e8270` pendant ~8 s alors que le vrai HEAD avait avancé de 2 commits (`faebf4b`, `56c8abd`). Aucune patience de retry ne peut s'en sortir (cache 60 s ≫ budget ~8 s). Le lag de réplica GitHub existe aussi mais est secondaire (sub-seconde).
  - **Correctif en deux couches** :
    1. **`08e8270`** — la boucle distingue rebase réel vs lecture périmée (mémorise les parents rejetés, ne reconstruit plus d'orphelins, patiente). Nécessaire mais **insuffisant seul** contre un cache de 60 s.
    2. **`cache: 'no-store'` sur `apiGH`** — force chaque lecture à être fraîche (réseau, jamais le cache navigateur). C'est *la* correction qui dénoue l'incident. Corrige aussi un bug latent : `lireRaw` se croyait « toujours frais » mais subissait le même cache (le `?ref=` ne busте pas le cache, URL identique).
  - **Statut** : ✅ correctifs sur `dev`, **en attente de validation terrain** (reproduire des saves rapprochés sans plus voir l'erreur) avant merge `main`. Apprentissage clé (renforcé) : (1) ne jamais valider un fix de concurrence sur un seul succès ; (2) **un `fetch` de GET mutable sans `no-store` ment** — il peut servir des données vieilles de 60 s, et ça mime à s'y méprendre une course concurrente.

**Session 26/06 (nettoyage code mort, option 2)** :
- **3 fonctions orphelines retirées** (`_oeuvresPath`, `_confirmerSupprSalle`, `_creerConfigDecor`) + cascade CSS `.tdb-decor-wrap/grille/row/lbl`. Variables/classes vivantes conservées (`_salleConfirmSuppr`, `_DECOR_CHAMPS`, `.tdb-decor-pastille`). Scan : 261 fonctions, seulement 3 mortes (~1 %, JS très propre).
- **⚠️ CSS = CHAMP DE MINES, ne pas purger au grep** : ~16 classes admin.css flaggées « mortes » NON retirées car entrelacées avec du vivant (`.taille-badge` au milieu du bloc `.stock-item`, `.bas-btn` parmi des voisines mortes, ambiguïté classe/id sur `.stock-list`) + faux positif prouvé `.chip-peinture` (assemblé par `'chip chip-'+type`, invisible au grep, et même invisible à une heuristique de préfixe). Pour un balayage CSS fiable : Chrome DevTools → Coverage (observe le rendu réel), jamais un grep. knip/vulture inadaptés (code global vanilla, pas de graphe de modules).
- **H3 — cache-busters** : ✅ résolu (`8f78f5d` + `b3d64fb`). `style.css` doté d'un `?v=` sur ses 20 références ; `galerie-peinture.js`, `galerie-sculpture.js`, `salle-immersive.js` et le straggler `galerie-core` (template) harmonisés. Les 7 fichiers versionnés ont chacun une valeur unique.

---

## ✅ Points solides (vérifiés)

- **Écritures GitHub** : tous les `PUT`/`DELETE` portent `branch: BRANCH` dans le corps.
  Pas de fuite d'écriture vers `main`. Le pattern « GET sans `?ref=` » est maîtrisé partout
  (les seuls GET sans `?ref=` sont en réalité des écritures, qui ciblent la branche via le corps).
- **Rendu public sûr** : titres, descriptions, dates, noms d'œuvres injectés via `textContent`
  dans tous les renderers (`galerie-core`, `galerie-peinture`, `galerie-sculpture`).
  Un `<` ou une apostrophe dans une description ne peut ni casser la galerie ni injecter de code.
- **Échec réseau géré** : si un JSON ne charge pas, le visiteur voit « Données non disponibles »
  au lieu d'une page blanche (`galerie-core.js:672`).
- **Concurrence des saves** : `_commitQueue` (chaîne de Promesses) sérialise les écritures
  d'une même session admin.

---

## ⚠️ Fragilités réelles (par ordre de risque décroissant)

### A1 — Accolade orpheline dans `style.css` *(seul bug structurel avéré)*
- **Constat** : déséquilibre net **65 `{` pour 66 `}`**. Les règles
  `.entete / .btn-theme / .plan-galerie / .contenu-principal` (~lignes 287-296) sont hors
  de tout bloc `@media` (aucun `@media` ouvrant correspondant) → **appliquées partout**
  au lieu du seul mobile.
- **Risque** : régression visuelle desktop si recollage maladroit.
- **Traitement** : à faire avec smoke-test desktop + GSM sur `dev`. Ne pas toucher à la légère.

### A2 — `commitMulti` : fallback `force:true` *(chantier « l » connu)*
- **Constat** : `admin.js:446` — si le fast-forward échoue (deux personnes écrivent
  simultanément), re-push en `force:true` sur l'ancien `base_tree` → **écrase silencieusement**
  le commit de l'autre.
- **Risque** : perte de données silencieuse. Probabilité aujourd'hui quasi nulle
  (Fred et Alain rarement simultanés).
- **Solution prévue** : refetch HEAD distant → recomputer le tree sur le nouveau `base_tree`
  → retenter sans force (max 3 tentatives). **Reporté** tant que < 2 éditeurs actifs en parallèle.

### A3 — Seule entorse au `textContent` : `galerie-core.js:230`
- **Constat** : le nom de salle est interpolé en `innerHTML`
  (`'<span class="pm-nom">'+nom+'</span>...'`). Un `<`, `&` ou guillemet dans un nom de salle
  casserait le label de porte.
- **Risque** : faible (Fred maîtrise ses noms de salles), mais seule incohérence du rendu public.
- **Correctif** : ~1 ligne (poser le nom via `textContent` sur `.pm-nom`, ou échapper).

---

## 🧹 Hygiène (sans risque, poids mort)

### H1 — Dead code « chips drag » *(à nettoyer en priorité — zéro risque)*
- `_initChipsDrag` (`admin-galerie.js:466`) : défini, **plus jamais appelé**.
- `deplacerSalleVers` (`admin-galerie.js:455`) : utilisé **uniquement** par `_initChipsDrag`
  (appel à `:524`, à l'intérieur du bloc mort).
- CSS associé : `.chip-mv / .chip-del / .chip-conf* / .chip.draggable / .chip-ghost / .chip-drag*`.
- **Origine** : vestiges du mode drag des chips, remplacé par la barre Reculer/Avancer/Supprimer.

### H2 — `construirePillsSalle` / `salle-pills` *(reporté à dessein — PIÈGE)*
- Feature « pills » (boutons de choix de salle dans le form d'édition) : l'élément
  `#salle-pills` a été retiré du HTML, mais le JS subsiste. `construirePillsSalle()`
  est encore appelée à 4 endroits (admin.js:1156, admin-galerie.js:1774,
  admin-oeuvres.js:29 & 197) mais sort aussitôt (`if(!pills) return`) → **inerte**.
  Idem les `querySelectorAll('.salle-pill')` (boucles vides) + CSS `.salle-pill`.
- **PIÈGE** : les pills écrivaient `salleCibleToile`, variable **vivante et critique** —
  écrite par 5 chemins (1720/1775/1889/1954 vivants, 1746 mort) et **lue par la
  sauvegarde** (2060-2061, 2095-2100) pour assigner l'œuvre à sa salle. Le code mort
  des pills est entrelacé avec ces écritures vivantes (ex. 1889 vivant collé à 1890-1891 morts).
- Conséquence : retirer les pills = micro-chirurgie préservant chaque `salleCibleToile = …`
  + un smoke-test sauvegarde derrière. Inoffensif tel quel (zéro coût, zéro bug) →
  **on laisse**, sauf tâche dédiée. NE PAS supprimer `salleCibleToile`.

### H3 — Cache-busters hétérogènes
- Les `?v=` s'étalent de `20260622i` à `20260626o`.
- Pas un bug (chaque fichier ne doit bumper que quand lui-même change), mais complique le suivi.

---

## Plan de durcissement proposé (du plus sûr au plus délicat)

1. **H1 — Dead code chips** : zéro risque, allège `admin-galerie.js`. *(échauffement / validation méthode)*
2. **A3 — `galerie-core.js:230`** : 1 ligne, durcit le rendu public.
3. **A1 — Accolade `style.css`** : le seul vrai bug, avec smoke-test desktop + GSM.
4. **A2 — `commitMulti`** : ✅ corrigé (`08e8270`) après incident réel le 27/06 — voir le suivi détaillé plus haut. (Ancien statut « laissé en l'état tant que < 2 éditeurs » invalidé : le bug frappait même en solo, à cause du lag de réplica sur `GET refs`.)

---

## SEO statique (baké au build) — automatisé + multi-artistes

Mis en place le 27/06, **automatisé le 27/06** via `.github/workflows/seo.yml`.

Trois scripts de build, désormais relancés **automatiquement** par l'Action à chaque
push sur `main` (édition admin de Fred, publication/masquage/suppression d'un invité —
tout passe par `main`). Un `workflow_dispatch` sert de bouton « Renouveler le référencement ».
- `build/propagate_head.py` — meta `<head>` (title/description/OG/canonical), Fred uniquement.
- `build/gen_sitemap.py` — génère **`sitemap.xml` ET `robots.txt`** depuis `pages.json`
  (Fred) **+ `data/artistes.json`** (invités non-draft). Source de vérité = `artistes.json`.
- `build/gen_seo.py` — JSON-LD `Person` (index) + `ItemList`/`VisualArtwork` (galerie)
  + bloc `<noscript class="seo-toiles">`. **Pilotée par `artistes.json`** : Fred toujours
  indexée ; invité non-draft indexé sous `artistes/<id>/` ; invité draft → marqueurs **vidés** ;
  invité supprimé → fichiers absents, ignoré. Raison d'être : crawlers IA (GPTBot, ClaudeBot,
  OAI-SearchBot, PerplexityBot) ne rendent pas le JS → contenu JSON invisible sans ce bake.

**Anti-boucle de l'Action** : le recommit porte le tag `[seo]`, le job a un garde-fou
`if: !contains(message, '[seo]')` → il ne se redéclenche pas lui-même (même logique que
le tag `[admin]` de `deploy.yml`/`admin-deploy.yml`).

**⚠️ Déploiement** : un push fait par le `GITHUB_TOKEN` par défaut ne re-déclenche pas
`deploy.yml`. Pour que le SEO parte en ligne immédiatement, l'Action pousse avec le secret
`SEO_PUSH_TOKEN` (PAT fine-grained, contents:write). **Si ce secret est absent, le SEO est
quand même committé mais ne se déploie qu'au push humain suivant.** → secret à créer.

**Identité schema.org d'un invité** : dérivée de `artistes.json` (nom, type, genre →
jobTitle/artform). Enrichissable via un fichier optionnel `artistes/<id>/data/seo.json`
(mêmes clés que le bloc `_artiste` de `pages.json` : givenName, familyName, birthDate…).

**Cycle de vie invité = une seule ré-exécution idempotente** (plus de nettoyage SEO bespoke) :
- **Reste en draft** → rien (noindex + `Disallow: /artistes/` + absent du sitemap + 0 JSON-LD).
- **Publié** → l'Action l'inclut : Person + ItemList + noscript bakés, pages ajoutées au
  sitemap, `Allow: /artistes/<id>/` ajouté dans robots (Allow plus spécifique l'emporte).
- **Repassé en draft** → la **même** ré-exécution l'exclut : marqueurs vidés, retiré du
  sitemap, `Allow` retiré (donc re-bloqué). Le ré-ajout du `noindex` reste fait par
  `toggleDraftArtiste`. **Aucun code dédié à écrire.**
- **Supprimé** → la **même** ré-exécution : fichiers déjà partis, sitemap/robots reconstruits
  depuis `artistes.json` → **zéro résidu**, `supprimerArtiste` inchangé.

**Marqueurs SEO** (`<!-- JSONLD:BEGIN/END -->`, `<!-- TOILES-SEO:BEGIN/END -->`) désormais
présents dans les templates `templates/artiste-{index,galerie}.html` (futurs invités) ET
ajoutés aux invités existants (daw, dinso). Gestion des photos en URL absolue : `abs_url()`
ne préfixe que les chemins relatifs (les placeholders `https://…` restent intacts).

Validé localement le 27/06 : sortie de Frédérique **byte-identique** (zéro churn), publication
de Daw (22 toiles) → injection correcte, retour-draft → marqueurs vidés, 2 passes idempotentes.

---

## Méthode (rappel)
- Travail sur `dev`, jamais de merge `main` sans accord explicite d'Alain.
- `node --check` avant chaque push.
- Smoke-test sur `dev.frederiqueferette.be` (navigation privée) avant tout merge.
- Bumper les `?v=` des fichiers modifiés.
- Commits consolidés pendant les phases d'audit.

---

## Addendum — 05/07/2026 (salles masquables + fraîcheur du cache)

**Nouvelle fonctionnalité — salles masquables** (mergée en prod) : `salle.visible`
(`true`/absent = visible, `false` = masquée) filtre la galerie publique + le plan
SVG + les deep-links ; le mode édition/arrangeur et l'aperçu admin restent non
filtrés (ils rendent les données injectées telles quelles, pas une composition
de galerie). Repli « travaux » si toutes les salles sont masquées côté public
uniquement. `toRoman()` remplace la liste figée `NOMS_ROMAINS` (10 entrées max)
par un calcul illimité — corrige un `undefined` latent au-delà de la 10ᵉ salle,
même si ce code est aujourd'hui caché (`data-nav='c'` permanent, cf. section
« Backlog cosmétique » plus bas).

**Incident de concurrence, à nouveau** (même classe que 27/06, cf. plus haut) :
un masquage de salle n'a produit aucun commit — perdu silencieusement pendant
qu'un autre save (Claude) tournait sur la même branche. `commitMulti` lève bien
après échec des tentatives, mais le handler du bouton ne vérifiait pas que la
valeur avait réellement persisté. **Correctif** : après `sauvegarder()`, relecture
de `salles.json` sur GitHub (`_persistanceConfirmee`, avec petit retry anti-lag
de réplica) ; en cas d'échec réel, réalignement de l'admin sur l'état serveur +
message clair + proposition de relancer. Leçon (renforcée) : un save optimiste
sans vérification post-commit peut mentir à l'utilisateur, même quand la couche
`commitMulti` sous-jacente est correcte.

**Cache du site web servait des données périmées** : le service worker (enregistré
par l'admin, scope `/`) précachait `/data/*.json` en cache-first avec
`ignoreSearch:true` — ce qui **défaisait le cache-buster `?v=...`** des fetchs de
la galerie. Résultat : une édition admin pouvait rester invisible sur le site,
même après F5 (le SW répond avant le réseau). Les visiteurs purs n'étaient pas
touchés (le SW n'est enregistré que par l'admin) — le bug ne frappait que
Fred/Alain. **Correctif** : distinction par hostname (`app.frederiqueferette.be`
= app installée → cache-first inchangé ; site web → réseau d'abord pour les
données JSON, repli cache si hors-ligne). VERSION du SW bumpée pour forcer la
mise à jour.

**Bug de scroll GSM (régression)** : le bandeau de navigation mobile (bas d'écran)
avait été réactivé par un ancien patch, avec une réserve de `+80px` dans le
plancher pour lui laisser sa place. Combinée au `min-height:100svh` de `.salle`,
cette réserve faisait dépasser la hauteur d'écran → scroll vertical involontaire.
Bandeau retiré (portes + swipe suffisent, déjà le seul mode de nav sur mobile
pour les flèches latérales) ; réserve `+80px` retirée avec lui.

**Contraste UI** : les cases de placement (disponible/occupé) étaient à ~30 %
d'opacité — le vert virait au teal délavé sur mur sombre, confusion possible en
extérieur/mobile. Opacité relevée + contour vif.


**Accès admin — token de Fred migré (05/07/2026)** : le GSM de Fred utilisait
jusqu'ici un token GitHub *classic* (portée large) pour s'authentifier auprès de
l'admin ; il a été remplacé par un token *fine-grained* limité au dépôt
`FF_Galerie`. Réduit fortement la surface de risque en cas de perte/compromission
du téléphone (un fine-grained scopé ne peut pas toucher aux autres dépôts du
compte). **À finaliser côté serveur** : révoquer l'ancien token *classic* sur
GitHub s'il ne l'est pas déjà — changer le token stocké sur l'appareil ne révoque
pas l'ancien, qui reste valide tant qu'il n'est pas explicitement supprimé.


---

**Admin — introduction des vitrines (audit avant code, 06/07/2026)**

Rappel du modèle (arrêté côté rendu, `galerie-sculpture.js`) : une **vitrine est
une pièce sculpture** ordinaire portant `est_vitrine:true`, rangée dans
`data/oeuvres/sculpture.json` (tableau `pieces`) et posée au sol via
`positions`/`positions_mobile` comme n'importe quelle sculpture. Champs propres :
`style` ('bois'|'vitree'), `portes` ('fermees'|'ouvertes'), `couleur` (une seule,
pilote fond+parois+planches ; exception : étagères en verre restent glass),
`planches` et `places` (bornés 1–8), et `contenu` = objet `{ "PP": idŒuvre }` où
la clé = planche×10+place (1-based). Les œuvres contenues sont d'**autres pièces
avec photo** de la même `sculpture.json`, référencées **par leur id** (`pieces[oid]`,
`pieces` étant une map `{id→pièce}`).

Conclusions de l'audit des 4 zones admin :
1. **Whitelist `chargerTout()` — hors-sujet pour la vitrine.** Les pièces sont
   chargées ENTIÈRES (`items.forEach(it => toiles.push(it))`, aucun tri par champ),
   contrairement aux **salles** qui, elles, sont whitelistées (c'est à ELLES que
   s'applique la règle "ajouter le champ à la whitelist"). Écriture idem : `pieces:
   items` (objets entiers, filtrés seulement des clés `_*` par `_sansTemp`). Donc les
   champs vitrine survivent load+save sans toucher à aucune whitelist.
2. **Pivot réel = `lireFormToile()`/`remplirFormToile()` + le spread de `sauverToile`.**
   Édition `{ ...toiles[idx], ...donnees }` préserve les champs absents de
   `lireFormToile`. Création `{ id, photo, ...donnees, glb }` ne contient QUE ce que
   `lireFormToile` renvoie → étendre `lireFormToile` en mode vitrine suffit à injecter
   les champs.
3. **Deux correctifs nécessaires dans `sauverToile` :** (a) exempter `est_vitrine`
   du blocage "pièce visible sans photo" (une vitrine visible n'a pas de photo) ;
   (b) ne pas appeler `uploaderPhoto`/`uploaderGLB` pour une vitrine.
4. **Anti double-rendu :** une œuvre affectée à une vitrine doit être retirée des
   `positions` au sol, sinon elle s'affiche deux fois (socle + dans la vitrine).

**Décision d'archi (clé de voûte) :** dans le sélecteur "Type d'œuvre", l'option
**Vitrine** ne devient PAS un 3e `_typeEdition`/fichier — elle mappe en interne sur
`_typeEdition='sculpture'` + flag `_estVitrineEdition`. Sinon la vitrine partirait
dans un `vitrine.json` séparé, avec sa propre map `pieces`, et `pieces[oid]` ne
retrouverait jamais les sculptures qu'elle contient.

**Rappel process :** quand la vitrine sera branchée sur de vraies données (rendu
effectif modifié), BUMPER le cache-buster `?v=` des 3 `galerie-edit.html`
(racine + dinso + daw).

**Direction future — scénarios d'animation (idée d'Alain, 06/07) :** proposer au
**propriétaire du site uniquement** (Fred/Dinso, réglage admin, zéro UI visiteur) un
choix de scénarios de présentation (ex. vitrine affichée fermée → animation
d'ouverture au clic → révélation des objets → bascule descriptive). À stocker au
niveau **salle** (même nature que les `greffons` immersif/descriptif), PAS sur chaque
vitrine : couche de séquençage AU-DESSUS des vitrines, qui ne touche pas leur contrat
de données. Le renderer dessine déjà selon `portes` (fermées/ouvertes) → un futur
scénario n'aura qu'à animer cette transition.
