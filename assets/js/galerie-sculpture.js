/* =============================================================
   FF_Galerie — galerie-sculpture.js
   Rendu galerie sculpture — nécessite galerie-core.js chargé avant
   Socles : photos statiques · Clic → salle d'observation 3D
   ============================================================= */

/* ── CSS sculpture ── */
(function () {
  const id = 'css-galerie-sculpture';
  if (!document.getElementById(id)) {
    const lnk = document.createElement('link');
    lnk.id = id; lnk.rel = 'stylesheet';
    lnk.href = (window.GALERIE_ASSETS_BASE || '') + 'assets/css/galerie-sculpture.css?v=' + Date.now();
    document.head.appendChild(lnk);
  }
})();

/* ── Détection mobile — peut être forcée via _GALERIE_FORCE_MOBILE (aperçu admin) ── */
function _estMobile() {
  if (window._GALERIE_FORCE_MOBILE === true)  return true;
  if (window._GALERIE_FORCE_MOBILE === false) return false;
  return window.innerWidth <= 600;
}

/* ── Facteur d'échelle px/cm (dynamique pour responsive) ──
   Les valeurs de base sont calibrées pour un viewport plein écran.
   _vpFactor réduit proportionnellement quand on rend dans un conteneur plus
   petit (mini-iframe d'aperçu admin) pour garder des socles à la bonne taille. */
function _vpFactor() {
  var ref = _estMobile() ? 390 : 1280; /* largeur de référence plein écran */
  var f = window.innerWidth / ref;
  return Math.max(0.2, Math.min(1, f)); /* borné [0.2, 1] */
}
function _getEchelle()  { return (_estMobile() ? 1.5 : 2.5) * _vpFactor(); }
function _getEMin()     { return (_estMobile() ? 55  : 90)  * _vpFactor(); }
function _getEMaxH()    { return (_estMobile() ? 200 : 380) * _vpFactor(); }

/* ── Patterns sol (miroir de admin-galerie.js) ── */
const SOL_PATTERNS_PUB = {
  parquet: 'repeating-linear-gradient(to bottom,transparent 0px,transparent 17px,rgba(0,0,0,.15) 17px,rgba(0,0,0,.15) 19px),' +
           'repeating-linear-gradient(to right,transparent 0px,transparent 58px,rgba(0,0,0,.06) 58px,rgba(0,0,0,.06) 60px)',
  carrelage: 'repeating-linear-gradient(to bottom,transparent 0px,transparent 48px,rgba(0,0,0,.22) 48px,rgba(0,0,0,.22) 50px),' +
             'repeating-linear-gradient(to right,transparent 0px,transparent 48px,rgba(0,0,0,.22) 48px,rgba(0,0,0,.22) 50px)',
  none: ''
};

function solBgCSS(texture, couleur) {
  var c = couleur || '#8a6228';
  if (/\.(jpg|jpeg|png|webp)$/i.test(texture)) return 'url("' + texture + '") center/cover,' + c;
  var pat = SOL_PATTERNS_PUB[texture] || SOL_PATTERNS_PUB.parquet;
  return pat ? (pat + ',' + c) : c;
}

/* ── SVG "photo manquante" (appareil photo barré rouge) ── */
function _svgPhotoManquante(size) {
  size = size || 48;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
    'xmlns="http://www.w3.org/2000/svg" style="opacity:.55;">' +
    '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" ' +
      'stroke="#888" stroke-width="1.5" fill="rgba(0,0,0,.04)"/>' +
    '<circle cx="12" cy="12.5" r="3.2" stroke="#888" stroke-width="1.5" fill="none"/>' +
    '<line x1="3" y1="3" x2="21" y2="21" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';
}

/* ── Chargement model-viewer (une seule fois, à la demande) ── */
function chargerModelViewer() {
  const id = 'script-model-viewer';
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id; s.type = 'module';
  s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
  document.head.appendChild(s);
}

/* ── Gabarit depuis hauteur ── */
function gabaritDepuisHauteur(h) {
  if (!h)      return 'M';
  if (h <= 25) return 'S';
  if (h <= 50) return 'M';
  if (h <= 100) return 'L';
  return 'SOL';
}

/* ══════════════════════════════════════════════════════════════
   SALLE D'OBSERVATION
   ══════════════════════════════════════════════════════════════ */
let _obsRAF = null; /* réservé pour usage futur */

/* ─── Décor par défaut de la salle descriptive ─── */
var DECOR_DESCRIPTIVE_DEFAUT = {
  pan_a: '#1a1510',
  pan_b: '#2a2018',
  pan_c: '#1a1510',
  pan_d: '#2a2018'
};

/* Applique les bandes colorées dans le div chambre */
function _appliquerBandesObservation(chambre, decor) {
  var D = Object.assign({}, DECOR_DESCRIPTIVE_DEFAUT, decor || {});
  var palette = [D.pan_a, D.pan_b, D.pan_c, D.pan_d];
  chambre.innerHTML = '';
  chambre.style.cssText = 'position:absolute;inset:0;display:flex;overflow:hidden;z-index:1;';
  for (var i = 0; i < 12; i++) {
    var band = document.createElement('div');
    band.style.cssText = 'flex:1;height:100%;background:' + palette[i % palette.length] + ';';
    chambre.appendChild(band);
  }
}

function ouvrirSalleObservation(piece, decor, avecPorteImmersive, immDecor, provenance) {
  /* Éviter les doublons */
  if (document.querySelector('.obs-overlay')) return;

  chargerModelViewer();

  const overlay = document.createElement('div');
  overlay.className = 'obs-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  /* Forcer position et dimensions en inline pour contourner les bugs overflow:hidden */
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:#1a1510;opacity:0;transition:opacity .35s ease;';

  /* ── Décor de salle — bandes colorées ── */
  const chambre = document.createElement('div');
  chambre.className = 'obs-chambre';
  _appliquerBandesObservation(chambre, decor);
  overlay.appendChild(chambre);

  /* ── Contenu — viewer plein écran, titre/meta superposés ── */
  const glbSrc = /^https?:\/\//.test(piece.glb)
    ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;

  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('src',              glbSrc);
  viewer.setAttribute('alt',              piece.titre || '');
  viewer.setAttribute('camera-controls',  '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('shadow-intensity', '1');
  viewer.setAttribute('camera-orbit',     '0deg 75deg 105%');
  viewer.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;' +
    '--poster-color:transparent;background:transparent;';
  overlay.appendChild(viewer);

  /* Titre superposé en haut */
  const titreEl = document.createElement('h2');
  titreEl.className = 'obs-titre';
  titreEl.textContent = piece.titre || '';
  titreEl.style.cssText =
    'position:absolute;top:1rem;left:0;width:100%;text-align:center;z-index:20;margin:0;' +
    'padding:8px 0;background:linear-gradient(to bottom,rgba(0,0,0,.55),rgba(0,0,0,.25),transparent);';
  overlay.appendChild(titreEl);

  /* Hint rotation — bien visible au début puis s'estompe. */
  const hint = document.createElement('div');
  hint.style.cssText =
    'position:absolute;bottom:8rem;left:0;width:100%;text-align:center;z-index:20;' +
    'font-family:Lato,sans-serif;font-size:.75rem;color:rgba(255,255,255,.85);letter-spacing:.08em;' +
    'pointer-events:none;transition:color 1.2s ease,font-size 1.2s ease;';
  hint.textContent = 'Cliquez sur l\u2019objet et glissez pour le tourner';
  overlay.appendChild(hint);
  /* Après 4s : retour à un hint discret (laisser une trace, pas un encombrement) */
  setTimeout(function() {
    hint.style.color = 'rgba(255,255,255,.25)';
    hint.style.fontSize = '.6rem';
  }, 4000);

  /* Meta superposé en bas avec backdrop */
  const meta = document.createElement('div');
  meta.style.cssText =
    'position:absolute;bottom:0;left:0;width:100%;text-align:center;z-index:20;' +
    'padding:24px 0 4.5rem;' +
    'font-family:Lato,sans-serif;font-size:.75rem;letter-spacing:.08em;color:rgba(255,255,255,.5);' +
    'background:linear-gradient(to top,rgba(0,0,0,.6),rgba(0,0,0,.2),transparent);';
  const dim   = piece.dimensions || {};
  const mParts = [];
  if (piece.materiaux && piece.materiaux.length) mParts.push(piece.materiaux.join(', '));
  const dimParts = [dim.largeur, dim.profondeur, dim.hauteur].filter(Boolean);
  if (dimParts.length) mParts.push(dimParts.join(' \u00d7 ') + '\u202fcm');
  meta.textContent = mParts.join('\u2002\u00b7\u2002');
  overlay.appendChild(meta);

  /* ── Bouton fermer ── */
  const btnFermer = document.createElement('button');
  btnFermer.className = 'obs-fermer';
  btnFermer.setAttribute('aria-label', 'Fermer');
  btnFermer.innerHTML = '\u2715';
  overlay.appendChild(btnFermer);

  /* ── Porte gauche → retour salle immersive (si greffon actif) ── */
  if (!provenance && avecPorteImmersive && typeof ouvrirSalleImmersive === 'function') {
    const porteG = document.createElement('div');
    porteG.className = 'porte-nav porte-nav--gauche';
    porteG.innerHTML = '<div class="porte-nav__arche"></div>' +
      '<span class="porte-nav__fleche">\u2190</span>' +
      '<span class="porte-nav__label">Salle</span>';
    porteG.addEventListener('click', () => {
      const ecran = document.createElement('div');
      ecran.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;';
      document.body.appendChild(ecran);
      fermer();
      setTimeout(() => {
        ouvrirSalleImmersive(piece, immDecor, decor);
        setTimeout(() => ecran.remove(), 150);
      }, 350);
    });
    overlay.appendChild(porteG);
  }

  /* ── Porte gauche → provenance (ex. retour vitrine) ── */
  if (provenance && typeof provenance.retour === 'function') {
    var _lblProv = provenance.label || 'Retour';
    var porteGP = document.createElement('div');
    porteGP.className = 'porte-nav porte-nav--gauche';
    porteGP.innerHTML = '<div class="porte-nav__arche"></div><span class="porte-nav__fleche">\u2190</span>' +
      '<span class="porte-nav__label">' + _lblProv + '</span>';
    porteGP.addEventListener('click', function () { fermer(); setTimeout(provenance.retour, 350); });
    overlay.appendChild(porteGP);
    var plaqueGP = document.createElement('div');
    plaqueGP.className = 'plaque-nav plaque-nav--gauche';
    plaqueGP.innerHTML = '<span class="plaque-nav__label">\u2190 ' + _lblProv + '</span>';
    plaqueGP.addEventListener('click', function () { fermer(); setTimeout(provenance.retour, 350); });
    overlay.appendChild(plaqueGP);
  }

  /* ── Porte droite → retour galerie ── */
  const porteD = document.createElement('div');
  porteD.className = 'porte-nav porte-nav--droite';
  porteD.innerHTML = '<div class="porte-nav__arche"></div>' +
    '<span class="porte-nav__fleche">\u2192</span>' +
    '<span class="porte-nav__label">Galerie</span>';
  porteD.addEventListener('click', fermer);
  overlay.appendChild(porteD);

  /* ── Pancartes mobiles ── */
  if (!provenance && avecPorteImmersive && typeof ouvrirSalleImmersive === 'function') {
    const plaqueG = document.createElement('div');
    plaqueG.className = 'plaque-nav plaque-nav--gauche';
    plaqueG.innerHTML = '<span class="plaque-nav__label">\u2190 Salle</span>';
    plaqueG.addEventListener('click', () => {
      const ecran = document.createElement('div');
      ecran.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;';
      document.body.appendChild(ecran);
      fermer();
      setTimeout(() => { ouvrirSalleImmersive(piece, immDecor, decor); setTimeout(() => ecran.remove(), 150); }, 350);
    });
    overlay.appendChild(plaqueG);
  }

  const plaqueD = document.createElement('div');
  plaqueD.className = 'plaque-nav plaque-nav--droite';
  plaqueD.innerHTML = '<span class="plaque-nav__label">Galerie \u2192</span>';
  plaqueD.addEventListener('click', fermer);
  overlay.appendChild(plaqueD);

  function fermer() {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow            = '';
      document.documentElement.style.overflow = '';
    }, 300);
  }

  btnFermer.addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });

  const onKey = e => { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.style.overflow             = 'hidden';
  document.documentElement.style.overflow  = 'hidden';
  window.scrollTo(0, 0);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
}


/* ══════════════════════════════════════════════════════════════
   SOCLE — photo statique + clic → salle d'observation
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   SUPPORTS — registre de rendus (socle / étagère / présentoir / aucun)
   Un support est attaché à une pièce (piece.support). Couleur + texture
   cumulées comme les murs (gradients superposés sur couleur de fond).
   ══════════════════════════════════════════════════════════════ */

/* Textures de support — gradients superposables sur une couleur de base */
const SUPPORT_TEXTURES = {
  lisse: '',
  marbre:
    'linear-gradient(155deg, transparent 20%, rgba(140,150,160,.18) 21%, rgba(140,150,160,.12) 22%, transparent 23%),' +
    'linear-gradient(168deg, transparent 48%, rgba(120,130,140,.15) 49%, rgba(120,130,140,.10) 50%, transparent 51%),' +
    'linear-gradient(140deg, transparent 70%, rgba(150,155,165,.12) 71%, rgba(150,155,165,.08) 72%, transparent 73%)',
  bois:
    'repeating-linear-gradient(90deg, transparent 0px, transparent 6px, rgba(80,50,20,.10) 6px, rgba(80,50,20,.10) 7px),' +
    'repeating-linear-gradient(90deg, transparent 0px, transparent 22px, rgba(60,35,12,.08) 22px, rgba(60,35,12,.08) 24px)',
  pierre:
    'radial-gradient(circle at 30% 30%, rgba(0,0,0,.08) 0%, transparent 25%),' +
    'radial-gradient(circle at 70% 60%, rgba(0,0,0,.06) 0%, transparent 22%),' +
    'radial-gradient(circle at 50% 80%, rgba(255,255,255,.05) 0%, transparent 20%)',
  metal:
    'linear-gradient(90deg, rgba(255,255,255,.12) 0%, rgba(0,0,0,.04) 20%, rgba(255,255,255,.10) 40%, rgba(0,0,0,.06) 60%, rgba(255,255,255,.08) 80%, rgba(0,0,0,.05) 100%)'
};

/* Ombrage cylindrique réutilisé par le socle */
const SUPPORT_CYL_SHADE =
  'linear-gradient(to right, rgba(0,0,0,.20) 0%, rgba(0,0,0,.05) 15%, rgba(255,255,255,.08) 45%,' +
  ' rgba(255,255,255,.12) 55%, rgba(0,0,0,.04) 80%, rgba(0,0,0,.18) 100%)';

/* Construit le background CSS cumulé : texture (gradients) + ombrage + couleur */
/* Éclaircit (f>0) ou assombrit (f<0) une couleur hex de facteur f ∈ [-1,1] */
function _teinte(hex, f) {
  hex = (hex || '#eae6de').replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  if (f >= 0) { r += (255-r)*f; g += (255-g)*f; b += (255-b)*f; }
  else        { r *= (1+f);     g *= (1+f);     b *= (1+f); }
  var h = function(v){ return ('0'+Math.round(Math.max(0,Math.min(255,v))).toString(16)).slice(-2); };
  return '#' + h(r) + h(g) + h(b);
}

function supportBgCSS(support, withShade) {
  var coul = (support && support.couleur) || '#eae6de';
  var tex  = (support && support.texture) || 'marbre';
  var pat  = SUPPORT_TEXTURES[tex] || '';
  var layers = [];
  if (pat) layers.push(pat);
  if (withShade) layers.push(SUPPORT_CYL_SHADE);
  return layers.length ? (layers.join(',') + ',' + coul) : coul;
}

/* Chaque renderer dessine un piédestal et retourne l'élément (ou null pour "aucun").
   photoH = hauteur de la photo en px (pour proportionner). */
const SUPPORT_RENDERERS = {
  aucun: function() { return null; },

  socle: function(support, photoH, gCode) {
    var ped = document.createElement('div');
    ped.className = 'socle-piedestal socle-piedestal--' + gCode;
    ped.style.background = supportBgCSS(support, true);
    var coul = (support && support.couleur) || '#eae6de';
    ped.style.backgroundColor = coul;
    /* Plateau (plus clair) et base (plus sombre) dérivés de la couleur */
    ped.style.setProperty('--socle-top-1', _teinte(coul, 0.22));
    ped.style.setProperty('--socle-top-2', _teinte(coul, 0.10));
    ped.style.setProperty('--socle-top-3', _teinte(coul, -0.04));
    ped.style.setProperty('--socle-bot-1', _teinte(coul, -0.08));
    ped.style.setProperty('--socle-bot-2', _teinte(coul, -0.18));
    if (gCode !== 'sol') {
      var hPx;
      if (support && support.hauteur) {
        /* Hauteur explicite en cm → px via l'échelle stable */
        hPx = Math.round(support.hauteur * _getEchelle());
      } else {
        /* Auto : 70% de la hauteur de la sculpture, plafonné */
        hPx = Math.min(200, Math.round(photoH * 0.7));
      }
      ped.style.height = Math.max(8, hPx) + 'px';
    }
    return ped;
  },

  etagere: function(support, photoH, gCode) {
    /* Plateau large et bas — la pièce repose dessus, plusieurs étagères alignées
       paraissent continues (pas de fusion, continuité visuelle). */
    var ped = document.createElement('div');
    ped.className = 'support-etagere';
    var h = Math.max(14, Math.round(photoH * 0.22));
    ped.style.cssText =
      'position:relative;width:130%;height:' + h + 'px;border-radius:3px;' +
      'background:' + supportBgCSS(support, false) + ';background-color:' + ((support && support.couleur) || '#cbb89a') + ';' +
      'box-shadow:0 4px 10px rgba(0,0,0,.22),inset 0 2px 0 rgba(255,255,255,.10);';
    return ped;
  },

  presentoir: function(support, photoH, gCode) {
    /* Colonne fine et élégante avec base et chapiteau */
    var ped = document.createElement('div');
    ped.className = 'support-presentoir';
    var h = Math.min(220, Math.round(photoH * 0.9));
    ped.style.cssText =
      'position:relative;width:55%;height:' + h + 'px;border-radius:4px 4px 2px 2px;' +
      'background:' + supportBgCSS(support, true) + ';background-color:' + ((support && support.couleur) || '#eae6de') + ';' +
      'box-shadow:2px 3px 8px rgba(0,0,0,.18);';
    /* Base élargie — centrée sous la colonne */
    var base = document.createElement('div');
    base.style.cssText =
      'position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:150%;height:10px;border-radius:3px;' +
      'background:' + ((support && support.couleur) || '#ddd8d0') + ';box-shadow:0 2px 5px rgba(0,0,0,.2);';
    ped.appendChild(base);
    return ped;
  }
};

function renderSupport(piece, photoH, gCode) {
  /* Rétro-compat : ancien sans_socle → type "aucun" */
  var support = piece.support;
  if (!support) {
    support = piece.sans_socle ? { type: 'aucun' } : { type: 'socle' };
  }
  var fn = SUPPORT_RENDERERS[support.type] || SUPPORT_RENDERERS.socle;
  return { el: fn(support, photoH, gCode), type: support.type };
}

function creerSocle(piece, gabarit, pos, opts) {
  /* Greffons passés par le renderer (opts évite d'accéder à des vars hors scope) */
  var _immActif  = opts && opts.immActif  || false;
  var _descActif = opts && opts.descActif || false;
  var _immDecor  = (opts && opts.immDecor)  || null;
  var _descDecor = (opts && opts.descDecor) || null;
  const gCode = (gabarit && gabarit.code) ? gabarit.code.toLowerCase() : 'm';

  const wrapper = document.createElement('div');
  wrapper.className             = 'socle-wrapper';
  wrapper.style.left            = pos.x + '%';
  wrapper.style.bottom          = pos.y + '%';
  wrapper.style.transformOrigin = 'bottom center';
  const scale = (1 - (pos.y / 100) * 0.42).toFixed(3);
  wrapper.style.transform = 'translateX(-50%) scale(' + scale + ')';
  wrapper.style.zIndex    = String(Math.round((100 - pos.y) * 10));

  const dim    = piece.dimensions || {};
  const hCm    = dim.hauteur || 50;
  const lCm    = dim.largeur || 30;
  const ratio  = hCm / lCm;
  const pCm    = dim.profondeur || Math.round(lCm * 0.5);
  const socleDiam = (piece.support && piece.support.taille) || piece.socle || pCm;
  const photoH = Math.min(_getEMaxH(),
    Math.max(_getEMin(), Math.round(hCm * _getEchelle() * (ratio < 1 ? ratio : 1))));
  /* Échelle effective = même rapport que la pièce (plafonnée) */
  const effScale = photoH / hCm;
  /* Le socle a sa propre échelle stable (px/cm), indépendante de effScale qui
     explose pour les pièces plates (photoH plafonné à EMin → ratio énorme). */
  const socleScale = _getEchelle(); /* px par cm, même base que la galerie */
  const tailleExplicite = !!(piece.support && piece.support.taille);
  const plafondW = tailleExplicite ? Math.round(photoH * 2.5) : Math.round(photoH * 0.6);
  const socleW = Math.max(_getEMin() * 0.5,
    Math.min(plafondW, Math.round(socleDiam * socleScale)));

  const hasGlb = !!piece.glb;

  const socle = document.createElement('div');
  socle.className = 'socle socle--' + gCode;
  socle.setAttribute('aria-label', piece.titre || 'Sculpture');
  socle.style.width = socleW + 'px';
  if (hasGlb) { socle.tabIndex = 0; socle.style.cursor = 'pointer'; }

  /* Aperçu visuel sur le socle — photo (thumbnail) prioritaire car centrée
     proprement ; le model-viewer 3D ne sert que si pas de photo. */
  if (piece.photo || piece._preview) {
    const img = document.createElement('img');
    img.className = 'socle-photo';
    img.alt = piece.titre || ''; img.loading = 'lazy'; img.decoding = 'async';
    img.style.height = photoH + 'px';
    img.style.width = 'auto';
    img.style.maxWidth = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    img.style.position = 'relative';
    img.style.zIndex = '5';
    const src = piece.photo
      ? (/^https?:\/\//.test(piece.photo) ? piece.photo : GALERIE_CFG.assetsBase + piece.photo)
      : '';
    /* _preview = base64 frais (juste régénéré, pas encore propagé au CDN) → priorité */
    img.onerror = function() {
      if (!this._fb && src) { this._fb = true; this.loading = 'lazy'; this.src = src; }
      else { this.style.display = 'none'; }
    };
    img.src = piece._preview || src;
    socle.appendChild(img);
  } else {
    /* Pas de photo (thumbnail manquant / génération échouée) → placeholder
       "appareil photo barré". On n'utilise pas le model-viewer 3D ici car son
       cadrage est décalé ; l'admin peut uploader une photo perso. */
    const ph = document.createElement('div');
    ph.className = 'socle-placeholder socle-photo-manquante';
    ph.style.cssText = 'height:' + photoH + 'px;width:' + Math.round(photoH * 0.8) + 'px;display:flex;align-items:center;justify-content:center;position:relative;z-index:5;';
    ph.innerHTML = _svgPhotoManquante(Math.round(photoH * 0.5));
    socle.appendChild(ph);
  }

  /* Badge 3D */
  if (hasGlb) {
    const badge = document.createElement('span');
    badge.className = 'socle-badge-3d'; badge.textContent = '3D';
    socle.appendChild(badge);
  }

  /* Support (socle / étagère / présentoir / aucun) via le registre */
  var sup = renderSupport(piece, photoH, gCode);
  if (sup.el) {
    if (sup.type === 'socle') {
      /* Le socle porte l'ombre interne, comme avant */
      var ombre = document.createElement('div');
      ombre.className = 'socle-ombre';
      sup.el.appendChild(ombre);
    }
    socle.appendChild(sup.el);
  }
  if (!sup.el || sup.type === 'aucun') {
    /* Pas de support — ombre seule au sol sous la pièce */
    var ombreSeule = document.createElement('div');
    ombreSeule.className = 'socle-ombre';
    ombreSeule.style.position = 'relative';
    ombreSeule.style.bottom = '0';
    ombreSeule.style.marginTop = '2px';
    socle.appendChild(ombreSeule);
  }

  /* Titre */
  if (piece.titre) {
    const titre = document.createElement('div');
    titre.className = 'socle-titre'; titre.textContent = piece.titre;
    socle.appendChild(titre);
  }

  /* Clic → greffon actif sur la salle (immersive > descriptive, sinon rien) */
  if (hasGlb && !window._GALERIE_READONLY && !window._GALERIE_EDIT
      && (_immActif || _descActif)) {
    const ouvrir = () => {
      if (_immActif && typeof ouvrirSalleImmersive === 'function') {
        ouvrirSalleImmersive(piece, _immDecor, _descDecor);
      } else if (_descActif && typeof ouvrirSalleObservation === 'function') {
        ouvrirSalleObservation(piece, _descDecor, _immActif, _immDecor);
      }
    };
    socle.style.cursor = 'pointer';
    socle.addEventListener('click', ouvrir);
    socle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); }
    });
  }

  wrapper.appendChild(socle);
  return wrapper;
}

/* ══════════════════════════════════════════════════════════════
   ÉCRAN VITRINE — clic sur une étagère → grille des œuvres qu'elle contient.
   Immersif actif → objets 3D (model-viewer auto-rotate), sinon photos.
   Clic sur un objet → salle d'observation (si descriptif), retour = vitrine.
   ══════════════════════════════════════════════════════════════ */
function ouvrirVitrine(piece, pieces, opts) {
  if (document.querySelector('.vitrine-overlay')) return;
  var immActif  = !!(opts && opts.immActif);
  var descActif = !!(opts && opts.descActif);
  var immDecor  = (opts && opts.immDecor)  || null;
  var descDecor = (opts && opts.descDecor) || null;
  if (immActif && typeof chargerModelViewer === 'function') chargerModelViewer();

  var overlay = document.createElement('div');
  overlay.className = 'vitrine-overlay';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;' +
    'background:linear-gradient(180deg,#0e0a06,#1c140c);opacity:0;transition:opacity .35s ease;';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #33271a;';
  var titre = document.createElement('h2');
  titre.textContent = piece.titre || 'Vitrine';
  titre.style.cssText = 'flex:1;margin:0;font-family:Cinzel,serif;font-size:18px;color:#f0d080;';
  var btnX = document.createElement('button');
  btnX.setAttribute('aria-label', 'Fermer'); btnX.innerHTML = '\u2715';
  btnX.style.cssText = 'width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);' +
    'background:rgba(0,0,0,.35);color:#fff;font-size:16px;cursor:pointer;';
  head.appendChild(titre); head.appendChild(btnX);
  overlay.appendChild(head);

  /* Corps = GROS PLAN d'une vitrine en relief : objets (photos) posés sur des planches en bois */
  var body = document.createElement('div');
  body.style.cssText = 'position:relative;flex:1;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;' +
    'padding:20px 14px 0;background:radial-gradient(ellipse at 50% 18%,rgba(240,208,128,.10),transparent 60%);';
  /* sol chaud : la vitrine repose dessus (sinon elle flotte dans le noir) */
  var solV = document.createElement('div');
  solV.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:30%;pointer-events:none;z-index:0;' +
    'background:linear-gradient(180deg,rgba(0,0,0,.38) 0%,#4a3418 22%,#6a4c24 70%,#7e5c30 100%);' +
    'box-shadow:inset 0 18px 30px rgba(0,0,0,.45);';

  var contenu  = piece.contenu || {};
  var couleurV = piece.couleur || '#6a4b28';
  var nPv = Math.min(8, Math.max(1, piece.planches || 3));
  var nSv = Math.min(8, Math.max(1, piece.places   || 4));
  var maxW  = Math.min(window.innerWidth - 28, 620);
  var postW = 14;
  var slotW = Math.max(64, Math.floor((maxW - 2 * postW - (nSv + 1) * 10) / nSv));
  var availH = Math.max(220, (window.innerHeight || 700) - 130);
  var slotH = Math.max(48, Math.min(Math.round(slotW * 1.2), Math.floor(availH / nPv) - 28));

  var styleV   = (piece.style === 'vitree') ? 'vitree' : 'bois';
  var estBois  = (styleV === 'bois');
  var portesOuv = (piece.portes === 'ouvertes');
  var postCol  = estBois ? _teinte(couleurV, -0.30) : '#141414';
  var topCol   = estBois ? _teinte(couleurV, -0.22) : '#141414';
  var backCol  = estBois ? _teinte(couleurV, -0.16) : '#8a8a86';   /* gris souris */

  var cabinet = document.createElement('div');
  cabinet.style.cssText = 'position:relative;box-sizing:border-box;display:flex;flex-direction:column-reverse;' +
    'max-width:' + maxW + 'px;border-radius:' + (estBois ? '6px' : '4px') + ';background:' + backCol + ';' +
    'border-left:' + postW + 'px solid ' + postCol + ';border-right:' + postW + 'px solid ' + postCol + ';' +
    'border-top:12px solid ' + topCol + ';border-bottom:14px solid ' + postCol + ';' +
    (estBois ? 'box-shadow:0 26px 55px rgba(0,0,0,.6),inset 0 0 34px rgba(0,0,0,.5);'
             : 'box-shadow:0 26px 55px rgba(0,0,0,.6),inset 0 0 26px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.06);');

  /* Fond : 6 lattes verticales (bois) ; panneau gris uni (vitrée) */
  /* Fond + parois latérales CONVERGENTES (perspective de boîte) — bois ET vitrée */
  (function () {
    var back = document.createElement('div');
    back.style.cssText = 'position:absolute;inset:0;z-index:0;display:flex;pointer-events:none;overflow:hidden;';
    if (estBois) {
      for (var L = 0; L < 6; L++) {
        var latte = document.createElement('div');
        latte.style.cssText = 'flex:1;height:100%;box-shadow:inset -2px 0 3px rgba(0,0,0,.24);' +
          'background:linear-gradient(90deg,' + _teinte(couleurV, -0.20) + ' 0%,' + _teinte(couleurV, -0.08) + ' 42%,' + _teinte(couleurV, -0.12) + ' 100%);';
        back.appendChild(latte);
      }
    } else {
      var grey = document.createElement('div');   /* fond dérivé de la couleur (comme le bois) */
      grey.style.cssText = 'flex:1;height:100%;background:linear-gradient(180deg,' + _teinte(couleurV, -0.02) + ',' + _teinte(couleurV, -0.14) + ');';
      back.appendChild(grey);
    }
    var wLbg = estBois
      ? 'background:linear-gradient(90deg,' + _teinte(couleurV, 0.10) + ' 0%,' + _teinte(couleurV, -0.34) + ' 100%);'
      : 'background:linear-gradient(100deg,rgba(255,255,255,.18),transparent 32%),linear-gradient(90deg,' + _teinte(couleurV, 0.18) + ' 0%,' + _teinte(couleurV, -0.34) + ' 100%);';
    var wRbg = estBois
      ? 'background:linear-gradient(270deg,' + _teinte(couleurV, 0.10) + ' 0%,' + _teinte(couleurV, -0.34) + ' 100%);'
      : 'background:linear-gradient(260deg,rgba(255,255,255,.18),transparent 32%),linear-gradient(270deg,' + _teinte(couleurV, 0.18) + ' 0%,' + _teinte(couleurV, -0.34) + ' 100%);';
    var wallL = document.createElement('div');
    wallL.style.cssText = 'position:absolute;top:0;bottom:0;left:0;width:16%;box-shadow:inset -4px 0 7px rgba(0,0,0,.34);' +
      'clip-path:polygon(0 0,100% 8%,100% 92%,0 100%);' + wLbg;
    var wallR = document.createElement('div');
    wallR.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:16%;box-shadow:inset 4px 0 7px rgba(0,0,0,.34);' +
      'clip-path:polygon(0 8%,100% 0,100% 100%,0 92%);' + wRbg;
    back.appendChild(wallL); back.appendChild(wallR);
    cabinet.appendChild(back);
  })();

  for (var plv = 1; plv <= nPv; plv++) {
    var shelf = document.createElement('div');
    shelf.style.cssText = 'position:relative;z-index:1;';

    /* Zone objets — ils REPOSENT sur la planche (base collée au plateau) */
    var niche = document.createElement('div');
    niche.style.cssText = 'position:relative;display:flex;justify-content:space-evenly;align-items:flex-end;' +
      'gap:10px;padding:20px 12px 0;' +
      (estBois ? 'background:linear-gradient(180deg,rgba(0,0,0,.18) 0%,rgba(0,0,0,0) 42%);'
               : 'background:linear-gradient(180deg,rgba(0,0,0,.20) 0%,rgba(255,255,255,.03) 55%);');
    var light = document.createElement('div');
    light.style.cssText = 'position:absolute;top:0;left:50%;width:82%;height:52%;transform:translateX(-50%);' +
      'background:radial-gradient(ellipse at center top,rgba(255,240,200,.18),transparent 70%);pointer-events:none;';
    niche.appendChild(light);

    for (var slv = 1; slv <= nSv; slv++) {
      var cell = document.createElement('div');
      cell.style.cssText = 'width:' + slotW + 'px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;';
      var oev = pieces[contenu['' + (plv * 10 + slv)]];
      if (oev && oev.photo) {
        var img = document.createElement('img');
        img.src = /^https?:\/\//.test(oev.photo) ? oev.photo : ((GALERIE_CFG.assetsBase || '') + oev.photo);
        img.alt = oev.titre || ''; img.loading = 'lazy';
        img.style.cssText = 'max-width:100%;max-height:' + slotH + 'px;object-fit:contain;object-position:center bottom;' +
          'position:relative;z-index:2;filter:drop-shadow(0 4px 3px rgba(0,0,0,.5));';
        if (descActif) {
          img.style.cursor = 'pointer';
          (function (oeu) {
            img.addEventListener('click', function () {
              fermer();
              setTimeout(function () {
                ouvrirSalleObservation(oeu, descDecor, false, immDecor,
                  { label: 'Vitrine', retour: function () { ouvrirVitrine(piece, pieces, opts); } });
              }, 320);
            });
          })(oev);
        }
        cell.appendChild(img);
        var contact = document.createElement('div');   /* ombre de contact sur le plateau */
        contact.style.cssText = 'width:78%;height:9px;margin-top:-3px;border-radius:50%;z-index:1;' +
          'background:radial-gradient(ellipse at center,rgba(0,0,0,.55),transparent 72%);';
        cell.appendChild(contact);
      } else {
        cell.style.height = slotH + 'px';
      }
      niche.appendChild(cell);
    }
    shelf.appendChild(niche);

    if (estBois) {
      /* PLATEAU (dessus du bois, vu un peu de dessus, léger veinage) + TRANCHE (épaisseur) */
      var plateau = document.createElement('div');
      plateau.style.cssText = 'position:relative;z-index:3;height:16px;' +
        'box-shadow:inset 0 3px 4px rgba(0,0,0,.30),inset 0 -1px 0 rgba(255,255,255,.38);' +
        'background:linear-gradient(180deg,' + _teinte(couleurV, -0.12) + ' 0%,' + _teinte(couleurV, 0.12) + ' 60%,' + _teinte(couleurV, 0.22) + ' 100%);';
      var tranche = document.createElement('div');
      tranche.style.cssText = 'position:relative;z-index:3;height:14px;border-radius:0 0 2px 2px;box-shadow:0 8px 12px rgba(0,0,0,.5);' +
        'background:linear-gradient(180deg,' + _teinte(couleurV, 0.00) + ',' + _teinte(couleurV, -0.22) + ');';
      shelf.appendChild(plateau); shelf.appendChild(tranche);
    } else {
      /* étagère en VERRE : plateau translucide VISIBLE (objets posés dessus) + arête brillante */
      var vplateau = document.createElement('div');
      vplateau.style.cssText = 'position:relative;z-index:3;height:13px;' +
        'background:linear-gradient(180deg,rgba(205,222,225,.30) 0%,rgba(234,245,247,.5) 100%);' +
        'box-shadow:inset 0 2px 3px rgba(255,255,255,.32),inset 0 -1px 0 rgba(255,255,255,.7);';
      var vedge = document.createElement('div');
      vedge.style.cssText = 'position:relative;z-index:3;height:5px;border-radius:0 0 2px 2px;' +
        'background:linear-gradient(180deg,rgba(255,255,255,.6),rgba(140,158,162,.25));box-shadow:0 6px 10px rgba(0,0,0,.4);';
      shelf.appendChild(vplateau); shelf.appendChild(vedge);
    }
    cabinet.appendChild(shelf);
  }

  /* Pieds — deux montants aux angles avant */
  var pieds = document.createElement('div');
  pieds.style.cssText = 'position:absolute;left:0;right:0;bottom:-24px;height:24px;z-index:0;pointer-events:none;' +
    'display:flex;justify-content:space-between;';
  [0, 1].forEach(function () {
    var pied = document.createElement('div');
    pied.style.cssText = estBois
      ? 'width:20px;height:24px;border-radius:0 0 3px 3px;box-shadow:0 6px 7px rgba(0,0,0,.5);' +
        'background:linear-gradient(180deg,' + _teinte(couleurV, -0.26) + ',' + _teinte(couleurV, -0.42) + ');'
      : 'width:9px;height:26px;box-shadow:0 6px 7px rgba(0,0,0,.55);background:linear-gradient(180deg,#3a3a3a,#0a0a0a);';
    pieds.appendChild(pied);
  });
  cabinet.appendChild(pieds);

  /* Vitrée : doubles portes vitrées (côtés/fond gérés par la couche back) */
  if (!estBois) {
    var portes = document.createElement('div');
    portes.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;perspective:1400px;';
    var makeDoor = function (sideLeft) {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;top:0;bottom:0;width:calc(50% - 15px);box-sizing:border-box;border:3px solid #0e0e0e;' +
        (sideLeft ? 'left:15px;transform-origin:left center;border-right-width:1px;'
                  : 'right:15px;transform-origin:right center;border-left-width:1px;') +
        'background:linear-gradient(120deg,rgba(200,214,218,.15),rgba(200,214,218,.04) 40%,rgba(255,255,255,.06) 55%);' +
        'box-shadow:inset 0 0 26px rgba(255,255,255,.07);' +
        (portesOuv ? ('transform:rotateY(' + (sideLeft ? '-110deg' : '110deg') + ');') : '');
      var refl = document.createElement('div');
      refl.style.cssText = 'position:absolute;inset:0;pointer-events:none;' +
        'background:linear-gradient(125deg,transparent 33%,rgba(255,255,255,.34) 46%,rgba(255,255,255,.06) 52%,transparent 62%);';
      d.appendChild(refl);
      var h = document.createElement('div');
      h.style.cssText = 'position:absolute;' + (sideLeft ? 'right:6px;' : 'left:6px;') + 'top:50%;transform:translateY(-50%);' +
        'width:5px;height:40px;border-radius:3px;background:linear-gradient(180deg,#eee,#8a8a8a);box-shadow:0 0 3px rgba(0,0,0,.5);';
      d.appendChild(h);
      [26, 74].forEach(function (topPct) {          /* 2 charnières inox sur l'axe (arête extérieure) */
        var hinge = document.createElement('div');
        hinge.style.cssText = 'position:absolute;' + (sideLeft ? 'left:-3px;' : 'right:-3px;') + 'top:' + topPct + '%;' +
          'transform:translateY(-50%);width:8px;height:15px;border-radius:2px;z-index:2;' +
          'background:linear-gradient(180deg,#dcdcdc,#8f8f8f,#c4c4c4);box-shadow:0 0 2px rgba(0,0,0,.6),inset 0 0 0 1px rgba(0,0,0,.15);';
        d.appendChild(hinge);
      });
      return d;
    };
    portes.appendChild(makeDoor(true));
    portes.appendChild(makeDoor(false));
    cabinet.appendChild(portes);
  }
  cabinet.style.zIndex = '2';
  cabinet.style.marginBottom = '32px';   /* repose sur le sol */
  var ombreV = document.createElement('div');
  ombreV.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:1;pointer-events:none;' +
    'width:' + Math.round(maxW * 0.92) + 'px;height:26px;border-radius:50%;' +
    'background:radial-gradient(ellipse at center,rgba(0,0,0,.6),rgba(0,0,0,.22) 45%,transparent 72%);';
  body.appendChild(solV);
  body.appendChild(ombreV);
  body.appendChild(cabinet);
  overlay.appendChild(body);

  function fermer() {
    overlay.style.opacity = '0';
    setTimeout(function () {
      overlay.remove();
      document.body.style.overflow = ''; document.documentElement.style.overflow = '';
    }, 300);
  }
  btnX.addEventListener('click', fermer);
  var onKey = function (e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
}

/* ══════════════════════════════════════════════════════════════
   VITRINE (étagère) — pièce spéciale est_vitrine, rendu procédural.
   Contenu = œuvres liées par index "planche*10+place" (bas→haut, gauche→droite).
   La vitrine est un .socle-wrapper → héritage placement + anti-chevauchement.
   ══════════════════════════════════════════════════════════════ */
function creerVitrine(piece, pos, pieces, opts) {
  var wrapper = document.createElement('div');
  wrapper.className             = 'socle-wrapper vitrine-wrapper';
  wrapper.style.position        = 'absolute';   /* autonome, ne dépend pas de galerie.css */
  wrapper.style.left            = pos.x + '%';
  wrapper.style.bottom          = pos.y + '%';
  wrapper.style.transformOrigin = 'bottom center';
  var scale = (1 - (pos.y / 100) * 0.42).toFixed(3);
  wrapper.style.transform = 'translateX(-50%) scale(' + scale + ')';
  wrapper.style.zIndex    = String(Math.round((100 - pos.y) * 10));
  wrapper.dataset.pieceId = piece.id;

  var couleur = piece.couleur || '#6a4b28';
  var nP = Math.min(8, Math.max(1, piece.planches || 3));
  var nS = Math.min(8, Math.max(1, piece.places   || 4));
  var estBoisF = (piece.style !== 'vitree');
  var backF  = estBoisF ? _teinte(couleur, -0.10) : '#8a8a86';
  var frameF = estBoisF ? _teinte(couleur, -0.28) : '#141414';
  var boardF = estBoisF ? _teinte(couleur, 0.06)  : '#3a3a3a';
  var contenu = piece.contenu || {};

  var u     = _getEchelle();                 /* px/cm ~ 1.5 GSM / 2.5 PC × vpFactor */
  var slotW = Math.round(15 * u);
  var slotH = Math.round(17 * u);
  var board = Math.max(4, Math.round(2.5 * u));
  var pad   = Math.max(3, Math.round(3 * u));
  var innerW = nS * slotW + (nS + 1) * pad;

  /* Halo doré lent (attracteur) */
  var halo = document.createElement('div');
  halo.className = 'vitrine-halo';
  halo.style.cssText = 'position:absolute;left:50%;top:50%;width:172%;height:150%;' +
    'transform:translate(-50%,-50%);border-radius:18px;pointer-events:none;z-index:0;' +
    'background:radial-gradient(ellipse at center,rgba(240,208,128,.62),rgba(240,208,128,.16) 52%,transparent 72%);';
  wrapper.appendChild(halo);
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    halo.animate(
      [{ opacity: 0.45, transform: 'translate(-50%,-50%) scale(0.92)' },
       { opacity: 1.00, transform: 'translate(-50%,-50%) scale(1.07)' },
       { opacity: 0.45, transform: 'translate(-50%,-50%) scale(0.92)' }],
      { duration: 4000, iterations: Infinity, easing: 'ease-in-out' });
  }

  /* Meuble : planches empilées, bas → haut (column-reverse) */
  var meuble = document.createElement('div');
  meuble.className = 'vitrine-meuble';
  meuble.style.cssText = 'position:relative;z-index:1;display:flex;flex-direction:column-reverse;' +
    'width:' + innerW + 'px;background:' + backF + ';' +
    'border:' + Math.max(2, Math.round(u)) + 'px solid ' + frameF + ';' +
    'border-radius:3px;box-shadow:0 ' + Math.round(3 * u) + 'px ' + Math.round(6 * u) + 'px rgba(0,0,0,.55);';

  for (var pl = 1; pl <= nP; pl++) {
    var row = document.createElement('div');
    row.className = 'vitrine-planche';
    row.style.cssText = 'position:relative;display:flex;justify-content:space-around;align-items:flex-end;' +
      'padding:' + pad + 'px ' + pad + 'px 0;' +
      'border-bottom:' + board + 'px solid ' + boardF + ';';
    for (var sl = 1; sl <= nS; sl++) {
      var slot = document.createElement('div');
      slot.className = 'vitrine-slot';
      slot.style.cssText = 'width:' + slotW + 'px;height:' + slotH + 'px;display:flex;' +
        'align-items:flex-end;justify-content:center;';
      var oid = contenu['' + (pl * 10 + sl)];
      var oe  = (oid != null) ? pieces[oid] : null;
      if (oe && oe.photo) {
        var im = document.createElement('img');
        im.alt = oe.titre || ''; im.loading = 'lazy'; im.decoding = 'async';
        im.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;' +
          'filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));';
        im.src = /^https?:\/\//.test(oe.photo) ? oe.photo : (GALERIE_CFG.assetsBase + oe.photo);
        im.onerror = function () { this.style.display = 'none'; };
        slot.appendChild(im);
      }
      row.appendChild(slot);
    }
    meuble.appendChild(row);
  }
  wrapper.appendChild(meuble);

  /* Plaque façon musée */
  var nOeuvres = Object.keys(contenu).length;
  var plaque = document.createElement('div');
  plaque.className = 'vitrine-plaque';
  plaque.textContent = 'Vitrine · ' + nOeuvres + ' pièce' + (nOeuvres > 1 ? 's' : '');
  plaque.style.cssText = 'position:absolute;bottom:-' + Math.round(6 * u) + 'px;left:50%;' +
    'transform:translateX(-50%);font-family:Cinzel,serif;font-size:' + Math.max(8, Math.round(4 * u)) + 'px;' +
    'color:#2a1d0a;white-space:nowrap;background:linear-gradient(180deg,#f0d080,#b58f3e);' +
    'padding:1px 6px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,.5);';
  wrapper.appendChild(plaque);

  /* Clic → écran vitrine (étape 2b, à brancher). En édition on arrange, pas d'ouverture. */
  wrapper.style.cursor = 'pointer';
  wrapper.addEventListener('click', function (e) {
    if (window._GALERIE_EDIT) return;
    e.stopPropagation();
    if (typeof ouvrirVitrine === 'function') ouvrirVitrine(piece, pieces, opts);
  });

  return wrapper;
}

/* ══════════════════════════════════════════════════════════════
   RENDERER SCULPTURE — enregistré dans GALERIE_RENDERERS
   ══════════════════════════════════════════════════════════════ */
GALERIE_RENDERERS['sculpture'] = function(salleDiv, salle, si, salles, tData) {
  /* Greffons de la salle */
  var _immActif  = !!(salle.greffons && salle.greffons.immersive  && salle.greffons.immersive.actif);
  var _descActif = !!(salle.greffons && salle.greffons.descriptive && salle.greffons.descriptive.actif);
  var _immDecor  = (_immActif  && salle.greffons.immersive.decor)  ? salle.greffons.immersive.decor  : null;
  var _descDecor = (_descActif && salle.greffons.descriptive && salle.greffons.descriptive.decor)
    ? salle.greffons.descriptive.decor : null;

  const gabarits = {};
  const pieces   = {};
  (tData.gabarits || []).forEach(g => { gabarits[g.code] = g; });
  (tData.pieces   || []).forEach(p => { pieces[p.id]     = p; });

  salleDiv.classList.add('salle-sculpture');
  /* Couleur du mur de la pièce — par salle ; !important pour bypasser
     le CSS .salle-sculpture { background-color: #7a7a7a } qui est plus
     spécifique que l'inline ordinaire. */
  if (salle.couleur_mur_piece) salleDiv.style.setProperty('background-color', salle.couleur_mur_piece, 'important');
  document.body.classList.add('page-sculpture');
  document.documentElement.classList.add('html-sculpture');

  const plancher = creerPlancher(si + 1, salles.length, salles, NOMS_ROMAINS, salle);
  const sils = plancher.querySelector('.silhouettes-sol');
  if (sils) sils.remove();

  const plancherSol = plancher.querySelector('.plancher-sol');
  if (plancherSol) {
    /* Appliquer le revêtement sol défini dans l'admin */
    var solTexture = salle.texture || 'parquet';
    var solCouleur = salle.couleur_mur || '#8a6228';
    plancherSol.style.background = solBgCSS(solTexture, solCouleur);
    /* Masquer les pseudo-éléments CSS (lattes hardcodées) */
    plancherSol.classList.add('sol-custom');

    /* Perspective sol : canvas avec grille en vraie perspective */
    if (solTexture === 'carrelage' || solTexture === 'parquet') {
      plancherSol.style.background = solCouleur;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
      plancherSol.insertBefore(canvas, plancherSol.firstChild);

      /* Dessiner après layout pour avoir les bonnes dimensions */
      requestAnimationFrame(function() {
        var W = plancherSol.clientWidth || 1200;
        var H = plancherSol.clientHeight || 400;
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');

        var isParquet = solTexture === 'parquet';
        var lineColor = 'rgba(0,0,0,' + (isParquet ? '0.10' : '0.16') + ')';
        var vLineColor = 'rgba(0,0,0,' + (isParquet ? '0.05' : '0.16') + ')';
        var nbH = isParquet ? 30 : 16; /* lignes horizontales */
        var nbV = isParquet ? 10 : 16; /* lignes verticales (parquet: lattes 2x plus longues) */

        /* Point de fuite au centre en haut */
        var vx = W / 2;
        var vy = -H * 0.15;

        /* Lignes horizontales — serrées en haut (loin), espacées en bas (près) */
        for (var i = 0; i <= nbH; i++) {
          var t = i / nbH;
          var y = H * Math.pow(t, 2.2);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 0.3 + t * 1.5;
          ctx.stroke();
        }

        /* Lignes verticales — convergent vers le point de fuite */
        for (var i = -nbV; i <= nbV; i++) {
          var bx = vx + i * (W / (nbV * 0.8));
          ctx.beginPath();
          ctx.moveTo(vx + i * (W * 0.02), 0);
          ctx.lineTo(bx, H);
          ctx.strokeStyle = vLineColor;
          ctx.lineWidth = 0.5 + (Math.abs(i) < nbV * 0.5 ? 0.3 : 0.5);
          ctx.stroke();
        }
      });
    }
    var isMobile = _estMobile();
    var positions = (isMobile && salle.positions_mobile && salle.positions_mobile.length)
      ? salle.positions_mobile : (salle.positions || []);
    positions.slice().sort((a, b) => b.y - a.y).forEach(pos => {
      const piece   = pieces[pos.id];
      const gCode   = pos.gabarit || gabaritDepuisHauteur(piece && piece.dimensions && piece.dimensions.hauteur);
      const gabarit = gabarits[gCode] || gabarits['M'];
      if (!piece) return;
      if (piece.est_vitrine) {
        plancherSol.appendChild(creerVitrine(piece, pos, pieces, { immActif: _immActif, descActif: _descActif, immDecor: _immDecor, descDecor: _descDecor }));
        return;
      }
      plancherSol.appendChild(creerSocle(piece, gabarit, pos, { immActif: _immActif, descActif: _descActif, immDecor: _immDecor, descDecor: _descDecor }));
    });
  }

  salleDiv.appendChild(plancher);
};

/* ── Re-render quand le viewport croise le seuil 600px (toggle F12 responsive) ── */
(function() {
  var _wasMobile = _estMobile();
  window.addEventListener('resize', function() {
    /* Si le mode est forcé (aperçu admin), ne pas re-render sur resize */
    if (window._GALERIE_FORCE_MOBILE === true || window._GALERIE_FORCE_MOBILE === false) return;
    var isMobile = _estMobile();
    if (isMobile !== _wasMobile) {
      _wasMobile = isMobile;
      if (typeof initGalerie === 'function') {
        var conteneur = document.getElementById('conteneurSalles');
        if (conteneur) { conteneur.innerHTML = ''; initGalerie(); }
      }
    }
  });
})();

/* ══════════════════════════════════════════════════════════════
   MODE ÉDITION — ?edit=1 dans l'URL
   Rend les socles draggables, communique via postMessage
   ══════════════════════════════════════════════════════════════ */
/* galerie-edit.html peut avoir mis _GALERIE_EDIT=true avant le chargement de ce script.
   On utilise || pour ne pas l'écraser. */
window._GALERIE_EDIT = window._GALERIE_EDIT || new URLSearchParams(location.search).has('edit');

if (window._GALERIE_EDIT) {
  /* Désactiver la navigation entre salles et les clics immersifs */
  document.addEventListener('DOMContentLoaded', function() {
    document.body.style.userSelect = 'none';
    document.body.style.overflow = 'hidden';
  });

  /* Stocker les salles/positions pour les envoyer au parent */
  var _editSalles    = null;
  var _editTData     = null; /* toiles + gabarits — pour créer des socles sans re-fetch */
  var _editPositions = null; /* référence directe vers salle.positions ou salle.positions_mobile */
  var _selected      = null; /* socle-wrapper actuellement sélectionné (partagé avec _toggleSelect) */

  /* Appelé après initGalerie — rend les socles draggables */
  window._initEditDrag = function(salles, tData) {
    _editSalles = salles;
    _editTData  = tData;
    var salle = salles[0]; /* une seule salle visible */
    var isMobile = _estMobile();
    if (isMobile) {
      /* En GSM : si pas encore de positions mobiles, partir d'une copie des positions PC */
      if (!salle.positions_mobile || !salle.positions_mobile.length) {
        salle.positions_mobile = JSON.parse(JSON.stringify(salle.positions || []));
      }
      _editPositions = salle.positions_mobile;
    } else {
      _editPositions = salle.positions || [];
    }

    var plancher = document.querySelector('.plancher-sol');
    if (!plancher) return;

    /* Forcer les dimensions — écrase les !important de galerie.css */
    plancher.style.setProperty('max-height', 'none', 'important');
    plancher.style.setProperty('min-height', '0', 'important');
    plancher.style.setProperty('flex', '1 1 auto', 'important');
    /* Chaîne flex fiable conteneur → salle → zone-basse → plancher, basée sur
       height:100% + flex (et NON 100vh, peu fiable dans une iframe : laissait
       une bande « mur de la pièce » sous le sol et empêchait le remplissage). */
    var conteneurEl = document.querySelector('.conteneur-salles');
    if (conteneurEl) {
      conteneurEl.style.setProperty('height', '100%', 'important');
      conteneurEl.style.setProperty('flex', '1 1 auto', 'important');
      conteneurEl.style.setProperty('min-height', '0', 'important');
      conteneurEl.style.setProperty('display', 'flex', 'important');
      conteneurEl.style.setProperty('flex-direction', 'column', 'important');
    }
    var salleEl = document.querySelector('.salle');
    if (salleEl) {
      salleEl.style.setProperty('flex', '1 1 auto', 'important');
      salleEl.style.setProperty('height', 'auto', 'important');
      salleEl.style.setProperty('min-height', '100dvh', 'important');
      salleEl.style.setProperty('padding-bottom', '0', 'important');
      salleEl.style.setProperty('display', 'flex', 'important');
      salleEl.style.setProperty('flex-direction', 'column', 'important');
    }
    var zoneBasseEl = document.querySelector('.zone-basse');
    if (zoneBasseEl) {
      zoneBasseEl.style.setProperty('flex', '1 1 auto', 'important');
      zoneBasseEl.style.setProperty('min-height', '0', 'important');
    }
    var murInf = document.querySelector('.mur-inferieur');
    if (murInf) murInf.style.setProperty('height', '40px', 'important');
    var silh = document.querySelector('.silhouettes-sol');
    if (silh) silh.style.display = 'none';

    /* Désactiver les clics immersifs + associer chaque wrap à son pieceId.
       On matche par position une seule fois ici; ensuite _findPieceId lit le dataset
       (robuste, contrairement à la comparaison de coordonnées en continu). */
    document.querySelectorAll('.socle-wrapper').forEach(function(wrap) {
      wrap.style.cursor = 'grab';
      wrap.addEventListener('click', function(e) {
        if (e.target.closest('.edit-rm-btn')) return; /* laisser le bouton Retirer recevoir son clic */
        e.stopPropagation(); e.preventDefault();
      }, true);
      /* Trouver l'id par position (une seule fois) */
      var left = parseFloat(wrap.style.left);
      var bottom = parseFloat(wrap.style.bottom);
      var best = null, bestD = Infinity;
      for (var i = 0; i < _editPositions.length; i++) {
        var p = _editPositions[i];
        var d = Math.abs(p.x - left) + Math.abs(p.y - bottom);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) wrap.dataset.pieceId = best.id;
    });

    /* ── Anti-chevauchement au sol : empreinte elliptique + blocage dur ── */
    var MARGIN = 1.12; /* l'ellipse déborde un peu l'encombrement de la pièce (réglable) */
    /* Ellipse VERTICALE englobant toute la pièce (socle + objet), centrée dessus.
       Renvoie centre + demi-axes en px, relatifs au plancher. */
    function _boxOf(wrap, xPct, yPct) {
      var pr = plancher.getBoundingClientRect();
      var W = pr.width || 1, H = pr.height || 1;
      var s = 1 - (yPct / 100) * 0.42;               /* perspective, identique au rendu */
      var w = wrap.offsetWidth * s, h = wrap.offsetHeight * s;
      var cx = (xPct / 100) * W;
      var cy = (H - (yPct / 100) * H) - h / 2;       /* centre = demi-hauteur au-dessus de la base */
      return { cx: cx, cy: cy, rx: (w / 2) * MARGIN, ry: (h / 2) * MARGIN };
    }
    function _overlap(a, b) {
      var nx = (a.cx - b.cx) / (a.rx + b.rx);
      var ny = (a.cy - b.cy) / (a.ry + b.ry);
      return (nx * nx + ny * ny) < 1;                /* test ellipse vs ellipse normalisé */
    }
    function _autresBoxes(wrapExclu) {
      var arr = [];
      document.querySelectorAll('.socle-wrapper').forEach(function(w) {
        if (w === wrapExclu) return;
        var pid = w.dataset.pieceId;
        var q = _editPositions.find(function(z) { return String(z.id) === String(pid); });
        if (q) arr.push(_boxOf(w, q.x, q.y));
      });
      return arr;
    }
    function _mord(box, autres) {
      return autres.some(function(o) { return _overlap(box, o); });
    }
    /* Halo elliptique autour de la pièce : vert = libre, rouge = mord une voisine */
    var _foot = document.createElement('div');
    _foot.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;' +
      'transform:translate(-50%,-50%);display:none;z-index:9998;transition:background .1s,border-color .1s;';
    plancher.appendChild(_foot);
    function _halo(box, mord) {
      _foot.style.left = box.cx + 'px'; _foot.style.top = box.cy + 'px';
      _foot.style.width = (2 * box.rx) + 'px'; _foot.style.height = (2 * box.ry) + 'px';
      _foot.style.border = '2px solid ' + (mord ? '#e0564b' : '#5ec46a');
      _foot.style.background = mord ? 'rgba(224,86,75,.16)' : 'rgba(94,196,106,.14)';
      _foot.style.display = 'block';
    }
    function _cacherHalo() { _foot.style.display = 'none'; }

    /* Variables drag */
    var _dragging = null; /* { el, pos, startX, startY } */
    var _moved = false;
    var _lastTouch = 0; /* timestamp dernier touch — pour ignorer les mouse events synthétiques */

    plancher.addEventListener('mousedown', function(e) {
      if (Date.now() - _lastTouch < 700) return; /* event souris synthétique après touch → ignorer */
      if (e.target.closest('.edit-rm-btn')) return; /* clic sur le bouton Retirer → laisser passer */
      var wrap = e.target.closest('.socle-wrapper');
      if (!wrap) return;
      e.preventDefault();
      var pid = _findPieceId(wrap);
      if (!pid) return;
      var pos = _editPositions.find(function(p) { return p.id === pid; });
      if (!pos) return;
      _dragging = { el: wrap, pos: pos, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y,
                    autres: _autresBoxes(wrap), lastX: pos.x, lastY: pos.y };
      _moved = false;
      wrap.style.cursor = 'grabbing';
      wrap.style.zIndex = '9999';
    });

    document.addEventListener('mousemove', function(e) {
      if (!_dragging) return;
      e.preventDefault();
      /* Seuil : ne considérer comme drag qu'au-delà de 6px (sinon = clic) */
      if (Math.abs(e.clientX - _dragging.startX) > 6 || Math.abs(e.clientY - _dragging.startY) > 6) _moved = true;
      if (!_moved) return;
      var rect = plancher.getBoundingClientRect();
      var dx = ((e.clientX - _dragging.startX) / rect.width) * 100;
      var dy = -((e.clientY - _dragging.startY) / rect.height) * 100;
      var newX = Math.max(5, Math.min(95, _dragging.origX + dx));
      var newY = Math.max(5, Math.min(95, _dragging.origY + dy));
      var box = _boxOf(_dragging.el, newX, newY);
      var mord = _mord(box, _dragging.autres);
      if (!mord) {                       /* libre → on avance */
        _dragging.el.style.left = newX + '%';
        _dragging.el.style.bottom = newY + '%';
        _dragging.lastX = newX; _dragging.lastY = newY;
      }                                  /* sinon blocage dur : on reste à la dernière position valide */
      _halo(_boxOf(_dragging.el, _dragging.lastX, _dragging.lastY), mord);
    });

    document.addEventListener('mouseup', function(e) {
      if (!_dragging) return;
      var wrap = _dragging.el;
      var pos = _dragging.pos;
      if (_moved) {
        pos.x = _dragging.lastX;   /* dernière position VALIDE (anti-chevauchement) */
        pos.y = _dragging.lastY;
        /* Notifier le parent */
        _sendPositions();
      }
      _cacherHalo();
      wrap.style.cursor = 'grab';
      var scale = (1 - (pos.y / 100) * 0.42).toFixed(3);
      wrap.style.zIndex = String(Math.round((100 - pos.y) * 10));
      wrap.style.transform = 'translateX(-50%) scale(' + scale + ')';

      if (!_moved) {
        /* Clic sans drag → sélection + ✕ */
        _toggleSelect(wrap, pos);
      }
      _dragging = null;
    });

    /* Touch support */
    plancher.addEventListener('touchstart', function(e) {
      _lastTouch = Date.now();
      if (e.target.closest('.edit-rm-btn')) return; /* clic sur Retirer → laisser passer */
      var wrap = e.target.closest('.socle-wrapper');
      if (!wrap) return;
      var touch = e.touches[0];
      var pid = _findPieceId(wrap);
      var pos = _editPositions.find(function(p) { return p.id === pid; });
      if (!pos) return;
      _dragging = { el: wrap, pos: pos, startX: touch.clientX, startY: touch.clientY, origX: pos.x, origY: pos.y,
                    autres: _autresBoxes(wrap), lastX: pos.x, lastY: pos.y };
      _moved = false;
      wrap.style.zIndex = '9999';
    }, { passive: true });
    document.addEventListener('touchmove', function(e) {
      if (!_dragging) return;
      var touch = e.touches[0];
      /* Seuil tactile : 8px (le doigt bouge toujours un peu sur un tap) */
      if (Math.abs(touch.clientX - _dragging.startX) > 8 || Math.abs(touch.clientY - _dragging.startY) > 8) _moved = true;
      if (!_moved) return;
      e.preventDefault();
      var rect = plancher.getBoundingClientRect();
      var dx = ((touch.clientX - _dragging.startX) / rect.width) * 100;
      var dy = -((touch.clientY - _dragging.startY) / rect.height) * 100;
      var newX = Math.max(5, Math.min(95, _dragging.origX + dx));
      var newY = Math.max(5, Math.min(95, _dragging.origY + dy));
      var box = _boxOf(_dragging.el, newX, newY);
      var mord = _mord(box, _dragging.autres);
      if (!mord) {
        _dragging.el.style.left = newX + '%';
        _dragging.el.style.bottom = newY + '%';
        _dragging.lastX = newX; _dragging.lastY = newY;
      }
      _halo(_boxOf(_dragging.el, _dragging.lastX, _dragging.lastY), mord);
    }, { passive: false });
    document.addEventListener('touchend', function(e) {
      if (!_dragging) return;
      var wrap = _dragging.el;
      var pos = _dragging.pos;
      if (_moved) {
        pos.x = _dragging.lastX;   /* dernière position VALIDE (anti-chevauchement) */
        pos.y = _dragging.lastY;
        _sendPositions();
      }
      _cacherHalo();
      var scale = (1 - (pos.y / 100) * 0.42).toFixed(3);
      wrap.style.zIndex = String(Math.round((100 - pos.y) * 10));
      wrap.style.transform = 'translateX(-50%) scale(' + scale + ')';
      if (!_moved) _toggleSelect(wrap, pos);
      _dragging = null;
    });

    /* Tap sur sol vide (mobile) :
       - si une pièce posée est sélectionnée → désélectionner
       - sinon → sol-click (placer la pièce du strip) */
    plancher.addEventListener('touchend', function(e) {
      if (_dragging) return; /* tap/drag sur pièce géré par l'autre touchend */
      var t = e.changedTouches[0];
      var el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.closest('.socle-wrapper')) return; /* tap sur pièce */
      if (_selected) {
        /* Désélectionner la pièce posée */
        _selected.classList.remove('edit-selected');
        _selected.style.outline = '';
        var b = _selected.querySelector('.edit-rm-btn'); if (b) b.remove();
        _selected = null;
        parent.postMessage({ type: 'piece-deselected' }, '*');
        return;
      }
      var rect = plancher.getBoundingClientRect();
      var x = Math.round(((t.clientX - rect.left) / rect.width) * 100);
      var y = Math.round((1 - (t.clientY - rect.top) / rect.height) * 100);
      parent.postMessage({ type: 'sol-click', x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }, '*');
    });

    plancher.addEventListener('click', function(e) {
      if (Date.now() - _lastTouch < 700) return; /* click synthétique après touch → ignorer */
      if (e.target.closest('.socle-wrapper')) return;
      var rect = plancher.getBoundingClientRect();
      var x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      var y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
      parent.postMessage({ type: 'sol-click', x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }, '*');
    });

    /* Recevoir messages du parent */
    window.addEventListener('message', function(e) {
      if (!e.data || !e.data.type) return;

      if (e.data.type === 'selectionner-piece') {
        /* SÃ©lection auto aprÃ¨s placement : trouver le wrap et le sÃ©lectionner */
        var sid = e.data.id;
        var plancherS = document.querySelector('.plancher-sol');
        if (plancherS) {
          var found = null;
          plancherS.querySelectorAll('.socle-wrapper').forEach(function(w) {
            if (parseInt(w.dataset.pieceId) === sid) found = w;
          });
          if (found && found !== _selected) {
            var posS = _editPositions.find(function(p) { return p.id === sid; });
            _toggleSelect(found, posS);
          }
        }
        return;
      }

      if (e.data.type === 'retirer-piece') {
        /* Retrait demandé depuis le panneau Support (bouton 🗑) */
        var rid = e.data.id;
        var ridx = _editPositions.findIndex(function(p) { return p.id === rid; });
        if (ridx >= 0) _editPositions.splice(ridx, 1);
        var plancherR = document.querySelector('.plancher-sol');
        if (plancherR) {
          plancherR.querySelectorAll('.socle-wrapper').forEach(function(w) {
            if (parseInt(w.dataset.pieceId) === rid) w.remove();
          });
        }
        _selected = null;
        _sendPositions();
        parent.postMessage({ type: 'piece-removed', id: rid }, '*');
        parent.postMessage({ type: 'piece-deselected' }, '*');
        return;
      }

      if (e.data.type === 'refresh') {
        if (e.data.injectPositions !== undefined && _editTData) {
          /* Placement d'une nouvelle pièce — pas de re-fetch */
          var gabarits = {}; var pieces = {};
          (_editTData.gabarits || []).forEach(function(g) { gabarits[g.code] = g; });
          (_editTData.pieces   || []).forEach(function(p) { pieces[p.id]   = p; });
          var plancher = document.querySelector('.plancher-sol');
          if (!plancher) return;
          (e.data.injectPositions || []).forEach(function(np) {
            /* Ajouter seulement les positions pas encore dans _editPositions */
            var existing = _editPositions.find(function(p) { return p.id === np.id; });
            if (!existing) {
              _editPositions.push(np);
              var piece = pieces[np.id];
              if (!piece) return;
              var gCode   = np.gabarit || gabaritDepuisHauteur(piece.dimensions && piece.dimensions.hauteur);
              var gabarit = gabarits[gCode] || gabarits['M'];
              var wrap    = creerSocle(piece, gabarit, np, null);
              wrap.style.cursor = "grab"; wrap.dataset.pieceId = piece.id;
              /* Bloquer clics immersifs sur le nouveau socle */
              wrap.addEventListener('click', function(ev) { if (ev.target.closest('.edit-rm-btn')) return; ev.stopPropagation(); ev.preventDefault(); }, true);
              plancher.appendChild(wrap);
              _sendPositions();
            }
          });
        } else {
          /* Refresh complet (fallback) */
          var conteneur = document.getElementById('conteneurSalles');
          if (conteneur) { conteneur.innerHTML = ''; initGalerie(); }
        }
      }

      if (e.data.type === 'support-updated' && _editTData) {
        /* Re-render le socle de la pièce avec son nouveau support */
        var piece = e.data.piece;
        if (!piece) return;
        /* Mettre à jour la pièce dans _editTData pour cohérence */
        (_editTData.pieces || []).forEach(function(p, i) {
          if (p.id === piece.id) _editTData.pieces[i] = piece;
        });
        var pos = _editPositions.find(function(p) { return p.id === piece.id; });
        if (!pos) return;
        /* Retrouver l'ancien wrap par position et le remplacer */
        var plancher2 = document.querySelector('.plancher-sol');
        if (!plancher2) return;
        var wraps = plancher2.querySelectorAll('.socle-wrapper');
        var oldWrap = null;
        wraps.forEach(function(w) {
          if (Math.abs(parseFloat(w.style.left) - pos.x) < 0.5 &&
              Math.abs(parseFloat(w.style.bottom) - pos.y) < 0.5) oldWrap = w;
        });
        var gabarits2 = {};
        (_editTData.gabarits || []).forEach(function(g) { gabarits2[g.code] = g; });
        var gCode2   = pos.gabarit || gabaritDepuisHauteur(piece.dimensions && piece.dimensions.hauteur);
        var gabarit2 = gabarits2[gCode2] || gabarits2['M'];
        var newWrap  = creerSocle(piece, gabarit2, pos, null);
        newWrap.style.cursor = "grab"; newWrap.dataset.pieceId = piece.id;
        newWrap.addEventListener('click', function(ev) { if (ev.target.closest('.edit-rm-btn')) return; ev.stopPropagation(); ev.preventDefault(); }, true);
        if (oldWrap) { oldWrap.parentNode.replaceChild(newWrap, oldWrap); }
        else { plancher2.appendChild(newWrap); }
      }
    });

    parent.postMessage({ type: 'edit-ready' }, '*');
  };

  function _findPieceId(wrap) {
    /* Priorité au dataset (fiable) ; fallback comparaison de position */
    if (wrap.dataset && wrap.dataset.pieceId) return parseInt(wrap.dataset.pieceId);
    var left = parseFloat(wrap.style.left);
    var bottom = parseFloat(wrap.style.bottom);
    for (var i = 0; i < _editPositions.length; i++) {
      var p = _editPositions[i];
      if (Math.abs(p.x - left) < 0.5 && Math.abs(p.y - bottom) < 0.5) return p.id;
    }
    return null;
  }

  function _toggleSelect(wrap, pos) {
    /* Désélectionner l'ancien */
    var old = document.querySelector('.socle-wrapper.edit-selected');
    if (old) {
      old.classList.remove('edit-selected');
      old.style.outline = '';
      var oldBtn = old.querySelector('.edit-rm-btn');
      if (oldBtn) oldBtn.remove();
    }
    if (_selected === wrap) { _selected = null; parent.postMessage({ type: 'piece-deselected' }, '*'); return; }
    _selected = wrap;
    wrap.classList.add('edit-selected');
    wrap.style.outline = '3px solid #c8a050';
    wrap.style.overflow = 'visible';
    /* Notifier le parent admin pour ouvrir le panneau Support */
    parent.postMessage({ type: 'piece-selected', id: _findPieceId(wrap) }, '*');
    var btn = document.createElement('button');
    btn.className = 'edit-rm-btn';
    btn.textContent = '✕ Retirer';
    btn.style.cssText = 'position:absolute;top:-30px;left:50%;transform:translateX(-50%);padding:7px 16px;border-radius:12px;border:none;background:#c0392b;color:#fff;font-size:13px;font-weight:700;cursor:pointer;z-index:99999;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.6);';
    var _retirer = function(ev) {
      ev.stopPropagation(); ev.preventDefault();
      var pid = _findPieceId(wrap);
      var idx = _editPositions.findIndex(function(p) { return p.id === pid; });
      if (idx >= 0) _editPositions.splice(idx, 1);
      wrap.remove();
      _selected = null;
      _sendPositions();
      parent.postMessage({ type: 'piece-removed', id: pid }, '*');
      parent.postMessage({ type: 'piece-deselected' }, '*');
    };
    /* touchend dédié + stopPropagation au touchstart pour ne pas armer le drag */
    btn.addEventListener('touchstart', function(ev) { ev.stopPropagation(); }, { passive: true });
    btn.addEventListener('touchend', function(ev) { ev.stopPropagation(); _retirer(ev); });
    /* mousedown : empêcher d'armer le drag du plancher (sinon mouseup désélectionne
       et retire le bouton avant que le click ne se déclenche) */
    btn.addEventListener('mousedown', function(ev) { ev.stopPropagation(); });
    btn.addEventListener('click', _retirer);
    wrap.querySelector('.socle').appendChild(btn);
  }

  function _sendPositions() {
    parent.postMessage({
      type: 'positions-updated',
      positions: JSON.parse(JSON.stringify(_editPositions))
    }, '*');
  }
}

