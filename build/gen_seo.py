#!/usr/bin/env python3
"""
gen_seo.py — Contenu SEO statique baké pour les crawlers (dont IA, sans JS)
===========================================================================
Usage :  python3 build/gen_seo.py [--dry-run]

Lit build/pages.json (_artiste, _base_url) et data/oeuvres/peinture.json, puis :
  • index.html   : JSON-LD Person (Frédérique Ferette) entre <!-- JSONLD:BEGIN/END -->
  • galerie.html : JSON-LD ItemList de VisualArtwork (1 par toile visible)
                   entre <!-- JSONLD:BEGIN/END -->
  • galerie.html : bloc <noscript> listant chaque toile (img+alt, titre, dimensions,
                   description) entre <!-- TOILES-SEO:BEGIN/END --> — invisible aux
                   visiteurs (JS actif = galerie normale), lisible aux crawlers.

Pourquoi : les crawlers IA (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot…) ne
rendent pas le JS ; tout le contenu injecté depuis le JSON leur est invisible.
Ce script bake ce contenu en statique.

Script frère de propagate_head.py / gen_sitemap.py — à relancer quand les toiles
changent (ajout, titre, description, dimensions). Workflow : lancer → git add les
HTML modifiés → commit.
"""

import os, sys, json, re, html

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
CONFIG     = os.path.join(SCRIPT_DIR, 'pages.json')
PEINTURE   = os.path.join(REPO_ROOT, 'data', 'oeuvres', 'peinture.json')

DRY_RUN = '--dry-run' in sys.argv

config   = json.load(open(CONFIG, encoding='utf-8'))
artiste  = config['_artiste']
base_url = config['_base_url']
toiles   = [t for t in json.load(open(PEINTURE, encoding='utf-8'))['toiles']
            if t.get('visible', True)]


# ── Helpers ──────────────────────────────────────────────────────────────────

def sans_vides(d):
    """Retire les clés à valeur None/'' (garde 0 et False)."""
    return {k: v for k, v in d.items() if v not in (None, '')}


def script_jsonld(obj):
    payload = json.dumps(obj, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + payload + '\n  </script>'


def injecter(rel, begin, end, payload, indent_end='  '):
    """Remplace le contenu entre les marqueurs begin/end dans le fichier rel."""
    path = os.path.join(REPO_ROOT, rel)
    content = open(path, encoding='utf-8').read()
    if begin not in content or end not in content:
        return rel, 'MARQUEURS MANQUANTS'
    bloc = begin + '\n  ' + payload + '\n' + indent_end + end
    nouveau = re.sub(re.escape(begin) + r'.*?' + re.escape(end),
                     lambda _m: bloc, content, flags=re.DOTALL)
    if nouveau == content:
        return rel, 'inchangé'
    if not DRY_RUN:
        open(path, 'w', encoding='utf-8').write(nouveau)
    return rel, 'MÀJOUR'


# ── 1. Person (index.html) ───────────────────────────────────────────────────

person = sans_vides({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': artiste['id'],
    'name': artiste['name'],
    'givenName': artiste.get('givenName'),
    'familyName': artiste.get('familyName'),
    'jobTitle': artiste.get('jobTitle'),
    'description': artiste.get('description'),
    'nationality': artiste.get('nationality'),
    'birthDate': artiste.get('birthDate'),
    'birthPlace': {'@type': 'Place', 'name': artiste['birthPlace']} if artiste.get('birthPlace') else None,
    'url': artiste.get('url'),
    'image': artiste.get('image'),
})


# ── 2. ItemList de VisualArtwork (galerie.html) ──────────────────────────────

def artwork(t):
    dims = t.get('dimensions') or {}
    art = sans_vides({
        '@type': 'VisualArtwork',
        'name': t.get('titre'),
        'image': base_url + t['photo'] if t.get('photo') else None,
        'creator': {'@id': artiste['id'], '@type': 'Person', 'name': artiste['name']},
        'artform': 'Peinture',
        'description': t.get('description') or None,
        'dateCreated': t.get('date') or None,
        'url': base_url + 'galerie.html',
    })
    if dims.get('largeur'):
        art['width'] = {'@type': 'QuantitativeValue', 'value': dims['largeur'], 'unitCode': 'CMT'}
    if dims.get('hauteur'):
        art['height'] = {'@type': 'QuantitativeValue', 'value': dims['hauteur'], 'unitCode': 'CMT'}
    return art

itemlist = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Galerie — Frédérique Ferette',
    'numberOfItems': len(toiles),
    'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'item': artwork(t)}
        for i, t in enumerate(toiles)
    ],
}


# ── 3. Bloc <noscript> des toiles (galerie.html) ─────────────────────────────

def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)

lignes = [
    '<noscript>',
    '    <section class="seo-toiles" aria-label="Œuvres de Frédérique Ferette">',
    '      <h2>Galerie de Frédérique Ferette — peintures</h2>',
    '      <ul>',
]
for t in toiles:
    titre = esc(t.get('titre') or 'Sans titre')
    alt   = esc((t.get('titre') or 'Œuvre') + ' — peinture de Frédérique Ferette')
    photo = esc(t.get('photo') or '')
    dims  = t.get('dimensions') or {}
    li = f'        <li><img src="{photo}" alt="{alt}" loading="lazy"><h3>{titre}</h3>'
    if dims.get('largeur') and dims.get('hauteur'):
        li += f'<p>{esc(dims["largeur"])} &times; {esc(dims["hauteur"])} cm</p>'
    if t.get('description'):
        li += f'<p>{esc(t["description"])}</p>'
    li += '</li>'
    lignes.append(li)
lignes += ['      </ul>', '    </section>', '  </noscript>']
noscript_bloc = '\n'.join(lignes)


# ── Injection ────────────────────────────────────────────────────────────────

resultats = [
    injecter('index.html',   '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     script_jsonld(person)),
    injecter('galerie.html', '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     script_jsonld(itemlist)),
    injecter('galerie.html', '<!-- TOILES-SEO:BEGIN -->', '<!-- TOILES-SEO:END -->', noscript_bloc),
]

print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}SEO statique — {len(toiles)} toile(s) visible(s)")
print('─' * 52)
for rel, etat in resultats:
    print(f"  {etat:18s} : {rel}")
print('─' * 52)
manquants = [r for r, e in resultats if e == 'MARQUEURS MANQUANTS']
if manquants:
    print('  ✗ Marqueurs manquants — ajouter les <!-- ...:BEGIN/END --> dans :', ', '.join(manquants))
    sys.exit(1)
