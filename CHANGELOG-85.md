# CHANGELOG — issue #85

## Expiration de session dans l'admin (token localStorage)

- `assets/js/admin.js` : ajout d'une expiration de session bornée à 7 jours.
  - Nouvelle constante nommée `DUREE_SESSION_MAX_MS` (7 jours) en haut du
    fichier, ajustable sans chercher dans le code.
  - Nouvelle clé de stockage `K.loginTs` (`ff_gh_token_login`) : horodatage
    du dernier login, stocké à côté du token.
  - Nouvelle fonction `verifierExpirationSession()`, appelée au démarrage
    synchrone d'admin.js AVANT `reprendreSessionExistante()`. Si le token
    présent remonte à plus de 7 jours, elle purge du `localStorage` le token,
    le secret ff-data et l'horodatage, efface le garde-fou de session
    (`K.auth`) et réaffiche l'écran de connexion avec un message rassurant
    (« Ta session a expiré (plus de 7 jours). Reconnecte-toi pour
    continuer. »), pas une erreur alarmante.
  - Un token présent sans horodatage (session ouverte avant ce déploiement)
    n'est PAS déconnecté brutalement : l'horodatage est initialisé à
    maintenant et la fenêtre de 7 jours démarre au premier chargement.
  - L'horodatage est rafraîchi à chaque connexion réussie par les deux
    chemins : `connexionParMotDePasse()` (mot de passe) et `validerToken()`
    (saisie manuelle du token).
- Aucun autre flux d'authentification affecté : `reprendreSessionExistante()`
  n'appelle toujours ni `chargerTout()` ni `initTexturesUI()` ; la nouvelle
  fonction respecte la même contrainte (aucune dépendance aux modules chargés
  après). `node --check` passe.
