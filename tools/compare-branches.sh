#!/usr/bin/env bash
# =============================================================
# compare-branches.sh — compare deux branches FF_Galerie
# en CATÉGORISANT les écarts : code / données / médias.
# Détecte aussi les artistes fantômes (dossier sans entrée
# dans data/artistes.json, et inversement).
#
# Usage : ./tools/compare-branches.sh [base] [cible]
#   défaut : base=main  cible=dev
#   ex.    : ./tools/compare-branches.sh main dev
# Lecture seule — ne modifie aucune branche.
# =============================================================
set -euo pipefail

BASE="${1:-main}"
CIBLE="${2:-dev}"

# Vérifie que les deux branches existent
for b in "$BASE" "$CIBLE"; do
  git rev-parse --verify "$b" >/dev/null 2>&1 || { echo "Branche introuvable : $b"; exit 1; }
done

echo "═══════════════════════════════════════════════════════"
echo "  COMPARAISON  $BASE  ⟷  $CIBLE"
echo "═══════════════════════════════════════════════════════"
echo "Commits sur $CIBLE absents de $BASE : $(git rev-list --count "$BASE..$CIBLE")"
echo "Commits sur $BASE absents de $CIBLE : $(git rev-list --count "$CIBLE..$BASE")"
echo

# Liste brute des fichiers qui diffèrent entre les deux branches
DIFF=$(git diff --name-only "$BASE" "$CIBLE")

# Catégorise un sous-ensemble selon un motif grep -E
cat_section () {
  local titre="$1" motif="$2"
  local lignes
  lignes=$(echo "$DIFF" | grep -E "$motif" || true)
  echo "── $titre ──"
  if [ -z "$lignes" ]; then
    echo "  (aucun écart)"
  else
    echo "$lignes" | sed 's/^/  /'
  fi
  echo
}

# CODE : js, css, html (hors data), templates, build, workflows
cat_section "CODE (js / css / html / templates / build / ci)" \
  '\.(js|css)$|\.html$|^build/|^templates/|^\.github/'

# DONNÉES : tous les .json sous data/ ou artistes/*/data/
cat_section "DONNÉES (json contenu — toiles/salles/infos/contact/artistes)" \
  '(^|/)data/.*\.json$'

# MÉDIAS : images, musique, modèles 3D
cat_section "MÉDIAS (images / musique / modèles GLB)" \
  '\.(jpg|jpeg|png|webp|svg|mp3|glb)$'

# DOCS
cat_section "DOCS (markdown / pdf)" \
  '\.(md|pdf)$'

# ----- Cohérence artistes : dossier vs déclaration JSON -----
echo "── COHÉRENCE ARTISTES (fantômes) ──"
for B in "$BASE" "$CIBLE"; do
  echo "  [$B]"
  # dossiers présents sous artistes/
  DOSSIERS=$(git ls-tree -d --name-only "$B" artistes/ 2>/dev/null | sed 's#artistes/##' | sort || true)
  # ids déclarés dans data/artistes.json
  DECLARES=$(git show "$B:data/artistes.json" 2>/dev/null | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    arr=d if isinstance(d,list) else d.get('artistes',[])
    print('\n'.join(sorted(a.get('id','') for a in arr)))
except Exception:
    pass
" | sort || true)

  FANTOMES=$(comm -23 <(echo "$DOSSIERS") <(echo "$DECLARES") || true)
  ORPHELINS=$(comm -13 <(echo "$DOSSIERS") <(echo "$DECLARES") || true)

  if [ -n "$FANTOMES" ]; then
    echo "    ⚠ Dossiers SANS entrée JSON (fantômes à nettoyer) :"
    echo "$FANTOMES" | sed 's/^/        /'
  else
    echo "    ✓ aucun dossier fantôme"
  fi
  if [ -n "$ORPHELINS" ]; then
    echo "    ⚠ Déclarés en JSON SANS dossier :"
    echo "$ORPHELINS" | sed 's/^/        /'
  fi
done
echo
echo "═══════════════════════════════════════════════════════"
echo "Astuce : détail d'un fichier →  git diff $BASE $CIBLE -- <chemin>"
