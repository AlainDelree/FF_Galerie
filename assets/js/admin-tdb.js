/* admin-tdb.js — Tableau de bord des salles (navigation étoile)
 * ─────────────────────────────────────────────────────────────
 * Registre TYPES_SALLE + FACETTES_META
 * afficherTableauBord() — rend le hub de navigation
 * entrerVue(facette)    — entre dans l'éditeur d'une vue
 * retourTableauBord()   — retour au hub depuis l'éditeur
 */

/* Décor par défaut (miroir de DECOR_IMMERSIVE_DEFAUT dans salle-immersive.js) */
var DECOR_IMMERSIVE_DEFAUT = {
  fond:            '#12100c',
  exposure:        1.0,
  sol:             '#8a6228',
  socle_couleur:   '#f0ece4',
  socle_use_piece: false,
  pan_a:  '#7a2525',
  pan_b:  '#1a3055',
  pan_c:  '#2a5035',
  pan_d:  '#a04820',
  piquet: '#c8a050',
  corde:  '#8b0020'
};

/* Décor par défaut salle descriptive (bandes uniquement) */
var DECOR_DESCRIPTIVE_DEFAUT = {
  pan_a: '#1a1510',
  pan_b: '#2a2018',
  pan_c: '#1a1510',
  pan_d: '#2a2018'
};

/* ─── Registre des types de salle ─── */
var TYPES_SALLE = {
  /* Peinture : pas de carte GSM — galerie-peinture.js ne lit pas
     positions_mobile (sur mobile le rendu bascule en mode flux), mur
     PC/GSM identiques (aspect-ratio 12/8). Une seule vue suffit. */
  peinture:  { vues: ['galerie-pc'], greffons: [] },
  sculpture: { vues: ['galerie-gsm', 'galerie-pc'], greffons: ['immersive', 'descriptive'] }
};

/* Miroir admin du catalogue VITRINE_SCENARIOS (galerie-sculpture.js).
   Les CLES et 'req' doivent rester synchronises avec ce fichier ; le libelle
   est redige ici pour le proprietaire (Fred). */
var VITRINE_SCENARIOS_ADMIN = [
  { key:'imm_desc',    req:['imm','desc'], ouverture:'directe', cible:'imm',  suivant:'desc', label:'Clic œuvre → immersive, puis Suivant → détail' },
  { key:'imm_desc_2t', req:['imm','desc'], ouverture:'2temps',  cible:'imm',  suivant:'desc', label:'Ouverture en 2 temps, œuvre → immersive, Suivant → détail' },
  { key:'desc',        req:['desc'],       ouverture:'directe', cible:'desc', suivant:null,   label:'Clic œuvre → détail' },
  { key:'desc_imm',    req:['desc','imm'], ouverture:'directe', cible:'desc', suivant:'imm',  label:'Clic œuvre → détail, puis Suivant → immersive' },
  { key:'imm',         req:['imm'],        ouverture:'directe', cible:'imm',  suivant:null,   label:'Clic œuvre → immersive' },
  { key:'vitrine',     req:[],             ouverture:'directe', cible:null,   suivant:null,   label:'Vitrine seule (pas de salle)' }
];
function _scenarioLabel(key) {
  for (var i = 0; i < VITRINE_SCENARIOS_ADMIN.length; i++)
    if (VITRINE_SCENARIOS_ADMIN[i].key === key) return VITRINE_SCENARIOS_ADMIN[i].label;
  return key || '(aucun)';
}
/* Vrai si la salle contient au moins une vitrine (piece est_vitrine placee/affectee). */
function _salleAUneVitrine(s) {
  if (typeof toiles === 'undefined' || !toiles || !toiles.length) return false;
  var ids = {};
  (s.positions || []).forEach(function (p) { if (p && p.id != null) ids[p.id] = 1; });
  (s.positions_mobile || []).forEach(function (p) { if (p && p.id != null) ids[p.id] = 1; });
  (s.toiles || []).forEach(function (t) { var id = (t && typeof t === 'object') ? t.id : t; if (id != null) ids[id] = 1; });
  return toiles.some(function (t) { return t && t.est_vitrine && ids[t.id]; });
}

/* ─── Méta-données par facette ─── */
var FACETTES_META = {
  'galerie-pc': {
    label: 'Galerie PC',
    icon:  '🖥',
    ratio: '16/9',
    vue:   'pc',
    badge: function(salle, lbl) {
      var hasCustom = !!(salle.positions && salle.positions.length);
      var pos = hasCustom ? salle.positions : (salle.positions_mobile || []);
      return pos.length + ' ' + lbl + (hasCustom ? ' placées' : ' (= GSM)');
    }
  },
  'galerie-gsm': {
    label: 'Galerie GSM',
    icon:  '📱',
    ratio: '9/19',
    vue:   'gsm',
    badge: function(salle, lbl) {
      return (salle.positions_mobile || []).length + ' ' + lbl + ' placées';
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
    },
    creerApercu: function(salle) {
      /* Aperçu iframe model-viewer — pièce avec l'id le plus bas */
      var apercuBase = (typeof ADMIN_CFG !== 'undefined')
        ? ADMIN_CFG.repoPath.replace(/data\/?$/, '') : '';
      /* Filtre par type SALLE (sculpture only ici) : en cohabitation peinture+sculpture,
         toiles[] contient les deux types — il faut prendre une pièce sculpture. */
      var _pieces = (typeof toiles !== 'undefined')
        ? toiles.filter(function(t){ return ((t._type)||ADMIN_CFG.type) === 'sculpture'; })
        : [];
      var piece = _pieces.length
        ? _pieces.slice().sort(function(a,b){ return a.id - b.id; })[0] : null;
      var decor = (salle.greffons && salle.greffons.descriptive && salle.greffons.descriptive.decor)
        ? salle.greffons.descriptive.decor : {};
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;max-height:180px;overflow:hidden;background:#1a1510;border-radius:6px 6px 0 0;';
      if (piece && piece.glb) {
        var ifr = document.createElement('iframe');
        ifr.src = apercuBase + 'descriptive-apercu.html?v=' + Date.now();
        ifr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;pointer-events:none;';
        ifr.tabIndex = -1;
        (function(iframe) {
          function onMsg(e) {
            if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
            if (e.data && e.data.type === 'descriptive-awaiting-data') {
              iframe.contentWindow.postMessage({ type: 'descriptive-init', piece: piece, decor: decor }, '*');
              window.removeEventListener('message', onMsg);
            }
          }
          window.addEventListener('message', onMsg);
        })(ifr);
        wrap.appendChild(ifr);
      } else {
        /* Fallback CSS si pas de GLB */
        var D = Object.assign({}, DECOR_DESCRIPTIVE_DEFAUT, decor);
        var pal = [D.pan_a, D.pan_b, D.pan_c, D.pan_d];
        var bands = document.createElement('div');
        bands.style.cssText = 'position:absolute;inset:0;display:flex;';
        for (var i = 0; i < 12; i++) {
          var b = document.createElement('div');
          b.style.cssText = 'flex:1;background:' + pal[i%4] + ';';
          bands.appendChild(b);
        }
        wrap.appendChild(bands);
        var ico = document.createElement('div');
        ico.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:.3;';
        ico.textContent = '🔍';
        wrap.appendChild(ico);
      }
      return wrap;
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
    tdb.innerHTML = '<div class="tdb-vide">Sélectionnez une salle dans le plan ci-dessus.</div>';
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
    var solo = (typeDef.vues.length === 1);
    grid.className = 'tdb-grid' + (solo ? ' tdb-grid-solo' : '');
    typeDef.vues.forEach(function(facette) {
      grid.appendChild(_creerCarteVue(facette, s, lbl, { solo: solo }));
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

  /* ── Section scénario vitrine (sculpture uniquement) ── */
  if (typeDef.greffons.length > 0) _renderSectionScenario(tdb, s);
}

/* Clone l'esthétique (apparence + greffons) d'une salle source vers la salle cible.
   Ne touche jamais aux positions, positions_mobile, toiles, nom, id, visible. */
function _clonerEsthetique(srcId, cibleId) {
  var src   = salles.find(function(o) { return o.id === srcId; });
  var cible = salles.find(function(o) { return o.id === cibleId; });
  if (!src || !cible) return;

  var nomSrc = src.nom || ('Salle ' + srcId);
  if (!confirm('Rendre cette salle identique à « ' + nomSrc + ' » (esthétique) ?\n\n' +
    'Remplace couleurs (mur, pièce, bas-mur), revêtement, sol, cadres et thème + présentations immersive/descriptive.\n' +
    'La cible devient identique à la source, y compris là où la source est restée au défaut.\n' +
    'Le placement des pièces n\u0027est pas affecté.')) return;

  /* Clone FIDÈLE : la cible devient identique à la source. Pour chaque champ
     d\u0027apparence : si la source l\u0027a défini, on copie ; sinon on RETIRE la clé
     de la cible pour qu\u0027elle retombe AUSSI sur le défaut → rendu cible == source.
     (Historique : copier un undefined retirait la clé et "perdait" des couleurs de
     la cible — commits 5aa8286, 7770199 ; ici c\u0027est désormais VOULU.) */
  cible.couleur_mur = src.couleur_mur;
  ['couleur_mur_piece', 'couleur_mur_bas', 'couleur_cadres', 'epaisseur_cadres', 'texture', 'couleur_sol', 'sol_type'].forEach(function(k) {
    if (src[k] !== undefined) cible[k] = src[k];
    else delete cible[k];
  });

  /* Greffons (activation + décor) — copie profonde */
  cible.greffons = src.greffons ? JSON.parse(JSON.stringify(src.greffons)) : undefined;

  /* Recharge complètement l'apparence de la salle active (globales mur /
     mur-pièce / mur-bas / texture / cadres + CSS vars) puis re-render TDB +
     Arranger. Sans ça, seules les DONNÉES de la salle changent : l'aperçu se
     met à jour mais l'Arranger garde l'ancienne apparence jusqu'à un refresh. */
  if (typeof selectSalle === 'function' && salleActive && salleActive.id === cibleId) {
    selectSalle(cibleId);
  } else {
    if (typeof appliquerApparence === 'function') appliquerApparence();
    _renderTDB();
  }
  if (typeof sauvegarder === 'function') {
    sauvegarder('[admin] Clonage esthétique « ' + nomSrc + ' » → « ' + (cible.nom || 'salle') + ' »', null)
      .then(function() { if (typeof toast === 'function') toast('✓ Esthétique clonée'); })
      .catch(function(e) { if (typeof toast === 'function') toast('Erreur : ' + e.message, 'err'); });
  }
}

/* ── Carte d'une vue arrangeable (PC / GSM) ──
   opts.solo : true si la carte est seule dans la grille (pas de GSM) →
   on relâche la max-height pour donner plus de place à l'aperçu. */
function _creerCarteVue(facette, salle, lbl, opts) {
  opts = opts || {};
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
    /* Type de la salle (et non type de l'admin) — détermine le bon aperçu */
    var typeSalle = salle.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
    var apercuFile = (typeSalle === 'sculpture') ? 'galerie-apercu.html' : 'galerie-apercu-peinture.html';
    var apercuPath = apercuBase + apercuFile;

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
      /* PC paysage : pleine largeur. Carte seule → hauteur libre dans une
         limite raisonnable pour ne pas saturer l'écran (l'aspect-ratio 16/9
         dicte la hauteur naturelle, mais on plafonne à 260px), carte côte
         à côte → max-height 180px pour tenir avec la carte GSM voisine.
         Peinture : ratio 3/2 (= 12/8 du mur d'expo) — le mur remplit la
         carte sans letterbox noir gauche/droite. La zone-basse (parquet
         + portes) n'apparaît pas dans la carte, mais ce qui compte pour
         l'aperçu c'est de voir où se placent les toiles. */
      var typeSalle = salle.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
      var ratioCarte = (typeSalle === 'peinture') ? '3/2' : meta.ratio;
      var maxH = opts.solo ? '260px' : '180px';
      /* Height-driven : hauteur fixe + aspect-ratio → largeur calculée correctement.
         Avec width:100% + max-height, le navigateur ignorait l'aspect-ratio
         (carte étirée à 1820×260 au lieu de 390×260). max-width:100% évite le
         débordement horizontal sur écran étroit ; margin:0 auto centre. */
      wrap.style.cssText = 'position:relative;height:' + maxH + ';aspect-ratio:' + ratioCarte
        + ';max-width:100%;margin:0 auto;overflow:hidden;background:var(--bg3);border-radius:6px 6px 0 0;';
    }

    var iframe = document.createElement('iframe');
    iframe.tabIndex = -1;
    iframe.setAttribute('loading', 'lazy');

    /* Pour la peinture : on construit le décor (mur de la pièce + zone-basse
       + plancher) en CSS pur autour de l'iframe, et l'iframe ne contient
       QUE le mur d'expo (avec ses toiles). Valeurs validées sur
       tools/carte-apercu-peinture-preview.html :
         - marge latérale  : 13% de la largeur
         - marge haut      : 5% de la hauteur
         - zone-basse      : 31% de la hauteur (mur-inf 38% + plancher 62%)
         - couleur mur     : salle.couleur_mur_piece || #1a1a1a (mur de la pièce)
       Le mur d'expo a aspect-ratio 12/8 garanti par contain:layout sur l'iframe. */
    var typeSalleApercu = salle.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
    if (typeSalleApercu === 'peinture' && !isPortrait) {
      /* Décor mur de la pièce — couleur paramétrable par salle (default historique #1a1a1a) */
      var _murPieceCol = salle.couleur_mur_piece || '#1a1a1a';
      var decor = document.createElement('div');
      decor.style.cssText = 'position:absolute;inset:0;background:' + _murPieceCol + ';display:flex;flex-direction:column;padding:5% 13% 0 13%;box-sizing:border-box;';
      /* Conteneur du mur d'expo (place dispo restante) */
      var murZone = document.createElement('div');
      murZone.style.cssText = 'flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;';
      iframe.style.cssText = 'width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:12/8;border:none;pointer-events:none;background:#2e2e2e;';
      murZone.appendChild(iframe);
      decor.appendChild(murZone);
      /* Zone-basse (déborde latéralement pour faire le sol pleine largeur) */
      var zb = document.createElement('div');
      zb.style.cssText = 'flex:0 0 31%;display:flex;flex-direction:column;width:calc(100% + 30%);margin:0 -15%;';
      var _murBasCol = salle.couleur_mur_bas || '#111';
      var murInf = document.createElement('div');
      murInf.style.cssText = 'flex:0 0 38%;background:' + _murBasCol + ';padding:0 4%;display:flex;align-items:flex-end;justify-content:space-between;';
      var porteG = document.createElement('div');
      porteG.style.cssText = 'width:7%;height:78%;background:#0c0a07;border-top-left-radius:100% 90%;border-top-right-radius:100% 90%;box-shadow:inset 0 0 6px rgba(0,0,0,.7);';
      var porteD = porteG.cloneNode(false);
      murInf.appendChild(porteG); murInf.appendChild(porteD);
      var plancher = document.createElement('div');
      /* Sol custom (peinture) : memes regles que l'edition et le public via
         solBgPeintureCSS (plat=uni / lames teintees=parquet). Repli = parquet defaut. */
      var _solBgCarte;
      if ((salle.couleur_sol || salle.sol_type) && typeof solBgPeintureCSS === 'function') {
        _solBgCarte = solBgPeintureCSS(salle.sol_type, salle.couleur_sol);
      } else {
        _solBgCarte = 'repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0,rgba(0,0,0,.22) 1px,transparent 1px,transparent 8%),'
          + 'repeating-linear-gradient(to bottom,transparent 0,transparent 5px,rgba(0,0,0,.15) 5px,rgba(0,0,0,.15) 6px),'
          + 'linear-gradient(to bottom,#5a3a22,#3a2515)';
      }
      plancher.style.cssText = 'flex:1 1 auto;background:' + _solBgCarte + ';box-shadow:inset 0 4px 6px rgba(0,0,0,.4);';
      zb.appendChild(murInf); zb.appendChild(plancher);
      decor.appendChild(zb);
      wrap.appendChild(decor);
    } else {
      /* Sculpture (Galerie PC paysage + Galerie GSM portrait) : iframe pleine
         carte. Le rendu virtuel 1280×720 + mise à l'échelle s'est avéré peu
         fiable sur Chrome mobile (dvh faux dans une iframe scalée → demi-
         hauteur). À taille réelle, le sol remplit via min-height:100dvh +
         flex (cf. galerie-apercu.html). */
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;pointer-events:none;';
      wrap.appendChild(iframe);
    }

    /* Injection des données dans l'iframe */
    (function(ifr) {
      /* Format des données : selon le type de la SALLE (pas de l'admin).
         _stockParType filtre toiles[] par type → indispensable en multi-types
         pour éviter la collision d'ID entre peinture et sculpture. */
      var salleSeule = JSON.parse(JSON.stringify(salle));
      var stockData = _stockParType(typeSalle);
      var injectData = {
        type: 'init-data',
        toiles: stockData,
        salles: { salles: [salleSeule] }
      };
      function envoyer() {
        if (ifr.contentWindow) {
          try { ifr.contentWindow.postMessage(injectData, '*'); } catch(e) {}
        }
      }
      function onMsg(e) {
        if (!ifr.contentWindow || e.source !== ifr.contentWindow) return;
        if (e.data && e.data.type === 'iframe-awaiting-data') {
          envoyer();
          window.removeEventListener('message', onMsg);
        }
      }
      window.addEventListener('message', onMsg);
      /* Filet de sécurité : si le awaiting-data est arrivé avant l'attache du listener
         (course condition), l'onload re-envoie les données. L'aperçu accepte init-data
         tant qu'il n'a pas démarré, et son timer 800ms sera annulé par notre message. */
      ifr.addEventListener('load', envoyer);
    })(iframe);

    iframe.src = apercuPath + '?vue=' + meta.vue + '&v=' + Date.now();
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
  /* Pour les salles peinture, PC = GSM (galerie-peinture.js ne lit pas
     positions_mobile), donc le suffixe "PC" est trompeur. On affiche
     juste "Galerie". Pour sculpture, "Galerie PC" reste car la vue
     mobile a un layout distinct. */
  var typeSalleVue = salle.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
  var labelTxt = (facette === 'galerie-pc' && typeSalleVue === 'peinture')
    ? 'Galerie'
    : meta.label;
  labelEl.textContent = meta.icon + ' ' + labelTxt;

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
  /* Salle masquée du site public : badge « œil barré + Masquée » en overlay
     dans le coin supérieur droit de la VIGNETTE d'aperçu (le box sombre = wrap,
     ~390px centré sur PC). L'ancrer sur wrap et non sur .tdb-preview (pleine
     largeur de la carte) évite qu'il se retrouve loin de l'aperçu sur desktop.
     Styles inline + z-index élevé → visible même admin.css en cache, et au-dessus
     de l'iframe. Repli sur preview si pas de vignette (sécurité). */
  if (salle.visible === false) {
    var _cible = (typeof wrap !== 'undefined' && wrap) ? wrap : preview;
    _cible.style.position = 'relative';
    var _masq = document.createElement('div');
    _masq.className = 'tdb-card-masquee';
    _masq.innerHTML = (typeof _svgOeil === 'function' ? _svgOeil(true, 13) : '') + '<span style="line-height:1;">Masqu\u00E9e</span>';
    _masq.title = 'Cette salle est masqu\u00E9e : invisible sur le site public';
    _masq.style.cssText = 'position:absolute;top:6px;right:6px;z-index:30;display:flex;align-items:center;gap:4px;'
      + 'background:rgba(192,57,43,.96);color:#fff;font-size:.58rem;font-weight:700;letter-spacing:.05em;'
      + 'text-transform:uppercase;padding:3px 8px 3px 6px;border-radius:999px;'
      + 'box-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none;';
    _cible.appendChild(_masq);
  }
  return card;
}

/* ── Carte d'un greffon de présentation (immersive / descriptive) ── */
function _creerCarteGreffon(greffon, salle) {
  var meta = FACETTES_META[greffon];
  if (!meta) return document.createElement('div');

  var actif = salle.greffons && salle.greffons[greffon] && salle.greffons[greffon].actif;

  var card = document.createElement('div');
  card.className = 'tdb-card tdb-card-greffon';

  /* Zone aperçu — iframe live si actif, icône sinon */
  var preview = document.createElement('div');
  preview.className = 'tdb-preview' + (actif ? '' : ' tdb-preview-greffon');
  if (actif) { preview.style.cursor = 'pointer'; preview.title = 'Configurer'; }

  if (actif && greffon === 'immersive') {
    /* Aperçu iframe immersif (non interactif) */
    var apercuBase = (typeof ADMIN_CFG !== 'undefined')
      ? ADMIN_CFG.repoPath.replace(/data\/?$/, '') : '';
    var iframeWrap = document.createElement('div');
    iframeWrap.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;max-height:180px;overflow:hidden;background:#111;border-radius:6px 6px 0 0;';
    var ifr = document.createElement('iframe');
    ifr.src = apercuBase + 'immersive-apercu.html?v=' + Date.now();
    ifr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;pointer-events:none;';
    ifr.tabIndex = -1;
    (function(iframe) {
      var decorSalle = (salle.greffons && salle.greffons.immersive && salle.greffons.immersive.decor)
        ? salle.greffons.immersive.decor : {};
      /* Filtre par type sculpture (greffon immersive = sculpture only) */
      var _piecesSc = (typeof toiles !== 'undefined')
        ? toiles.filter(function(t){ return ((t._type)||ADMIN_CFG.type) === 'sculpture'; })
        : [];
      var piece = _piecesSc.find(function(t) { return t.glb; }) || _piecesSc[0] || {};
      function onMsg(e) {
        if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
        if (e.data && e.data.type === 'immersive-awaiting-data') {
          iframe.contentWindow.postMessage({ type: 'immersive-init', piece: piece, decor: decorSalle }, '*');
          window.removeEventListener('message', onMsg);
        }
      }
      window.addEventListener('message', onMsg);
    })(ifr);
    iframeWrap.appendChild(ifr);
    preview.appendChild(iframeWrap);
  } else if (actif && meta.creerApercu) {
    /* Aperçu CSS généré par la facette (ex: descriptive → bandes) */
    preview.appendChild(meta.creerApercu(salle));
  } else {
    /* Placeholder icône */
    preview.classList.add('tdb-preview-greffon');
    var ico = document.createElement('span');
    ico.style.cssText = 'font-size:2.8rem;line-height:1;opacity:.45;';
    ico.textContent = meta.icon;
    preview.appendChild(ico);
  }

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


  card.appendChild(footer);
  return card;
}

/* ── Panneau de config décor immersif ── */
var _DECOR_CHAMPS = [
  { key: 'pan_a',  label: 'Panneau A', defaut: '#7a2525' },
  { key: 'pan_b',  label: 'Panneau B', defaut: '#1a3055' },
  { key: 'pan_c',  label: 'Panneau C', defaut: '#2a5035' },
  { key: 'pan_d',  label: 'Panneau D', defaut: '#a04820' },
  { key: 'sol',    label: 'Sol',       defaut: '#8a6228' },
  { key: 'socle_couleur', label: 'Socle',  defaut: '#f0ece4' },
  { key: 'piquet', label: 'Piquet',    defaut: '#c8a050' },
  { key: 'corde',  label: 'Corde',     defaut: '#8b0020' }
];

/* ── Section scénario vitrine (combobox + propagation) ── */
/* Ancien format (cle string) -> suite d'etapes. Le nouveau format est deja un tableau. */
function _normScenarioAdmin(scn) {
  if (Array.isArray(scn)) return scn.slice();
  if (!scn) return [];
  var sc = null;
  for (var i = 0; i < VITRINE_SCENARIOS_ADMIN.length; i++)
    if (VITRINE_SCENARIOS_ADMIN[i].key === scn) sc = VITRINE_SCENARIOS_ADMIN[i];
  if (!sc) return [];
  var seq = [];
  if (sc.ouverture === '2temps') { seq.push('fermee'); seq.push('ouverte'); }
  else seq.push('ouverte');
  if (sc.cible) seq.push(sc.cible);
  if (sc.suivant && sc.suivant !== sc.cible) seq.push(sc.suivant);
  return seq;
}

/* Options valides pour la PROCHAINE etape (filtre coherent). */
function _optionsEtape(etapes) {
  var last = etapes.length ? etapes[etapes.length - 1] : null;
  if (!last) return ['fermee', 'ouverte'];       /* 1re case : etat de depart */
  if (last === 'fermee') return ['ouverte'];      /* 2 temps -> ouverte obligatoire */
  if (last === 'fiche') return [];                /* fiche = terminale */
  var opts = [];                                   /* apres 'ouverte' ou une vue : vues restantes */
  if (etapes.indexOf('imm')  < 0) opts.push('imm');
  if (etapes.indexOf('desc') < 0) opts.push('desc');
  if (etapes.indexOf('fiche') < 0)          opts.push('fiche');
  return opts;
}

/* Petite illustration SVG d'une etape du parcours vitrine. */
function _miniVitrine(etat) {
  var SVG = {
    fermee:
      '<svg width="54" height="44" viewBox="0 0 54 44">' +
      '<rect x="6" y="4" width="42" height="38" rx="2" fill="#6a4b28" stroke="#3a2817"/>' +
      '<rect x="9" y="8" width="17" height="30" rx="1" fill="#7a5730" stroke="#4a3320"/>' +
      '<rect x="28" y="8" width="17" height="30" rx="1" fill="#7a5730" stroke="#4a3320"/>' +
      '<circle cx="24" cy="23" r="1.6" fill="#e8cf86"/><circle cx="30" cy="23" r="1.6" fill="#e8cf86"/></svg>',
    ouverte:
      '<svg width="54" height="44" viewBox="0 0 54 44">' +
      '<rect x="6" y="4" width="42" height="38" rx="2" fill="#5a3f22" stroke="#3a2817"/>' +
      '<rect x="12" y="9" width="30" height="28" fill="#3a2a18"/>' +
      '<rect x="15" y="14" width="7" height="8" fill="#c8b088"/><rect x="25" y="13" width="6" height="9" fill="#a89060"/><rect x="33" y="14" width="6" height="8" fill="#b8a070"/>' +
      '<rect x="14" y="26" width="8" height="7" fill="#b0a078"/><rect x="30" y="25" width="7" height="8" fill="#c0a880"/>' +
      '<path d="M6 4 L1 8 L1 38 L6 42 Z" fill="#6a4b28" stroke="#3a2817"/>' +
      '<path d="M48 4 L53 8 L53 38 L48 42 Z" fill="#6a4b28" stroke="#3a2817"/></svg>',
    imm:
      '<svg width="54" height="44" viewBox="0 0 54 44">' +
      '<rect x="2" y="2" width="50" height="40" rx="3" fill="#12100c"/>' +
      '<ellipse cx="27" cy="35" rx="20" ry="4" fill="#8a6228" opacity="0.5"/>' +
      '<rect x="21" y="28" width="12" height="6" rx="1" fill="#f0ece4"/>' +
      '<path d="M27 11 C21 18 24 27 27 28 C30 27 33 18 27 11 Z" fill="#c9b79c"/>' +
      '<rect x="9" y="33" width="2" height="7" fill="#c8a050"/><rect x="43" y="33" width="2" height="7" fill="#c8a050"/>' +
      '<circle cx="10" cy="33" r="1.8" fill="#e8cf86"/><circle cx="44" cy="33" r="1.8" fill="#e8cf86"/>' +
      '<path d="M10 36 Q27 42 44 36" stroke="#8b0020" stroke-width="1.5" fill="none"/></svg>',
    fiche:
      '<svg width="54" height="44" viewBox="0 0 54 44">' +
      '<rect x="2" y="2" width="50" height="40" rx="3" fill="#f4efe6"/>' +
      '<rect x="6" y="8" width="22" height="28" fill="#3a5a7a"/>' +
      '<rect x="6" y="28" width="22" height="8" fill="#6a5a3a"/>' +
      '<circle cx="12" cy="15" r="3" fill="#e8d070"/>' +
      '<rect x="32" y="10" width="16" height="3" rx="1" fill="#3a2e20"/>' +
      '<rect x="32" y="17" width="11" height="2" rx="1" fill="#9a8b76"/>' +
      '<rect x="32" y="23" width="16" height="2" rx="1" fill="#cabfae"/>' +
      '<rect x="32" y="27" width="16" height="2" rx="1" fill="#cabfae"/>' +
      '<rect x="32" y="31" width="10" height="2" rx="1" fill="#cabfae"/></svg>',
    desc:
      '<svg width="54" height="44" viewBox="0 0 54 44">' +
      '<rect x="2" y="2" width="50" height="40" rx="3" fill="#3a3330"/>' +
      '<rect x="2" y="32" width="50" height="10" fill="#2a231e"/>' +
      '<path d="M27 3 L20 10 L34 10 Z" fill="#f0e0a0" opacity="0.16"/>' +
      '<rect x="17" y="8" width="20" height="18" rx="1" fill="#c8a050"/>' +
      '<rect x="19" y="10" width="16" height="14" fill="#3a5a7a"/>' +
      '<rect x="19" y="19" width="16" height="5" fill="#6a5a3a"/>' +
      '<circle cx="25" cy="15" r="2.3" fill="#e8d070"/>' +
      '<rect x="22" y="29" width="10" height="2" rx="1" fill="#9a8b76"/></svg>'
  };
  var CAP = { fermee:'ferm\u00e9e', ouverte:'ouverte', fiche:'fiche', desc:'descriptive', imm:'immersif' };
  var box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
  var frame = document.createElement('div');
  frame.style.cssText = 'width:54px;height:44px;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.5);line-height:0;';
  frame.innerHTML = SVG[etat] || '';
  var cap = document.createElement('div');
  cap.style.cssText = 'font-size:9px;color:#9a8b76;';
  cap.textContent = CAP[etat] || '';
  box.appendChild(frame); box.appendChild(cap);
  return box;
}

function _renderSectionScenario(tdb, s) {
  var titre = document.createElement('div');
  titre.className = 'tdb-section-lbl';
  titre.textContent = 'Sc\u00e9nario vitrine';
  tdb.appendChild(titre);

  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 2px 2px;';

  var aVitrine = _salleAUneVitrine(s);
  var immOn  = !!(s.greffons && s.greffons.immersive  && s.greffons.immersive.actif);
  var descOn = !!(s.greffons && s.greffons.descriptive && s.greffons.descriptive.actif);
  var etapes = _normScenarioAdmin(s.scenario);

  function sauver(msg) {
    if (etapes.length) salleActive.scenario = etapes.slice();
    else delete salleActive.scenario;
    _renderTDB();
    if (typeof sauvegarder === 'function') {
      sauvegarder(msg, null).catch(function (e) { if (typeof toast === 'function') toast('Erreur : ' + e.message, 'err'); });
    }
  }
  function fleche() {
    var a = document.createElement('span');
    a.textContent = '\u203a';
    a.style.cssText = 'align-self:center;color:#c8a050;font-size:18px;line-height:44px;';
    return a;
  }

  /* Rangee des etapes composees */
  var rangee = document.createElement('div');
  rangee.style.cssText = 'display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap;';
  etapes.forEach(function (et, i) {
    if (i > 0) rangee.appendChild(fleche());
    var caseEl = document.createElement('div');
    caseEl.style.cssText = 'position:relative;';
    caseEl.appendChild(_miniVitrine(et));
    if (aVitrine) {
      var x = document.createElement('button');
      x.type = 'button'; x.textContent = '\u00d7'; x.title = 'Retirer \u00e0 partir d\u2019ici';
      x.style.cssText = 'position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;' +
        'border:1px solid #6a2020;background:#3a1414;color:#f0c0c0;font-size:12px;line-height:1;cursor:pointer;padding:0;';
      x.addEventListener('click', function () { etapes = etapes.slice(0, i); sauver('[admin] Sc\u00e9nario vitrine \u2014 \u00e9tape retir\u00e9e \u2014 ' + (salleActive.nom || 'salle')); });
      caseEl.appendChild(x);
    }
    rangee.appendChild(caseEl);
  });

  var options = _optionsEtape(etapes);
  function estActive(opt) { return opt === 'imm' ? immOn : (opt === 'desc' ? descOn : true); }

  /* Panneau d'options (miniatures a ajouter), revele par la case "+".
     Les vues dont la presentation n'est pas activee sont AFFICHEES grisees. */
  var panneau = document.createElement('div');
  panneau.style.cssText = 'display:none;flex-wrap:wrap;gap:8px;padding:8px;border:1px dashed #3a2e20;border-radius:10px;background:#150f09;';
  var yaGrise = false;
  options.forEach(function (opt) {
    var actif = estActive(opt);
    var b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'background:none;border:1px solid #3a2e20;border-radius:8px;padding:4px;' +
      (actif ? 'cursor:pointer;' : 'cursor:not-allowed;opacity:.4;');
    b.appendChild(_miniVitrine(opt));
    if (actif) {
      b.addEventListener('click', function () { etapes = etapes.concat([opt]); sauver('[admin] Sc\u00e9nario vitrine \u2014 \u00e9tape ajout\u00e9e \u2014 ' + (salleActive.nom || 'salle')); });
    } else {
      yaGrise = true; b.disabled = true;
      b.title = 'Activez la pr\u00e9sentation \u00ab ' + (opt === 'imm' ? 'immersive' : 'descriptive') + ' \u00bb (section Pr\u00e9sentation) pour utiliser cette vue.';
    }
    panneau.appendChild(b);
  });
  if (yaGrise) {
    var hint = document.createElement('div');
    hint.style.cssText = 'flex-basis:100%;font-size:10px;color:#9a8b76;line-height:1.3;';
    hint.textContent = 'Les vues gris\u00e9es demandent d\u2019activer leur pr\u00e9sentation dans la section \u00ab Pr\u00e9sentation \u00bb ci-dessus.';
    panneau.appendChild(hint);
  }

  if (aVitrine && options.length) {
    if (etapes.length) rangee.appendChild(fleche());
    var plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+';
    plus.title = 'Ajouter une \u00e9tape';
    plus.style.cssText = 'width:54px;height:44px;border-radius:4px;border:2px dashed #c8a050;background:#1a130c;color:#c8a050;font-size:22px;cursor:pointer;';
    plus.addEventListener('click', function () { panneau.style.display = (panneau.style.display === 'none') ? 'flex' : 'none'; });
    rangee.appendChild(plus);
  }
  wrap.appendChild(rangee);
  if (options.length) wrap.appendChild(panneau);

  var note = document.createElement('div');
  note.style.cssText = 'font-size:11px;color:#9a8b76;line-height:1.35;';
  note.textContent = etapes.length
    ? 'S\u2019applique \u00e0 toutes les vitrines de cette salle. Les objets pos\u00e9s au sol ne sont pas affect\u00e9s.'
    : 'Composez le parcours en ajoutant des \u00e9tapes (vitrine \u2192 vues). Vide = comportement par d\u00e9faut.';
  wrap.appendChild(note);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Appliquer aux autres salles';
  btn.style.cssText = 'align-self:flex-start;font-size:12px;background:#2a2016;color:#e8dcc8;border:1px solid #3a2e20;border-radius:8px;padding:7px 10px;cursor:pointer;';
  btn.addEventListener('click', function () {
    var typeDe = function (o) { return o.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture'); };
    var cibles = (typeof salles !== 'undefined' ? salles : []).filter(function (o) { return o.id !== salleActive.id && typeDe(o) === 'sculpture'; });
    if (!cibles.length) { if (typeof toast === 'function') toast('Aucune autre salle sculpture.'); return; }
    if (!confirm('Appliquer ce sc\u00e9nario \u00e0 toutes les autres salles sculpture (' + cibles.length + ') ?\n\nLes salles sans le greffon requis ignoreront les vues concern\u00e9es.')) return;
    cibles.forEach(function (o) { if (etapes.length) o.scenario = etapes.slice(); else delete o.scenario; });
    if (typeof sauvegarder === 'function') {
      sauvegarder('[admin] Sc\u00e9nario vitrine propag\u00e9 \u00e0 toutes les salles sculpture', null)
        .catch(function (e) { if (typeof toast === 'function') toast('Erreur : ' + e.message, 'err'); });
    }
    if (typeof toast === 'function') toast('Sc\u00e9nario appliqu\u00e9 \u00e0 ' + cibles.length + ' salle(s).');
  });
  if (!aVitrine) { btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed'; }
  wrap.appendChild(btn);

  if (!aVitrine) {
    note.textContent = 'Aucune vitrine dans cette salle \u2014 ajoutez-en une pour activer les sc\u00e9narios.';
    wrap.style.opacity = '.6';
  }

  tdb.appendChild(wrap);
}

/* ── Toggle greffon on/off ── */
function _toggleGreffon(greffon) {
  if (!salleActive) return;
  if (!salleActive.greffons) salleActive.greffons = {};
  var g = salleActive.greffons;
  if (!g[greffon]) g[greffon] = { actif: false };
  g[greffon].actif = !g[greffon].actif;
  var etat = g[greffon].actif ? 'activé' : 'désactivé';
  /* Desactivation d'une presentation -> retirer la vue correspondante du scenario. */
  if (!g[greffon].actif && salleActive.scenario) {
    var vue = (greffon === 'immersive') ? 'imm' : (greffon === 'descriptive') ? 'desc' : null;
    if (vue) {
      var etapes = _normScenarioAdmin(salleActive.scenario);
      if (etapes.indexOf(vue) >= 0) {
        etapes = etapes.filter(function (e) { return e !== vue; });
        if (etapes.length) salleActive.scenario = etapes; else delete salleActive.scenario;
      }
    }
  }
  _renderTDB();
  /* Sauvegarder immédiatement */
  if (typeof sauvegarder === 'function') {
    sauvegarder('[admin] Greffon ' + greffon + ' ' + etat + ' — ' + (salleActive.nom || 'salle'), null)
      .catch(function(e) { if (typeof toast === 'function') toast('Erreur : ' + e.message, 'err'); });
  }
}

/* ── Entrer dans l'éditeur d'une vue (ouvre l'arranger directement) ── */
function entrerVue(facette) {
  _tdbFacetteActive = facette;
  var meta = FACETTES_META[facette] || {};
  /* Type de la salle active (pas type de l'admin) — pour cohabitation peinture+sculpture */
  var typeSalle = (salleActive && salleActive.type)
    ? salleActive.type
    : (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture');
  var _isSculptType = (typeSalle === 'sculpture');

  /* Greffons → éditeur dédié */
  if (meta.greffon) {
    if (facette === 'immersive' && typeof ouvrirEditeurImmersif === 'function') {
      ouvrirEditeurImmersif(salleActive);
    } else if (facette === 'descriptive' && typeof ouvrirEditeurDescriptif === 'function') {
      ouvrirEditeurDescriptif(salleActive);
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

  /* L'arrangeur (afficherStripPlacement) liste désormais TOUTES les œuvres
     du type de la salle via idsValides. Le pré-cochage automatique de
     toilesSelectionnees n'est plus nécessaire et déclenchait un faux warning
     'ces toiles sont dans une autre salle' pour chaque œuvre déjà placée
     ailleurs (cas visible chez Fred : 30+ toiles listées au clic Modifier). */
  if (typeof toilesSelectionnees !== 'undefined') {
    toilesSelectionnees.clear();
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

  /* Pièce à afficher : première sculpture avec GLB (filtre cohabitation) */
  var _piecesEdit = (typeof toiles !== 'undefined')
    ? toiles.filter(function(t){ return ((t._type)||ADMIN_CFG.type) === 'sculpture'; })
    : [];
  var piece = _piecesEdit.find(function(t) { return t.glb; }) || _piecesEdit[0] || {};

  /* Injecter les données quand l'iframe est prête */
  function onMsg(e) {
    if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
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
  panTitre.textContent = (salle.nom || 'Salle') + ' — Salle Immersive';
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

    var hexInp = document.createElement('input');
    hexInp.type = 'text';
    hexInp.maxLength = 7;
    hexInp.value = decor[champ.key] || champ.defaut;
    hexInp.style.cssText = 'width:5rem;font-size:.65rem;padding:.2rem .3rem;border:1px solid var(--brd);border-radius:4px;background:var(--bg3);color:var(--text);font-family:monospace;';

    var copyBtn = document.createElement('button');
    copyBtn.title = 'Copier';
    copyBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:.75rem;padding:0 2px;color:var(--muted);line-height:1;flex-shrink:0;';
    copyBtn.textContent = '⎘';

    (function(k, p, inp, btn) {
      /* Applique un hex valide */
      function appliquerHex(hex) {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
        hex = hex.toLowerCase();
        p.style.background = hex;
        p.title = hex;
        inp.value = hex;
        decor[k] = hex;
        iframe.contentWindow.postMessage({ type: 'immersive-decor-update', decor: decor }, '*');
        return true;
      }

      /* Picker */
      p.addEventListener('click', function() {
        if (typeof ouvrirPickerCouleur !== 'function') return;
        window._supportPickerCouleur   = p.title;
        window._supportPickerOnConfirm = function(hex) { appliquerHex(hex); };
        ouvrirPickerCouleur('support');
        var titreEl = document.getElementById('picker-titre');
        if (titreEl) titreEl.textContent = 'Couleur — ' + champ.label;
      });

      /* Sélectionner tout au focus (facilite coller-remplace) */
      inp.addEventListener('focus', function() { inp.select(); });

      /* Saisie live — normalise les ## en # */
      inp.addEventListener('input', function() {
        var v = inp.value.trim().replace(/^#+/, '#');
        appliquerHex(v);
      });

      /* Restaurer si invalide au blur */
      inp.addEventListener('blur', function() {
        var v = inp.value.trim().replace(/^#+/, '#');
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) inp.value = p.title;
        else if (v !== inp.value) inp.value = v;
      });

      /* Copier */
      btn.addEventListener('click', function() {
        navigator.clipboard && navigator.clipboard.writeText(inp.value).then(function() {
          btn.textContent = '✓';
          setTimeout(function() { btn.textContent = '⎘'; }, 1200);
        });
      });
    })(champ.key, pastille, hexInp, copyBtn);

    if (champ.key === 'socle_couleur') row.dataset.socleRow = '1';
    row.appendChild(lbl);
    row.appendChild(pastille);
    row.appendChild(hexInp);
    row.appendChild(copyBtn);
    panel.appendChild(row);
  });

  /* Checkbox socle_use_piece */
  var cbRow = document.createElement('div');
  cbRow.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin:.2rem 0 .4rem;';
  var cb = document.createElement('input');
  cb.type = 'checkbox'; cb.id = 'cb-socle-piece';
  cb.checked = !!(decor.socle_use_piece);
  cb.style.cssText = 'accent-color:var(--gold);cursor:pointer;';
  var cbLbl = document.createElement('label');
  cbLbl.htmlFor = 'cb-socle-piece';
  cbLbl.style.cssText = 'font-size:.65rem;color:var(--muted);cursor:pointer;line-height:1.3;';
  cbLbl.textContent = "Reprendre la couleur du support de l\u0027\u0153uvre";
  cb.addEventListener('change', function() {
    decor.socle_use_piece = cb.checked;
    /* Griser le picker socle si case cochée */
    var socleLo = panel.querySelector('[data-socle-row]');
    if (socleLo) socleLo.style.opacity = cb.checked ? '.4' : '1';
    iframe.contentWindow.postMessage({ type: 'immersive-decor-update', decor: decor }, '*');
  });
  cbRow.appendChild(cb);
  cbRow.appendChild(cbLbl);
  panel.appendChild(cbRow);

  /* Slider exposition */
  var expRow = document.createElement('div');
  expRow.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin:.4rem 0 .1rem;';
  var expLbl = document.createElement('span');
  expLbl.style.cssText = 'font-size:.7rem;color:var(--muted);width:2.8rem;flex-shrink:0;';
  expLbl.textContent = 'Expo.';
  var expSlider = document.createElement('input');
  expSlider.type = 'range'; expSlider.min = '0.5'; expSlider.max = '3.0'; expSlider.step = '0.1';
  expSlider.value = String(decor.exposure || 1.0);
  expSlider.style.cssText = 'flex:1;accent-color:var(--gold);';
  var expVal = document.createElement('span');
  expVal.style.cssText = 'font-size:.65rem;color:var(--muted);width:2rem;text-align:right;font-family:monospace;';
  expVal.textContent = parseFloat(expSlider.value).toFixed(1);
  expSlider.addEventListener('input', function() {
    expVal.textContent = parseFloat(expSlider.value).toFixed(1);
    decor.exposure = parseFloat(expSlider.value);
    iframe.contentWindow.postMessage({ type: 'immersive-decor-update', decor: decor }, '*');
  });
  expRow.appendChild(expLbl);
  expRow.appendChild(expSlider);
  expRow.appendChild(expVal);
  panel.appendChild(expRow);

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

/* ══════════════════════════════════════════════════════
   ÉDITEUR DESCRIPTIF — overlay avec aperçu CSS live
   ══════════════════════════════════════════════════════ */
function ouvrirEditeurDescriptif(salle) {
  if (!salle) return;
  if (document.getElementById('overlay-desc-edit')) return;

  var decor = Object.assign({}, DECOR_DESCRIPTIVE_DEFAUT,
    (salle.greffons && salle.greffons.descriptive && salle.greffons.descriptive.decor) || {});

  var _CHAMPS_DESC = [
    { key: 'pan_a', label: 'Panneau A', defaut: DECOR_DESCRIPTIVE_DEFAUT.pan_a },
    { key: 'pan_b', label: 'Panneau B', defaut: DECOR_DESCRIPTIVE_DEFAUT.pan_b },
    { key: 'pan_c', label: 'Panneau C', defaut: DECOR_DESCRIPTIVE_DEFAUT.pan_c },
    { key: 'pan_d', label: 'Panneau D', defaut: DECOR_DESCRIPTIVE_DEFAUT.pan_d }
  ];

  /* ── Overlay ── */
  var overlay = document.createElement('div');
  overlay.id = 'overlay-desc-edit';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;background:#111;';

  /* ── Aperçu : iframe model-viewer (même pièce que la carte TDB) ── */
  var apercu = document.createElement('div');
  apercu.style.cssText = 'flex:1;position:relative;background:#1a1510;';

  var apercuBase = (typeof ADMIN_CFG !== 'undefined')
    ? ADMIN_CFG.repoPath.replace(/data\/?$/, '') : '';
  /* Aperçu salle descriptive (sculpture only) : prendre une sculpture */
  var _piecesDesc = (typeof toiles !== 'undefined')
    ? toiles.filter(function(t){ return ((t._type)||ADMIN_CFG.type) === 'sculpture'; })
    : [];
  var aperçuPiece = _piecesDesc.length
    ? _piecesDesc.slice().sort(function(a,b){ return a.id - b.id; })[0] : null;

  var iframeDesc = document.createElement('iframe');
  iframeDesc.src = apercuBase + 'descriptive-apercu.html?v=' + Date.now();
  iframeDesc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  iframeDesc.tabIndex = -1;

  function _envoyerDecorDesc() {
    try {
      iframeDesc.contentWindow.postMessage({ type: 'descriptive-decor-update', decor: decor }, '*');
    } catch(e) {}
  }

  (function(ifr) {
    function onMsg(e) {
      if (!ifr.contentWindow || e.source !== ifr.contentWindow) return;
      if (e.data && e.data.type === 'descriptive-awaiting-data') {
        ifr.contentWindow.postMessage({ type: 'descriptive-init', piece: aperçuPiece || {}, decor: decor }, '*');
        window.removeEventListener('message', onMsg);
      }
    }
    window.addEventListener('message', onMsg);
  })(iframeDesc);

  apercu.appendChild(iframeDesc)

  /* ── Panneau de contrôle ── */
  var panel = document.createElement('div');
  panel.className = 'imm-edit-panel';

  var panTitre = document.createElement('div');
  panTitre.style.cssText = 'font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;';
  panTitre.textContent = (salle.nom || 'Salle') + ' — Descriptive';
  panel.appendChild(panTitre);

  /* 4 lignes de couleur */
  _CHAMPS_DESC.forEach(function(champ) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;';

    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:.7rem;color:var(--muted);width:2.8rem;flex-shrink:0;';
    lbl.textContent = champ.label;

    var pastille = document.createElement('div');
    pastille.className = 'tdb-decor-pastille';
    pastille.style.background = decor[champ.key] || champ.defaut;
    pastille.title = decor[champ.key] || champ.defaut;

    var hexInp = document.createElement('input');
    hexInp.type = 'text'; hexInp.maxLength = 7;
    hexInp.value = decor[champ.key] || champ.defaut;
    hexInp.style.cssText = 'width:5rem;font-size:.65rem;padding:.2rem .3rem;border:1px solid var(--brd);border-radius:4px;background:var(--bg3);color:var(--text);font-family:monospace;';

    var copyBtn = document.createElement('button');
    copyBtn.title = 'Copier';
    copyBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:.75rem;padding:0 2px;color:var(--muted);line-height:1;flex-shrink:0;';
    copyBtn.textContent = '⎘';

    (function(k, p, inp, btn) {
      function appliquerHex(hex) {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
        hex = hex.toLowerCase();
        p.style.background = hex; p.title = hex; inp.value = hex;
        decor[k] = hex; _envoyerDecorDesc(); return true;
      }
      p.addEventListener('click', function() {
        if (typeof ouvrirPickerCouleur !== 'function') return;
        window._supportPickerCouleur   = p.title;
        window._supportPickerOnConfirm = function(hex) { appliquerHex(hex); };
        ouvrirPickerCouleur('support');
        var t = document.getElementById('picker-titre');
        if (t) t.textContent = 'Couleur — ' + champ.label;
      });
      inp.addEventListener('focus', function() { inp.select(); });
      inp.addEventListener('input', function() {
        appliquerHex(inp.value.trim().replace(/^#+/, '#'));
      });
      inp.addEventListener('blur', function() {
        var v = inp.value.trim().replace(/^#+/, '#');
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) inp.value = p.title;
      });
      btn.addEventListener('click', function() {
        navigator.clipboard && navigator.clipboard.writeText(inp.value).then(function() {
          btn.textContent = '✓'; setTimeout(function() { btn.textContent = '⎘'; }, 1200);
        });
      });
    })(champ.key, pastille, hexInp, copyBtn);

    row.appendChild(lbl); row.appendChild(pastille);
    row.appendChild(hexInp); row.appendChild(copyBtn);
    panel.appendChild(row);
  });

  /* Séparateur + boutons */
  var sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--brd);margin:.5rem 0;';
  panel.appendChild(sep);

  var btnSave = document.createElement('button');
  btnSave.className = 'ctrl-btn';
  btnSave.style.cssText = 'width:100%;margin-bottom:.3rem;justify-content:center;';
  btnSave.textContent = '💾 Enregistrer';
  btnSave.addEventListener('click', function() {
    btnSave.disabled = true; btnSave.textContent = 'En cours…';
    if (!salle.greffons) salle.greffons = {};
    if (!salle.greffons.descriptive) salle.greffons.descriptive = { actif: true };
    salle.greffons.descriptive.decor = Object.assign({}, decor);
    if (typeof sauvegarder === 'function') {
      sauvegarder('[admin] Décor descriptif — ' + (salle.nom || 'salle'), null)
        .then(function() {
          btnSave.disabled = false; btnSave.textContent = '✓ Enregistré';
          setTimeout(function() { btnSave.textContent = '💾 Enregistrer'; }, 2000);
          _renderTDB();
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
    overlay.remove();
    afficherTableauBord();
  });
  panel.appendChild(btnBack);

  overlay.appendChild(apercu);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
