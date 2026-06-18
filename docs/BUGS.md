# Registre des bugs — FF_Galerie

> Tout bug rencontré doit être loggé ici, même fixé. Le champ **Solution trouvée** est essentiel : il évite de re-débugger le même problème dans 3 mois.

## Légende statut
- 🔴 **Ouvert** — pas encore investigué
- 🟠 **En cours** — reproduit, en cours de fix
- 🟢 **Fixé** — corrigé, solution documentée
- 🔁 **Régression** — était fixé, est revenu

---

## BUG-001 — Page Backup vide en prod (PC uniquement)

- **Statut :** 🟢 Fixé (à confirmer après déploiement dev)
- **Date apparition :** Post-audit (probablement lors de l'ajout du panneau EmailJS)
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique sur PC (zoom 100-150%)
  2. Cliquer sur l'onglet Backup
  3. Le panneau "Notifications email (EmailJS)" occupe la majorité de l'écran
  4. La liste des commits est masquée derrière / sous le panneau
- **Symptôme apparent :** Page Backup vide
- **Cause réelle :** Le bloc `#bloc-emailjs` est physiquement à l'intérieur de `#vue-backup` (admin.html ligne 557). Sur PC, dans le conteneur flex column avec `max-height:calc(100vh-120px)`, le panneau EmailJS occupe ~250px, ne laissant qu'une bande étroite au `#commits-contenu` (`flex:1`). À zoom élevé, la liste devient quasi invisible. Sur GSM, le scroll natif évite le problème — d'où la différence PC/GSM constatée.
- **Mauvaises hypothèses initiales :**
  - Token GitHub expiré → INVALIDE (sinon login admin échouerait)
  - Filtre `startsWith('admin :')` trop strict → faux positif partiel (le filtre est strict mais le bug visible était bien un problème de layout)
- **Fix appliqué :** `<div id="bloc-emailjs">` transformé en `<details>/<summary>` HTML natif, replié par défaut. Le panneau reste accessible (clic sur "Notifications email (EmailJS)" pour déplier) mais ne masque plus la liste.
- **Patch défensif bonus** (commit `14ddee6`) : `admin-backup.js` durci avec garde-fous et messages d'erreur visibles — utile pour les futurs problèmes, sans rapport avec ce bug-ci.
- **Solution trouvée :** Bloc EmailJS rendu repliable via `<details>` natif. Replié par défaut → la liste backup est immédiatement visible.
- **Commit fix :** `a9736d9` (dev) — à reporter sur main après validation visuelle
- **Test à ajouter :** smoke test "ouvrir Backup → `#commits-contenu` est visible et non vide"

---

## BUG-002 — Mur d'aperçu déformé selon le contenu (GSM, aspect-ratio cassé)

- **Statut :** 🟠 En cours (cause identifiée, fix proposé en attente de validation)
- **Date apparition :** Inconnue (probablement post-audit)
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique sur GSM (pas reproduit sur PC)
  2. Sélectionner la salle "Couloir" (3 toiles) → mur étiré verticalement, aspect-ratio cassé
  3. Sélectionner "Buanderie" → encore plus déformé
  4. Sélectionner "Entrée" (2 toiles) → presque normal
  5. **Preuve** : vider Couloir de ses toiles (sans sauvegarder) → le mur reprend immédiatement ses bonnes proportions
- **Symptôme observable :** Le mur d'aperçu garde sa largeur (max ~470px sur mobile) mais sa hauteur s'allonge selon le contenu, cassant l'aspect-ratio 12:8. Mesures : Couloir ~470×365 (ratio 1.29 au lieu de 1.5), Entrée ~470×300 (ratio 1.57 ≈ 1.5).
- **Cause réelle :** En CSS Grid, `grid-template-rows: repeat(8, 1fr)` est implicitement `repeat(8, minmax(auto, 1fr))`. Le `auto` minimum signifie "au moins aussi grand que le contenu intrinsèque". Quand on pose des `<img>` dans des cellules (toiles), leur taille intrinsèque (résolution native du fichier) impose un minimum aux cellules, ce qui force le grid à dépasser son `aspect-ratio:12/8`. Plus l'image est haute en pixels natifs, plus la cellule est forcée à s'étendre. Sur PC, la largeur disponible est généralement assez grande pour que ce dépassement reste invisible ; sur GSM (largeur contrainte), l'effet devient visible.
- **Affecte aussi :** `.placement-mur-bg` (mode Arranger) avec `minmax(26px, 1fr)` — la valeur 26px minimum peut casser l'aspect-ratio sur écrans très étroits.
- **Fix proposé (à valider) :**
  ```css
  .mur-bg {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(0, 1fr));
  }
  .placement-mur-bg {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(0, 1fr));
  }
  ```
  Le `minmax(0, 1fr)` force le minimum à 0 (au lieu de auto), ignorant la taille intrinsèque du contenu. Risque : aucun connu — c'est exactement le pattern recommandé par MDN pour ce cas.
- **Solution trouvée :** _(à confirmer après application et test visuel sur dev)_
- **Commit fix :** _(à remplir)_

---

## BUG-003 — Texture image absente du mur d'aperçu admin

- **Statut :** 🟢 Fixé (à confirmer après déploiement dev)
- **Date apparition :** Inconnue, probablement depuis l'introduction des textures image
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique
  2. Sélectionner une salle dont la texture est une image (Couloir, Cuisine, etc. → texture = `assets/images/textures/ecorce-grosse.jpg`)
  3. Le mur d'aperçu affiche la couleur de fond mais **pas la texture image** — uniquement les pseudo-textures CSS (pierre, bois, etc.) s'affichent.
- **Symptôme attendu :** La texture image doit être visible en arrière-plan du mur (avec blend multiply pour laisser passer la couleur).
- **Cause réelle :** Dans `admin-textures.js` ligne 58 (avant fix), pour les textures image, le code générait `url("")` au lieu d'utiliser `textureActuelle` directement :
  ```js
  // BUGGY :
  'url("' + (TEXTURES[textureActuelle] || '').replace(/url\("|"\)/g,'') + '") center/cover, ' + couleurMurActuel
  // TEXTURES['assets/images/textures/ecorce-grosse.jpg'] = undefined
  // → '' → url("") (URL vide → ignorée par le navigateur)
  ```
- **Solution trouvée :** Utiliser `textureActuelle` directement (c'est déjà un chemin valide) :
  ```js
  bg.style.background = 'url("' + textureActuelle + '") center/cover, ' + couleurMurActuel;
  ```
- **Commit fix :** _(à compléter après push)_

---

## Template pour nouveau bug

```markdown
## BUG-NNN — Titre court et descriptif

- **Statut :** 🔴 Ouvert
- **Date apparition :** YYYY-MM-DD
- **Branche concernée :** dev / main
- **Reproduction :**
  1. ...
  2. ...
- **Symptôme attendu :** ...
- **Hypothèses à tester :**
  - ...
- **Solution trouvée :** _(à remplir)_
- **Commit fix :** _(à remplir)_
```
