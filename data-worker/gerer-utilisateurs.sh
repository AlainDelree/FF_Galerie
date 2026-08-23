#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# gerer-utilisateurs.sh — créer/mettre à jour un compte admin FF_Galerie
#
# Résout le problème « chaque personne qui change d'appareil me redemande
# son token » : la personne se connecte désormais avec un nom d'utilisateur
# + mot de passe (elle choisit son mot de passe), et l'admin va chercher le
# bon token tout seul via /api/auth/login. Ce script sert à (re)créer un
# compte côté worker — le token GitHub, lui, reste généré à la main sur
# github.com comme avant (impossible autrement, GitHub ne permet pas de
# créer un token via une API login/mot de passe).
#
# Usage :
#   ./gerer-utilisateurs.sh creer   <nom>   # crée ou met à jour un compte
#   ./gerer-utilisateurs.sh supprimer <nom> # supprime un compte (token fuité)
#
# Prérequis : les variables FF_DATA_URL et FF_DATA_SECRET doivent être
# définies dans l'environnement (mêmes valeurs que pour tester le worker
# au curl). FF_DATA_SECRET est le secret MAÎTRE — creer-utilisateur n'est
# autorisé qu'avec lui. Exemple avant de lancer ce script :
#   export FF_DATA_URL="https://ff-data.alain-delree.workers.dev"
#   FF_DATA_SECRET="colle-ici-la-valeur-maitre-de-bitwarden"
#   export FF_DATA_SECRET
#
# DEUX SECRETS, NE PAS CONFONDRE :
#   - FF_DATA_SECRET          : MAÎTRE. Autorise creer-utilisateur + DELETE +
#                               PUT (y compris auth/). Ne finit JAMAIS dans un
#                               navigateur. C'est lui qu'exige ce script pour
#                               s'authentifier auprès du worker.
#   - FF_DATA_SECRET_ECRITURE : ÉCRITURE. Autorise seulement le PUT de données
#                               (hors auth/). C'est la valeur qu'on remet à un
#                               compte (prompt « Secret d'écriture »), renvoyée
#                               au navigateur au login. Voir data-worker/README.md.
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ACTION="${1:-}"
NOM="${2:-}"

if [[ -z "$ACTION" || -z "$NOM" ]]; then
  echo "Usage : $0 creer <nom>"
  echo "        $0 supprimer <nom>"
  exit 1
fi

if [[ -z "${FF_DATA_URL:-}" || -z "${FF_DATA_SECRET:-}" ]]; then
  echo "Erreur : définis FF_DATA_URL et FF_DATA_SECRET dans l'environnement avant de lancer ce script."
  echo "Voir l'en-tête de ce fichier pour l'exemple."
  exit 1
fi

if [[ "$ACTION" == "supprimer" ]]; then
  echo "Suppression du compte « $NOM »..."
  curl -s -X DELETE "${FF_DATA_URL}/api/auth/utilisateurs/${NOM}" \
    -H "Authorization: Bearer ${FF_DATA_SECRET}"
  echo
  exit 0
fi

if [[ "$ACTION" != "creer" ]]; then
  echo "Action inconnue : $ACTION (attendu : creer | supprimer)"
  exit 1
fi

echo "Création/mise à jour du compte « $NOM »"
echo "(le mot de passe et le token ne s'afficheront pas à l'écran)"
echo

# Le mot de passe doit faire au moins 12 caractères : en deçà, le PBKDF2
# du worker ne protège plus grand-chose. On redemande la saisie plutôt que
# de sortir en erreur.
while true; do
  read -r -s -p "Mot de passe pour $NOM (6 caractères minimum) : " MOT_DE_PASSE
  echo
  if [[ "${#MOT_DE_PASSE}" -lt 6 ]]; then
    echo "  → trop court (${#MOT_DE_PASSE} caractère(s)), il en faut au moins 6. Recommence."
    continue
  fi
  break
done
read -r -s -p "Token GitHub pour $NOM (celui qu'il/elle utilisera) : " TOKEN
echo

# Secret d'ÉCRITURE (FF_DATA_SECRET_ECRITURE) — celui qui sera renvoyé au
# navigateur au login et stocké dans localStorage. NE PAS confondre avec
# FF_DATA_SECRET (le secret MAÎTRE, qui autorise création de compte + DELETE
# et ne doit JAMAIS finir dans un navigateur). On pose ici la valeur du
# secret d'écriture pour que Fred puisse écrire ses salles ; une fuite de
# cette valeur ne permet QUE d'écraser des données (récupérables via
# l'archive Git), pas de créer un compte ni de lire les tokens.
SECRET_ECRITURE_COMPTE=""
if [[ "$NOM" == "ferette" || "$NOM" == "fred" ]]; then
  echo "Secret d'ÉCRITURE à remettre à ce compte (= FF_DATA_SECRET_ECRITURE,"
  echo "PAS le secret maître FF_DATA_SECRET). Il sera renvoyé au navigateur au"
  echo "login. Enter pour ne pas en poser."
  read -r -s -p "Secret d'écriture pour $NOM : " SECRET_ECRITURE_COMPTE
  echo
fi

# Construit le corps JSON via python3 pour échapper correctement
# (évite tout souci de guillemets/caractères spéciaux dans le mot de passe).
CORPS=$(python3 - "$NOM" "$MOT_DE_PASSE" "$TOKEN" "$SECRET_ECRITURE_COMPTE" << 'EOF'
import json, sys
# ff_secret transporte le secret d'ÉCRITURE (renvoyé au navigateur au login).
nom, mdp, token, ff_secret = sys.argv[1:5]
d = {"nom": nom, "mot_de_passe": mdp, "token": token}
if ff_secret:
    d["ff_secret"] = ff_secret
print(json.dumps(d))
EOF
)

REPONSE=$(curl -s -X POST "${FF_DATA_URL}/api/auth/creer-utilisateur" \
  -H "Authorization: Bearer ${FF_DATA_SECRET}" \
  -H "Content-Type: application/json" \
  -d "$CORPS")

echo "Réponse du worker : $REPONSE"

# Nettoyage des variables sensibles de ce shell
unset MOT_DE_PASSE TOKEN SECRET_ECRITURE_COMPTE CORPS
