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

## BUG-002 — Mur d'aperçu de taille différente entre salles "Couloir" et "Entrée" (admin Fred)

- **Statut :** 🔴 Ouvert
- **Date apparition :** Inconnue (probablement post-audit)
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique en prod
  2. Sélectionner la salle "Entrée" → noter la taille du mur d'aperçu
  3. Sélectionner la salle "Couloir" → la taille diffère
- **Symptôme attendu :** Toutes les salles doivent avoir un mur d'aperçu de mêmes dimensions logiques (proportionnelles à la salle réelle, mais cohérentes dans le panneau admin)
- **Hypothèses à tester :**
  - CSS qui dépend du contenu (largeur calculée selon nombre de toiles ?)
  - Dimensions de salle dans `salles.json` différentes entre Couloir et Entrée et appliquées sans normalisation
  - Régression CSS dans `admin.html` ou feuille de style
- **Solution trouvée :** _(à remplir)_
- **Commit fix :** _(à remplir)_

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
