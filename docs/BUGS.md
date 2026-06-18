# Registre des bugs — FF_Galerie

> Tout bug rencontré doit être loggé ici, même fixé. Le champ **Solution trouvée** est essentiel : il évite de re-débugger le même problème dans 3 mois.

## Légende statut
- 🔴 **Ouvert** — pas encore investigué
- 🟠 **En cours** — reproduit, en cours de fix
- 🟢 **Fixé** — corrigé, solution documentée
- 🔁 **Régression** — était fixé, est revenu

---

## BUG-001 — Page Backup vide en prod

- **Statut :** 🟠 En cours (patch diagnostic poussé sur dev)
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
  - **Hypothèse la plus probable :** `apiGH` renvoie un objet d'erreur GitHub (`{message:"Bad credentials"...}`) au lieu d'un tableau, ce qui fait planter `.filter()` silencieusement → le spinner "Chargement…" reste à l'écran indéfiniment, ce qui donne l'impression d'une page "vide"
- **Investigation en cours :** Patch poussé sur dev (`admin-backup.js`) qui :
  - ajoute des garde-fous null (cont DOM, apiGH/REPO/ADMIN_CFG)
  - détecte si la réponse n'est pas un tableau
  - distingue "0 commits sur le chemin" vs "0 commits passent le filtre Admin :"
  - logue dans la console le nombre de commits reçus/filtrés
  - affiche tous les messages d'erreur directement dans la page (plus jamais "vide silencieux")
- **À faire ensuite :** Tester sur `dev.frederiqueferette.be/admin.html` → la page Backup affichera maintenant un message diagnostique. Selon ce message, on saura quelle est la vraie cause.
- **Solution trouvée :** _(à confirmer après diagnostic visuel)_
- **Commit fix :** _(à remplir une fois confirmé)_

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
