/* admin-tdb.js — Tableau de bord des salles (navigation étoile)
 * ─────────────────────────────────────────────────────────────
 * Registre TYPES_SALLE + FACETTES_META
 * afficherTableauBord() — rend le hub de navigation
 * entrerVue(facette)    — entre dans l'éditeur d'une vue
 * retourTableauBord()   — retour au hub depuis l'éditeur
 */

/* Décor par défaut (miroir de DECOR_IMMERSIVE_DEFAUT dans salle-immersive.js) */
var DECOR_IMMERSIVE_DEFAUT = {
  fond:   '#12100c',
  sol:    '#8a6228',
  mur:    '#2e2a35',
  piquet: '#c8a050',
  corde:  '#8b0020',
  bandes: '#e8e0cc'
};

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
  if (tdbEl)    tdbEl.style.display    = montrerTDB ? 'block'       : 'none';
  if (editCorps) editCorps.style.display = montrerTDB ? 'none'        : '';
  if (retour)   retour.style.display   = montrerTDB ? 'none'        : 'inline-flex';
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
    var isPortrait = meta.ratio === '9/19';
    if (isPortrait) {
      /* GSM portrait : hauteur fixe, largeur proportionnelle centrée */
      var gsmH = 160;
      var gsmW = Math.round(gsmH * 9 / 19);
      wrap.style.cssText = 'position:relative;height:' + gsmH + 'px;width:' + gsmW + 'px;'
        + 'margin:0 auto;background:var(--bg3);border-radius:6px 6px 0 0;overflow:hidden;';
    } else {
      /* PC paysage : pleine largeur, hauteur max fixe */
      wrap.style.cssText = 'position:relative;width:100%;aspect-ratio:' + meta.ratio
        + ';max-height:180px;overflow:hidden;background:var(--bg3);border-radius:6px 6px 0 0;';
    }

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

  /* Zone icône — cliquable si actif */
  var preview = document.createElement('div');
  preview.className = 'tdb-preview tdb-preview-greffon';
  if (actif) { preview.style.cursor = 'pointer'; preview.title = 'Configurer'; }
  var ico = document.createElement('span');
  ico.style.cssText = 'font-size:2.8rem;line-height:1;opacity:.45;';
  ico.textContent = meta.icon;
  preview.appendChild(ico);
  if (actif) {
    preview.addEventListener('click', (function(f) {
      return function() { entrerVue(f); };
    })(greffon));
  }
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

  /* Bouton "Configurer" (immersive uniquement, quand actif) */
  if (actif && greffon === 'immersive') {
    var cfgBtn = document.createElement('button');
    cfgBtn.className = 'ctrl-btn tdb-edit-btn';
    cfgBtn.textContent = '🎨 Configurer';
    (function(s) {
      cfgBtn.addEventListener('click', function() { entrerVue('immersive'); });
    })(salle);
    footer.appendChild(cfgBtn);
  }

  card.appendChild(footer);
  return card;
}

/* ── Panneau de config décor immersif ── */
var _DECOR_CHAMPS = [
  { key: 'mur',    label: 'Mur',    defaut: '#2e2a35' },
  { key: 'bandes', label: 'Bandes', defaut: '#e8e0cc' },
  { key: 'sol',    label: 'Sol',    defaut: '#8a6228' },
  { key: 'fond',   label: 'Fond',   defaut: '#12100c' },
  { key: 'piquet', label: 'Piquet', defaut: '#c8a050' },
  { key: 'corde',  label: 'Corde',  defaut: '#8b0020' }
];

function _creerConfigDecor(salle) {
  var decor = (salle.greffons && salle.greffons.immersive && salle.greffons.immersive.decor)
    ? salle.greffons.immersive.decor : {};

  var wrap = document.createElement('div');
  wrap.className = 'tdb-decor-wrap';

  var titre = document.createElement('div');
  titre.className = 'tdb-section-lbl';
  titre.textContent = 'Décor';
  wrap.appendChild(titre);

  var grille = document.createElement('div');
  grille.className = 'tdb-decor-grille';

  _DECOR_CHAMPS.forEach(function(champ) {
    var val = decor[champ.key] || champ.defaut;

    var row = document.createElement('div');
    row.className = 'tdb-decor-row';

    var lbl = document.createElement('span');
    lbl.className = 'tdb-decor-lbl';
    lbl.textContent = champ.label;

    var pastille = document.createElement('div');
    pastille.className = 'tdb-decor-pastille';
    pastille.style.background = val;
    pastille.dataset.key = champ.key;
    pastille.title = val;

    /* Clic → picker couleur existant (mécanisme support) */
    (function(k, p, lbl) {
      pastille.addEventListener('click', function() {
        if (typeof ouvrirPickerCouleur !== 'function') return;
        window._supportPickerCouleur    = p.title || p.style.background;
        window._supportPickerOnConfirm  = function(hex) {
          p.style.background = hex;
          p.title = hex;
          /* Mettre à jour greffons en mémoire */
          if (!salle.greffons) salle.greffons = {};
          if (!salle.greffons.immersive) salle.greffons.immersive = { actif: true };
          if (!salle.greffons.immersive.decor) salle.greffons.immersive.decor = {};
          salle.greffons.immersive.decor[k] = hex;
        };
        ouvrirPickerCouleur('support');
        /* Titre contextualisé */
        var titreEl = document.getElementById('picker-titre');
        if (titreEl) titreEl.textContent = 'Couleur — ' + lbl;
      });
    })(champ.key, pastille, champ.label);

    row.appendChild(lbl);
    row.appendChild(pastille);
    grille.appendChild(row);
  });
  wrap.appendChild(grille);

  /* Bouton Enregistrer */
  var saveBtn = document.createElement('button');
  saveBtn.className = 'ctrl-btn tdb-edit-btn';
  saveBtn.textContent = '💾 Enregistrer décor';
  saveBtn.addEventListener('click', function() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'En cours…';
    if (typeof sauvegarder === 'function') {
      sauvegarder('[admin] Décor immersif — ' + (salle.nom || 'salle'), null)
        .then(function() {
          saveBtn.disabled = false;
          saveBtn.textContent = '✓ Enregistré';
          setTimeout(function() { saveBtn.textContent = '💾 Enregistrer décor'; }, 2000);
        })
        .catch(function(e) {
          saveBtn.disabled = false;
          saveBtn.textContent = '⚠ Erreur';
        });
    }
  });
  wrap.appendChild(saveBtn);

  return wrap;
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

/* ── Entrer dans l'éditeur d'une vue (ouvre l'arranger directement) ── */
function entrerVue(facette) {
  _tdbFacetteActive = facette;
  var meta = FACETTES_META[facette] || {};
  var _isSculptType = typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture';

  /* Greffons → éditeur dédié */
  if (meta.greffon) {
    if (facette === 'immersive' && typeof ouvrirEditeurImmersif === 'function') {
      ouvrirEditeurImmersif(salleActive);
    }
    return;
  }

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

  /* Toutes les œuvres disponibles dans le strip — même logique sculpture et peinture.
     On charge toutes les œuvres qui ne sont pas dans une AUTRE salle. */
  if (typeof toilesSelectionnees !== 'undefined' && typeof toiles !== 'undefined'
      && typeof salles !== 'undefined' && salleActive) {
    toilesSelectionnees.clear();
    var autresIds = new Set();
    salles.forEach(function(s) {
      if (s.id === salleActive.id) return;
      (s.positions        || []).forEach(function(p) { autresIds.add(p.id); });
      (s.positions_mobile || []).forEach(function(p) { autresIds.add(p.id); });
    });
    toiles.forEach(function(t) {
      if (!autresIds.has(t.id)) toilesSelectionnees.add(t.id);
    });
  }

  /* Ouvrir l'arranger directement */
  if (_isSculptType) {
    if (typeof ouvrirArrangerApresConfirm === 'function') ouvrirArrangerApresConfirm();
  } else {
    if (typeof entrerModePlacement === 'function') entrerModePlacement();
  }
}

/* ── Retour au tableau de bord depuis l'éditeur ── */
function retourTableauBord() {
  afficherTableauBord();
}

/* ══════════════════════════════════════════════════════
   ÉDITEUR IMMERSIF — overlay fullscreen avec aperçu live
   ══════════════════════════════════════════════════════ */
function ouvrirEditeurImmersif(salle) {
  if (!salle) return;
  if (document.getElementById('overlay-imm-edit')) return;

  /* Décor courant (copie pour annulation) */
  var decor = Object.assign({}, DECOR_IMMERSIVE_DEFAUT,
    (salle.greffons && salle.greffons.immersive && salle.greffons.immersive.decor) || {});
  var decorOriginal = Object.assign({}, decor);

  /* ── Overlay ── */
  var overlay = document.createElement('div');
  overlay.id = 'overlay-imm-edit';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;background:#111;';

  /* ── Iframe aperçu ── */
  var apercuPath = '';
  if (typeof ADMIN_CFG !== 'undefined') {
    apercuPath = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'immersive-apercu.html';
  }
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;';
  iframe.tabIndex = -1;

  /* Pièce à afficher : première avec GLB */
  var piece = (typeof toiles !== 'undefined')
    ? (toiles.find(function(t) { return t.glb; }) || toiles[0] || {})
    : {};

  /* Injecter les données quand l'iframe est prête */
  function onMsg(e) {
    if (e.data && e.data.type === 'immersive-awaiting-data') {
      iframe.contentWindow.postMessage({ type: 'immersive-init', piece: piece, decor: decor }, '*');
    }
  }
  window.addEventListener('message', onMsg);

  iframe.src = apercuPath + '?v=' + Date.now();

  /* ── Panneau de contrôle ── */
  var panel = document.createElement('div');
  panel.className = 'imm-edit-panel';

  var panTitre = document.createElement('div');
  panTitre.style.cssText = 'font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;';
  panTitre.textContent = 'Décor — ' + (salle.nom || 'Salle');
  panel.appendChild(panTitre);

  /* 5 lignes de couleur */
  _DECOR_CHAMPS.forEach(function(champ) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;';

    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:.7rem;color:var(--muted);width:2.8rem;flex-shrink:0;';
    lbl.textContent = champ.label;

    var pastille = document.createElement('div');
    pastille.className = 'tdb-decor-pastille';
    pastille.style.background = decor[champ.key] || champ.defaut;
    pastille.title = decor[champ.key] || champ.defaut;

    (function(k, p) {
      p.addEventListener('click', function() {
        if (typeof ouvrirPickerCouleur !== 'function') return;
        window._supportPickerCouleur   = p.title;
        window._supportPickerOnConfirm = function(hex) {
          p.style.background = hex;
          p.title = hex;
          decor[k] = hex;
          /* Mise à jour live de l'iframe */
          iframe.contentWindow.postMessage({ type: 'immersive-decor-update', decor: decor }, '*');
        };
        ouvrirPickerCouleur('support');
        var titreEl = document.getElementById('picker-titre');
        if (titreEl) titreEl.textContent = 'Couleur — ' + champ.label;
      });
    })(champ.key, pastille);

    row.appendChild(lbl);
    row.appendChild(pastille);
    panel.appendChild(row);
  });

  /* Boutons */
  var btnSep = document.createElement('div');
  btnSep.style.cssText = 'height:1px;background:var(--brd);margin:.5rem 0;';
  panel.appendChild(btnSep);

  var btnSave = document.createElement('button');
  btnSave.className = 'ctrl-btn';
  btnSave.style.cssText = 'width:100%;margin-bottom:.3rem;justify-content:center;';
  btnSave.textContent = '💾 Enregistrer';
  btnSave.addEventListener('click', function() {
    btnSave.disabled = true; btnSave.textContent = 'En cours…';
    if (!salle.greffons) salle.greffons = {};
    if (!salle.greffons.immersive) salle.greffons.immersive = { actif: true };
    salle.greffons.immersive.decor = Object.assign({}, decor);
    if (typeof sauvegarder === 'function') {
      sauvegarder('[admin] Décor immersif — ' + (salle.nom || 'salle'), null)
        .then(function() {
          btnSave.disabled = false; btnSave.textContent = '✓ Enregistré';
          setTimeout(function() { btnSave.textContent = '💾 Enregistrer'; }, 2000);
          _renderTDB(); /* Rafraîchir les pastilles du TDB */
        })
        .catch(function() { btnSave.disabled = false; btnSave.textContent = '⚠ Erreur'; });
    }
  });
  panel.appendChild(btnSave);

  var btnBack = document.createElement('button');
  btnBack.className = 'ctrl-btn';
  btnBack.style.cssText = 'width:100%;justify-content:center;';
  btnBack.textContent = '← Retour';
  btnBack.addEventListener('click', function() {
    window.removeEventListener('message', onMsg);
    overlay.remove();
    afficherTableauBord();
  });
  panel.appendChild(btnBack);

  overlay.appendChild(iframe);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
