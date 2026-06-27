#!/usr/bin/env python3
"""
gen_sitemap.py — Génère sitemap.xml ET robots.txt depuis pages.json + artistes.json
====================================================================================
Usage :  python3 build/gen_sitemap.py [--dry-run]

Écrit /sitemap.xml et /robots.txt à la racine.

sitemap.xml :
  • Pages de Frédérique (pages.json) — sauf celles en "noindex".
  • Pages publiques de chaque invité NON-DRAFT (artistes.json) :
    index.html, galerie.html, infos.html, contact.html.
  lastmod = date du dernier commit Git touchant le fichier (fallback : aujourd'hui).

robots.txt :
  • Crawl ouvert (IA comprises : elles ne rendent pas le JS, le statique baké est
    leur seule source).
  • Disallow /admin.html et Disallow /artistes/ (bloque les invités en brouillon).
  • Allow /artistes/<id>/ pour chaque invité NON-DRAFT (Allow plus spécifique que
    Disallow -> l'invité publié redevient crawlable, les autres restent bloqués).

=> Publier / repasser en draft / supprimer un invité se résout par une simple
   ré-exécution : artistes.json est l'unique source de vérité.

Script frère de propagate_head.py / gen_seo.py. Lancé par .github/workflows/seo.yml.
"""

import os, sys, json, datetime, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
CONFIG     = os.path.join(SCRIPT_DIR, 'pages.json')
ARTISTES   = os.path.join(REPO_ROOT, 'data', 'artistes.json')
OUT_SITEMAP = os.path.join(REPO_ROOT, 'sitemap.xml')
OUT_ROBOTS  = os.path.join(REPO_ROOT, 'robots.txt')

DRY_RUN = '--dry-run' in sys.argv
TODAY   = datetime.date.today().isoformat()

config   = json.load(open(CONFIG, encoding='utf-8'))
base_url = config['_base_url'].rstrip('/') + '/'
invites  = json.load(open(ARTISTES, encoding='utf-8')) if os.path.exists(ARTISTES) else []
publies  = [a for a in invites if not a.get('draft')]

PAGES_INVITE = ['index.html', 'galerie.html', 'infos.html', 'contact.html']


def git_lastmod(relpath):
    try:
        out = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', relpath],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL
        ).decode('utf-8').strip()
        return out or TODAY
    except Exception:
        return TODAY


def priority(loc):
    return '1.0' if loc.rstrip('/').endswith('frederiqueferette.be') else '0.8'


# ── sitemap : Frédérique ──────────────────────────────────────────────────────
entries  = []
ignorees = []
for page in config['pages']:
    robots = str(page.get('robots', 'index, follow')).lower()
    if 'noindex' in robots:
        ignorees.append(page['file'])
        continue
    entries.append((page['canonical'], git_lastmod(page['file']), priority(page['canonical'])))

# ── sitemap : invités publiés ─────────────────────────────────────────────────
for a in publies:
    lien = a['lien'].rstrip('/') + '/'
    for page in PAGES_INVITE:
        rel = lien + page
        if os.path.exists(os.path.join(REPO_ROOT, rel)):
            loc = base_url + rel
            entries.append((loc, git_lastmod(rel), '0.7'))

lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, lastmod, prio in entries:
    lignes += ['  <url>', f'    <loc>{loc}</loc>', f'    <lastmod>{lastmod}</lastmod>',
               '    <changefreq>monthly</changefreq>', f'    <priority>{prio}</priority>', '  </url>']
lignes.append('</urlset>')
sitemap = '\n'.join(lignes) + '\n'


# ── robots.txt ────────────────────────────────────────────────────────────────
allow_invites = ''.join(
    f"Allow: /{a['lien'].rstrip('/')}/\n" for a in publies
)
robots = (
    "# frederiqueferette.be — robots.txt (généré par build/gen_sitemap.py)\n"
    "# Crawl ouvert (IA comprises : GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot…),\n"
    "# car elles ne rendent pas le JS : le statique baké (meta, JSON-LD, alt) est\n"
    "# leur seule source.\n\n"
    "User-agent: *\n"
    "Allow: /\n"
    "Disallow: /admin.html\n"
    "# Invités encore en brouillon (draft + noindex). Un Allow plus spécifique\n"
    "# ci-dessous ré-ouvre chaque invité publié.\n"
    "Disallow: /artistes/\n"
    + (allow_invites if allow_invites else "")
    + "\nSitemap: " + base_url + "sitemap.xml\n"
)


# ── Écriture + rapport ────────────────────────────────────────────────────────
if not DRY_RUN:
    open(OUT_SITEMAP, 'w', encoding='utf-8').write(sitemap)
    open(OUT_ROBOTS,  'w', encoding='utf-8').write(robots)

print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}sitemap.xml — {len(entries)} URL(s) indexable(s)")
for loc, lastmod, prio in entries:
    print(f"  ✓ {loc}  (lastmod {lastmod}, prio {prio})")
for f in ignorees:
    print(f"  · ignorée (noindex) : {f}")
print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}robots.txt — {len(publies)} invité(s) publié(s) ré-ouvert(s)"
      + (''.join('\n  ✓ Allow /' + a['lien'].rstrip('/') + '/' for a in publies) if publies else ' (aucun)'))
if DRY_RUN:
    print('\n----- robots.txt -----\n' + robots)
