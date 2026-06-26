/* ═══════════════════════════════════════════════════════════════
   admin-catalogue.js — Catalogue PDF imprimable
   Dépendances : toiles[], tailles[], ADMIN_CFG (admin.js)
   ═══════════════════════════════════════════════════════════════ */

/* ── Ouverture du panneau de sélection ── */
/* Type d'une oeuvre (peinture/sculpture) avec repli sur la config admin */
function _catTypeDe(t) {
  return (t && t._type) || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
}

function ouvrirCatalogue() {
  var overlay = document.getElementById('overlay-catalogue');
  if (!overlay) return;

  var liste = document.getElementById('cat-liste-toiles');
  liste.innerHTML = '';

  var sorted = toiles.slice().sort(function(a, b) { return a.id - b.id; });

  if (sorted.length === 0) {
    liste.innerHTML = '<p style="color:var(--muted);font-size:.8rem;text-align:center;padding:1.5rem 0;">Aucune œuvre dans le stock.</p>';
  }

  sorted.forEach(function(t) {
    var item = document.createElement('label');
    item.className = 'cat-item';
    var dims = (t.dimensions && t.dimensions.largeur && t.dimensions.hauteur)
      ? t.dimensions.largeur + '\u202f\u00d7\u202f' + t.dimensions.hauteur + '\u00a0cm'
      : '';
    var mat = (t.materiaux && t.materiaux.length) ? t.materiaux.join(', ') : '';
    var badge = t.taille
      ? '<span class="cat-badge">' + t.taille + '</span>'
      : '';
    var photo = t.photo
      ? '<img src="' + t.photo + '?v=' + Date.now() + '" class="cat-thumb" loading="lazy" onerror="this.style.opacity=0">'
      : '<div class="cat-thumb cat-thumb-ph">🖼</div>';

    item.innerHTML =
      '<input type="checkbox" class="cat-cb" data-id="' + t.id + '" data-type="' + _catTypeDe(t) + '" checked>' +
      photo +
      '<div class="cat-info">' +
        '<strong>' + (t.titre || '(sans titre)') + '</strong>' +
        '<span>' + [dims, mat].filter(Boolean).join(' — ') + '</span>' +
        badge +
      '</div>';
    liste.appendChild(item);
  });

  /* Boutons "ne selectionner que ce type" (uniquement si plusieurs types presents) */
  var _typesPresents = [];
  toiles.forEach(function(t) {
    var ty = _catTypeDe(t);
    if (_typesPresents.indexOf(ty) < 0) _typesPresents.push(ty);
  });
  var ctf = document.getElementById('cat-type-filtres');
  if (ctf) {
    ctf.innerHTML = '';
    if (_typesPresents.length > 1) {
      _typesPresents.forEach(function(ty) {
        var b = document.createElement('button');
        b.className = 'cat-ctrl-btn';
        b.textContent = (ty === 'sculpture') ? '\uD83D\uDDFF Sculptures' : '\uD83D\uDDBC Peintures';
        b.title = 'Ne selectionner que les ' + (ty === 'sculpture' ? 'sculptures' : 'peintures');
        b.addEventListener('click', function() { cocherUniquementType(ty); });
        ctf.appendChild(b);
      });
      ctf.style.display = 'flex';
    } else {
      ctf.style.display = 'none';
    }
  }

  overlay.style.display = 'flex';
}

function fermerCatalogue() {
  var overlay = document.getElementById('overlay-catalogue');
  if (overlay) overlay.style.display = 'none';
}

function cocherTousCatalogue(val) {
  document.querySelectorAll('.cat-cb').forEach(function(cb) { cb.checked = val; });
}

/* Ne coche QUE les oeuvres du type demande (decoche les autres) */
function cocherUniquementType(type) {
  document.querySelectorAll('.cat-cb').forEach(function(cb) {
    cb.checked = (cb.dataset.type === type);
  });
}

/* ── Génération du PDF ── */
function genererCatalogueSelection() {
  var checked = document.querySelectorAll('.cat-cb:checked');
  var ids = new Set();
  checked.forEach(function(cb) { ids.add(parseInt(cb.dataset.id)); });

  var selection = toiles.filter(function(t) { return ids.has(t.id); });
  selection.sort(function(a, b) { return a.id - b.id; });

  if (selection.length === 0) {
    var info = document.getElementById('cat-info');
    if (info) { info.textContent = 'Sélectionnez au moins une œuvre.'; info.style.color = 'var(--danger)'; }
    return;
  }

  fermerCatalogue();
  _ouvrirFenetreCatalogue(selection);
}

function _ouvrirFenetreCatalogue(selection) {
  var nom   = (ADMIN_CFG && ADMIN_CFG.nom) ? ADMIN_CFG.nom : 'Artiste';
  var base  = location.origin + '/';
  var mois  = new Date().toLocaleDateString('fr-BE', { year: 'numeric', month: 'long' });

  /* ── Cartes des œuvres ── */
  var cartes = selection.map(function(t) {
    var photo = t.photo ? base + t.photo : '';
    var titre = t.titre || '(sans titre)';
    var dims  = (t.dimensions && t.dimensions.largeur && t.dimensions.hauteur)
      ? t.dimensions.largeur + '\u00a0\u00d7\u00a0' + t.dimensions.hauteur + '\u00a0cm'
      : '';
    var mat   = (t.materiaux && t.materiaux.length) ? t.materiaux.join(', ') : '';
    var annee = t.date ? t.date.replace(/.*(\d{4}).*/, '$1') : '';
    var desc  = t.description || '';

    return [
      '<div class="oeuvre">',
        '<div class="oeuvre-photo">',
          photo
            ? '<img src="' + photo + '" alt="' + titre.replace(/"/g, '&quot;') + '">'
            : '<div class="oeuvre-no-photo">🖼</div>',
        '</div>',
        '<div class="oeuvre-details">',
          '<h2 class="oeuvre-titre">' + titre + '</h2>',
          annee ? '<p class="meta"><span class="meta-lbl">Année</span>' + annee + '</p>' : '',
          dims  ? '<p class="meta"><span class="meta-lbl">Dimensions</span>' + dims + '</p>' : '',
          mat   ? '<p class="meta"><span class="meta-lbl">Techniques</span>' + mat + '</p>' : '',
          desc  ? '<p class="oeuvre-desc">' + desc + '</p>' : '',
        '</div>',
      '</div>'
    ].join('');
  }).join('\n');

  /* ── HTML complet ── */
  var html = '<!DOCTYPE html>\n<html lang="fr">\n<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'<title>Catalogue \u2014 ' + nom + '</title>\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">\n' +
'<style>\n' +
'  @page { size: A4 portrait; margin: 2cm 2.5cm; }\n' +
'  * { box-sizing: border-box; margin: 0; padding: 0; }\n' +
'  body { font-family: "Lato", sans-serif; font-weight: 300; color: #1a1a1a; background: #fff; }\n' +
'\n' +
'  /* Couverture */\n' +
'  .couverture {\n' +
'    min-height: 100vh;\n' +
'    display: flex;\n' +
'    flex-direction: column;\n' +
'    justify-content: center;\n' +
'    align-items: center;\n' +
'    text-align: center;\n' +
'    padding: 4rem;\n' +
'    page-break-after: always;\n' +
'  }\n' +
'  .couv-surtit  { font-size: .7rem; letter-spacing: .5em; text-transform: uppercase; color: #999; margin-bottom: 2.5rem; }\n' +
'  .couv-nom     { font-family: "Playfair Display", serif; font-size: 3.2rem; font-weight: 400; letter-spacing: .04em; line-height: 1.15; color: #111; }\n' +
'  .couv-filet   { width: 50px; height: 2px; background: #c8a050; margin: 2rem auto; }\n' +
'  .couv-date    { font-size: .7rem; letter-spacing: .3em; text-transform: uppercase; color: #aaa; }\n' +
'  .couv-count   { margin-top: .6rem; font-size: .65rem; color: #ccc; letter-spacing: .2em; text-transform: uppercase; }\n' +
'\n' +
'  /* Œuvres */\n' +
'  .catalogue-body { padding: .5rem 0; }\n' +
'\n' +
'  .oeuvre {\n' +
'    display: grid;\n' +
'    grid-template-columns: 1fr 1fr;\n' +
'    gap: 2.5rem;\n' +
'    align-items: center;\n' +
'    padding: 2.5rem 0;\n' +
'    border-bottom: 1px solid #f0ece4;\n' +
'    page-break-inside: avoid;\n' +
'    min-height: 40vh;\n' +
'  }\n' +
'  .oeuvre:last-child { border-bottom: none; }\n' +
'\n' +
'  .oeuvre-photo {\n' +
'    display: flex;\n' +
'    align-items: center;\n' +
'    justify-content: center;\n' +
'    min-height: 220px;\n' +
'  }\n' +
'  .oeuvre-photo img {\n' +
'    max-width: 100%;\n' +
'    max-height: 280px;\n' +
'    object-fit: contain;\n' +
'    box-shadow: 2px 4px 20px rgba(0,0,0,.14);\n' +
'  }\n' +
'  .oeuvre-no-photo {\n' +
'    font-size: 2.5rem;\n' +
'    color: #ddd;\n' +
'    display: flex;\n' +
'    align-items: center;\n' +
'    justify-content: center;\n' +
'    height: 200px;\n' +
'    width: 100%;\n' +
'    background: #f8f6f2;\n' +
'    border-radius: 4px;\n' +
'  }\n' +
'\n' +
'  .oeuvre-details { display: flex; flex-direction: column; gap: .65rem; padding: .5rem 0; }\n' +
'\n' +
'  .oeuvre-titre {\n' +
'    font-family: "Playfair Display", serif;\n' +
'    font-size: 1.5rem;\n' +
'    font-weight: 400;\n' +
'    line-height: 1.2;\n' +
'    color: #111;\n' +
'    margin-bottom: .35rem;\n' +
'  }\n' +
'\n' +
'  .meta {\n' +
'    font-size: .78rem;\n' +
'    color: #555;\n' +
'    display: flex;\n' +
'    gap: .5rem;\n' +
'    line-height: 1.4;\n' +
'  }\n' +
'  .meta-lbl {\n' +
'    font-size: .62rem;\n' +
'    font-weight: 700;\n' +
'    letter-spacing: .12em;\n' +
'    text-transform: uppercase;\n' +
'    color: #c8a050;\n' +
'    min-width: 80px;\n' +
'    flex-shrink: 0;\n' +
'    margin-top: 2px;\n' +
'  }\n' +
'  .oeuvre-desc {\n' +
'    font-size: .8rem;\n' +
'    line-height: 1.75;\n' +
'    color: #777;\n' +
'    font-style: italic;\n' +
'    margin-top: .25rem;\n' +
'    border-left: 2px solid #e8e0d0;\n' +
'    padding-left: .75rem;\n' +
'  }\n' +
'\n' +
'  /* Numérotation bas de page */\n' +
'  @media print {\n' +
'    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n' +
'    .oeuvre { break-inside: avoid; page-break-inside: avoid; }\n' +
'    .couverture { break-after: page; }\n' +
'  }\n' +
'\n' +
'  /* Bouton impression */\n' +
'  #btn-imprimer {\n' +
'    position: fixed;\n' +
'    bottom: 1.5rem;\n' +
'    right: 1.5rem;\n' +
'    background: #c8a050;\n' +
'    color: #111;\n' +
'    border: none;\n' +
'    border-radius: 50px;\n' +
'    padding: .75rem 1.5rem;\n' +
'    font-size: .85rem;\n' +
'    font-weight: 700;\n' +
'    cursor: pointer;\n' +
'    box-shadow: 0 4px 16px rgba(0,0,0,.25);\n' +
'    z-index: 99;\n' +
'    font-family: "Lato", sans-serif;\n' +
'    letter-spacing: .05em;\n' +
'  }\n' +
'  @media print { #btn-imprimer { display: none; } }\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'\n' +
'<button id="btn-imprimer" onclick="window.print()">🖨 Imprimer / Enregistrer PDF</button>\n' +
'\n' +
'<div class="couverture">\n' +
'  <div class="couv-surtit">Catalogue</div>\n' +
'  <h1 class="couv-nom">' + nom + '</h1>\n' +
'  <div class="couv-filet"></div>\n' +
'  <div class="couv-date">' + mois + '</div>\n' +
'  <div class="couv-count">' + selection.length + '\u00a0œuvre' + (selection.length > 1 ? 's' : '') + '</div>\n' +
'</div>\n' +
'\n' +
'<div class="catalogue-body">\n' +
cartes + '\n' +
'</div>\n' +
'\n' +
'</body>\n' +
'</html>';

  var win = window.open('', '_blank', 'width=920,height=720,scrollbars=yes');
  if (!win) {
    alert('Le navigateur a bloqué la nouvelle fenêtre. Autorisez les pop-ups pour ce site.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ── Init ── */
(function initCatalogue() {
  var overlay = document.getElementById('overlay-catalogue');
  if (!overlay) return;

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) fermerCatalogue();
  });
})();
