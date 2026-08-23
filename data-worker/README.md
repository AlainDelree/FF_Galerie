# ff-data — Worker

API devant un namespace KV. Remplace, pour les clés migrées, les commits
GitHub comme mécanisme de sauvegarde des données. Voir
`docs/PLAN_MIGRATION_CLOUDFLARE_KV.md` pour le plan complet.

## Ce que fait ce worker aujourd'hui (Phase 1, étapes 1 à 4 pour `ferette/salles`)

- `GET /api/<cle>` → lit la clé KV `<cle>`, publique, pas d'auth.
- `PUT /api/<cle>` → écrit `<cle>` (header `Authorization: Bearer <secret>`).
  Portée selon la clé (voir [Deux secrets](#deux-secrets-maître--écriture)) :
  clé de **données** (hors `auth/`) → secret maître **ou** secret d'écriture ;
  clé sous `auth/` → secret **maître seul**.
  Si `<cle>` est dans `CLE_VERS_CHEMIN` (aujourd'hui : seule `ferette/salles`
  → `data/salles.json`) et que `GITHUB_TOKEN` est configuré, un commit
  d'archive est poussé sur GitHub **en arrière-plan** (`ctx.waitUntil`, ne
  retarde jamais la réponse). Entêtes optionnelles :
  - `X-FF-Branch` : branche cible (`dev` ou `main`), défaut `dev`.
  - `X-FF-Message` : message de commit, défaut `Archive KV : <cle>`.
- `DELETE /api/<cle>` → supprime `<cle>`, **secret maître seul** (opération
  destructive, sans repli d'archive — donc plus stricte que le PUT).
- `POST /api/auth/creer-utilisateur` → crée/écrase un compte, **secret maître
  seul**.
- `GET /api/_health` → ping.
- CORS ouvert en lecture (données publiques).

## Deux secrets (maître / écriture)

Le worker connaît **deux** secrets aux portées volontairement inégales, pour
que la valeur exposée dans un navigateur soit la moins puissante possible :

| Secret | Variable wrangler | Autorise | Va dans un navigateur ? |
|--------|-------------------|----------|--------------------------|
| **Maître** | `FF_DATA_SECRET` | Tout : `creer-utilisateur`, `DELETE`, `PUT` (y compris clés `auth/`) | **Jamais.** Reste dans Bitwarden + les secrets wrangler. Sert à Alain (script `gerer-utilisateurs.sh`, tests curl). |
| **Écriture** | `FF_DATA_SECRET_ECRITURE` | `PUT` sur des clés de **données** uniquement (tout ce qui n'est PAS sous `auth/`) | **Oui.** C'est LUI, et lui seul, que `/api/auth/login` renvoie dans `ff_secret` ; `admin.js` le stocke dans `localStorage`. |

Pourquoi : le secret d'écriture vit dans le `localStorage` du navigateur de
Fred — donc exposé en cas d'appareil perdu, de poste partagé ou de XSS. En le
séparant du maître, une fuite ne permet plus QUE d'écraser des données hors
`auth/` (ennuyeux mais récupérable via l'archive Git), **sans** escalade vers
la création de comptes, le `DELETE`, ni la lecture des tokens GitHub des
utilisateurs. Le principe de moindre privilège est rétabli : le compte le
moins technique ne détient plus la clé la plus puissante.

Si `FF_DATA_SECRET_ECRITURE` n'est pas configuré, seul le maître fonctionne
(repli sûr, pas d'ouverture accidentelle).

Ce qu'il ne fait **pas** encore : interface de restauration Ctrl+Z,
validation de schéma par type de donnée, archive pour d'autres clés que
`ferette/salles` (à étendre quand les phases suivantes migrent oeuvres/infos/
autres artistes).

## Mise en place (une seule fois)

Prérequis : `wrangler` installé (`npm install -g wrangler`, ou `npx wrangler`),
connecté à ton compte Cloudflare (`wrangler login`).

```bash
cd data-worker

# 1. Créer le namespace KV
wrangler kv namespace create FF_DATA
# → copier l'id affiché dans wrangler.toml, à la place de
#   "À_REMPLIR_APRES_CREATION_NAMESPACE"

# 2a. Poser le secret MAÎTRE FF_DATA_SECRET (à générer, ex. openssl rand
#     -hex 32, et à stocker dans Bitwarden comme le PAT GitHub).
#     IMPORTANT : ne jamais taper/coller le secret directement au prompt
#     interactif — toujours passer par une variable shell + un pipe, sinon
#     risque de caractères parasites (vécu en Phase 0) :
SECRET=$(openssl rand -hex 32)
echo -n "$SECRET" | wc -c   # doit afficher 64
printf '%s' "$SECRET" | wrangler secret put FF_DATA_SECRET
echo "$SECRET"   # copie IMMÉDIATEMENT dans Bitwarden

# 2b. Poser le secret d'ÉCRITURE FF_DATA_SECRET_ECRITURE (valeur DIFFÉRENTE
#     du maître ! le générer séparément). C'est celui qui finira dans le
#     navigateur de Fred via le login — voir « Deux secrets » ci-dessus.
#     Même règle : variable shell + pipe, jamais de saisie interactive.
SECRET_ECRITURE=$(openssl rand -hex 32)
printf '%s' "$SECRET_ECRITURE" | wrangler secret put FF_DATA_SECRET_ECRITURE
echo "$SECRET_ECRITURE"   # copie IMMÉDIATEMENT dans Bitwarden (entrée distincte)

# 3. Poser le token GitHub pour l'archive (étape 4)
#    Créer un PAT FINE-GRAINED dédié à CE worker (PAS le token admin
#    habituel) : github.com → avatar → Settings → Developer settings →
#    Fine-grained tokens → Generate new token
#      - Repository access : Only select repositories → AlainDelree/FF_Galerie
#      - Permissions : Contents → Read and write (RIEN d'autre)
#    Puis, toujours via variable shell + pipe :
GH_TOKEN="colle_le_token_ici_puis_efface_cette_ligne_de_l_historique"
printf '%s' "$GH_TOKEN" | wrangler secret put GITHUB_TOKEN
unset GH_TOKEN

# 4. Déployer
wrangler deploy
```

`wrangler deploy` affiche l'URL du worker (du style
`https://ff-data.<ton-compte>.workers.dev`).

## Tests à la main

Remplacer `<URL>` par l'URL affichée au déploiement, `<SECRET>` par le
secret **maître** `FF_DATA_SECRET` (étape 2a, pas le token GitHub) et
`<SECRET_ECRITURE>` par le secret **d'écriture** `FF_DATA_SECRET_ECRITURE`
(étape 2b).

```bash
# Ping
curl -s <URL>/api/_health

# Écrire une clé de test (PUT protégé) — PAS archivable (pas dans
# CLE_VERS_CHEMIN), donc aucun commit GitHub ne doit apparaître
curl -s -X PUT <URL>/api/test/ping \
  -H "Authorization: Bearer <SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"salut":"monde"}'

# Lire (public, pas d'auth nécessaire)
curl -s <URL>/api/test/ping

# Écriture sans secret → doit renvoyer 401
curl -s -X PUT <URL>/api/test/ping -d '{"x":1}'

# Écriture avec du JSON cassé → doit renvoyer 400
curl -s -X PUT <URL>/api/test/ping \
  -H "Authorization: Bearer <SECRET>" \
  -d '{cassé'

# Supprimer la clé de test
curl -s -X DELETE <URL>/api/test/ping -H "Authorization: Bearer <SECRET>"

# Relire → doit renvoyer 404
curl -s <URL>/api/test/ping
```

### Portée du secret d'écriture (vérifie la séparation des privilèges)

```bash
# PUT données avec le secret d'ÉCRITURE → doit RÉUSSIR (200)
curl -s -X PUT <URL>/api/test/ping \
  -H "Authorization: Bearer <SECRET_ECRITURE>" \
  -H "Content-Type: application/json" -d '{"ok":1}'

# PUT sous auth/ avec le secret d'écriture → doit ÉCHOUER (401)
curl -s -X PUT <URL>/api/auth/test-refus \
  -H "Authorization: Bearer <SECRET_ECRITURE>" \
  -H "Content-Type: application/json" -d '{"x":1}'

# DELETE (même sur une clé de données) avec le secret d'écriture → 401
curl -s -X DELETE <URL>/api/test/ping \
  -H "Authorization: Bearer <SECRET_ECRITURE>"

# creer-utilisateur avec le secret d'écriture → 401
curl -s -X POST <URL>/api/auth/creer-utilisateur \
  -H "Authorization: Bearer <SECRET_ECRITURE>" \
  -H "Content-Type: application/json" \
  -d '{"nom":"x","mot_de_passe":"aaaaaaaaaaaa","token":"t"}'

# Nettoyage (avec le maître)
curl -s -X DELETE <URL>/api/test/ping -H "Authorization: Bearer <SECRET>"
```

### Test spécifique de l'archive (étape 4)

```bash
# PUT sur ferette/salles, EST archivable → doit déclencher un commit sur
# GitHub dans les secondes qui suivent (vérifier sur github.com, branche dev)
curl -s -X PUT <URL>/api/ferette/salles \
  -H "Authorization: Bearer <SECRET>" \
  -H "Content-Type: application/json" \
  -H "X-FF-Branch: dev" \
  -H "X-FF-Message: Test archive Phase 1 étape 4" \
  --data-binary @../data/salles.json
```
Puis vérifier sur `https://github.com/AlainDelree/FF_Galerie/commits/dev` —
un commit « Test archive Phase 1 étape 4 » doit apparaître (peut prendre
quelques secondes, c'est un `ctx.waitUntil` en tâche de fond).

## Une fois validé

Reste pour plus tard (hors Phase 1) : interface de restauration Ctrl+Z,
indicateur d'état d'archive dans l'admin, extension de `CLE_VERS_CHEMIN` aux
autres artistes/fichiers (Phase 2+).

## Auth par personne (un token par personne, restitué par mot de passe)

Résout le problème « chaque personne qui change d'appareil redemande son
token » : chacun se connecte avec un nom d'utilisateur + mot de passe, et
l'admin va chercher le bon token tout seul. Le token GitHub, lui, reste créé
à la main sur github.com comme avant (impossible autrement).

### Créer/mettre à jour un compte

```bash
export FF_DATA_URL="https://ff-data.alain-delree.workers.dev"
FF_DATA_SECRET="colle-ici-la-valeur-de-bitwarden"
export FF_DATA_SECRET

cd data-worker
./gerer-utilisateurs.sh creer fred
# → demande le mot de passe et le token (rien ne s'affiche à l'écran)
# → si le nom est "fred" ou "ferette", demande aussi le SECRET D'ÉCRITURE
#   (= FF_DATA_SECRET_ECRITURE, PAS le maître) : c'est cette valeur qui sera
#   renvoyée au navigateur au login. Voir « Deux secrets » ci-dessus.
```

### Supprimer un compte (ex. token fuité par cette personne)

```bash
./gerer-utilisateurs.sh supprimer fred
```

### Tests à la main

```bash
# Créer un compte de test
./gerer-utilisateurs.sh creer test1
# (mot de passe : test1234, token : n'importe quelle chaîne pour le test)

# Login avec le bon mot de passe → doit renvoyer {"token":"..."}
curl -s -X POST "$FF_DATA_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"utilisateur":"test1","mot_de_passe":"test1234"}'

# Login avec un mauvais mot de passe → doit renvoyer 401 "Identifiants invalides"
curl -s -X POST "$FF_DATA_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"utilisateur":"test1","mot_de_passe":"faux"}'

# Après 5 échecs → doit renvoyer 429 "Trop de tentatives..."
for i in 1 2 3 4 5; do
  curl -s -X POST "$FF_DATA_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"utilisateur":"test1","mot_de_passe":"faux"}'
  echo
done

# Lecture directe du compte via le GET générique → doit renvoyer 401
# (auth/* est bloqué en lecture publique, contrairement au reste de KV)
curl -s "$FF_DATA_URL/api/auth/utilisateurs/test1"

# Nettoyage
./gerer-utilisateurs.sh supprimer test1
```

### Branché dans l'admin

L'écran de connexion (`admin.html`/`assets/js/admin.js`) affiche désormais
en premier un formulaire nom d'utilisateur + mot de passe, qui appelle
`/api/auth/login` et enregistre automatiquement le token (+ clé ff-data si
renvoyée) dans `localStorage`. Un lien « Entrer le token manuellement à la
place » garde l'ancien flux disponible en repli (utile si l'endpoint est
indisponible, ou pour Alain en debug).
