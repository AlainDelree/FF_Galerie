# ff-data — Worker Phase 0

API minimaliste devant un namespace KV. Remplace, à terme, les commits GitHub
comme mécanisme de sauvegarde des données. Voir
`docs/PLAN_MIGRATION_CLOUDFLARE_KV.md` pour le plan complet — ce dossier
correspond à la **Phase 0** uniquement (fondations, à tester à la main).

## Ce que fait ce worker aujourd'hui

- `GET /api/<cle>` → lit la clé KV `<cle>`, publique, pas d'auth.
- `PUT /api/<cle>` → écrit `<cle>`, protégé par un secret (header `Authorization: Bearer <secret>`).
- `DELETE /api/<cle>` → supprime `<cle>`, protégé pareil.
- `GET /api/_health` → ping.
- CORS ouvert en lecture (données publiques).

Ce qu'il ne fait **pas** encore : archive Git en arrière-plan, validation de
schéma par type de donnée, interface de restauration. Ça viendra aux phases
suivantes.

## Mise en place (une seule fois)

Prérequis : `wrangler` installé (`npm install -g wrangler`, ou `npx wrangler`),
connecté à ton compte Cloudflare (`wrangler login`).

```bash
cd data-worker

# 1. Créer le namespace KV
wrangler kv namespace create FF_DATA
# → copier l'id affiché dans wrangler.toml, à la place de
#   "À_REMPLIR_APRES_CREATION_NAMESPACE"

# 2. Poser le secret d'écriture (à générer, ex. openssl rand -hex 32,
#    et à stocker dans Bitwarden comme le PAT GitHub)
wrangler secret put FF_DATA_SECRET

# 3. Déployer
wrangler deploy
```

`wrangler deploy` affiche l'URL du worker (du style
`https://ff-data.<ton-compte>.workers.dev`).

## Tests à la main

Remplacer `<URL>` par l'URL affichée au déploiement, et `<SECRET>` par la
valeur posée à l'étape 2.

```bash
# Ping
curl -s <URL>/api/_health

# Écrire une clé de test (PUT protégé)
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

## Une fois validé

On passe à la Phase 1 (voir le plan) : migrer `data/salles.json` de Fred vers
KV, brancher la lecture publique du site dessus (avec repli fichier tant que
non validé), brancher l'écriture admin, et ajouter l'archive Git en
arrière-plan.
