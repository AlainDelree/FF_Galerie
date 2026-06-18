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

- **Statut :** 🟢 Fixé (confirmé visuellement sur dev)
- **Date apparition :** Inconnue (probablement post-audit)
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique sur GSM (pas reproduit sur PC)
  2. Sélectionner la salle "Couloir" (3 toiles) → mur étiré verticalement, aspect-ratio cassé
  3. Sélectionner "Buanderie" → encore plus déformé
  4. Sélectionner "Entrée" (2 toiles) → presque normal
  5. **Preuve** : vider Couloir de ses toiles (sans sauvegarder) → le mur reprend immédiatement ses bonnes proportions
  6. **Observation complémentaire** : la déformation dépend de l'orientation de la toile. Toiles portrait (hauteur > largeur en pixels intrinsèques) déforment ; toiles paysage non. Plus la toile est "portrait" (ratio hauteur/largeur élevé), plus la déformation est forte.
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
- **Solution trouvée :** Double fix en deux niveaux. (1) Sur les tracks du grid (`.mur-bg`, `.placement-mur-bg`) : `repeat(N, 1fr)` → `repeat(N, minmax(0, 1fr))`. (2) Sur les grid items (`.toile-posee`) : ajout de `min-width:0; min-height:0` (par défaut `auto` = taille intrinsèque du contenu) + image en `position:absolute; inset:0` pour qu'elle sorte du flow et ne contribue plus au calcul de taille du parent.
  - Le premier fix seul ne suffit pas : il contrôle le track mais pas le grid item.
  - Le deuxième fix neutralise complètement l'influence de l'intrinsic size de l'image.
- **Commit fix :** `5709983` (minmax sur tracks) + `7e7cf32` (min-height:0 + img absolute) — sur dev, à reporter sur main après validation smoke test

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
- **Commit fix :** `7e475a9` (dev) — à reporter sur main après validation

---

## BUG-004 — Mode Arranger affiche la texture sans la couleur de fond

- **Statut :** 🟢 Fixé (à valider visuellement)
- **Date apparition :** Latente (probablement depuis longtemps, révélée par l'attention portée aux textures)
- **Branche concernée :** main (prod) et dev
- **Reproduction :**
  1. Ouvrir admin Frédérique
  2. Sélectionner la salle Couloir (couleur `#29275e` bleu marine, texture `ecorce-grosse.jpg`)
  3. **Aperçu admin** : mur bleu marine avec texture écorce → correct
  4. Ouvrir mode Arranger
  5. **Mode Arranger** : mur blanc (ou gris) avec texture écorce → couleur de fond manquante
- **Symptôme attendu :** Apparence identique entre l'aperçu admin et le mode Arranger (couleur + texture).
- **Cause réelle :** La fonction `afficherMurPlacement` (`admin-galerie.js`) avait la même limitation que `appliquerApparence` avant le fix BUG-003 : elle utilisait `TEXTURES[textureActuelle]` qui retourne undefined pour les chemins de fichier (.jpg/.png/.webp). Pour les textures image, le code passait silencieusement sans appliquer ni la texture ni un fond cohérent.
  ```js
  // BUGGY :
  bg.style.background = couleurMurActuel;
  const texStr = TEXTURES[textureActuelle] || '';   // undefined pour les images
  if (texStr) bg.style.background = `${texStr}, ${couleurMurActuel}`;  // skipped
  ```
  Pourquoi l'utilisateur voyait quand même la texture : à confirmer (probablement un état résiduel ou un comportement de cascade CSS non identifié — mais le fix règle le problème en imposant une apparence cohérente).
- **Solution trouvée :** Porter la même logique que `appliquerApparence` (admin-textures.js) : détecter les textures image et utiliser le chemin directement avec `multiply blend`.
- **Commit fix :** `f1c2210` (dev) — à reporter sur main après validation

---

## BUG-005 — Backup ignore les commits sur salles.json (placement masqué)

- **Statut :** 🟢 Fixé (à valider visuellement)
- **Date apparition :** Depuis toujours (architecturel)
- **Branche concernée :** main (prod) et dev
- **Reproduction :**
  1. Ouvrir admin Frédérique
  2. Faire plusieurs modifications de placement (déplacer/retirer/replacer des toiles, changer couleur/texture d'une salle)
  3. Sauvegarder → un nouveau commit est créé sur `data/salles.json`
  4. Ouvrir l'onglet Backup
  5. Le commit n'apparaît pas. Le dernier commit listé date d'avant — soit la dernière modification du catalogue (ajout/suppression/modification de toile).
- **Symptôme attendu :** Tout commit créé via admin doit apparaître dans Backup.
- **Cause réelle :** `chargerCommits()` faisait un seul appel à l'API GitHub avec `path=toiles.json`. Or l'admin manipule **deux fichiers** distincts :
  - `data/toiles.json` : catalogue (titres, photos, dimensions, tags)
  - `data/salles.json` : placement (positions, couleurs, textures, ordre des salles)
  Le travail quotidien de placement n'affecte que `salles.json` → invisible dans Backup. Asymétrie aggravante : la fonction `executerRestauration` restaurait pourtant déjà les deux fichiers.
- **Solution trouvée :** Deux appels API parallèles (`toiles.json` + `salles.json`), fusion par SHA pour dédupliquer, tri par date décroissante. Ajout d'un badge à côté de chaque commit pour visualiser ce qu'il a modifié :
  - 🎨📐 : catalogue + placement (commits qui touchent les deux)
  - 🎨 : catalogue seul (ajout/modif/suppression de toile)
  - 📐 : placement seul (déplacement, couleurs, textures)
  Tooltip explicatif au survol.
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
