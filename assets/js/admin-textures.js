// ═══════════════════════════════════════════════
// ADMIN-TEXTURES.JS — Presets / Couleurs / Textures + Recadrage Cropper.js
// Dépend de : afficherMur, toast, $, ADMIN_CFG (admin.js)

//             afficherQualitePhoto (admin-media.js)
//             photoB64, _origPhotoMaxDim, toiles, salles (admin.js globals)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
const TEXTURES = {
  none:   '',
  tissu:  'repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 4px)',
  bois:   'repeating-linear-gradient(rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 3px)',
  pierre: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 6px)',
  damier: 'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/8px 8px'
};

function appliquerApparence() {
  const bg = $('mur-bg');

  /* Sculpture : le sol utilise SOL_PATTERNS (admin-galerie.js) */
  if (window.ADMIN_TYPE === 'sculpture' && typeof solPatternCSS === 'function') {
    bg.style.backgroundBlendMode = '';
    bg.style.background = solPatternCSS(textureActuelle, couleurMurActuel);
    renderColorSwatches('mur');
    document.querySelectorAll('#sw-revetement .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === textureActuelle));
    return;
  }

  const isImgTex = /\.(jpg|jpeg|png|webp)$/i.test(textureActuelle);
  if (isImgTex) {
    /* Texture image : URL directe (textureActuelle est déjà le chemin) + multiply blend pour laisser voir la couleur */
    bg.style.background = 'url("' + textureActuelle + '") center/cover, ' + couleurMurActuel;
    bg.style.backgroundBlendMode = 'multiply';
    return;
  }
  bg.style.backgroundBlendMode = '';
  const tex = TEXTURES[textureActuelle] || '';
  bg.style.background = tex
    ? `${tex}, ${couleurMurActuel}`
    : couleurMurActuel;
  // Swatches
  renderColorSwatches('mur');
  renderColorSwatches('cadres');
  document.querySelectorAll('#sw-texture .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === textureActuelle));
  document.querySelectorAll('#sw-revetement .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === textureActuelle));
  // Met à jour les cadres affichés
  document.querySelectorAll('.toile-posee').forEach(el => {
    if (!el.classList.contains('reserve-posee')) {
      el.style.borderColor = couleurCadresActuel;
      el.style.borderWidth = epaisseurCadresActuel + 'px';
    }
  });
  // Sync slider épaisseur
  var sl = $('ep-cadres'); if (sl) sl.value = epaisseurCadresActuel;
  var vl = $('ep-cadres-val'); if (vl) vl.textContent = epaisseurCadresActuel + 'px';
}

// PRESETS
// ═══════════════════════════════════════════════
/* gererTextureCustom + confirmerTextureNom + _pendingTextureFile supprimés :
   ancien système d'upload texture (vers localStorage) remplacé par
   ouvrirOverlayTexture + uploaderTextureConfirmee (vers GitHub) dans
   admin-emailjs.js. La modale #overlay-tex-nom associée est aussi
   supprimée de admin.html. */

function swSelect(el, groupe) {
  el.closest('.swatches').querySelectorAll('.sw').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
}

/* ── Historique couleurs ── */
function getColorHist(type) {
  var key = type === 'mur' ? K.mur_hist : K.cad_hist;
  var def = type === 'mur' ? MUR_DEFAULTS : CAD_DEFAULTS;
  try { return JSON.parse(localStorage.getItem(key)) || def.slice(); } catch(e) { return def.slice(); }
}

function pushColorHist(type, color) {
  var key  = type === 'mur' ? K.mur_hist : K.cad_hist;
  var hist = getColorHist(type);
  var alreadyIn = hist.some(function(c){ return c.toLowerCase() === color.toLowerCase(); });
  if (!alreadyIn) {
    hist = hist.filter(function(c){ return c.toLowerCase() !== color.toLowerCase(); });
    hist.unshift(color);
    hist = hist.slice(0, 5);
    try { localStorage.setItem(key, JSON.stringify(hist)); } catch(e) {}
  }
  renderColorSwatches(type);
}

function renderColorSwatches(type) {
  var containerId, current;
  if      (type === 'mur')       { containerId = 'sw-mur';       current = couleurMurActuel; }
  else if (type === 'mur-piece') { containerId = 'sw-mur-piece'; current = couleurMurPieceActuel; }
  else if (type === 'mur-bas')   { containerId = 'sw-mur-bas';   current = couleurMurBasActuel; }
  else if (type === 'sol')       { containerId = 'sw-sol';       current = couleurSolActuel; }
  else                           { containerId = 'sw-cadres';    current = couleurCadresActuel; }
  var container   = $(containerId);
  if (!container) return;
  var plus        = container.querySelector('.sw-plus');
  container.innerHTML = '';
  /* Garde-fou : si current undefined (salle sans couleur_cadres p.ex.),
     fallback sur une chaîne vide pour éviter le crash toLowerCase. */
  var curLc = (typeof current === 'string') ? current.toLowerCase() : '';
  getColorHist(type).forEach(function(col) {
    var sw = document.createElement('div');
    sw.className = 'sw' + (col.toLowerCase() === curLc ? ' sel' : '');
    sw.style.background = col;
    sw.dataset.val = col;
    sw.addEventListener('click', function() {
      pushColorHist(type, col);
      if      (type === 'mur')       setCouleurMur(col);
      else if (type === 'mur-piece') setCouleurMurPiece(col);
      else if (type === 'mur-bas')   setCouleurMurBas(col);
      else if (type === 'sol')       setCouleurSol(col);
      else                           setCouleurCadres(col);
    });
    container.appendChild(sw);
  });
  if (plus) container.appendChild(plus);
}

function initSwatches() {
  var _bs = document.getElementById('btn-save-apparence');
  if (_bs && !_bs._wired) { _bs._wired = true; _bs.addEventListener('click', _enregistrerApparence); }
  renderColorSwatches('mur');
  renderColorSwatches('mur-piece');
  renderColorSwatches('mur-bas');
  renderColorSwatches('cadres');
  renderColorSwatches('sol');

  document.querySelectorAll('#sw-texture .sw').forEach(function(sw) {
    sw.addEventListener('click', function() { swSelect(sw, 'texture'); setTexture(sw.dataset.val); });
  });

  /* Sol peinture : choix parquet / uni */
  document.querySelectorAll('#sw-sol-type .sol-type-btn').forEach(function(sw) {
    sw.addEventListener('click', function() { setSolType(sw.dataset.val); });
  });

  /* Revêtement sol (sculpture) — même logique que texture mur */
  document.querySelectorAll('#sw-revetement .sw').forEach(function(sw) {
    sw.addEventListener('click', function() {
      document.querySelectorAll('#sw-revetement .sw').forEach(function(s) { s.classList.remove('sel'); });
      sw.classList.add('sel');
      setTexture(sw.dataset.val);
    });
  });

  // Picker couleur personnalisé (palette artiste)
  var btnPickerMur = document.getElementById('btn-picker-mur');
  if (btnPickerMur) {
    btnPickerMur.addEventListener('click', function(e) {
      e.stopPropagation();
      ouvrirPickerCouleur('mur');
    });
  }
  var btnPickerMurPiece = document.getElementById('btn-picker-mur-piece');
  if (btnPickerMurPiece) {
    btnPickerMurPiece.addEventListener('click', function(e) {
      e.stopPropagation();
      ouvrirPickerCouleur('mur-piece');
    });
  }
  var btnPickerMurBas = document.getElementById('btn-picker-mur-bas');
  if (btnPickerMurBas) {
    btnPickerMurBas.addEventListener('click', function(e) {
      e.stopPropagation();
      ouvrirPickerCouleur('mur-bas');
    });
  }
  var btnPickerCad = document.getElementById('btn-picker-cad');
  if (btnPickerCad) {
    btnPickerCad.addEventListener('click', function(e) {
      e.stopPropagation();
      ouvrirPickerCouleur('cadres');
    });
  }
  var btnPickerSol = document.getElementById('btn-picker-sol');
  if (btnPickerSol) {
    btnPickerSol.addEventListener('click', function(e) {
      e.stopPropagation();
      ouvrirPickerCouleur('sol');
    });
  }
  // Slider épaisseur cadres
  $('ep-cadres').addEventListener('input', function() {
    setEpaisseurCadres(parseInt(this.value));
  });

}

/* Rafraîchit les aperçus PC/GSM du TDB avec un léger délai pour grouper les changements rapides (slider) */
var _tdbRefreshTimer = null;
function _rafraichirApercusTDB() {
  if (typeof _renderTDB !== 'function') return;
  clearTimeout(_tdbRefreshTimer);
  _tdbRefreshTimer = setTimeout(function() { _renderTDB(); }, 250);
}

/* Auto-sauvegarde GitHub debouncée (1.5s après dernier changement d'apparence).
   Le libellé indique ce qui vient d'être sauvegardé (avec accord) pour que
   l'utilisateur sache précisément quoi a été persisté. Dernier libellé set
   dans la fenêtre debounce gagne (suffisant en pratique). */
var _autoSaveTimer = null;
var _autoSaveLabel = 'Apparence sauvegardée ✓';
function _autoSaveApparence(label) {
  if (typeof sauvegarder !== 'function') return;
  if (label) _autoSaveLabel = label;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function() {
    var msg = _autoSaveLabel;
    sauvegarder('[admin] Apparence salle', null).then(function() {
      if (typeof toast === 'function') toast(msg, 'ok', 1500);
    }).catch(function(e) {
      if (typeof toast === 'function') toast('Erreur sauvegarde : ' + e.message, 'err', 4000);
    });
  }, 1500);
}

/* -- Apparence : bouton \u00ab Enregistrer \u00bb (remplace le save auto debounce) --
   Les reglages modifient la salle EN MEMOIRE + apercu. La persistance se fait au
   clic sur le bouton d'enregistrement -> un seul commit/deploiement par ambiance. */
var _apparenceDirty = false;
function _majBtnSaveApparence() {
  var b = document.getElementById('btn-save-apparence');
  if (!b) return;
  b.style.display = _apparenceDirty ? 'block' : 'none';
}
function _marquerApparenceModifiee() { _apparenceDirty = true; _majBtnSaveApparence(); }
function _resetApparenceDirty() { _apparenceDirty = false; _majBtnSaveApparence(); }
function _enregistrerApparence() {
  if (typeof sauvegarder !== 'function' || !_apparenceDirty) return;
  var b = document.getElementById('btn-save-apparence');
  if (b) b.disabled = true;
  sauvegarder('[admin] Apparence salle', null).then(function() {
    if (b) b.disabled = false;
    _resetApparenceDirty();
    if (typeof toast === 'function') toast('Apparence enregistr\u00e9e', 'ok', 1500);
  }).catch(function(e) {
    if (b) b.disabled = false;
    if (typeof toast === 'function') toast('Erreur : ' + e.message, 'err', 4000);
  });
}

function setCouleurMur(col) {
  couleurMurActuel = col;
  if (salleActive) { salleActive.couleur_mur = col; }
  appliquerApparence();
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

/* Couleur du mur de la PIÈCE (décor sombre autour du mur d'exposition) —
   propage via la variable CSS --mur-piece-col qui est lue par
   .scene-mur-piece (admin.css), l'aperçu carte (admin-tdb.js) et
   l'arrangeur (admin-galerie.js). Default historique #1a1a1a. */
function setCouleurMurPiece(col) {
  couleurMurPieceActuel = col;
  if (salleActive) { salleActive.couleur_mur_piece = col; }
  document.documentElement.style.setProperty('--mur-piece-col', col);
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

/* Couleur du mur du bas (plinthe avec portes) — analogue à mur-piece.
   Propage via var CSS --mur-bas-col, lue par .scene-mur-inf (admin) et
   appliquée dynamiquement côté public via creerPlancher(). */
function setCouleurMurBas(col) {
  couleurMurBasActuel = col;
  if (salleActive) { salleActive.couleur_mur_bas = col; }
  document.documentElement.style.setProperty('--mur-bas-col', col);
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

function setCouleurCadres(col) {
  couleurCadresActuel = col;
  if (salleActive) { salleActive.couleur_cadres = col; }
  appliquerApparence();
  afficherMur();
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

function setEpaisseurCadres(ep) {
  epaisseurCadresActuel = ep;
  if (salleActive) { salleActive.epaisseur_cadres = ep; }
  var val = $('ep-cadres-val'); if (val) val.textContent = ep + 'px';
  document.querySelectorAll('.toile-posee').forEach(function(el) {
    if (!el.classList.contains('reserve-posee')) el.style.borderWidth = ep + 'px';
  });
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  /* Pas de fermerPopover ici : le slider doit rester ouvert pendant l'ajustement */
}

function setTexture(val) {
  textureActuelle = val;
  if (salleActive) { salleActive.texture = val; }
  appliquerApparence();
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

/* Sol peinture : construit le background CSS (parquet teinte par la couleur,
   ou uni). Miroir de la logique publique dans galerie-core.js. */
function solBgPeintureCSS(type, couleur) {
  var c = couleur || '#4a3018';
  if (type === 'uni') return c;
  return 'repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0,rgba(0,0,0,.22) 1px,transparent 1px,transparent 60px),'
       + 'repeating-linear-gradient(to bottom,transparent 0,transparent 14px,rgba(0,0,0,.15) 14px,rgba(0,0,0,.15) 16px),'
       + c;
}

/* Propage le sol via la variable CSS --sol-bg, lue par .scene-plancher
   (apercu Arranger) ; cote public, applique par creerPlancher(). */
function _propagerSol() {
  document.documentElement.style.setProperty('--sol-bg', solBgPeintureCSS(solTypeActuel, couleurSolActuel));
}

function setCouleurSol(col) {
  couleurSolActuel = col;
  if (salleActive) { salleActive.couleur_sol = col; }
  _propagerSol();
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

function setSolType(val) {
  solTypeActuel = val;
  if (salleActive) { salleActive.sol_type = val; }
  document.querySelectorAll('#sw-sol-type .sol-type-btn').forEach(function(s) {
    s.classList.toggle('sel', s.dataset.val === val);
  });
  _propagerSol();
  _rafraichirApercusTDB();
  _marquerApparenceModifiee();
  if (typeof fermerPopover === 'function') fermerPopover();
}

// RECADRAGE PHOTO (Cropper.js)
// ═══════════════════════════════════════════════
let cropperInst = null;
let cropCallback = null;
let _cropInitCanvas = null; // état initial du canvas pour reset zoom
let _cropLastTap = 0;       // timestamp dernier tap pour double-tap

/* ── Listeners permanents sur le crop-canvas-wrap ── */
(function() {
  const wrap = $('crop-canvas-wrap');

  // Fix pan après pinch-zoom : Cropper.js ne réactive pas toujours dragMode
  wrap.addEventListener('touchend', function(e) {
    if (cropperInst && e.touches.length === 0) {
      setTimeout(function() { cropperInst.setDragMode('move'); }, 30);
    }
  }, { passive: true });

  // Double-tap mobile → reset zoom
  wrap.addEventListener('touchstart', function(e) {
    if (!cropperInst || e.touches.length !== 1) return;
    const now = Date.now();
    if (now - _cropLastTap < 300) {
      e.preventDefault();
      if (_cropInitCanvas) cropperInst.setCanvasData(Object.assign({}, _cropInitCanvas));
    }
    _cropLastTap = now;
  }, { passive: false });

  // Double-clic desktop → reset zoom
  wrap.addEventListener('dblclick', function() {
    if (cropperInst && _cropInitCanvas) {
      cropperInst.setCanvasData(Object.assign({}, _cropInitCanvas));
    }
  });
})();

function ouvrirCrop(file, callback) {
  cropCallback = callback;
  const reader = new FileReader();
  reader.onload = e => {
    if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
    const img = $('crop-img');
    $('overlay-crop').classList.add('ouvert');
    // onload AVANT src pour éviter le race condition mobile
    img.onload = () => {
      _origPhotoMaxDim = Math.max(img.naturalWidth, img.naturalHeight); // dimensions réelles avant compression/crop
      if (typeof Cropper === "undefined") {
        // Fallback si Cropper.js pas chargé : utilise la photo sans recadrage
        fermerCrop();
        toast('Outil de recadrage non disponible (réseau lent) — photo utilisée sans recadrage', 'err');
        if (cropCallback) cropCallback(e.target.result.split(",")[1]);
        return;
      }
      cropperInst = new Cropper(img, {
        viewMode: 1,
        dragMode: 'move',
        autoCrop: false,
        restore: false,
        guides: false,
        center: false,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        responsive: true,
        movable: true,
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: false,
        ready: function() { _cropInitCanvas = cropperInst.getCanvasData(); }
      });
      // Étape 1 visible, étape 2 cachée
      $('crop-etape1').style.display = '';
      $('crop-etape2').style.display = 'none';
      $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function fermerCrop() {
  $('overlay-crop').classList.remove('ouvert');
  if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
  cropCallback = null;
  _cropInitCanvas = null;
  $('inp-photo').value = '';
}

$('btn-crop-valider').addEventListener('click', () => {
  if (!cropperInst) return;
  // Si pas encore de cropBox, activer sur l'image entière
  if (!cropperInst.getCropBoxData().width) {
    cropperInst.crop();
  }
  const canvas = cropperInst.getCroppedCanvas({
    maxWidth: 1400, maxHeight: 1400,
    fillColor: '#fff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });
  const b64 = canvas.toDataURL('image/jpeg', 0.90).split(',')[1];
  const cb = cropCallback;
  fermerCrop();
  if (cb) cb(b64);
});
function ouvrirCropDepuisSrc(src, callback) {
  cropCallback = callback;
  if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
  const img = $('crop-img');
  img.crossOrigin = "anonymous";
  $('overlay-crop').classList.add('ouvert');
  img.onload = () => {
    if (typeof Cropper === "undefined") {
      fermerCrop();
      toast("Outil de recadrage non disponible", "err");
      if (cropCallback) cropCallback(null);
      return;
    }
    cropperInst = new Cropper(img, {
      viewMode: 1, dragMode: "move", autoCrop: false,
      restore: false, guides: false, center: false, highlight: false,
      cropBoxMovable: true, cropBoxResizable: true,
      toggleDragModeOnDblclick: false, responsive: true,
      movable: true, zoomable: true, zoomOnTouch: true, zoomOnWheel: false,
      ready: function() { _cropInitCanvas = cropperInst.getCanvasData(); }
    });
    $('crop-etape1').style.display = '';
    $('crop-etape2').style.display = 'none';
    $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
  };
  img.src = src;
}

$('btn-recadrer-photo').addEventListener('click', () => {
  const src = $('photo-prev').src;
  if (!src) return;
  ouvrirCropDepuisSrc(src, b64 => {
    if (!b64) return;
    photoB64 = b64;
    $('photo-prev').src = 'data:image/jpeg;base64,' + photoB64;
    $('photo-prev').style.display = 'block'; $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
  });
});

$('btn-close-crop').addEventListener('click', fermerCrop);
$('btn-crop-annuler').addEventListener('click', fermerCrop);
$('btn-rot-g').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(-90); });
$('btn-rot-d').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(90); });
$('btn-rot-180').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(180); });

$('btn-crop-suivant').addEventListener('click', () => {
  if (!cropperInst) return;
  // Passer à l'étape 2 : activer le cadre de recadrage sur l'image entière
  cropperInst.crop();
  setTimeout(() => {
    const c = cropperInst.getCanvasData();
    cropperInst.setCropBoxData({ left: c.left, top: c.top, width: c.width, height: c.height });
  }, 100);
  $('crop-etape1').style.display = 'none';
  $('crop-etape2').style.display = '';
  $('crop-hdr-titre').textContent = 'Étape 2 — Recadrer';
});

$('btn-crop-retour').addEventListener('click', () => {
  if (!cropperInst) return;
  // Retour à l'étape 1 : masquer le cadre
  cropperInst.clear();
  $('crop-etape1').style.display = '';
  $('crop-etape2').style.display = 'none';
  $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
});

$('inp-photo').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  ouvrirCrop(f, b64 => {
    photoB64 = b64;
    $('photo-prev').src = 'data:image/jpeg;base64,' + photoB64;
    $('photo-prev').style.display = 'block'; $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
    afficherQualitePhoto(_origPhotoMaxDim, true);
  });
});

// ── Guide des tailles ──
function ouvrirGuide() {
  const tbody = $('guide-tbody');
  tbody.innerHTML = '';
  // Dimensions types par code (portrait/paysage)
  const dims = {
    'XXS': '40×30 cm',
    'XS':  '40×50 cm',
    'M':   '70×50, 75×55 cm',
    'XL':  '80×60, 80×45 cm',
    'XXL': '100×75, 115×75 cm',
    'E':   '100×40 cm (étirée)'
  };
  tailles.forEach(t => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:0.5px solid var(--brd);';
    tr.innerHTML = '<td style="padding:.45rem .5rem;font-weight:600;color:var(--gold);">'+t.code+'</td>' +
      '<td style="padding:.45rem .5rem;">'+t.label+'</td>' +
      '<td style="padding:.45rem .5rem;color:var(--muted);font-size:11px;">'+(dims[t.code]||'—')+'</td>';
    tbody.appendChild(tr);
  });
  $('overlay-guide').classList.add('ouvert');
  $('overlay-guide').style.display = 'flex';
}
$('btn-guide-tailles').addEventListener('click', ouvrirGuide);
$('btn-close-guide').addEventListener('click', () => {
  $('overlay-guide').classList.remove('ouvert');
  $('overlay-guide').style.display = 'none';
});
$('overlay-guide').addEventListener('click', e => {
  if (e.target === $('overlay-guide')) { $('overlay-guide').style.display = 'none'; }
});

// ── Dimensions favoris + taille automatique ────────────────────

function construireFavoris() {
  var cont = $('dims-favoris');
  if (!cont) return;
  /* Pas de favoris pour sculpture — chaque pièce a des dimensions uniques.
     Utilise _typeEdition (type de l'œuvre en cours), pas ADMIN_TYPE
     (type principal de l'admin) — sinon en cohabitation, une sculpture
     éditée chez Fred verrait les favoris peinture. */
  var _typeAct = (typeof _typeEdition !== 'undefined' ? _typeEdition : null) || window.ADMIN_TYPE || 'peinture';
  if (_typeAct === 'sculpture') { cont.style.display = 'none'; return; }
  cont.innerHTML = '';
  var seen = new Set(), favoris = [];
  toiles.forEach(function(t) {
    var d = t.dimensions;
    if (!d || !d.largeur || !d.hauteur || d.type === 'ronde') return;
    var key = d.largeur + 'x' + d.hauteur;
    if (!seen.has(key)) { seen.add(key); favoris.push({ l: d.largeur, h: d.hauteur, taille: t.taille || '' }); }
  });
  // Portraits (h>l) en premier, paysages/carrés ensuite — surface croissante dans chaque groupe
  favoris.sort(function(a, b) {
    var aPort = a.h > a.l ? 0 : 1;
    var bPort = b.h > b.l ? 0 : 1;
    if (aPort !== bPort) return aPort - bPort;
    return (a.l * a.h) - (b.l * b.h);
  });
  if (!favoris.length) { cont.style.display = 'none'; return; }
  cont.style.display = 'flex';
  favoris.forEach(function(f) {
    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'dim-chip';
    /* M2 / amélioration : code taille en label principal (XS, M, XL...)
       avec dimensions en sous-texte discret. Plus parlant que le format
       châssis français pour l'artiste qui pense en termes de catégories. */
    var codeTxt = f.taille || autoComputeTaille(f.l, f.h) || '?';
    var dimTxt  = f.l + '\u00d7' + f.h;
    chip.innerHTML = '<span class="dim-chip-code">' + codeTxt + '</span>' +
                     '<span class="dim-chip-dim">' + dimTxt + '</span>';
    chip.dataset.l = f.l; chip.dataset.h = f.h; chip.dataset.taille = f.taille;
    chip.addEventListener('click', function() {
      $('inp-larg').value = f.l; $('inp-haut').value = f.h;
      $('sel-format').value = '';
      synchroChips(f.l, f.h);
      afficherTailleAuto(f.taille || autoComputeTaille(f.l, f.h));
    });
    cont.appendChild(chip);
  });
}

function synchroChips(l, h) {
  document.querySelectorAll('#dims-favoris .dim-chip').forEach(function(c) {
    c.classList.toggle('sel', parseInt(c.dataset.l) === l && parseInt(c.dataset.h) === h);
  });
}

/* Peuple le dropdown 'Codes taille' avec les codes définis par l'artiste,
   chaque code accompagné de la dimension la plus utilisée parmi ses toiles.
   Remplace l'ancien dropdown 'Formats châssis français' statique. */
function peuplerSelectFormatCodes() {
  var sel = $('sel-format'); if (!sel) return;
  /* Réservé peinture : en sculpture, cette zone est masquée */
  var _typeAct = (typeof _typeEdition !== 'undefined' ? _typeEdition : null) || window.ADMIN_TYPE || 'peinture';
  if (_typeAct === 'sculpture') return;

  /* Récupère la liste des codes : tailles[] définies par l'artiste */
  var tailles = (typeof _taillesParType !== 'undefined' && _taillesParType.peinture)
    ? _taillesParType.peinture
    : (typeof window.tailles !== 'undefined' ? window.tailles : []);

  /* Pour chaque code, compte les dimensions utilisées (l×h → fréquence) */
  var dimsParCode = {};
  toiles.forEach(function(t) {
    if (((t._type)||window.ADMIN_TYPE||'peinture') !== 'peinture') return;
    if (!t.taille || !t.dimensions || !t.dimensions.largeur || !t.dimensions.hauteur) return;
    if (t.dimensions.type === 'ronde') return;
    var c = t.taille;
    var k = t.dimensions.largeur + 'x' + t.dimensions.hauteur;
    if (!dimsParCode[c]) dimsParCode[c] = {};
    dimsParCode[c][k] = (dimsParCode[c][k] || 0) + 1;
  });

  /* Vide et reconstruit les options dans l'ordre des tailles[] (XXS, XS, M, XL, XXL, E) */
  sel.innerHTML = '<option value="">Choisir…</option>';
  tailles.forEach(function(t) {
    var code = t.code;
    var dims = dimsParCode[code];
    if (!dims) return; /* code défini mais aucune toile l'utilise → on saute */
    /* Choisir la dimension la plus fréquente */
    var meilleur = null, meilleurNb = 0;
    Object.keys(dims).forEach(function(k) {
      if (dims[k] > meilleurNb) { meilleur = k; meilleurNb = dims[k]; }
    });
    if (!meilleur) return;
    var opt = document.createElement('option');
    opt.value = meilleur;
    var dimAff = meilleur.replace('x', '\u00d7');
    opt.textContent = code + ' — ' + dimAff + ' cm' + (t.label ? ' (' + t.label + ')' : '');
    sel.appendChild(opt);
  });
}

function autoComputeTaille(l, h) {
  if (!l || !h) return '';
  for (var i = 0; i < toiles.length; i++) {
    var t = toiles[i];
    if (t.taille && t.dimensions && t.dimensions.largeur === l && t.dimensions.hauteur === h) return t.taille;
  }
  var surface = l * h, best = null, bestDelta = Infinity;
  toiles.forEach(function(t) {
    if (!t.taille || !t.dimensions || !t.dimensions.largeur || !t.dimensions.hauteur) return;
    var delta = Math.abs(t.dimensions.largeur * t.dimensions.hauteur - surface);
    if (delta < bestDelta) { bestDelta = delta; best = t.taille; }
  });
  if (best) return best;
  var s = new Set([l, h]);
  var f = function(a, b) { return s.has(a) && s.has(b); };
  if (f(40,30)) return 'XXS';
  if (f(40,50)||f(50,40)) return 'XS';
  if (f(70,50)||f(75,55)||f(55,75)||f(60,50)) return 'M';
  if (f(80,60)||f(60,80)||f(80,45)) return 'XL';
  if (f(115,75)||f(100,75)) return 'XXL';
  if (f(100,40)) return 'E';
  return '';
}

function afficherTailleAuto(code) {
  var badge = $('taille-auto-badge');
  if (!badge) return;
  remplirSelectTaille();
  if (code) {
    var tObj = tailles.find(function(x) { return x.code === code; });
    badge.textContent = code + (tObj ? ' \u00b7 ' + tObj.label : '');
    badge.className = 'taille-auto-badge';
    if ($('sel-taille').querySelector('option[value="' + code + '"]')) {
      $('sel-taille').value = code;
    } else {
      $('sel-taille').value = '';
      $('taille-manual-wrap').style.display = '';
    }
  } else {
    badge.textContent = '\u2014';
    badge.className = 'taille-auto-badge vide';
    $('sel-taille').value = '';
  }
}

['inp-larg', 'inp-haut'].forEach(function(id) {
  var el = $(id); if (!el) return;
  el.addEventListener('input', function() {
    var l = parseInt($('inp-larg').value) || 0;
    var h = parseInt($('inp-haut').value) || 0;
    synchroChips(l, h);
    if (l && h) afficherTailleAuto(autoComputeTaille(l, h));
    $('sel-format').value = '';
  });
});

$('sel-format').addEventListener('change', function() {
  var fv = this.value;
  if (!fv) return;
  /* Format: 'LxH' (ex: '40x50') — les options sont peuplées dynamiquement par
     peuplerSelectFormatCodes() depuis les codes taille + dimensions courantes. */
  var parts = fv.split('x');
  if (parts.length === 2) {
    var l = parseInt(parts[0]), h = parseInt(parts[1]);
    $('inp-larg').value = l; $('inp-haut').value = h;
    synchroChips(l, h);
    afficherTailleAuto(autoComputeTaille(l, h));
  }
});

$('btn-toggle-chassis').addEventListener('click', function() {
  var open = $('dims-chassis').style.display !== 'none';
  $('dims-chassis').style.display = open ? 'none' : '';
  this.textContent = (open ? '\u25b8' : '\u25be') + ' Codes taille';
});

$('btn-taille-modifier').addEventListener('click', function() {
  var wrap = $('taille-manual-wrap');
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : '';
  this.textContent = open ? 'Modifier \u25be' : 'R\u00e9duire \u25b4';
});

// Swipe bas pour fermer modal toile — déclenché uniquement depuis la poignée
let swY = null, swHandle = false;
$('overlay-toile').querySelector('.modal').addEventListener('touchstart', e => {
  swY = e.touches[0].clientY;
  swHandle = !!e.target.closest('.modal-handle');
}, { passive: true });
$('overlay-toile').querySelector('.modal').addEventListener('touchend', e => {
  if (swY && swHandle && e.changedTouches[0].clientY - swY > 60) fermerModalToile();
  swY = null; swHandle = false;
}, { passive: true });

// Modal salle
$('btn-close-salle').addEventListener('click', () => fermerModalSalle());
$('btn-annuler-salle').addEventListener('click', () => fermerModalSalle());
$('btn-creer-salle').addEventListener('click', () => creerSalle());
$('overlay-salle').addEventListener('click', e => { if (e.target === $('overlay-salle')) fermerModalSalle(); });

// Restore
$('btn-restore-ann1').addEventListener('click', () => $('overlay-restore').classList.remove('ouvert'));
$('btn-restore-ann2').addEventListener('click', () => $('overlay-restore').classList.remove('ouvert'));
$('btn-restore-suite').addEventListener('click', () => {
  document.querySelectorAll('.restore-step').forEach(s => s.classList.remove('active'));
  $('restore-s2').classList.add('active'); $('inp-restore').focus();
});
$('inp-restore').addEventListener('input', () => {
  $('btn-restore-ok').disabled = $('inp-restore').value !== 'RESTAURER';
});
$('btn-restore-ok').addEventListener('click', executerRestauration);
$('overlay-restore').addEventListener('click', e => { if (e.target === $('overlay-restore')) $('overlay-restore').classList.remove('ouvert'); });

// Init swatches couleurs
initSwatches();
// initTailleForm() appelé dans admin.html après chargement admin-galerie.js

/* ══════════════════════════════════════════════════════════════
   PICKER COULEUR HSV — Zone canvas + curseur teinte + palette
   ══════════════════════════════════════════════════════════════ */

var _pickerCouleurType = null;
var _pickerGrilleBuilt = false;
var _picker = { h: 0, s: 0.8, v: 0.35 };  // teinte 0-360, sat 0-1, val 0-1
var _pickerDrag = null; // 'canvas' | 'hue' | null

/* ── Conversions couleur ── */
function _hsvToHex(h, s, v) {
  var i = Math.floor(h / 60) % 6;
  var f = h / 60 - Math.floor(h / 60);
  var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  var rgb = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
  return '#' + rgb.map(function(x) {
    return Math.round(x * 255).toString(16).padStart(2, '0');
  }).join('');
}

function _hexToHsv(hex) {
  if (!hex || hex.length < 7) return null;
  var r = parseInt(hex.slice(1,3), 16) / 255;
  var g = parseInt(hex.slice(3,5), 16) / 255;
  var b = parseInt(hex.slice(5,7), 16) / 255;
  var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  var h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: h, s: s, v: v };
}

/* ── Rendu canvas HSV ── */
function _drawPickerCanvas() {
  var canvas = document.getElementById('picker-canvas');
  if (!canvas) return;
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var pw = rect.width, ph = rect.height;
  if (pw <= 0) return;
  canvas.width  = pw * dpr;
  canvas.height = ph * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var w = pw, h = ph;

  // Base : couleur de teinte pure
  ctx.fillStyle = 'hsl(' + _picker.h + ',100%,50%)';
  ctx.fillRect(0, 0, w, h);

  // Dégradé blanc → transparent (gauche = blanc, droite = couleur)
  var gW = ctx.createLinearGradient(0, 0, w, 0);
  gW.addColorStop(0, 'rgba(255,255,255,1)');
  gW.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gW;
  ctx.fillRect(0, 0, w, h);

  // Dégradé transparent → noir (haut = clair, bas = noir)
  var gB = ctx.createLinearGradient(0, 0, 0, h);
  gB.addColorStop(0, 'rgba(0,0,0,0)');
  gB.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gB;
  ctx.fillRect(0, 0, w, h);

  // Curseur
  var cx = _picker.s * w;
  var cy = (1 - _picker.v) * h;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ── Mise à jour UI ── */
function _updatePickerUI() {
  var hex = _hsvToHex(_picker.h, _picker.s, _picker.v);

  // Redessiner le canvas
  _drawPickerCanvas();

  // Position poignée teinte
  var thumb = document.getElementById('picker-hue-thumb');
  if (thumb) thumb.style.left = (_picker.h / 360 * 100) + '%';

  // Aperçu couleur
  var prev = document.getElementById('picker-cur-col');
  if (prev) prev.style.background = hex;

  // Champ hex (ne pas écraser si l'utilisateur tape)
  var inp = document.getElementById('picker-hex-inp');
  if (inp && document.activeElement !== inp) inp.value = hex.toUpperCase();
}

/* ── Événements canvas ── */
function _pickFromCanvas(e) {
  var canvas = document.getElementById('picker-canvas');
  var rect = canvas.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _picker.s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  _picker.v = Math.max(0, Math.min(1, 1 - (clientY - rect.top)  / rect.height));
  _updatePickerUI();
}

function _pickFromHue(e) {
  var track = document.getElementById('picker-hue-track');
  var rect = track.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  _picker.h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
  _updatePickerUI();
}

/* ── Init listeners canvas/hue (une seule fois) ── */
var _pickerListenersInit = false;
function _initPickerListeners() {
  if (_pickerListenersInit) return;
  _pickerListenersInit = true;

  var canvas = document.getElementById('picker-canvas');
  var hueTrack = document.getElementById('picker-hue-track');
  if (!canvas || !hueTrack) return;

  // Canvas — mouse
  canvas.addEventListener('mousedown', function(e) {
    _pickerDrag = 'canvas'; _pickFromCanvas(e); e.preventDefault();
  });
  // Canvas — touch
  canvas.addEventListener('touchstart', function(e) {
    _pickerDrag = 'canvas'; _pickFromCanvas(e); e.preventDefault();
  }, { passive: false });

  // Hue track — mouse
  hueTrack.addEventListener('mousedown', function(e) {
    _pickerDrag = 'hue'; _pickFromHue(e); e.preventDefault();
  });
  // Hue track — touch
  hueTrack.addEventListener('touchstart', function(e) {
    _pickerDrag = 'hue'; _pickFromHue(e); e.preventDefault();
  }, { passive: false });

  // Move + end (globaux pour sortie du canvas)
  document.addEventListener('mousemove', function(e) {
    if (_pickerDrag === 'canvas') _pickFromCanvas(e);
    else if (_pickerDrag === 'hue') _pickFromHue(e);
  });
  document.addEventListener('touchmove', function(e) {
    if (_pickerDrag === 'canvas') { _pickFromCanvas(e); e.preventDefault(); }
    else if (_pickerDrag === 'hue') { _pickFromHue(e); e.preventDefault(); }
  }, { passive: false });
  document.addEventListener('mouseup',  function() { _pickerDrag = null; });
  document.addEventListener('touchend', function() { _pickerDrag = null; });

  // Saisie hex manuelle
  var hexInp = document.getElementById('picker-hex-inp');
  if (hexInp) {
    hexInp.addEventListener('input', function() {
      var v = this.value.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
      var hsv = _hexToHsv(v);
      if (hsv) {
        _picker.h = hsv.h; _picker.s = hsv.s; _picker.v = hsv.v;
        _updatePickerUI();
      }
    });
    hexInp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') _confirmerPickerCouleur();
    });
  }
}

/* ── Palettes thématiques ── */
var COULEUR_PALETTES = {
  galerie: [
    // Noirs → gris → blancs
    '#0d0d0d','#1a1a1a','#2e2e2e','#454545','#676767','#8e8e8e',
    '#aaaaaa','#c5c5c5','#dbd7cf','#e4e0d8','#edeae2','#fdfaf5',
    // Terres & bois
    '#2a1a10','#3a2a1e','#5c3d2e','#7a5030','#8a6228','#a07540',
    // Ocres & sablés
    '#c8a050','#d4ae60','#caa878','#b09070','#9a7858','#7a5c42',
    // Bleus & ardoises
    '#0f1520','#1a2030','#2c2535','#1a3050','#254470','#38608a',
    // Verts
    '#0a1410','#162318','#1e3228','#1e3a2a','#2a4c38','#3d6040',
    // Bordeaux & prunes
    '#1a0808','#2e1010','#4a1a1a','#4a1a30','#3a1042','#2a184a',
    // Terracotta
    '#6a2020','#7a3020','#8a4030','#5a1a1a','#3a1010','#4a2820',
    // Kaki & sauge
    '#3a4a30','#4a5a38','#5a6a40','#6a7a50','#8a9060','#a0a870',
  ],
  pastels: [
    // Roses & mauves
    '#f2d4d4','#f0c8d8','#e8c0d4','#e4b8e0','#d8c4ec','#ccc0f0',
    // Bleus & ciels
    '#c4d4f4','#b8dcf0','#b4e4f4','#b0ecf0','#b4ece8','#b8f0e0',
    // Verts & anis
    '#c0eccc','#c8f0bc','#d4f0b4','#e0f0b0','#ecf0b0','#f4ecb0',
    // Jaunes & pêches
    '#f4e4a8','#f4d8a0','#f4cc9c','#f4c098','#f4b498','#f4b0a8',
    // Lavandes & lilas
    '#e0ccf0','#e8c8ec','#ecc4e8','#f0c4e0','#f0c8d8','#f0cccc',
    // Aquas & menthes
    '#b0e8e8','#a8e4ec','#a8dcf0','#b0d4f4','#bccef4','#c8c8f4',
  ],
  fluo: [
    // Roses & magentas
    '#ff0066','#ff0099','#ff00cc','#ff33aa','#ff3388','#ee0055',
    // Oranges & rouges
    '#ff3300','#ff5500','#ff6600','#ff7700','#ff4400','#ff2200',
    // Jaunes & limes
    '#ffff00','#ffee00','#ffdd00','#ccff00','#aaff00','#88ff00',
    // Verts
    '#00ff00','#00ff33','#00ff66','#00ff99','#00ffbb','#33ff44',
    // Bleus & cyans
    '#00ffff','#00eeff','#00ccff','#0099ff','#0066ff','#0044ff',
    // Violets & ultraviolets
    '#6600ff','#8800ff','#aa00ff','#cc00ff','#ee00ff','#ff00ff',
  ],
};

var _pickerGrilleBuilt = false;
var _pickerTabActif = 'galerie';

function _buildPickerGrille() {
  if (_pickerGrilleBuilt) return;
  var grille = document.getElementById('picker-grille');
  if (!grille) return;

  // Construire les 3 palettes en conteneurs superposés
  Object.keys(COULEUR_PALETTES).forEach(function(tab) {
    var pane = document.createElement('div');
    pane.id = 'picker-pane-' + tab;
    pane.style.display = tab === 'galerie' ? 'flex' : 'none';
    pane.style.flexWrap = 'wrap';
    pane.style.gap = '5px';

    COULEUR_PALETTES[tab].forEach(function(col) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-sw';
      btn.style.background = col;
      btn.title = col;
      btn.addEventListener('click', function() {
        var hsv = _hexToHsv(col);
        if (hsv) { _picker.h = hsv.h; _picker.s = hsv.s; _picker.v = hsv.v; }
        _updatePickerUI();
        _confirmerPickerCouleur();
      });
      pane.appendChild(btn);
    });

    grille.appendChild(pane);
  });

  // Listeners onglets
  document.querySelectorAll('.picker-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var nom = this.dataset.tab;
      _pickerTabActif = nom;
      document.querySelectorAll('.picker-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      Object.keys(COULEUR_PALETTES).forEach(function(k) {
        var pane = document.getElementById('picker-pane-' + k);
        if (pane) pane.style.display = k === nom ? 'flex' : 'none';
      });
    });
  });

  _pickerGrilleBuilt = true;
}

/* ── API publique ── */
function ouvrirPickerCouleur(type) {
  _pickerCouleurType = type;

  // Mettre à jour le titre
  var titre = document.getElementById('picker-titre');
  if (titre) titre.textContent =
    (type === 'mur')        ? 'Couleur du mur'
  : (type === 'mur-piece')  ? 'Couleur de la pièce'
  : (type === 'mur-bas')    ? 'Couleur du mur du bas'
  : (type === 'support')    ? 'Couleur du support'
  : (type === 'vitrine')    ? 'Couleur de la vitrine'
                            : 'Couleur des cadres';

  // Charger la couleur courante dans le picker
  var hex =
    (type === 'mur')        ? couleurMurActuel
  : (type === 'mur-piece')  ? couleurMurPieceActuel
  : (type === 'mur-bas')    ? couleurMurBasActuel
  : (type === 'support')    ? (window._supportPickerCouleur || '#eae6de')
  : (type === 'vitrine')    ? (window._vitrinePickerCouleur || '#6a4b28')
                            : couleurCadresActuel;
  var hsv = _hexToHsv(hex);
  if (hsv) { _picker.h = hsv.h; _picker.s = hsv.s; _picker.v = hsv.v; }

  _buildPickerGrille();

  var overlay = document.getElementById('overlay-picker-col');
  if (overlay) overlay.style.display = 'flex';

  // Marquer couleur active dans palette rapide
  document.querySelectorAll('.picker-sw').forEach(function(btn) {
    btn.classList.toggle('picker-sw-sel', btn.title.toLowerCase() === hex.toLowerCase());
  });

  // Init listeners une seule fois (le canvas doit être visible pour getBoundingClientRect)
  _initPickerListeners();

  // Render après que le navigateur a calculé le layout
  requestAnimationFrame(function() { _updatePickerUI(); });
}

function fermerPickerCouleur() {
  var overlay = document.getElementById('overlay-picker-col');
  if (overlay) overlay.style.display = 'none';
  _pickerCouleurType = null;
  _pickerDrag = null;
}

function _confirmerPickerCouleur() {
  var hex = _hsvToHex(_picker.h, _picker.s, _picker.v);
  // Normaliser depuis champ hex si l'utilisateur a tapé
  var inp = document.getElementById('picker-hex-inp');
  if (inp && /^#[0-9a-fA-F]{6}$/.test(inp.value)) hex = inp.value.toLowerCase();
  if (_pickerCouleurType === 'mur') { pushColorHist('mur', hex); setCouleurMur(hex); }
  else if (_pickerCouleurType === 'mur-piece') { pushColorHist('mur-piece', hex); setCouleurMurPiece(hex); }
  else if (_pickerCouleurType === 'mur-bas') { pushColorHist('mur-bas', hex); setCouleurMurBas(hex); }
  else if (_pickerCouleurType === 'sol') { pushColorHist('sol', hex); setCouleurSol(hex); }
  else if (_pickerCouleurType === 'support') { if (typeof window._supportPickerOnConfirm === 'function') window._supportPickerOnConfirm(hex); }
  else if (_pickerCouleurType === 'vitrine') { if (typeof window._vitrinePickerOnConfirm === 'function') window._vitrinePickerOnConfirm(hex); }
  else { pushColorHist('cadres', hex); setCouleurCadres(hex); }
  fermerPickerCouleur();
}

