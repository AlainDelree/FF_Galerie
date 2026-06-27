#!/usr/bin/env python3
"""
gen_sitemap.py — Génère sitemap.xml depuis build/pages.json
===========================================================
Usage :  python3 build/gen_sitemap.py [--dry-run]

Lit build/pages.json et écrit /sitemap.xml à la racine.
N'inclut QUE les pages indexables (robots ne contient pas "noindex").
lastmod = date du dernier commit Git touchant le fichier de la page
(fallback : date du jour si Git indisponible).

Script frère de propagate_head.py — à relancer quand on ajoute/retire une page
ou qu'on change un canonical. Workflow : éditer pages.json → lancer ce script →
git add sitemap.xml + commit.
"""

import os, sys, json, datetime, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
CONFIG     = os.path.join(SCRIPT_DIR, 'pages.json')
OUT        = os.path.join(REPO_ROOT, 'sitemap.xml')

DRY_RUN = '--dry-run' in sys.argv
TODAY   = datetime.date.today().isoformat()

config = json.load(open(CONFIG, encoding='utf-8'))


def git_lastmod(relpath):
    """Date (YYYY-MM-DD) du dernier commit touchant relpath ; fallback = aujourd'hui."""
    try:
        out = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', relpath],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL
        ).decode('utf-8').strip()
        return out or TODAY
    except Exception:
        return TODAY


def priority(loc):
    """Page d'accueil = 1.0, autres = 0.8."""
    return '1.0' if loc.rstrip('/').endswith('frederiqueferette.be') else '0.8'


entries = []
ignorees = []
for page in config['pages']:
    robots = str(page.get('robots', 'index, follow')).lower()
    if 'noindex' in robots:
        ignorees.append(page['file'])
        continue
    loc     = page['canonical']
    lastmod = git_lastmod(page['file'])
    entries.append((loc, lastmod, priority(loc)))

lignes = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
]
for loc, lastmod, prio in entries:
    lignes += [
        '  <url>',
        f'    <loc>{loc}</loc>',
        f'    <lastmod>{lastmod}</lastmod>',
        '    <changefreq>monthly</changefreq>',
        f'    <priority>{prio}</priority>',
        '  </url>',
    ]
lignes.append('</urlset>')
sitemap = '\n'.join(lignes) + '\n'

if DRY_RUN:
    print(sitemap)
else:
    open(OUT, 'w', encoding='utf-8').write(sitemap)

print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}sitemap.xml — {len(entries)} URL(s) indexable(s)"
      f"{' -> ' + OUT if not DRY_RUN else ''}")
for loc, lastmod, prio in entries:
    print(f"  ✓ {loc}  (lastmod {lastmod}, prio {prio})")
for f in ignorees:
    print(f"  · ignorée (noindex) : {f}")
