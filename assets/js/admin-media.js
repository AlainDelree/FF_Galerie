// ═══════════════════════════════════════════════
// ADMIN-MEDIA.JS — Musique + Photo resize
// Dépend de : commitMulti, apiGH, toast, infosData (admin.js)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// PHOTO — resize & compress
// ═══════════════════════════════════════════════
function traiterPhoto(fichier) {
  return new Promise((ok, ko) => {
    const img = new Image(), url = URL.createObjectURL(fichier);
    img.onload = () => {
      let w = img.width, h = img.height;
      // Redimensionne si l'une ou l'autre dimension dépasse MAX_PX (gère les portraits)
      const ratio = Math.min(MAX_PX / w, MAX_PX / h, 1);
      if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', JPEG_Q).split(',')[1]);
    };
    img.onerror = ko; img.src = url;
  });
}

// ── Qualité photo ───────────────────────────────────────────────
function afficherQualitePhoto(maxDim, isOriginal) {
  const el = $('photo-qualite');
  if (!el || !maxDim) return;
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
        var rAnc = await apiGH('/repos/' + REPO + '/contents/' + ancienGH);
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
    var r = await apiGH('/repos/' + REPO + '/contents/' + cheminGH);
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
      /* Visible mais transparent — le navigateur skip le WebGL off-screen */
      mv.style.cssText = 'width:512px;height:512px;position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;z-index:-1;';
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
            const blob = await mv.toBlob({ mimeType: 'image/jpeg', qualityArgument: 0.85 });
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

    /* Générer thumbnail */
    var blobUrl = URL.createObjectURL(f);
    try {
      var result = await genererThumbnailGLB(blobUrl);
      photoB64 = result.b64;
      $('photo-prev').src = 'data:image/jpeg;base64,' + result.b64;
      $('photo-prev').style.display = 'block';
      $('photo-ph').style.display = 'none';
      $('btn-recadrer-photo').classList.add('visible');
      /* Afficher bouton "Changer la photo…" en mode sculpture */
      var btnChg = document.getElementById('btn-change-photo-sculpt');
      if (btnChg) btnChg.style.display = '';
      /* Auto-fill diamètre du socle depuis dimensions GLB */
      if (result.dims) {
        var footprint = Math.max(result.dims.x, result.dims.z);
        var diam = Math.ceil(footprint * 100 * 1.3); /* empreinte + 30% marge */
        if (diam < 5) diam = 15; /* minimum 15 cm */
        var hauteurCm = Math.round(result.dims.y * 100);
        var inpDiam = document.getElementById('inp-larg');
        if (inpDiam && !inpDiam.value) inpDiam.value = diam;
        var inpDiamStepper = document.getElementById('inp-diam-sculpt');
        if (inpDiamStepper) inpDiamStepper.value = diam;
        var inpHaut = document.getElementById('inp-haut');
        if (inpHaut && !inpHaut.value) inpHaut.value = hauteurCm;
      }
    } catch (e) {
      console.warn('Thumbnail GLB échoué:', e);
      toast('Thumbnail auto échoué — vous pouvez ajouter une photo manuellement', 'err', 4000);
    }
    URL.revokeObjectURL(blobUrl);
    this.value = '';
  });

  /* Bouton supprimer GLB */
  var btnSuppr = document.getElementById('btn-glb-suppr');
  if (btnSuppr) {
    btnSuppr.addEventListener('click', function(e) {
      e.stopPropagation();
      glbB64 = null; glbNom = null;
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
    });
  }
})();
