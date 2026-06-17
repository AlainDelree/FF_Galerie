# Registre des bugs — FF_Galerie

> Tout bug rencontré doit être loggé ici, même fixé. Le champ **Solution trouvée** est essentiel : il évite de re-débugger le même problème dans 3 mois.

## Légende statut
- 🔴 **Ouvert** — pas encore investigué
- 🟠 **En cours** — reproduit, en cours de fix
- 🟢 **Fixé** — corrigé, solution documentée
- 🔁 **Régression** — était fixé, est revenu

---

## BUG-001 — Page Backup vide en prod

- **Statut :** 🔴 Ouvert
- **Date apparition :** Inconnue (probablement post-audit)
- **Branche concernée :** main (prod)
- **Reproduction :**
  1. Ouvrir admin Frédérique en prod
  2. Naviguer vers la section Backup
  3. La page apparaît vide (aucun contenu visible)
- **Symptôme attendu :** Liste des backups disponibles + boutons de restauration
- **Hypothèses à tester :**
  - Erreur JS qui interrompt le rendu (vérifier console)
  - Données absentes ou mal chargées
  - Élément DOM caché par CSS
  - Régression suite à modification post-audit
- **Solution trouvée :** _(à remplir une fois corrigé)_
- **Commit fix :** _(à remplir)_

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
