/* admin-tdb.js — Tableau de bord des salles (navigation étoile)
 * ─────────────────────────────────────────────────────────────
 * Registre TYPES_SALLE + FACETTES_META
 * afficherTableauBord() — rend le hub de navigation
 * entrerVue(facette)    — entre dans l'éditeur d'une vue
 * retourTableauBord()   — retour au hub depuis l'éditeur
 */

/* ─── Registre des types de salle ─── */
var TYPES_SALLE = {
  peinture:  { vues: ['galerie-pc', 'galerie-gsm'], greffons: [] },
  sculpture: { vues: ['galerie-pc', 'galerie-gsm'], greffons: ['immersive', 'descriptive'] }
};

/* ─── Méta-données par facette ─── */
var FACETTES_META = {
  'galerie-pc': {
    label: 'Galerie PC',
    icon:  '🖥',
    ratio: '16/9',
    vue:   'pc',
    badge: function(salle, lbl) {
      return (salle.positions || []).length + ' ' + lbl + ' placées';
    }
  },
  'galerie-gsm': {
    label: 'Galerie GSM',
    icon:  '📱',
    ratio: '9/19',
    vue:   'gsm',
    badge: function(salle, lbl) {
      var hasCustom = !!(salle.positions_mobile && salle.positions_mobile.length);
      var pos = hasCustom ? salle.positions_mobile : (salle.positions || []);
      return pos.length + ' ' + lbl + (hasCustom ? '' : ' (= PC)');
    }
  },
  'immersive': {
    label:   'Immersive',
    icon:    '✨',
    ratio:   null,
    greffon: true,
    badge: function(salle) {
      var a = salle.greffons && salle.greffons.immersive && salle.greffons.immersive.actif;
      return a ? '● Activée' : '○ Désactivée';
    }
  },
  'descriptive': {
    label:   'Descriptive',
    icon:    '🔍',
    ratio:   null,
    greffon: true,
    badge: function(salle) {
      var a = salle.greffons && salle.greffons.descriptive && salle.greffons.descriptive.actif;
      return a ? '● Activée' : '○ Désactivée';
    }
  }
};

/* ─── État de navigation ─── */
var _tdbFacetteActive = null; /* null = tableau, sinon facette courante */

/* ── Bascule TDB ↔ éditeur de vue ── */
function _basculeVueTDB(montrerTDB) {
  var tdbEl    = document.getElementById('tdb-section');
  var editCorps = document.querySelector('.edit-corps');
  var retour   = document.getElementById('btn-retour-tdb');
  if (tdbEl)    tdbEl.style.display    = montrerTDB ? 'block' : 'none';
  if (editCorps) editCorps.style.display = montrerTDB ? 'none'  : '';
  if (retour)   retour.style.display   = montrerTDB ? 'none'  : '';
}

/* ── Afficher le tableau de bord ── */
function afficherTableauBord() {
  _tdbFacetteActive = null;
  _basculeVueTDB(true);
  _renderTDB();
}

function _renderTDB() {
  var tdb = document.getElementById('tdb-contenu');
  if (!tdb) return;

  if (!salleActive) {
    tdb.innerHTML = '<div class="tdb-vide">Sélectionne une salle dans le plan ci-dessus.</div>';
    return;
  }
  tdb.innerHTML = '';
  var s = salleActive;

  var type    = s.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
  var typeDef = TYPES_SALLE[type] || TYPES_SALLE.peinture;
  var lbl     = (type === 'sculpture') ? 'pièces' : 'toiles';

  /* ── En-tête salle ── */
  var hdr = document.createElement('div');
  hdr.className = 'tdb-hdr';
  var nomEl = document.createElement('span');
  nomEl.className = 'tdb-nom';
  nomEl.textContent = s.nom || '—';
  hdr.appendChild(nomEl);
  tdb.appendChild(hdr);

  /* ── Section arrangement (cartes de vues) ── */
  if (typeDef.vues.length > 0) {
    var titreVues = document.createElement('div');
    titreVues.className = 'tdb-section-lbl';
    titreVues.textContent = 'Arrangement';
    tdb.appendChild(titreVues);

    var grid = document.createElement('div');
    grid.className = 'tdb-grid';
    typeDef.vues.forEach(function(facette) {
      grid.appendChild(_creerCarteVue(facette, s, lbl));
    });
    tdb.appendChild(grid);
  }

  /* ── Section greffons de présentation (sculpture uniquement) ── */
  if (typeDef.greffons.length > 0) {
    var titreGreff = document.createElement('div');
    titreGreff.className = 'tdb-section-lbl';
    titreGreff.textContent = 'Présentation';
    tdb.appendChild(titreGreff);

    var gridG = document.createElement('div');
    gridG.className = 'tdb-grid';
    typeDef.greffons.forEach(function(greffon) {
      gridG.appendChild(_creerCarteGreffon(greffon, s));
    });
    tdb.appendChild(gridG);
  }
}

/* ── Carte d'une vue arrangeable (PC / GSM) ── */
function _creerCarteVue(facette, salle, lbl) {
  var meta = FACETTES_META[facette];
  if (!meta) return document.createElement('div');

  var card = document.createElement('div');
  card.className = 'tdb-card';

  /* Zone aperçu */
  var preview = document.createElement('div');
  preview.className = 'tdb-preview';

  if (meta.ratio) {
    var apercuBase = '';
    if (typeof ADMIN_CFG !== 'undefined') {
      apercuBase = ADMIN_CFG.repoPath.replace(/data\/?$/, '');
    }
    var apercuPath = apercuBase + 'galerie-apercu.html';

    var wrap = document.createElement('div');
    wrap.className = 'tdb-iframe-wrap';
    wrap.style.cssText = 'position:relative;width:100%;aspect-ratio:' + meta.ratio
      + ';background:var(--bg3);border-radius:6px 6px 0 0;overflow:hidden;';

    var iframe = document.createElement('iframe');
    iframe.src = apercuPath + '?vue=' + meta.vue + '&v=' + Date.now();
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;pointer-events:none;';
    iframe.tabIndex = -1;
    iframe.setAttribute('loading', 'lazy');

    /* Injection des données dans l'iframe */
    (function(ifr) {
      var _isSculptType = typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture';
      var injectData = {
        type: 'init-data',
        toiles: _isSculptType
          ? { next_id: nextId, gabarits: tailles, pieces: toiles }
          : { next_id: nextId, tailles:  tailles, toiles: toiles },
        salles: { salles: JSON.parse(JSON.stringify(salles || [])) }
      };
      function onMsg(e) {
        if (e.source === ifr.contentWindow && e.data && e.data.type === 'iframe-awaiting-data') {
          ifr.contentWindow.postMessage(injectData, '*');
          window.removeEventListener('message', onMsg);
        }
      }
      window.addEventListener('message', onMsg);
    })(iframe);

    wrap.appendChild(iframe);
    preview.appendChild(wrap);
  }

  /* Clic sur l'aperçu → entrer dans l'éditeur */
  preview.style.cursor = 'pointer';
  preview.title = 'Modifier l\'arrangement';
  preview.addEventListener('click', (function(f) {
    return function() { entrerVue(f); };
  })(facette));

  /* Pied de carte */
  var footer = document.createElement('div');
  footer.className = 'tdb-card-footer';

  var labelEl = document.createElement('div');
  labelEl.className = 'tdb-card-label';
  labelEl.textContent = meta.icon + ' ' + meta.label;

  var badge = document.createElement('div');
  badge.className = 'tdb-card-badge';
  badge.textContent = meta.badge(salle, lbl);

  var btn = document.createElement('button');
  btn.className = 'ctrl-btn tdb-edit-btn';
  btn.textContent = '✏️ Modifier';
  btn.addEventListener('click', (function(f) {
    return function() { entrerVue(f); };
  })(facette));

  footer.appendChild(labelEl);
  footer.appendChild(badge);
  footer.appendChild(btn);

  card.appendChild(preview);
  card.appendChild(footer);
  return card;
}

/* ── Carte d'un greffon de présentation (immersive / descriptive) ── */
function _creerCarteGreffon(greffon, salle) {
  var meta = FACETTES_META[greffon];
  if (!meta) return document.createElement('div');

  var actif = salle.greffons && salle.greffons[greffon] && salle.greffons[greffon].actif;

  var card = document.createElement('div');
  card.className = 'tdb-card tdb-card-greffon';

  /* Zone icône (placeholder — pas d'iframe) */
  var preview = document.createElement('div');
  preview.className = 'tdb-preview tdb-preview-greffon';
  var ico = document.createElement('span');
  ico.style.cssText = 'font-size:2.8rem;line-height:1;opacity:.45;';
  ico.textContent = meta.icon;
  preview.appendChild(ico);
  card.appendChild(preview);

  /* Pied de carte */
  var footer = document.createElement('div');
  footer.className = 'tdb-card-footer';

  var labelEl = document.createElement('div');
  labelEl.className = 'tdb-card-label';
  labelEl.textContent = meta.label;

  var badge = document.createElement('div');
  badge.className = 'tdb-card-badge' + (actif ? ' tdb-badge-on' : '');
  badge.textContent = meta.badge(salle);

  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'ctrl-btn';
  toggleBtn.textContent = actif ? 'Désactiver' : 'Activer';
  (function(g) {
    toggleBtn.addEventListener('click', function() { _toggleGreffon(g); });
  })(greffon);

  footer.appendChild(labelEl);
  footer.appendChild(badge);
  footer.appendChild(toggleBtn);
  card.appendChild(footer);
  return card;
}

/* ── Toggle greffon on/off ── */
function _toggleGreffon(greffon) {
  if (!salleActive) return;
  if (!salleActive.greffons) salleActive.greffons = {};
  var g = salleActive.greffons;
  if (!g[greffon]) g[greffon] = { actif: false };
  g[greffon].actif = !g[greffon].actif;
  _renderTDB();
  /* Note : la sauvegarde est déclenchée via le bouton 💾 de l'en-tête salle
     (à implémenter dans la prochaine itération). */
}

/* ── Entrer dans l'éditeur d'une vue ── */
function entrerVue(facette) {
  _tdbFacetteActive = facette;
  var meta = FACETTES_META[facette] || {};

  /* Synchroniser _placementVue pour sculpture (PC/GSM) */
  if (typeof _placementVue !== 'undefined' && meta.vue) {
    _placementVue = meta.vue;
    var sw = document.getElementById('btn-switch-vue');
    if (sw) {
      sw.textContent       = (meta.vue === 'gsm') ? '📱 GSM' : '🖥 PC';
      sw.style.background  = (meta.vue === 'gsm') ? 'var(--gold)' : '';
      sw.style.color       = (meta.vue === 'gsm') ? '#fff'        : '';
    }
  }

  _basculeVueTDB(false);
  if (typeof buildOccupancy   === 'function') buildOccupancy();
  if (typeof afficherMur      === 'function') afficherMur();
  if (typeof afficherStock    === 'function') afficherStock();
}

/* ── Retour au tableau de bord depuis l'éditeur ── */
function retourTableauBord() {
  afficherTableauBord();
}
