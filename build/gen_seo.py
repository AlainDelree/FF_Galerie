#!/usr/bin/env python3
"""
gen_seo.py — Contenu SEO statique baké pour les crawlers (dont IA, sans JS)
===========================================================================
Usage :  python3 build/gen_seo.py [--dry-run]

Source de vérité = data/artistes.json (+ build/pages.json pour Frédérique).
Pour CHAQUE artiste indexable :
  • <page>/index.html   : JSON-LD Person       entre <!-- JSONLD:BEGIN/END -->
  • <page>/galerie.html : JSON-LD ItemList de  entre <!-- JSONLD:BEGIN/END -->
                          VisualArtwork (1/œuvre visible)
  • <page>/galerie.html : bloc <noscript> listant chaque œuvre (img+alt, titre,
                          dimensions, description) entre <!-- TOILES-SEO:BEGIN/END -->

Portée :
  • Frédérique (racine)  : TOUJOURS indexée (index.html + galerie.html).
  • Invité non-draft     : indexé sous artistes/<id>/ (Person + ItemList + noscript).
  • Invité draft         : ses marqueurs sont VIDÉS (réconciliation idempotente —
                           on efface tout résidu d'une publication précédente).
  • Invité supprimé      : ses fichiers n'existent plus -> ignoré (zéro résidu).

=> Tout le cycle de vie (publier / repasser en draft / supprimer) se résout par
   une simple ré-exécution : aucun code de nettoyage SEO bespoke ailleurs.

Identité schema.org d'un invité : dérivée de data/artistes.json (nom, type, genre),
enrichissable via un fichier optionnel artistes/<id>/data/seo.json (mêmes clés que
le bloc _artiste de pages.json : givenName, familyName, birthDate, birthPlace…).

Crawlers IA (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot…) ne rendent pas le
JS ; ce contenu injecté depuis le JSON leur est sinon invisible. On le bake.

Script frère de propagate_head.py / gen_sitemap.py. À relancer quand les œuvres ou
le statut d'un artiste changent. Lancé automatiquement par .github/workflows/seo.yml.
"""

import os, sys, json, re, html

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
PAGES_CFG  = os.path.join(SCRIPT_DIR, 'pages.json')
ARTISTES   = os.path.join(REPO_ROOT, 'data', 'artistes.json')

DRY_RUN = '--dry-run' in sys.argv

pages_cfg = json.load(open(PAGES_CFG, encoding='utf-8'))
base_url  = pages_cfg['_base_url']

# Vocabulaire par type d'œuvre
MOTS = {
    'peinture':  {'sing': 'peinture',  'plur': 'peintures',  'artform': 'Peinture',
                  'jobF': 'Artiste peintre', 'jobM': 'Artiste peintre'},
    'sculpture': {'sing': 'sculpture', 'plur': 'sculptures', 'artform': 'Sculpture',
                  'jobF': 'Sculptrice',  'jobM': 'Sculpteur'},
}
def mots(t): return MOTS.get(t, {'sing': 'œuvre', 'plur': 'œuvres', 'artform': 'Œuvre',
                                 'jobF': 'Artiste', 'jobM': 'Artiste'})


# ── Helpers d'injection ──────────────────────────────────────────────────────

def sans_vides(d):
    return {k: v for k, v in d.items() if v not in (None, '')}

def script_jsonld(obj):
    payload = json.dumps(obj, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + payload + '\n  </script>'

def injecter(rel, begin, end, payload):
    """Remplace le contenu entre begin/end dans le fichier rel. payload='' => vide."""
    path = os.path.join(REPO_ROOT, rel)
    if not os.path.exists(path):
        return rel, 'absent'
    content = open(path, encoding='utf-8').read()
    if begin not in content or end not in content:
        return rel, 'MARQUEURS MANQUANTS'
    bloc = (begin + '\n  ' + end) if payload == '' else (begin + '\n  ' + payload + '\n  ' + end)
    nouveau = re.sub(re.escape(begin) + r'.*?' + re.escape(end),
                     lambda _m: bloc, content, flags=re.DOTALL)
    if nouveau == content:
        return rel, 'inchangé'
    if not DRY_RUN:
        open(path, 'w', encoding='utf-8').write(nouveau)
    return rel, 'MÀJOUR'


# ── Construction des payloads pour un artiste ────────────────────────────────

def person_jsonld(meta):
    return script_jsonld(sans_vides({
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': meta['id'],
        'name': meta['name'],
        'givenName': meta.get('givenName'),
        'familyName': meta.get('familyName'),
        'jobTitle': meta.get('jobTitle'),
        'description': meta.get('description'),
        'nationality': meta.get('nationality'),
        'birthDate': meta.get('birthDate'),
        'birthPlace': {'@type': 'Place', 'name': meta['birthPlace']} if meta.get('birthPlace') else None,
        'url': meta.get('url'),
        'image': meta.get('image'),
    }))

def abs_url(prefix, photo):
    """N'ajoute le prefixe que si l'URL est relative (laisse les URL absolues intactes)."""
    if photo.startswith(('http://', 'https://', '//')):
        return photo
    return prefix + photo

def artwork(t, meta, w, url_prefix):
    dims = t.get('dimensions') or {}
    art = sans_vides({
        '@type': 'VisualArtwork',
        'name': t.get('titre'),
        'image': abs_url(url_prefix, t['photo']) if t.get('photo') else None,
        'creator': {'@id': meta['id'], '@type': 'Person', 'name': meta['name']},
        'artform': w['artform'],
        'description': t.get('description') or None,
        'dateCreated': t.get('date') or None,
        'url': url_prefix + 'galerie.html',
    })
    if dims.get('largeur'):
        art['width'] = {'@type': 'QuantitativeValue', 'value': dims['largeur'], 'unitCode': 'CMT'}
    if dims.get('hauteur'):
        art['height'] = {'@type': 'QuantitativeValue', 'value': dims['hauteur'], 'unitCode': 'CMT'}
    return art

def itemlist_jsonld(toiles, meta, w, url_prefix):
    return script_jsonld({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Galerie — ' + meta['name'],
        'numberOfItems': len(toiles),
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'item': artwork(t, meta, w, url_prefix)}
            for i, t in enumerate(toiles)
        ],
    })

def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)

def noscript_bloc(toiles, meta, w):
    name = meta['name']
    lignes = [
        '<noscript>',
        '    <section class="seo-toiles" aria-label="Œuvres de ' + esc(name) + '">',
        '      <h2>Galerie de ' + esc(name) + ' — ' + w['plur'] + '</h2>',
        '      <ul>',
    ]
    for t in toiles:
        titre = esc(t.get('titre') or 'Sans titre')
        alt   = esc((t.get('titre') or 'Œuvre') + ' — ' + w['sing'] + ' de ' + name)
        photo = esc(t.get('photo') or '')
        dims  = t.get('dimensions') or {}
        li = '        <li><img src="' + photo + '" alt="' + alt + '" loading="lazy"><h3>' + titre + '</h3>'
        if dims.get('largeur') and dims.get('hauteur'):
            li += '<p>' + esc(dims['largeur']) + ' &times; ' + esc(dims['hauteur']) + ' cm</p>'
        if t.get('description'):
            li += '<p>' + esc(t['description']) + '</p>'
        li += '</li>'
        lignes.append(li)
    lignes += ['      </ul>', '    </section>', '  </noscript>']
    return '\n'.join(lignes)


# ── Lecture des œuvres visibles d'un artiste ─────────────────────────────────

def lire_toiles(oeuvres_rel):
    path = os.path.join(REPO_ROOT, oeuvres_rel)
    if not os.path.exists(path):
        return []
    data = json.load(open(path, encoding='utf-8'))
    items = data.get('toiles') or data.get('pieces') or []
    return [t for t in items if t.get('visible', True)]


# ── Cibles : Frédérique (racine) + invités (artistes.json) ───────────────────

def cible_frederique():
    a = pages_cfg['_artiste']
    return {
        'label': 'Frédérique (racine)',
        'index': 'index.html',
        'galerie': 'galerie.html',
        'oeuvres': os.path.join('data', 'oeuvres', 'peinture.json'),
        'type': 'peinture',
        'url_prefix': base_url,
        'draft': False,
        'meta': dict(a),  # déjà riche
    }

def cible_invite(a):
    """a = entrée de data/artistes.json."""
    lien = a['lien'].rstrip('/') + '/'          # ex: "artistes/daw/"
    typ  = a.get('type', 'peinture')
    w    = mots(typ)
    genre = a.get('genre', 'f')
    job  = w['jobM'] if genre == 'm' else w['jobF']
    url_prefix = base_url + lien
    meta = {
        'id': url_prefix + '#' + a['id'],
        'name': a['nom'],
        'jobTitle': job,
        'description': job + '. ' + w['plur'].capitalize() + '.',
        'url': url_prefix,
    }
    # Enrichissement optionnel : artistes/<id>/data/seo.json
    seo_path = os.path.join(REPO_ROOT, lien, 'data', 'seo.json')
    if os.path.exists(seo_path):
        try:
            meta.update({k: v for k, v in json.load(open(seo_path, encoding='utf-8')).items()
                         if v not in (None, '')})
        except Exception as e:
            print('  ! seo.json illisible pour ' + a['id'] + ' : ' + str(e))
    return {
        'label': a['nom'] + ('  [draft]' if a.get('draft') else ''),
        'index': lien + 'index.html',
        'galerie': lien + 'galerie.html',
        'oeuvres': lien + 'data/oeuvres/' + typ + '.json',
        'type': typ,
        'url_prefix': url_prefix,
        'draft': bool(a.get('draft')),
        'meta': meta,
    }

cibles = [cible_frederique()]
if os.path.exists(ARTISTES):
    for a in json.load(open(ARTISTES, encoding='utf-8')):
        cibles.append(cible_invite(a))


# ── Traitement ───────────────────────────────────────────────────────────────

resultats = []
for c in cibles:
    w = mots(c['type'])
    if c['draft']:
        # Réconciliation : on VIDE les marqueurs (efface tout résidu d'une publication passée)
        resultats.append((c['label'], *injecter(c['index'],   '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     '')))
        resultats.append((c['label'], *injecter(c['galerie'], '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     '')))
        resultats.append((c['label'], *injecter(c['galerie'], '<!-- TOILES-SEO:BEGIN -->', '<!-- TOILES-SEO:END -->', '')))
        continue
    toiles = lire_toiles(c['oeuvres'])
    meta   = c['meta']
    if meta.get('image') is None and toiles and toiles[0].get('photo'):
        meta = dict(meta); meta['image'] = abs_url(c['url_prefix'], toiles[0]['photo'])
    resultats.append((c['label'], *injecter(c['index'],   '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     person_jsonld(meta))))
    resultats.append((c['label'], *injecter(c['galerie'], '<!-- JSONLD:BEGIN -->',     '<!-- JSONLD:END -->',     itemlist_jsonld(toiles, meta, w, c['url_prefix']))))
    resultats.append((c['label'], *injecter(c['galerie'], '<!-- TOILES-SEO:BEGIN -->', '<!-- TOILES-SEO:END -->', noscript_bloc(toiles, meta, w))))


# ── Rapport ──────────────────────────────────────────────────────────────────

print('\n' + ('[DRY-RUN] ' if DRY_RUN else '') + 'SEO statique')
print('─' * 60)
for label, rel, etat in resultats:
    print('  {:20s} {:18s} : {}'.format(label[:20], etat, rel))
print('─' * 60)
manquants = [r for _l, r, e in resultats if e == 'MARQUEURS MANQUANTS']
if manquants:
    print('  ✗ Marqueurs manquants — ajouter les <!-- ...:BEGIN/END --> dans :', ', '.join(sorted(set(manquants))))
    sys.exit(1)
