// ═══════════════════════════════════════════════
// ADMIN-TEXTURES.JS — Presets / Couleurs / Textures + Recadrage Cropper.js
// Dépend de : afficherMur, marquerChangement, toast, $, ADMIN_CFG (admin.js)

let _snapshotApparence = null;

function prendreSnapshotApparence() {
  _snapshotApparence = {
    couleur_mur:     couleurMurActuel,
    couleur_cadres:  couleurCadresActuel,
    epaisseur_cadres:epaisseurCadresActuel,
    texture:         textureActuelle
  };
}

function restaurerSnapshotApparence() {
  if (!_snapshotApparence || !salleActive) return;
  couleurMurActuel      = _snapshotApparence.couleur_mur;
  couleurCadresActuel   = _snapshotApparence.couleur_cadres;
  epaisseurCadresActuel = _snapshotApparence.epaisseur_cadres;
  textureActuelle       = _snapshotApparence.texture;
  salleActive.couleur_mur      = couleurMurActuel;
  salleActive.couleur_cadres   = couleurCadresActuel;
  salleActive.epaisseur_cadres = epaisseurCadresActuel;
  salleActive.texture          = textureActuelle;
  appliquerApparence();
  if (typeof afficherMur === 'function') afficherMur();
  _snapshotApparence = null;
}
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
  const isImgTex = /\.(jpg|jpeg|png|webp)$/i.test(textureActuelle);
  if (isImgTex) {
    /* Texture image : multiply blend pour laisser voir la couleur */
    bg.style.background = 'url("' + (TEXTURES[textureActuelle] || '').replace(/url\("|"\)/g,'') + '") center/cover, ' + couleurMurActuel;
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
/* Retourne le nom lisible d'une texture (builtin ou custom) */
function getTextureName(key) {
  var nomsTex = {none:'Uni',tissu:'Tissu',bois:'Bois clair',parquet:'Parquet',pierre:'Pierre',damier:'Damier',velours:'Velours',brique:'Béton/Brique'};
  if (nomsTex[key]) return nomsTex[key];
  // Texture custom localStorage
  var customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
  var found = customs.find(function(t){ return t.key === key; });
  if (found) return found.nom;
  // Texture GitHub : nom depuis le fichier (tirets/underscores → espaces, capitalize)
  if (key && key.indexOf('/') >= 0) {
    var fichier = key.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    return fichier.charAt(0).toUpperCase() + fichier.slice(1);
  }
  return key || 'Uni';
}

function ouvrirModalPreset() {
  // Fermer le panneau couleurs pour ne pas gêner la saisie
  $('coul-panel').classList.remove('ouvert');
  $('coul-overlay').classList.remove('ouvert');
  $('btn-coul-toggle').classList.remove('on');
  // Prérempli la preview
  $('preset-prev-mur').style.background = couleurMurActuel;
  $('preset-prev-mur-val').textContent = couleurMurActuel;
  $('preset-prev-cadres').style.background = couleurCadresActuel;
  $('preset-prev-cadres-val').textContent = couleurCadresActuel;
  const nomsTex = {none:'Uni',tissu:'Tissu',bois:'Bois clair',parquet:'Parquet',pierre:'Pierre',damier:'Damier',velours:'Velours',brique:'Béton/Brique'};
  $('preset-prev-texture-val').textContent = getTextureName(textureActuelle);
  if (TEXTURES[textureActuelle]) $('preset-prev-texture').style.background = TEXTURES[textureActuelle] + ',#555';
  $('inp-preset-nom').value = '';
  $('overlay-preset').classList.add('ouvert');
  setTimeout(() => $('inp-preset-nom').focus(), 200);
}

function confirmerPreset() {
  const nom = $('inp-preset-nom').value.trim();
  if (!nom) { toast('Entrez un nom pour le preset', 'err'); return; }
  const presets = JSON.parse(localStorage.getItem(K.presets) || '{}');
  presets[nom] = { couleur_mur: couleurMurActuel, couleur_cadres: couleurCadresActuel, epaisseur_cadres: epaisseurCadresActuel, texture: textureActuelle };
  localStorage.setItem(K.presets, JSON.stringify(presets));
  $('overlay-preset').classList.remove('ouvert');
  toast(`✓ Preset "${nom}" sauvegardé`);
}

function chargerPreset() {
  // Fermer le panneau couleurs pour ne pas le laisser devant
  $('coul-panel').classList.remove('ouvert');
  $('coul-overlay').classList.remove('ouvert');
  $('btn-coul-toggle').classList.remove('on');
  const presets = JSON.parse(localStorage.getItem(K.presets) || '{}');
  const noms = Object.keys(presets);
  if (!noms.length) { toast("Aucun preset — sauvegardez-en un d'abord", 'err'); return; }

  const liste = $('preset-charger-liste');
  liste.innerHTML = '';

  noms.forEach(function(nom) {
    const p = presets[nom];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.65rem;padding:.55rem .6rem;border-radius:6px;cursor:pointer;border:1px solid var(--brd);background:var(--bg3);transition:border-color .15s;';
    row.addEventListener('mouseenter', function(){ row.style.borderColor = 'var(--gold)'; });
    row.addEventListener('mouseleave', function(){ row.style.borderColor = 'var(--brd)'; });

    const prevMur = document.createElement('div');
    prevMur.style.cssText = 'width:28px;height:28px;border-radius:4px;flex-shrink:0;';
    prevMur.style.background = p.couleur_mur || '#2e2e2e';

    const prevCad = document.createElement('div');
    prevCad.style.cssText = 'width:14px;height:28px;border-radius:3px;flex-shrink:0;';
    prevCad.style.background = p.couleur_cadres || '#3a3a3a';

    const infos = document.createElement('div');
    infos.style.cssText = 'flex:1;min-width:0;';
    const ep = p.epaisseur_cadres && p.epaisseur_cadres !== 2 ? ' · ' + p.epaisseur_cadres + 'px' : '';
    infos.innerHTML = '<div style="font-size:.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + nom + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted);">' + getTextureName(p.texture) + ep + '</div>';

    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑';
    btnDel.style.cssText = 'background:none;border:none;font-size:14px;cursor:pointer;color:var(--muted);padding:2px 4px;flex-shrink:0;';
    btnDel.title = 'Supprimer';
    btnDel.addEventListener('click', function(e) {
      e.stopPropagation();
      const ps = JSON.parse(localStorage.getItem(K.presets) || '{}');
      delete ps[nom];
      localStorage.setItem(K.presets, JSON.stringify(ps));
      row.remove();
      if (!liste.children.length) $('overlay-preset-charger').classList.remove('ouvert');
    });

    row.appendChild(prevMur); row.appendChild(prevCad); row.appendChild(infos); row.appendChild(btnDel);

    row.addEventListener('click', function() {
      couleurMurActuel      = p.couleur_mur || '#2e2e2e';
      couleurCadresActuel   = p.couleur_cadres || '#3a3a3a';
      epaisseurCadresActuel = p.epaisseur_cadres || 2;
      textureActuelle       = p.texture || 'none';
      if (salleActive) {
        salleActive.couleur_mur      = couleurMurActuel;
        salleActive.couleur_cadres   = couleurCadresActuel;
        salleActive.epaisseur_cadres = epaisseurCadresActuel;
        salleActive.texture          = textureActuelle;
        marquerChangement();
      }
      appliquerApparence(); afficherMur();
      $('overlay-preset-charger').classList.remove('ouvert');
      toast("Preset \"" + nom + "\" appliqué");
    });

    liste.appendChild(row);
  });

  $('overlay-preset-charger').classList.add('ouvert');
}


let _pendingTextureFile = null;

function gererTextureCustom(fichier) {
  if (!fichier) return;
  _pendingTextureFile = fichier;
  var suggestion = fichier.name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
  $('inp-tex-nom').value = suggestion;
  $('overlay-tex-nom').classList.add('ouvert');
  setTimeout(function() { $('inp-tex-nom').select(); }, 150);
}

function confirmerTextureNom() {
  var nom = $('inp-tex-nom').value.trim();
  if (!nom) { toast("Entrez un nom pour la texture", "err"); return; }
  if (!_pendingTextureFile) return;
  $('overlay-tex-nom').classList.remove('ouvert');
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const key = 'tex_custom_' + Date.now();
    const customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
    customs.push({ key, url: dataUrl, nom });
    if (customs.length > 5) customs.shift();
    localStorage.setItem(K.textures, JSON.stringify(customs));
    afficherTexturesCustom();
    setTexture(key);
    toast("✓ Texture \"" + nom + "\" ajoutée");
    _pendingTextureFile = null;
  };
  reader.readAsDataURL(_pendingTextureFile);
}

function renommerTexture(key) {
  var customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
  var t = customs.find(function(x){ return x.key === key; });
  if (!t) return;
  var nouveau = prompt("Nouveau nom pour \"" + t.nom + "\" :", t.nom);
  if (!nouveau || !nouveau.trim()) return;
  t.nom = nouveau.trim();
  localStorage.setItem(K.textures, JSON.stringify(customs));
  afficherTexturesCustom();
  toast("✓ Renommé en \"" + t.nom + "\"");
}

function afficherTexturesCustom() {
  const cont = $('textures-custom'); if (!cont) return;
  cont.innerHTML = '';
  const customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
  customs.forEach(t => {
    TEXTURES[t.key] = `url("${t.url}")`;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;';
    const sw = document.createElement('div');
    sw.className = 'sw' + (textureActuelle === t.key ? ' sel' : '');
    sw.style.backgroundImage = `url("${t.url}")`;
    sw.style.backgroundSize = 'cover';
    sw.dataset.val = t.key;
    sw.title = t.nom;
    sw.addEventListener('click', () => {
      document.querySelectorAll('#sw-texture .sw, #textures-custom .sw').forEach(s => s.classList.remove('sel'));
      sw.classList.add('sel'); setTexture(t.key);
    });
    // Bouton renommer (petit crayon au survol)
    const btnRen = document.createElement('button');
    btnRen.textContent = '✎';
    btnRen.title = 'Renommer';
    btnRen.style.cssText = 'position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;border:none;background:var(--gold);color:#111;font-size:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;opacity:0;transition:opacity .15s;';
    wrap.addEventListener('mouseenter', function(){ btnRen.style.opacity='1'; });
    wrap.addEventListener('mouseleave', function(){ btnRen.style.opacity='0'; });
    btnRen.addEventListener('click', function(e){ e.stopPropagation(); renommerTexture(t.key); });
    wrap.appendChild(sw);
    wrap.appendChild(btnRen);
    cont.appendChild(wrap);
  });
}




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
    hist = hist.slice(0, 8);
    try { localStorage.setItem(key, JSON.stringify(hist)); } catch(e) {}
  }
  renderColorSwatches(type);
}

function renderColorSwatches(type) {
  var containerId = type === 'mur' ? 'sw-mur' : 'sw-cadres';
  var container   = $(containerId);
  var current     = type === 'mur' ? couleurMurActuel : couleurCadresActuel;
  var plus        = container.querySelector('.sw-plus');
  container.innerHTML = '';
  getColorHist(type).forEach(function(col) {
    var sw = document.createElement('div');
    sw.className = 'sw' + (col.toLowerCase() === current.toLowerCase() ? ' sel' : '');
    sw.style.background = col;
    sw.dataset.val = col;
    sw.addEventListener('click', function() {
      pushColorHist(type, col);
      if (type === 'mur') setCouleurMur(col);
      else setCouleurCadres(col);
    });
    container.appendChild(sw);
  });
  if (plus) container.appendChild(plus);
}

function initSwatches() {
  renderColorSwatches('mur');
  renderColorSwatches('cadres');

  document.querySelectorAll('#sw-texture .sw').forEach(function(sw) {
    sw.addEventListener('click', function() { swSelect(sw, 'texture'); setTexture(sw.dataset.val); });
  });

  // Picker mur : initialisé à la couleur courante
  $('mur-custom').addEventListener('click', function() { this.value = couleurMurActuel; });
  $('mur-custom').addEventListener('change', function(e) {
    pushColorHist('mur', e.target.value);
    setCouleurMur(e.target.value);
  });

  // Picker cadres : initialisé à la couleur courante
  $('cadres-custom').addEventListener('click', function() { this.value = couleurCadresActuel; });
  $('cadres-custom').addEventListener('change', function(e) {
    pushColorHist('cadres', e.target.value);
    setCouleurCadres(e.target.value);
  });

  // Slider épaisseur cadres
  $('ep-cadres').addEventListener('input', function() {
    setEpaisseurCadres(parseInt(this.value));
  });

  $('btn-preset-sauver').addEventListener('click', ouvrirModalPreset);
  $('btn-preset-charger').addEventListener('click', chargerPreset);
  $('btn-close-preset').addEventListener('click', function() { $('overlay-preset').classList.remove('ouvert'); });
  $('btn-annuler-preset').addEventListener('click', function() { $('overlay-preset').classList.remove('ouvert'); });
  $('btn-close-tex-nom').addEventListener('click', function() { $('overlay-tex-nom').classList.remove('ouvert'); _pendingTextureFile = null; });
  $('btn-annuler-tex-nom').addEventListener('click', function() { $('overlay-tex-nom').classList.remove('ouvert'); _pendingTextureFile = null; });
  $('btn-confirmer-tex-nom').addEventListener('click', confirmerTextureNom);
  $('inp-tex-nom').addEventListener('keydown', function(e){ if(e.key==='Enter') confirmerTextureNom(); });
  $('btn-close-preset-charger').addEventListener('click', function() { $('overlay-preset-charger').classList.remove('ouvert'); });
  $('btn-annuler-preset-charger').addEventListener('click', function() { $('overlay-preset-charger').classList.remove('ouvert'); });
  $('overlay-preset-charger').addEventListener('click', function(e) { if(e.target===$('overlay-preset-charger')) $('overlay-preset-charger').classList.remove('ouvert'); });
  $('btn-confirmer-preset').addEventListener('click', confirmerPreset);
  $('inp-preset-nom').addEventListener('keydown', function(e) { if(e.key==='Enter') confirmerPreset(); });
  $('overlay-preset').addEventListener('click', function(e) { if(e.target===$('overlay-preset')) $('overlay-preset').classList.remove('ouvert'); });
  afficherTexturesCustom();
}

function setCouleurMur(col) {
  couleurMurActuel = col;
  if (salleActive) { salleActive.couleur_mur = col; }
  appliquerApparence();
}

function setCouleurCadres(col) {
  couleurCadresActuel = col;
  if (salleActive) { salleActive.couleur_cadres = col; }
  appliquerApparence();
  afficherMur();
}

function setEpaisseurCadres(ep) {
  epaisseurCadresActuel = ep;
  if (salleActive) { salleActive.epaisseur_cadres = ep; }
  var val = $('ep-cadres-val'); if (val) val.textContent = ep + 'px';
  document.querySelectorAll('.toile-posee').forEach(function(el) {
    if (!el.classList.contains('reserve-posee')) el.style.borderWidth = ep + 'px';
  });
}

function setTexture(val) {
  textureActuelle = val;
  if (salleActive) { salleActive.texture = val; }
  appliquerApparence();
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
    chip.textContent = f.l + '\u00d7' + f.h;
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
  if (fv === 'ronde50') {
    $('inp-larg').value = ''; $('inp-haut').value = '';
    synchroChips(0, 0); afficherTailleAuto(''); return;
  }
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
  this.textContent = (open ? '\u25b8' : '\u25be') + ' Formats ch\u00e2ssis fran\u00e7ais';
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
