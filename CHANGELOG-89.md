# CHANGELOG — Issue #89

## Retirer `data/emailjs.json` du précache du service worker

- **Fichier modifié :** `sw.js` — retrait de l'entrée `'/data/emailjs.json'`
  de la liste `SHELL` (liste de précache du cache `ff-shell`). 1 ligne
  supprimée.
- **Vérification de dépendance :** confirmé qu'aucune page publique ni la PWA
  ne dépend de ce fichier. La seule référence à `data/emailjs.json` est dans
  `assets/js/admin-emailjs.js` (fetch), lui-même chargé uniquement depuis
  `admin.html`. L'admin est de toute façon exclue du SW (chemin + referrer),
  donc ce fichier n'était jamais servi depuis le cache à qui en a besoin.
- **Cohérence du précache :** `precacheShell()` itère via
  `Promise.allSettled(SHELL.map(...))` — aucun compteur figé sur l'ancienne
  longueur, tableau bien formé. `node --check sw.js` passe.
- **Purge des installs existants :** le cache `ff-shell` a un nom STABLE.
  Retirer l'entrée empêche seulement les NOUVELLES installations de la mettre
  en cache. `REFRESH`/`precacheShell` ne font que `cache.put` (ajout/mise à
  jour), jamais de suppression des entrées obsolètes ; `activate` ne purge que
  les caches nommés `ff-shell-*`. L'ancienne entrée persiste donc dans les
  installs déjà déployés. Elle est inoffensive (site public = réseau d'abord ;
  app = exclue par chemin/referrer). Purge réelle → vider les données de site /
  réinstaller la PWA.
