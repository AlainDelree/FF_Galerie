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
# au curl). Exemple avant de lancer ce script :
#   export FF_DATA_URL="https://ff-data.alain-delree.workers.dev"
#   FF_DATA_SECRET="colle-ici-la-valeur-de-bitwarden"
#   export FF_DATA_SECRET
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
  read -r -s -p "Mot de passe pour $NOM (12 caractères minimum) : " MOT_DE_PASSE
  echo
  if [[ "${#MOT_DE_PASSE}" -lt 12 ]]; then
    echo "  → trop court (${#MOT_DE_PASSE} caractère(s)), il en faut au moins 12. Recommence."
    continue
  fi
  break
done
read -r -s -p "Token GitHub pour $NOM (celui qu'il/elle utilisera) : " TOKEN
echo

FF_SECRET_UTILISATEUR=""
if [[ "$NOM" == "ferette" || "$NOM" == "fred" ]]; then
  read -r -s -p "Clé ff-data (Enter pour ne pas en poser) : " FF_SECRET_UTILISATEUR
  echo
fi

# Construit le corps JSON via python3 pour échapper correctement
# (évite tout souci de guillemets/caractères spéciaux dans le mot de passe).
CORPS=$(python3 - "$NOM" "$MOT_DE_PASSE" "$TOKEN" "$FF_SECRET_UTILISATEUR" << 'EOF'
import json, sys
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
unset MOT_DE_PASSE TOKEN FF_SECRET_UTILISATEUR CORPS
