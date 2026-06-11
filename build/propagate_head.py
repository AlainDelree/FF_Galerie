#!/usr/bin/env python3
"""
propagate_head.py — Propagation automatique du <head> commun
============================================================
Usage :  python3 build/propagate_head.py [--dry-run]

Pour chaque page listée dans build/pages.json :
  1. Génère le bloc <head> depuis build/head-template.html
  2. Remplace le contenu entre <!-- HEAD:BEGIN --> et <!-- HEAD:END -->
     dans le fichier HTML cible.

Workflow recommandé :
  1. Modifier build/head-template.html ou build/pages.json
  2. Lancer ce script
  3. git add + git commit + git push

Ajouter une nouvelle page :
  - Ajouter son entrée dans build/pages.json
  - Ajouter <!-- HEAD:BEGIN --> et <!-- HEAD:END --> dans le HTML
  - Lancer ce script
"""

import os, sys, json, re

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT   = os.path.dirname(SCRIPT_DIR)
TEMPLATE    = os.path.join(SCRIPT_DIR, 'head-template.html')
CONFIG      = os.path.join(SCRIPT_DIR, 'pages.json')

DRY_RUN = '--dry-run' in sys.argv

# ── Chargement ──────────────────────────────────────────────────────────────

template = open(TEMPLATE, encoding='utf-8').read()
config   = json.load(open(CONFIG, encoding='utf-8'))

fonts_url       = config['_fonts_url']
goatcounter_ff  = config['_goatcounter_ff']

# ── Traitement des pages ─────────────────────────────────────────────────────

def assets_base(depth):
    """Chemin relatif vers la racine selon la profondeur (0=racine, 2=artistes/xxx/)."""
    return '../' * depth

def render(page):
    depth = page.get('depth', 0)
    base  = assets_base(depth)
    html  = template
    replacements = {
        '{{ASSETS_BASE}}':    base,
        '{{FAVICON}}':        page.get('favicon', 'favicon.ico'),
        '{{TITLE}}':          page['title'],
        '{{DESCRIPTION}}':    page['description'],
        '{{ROBOTS}}':         page.get('robots', 'index, follow'),
        '{{CANONICAL}}':      page['canonical'],
        '{{OG_TITLE}}':       page.get('og_title',       page['title']),
        '{{OG_DESCRIPTION}}': page.get('og_description', page['description']),
        '{{OG_URL}}':         page.get('og_url',         page['canonical']),
        '{{OG_IMAGE}}':       page.get('og_image', ''),
        '{{TW_TITLE}}':       page.get('tw_title',       page['title']),
        '{{TW_DESCRIPTION}}': page.get('tw_description', page['description']),
        '{{TW_IMAGE}}':       page.get('tw_image', ''),
        '{{FONTS_URL}}':      fonts_url,
    }
    for k, v in replacements.items():
        html = html.replace(k, v)
    return html.rstrip()

updated = []
skipped = []
errors  = []

for page in config['pages']:
    filepath = os.path.join(REPO_ROOT, page['file'])
    if not os.path.exists(filepath):
        errors.append(f"ABSENT  : {page['file']}")
        continue

    content = open(filepath, encoding='utf-8').read()

    # Vérifie la présence des marqueurs
    if '<!-- HEAD:BEGIN -->' not in content or '<!-- HEAD:END -->' not in content:
        skipped.append(f"MARQUEURS MANQUANTS : {page['file']}")
        continue

    new_head = render(page)
    new_block = f'<!-- HEAD:BEGIN -->\n{new_head}\n    <!-- HEAD:END -->'
    new_content = re.sub(
        r'<!-- HEAD:BEGIN -->.*?<!-- HEAD:END -->',
        new_block,
        content,
        flags=re.DOTALL
    )

    if new_content == content:
        skipped.append(f"INCHANGÉ : {page['file']}")
        continue

    if not DRY_RUN:
        open(filepath, 'w', encoding='utf-8').write(new_content)
    updated.append(page['file'])

# ── Rapport ──────────────────────────────────────────────────────────────────

print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Propagation du <head> — {len(config['pages'])} pages")
print('─' * 50)
for f in updated:  print(f"  ✓ MÀJOUR  : {f}")
for f in skipped:  print(f"  · {f}")
for f in errors:   print(f"  ✗ {f}")
print('─' * 50)
print(f"  {len(updated)} mise(s) à jour{'  (simulation)' if DRY_RUN else ''}, {len(skipped)} inchangée(s), {len(errors)} erreur(s)")

if errors:
    sys.exit(1)
