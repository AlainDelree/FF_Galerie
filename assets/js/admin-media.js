// ═══════════════════════════════════════════════
// ADMIN-MEDIA.JS — Musique + Photo resize
// Dépend de : commitMulti, apiGH, toast, infosData (admin.js)
// ═══════════════════════════════════════════════

// ── Qualité photo ───────────────────────────────────────────────
function afficherQualitePhoto(maxDim, isOriginal) {
  const el = $('photo-qualite');
  if (!el || !maxDim) return;
  /* Sculpture : la photo est un thumbnail du GLB, pas d'alerte qualité */
  if (window.ADMIN_TYPE === 'sculpture') { el.style.display = 'none'; return; }
  let niveau, icone, color;
  if (isOriginal) {
    // Seuils sur dimensions originales (avant compression)
    if      (maxDim < 800)  { niveau = 'Qualité photo faible';   icone = '\u25cf\u25cb\u25cb\u25cb'; color = 'var(--danger)'; }
    else if (maxDim < 1400) { niveau = 'Qualité photo correcte'; icone = '\u25cf\u25cf\u25cb\u25cb'; color = 'var(--muted)'; }
    else if (maxDim < 2500) { niveau = 'Qualité photo bonne';    icone = '\u25cf\u25cf\u25cf\u25cb'; color = 'var(--success)'; }
    else                    { niveau = 'Qualité photo parfaite'; icone = '\u25cf\u25cf\u25cf\u25cf'; color = 'var(--gold2)'; }
  } else {
    // Seuils sur photo stockée (déjà compressée à max 1400px)
    if      (maxDim < 700)  { niveau = 'Qualité photo faible';   icone = '\u25cf\u25cb\u25cb\u25cb'; color = 'var(--danger)'; }
    else if (maxDim < 1000) { niveau = 'Qualité photo correcte'; icone = '\u25cf\u25cf\u25cb\u25cb'; color = 'var(--muted)'; }
    else if (maxDim < 1300) { niveau = 'Qualité photo bonne';    icone = '\u25cf\u25cf\u25cf\u25cb'; color = 'var(--success)'; }
    else                    { niveau = 'Qualité photo parfaite'; icone = '\u25cf\u25cf\u25cf\u25cf'; color = 'var(--gold2)'; }
  }
  el.innerHTML = '<span style="letter-spacing:.12em;font-size:.68rem;">' + icone + '</span>\u00a0' + niveau;
  el.style.color = color;
  el.style.display = '';
}

// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// MUSIQUE
// ═══════════════════════════════════════════════
let _musiqueChargee = false;

/* Charge depuis GitHub si pas encore fait, puis affiche */
async function chargerEtAfficherMusique() {
  if (!_musiqueChargee) {
    try {
      var d = await lireRaw(ADMIN_CFG.repoPath + "infos.json").catch(function(){ return {}; });
      infosData.musique = d.musique || { fichier: "" };
      _musiqueChargee = true;
    } catch(e) {
      infosData.musique = infosData.musique || { fichier: '' };
    }
  }
  afficherSectionMusique();
}

function afficherSectionMusique() {
  var fichier = (infosData.musique && infosData.musique.fichier) || '';
  var nomEl  = $('musique-nom');
  var prevEl = $('musique-prev');
  var delBtn = $('btn-musique-del');
  if (!nomEl) return;
  if (fichier) {
    nomEl.textContent = fichier.split('/').pop();
    nomEl.title = fichier;
    prevEl.src = fichier + '?v=' + Date.now();
    prevEl.style.display = '';
    if (delBtn) delBtn.style.display = '';
  } else {
    nomEl.textContent = 'Aucune';
    nomEl.title = '';
    if (prevEl) { prevEl.src = ''; prevEl.style.display = 'none'; }
    if (delBtn) delBtn.style.display = 'none';
  }
  // Remplir les champs crédits
  var m = infosData.musique || {};
  var setV = function(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
  setV('mus-titre', m.titre); setV('mus-auteur', m.auteur);
  setV('mus-interprete', m.interprete); setV('mus-lien', m.lien); setV('mus-licence', m.licence);
}

async function uploaderMusique(fichier) {
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  if (fichier.size > 12 * 1024 * 1024) { toast('Fichier trop lourd (max 12 MB)', 'err'); return; }
  toast('Upload musique…');
  try {
    var b64 = await new Promise(function(ok, ko) {
      var reader = new FileReader();
      reader.onload = function(e) { ok(e.target.result.split(',')[1]); };
      reader.onerror = ko;
      reader.readAsDataURL(fichier);
    });
    var nom = fichier.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    var base = ADMIN_CFG.repoPath.replace(/data\/?$/, '');
    var cheminGH = base + 'assets/music/' + nom;
    var cheminStocke = 'assets/music/' + nom; // relatif à galerie.html artiste

    // Supprime l'ancien fichier s'il est différent
    var ancienFichier = (infosData.musique && infosData.musique.fichier) || '';
    if (ancienFichier && ancienFichier !== cheminStocke) {
      var ancienGH = base + ancienFichier;
      try {
        var rAnc = await apiGH('/repos/' + REPO + '/contents/' + ancienGH + '?ref=' + BRANCH);
        await apiGH('/repos/' + REPO + '/contents/' + ancienGH, 'DELETE', {
          message: 'Admin : Suppression ancienne musique', sha: rAnc.sha, branch: BRANCH
        });
      } catch(_) {}
    }

    if (!infosData.musique) infosData.musique = {};
    infosData.musique.fichier = cheminStocke;
    await commitMulti([
      { chemin: cheminGH,                                  contenu: b64, encoding: 'base64' },
      { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosData, null, 2) }
    ], 'Admin : Musique galerie mise à jour');

    _musiqueChargee = true;
    afficherSectionMusique();
    toast('✓ Musique mise à jour');
  } catch(e) {
    toast('Erreur upload musique : ' + e.message, 'err');
  }
}

async function supprimerMusique() {
  var fichier = (infosData.musique && infosData.musique.fichier) || '';
  if (!fichier) return;
  if (!confirm('Supprimer la musique de la galerie ?')) return;
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  var base = ADMIN_CFG.repoPath.replace(/data\/?$/, '');
  var cheminGH = base + fichier;
  try {
    var r = await apiGH('/repos/' + REPO + '/contents/' + cheminGH + '?ref=' + BRANCH);
    await apiGH('/repos/' + REPO + '/contents/' + cheminGH, 'DELETE', {
      message: 'Admin : Suppression musique galerie', sha: r.sha, branch: BRANCH
    });
  } catch(_) { /* fichier déjà absent */ }
  infosData.musique = { fichier: '' };
  await commitMulti([
    { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosData, null, 2) }
  ], 'Admin : Musique galerie supprimée');
  afficherSectionMusique();
  toast('✓ Musique supprimée');
}

// ═══════════════════════════════════════════════

async function sauverCreditsMusique() {
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  var getV = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var btn = document.getElementById('btn-credits-sauver');
  if (btn) btn.disabled = true;
  try {
    // Charge infos.json complet pour ne modifier QUE la section musique
    var infosComplet = await lireRaw(ADMIN_CFG.repoPath + 'infos.json').catch(function() { return {}; });
    if (!infosComplet.musique) infosComplet.musique = {};
    infosComplet.musique.titre      = getV('mus-titre');
    infosComplet.musique.auteur     = getV('mus-auteur');
    infosComplet.musique.interprete = getV('mus-interprete');
    infosComplet.musique.lien       = getV('mus-lien');
    infosComplet.musique.licence    = getV('mus-licence');
    // Met à jour infosData local pour cohérence
    infosData.musique = infosComplet.musique;
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosComplet, null, 2) }
    ], 'Admin : Crédits musique mis à jour');
    toast('✓ Crédits sauvegardés');
  } catch(e) {
    toast('Erreur : ' + e.message, 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Câblage bouton crédits
document.getElementById('btn-credits-sauver')?.addEventListener('click', sauverCreditsMusique);
// Bouton Changer → déclenche directement le file picker
$('btn-musique-changer')?.addEventListener('click', () => {
  $('inp-musique-upload').click();
});
// ── Upload musique (input file change) ──
(function() {
  var _inpMusique = document.getElementById('inp-musique-upload');
  if (_inpMusique) {
    _inpMusique.addEventListener('change', function() {
      if (this.files[0]) uploaderMusique(this.files[0]);
      this.value = '';
    });
  }
})();

// ═══════════════════════════════════════════════
// GLB — Upload + Thumbnail auto via model-viewer
// ═══════════════════════════════════════════════

/* Charge model-viewer une seule fois */
let _mvLoaded = false;
/* Blob URL du GLB courant (upload récent) — conservé pour le sélecteur
   d'image de présentation, afin d'éviter un re-fetch. */
let _glbBlobUrlCourant = null;
function loadModelViewerAdmin() {
  return new Promise((ok) => {
    if (_mvLoaded || customElements.get('model-viewer')) { _mvLoaded = true; ok(); return; }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    s.onload = () => { _mvLoaded = true; ok(); };
    document.head.appendChild(s);
  });
}

/* Génère un thumbnail PNG depuis un blob URL de GLB */
function genererThumbnailGLB(blobUrl) {
  return new Promise((ok, ko) => {
    const statusEl = $('glb-thumb-status');
    if (statusEl) { statusEl.style.display = ''; statusEl.style.color = 'var(--muted)'; statusEl.textContent = '⏳ Chargement du modèle 3D…'; }

    loadModelViewerAdmin().then(() => {
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', blobUrl);
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('interaction-prompt', 'none');
      /* Pas de camera-orbit forcé : le cadrage par défaut de model-viewer
         centre l'objet symétriquement sur son bounding-box. */
      /* Fond transparent (PNG) — visible mais quasi invisible (WebGL off-screen skippé) */
      mv.style.cssText = 'width:512px;height:512px;position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;z-index:-1;--poster-color:transparent;background:transparent;';
      document.body.appendChild(mv);

      const timeout = setTimeout(() => {
        document.body.removeChild(mv);
        if (statusEl) { statusEl.textContent = '⚠ Timeout — ajoutez une photo manuellement'; statusEl.style.color = 'var(--danger)'; }
        ko(new Error('model-viewer timeout'));
      }, 15000);

      mv.addEventListener('load', () => {
        if (statusEl) statusEl.textContent = '⏳ Génération du thumbnail…';
        var mvDims = mv.getDimensions();
        /* Petit délai pour laisser le rendu se stabiliser */
        setTimeout(async () => {
          try {
            const blob = await mv.toBlob({ mimeType: 'image/png' });
            clearTimeout(timeout);
            document.body.removeChild(mv);
            /* Convertir en base64 */
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = reader.result.split(',')[1];
              if (statusEl) { statusEl.textContent = '✓ Thumbnail généré'; statusEl.style.color = 'var(--success)'; }
              ok({ b64, dims: { x: mvDims.x, y: mvDims.y, z: mvDims.z } });
            };
            reader.onerror = ko;
            reader.readAsDataURL(blob);
          } catch (e) {
            clearTimeout(timeout);
            document.body.removeChild(mv);
            ko(e);
          }
        }, 1500);
      });

      mv.addEventListener('error', () => {
        clearTimeout(timeout);
        document.body.removeChild(mv);
        if (statusEl) { statusEl.textContent = '⚠ Erreur chargement 3D'; statusEl.style.color = 'var(--danger)'; }
        ko(new Error('model-viewer error'));
      });
    });
  });
}

// ═══════════════════════════════════════════════
// SÉLECTEUR D'IMAGE DE PRÉSENTATION DEPUIS LE GLB
// (overlay interactif calqué sur le recadrage photo)
// ═══════════════════════════════════════════════
let _glbPosterMv  = null;   /* model-viewer monté dans l'overlay */
let _glbPosterCb  = null;   /* callback(b64) à la validation */
let _glbPosterSync = false; /* garde anti-boucle slider <-> caméra */

/* Met l'angle horizontal (deg) ; si fromCamera=false, applique à la caméra. */
function _glbpSetAngle(deg, fromCamera) {
  deg = ((Math.round(deg) % 360) + 360) % 360;
  var sl = $('glbp-slider'), inp = $('glbp-angle');
  if (sl)  sl.value  = deg;
  if (inp) inp.value = deg;
  if (!fromCamera && _glbPosterMv && _glbPosterMv.getCameraOrbit) {
    var o = _glbPosterMv.getCameraOrbit();
    var phiDeg = o.phi * 180 / Math.PI;
    _glbPosterMv.cameraOrbit = deg + 'deg ' + phiDeg + 'deg ' + o.radius + 'm';
    _glbPosterMv.jumpCameraToGoal();
  }
}

/* Ouvre le sélecteur. srcOpt = blob/URL explicite ; sinon on prend le blob
   du GLB fraîchement uploadé, sinon on fetch le chemin de #inp-glb. */
async function ouvrirGlbPoster(srcOpt, callback) {
  var src = srcOpt || _glbBlobUrlCourant;
  if (!src) {
    var glbPath = ($('inp-glb') || {}).value;
    if (!glbPath) { toast('Aucun fichier 3D associé', 'err'); return; }
    try {
      var url = /^https?:\/\//.test(glbPath) ? glbPath : ('/' + glbPath.replace(/^\/+/, ''));
      var resp = await fetch(url + '?v=' + Date.now());
      if (!resp.ok) throw new Error('GLB introuvable (' + resp.status + ')');
      var blob = await resp.blob();
      src = URL.createObjectURL(blob);
      _glbBlobUrlCourant = src; /* réutilisable */
    } catch (e) { toast('Erreur : ' + e.message, 'err'); return; }
  }
  _glbPosterCb = callback;
  $('overlay-glb-poster').classList.add('ouvert');
  var wrap = $('glbposter-wrap');
  wrap.innerHTML = '';
  await loadModelViewerAdmin();
  var mv = document.createElement('model-viewer');
  mv.setAttribute('src', src);
  mv.setAttribute('camera-controls', '');
  mv.setAttribute('interaction-prompt', 'none');
  mv.setAttribute('camera-orbit', '0deg 75deg 105%'); /* même cadrage que les vignettes galerie */
  mv.setAttribute('shadow-intensity', '0');
  wrap.appendChild(mv);
  _glbPosterMv = mv;
  mv.addEventListener('camera-change', function() {
    if (_glbPosterSync) return;
    _glbPosterSync = true;
    var o = mv.getCameraOrbit();
    _glbpSetAngle(o.theta * 180 / Math.PI, true);
    _glbPosterSync = false;
  });
  _glbpSetAngle(0, true);
}

function fermerGlbPoster() {
  $('overlay-glb-poster').classList.remove('ouvert');
  if (_glbPosterMv) { _glbPosterMv.remove(); _glbPosterMv = null; }
  _glbPosterCb = null;
}

/* ── Listeners du sélecteur (éléments statiques de admin.html) ── */
(function() {
  function _ang() { return parseInt(($('glbp-angle') || {}).value, 10) || 0; }
  var sl = $('glbp-slider');
  if (sl) sl.addEventListener('input', function() {
    if (_glbPosterSync) return; _glbPosterSync = true;
    _glbpSetAngle(parseInt(sl.value, 10) || 0, false); _glbPosterSync = false;
  });
  var inp = $('glbp-angle');
  if (inp) inp.addEventListener('input', function() {
    if (_glbPosterSync) return; _glbPosterSync = true;
    _glbpSetAngle(parseInt(inp.value, 10) || 0, false); _glbPosterSync = false;
  });
  var bg = $('btn-glbp-g'); if (bg) bg.addEventListener('click', function() { _glbpSetAngle(_ang() - 15, false); });
  var bd = $('btn-glbp-d'); if (bd) bd.addEventListener('click', function() { _glbpSetAngle(_ang() + 15, false); });
  var br = $('btn-glbp-reset'); if (br) br.addEventListener('click', function() {
    if (_glbPosterMv) { _glbPosterMv.cameraOrbit = '0deg 75deg 105%'; _glbPosterMv.jumpCameraToGoal(); }
    _glbpSetAngle(0, true);
  });
  var ca = $('btn-glbp-annuler'); if (ca) ca.addEventListener('click', fermerGlbPoster);
  var cl = $('btn-close-glbposter'); if (cl) cl.addEventListener('click', fermerGlbPoster);
  var va = $('btn-glbp-valider');
  if (va) va.addEventListener('click', async function() {
    if (!_glbPosterMv) { fermerGlbPoster(); return; }
    va.disabled = true; var old = va.textContent; va.textContent = '⏳ Capture…';
    try {
      var blob = await _glbPosterMv.toBlob({ mimeType: 'image/png' });
      var b64 = await new Promise(function(res, rej) {
        var r = new FileReader();
        r.onload = function() { res(r.result.split(',')[1]); };
        r.onerror = rej; r.readAsDataURL(blob);
      });
      var cb = _glbPosterCb;
      fermerGlbPoster();
      if (cb) cb(b64);
    } catch (e) {
      toast('Capture échouée : ' + e.message, 'err');
      va.disabled = false; va.textContent = old;
    }
  });
})();

/* ── GLB file input handler ── */
(function() {
  var inpGlb = document.getElementById('inp-glb-file');
  if (!inpGlb) return;

  inpGlb.addEventListener('change', async function() {
    var f = this.files[0]; if (!f) return;
    if (!f.name.toLowerCase().endsWith('.glb')) {
      toast('Seuls les fichiers .glb sont acceptés', 'err');
      this.value = '';
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast('Fichier trop lourd (max 50 MB)', 'err');
      this.value = '';
      return;
    }

    /* Afficher les infos du fichier */
    var nomEl = $('glb-nom'), tailleEl = $('glb-taille'), infoEl = $('glb-info'), phEl = $('glb-ph');
    if (nomEl) nomEl.textContent = f.name;
    if (tailleEl) tailleEl.textContent = '(' + (f.size / 1024 / 1024).toFixed(1) + ' MB)';
    if (infoEl) infoEl.style.display = '';
    if (phEl) phEl.style.display = 'none';
    inpGlb.style.display = 'none'; /* Masquer pour que le bouton ✕ soit cliquable */

    /* Lire le fichier en base64 pour upload GitHub */
    glbNom = f.name;
    var reader = new FileReader();
    reader.onload = function(e) {
      glbB64 = e.target.result.split(',')[1];
    };
    reader.readAsDataURL(f);

    /* Générer thumbnail (et conserver le blob pour le sélecteur d'image) */
    if (_glbBlobUrlCourant) URL.revokeObjectURL(_glbBlobUrlCourant);
    var blobUrl = URL.createObjectURL(f);
    _glbBlobUrlCourant = blobUrl;
    try {
      var result = await genererThumbnailGLB(blobUrl);
      photoB64 = result.b64;
      window.photoEstPng = true; /* thumbnail GLB = PNG transparent */
      $('photo-prev').src = 'data:image/png;base64,' + result.b64;
      $('photo-prev').style.display = 'block';
      $('photo-ph').style.display = 'none';
      $('btn-recadrer-photo').classList.add('visible');
      /* Afficher bouton "Changer la photo…" en mode sculpture */
      var btnChg = document.getElementById('btn-change-photo-sculpt');
      if (btnChg) btnChg.style.display = '';
      var btnRegen = document.getElementById('btn-regen-thumb');
      if (btnRegen) btnRegen.style.display = '';
      /* Auto-fill dimensions pièce + diamètre socle depuis GLB */
      if (result.dims) {
        var xCm = Math.round(result.dims.x * 100);
        var yCm = Math.round(result.dims.y * 100);
        var zCm = Math.round(result.dims.z * 100);
        var footprint = Math.max(xCm, zCm);
        var diam = Math.ceil(footprint * 1.3); /* empreinte + 30% marge */
        if (diam < 15) diam = 15;
        /* Dimensions de la pièce */
        var inpL = document.getElementById('inp-larg');
        if (inpL && !inpL.value) inpL.value = Math.max(xCm, zCm);
        var inpH = document.getElementById('inp-haut');
        if (inpH && !inpH.value) inpH.value = yCm;
        var inpP = document.getElementById('inp-prof');
        if (inpP && !inpP.value) inpP.value = Math.min(xCm, zCm);
        /* Diamètre du socle */
        var inpDiamStepper = document.getElementById('inp-diam-sculpt');
        if (inpDiamStepper && !inpDiamStepper.value) inpDiamStepper.value = diam;
      }
    } catch (e) {
      console.warn('Thumbnail GLB échoué:', e);
      toast('Thumbnail auto échoué — vous pouvez ajouter une photo manuellement', 'err', 4000);
    }
    this.value = '';
  });

  /* Bouton supprimer GLB */
  var btnSuppr = document.getElementById('btn-glb-suppr');
  if (btnSuppr) {
    btnSuppr.addEventListener('click', function(e) {
      e.stopPropagation();
      glbB64 = null; glbNom = null;
      if (_glbBlobUrlCourant) { URL.revokeObjectURL(_glbBlobUrlCourant); _glbBlobUrlCourant = null; }
      $('inp-glb').value = '';
      $('glb-info').style.display = 'none';
      $('glb-ph').style.display = '';
      inpGlb.style.display = ''; /* Réafficher le file input */
      var statusEl = $('glb-thumb-status');
      if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
      /* Masquer photo générée et bouton changer */
      $('photo-prev').style.display = 'none';
      var btnChg = document.getElementById('btn-change-photo-sculpt');
      if (btnChg) btnChg.style.display = 'none';
      photoB64 = null;
      window.photoEstPng = false;
    });
  }

  /* Clic sur glb-info (nom du fichier) → ouvrir le file picker pour remplacer */
  var glbInfoEl = document.getElementById('glb-info');
  if (glbInfoEl) {
    glbInfoEl.style.cursor = 'pointer';
    glbInfoEl.addEventListener('click', function(e) {
      if (e.target.id === 'btn-glb-suppr') return; /* Laisser le X faire son travail */
      inpGlb.style.display = '';
      inpGlb.click();
    });
  }
})();
