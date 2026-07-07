#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# merge-code-to-main.sh — Merge SÛR de dev -> main : ne fait passer QUE le code.
#
# Les DONNÉES de prod (main) restent intactes quoi qu'il arrive : ce script ne
# récupère jamais les fichiers de données/contenu depuis dev. La divergence des
# données entre dev et main devient donc sans danger — un merge ne peut pas
# écraser le contenu de Fred/Dinso en prod.
#
# Usage :
#   bash tools/merge-code-to-main.sh          # prépare (stage) le merge, à revoir
#   bash tools/merge-code-to-main.sh --list   # liste seulement (dry-run)
#
# Après exécution : vérifier `git status`, `node --check` sur les JS, puis
# committer et pousser manuellement (confirmation humaine obligatoire).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DRY=0; [ "${1:-}" = "--list" ] && DRY=1

# Un chemin est-il une DONNÉE (à ne JAMAIS ramener depuis dev) ?
est_donnee() {
  case "$1" in
    data/*)                   return 0 ;;  # données de Fred (galerie principale)
    */data/*)                 return 0 ;;  # artistes/<id>/data/...
    */assets/images/*)        return 0 ;;  # images invités
    */assets/models/*)        return 0 ;;  # glb invités
    assets/images/toiles/*)   return 0 ;;  # images de Fred
    assets/models/*)          return 0 ;;  # glb de Fred
    *) return 1 ;;
  esac
}

git fetch origin -q
git checkout main -q
git pull --no-edit -q >/dev/null 2>&1 || true

CHANGED="$(git diff --name-only origin/main...origin/dev)"
[ -z "$CHANGED" ] && { echo "Aucune différence dev/main. Rien à faire."; exit 0; }

CODE=(); DATA=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if est_donnee "$f"; then DATA+=("$f"); else CODE+=("$f"); fi
done <<< "$CHANGED"

echo "── CODE (sera ramené sur main) ──"
if [ ${#CODE[@]} -eq 0 ]; then echo "  (aucun)"; else printf '  %s\n' "${CODE[@]}"; fi
echo "── DONNÉES (laissées telles quelles sur main — PROD PRÉSERVÉE) ──"
if [ ${#DATA[@]} -eq 0 ]; then echo "  (aucune)"; else printf '  %s\n' "${DATA[@]}"; fi

[ "$DRY" = "1" ] && { echo; echo "(dry-run : rien de modifié)"; exit 0; }
[ ${#CODE[@]} -eq 0 ] && { echo; echo "Rien de code à merger."; exit 0; }

git checkout origin/dev -- "${CODE[@]}"
echo
echo "✓ Fichiers de code récupérés depuis dev et stagés sur main."
echo "  → Vérifie (git status, node --check sur les JS), puis commit + push manuellement."
