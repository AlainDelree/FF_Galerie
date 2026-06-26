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
- **A2 — `commitMulti` force:true** : ⏸️ reporté (décision Alain : attendre ≥ 2 éditeurs parallèles).
- **H3 — cache-busters** : partiellement traité (galerie-core uniformisé). Reste : `style.css` n'a aucun `?v=` → à ajouter un jour pour fiabiliser le rechargement après modif.

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

### H2 — `construirePillsSalle` / `salle-pills`
- Encore référencé (`admin-oeuvres.js`, `admin-galerie.js:1883`) avec garde `if(!pills) return`
  → inerte si l'élément n'existe plus, mais **pas mort**.
- Cascade complexe → **reporté**, pas prioritaire.

### H3 — Cache-busters hétérogènes
- Les `?v=` s'étalent de `20260622i` à `20260626o`.
- Pas un bug (chaque fichier ne doit bumper que quand lui-même change), mais complique le suivi.

---

## Plan de durcissement proposé (du plus sûr au plus délicat)

1. **H1 — Dead code chips** : zéro risque, allège `admin-galerie.js`. *(échauffement / validation méthode)*
2. **A3 — `galerie-core.js:230`** : 1 ligne, durcit le rendu public.
3. **A1 — Accolade `style.css`** : le seul vrai bug, avec smoke-test desktop + GSM.
4. **A2 — `commitMulti`** : laissé en l'état tant que < 2 éditeurs parallèles.

---

## Méthode (rappel)
- Travail sur `dev`, jamais de merge `main` sans accord explicite d'Alain.
- `node --check` avant chaque push.
- Smoke-test sur `dev.frederiqueferette.be` (navigation privée) avant tout merge.
- Bumper les `?v=` des fichiers modifiés.
- Commits consolidés pendant les phases d'audit.
