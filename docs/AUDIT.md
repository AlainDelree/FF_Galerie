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

## Méthode (rappel)
- Travail sur `dev`, jamais de merge `main` sans accord explicite d'Alain.
- `node --check` avant chaque push.
- Smoke-test sur `dev.frederiqueferette.be` (navigation privée) avant tout merge.
- Bumper les `?v=` des fichiers modifiés.
- Commits consolidés pendant les phases d'audit.
