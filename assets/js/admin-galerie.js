// ═══════════════════════════════════════════════
// ADMIN-GALERIE.JS — Plan · Grille 12×8 · Stock · Placement · Fiche toile · Modal salle
// Dépend de : apiGH, commitMulti, lireRaw, toast, $, ADMIN_CFG, REPO, BRANCH (admin.js)
//             salles, toiles, salleActive, token, chargerTout (admin.js globals)

/* Labels adaptatifs peinture/sculpture */
const _isSculpt = typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture';
const LBL = _isSculpt
  ? { item:'pièce', items:'pièces', Item:'Pièce', Items:'Pièces', placee:'placée', retiree:'retirée' }
  : { item:'toile', items:'toiles', Item:'Toile', Items:'Toiles', placee:'placée', retiree:'retirée du mur' };

/* Type de l'œuvre en cours d'édition dans le formulaire modal (3b-2-4b).
   Par défaut, c'est le type principal de l'admin. Mis à jour à chaque
   ouvrirFormulaireEdition / ouvrirFormulaireNouvel selon le contexte
   (œuvre cliquée ou bouton "+" d'une colonne dédiée). */
var _typeEdition = (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';

function _estSculptEdition() {
  return _typeEdition === 'sculpture';
}

/* ── Snapshot de l'état initial (peinture) du formulaire ───────────
   Capturé UNE FOIS avant la première restructuration sculpture.
   Permet à _appliquerStructurePeinture() de défaire ce qu'a fait
   _appliquerStructureSculpture(). */
var _formSnapInitial = null;
var _formStructEtat  = 'peinture'; /* 'peinture' | 'sculpture' */

function _capturerSnapshotFormulaire() {
  if (_formSnapInitial) return;
  var body = document.querySelector('#overlay-toile .modal-body');
  if (!body) return;
  /* Ordre des .grp directement enfants de body (par ID quand dispo) */
  var grps = Array.from(body.children).filter(function(el) { return el.classList && el.classList.contains('grp'); });
  _formSnapInitial = {
    ordreGrps: grps.map(function(g) { return g.id || ''; }),
    /* Labels originaux (.lbl) à restaurer */
    photoGrpLbl: document.getElementById('zone-photo').closest('.grp').querySelector('.lbl').textContent,
    dimsGrpLbl:  document.querySelector('#dims-lh').closest('.grp').querySelector('.lbl').textContent,
    photoPh:     (document.getElementById('photo-ph') || {}).textContent || 'Appuyer pour choisir une photo',
    matPlaceholder: document.getElementById('inp-mat').placeholder,
    /* zone-glb, inp-glb, glb-thumb-status seront déplacés dans photoGrp ;
       on doit les remettre dans glbGrp (leur .grp parent original). */
    glbGrp: document.getElementById('zone-glb').closest('.grp'),
    photoGrpStyleMaxW: document.getElementById('photo-prev').style.maxWidth,
    photoGrpStyleMarginT: document.getElementById('photo-prev').style.marginTop,
    dimsFavorisDisplay: (document.getElementById('dims-favoris') || {}).style ? document.getElementById('dims-favoris').style.display : ''
  };
}

/* Applique la mise en page sculpture (sections OBJET/SOCLE/DÉTAILS,
   GLB+photo dans le même groupe, stepper diamètre socle). Idempotente
   via flag. Tous les éléments créés ici sont taggés data-sculpt-dyn="1". */
function _appliquerStructureSculpture() {
  if (_formStructEtat === 'sculpture') return;
  _capturerSnapshotFormulaire();

  var body = document.querySelector('#overlay-toile .modal-body');
  if (!body) return;
  var photoGrp = document.getElementById('zone-photo').closest('.grp');
  var glbGrp   = document.getElementById('zone-glb').closest('.grp');
  var dimsGrp  = document.querySelector('#dims-lh').closest('.grp');
  var titreGrp = document.getElementById('inp-titre').closest('.grp');
  var dateGrp  = document.getElementById('inp-date').closest('.grp');
  var matGrp   = document.getElementById('inp-mat').closest('.grp');
  var prixGrp  = document.getElementById('inp-prix').closest('.grp');
  var descGrp  = document.getElementById('inp-desc').closest('.grp');
  var visGrp   = document.getElementById('inp-visible').closest('.grp');
  var typeGrp  = document.getElementById('grp-type-oeuvre');
  var pillsEl  = document.getElementById('salle-pills');
  var pillsGrp = pillsEl ? pillsEl.closest('.grp') : null;
  var zonePhoto = document.getElementById('zone-photo');
  var prevImg   = document.getElementById('photo-prev');

  function sectionHeader(text) {
    var h = document.createElement('div');
    h.dataset.sculptDyn = '1';
    h.style.cssText = 'font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:1.2rem 0 .3rem;padding-bottom:.3rem;border-bottom:1px solid rgba(200,160,80,.2);';
    h.textContent = text;
    return h;
  }

  /* 1. OBJET */
  var hdrObjet = sectionHeader('Objet');
  /* Placer après le sélecteur de type s'il existe, sinon en premier */
  if (typeGrp) typeGrp.after(hdrObjet); else body.prepend(hdrObjet);

  photoGrp.querySelector('.lbl').textContent = 'Modèle 3D (.glb) — facultatif';
  photoGrp.insertBefore(document.getElementById('zone-glb'), zonePhoto);
  photoGrp.insertBefore(document.getElementById('inp-glb'), zonePhoto);
  photoGrp.insertBefore(document.getElementById('glb-thumb-status'), zonePhoto);
  photoGrp.insertBefore(prevImg, zonePhoto);
  prevImg.style.maxWidth = '200px'; prevImg.style.marginTop = '.5rem';

  var btnChg = document.createElement('button');
  btnChg.type = 'button'; btnChg.id = 'btn-change-photo-sculpt';
  btnChg.dataset.sculptDyn = '1';
  btnChg.textContent = '📷 Changer la photo…';
  btnChg.style.cssText = 'display:none !important;';
  btnChg.addEventListener('click', function() { document.getElementById('inp-photo').click(); });
  photoGrp.insertBefore(btnChg, zonePhoto);

  var btnRegen = document.createElement('button');
  btnRegen.type = 'button'; btnRegen.id = 'btn-regen-thumb';
  btnRegen.dataset.sculptDyn = '1';
  btnRegen.textContent = '🔄 Recréer depuis le 3D';
  btnRegen.style.cssText = 'display:none;background:none;border:none;color:var(--muted);cursor:pointer;font-size:.75rem;margin-top:.1rem;padding:0;text-decoration:underline;margin-left:.8rem;';
  btnRegen.addEventListener('click', async function() {
    var glbPath = document.getElementById('inp-glb').value;
    if (!glbPath) { toast('Aucun fichier 3D associé', 'err'); return; }
    btnRegen.disabled = true; btnRegen.textContent = '⏳ Génération…';
    try {
      var url = /^https?:\/\//.test(glbPath) ? glbPath : ('/' + glbPath.replace(/^\/+/, ''));
      var resp = await fetch(url + '?v=' + Date.now());
      if (!resp.ok) throw new Error('GLB introuvable (' + resp.status + ')');
      var blob = await resp.blob();
      var blobUrl = URL.createObjectURL(blob);
      var result = await genererThumbnailGLB(blobUrl);
      URL.revokeObjectURL(blobUrl);
      photoB64 = result.b64;
      window.photoEstPng = true;
      document.getElementById('photo-prev').src = 'data:image/png;base64,' + result.b64;
      document.getElementById('photo-prev').style.display = 'block';
      toast('✓ Photo recréée depuis le 3D');
    } catch (e) {
      toast('Erreur : ' + e.message, 'err');
    }
    btnRegen.disabled = false; btnRegen.textContent = '🔄 Recréer depuis le 3D';
  });
  photoGrp.insertBefore(btnRegen, zonePhoto);

  var ouSep = document.createElement('div');
  ouSep.id = 'sculpt-photo-ou';
  ouSep.dataset.sculptDyn = '1';
  ouSep.style.cssText = 'font-size:.7rem;color:var(--muted);text-align:center;margin:.5rem 0 .3rem;letter-spacing:.06em;';
  ouSep.textContent = '— ou téléchargez une photo directement —';
  photoGrp.insertBefore(ouSep, zonePhoto);

  var photoPh = document.getElementById('photo-ph');
  if (photoPh) photoPh.textContent = 'Appuyer pour choisir une photo (.jpg / .png)';
  glbGrp.style.display = 'none';

  hdrObjet.after(photoGrp);

  dimsGrp.querySelector('.lbl').textContent = 'Dimensions de la pièce';
  document.getElementById('dims-lh').style.display = '';
  var favEl = document.getElementById('dims-favoris');
  if (favEl) favEl.style.display = 'none';
  photoGrp.after(dimsGrp);

  /* 2. SOCLE */
  var hdrSocle = sectionHeader('Socle');
  dimsGrp.after(hdrSocle);

  var socleGrp = document.createElement('div');
  socleGrp.className = 'grp';
  socleGrp.dataset.sculptDyn = '1';
  var socleLbl = document.createElement('label');
  socleLbl.className = 'lbl'; socleLbl.textContent = 'Diamètre (cm)';
  socleGrp.appendChild(socleLbl);

  var stepper = document.createElement('div');
  stepper.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-top:.3rem;';
  var btnStyle = 'width:36px;height:36px;border-radius:50%;border:1px solid var(--brd);background:var(--bg3);color:var(--text);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;';

  var btnMoins = document.createElement('button');
  btnMoins.type = 'button'; btnMoins.textContent = '−'; btnMoins.style.cssText = btnStyle;
  var inpDiam = document.createElement('input');
  inpDiam.type = 'number'; inpDiam.className = 'champ'; inpDiam.id = 'inp-diam-sculpt';
  inpDiam.style.cssText = 'width:80px;text-align:center;font-size:1rem;font-weight:600;';
  inpDiam.min = '1'; inpDiam.max = '200'; inpDiam.placeholder = 'défaut';
  var btnPlus = document.createElement('button');
  btnPlus.type = 'button'; btnPlus.textContent = '+'; btnPlus.style.cssText = btnStyle;
  var unite = document.createElement('span');
  unite.style.cssText = 'color:var(--muted);font-size:.82rem;'; unite.textContent = 'cm';

  btnMoins.addEventListener('click', function() {
    var v = parseInt(inpDiam.value);
    if (isNaN(v) || v <= 5) { inpDiam.value = ''; return; }
    inpDiam.value = v - 5;
  });
  btnPlus.addEventListener('click', function() {
    var v = parseInt(inpDiam.value);
    if (isNaN(v)) { inpDiam.value = 5; return; }
    inpDiam.value = Math.min(200, v + 5);
  });

  stepper.appendChild(btnMoins); stepper.appendChild(inpDiam);
  stepper.appendChild(btnPlus); stepper.appendChild(unite);
  var btnDefaut = document.createElement('button');
  btnDefaut.type = 'button'; btnDefaut.textContent = 'Par défaut';
  btnDefaut.style.cssText = 'background:none;border:none;color:var(--muted);cursor:pointer;font-size:.68rem;text-decoration:underline;margin-left:.3rem;padding:0;';
  btnDefaut.addEventListener('click', function() { inpDiam.value = ''; });
  stepper.appendChild(btnDefaut);
  socleGrp.appendChild(stepper);

  hdrSocle.after(socleGrp);

  /* 3. DÉTAILS */
  var hdrDetails = sectionHeader('Détails');
  socleGrp.after(hdrDetails);

  document.getElementById('inp-mat').placeholder = 'Métal, bois, pierre…';

  var detailsOrder = [titreGrp, dateGrp, matGrp, prixGrp, descGrp, visGrp];
  if (pillsGrp) detailsOrder.push(pillsGrp);
  var prev = hdrDetails;
  detailsOrder.forEach(function(g) { prev.after(g); prev = g; });

  _formStructEtat = 'sculpture';
}

/* Défait la restructuration sculpture, restaure l'état peinture initial. */
function _appliquerStructurePeinture() {
  if (_formStructEtat === 'peinture') return;
  if (!_formSnapInitial) { _formStructEtat = 'peinture'; return; }

  var body = document.querySelector('#overlay-toile .modal-body');
  if (!body) return;

  /* 1. Supprimer tous les éléments dynamiquement créés en sculpture */
  body.querySelectorAll('[data-sculpt-dyn]').forEach(function(el) {
    if (el.parentNode) el.parentNode.removeChild(el);
  });

  /* 2. Restaurer le label photoGrp et le placeholder */
  var photoGrp = document.getElementById('zone-photo').closest('.grp');
  if (photoGrp && photoGrp.querySelector('.lbl')) {
    photoGrp.querySelector('.lbl').textContent = _formSnapInitial.photoGrpLbl;
  }
  var photoPh = document.getElementById('photo-ph');
  if (photoPh) photoPh.textContent = _formSnapInitial.photoPh;

  /* 3. Restaurer le label dimsGrp et l'affichage des favoris */
  var dimsGrp = document.querySelector('#dims-lh').closest('.grp');
  if (dimsGrp && dimsGrp.querySelector('.lbl')) {
    dimsGrp.querySelector('.lbl').textContent = _formSnapInitial.dimsGrpLbl;
  }
  var favEl = document.getElementById('dims-favoris');
  if (favEl) favEl.style.display = _formSnapInitial.dimsFavorisDisplay;

  /* 4. Restaurer placeholder matériaux */
  document.getElementById('inp-mat').placeholder = _formSnapInitial.matPlaceholder;

  /* 5. Sortir zone-glb, inp-glb, glb-thumb-status de photoGrp et les remettre dans glbGrp */
  var glbGrp = _formSnapInitial.glbGrp;
  if (glbGrp) {
    var zoneGlb = document.getElementById('zone-glb');
    var inpGlb = document.getElementById('inp-glb');
    var glbStatus = document.getElementById('glb-thumb-status');
    if (zoneGlb && zoneGlb.parentNode !== glbGrp) glbGrp.appendChild(zoneGlb);
    if (inpGlb && inpGlb.parentNode !== glbGrp) glbGrp.appendChild(inpGlb);
    if (glbStatus && glbStatus.parentNode !== glbGrp) glbGrp.appendChild(glbStatus);
    glbGrp.style.display = ''; /* peinture : laissé visible mais masqué via .sculpture-only */
  }

  /* 6. Restaurer le style de prevImg */
  var prevImg = document.getElementById('photo-prev');
  if (prevImg) {
    prevImg.style.maxWidth = _formSnapInitial.photoGrpStyleMaxW || '';
    prevImg.style.marginTop = _formSnapInitial.photoGrpStyleMarginT || '';
    /* Le remettre dans zone-photo (sa position d'origine) */
    var zonePhoto = document.getElementById('zone-photo');
    if (zonePhoto && prevImg.parentNode !== zonePhoto) {
      zonePhoto.appendChild(prevImg);
    }
  }

  /* 7. Restaurer l'ordre des .grp selon le snapshot */
  var ordreCible = _formSnapInitial.ordreGrps;
  var typeGrpFirst = document.getElementById('grp-type-oeuvre');
  ordreCible.forEach(function(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.classList.contains('grp')) {
      body.appendChild(el); /* ré-append dans l'ordre du snapshot */
    }
  });
  /* Le sélecteur de type doit rester en premier */
  if (typeGrpFirst) body.prepend(typeGrpFirst);

  _formStructEtat = 'peinture';
}

/* Bascule l'affichage des champs .peinture-only / .sculpture-only ET
   applique la restructuration DOM appropriée. */
function _appliquerTypeFormulaire(type) {
  _typeEdition = type || ADMIN_CFG.type || 'peinture';
  var estSculpt = (_typeEdition === 'sculpture');
  /* Restructuration DOM */
  if (estSculpt) _appliquerStructureSculpture();
  else            _appliquerStructurePeinture();
  /* Show/hide des champs */
  var form = document.getElementById('overlay-toile');
  if (form) {
    form.querySelectorAll('.peinture-only').forEach(function(el) {
      el.style.display = estSculpt ? 'none' : '';
    });
    form.querySelectorAll('.sculpture-only').forEach(function(el) {
      el.style.display = estSculpt ? '' : 'none';
    });
    /* Code couleur peinture/sculpture sur le modal (repérage visuel) */
    var modal = form.querySelector('.modal');
    if (modal) {
      modal.classList.toggle('type-peinture',  !estSculpt);
      modal.classList.toggle('type-sculpture',  estSculpt);
    }
  }
  /* Synchroniser le sélecteur */
  var selType = document.getElementById('inp-type-oeuvre');
  if (selType && selType.value !== _typeEdition) selType.value = _typeEdition;
}

/* Helper : type de la salle active (peinture/sculpture).
   Permet à l'arrangeur de se comporter selon le type de la salle, pas de l'admin.
   Fallback sur ADMIN_CFG.type si la salle n'a pas de type défini. */
function _estSculptSalleActive() {
  if (typeof salleActive !== 'undefined' && salleActive && salleActive.type) {
    return salleActive.type === 'sculpture';
  }
  return _isSculpt;
}

/* Revêtements de sol pour sculpture */
const SOL_PATTERNS = {
  parquet: 'repeating-linear-gradient(to bottom,transparent 0px,transparent 17px,rgba(0,0,0,.15) 17px,rgba(0,0,0,.15) 19px),' +
           'repeating-linear-gradient(to right,transparent 0px,transparent 58px,rgba(0,0,0,.06) 58px,rgba(0,0,0,.06) 60px)',
  carrelage: 'repeating-linear-gradient(to bottom,transparent 0px,transparent 48px,rgba(0,0,0,.22) 48px,rgba(0,0,0,.22) 50px),' +
             'repeating-linear-gradient(to right,transparent 0px,transparent 48px,rgba(0,0,0,.22) 48px,rgba(0,0,0,.22) 50px)',
  none: ''
};

function solPatternCSS(texture, couleur) {
  const c = couleur || '#8a6228';
  if (/\.(jpg|jpeg|png|webp)$/i.test(texture)) {
    return 'url("' + texture + '") center/cover,' + c;
  }
  const pat = SOL_PATTERNS[texture] || SOL_PATTERNS.parquet;
  return pat ? (pat + ',' + c) : c;
}
//             appliquerApparence (admin-textures.js — guard typeof requis)
// ═══════════════════════════════════════════════

// PLAN DES SALLES
// ═══════════════════════════════════════════════

/* ── Mode édition plan (réordonnement + suppression) ── */
var _modeEditionPlan = false;
var _ordreAvantEdition = null;   /* snapshot IDs pour annulation */
var _salleConfirmSuppr = null;   /* ID de la salle en attente de confirmation suppression */

function _entrerModeEditionPlan() {
  _modeEditionPlan = true;
  _salleConfirmSuppr = null;
  _ordreAvantEdition = salles.map(function(s) { return s.id; });
  var btnM = document.getElementById('btn-modifier-plan');
  var divA = document.getElementById('plan-edit-actions');
  if (btnM) btnM.style.display = 'none';
  if (divA) divA.style.display = 'flex';
  afficherPlan();
}

function _quitterModeEditionPlan() {
  _modeEditionPlan = false;
  _salleConfirmSuppr = null;
  _ordreAvantEdition = null;
  var btnM = document.getElementById('btn-modifier-plan');
  var divA = document.getElementById('plan-edit-actions');
  if (btnM) btnM.style.display = '';
  if (divA) divA.style.display = 'none';
  afficherPlan();
}

function deplacerSalle(index, direction) {
  var cible = index + direction;
  if (cible < 0 || cible >= salles.length) return;
  var tmp = salles[index];
  salles[index] = salles[cible];
  salles[cible] = tmp;
  afficherPlan();
}

function deplacerSalleVers(srcIdx, tgtIdx) {
  if (srcIdx === tgtIdx) return;
  var moved = salles.splice(srcIdx, 1)[0];
  var adj = tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx;
  salles.splice(adj, 0, moved);
  afficherPlan();
}

/* ── Drag-and-drop chips (mode édition) ────────────────────────────
   Pointer events unifiés mouse + touch.
   Ajouté une seule fois sur le container (flag _dragInited).        */
function _initChipsDrag(cont) {
  if (cont._dragInited) return;
  cont._dragInited = true;

  var _src   = null;   /* index source */
  var _tgt   = null;   /* index cible courant */
  var _ghost = null;   /* clone visuel flottant */
  var _offX  = 0;      /* décalage pointer / coin ghost */
  var _offY  = 0;

  function _chipsEls() {
    return Array.from(cont.querySelectorAll('.chip[data-salle-idx]'));
  }

  function _idxAtPoint(x, y) {
    var els = _chipsEls();
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return parseInt(els[i].dataset.salleIdx);
      }
    }
    return null;
  }

  function _setTgt(newTgt) {
    if (newTgt === _tgt) return;
    _chipsEls().forEach(function(el) { el.classList.remove('chip-drag-over'); });
    _tgt = newTgt;
    if (_tgt !== null && _tgt !== _src) {
      var el = cont.querySelector('.chip[data-salle-idx="' + _tgt + '"]');
      if (el) el.classList.add('chip-drag-over');
    }
  }

  function _cleanup() {
    document.removeEventListener('pointermove', _onMove);
    document.removeEventListener('pointerup',   _onUp);
    document.removeEventListener('pointercancel', _onUp);
    if (_ghost) { _ghost.remove(); _ghost = null; }
    _chipsEls().forEach(function(el) {
      el.classList.remove('chip-dragging', 'chip-drag-over');
    });
    _src = null; _tgt = null;
  }

  function _onMove(e) {
    if (!_ghost) return;
    _ghost.style.left = (e.clientX - _offX) + 'px';
    _ghost.style.top  = (e.clientY - _offY) + 'px';
    _setTgt(_idxAtPoint(e.clientX, e.clientY));
  }

  function _onUp(e) {
    var finalTgt = _tgt;
    var finalSrc = _src;
    _cleanup();
    if (finalTgt !== null && finalTgt !== finalSrc) {
      deplacerSalleVers(finalSrc, finalTgt);
    }
  }

  cont.addEventListener('pointerdown', function(e) {
    if (!_modeEditionPlan) return;
    var chip = e.target.closest('.chip[data-salle-idx]');
    if (!chip) return;
    if (e.target.closest('.chip-del,.chip-mv,.chip-conf-btn')) return;
    if (chip.classList.contains('confirming')) return;

    _src = parseInt(chip.dataset.salleIdx);
    _tgt = null;

    /* Ghost : clone dimensionné comme la chip originale */
    var r = chip.getBoundingClientRect();
    _ghost = chip.cloneNode(true);
    _ghost.className = 'chip chip-ghost ' + chip.className.replace('edit-mode','').replace('draggable','');
    _ghost.style.width  = r.width  + 'px';
    _ghost.style.height = r.height + 'px';
    _ghost.style.left   = r.left   + 'px';
    _ghost.style.top    = r.top    + 'px';
    /* Correction couleur type sur le ghost */
    var typeS = chip.classList.contains('chip-peinture') ? 'peinture' : 'sculpture';
    _ghost.classList.add('chip-' + typeS);
    document.body.appendChild(_ghost);

    /* Décalage pointer → coin du ghost */
    _offX = e.clientX - r.left;
    _offY = e.clientY - r.top;

    chip.classList.add('chip-dragging');

    document.addEventListener('pointermove',  _onMove);
    document.addEventListener('pointerup',    _onUp);
    document.addEventListener('pointercancel', _onUp);
    e.preventDefault();
  });
}

function _confirmerSupprSalle(id) {
  _salleConfirmSuppr = (_salleConfirmSuppr === id) ? null : id;
  afficherPlan();
}

async function _supprimerSalleEdit(id) {
  salles = salles.filter(function(s) { return s.id !== id; });
  if (salleActive && salleActive.id === id) salleActive = null;
  _salleConfirmSuppr = null;
  var btnA = document.getElementById('btn-appliquer-plan');
  if (btnA) btnA.disabled = true;
  try {
    await sauvegarder('[admin] Suppression salle', '✓ Salle supprimée');
    afficherPlan();
    if (salles.length) selectSalle(salles[0].id);
    else {
      var murBg = document.getElementById('mur-bg');
      var stockList = document.getElementById('stock-list');
      var badge = document.getElementById('badge-salle');
      if (murBg) murBg.innerHTML = '';
      if (stockList) stockList.innerHTML = '';
      if (badge) badge.textContent = '—';
    }
  } catch(e) { toast('Erreur : ' + e.message, 'err'); }
  finally { if (btnA) btnA.disabled = false; }
}

function afficherPlan() {
  const cont = $('chips-salles');
  cont.innerHTML = '';
  salles.forEach(s => {
    /* Nombre réel de pièces = union des positions PC et GSM */
    var _ids = new Set();
    (s.positions        || []).forEach(function(p) { _ids.add(p.id); });
    (s.positions_mobile || []).forEach(function(p) { _ids.add(p.id); });
    var _nb = _ids.size;
    /* Type de la salle pour bordure colorée (peinture/sculpture) */
    var _typeS = s.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture') || 'peinture';
    const chip = document.createElement('div');
    chip.className = 'chip chip-' + _typeS + (_nb === 0 ? ' vide' : '');
    if (salleActive && s.id === salleActive.id) chip.classList.add('sel');
    chip.innerHTML = `<div class="cn">${s.nom}</div><div class="cb">${_nb} ${_nb > 1 ? LBL.items : LBL.item}</div>`;
    if (sallesEnAttente.has(s.id)) {
      const elapsed = Math.floor((Date.now() - sallesEnAttente.get(s.id)) / 1000);
      const restant = Math.max(0, 60 - elapsed);
      const badge = document.createElement('div');
      badge.className = 'chip-sync';
      badge.textContent = restant > 0 ? `⏳ ${restant}s` : '✓';
      chip.appendChild(badge);
    }
    if (_modeEditionPlan) {
      chip.classList.add('edit-mode');
      chip.classList.add('draggable');
      var idx = salles.indexOf(s);
      chip.dataset.salleIdx = idx;

      /* ✕ Supprimer (coin haut-gauche) */
      if (_salleConfirmSuppr === s.id) {
        /* État confirmation */
        chip.classList.add('confirming');
        chip.style.display = 'flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '5px';
        chip.innerHTML = '';
        var lbl = document.createElement('span');
        lbl.className = 'chip-conf-lbl';
        lbl.textContent = 'Supprimer ?';
        var btnOk = document.createElement('button');
        btnOk.className = 'chip-conf-btn ok';
        btnOk.textContent = '✓';
        btnOk.title = 'Confirmer la suppression';
        btnOk.addEventListener('click', function(e) { e.stopPropagation(); _supprimerSalleEdit(s.id); });
        var btnNo = document.createElement('button');
        btnNo.className = 'chip-conf-btn no';
        btnNo.textContent = '✗';
        btnNo.title = 'Annuler';
        btnNo.addEventListener('click', function(e) { e.stopPropagation(); _confirmerSupprSalle(s.id); });
        chip.appendChild(lbl);
        chip.appendChild(btnOk);
        chip.appendChild(btnNo);
      } else {
        /* État normal en mode édition */
        var btnDel = document.createElement('button');
        btnDel.className = 'chip-del';
        btnDel.textContent = '✕';
        btnDel.title = 'Supprimer cette salle';
        (function(sid) {
          btnDel.addEventListener('click', function(e) { e.stopPropagation(); _confirmerSupprSalle(sid); });
        })(s.id);
        chip.appendChild(btnDel);

        /* ← → réordonnement */
        var wrap = document.createElement('div');
        wrap.className = 'chip-mv-wrap';
        var btnG = document.createElement('button');
        btnG.className = 'chip-mv';
        btnG.textContent = '←';
        btnG.title = 'Déplacer à gauche';
        btnG.disabled = (idx === 0);
        (function(i) {
          btnG.addEventListener('click', function(e) { e.stopPropagation(); deplacerSalle(i, -1); });
        })(idx);
        var btnD = document.createElement('button');
        btnD.className = 'chip-mv';
        btnD.textContent = '→';
        btnD.title = 'Déplacer à droite';
        btnD.disabled = (idx === salles.length - 1);
        (function(i) {
          btnD.addEventListener('click', function(e) { e.stopPropagation(); deplacerSalle(i, 1); });
        })(idx);
        wrap.appendChild(btnG);
        wrap.appendChild(btnD);
        chip.style.display = 'flex';
        chip.style.alignItems = 'center';
        chip.appendChild(wrap);
      }
    } else {
      chip.addEventListener('click', () => selectSalle(s.id));
    }
    cont.appendChild(chip);
  });
  // Bouton ajouter
  const add = document.createElement('button');
  add.className = 'chip-add';
  add.innerHTML = '＋ Salle';
  add.addEventListener('click', () => ouvrirModalSalle());
  cont.appendChild(add);

  /* Drag-and-drop en mode édition */
  if (_modeEditionPlan) _initChipsDrag(cont);
  /* Ligne de clonage esthétique (cible = salle active) */
  _renderCloneSalleRow();
}

/* Affiche la ligne "Cloner l'esthétique vers la salle active depuis une autre salle" */
function _renderCloneSalleRow() {
  var row = document.getElementById('clone-salle-row');
  if (!row) return;
  row.innerHTML = '';
  if (!salleActive) { row.style.display = 'none'; return; }
  var typeAct = salleActive.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture');
  var autres = salles.filter(function(o) {
    var ot = o.type || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture');
    return o.id !== salleActive.id && ot === typeAct;
  });
  if (autres.length === 0) { row.style.display = 'none'; return; }
  row.style.display = 'flex';

  var lbl = document.createElement('span');
  lbl.style.cssText = 'font-size:.74rem;color:var(--muted);';
  lbl.textContent = 'Cloner l\u0027esthétique de « ' + (salleActive.nom || 'salle') + ' » depuis :';

  var sel = document.createElement('select');
  sel.style.cssText = 'font-size:.78rem;padding:.25rem .4rem;border:1px solid var(--brd);border-radius:6px;background:var(--bg3);color:var(--text);';
  var opt0 = document.createElement('option');
  opt0.value = ''; opt0.textContent = '— Choisir —';
  sel.appendChild(opt0);
  autres.forEach(function(o) {
    var op = document.createElement('option');
    op.value = o.id; op.textContent = o.nom || ('Salle ' + o.id);
    sel.appendChild(op);
  });

  var btn = document.createElement('button');
  btn.className = 'plan-btn';
  btn.style.cssText = 'font-size:.78rem;';
  btn.textContent = '🎨 Cloner';
  btn.addEventListener('click', function() {
    var srcId = parseInt(sel.value);
    if (!srcId) { toast('Choisissez une salle source', 'err'); return; }
    if (typeof _clonerEsthetique === 'function') _clonerEsthetique(srcId, salleActive.id);
  });

  row.appendChild(lbl);
  row.appendChild(sel);
  row.appendChild(btn);
}

/* Ajuste la barre d'apparence (cadres/épaisseur/texture vs revêtement)
   et le libellé "Couleur du mur/sol" selon le type de la salle active.
   Permet la cohabitation peinture/sculpture dans un même admin. */
function _majApparenceSelonSalle() {
  if (!salleActive) return;
  var estSculpt = (salleActive.type === 'sculpture');
  /* Boutons spécifiques peinture (cadres + épaisseur + texture du mur) */
  ['btn-pop-cadres', 'btn-pop-epaisseur', 'btn-pop-texture'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = estSculpt ? 'none' : '';
  });
  /* Boutons spécifiques sculpture (revêtement du sol) */
  var btnRev = document.getElementById('btn-pop-revetement');
  if (btnRev) btnRev.style.display = estSculpt ? '' : 'none';
  /* Libellé du bouton mur (et son popover) : Couleur du mur ↔ Couleur du sol */
  var btnMur = document.getElementById('btn-pop-mur');
  if (btnMur) btnMur.title = estSculpt ? 'Couleur du sol' : 'Couleur du mur';
  var popMurT = document.getElementById('pop-mur-titre');
  if (popMurT) popMurT.textContent = estSculpt ? 'Couleur du sol' : 'Couleur du mur';
}

function selectSalle(id) {
  salleActive = salles.find(s => s.id === id);
  if (!salleActive) return;
  // Met à jour badge et plan
  $('badge-salle').textContent = salleActive.nom;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  const chips = $('chips-salles').querySelectorAll('.chip');
  chips.forEach((c, i) => { if (salles[i]?.id === id) c.classList.add('sel'); });
  if (typeof _renderCloneSalleRow === 'function') _renderCloneSalleRow();
  /* Ajuste la barre Apparence + le label couleur mur/sol selon le type
     de la SALLE (pas de l'admin). Permet à un admin sculpture d'éditer
     une salle peinture (et inversement). */
  _majApparenceSelonSalle();
  // Applique couleurs
  couleurMurActuel = salleActive.couleur_mur;
  couleurMurPieceActuel = salleActive.couleur_mur_piece || '#1a1a1a';
  couleurMurBasActuel   = salleActive.couleur_mur_bas   || '#111111';
  document.documentElement.style.setProperty('--mur-piece-col', couleurMurPieceActuel);
  document.documentElement.style.setProperty('--mur-bas-col',   couleurMurBasActuel);
  couleurCadresActuel = salleActive.couleur_cadres;
  epaisseurCadresActuel = salleActive.epaisseur_cadres || 2;
  textureActuelle = salleActive.texture || 'none';
  if (typeof appliquerApparence === 'function') appliquerApparence();
  selectedToile = null;
  selectedToilePl = null;
  // Tableau de bord (navigation étoile)
  if (typeof afficherTableauBord === 'function') {
    afficherTableauBord();
  } else {
    // Fallback si admin-tdb.js pas encore chargé
    buildOccupancy();
    afficherMur();
    afficherStock();
  }
}

// ═══════════════════════════════════════════════
// GRILLE MAGNÉTIQUE 12×8
// ═══════════════════════════════════════════════
function calcCases(dim) {
  if (!dim) return { w: 2, h: 2 };
  const w = Math.max(1, Math.min(COLS, Math.round(dim.largeur / CM_PAR_CASE)));
  const h = Math.max(1, Math.min(ROWS, Math.round(dim.hauteur / CM_PAR_CASE)));
  return { w, h };
}

function buildOccupancy() {
  occupancy = {};
  if (!salleActive) return;
  (salleActive.positions || []).forEach(p => {
    for (let c = p.col; c < p.col + p.w; c++)
      for (let r = p.row; r < p.row + p.h; r++)
        occupancy[`${c},${r}`] = p.id;
  });
}

function canPlace(col, row, w, h, excludeId) {
  if (col < 1 || row < 1 || col + w - 1 > COLS || row + h - 1 > ROWS) return false;
  for (let c = col; c < col + w; c++)
    for (let r = row; r < row + h; r++) {
      const occ = occupancy[`${c},${r}`];
      if (occ && occ !== excludeId) return false;
    }
  return true;
}

function afficherMur() {
  const bg = $('mur-bg');
  bg.innerHTML = '';
  if (!salleActive) return;

  /* ── SCULPTURE : aperçu via iframes read-only (vrai moteur de rendu) ── */
  if (_isSculpt) {
    bg.className = '';
    bg.style.cssText = '';
    bg.innerHTML = '';

    /* Nettoyer un éventuel ancien row-wrap */
    var oldRow = document.getElementById('mur-row-wrap');
    if (oldRow) { oldRow.parentNode.insertBefore(bg, oldRow); oldRow.remove(); }

    var apercuPath = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'galerie-apercu.html';

    /* Données admin en mémoire à injecter dans les iframes.
       Filtrer par type de la salle pour éviter collisions d'ID (multi-types). */
    var typeSalleApercu = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
    var injectData = {
      type: 'init-data',
      toiles: _stockParType(typeSalleApercu),
      salles: { salles: JSON.parse(JSON.stringify(salles)) }
    };
    function brancherApercu(iframe) {
      function onMsg(e) {
        if (e.source === iframe.contentWindow && e.data && e.data.type === 'iframe-awaiting-data') {
          iframe.contentWindow.postMessage(injectData, '*');
        }
      }
      window.addEventListener('message', onMsg);
    }

    /* Row : aperçu PC (large) + aperçu GSM (étroit) côte à côte */
    var rowWrap = document.createElement('div');
    rowWrap.id = 'mur-row-wrap';
    rowWrap.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
    bg.parentNode.insertBefore(rowWrap, bg);

    /* Aperçu PC */
    var pcCol = document.createElement('div');
    pcCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;';
    var pcLbl = document.createElement('div');
    pcLbl.style.cssText = 'text-align:center;font-size:8px;color:var(--muted);font-weight:700;letter-spacing:.1em;';
    pcLbl.textContent = '🖥 PC';
    var pcFrame = document.createElement('div');
    pcFrame.style.cssText = 'width:100%;aspect-ratio:16/9;border-radius:6px;overflow:hidden;border:1px solid var(--brd);position:relative;';
    var pcIframe = document.createElement('iframe');
    pcIframe.src = apercuPath + '?vue=pc&v=' + Date.now();
    pcIframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    brancherApercu(pcIframe);
    pcFrame.appendChild(pcIframe);
    pcCol.appendChild(pcLbl); pcCol.appendChild(pcFrame);

    /* Aperçu GSM */
    var hasCustomMobile = !!(salleActive.positions_mobile && salleActive.positions_mobile.length);
    var gsmCol = document.createElement('div');
    gsmCol.style.cssText = 'flex:0 0 90px;display:flex;flex-direction:column;gap:3px;';
    var gsmLbl = document.createElement('div');
    gsmLbl.style.cssText = 'text-align:center;font-size:8px;color:var(--muted);font-weight:700;letter-spacing:.05em;';
    gsmLbl.textContent = hasCustomMobile ? '📱 GSM' : '📱 GSM (=PC)';
    var gsmFrame = document.createElement('div');
    gsmFrame.style.cssText = 'width:90px;aspect-ratio:9/19;border-radius:8px;overflow:hidden;border:1.5px solid var(--gold);position:relative;';
    var gsmIframe = document.createElement('iframe');
    gsmIframe.src = apercuPath + '?vue=gsm&v=' + Date.now();
    gsmIframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    brancherApercu(gsmIframe);
    gsmFrame.appendChild(gsmIframe);
    gsmCol.appendChild(gsmLbl); gsmCol.appendChild(gsmFrame);

    rowWrap.appendChild(pcCol);
    rowWrap.appendChild(gsmCol);
    /* bg n'est plus utilisé pour le rendu sculpture — le cacher */
    bg.style.display = 'none';
    rowWrap.appendChild(bg);

    return;
  }

  // Toiles posées — recherche par type de salle (multi-types)
  var _typeMurAff = salleActive.type || ADMIN_CFG.type || 'peinture';
  (salleActive.positions || []).forEach(p => {
    const t = _trouverOeuvre(p.id, _typeMurAff);
    if (!t) return;
    const el = document.createElement('div');
    el.className = 'toile-posee' + (t.visible === false ? ' reserve-posee' : '');
    el.style.gridColumn = `${p.col} / span ${p.w}`;
    el.style.gridRow    = `${p.row} / span ${p.h}`;
    el.style.borderColor = t.visible === false ? '' : couleurCadresActuel;
    if (t.visible !== false) el.style.borderWidth = epaisseurCadresActuel + 'px';
    if (t.photo) {
      const img = document.createElement('img');
      img.src = t.photo; img.alt = t.titre || ''; img.draggable = false;
      el.appendChild(img);
    } else { el.style.background = 'rgba(255,255,255,.05)'; }

    const lbl = document.createElement('div');
    lbl.className = 'tp-lbl'; lbl.textContent = t.titre || '—';
    el.appendChild(lbl);

    bg.appendChild(el);
  });

  // Cellules vides
  const placees = new Set((salleActive.positions || []).map(p => {
    const cells = [];
    for (let c = p.col; c < p.col + p.w; c++)
      for (let r = p.row; r < p.row + p.h; r++)
        cells.push(`${c},${r}`);
    return cells;
  }).flat());

  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      if (occupancy[`${c},${r}`]) continue;
      const cell = document.createElement('div');
      cell.className = 'cellule';
      cell.style.gridColumn = c;
      cell.style.gridRow = r;
      cell.dataset.col = c;
      cell.dataset.row = r;
      cell.addEventListener('mouseenter', () => survolCelluleMur(c, r));
      cell.addEventListener('mouseleave', () => nettoyerSurvol());
      // Mur en lecture seule → placement uniquement via "Arranger"
      cell.addEventListener('click', () => {
        if (selectedToile) toast('Utilisez "🔧 Arranger" pour placer les ' + (_isSculpt ? 'pièces' : 'toiles'), 'err');
      });
      bg.appendChild(cell);
    }
  }
}

function survolCelluleMur(col, row) {
  const t = selectedToile; if (!t) return;
  const {w,h} = calcCases(t.dimensions);
  const ok = canPlace(col,row,w,h,null);
  nettoyerSurvolBg('mur-bg');
  for (let c=col;c<col+w;c++) for (let r=row;r<row+h;r++) {
    const cell = $('mur-bg').querySelector(`[data-col="${c}"][data-row="${r}"]`);
    if (cell) cell.classList.add(ok?'survol':'survol-ko');
  }
}

function nettoyerSurvol() { nettoyerSurvolBg('mur-bg'); }

/* placerToile / retirerToile / selectionnerPeintureMur supprimées :
   placement en mode normal n'a plus lieu d'être. Toutes les opérations de
   placement passent désormais exclusivement par le mode Arranger (afficherMurPlacement). */

function deplacerPeinture(toileId, dCol, dRow) {
  const pos = salleActive.positions.find(p => p.id === toileId);
  if (!pos) return;
  const newCol = pos.col + dCol, newRow = pos.row + dRow;
  // Retire temporairement de l'occupancy
  for (let c = pos.col; c < pos.col + pos.w; c++)
    for (let r = pos.row; r < pos.row + pos.h; r++)
      delete occupancy[`${c},${r}`];
  if (!canPlace(newCol, newRow, pos.w, pos.h, null)) {
    // Restaure
    for (let c = pos.col; c < pos.col + pos.w; c++)
      for (let r = pos.row; r < pos.row + pos.h; r++)
        occupancy[`${c},${r}`] = toileId;
    toast('Impossible — bord ou emplacement occupé', 'err'); return;
  }
  pos.col = newCol; pos.row = newRow;
  buildOccupancy(); afficherMur();
}

// ═══════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════
function afficherStock() {
  var list = $('stock-list');
  if (!list) return;
  if (!salleActive) { list.innerHTML = ''; return; }
  /* Type de la salle active — détermine quelles œuvres on liste */
  var typeSalleStock = salleActive.type || ADMIN_CFG.type || 'peinture';
  /* Compteur : nombre d'œuvres du bon type (pas du total fusionné) */
  var nbStock = toiles.filter(function(t) { return typeDeLOeuvre(t) === typeSalleStock; }).length;
  var lblItems = (typeSalleStock === 'sculpture') ? 'pièces' : 'toiles';
  var hdrSpan = $('stock-hdr') && $('stock-hdr').querySelector('span');
  if (hdrSpan) hdrSpan.textContent = 'Stock (' + nbStock + ' ' + lblItems + ')';

  listeOeuvres({
    container:  list,
    filtre:     'toutes',
    typeFiltre: typeSalleStock,
    salleRef:   salleActive,
    vue:        _placementVue,
    tri:        'statut',
    mode:       'selection',
    legendes:   (typeSalleStock === 'sculpture') ? ['disponibilite'] : ['disponibilite', 'taille'],
    selection:  toilesSelectionnees,
    onSelect: function(id) {
      /* Toggle sans rebuild pour que le double-clic fonctionne */
      if (toilesSelectionnees.has(id)) toilesSelectionnees.delete(id);
      else toilesSelectionnees.add(id);
      selectedToile = toilesSelectionnees.size === 1
        ? toiles.find(function(x) {
            return x.id === [...toilesSelectionnees][0]
              && typeDeLOeuvre(x) === typeSalleStock;
          }) : null;
      var el = list.querySelector('[data-id="' + id + '"]');
      if (el) el.classList.toggle('sel', toilesSelectionnees.has(id));
      majBoutons();
    },
    onDblClick: function(id) { ouvrirFiche(id, typeSalleStock); }
  });

  /* Badges de sync ⏳ en post-process (toilesEnAttente) */
  if (toilesEnAttente.size > 0) {
    list.querySelectorAll('.lo-item').forEach(function(item) {
      var id = parseInt(item.dataset.id, 10);
      if (!toilesEnAttente.has(id)) return;
      var elapsed = Math.floor((Date.now() - toilesEnAttente.get(id)) / 1000);
      var sb = document.createElement('div');
      sb.className = 'lo-sync-badge'; sb.dataset.syncId = id;
      sb.textContent = (elapsed < 60) ? ('⏳ ' + Math.max(0, 60 - elapsed) + 's') : '✓ publié';
      item.appendChild(sb);
    });
  }
}

function majBoutons() {
  const n = toilesSelectionnees.size;
  $('btn-modifier-toile').disabled  = (n !== 1);
  $('btn-supprimer-toile').disabled = (n !== 1);
}


// ═══════════════════════════════════════════════
// MODE PLACEMENT PLEIN ÉCRAN
// ═══════════════════════════════════════════════
let grilleVisiblePl = false;
let selectedToilePl = null; // toile sélectionnée dans le strip du mode placement
let _placementVue = 'pc'; // 'pc' ou 'gsm'
let _arrangerSnapshot = null; // snapshot positions avant ouverture Arranger

/* Retourne les positions actives selon le mode vue */
function _getPositions() {
  if (!salleActive) return [];
  if (_placementVue === 'gsm') {
    if (!salleActive.positions_mobile) salleActive.positions_mobile = [];
    return salleActive.positions_mobile;
  }
  return salleActive.positions || [];
}

/* Le bloc drag-drop socle (variables + _setPositions, _startDragPiece,
   _onGlobalDragMove, _onGlobalDragEnd, _checkOverlap, _pieceRadius) a été
   supprimé : ancien essai de drag dans admin remplacé par l'iframe
   d'arrangement (galerie-edit.html) qui implémente son propre drag dans
   galerie-sculpture.js. */


function entrerModePlacement() {
  if (!salleActive) return;
  /* Vérifier si des toiles sélectionnées viennent d'une autre salle DU MÊME TYPE.
     Sans le filtre par type : une peinture id=5 cochée signalait à tort qu'elle
     était dans une "autre salle" simplement parce qu'une sculpture id=5 existe
     dans une salle sculpture. */
  var typeSalleAct = salleActive.type || ADMIN_CFG.type || 'peinture';
  const autresSelectionnees = [...toilesSelectionnees].filter(id => {
    const salle = salles.find(s =>
      s.id !== salleActive.id
      && (!s.type || s.type === typeSalleAct)
      && s.toiles.includes(id)
    );
    return !!salle;
  });
  if (autresSelectionnees.length > 0) {
    const noms = autresSelectionnees.map(id => {
      const t = _trouverOeuvre(id, typeSalleAct);
      const s = salles.find(s =>
        s.id !== salleActive.id
        && (!s.type || s.type === typeSalleAct)
        && s.toiles.includes(id)
      );
      return `"${t?.titre || 'Sans titre'}" (${s?.nom || 'autre salle'})`;
    }).join(', ');
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom);';
    div.innerHTML = `<div style="background:var(--bg2);border-radius:16px 16px 0 0;padding:1.2rem;width:100%;max-width:480px;box-shadow:0 -8px 32px rgba(0,0,0,.5);">
      <p style="font-size:13px;line-height:1.6;margin-bottom:1rem;">Ces toiles sont dans une autre salle :<br><strong style="color:var(--gold);">${noms}</strong><br>Elles seront retirées de leur salle actuelle et placées ici.</p>
      <div style="display:flex;gap:.6rem;">
        <button id="arr-ann" style="flex:1;padding:.6rem;border-radius:8px;border:0.5px solid var(--brd);background:transparent;color:var(--text);font-size:13px;cursor:pointer;">Annuler</button>
        <button id="arr-ok" style="flex:1;padding:.6rem;border-radius:8px;border:none;background:var(--gold);color:#111;font-size:13px;font-weight:600;cursor:pointer;">Continuer</button>
      </div></div>`;
    document.body.appendChild(div);
    div.querySelector('#arr-ann').addEventListener('click', () => div.remove());
    div.querySelector('#arr-ok').addEventListener('click', () => {
      div.remove();
      // Retire les œuvres de leur ancienne salle — UNIQUEMENT des salles du
      // même type. Sinon, déplacer la peinture id=4 dans Cuisine retirerait
      // la sculpture id=4 de Salle E (collision d'ID inter-types).
      var _typeSalleAct = salleActive.type || ADMIN_CFG.type || 'peinture';
      autresSelectionnees.forEach(id => {
        salles.forEach(s => {
          if (s.id === salleActive.id) return;
          if (s.type && s.type !== _typeSalleAct) return;
          s.toiles = s.toiles.filter(tid => tid !== id);
          s.positions = (s.positions||[]).filter(p => p.id !== id);
        });
        if (!salleActive.toiles.includes(id)) salleActive.toiles.push(id);
      });
      ouvrirArrangerApresConfirm();
    });
    return;
  }
  ouvrirArrangerApresConfirm();
}

function ouvrirArrangerApresConfirm() {
  if (!salleActive) return;
  /* Rebuild occupancy à partir de salleActive.positions — sinon en passant
     d'une salle à une autre dans l'arrangeur, occupancy garde les cases
     marquées occupées de la salle précédente (bug visible : 2e salle
     peinture montre les positions de la 1re). */
  buildOccupancy();
  /* Adapter le panneau de contrôle (D-pad complet vs ✕ Retirer seul)
     au type de la salle active. Indispensable en multi-types pour qu'une
     salle peinture chez Dinso (admin sculpture) ait le D-pad utilisable. */
  _majPanelCtrlSelonSalle();
  /* Snapshot — restauré si retour sans sauvegarder.
     Supports identifiés par couple (id, _type) en multi-types. */
  _arrangerSnapshot = {
    positions:        JSON.parse(JSON.stringify(salleActive.positions        || [])),
    positions_mobile: JSON.parse(JSON.stringify(salleActive.positions_mobile || [])),
    toiles:           JSON.parse(JSON.stringify(salleActive.toiles           || [])),
    supports:         toiles.map(function(t) {
      return {
        id:         t.id,
        _type:      typeDeLOeuvre(t),
        support:    t.support ? JSON.parse(JSON.stringify(t.support)) : null,
        sans_socle: t.sans_socle || false
      };
    })
  };
  const nbPlacees = (salleActive.positions||[]).length;
  /* _placementVue est déjà positionné par entrerVue() selon la carte cliquée
     (pc ou gsm). Ne pas l'écraser ici. Défaut pc si non défini. */
  if (typeof _placementVue === 'undefined' || !_placementVue) _placementVue = 'pc';
  /* En GSM : si pas encore de positions mobiles, partir d'une copie des positions PC
     (cohérent avec l'iframe) pour que le strip marque bien "sur le sol". */
  if (_placementVue === 'gsm' && salleActive
      && (!salleActive.positions_mobile || !salleActive.positions_mobile.length)) {
    salleActive.positions_mobile = JSON.parse(JSON.stringify(salleActive.positions || []));
  }
  var _vueGsm = (_placementVue === 'gsm');
  var btnSw = document.getElementById('btn-switch-vue');
  if (btnSw) {
    /* Bouton PC/GSM utile uniquement pour les salles sculpture (positions_mobile
       activement utilisé). En peinture, mur PC=GSM (12/8) et positions_mobile
       n'est pas lu par le renderer → bouton inutile, on le masque. */
    if (_estSculptSalleActive()) {
      btnSw.style.display    = '';
      btnSw.textContent      = _vueGsm ? '📱 GSM' : '🖥 PC';
      btnSw.style.background = _vueGsm ? 'var(--gold)' : '';
      btnSw.style.color      = _vueGsm ? '#fff' : '';
    } else {
      btnSw.style.display = 'none';
    }
  }
  $('overlay-placement').classList.add('ouvert');
  // Pousse un état pour intercepter le bouton retour Android
  history.pushState({ ff: 'arrangement' }, '');
  grilleVisiblePl = true;
  $('btn-grille-pl').style.color       = 'var(--gold)';
  $('btn-grille-pl').style.borderColor = 'var(--gold)';
  selectedToilePl = null;
  peintureSurMurSel = null;
  if (typeof fermerPanneauSupport === 'function') fermerPanneauSupport();
  afficherMurPlacement();
  afficherStripPlacement();
  $('pl-aide').textContent = nbPlacees > 0
    ? 'Cliquez sur un' + (_estSculptSalleActive() ? 'e pièce' : 'e toile') + ' du bas pour la placer ou la déplacer'
    : 'Sélectionnez un' + (_estSculptSalleActive() ? 'e pièce' : 'e toile') + ' en bas';
  /* M5 — affichage / masquage des flèches selon le nombre de salles voisines */
  _majFlechesNavSalles();
}

/* M5 — Liste des salles du même type que salleActive, ordonnées comme dans salles[] */
function _sallesMemeType() {
  if (!salleActive) return [];
  var typeA = salleActive.type || ADMIN_CFG.type || 'peinture';
  return salles.filter(function(s) {
    var t = s.type || ADMIN_CFG.type || 'peinture';
    return t === typeA;
  });
}

/* M5 — Salle voisine de salleActive (direction = -1 ou +1), null si bord. */
function _salleVoisine(direction) {
  var liste = _sallesMemeType();
  if (liste.length <= 1) return null;
  var idx = liste.findIndex(function(s) { return s.id === salleActive.id; });
  if (idx < 0) return null;
  var nIdx = idx + direction;
  if (nIdx < 0 || nIdx >= liste.length) return null;
  return liste[nIdx];
}

/* M5 — Mise à jour visibilité + label des flèches */
function _majFlechesNavSalles() {
  var prev = document.getElementById('pl-nav-prev');
  var next = document.getElementById('pl-nav-next');
  var lbl  = document.getElementById('pl-nav-label');
  if (!prev || !next) return;
  var sPrev = _salleVoisine(-1);
  var sNext = _salleVoisine(+1);
  prev.style.display = sPrev ? '' : 'none';
  next.style.display = sNext ? '' : 'none';
  if (lbl && salleActive) {
    var liste = _sallesMemeType();
    var idx = liste.findIndex(function(s) { return s.id === salleActive.id; });
    if (liste.length > 1) {
      lbl.style.display = '';
      lbl.textContent = salleActive.nom + ' — ' + (idx+1) + '/' + liste.length;
    } else {
      lbl.style.display = 'none';
    }
  }
}

/* M5 — Navigue vers salle voisine (direction -1 ou +1) sans quitter le mode édition.
   Si modifications non sauvegardées : demande confirmation. */
function _naviguerSalleArranger(direction) {
  var cible = _salleVoisine(direction);
  if (!cible) return;
  function go() {
    salleActive = cible;
    /* Re-render complet via ouvrirArrangerApresConfirm : rebuild occupancy,
       nouveau snapshot, mur + strip + panneau ctrl mis à jour. */
    ouvrirArrangerApresConfirm();
  }
  if (typeof _arrangerADesModifs === 'function' && _arrangerADesModifs()) {
    if (!confirm('Modifications non sauvegardées dans « ' + (salleActive.nom||'cette salle') + ' ». Continuer sans sauvegarder ?')) return;
    /* Restaurer le snapshot avant de quitter — sinon les modifs subsistent en mémoire */
    if (_arrangerSnapshot) {
      salleActive.positions        = _arrangerSnapshot.positions;
      salleActive.positions_mobile = _arrangerSnapshot.positions_mobile;
      salleActive.toiles           = _arrangerSnapshot.toiles;
      /* Restaurer les supports */
      if (_arrangerSnapshot.supports) {
        _arrangerSnapshot.supports.forEach(function(snap) {
          var t = toiles.find(function(x) {
            return x.id === snap.id && (x._type || ADMIN_CFG.type) === snap._type;
          });
          if (t) {
            t.support    = snap.support ? JSON.parse(JSON.stringify(snap.support)) : null;
            t.sans_socle = snap.sans_socle;
          }
        });
      }
    }
  }
  go();
}



/* Compare l'état actuel au snapshot (= dernier état enregistré).
   Retourne true s'il y a des modifications non sauvegardées. */
function _arrangerADesModifs() {
  if (!_arrangerSnapshot || !salleActive) return false;
  var j = function(o) { return JSON.stringify(o || []); };
  if (j(salleActive.positions)        !== j(_arrangerSnapshot.positions))        return true;
  if (j(salleActive.positions_mobile) !== j(_arrangerSnapshot.positions_mobile)) return true;
  if (j(salleActive.toiles)           !== j(_arrangerSnapshot.toiles))           return true;
  /* Supports — disambigué par couple (id, _type) en multi-types */
  if (_arrangerSnapshot.supports) {
    for (var i = 0; i < _arrangerSnapshot.supports.length; i++) {
      var snap = _arrangerSnapshot.supports[i];
      var t = _trouverOeuvre(snap.id, snap._type);
      if (!t) continue;
      if (JSON.stringify(t.support || null) !== JSON.stringify(snap.support)) return true;
      if ((t.sans_socle || false) !== snap.sans_socle) return true;
    }
  }
  return false;
}

/* Met à jour le snapshot pour refléter l'état sauvegardé.
   Appelé après chaque save réussi depuis l'arranger. */
function _refreshArrangerSnapshot() {
  if (!salleActive) return;
  _arrangerSnapshot = {
    positions:        JSON.parse(JSON.stringify(salleActive.positions || [])),
    positions_mobile: JSON.parse(JSON.stringify(salleActive.positions_mobile || [])),
    toiles:           JSON.parse(JSON.stringify(salleActive.toiles || [])),
    supports: toiles.map(function(t) {
      return {
        id:         t.id,
        _type:      typeDeLOeuvre(t),
        support:    t.support    ? JSON.parse(JSON.stringify(t.support)) : null,
        sans_socle: t.sans_socle || false
      };
    })
  };
}

function quitterModePlacement() {
  $('overlay-placement').classList.remove('ouvert');
  /* Restaurer l'état avant ouverture si pas sauvegardé */
  if (_arrangerSnapshot && salleActive) {
    salleActive.positions        = _arrangerSnapshot.positions;
    salleActive.positions_mobile = _arrangerSnapshot.positions_mobile;
    salleActive.toiles           = _arrangerSnapshot.toiles;
    /* Restaurer les supports des pièces — par couple (id, _type) */
    if (_arrangerSnapshot.supports) {
      _arrangerSnapshot.supports.forEach(function(snap) {
        var t = _trouverOeuvre(snap.id, snap._type);
        if (!t) return;
        if (snap.support) t.support = snap.support; else delete t.support;
        if (snap.sans_socle) t.sans_socle = true; else delete t.sans_socle;
      });
    }
  }
  _arrangerSnapshot = null;
  toilesSelectionnees.clear();
  selectedToilePl = null;
  selectedToile = null;
  peintureSurMurSel = null;
  salles.forEach(s => { s.toiles = (s.positions || []).map(p => p.id); });
  afficherPlan();
  toilesSelectionnees.clear(); majBoutons();
  if (typeof afficherTableauBord === 'function') {
    afficherTableauBord();
  } else {
    afficherStock(); buildOccupancy(); afficherMur();
  }
}

/* Met à jour le panneau de contrôle fixe selon la toile sélectionnée sur le mur */
/* Adapte le panneau de contrôle (#pl-ctrl-cross) au type de salle active :
   - PEINTURE : D-pad complet ↑↓←→ + ✕ + 👁 (déplacement par flèches utile)
   - SCULPTURE : ✕ Retirer seul (les pièces sont déplacées par drag sur le sol)
   On bascule en CSS classes pour préserver les boutons et leurs listeners
   (attachés au chargement dans admin.js → pas besoin de re-bind). */
function _majPanelCtrlSelonSalle() {
  var cross = document.querySelector('.pl-ctrl-cross');
  if (!cross) return;
  var estSculpt = _estSculptSalleActive();
  cross.classList.toggle('mode-sculpture', estSculpt);
  cross.classList.toggle('mode-peinture', !estSculpt);
  /* Texte du bouton ✕ adapté au mode pour clarté.
     En sculpture, le bouton est seul donc on l'étiquette ; en peinture
     il fait partie du D-pad et reste minimaliste. */
  var rm = document.getElementById('pl-btn-rm');
  if (rm) rm.textContent = estSculpt ? '✕ Retirer' : '✕';
}

function majCtrlPanel() {
  var panel = $("pl-ctrl-panel");
  var nomEl = $("pl-ctrl-nom");
  if (!panel) return;
  if (peintureSurMurSel === null) {
    panel.classList.remove("active");
    return;
  }
  /* Lookup avec filtre type de la salle active (cohabitation) */
  var _typeSalleCtrl = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
  var t = toiles.find(function(x){
    return x.id === peintureSurMurSel && ((x._type)||ADMIN_CFG.type) === _typeSalleCtrl;
  });
  panel.classList.add("active");
  if (nomEl) nomEl.textContent = t ? (t.titre || "Sans titre") : "—";
}

/* ─── Scène peinture (décor autour du mur d'expo dans l'Arrangeur) ───
   HTML statique : #mur-placement seul dans .placement-mur-zone.
   Pour les salles peinture, on enveloppe dynamiquement le mur dans :
     .scene-peinture > .scene-mur-piece (marge latérale) > #mur-placement
                     + .scene-zb > .scene-mur-inf (avec 2 portes) + .scene-plancher
   Pour les salles sculpture, on dé-wrappe pour rendre le mur directement
   enfant de .placement-mur-zone comme à l'origine. → Aucune interférence. */
var _SCENE_MARGE_LAT_PC = 265; /* px sur PC large (validé via preview) */
var _SCENE_MARGE_LAT_SM = 80;  /* px sur écran étroit */
var _SCENE_MARGE_HAUT_PC = 40; /* px bande mur au-dessus du mur d'expo (PC) */
var _SCENE_MARGE_HAUT_SM = 15; /* px sur écran étroit */
var _SCENE_ZB_H_PC = 83;       /* mur-inf 32 + plancher 51 */
var _SCENE_ZB_H_SM = 56;       /* mur-inf 24 + plancher 32 (cf. media query 1100px) */

function _activerSceneDecorPeinture() {
  var mur = $('mur-placement');
  if (!mur) return;
  if (mur.parentElement && mur.parentElement.classList.contains('scene-mur-piece')) return;
  var zone = mur.parentElement;
  var scene = document.createElement('div');
  scene.className = 'scene-peinture';
  var block = document.createElement('div');
  block.className = 'scene-block';
  scene.appendChild(block);
  var piece = document.createElement('div');
  piece.className = 'scene-mur-piece';
  block.appendChild(piece);
  zone.insertBefore(scene, mur);
  piece.appendChild(mur);
  var zb = document.createElement('div');
  zb.className = 'scene-zb';
  zb.setAttribute('aria-hidden', 'true');
  zb.innerHTML =
    '<div class="scene-mur-inf">' +
      '<div class="scene-porte scene-porte-g"></div>' +
      '<div class="scene-porte scene-porte-d"></div>' +
    '</div>' +
    '<div class="scene-plancher"></div>';
  block.appendChild(zb);
}

function _desactiverSceneDecorPeinture() {
  var mur = $('mur-placement');
  if (!mur) return;
  var piece = mur.parentElement;
  if (!piece || !piece.classList.contains('scene-mur-piece')) return;
  var block = piece.parentElement;          // .scene-block
  var scene = block.parentElement;          // .scene-peinture
  var zone  = scene.parentElement;          // .placement-mur-zone
  mur.style.width = '';
  mur.style.height = '';
  zone.insertBefore(mur, scene);
  scene.remove();
}

/* Calcule width/height du mur d'expo selon l'espace dispo, EN TENANT COMPTE
   de la marge latérale (mur-piece padding) et de la zone-basse. */
function _ajusterMurPeinture() {
  var mur = $('mur-placement');
  if (!mur) return;
  var zone = mur.closest('.placement-mur-zone');
  if (!zone) return;
  var rect = zone.getBoundingClientRect();
  /* Largeur écran < 1100px → marges réduites + zone-basse réduite (cf. media query) */
  var ecranEtroit = window.innerWidth < 1100;
  var margeLat  = ecranEtroit ? _SCENE_MARGE_LAT_SM  : _SCENE_MARGE_LAT_PC;
  var margeHaut = ecranEtroit ? _SCENE_MARGE_HAUT_SM : _SCENE_MARGE_HAUT_PC;
  var zbH       = ecranEtroit ? _SCENE_ZB_H_SM      : _SCENE_ZB_H_PC;
  var dispoH = Math.max(200, rect.height - 16);
  var dispoW = Math.max(300, rect.width - 16);
  /* Mur d'expo : prend la place dispo moins marge haut, zone-basse. Ratio 12/8. */
  var murH = dispoH - margeHaut - zbH;
  if (murH < 120) murH = 120;
  var murW = murH * 1.5;
  /* Si mur + 2×marge lat dépasse la largeur dispo, on réduit en gardant le ratio. */
  if (murW + 2 * margeLat > dispoW) {
    murW = dispoW - 2 * margeLat;
    if (murW < 200) {
      margeLat = Math.max(20, (dispoW - 200) / 2);
      murW = dispoW - 2 * margeLat;
    }
    murH = murW / 1.5;
  }
  mur.style.width  = Math.round(murW) + 'px';
  mur.style.height = Math.round(murH) + 'px';
  /* Appliquer les marges effectives via vars CSS (utiles si on a dû réduire) */
  document.documentElement.style.setProperty('--scene-marge-lat', margeLat + 'px');
  document.documentElement.style.setProperty('--scene-marge-haut', margeHaut + 'px');
}

/* Recalcul au resize quand on est en arrangeur peinture */
window.addEventListener('resize', function() {
  var ov = document.getElementById('overlay-placement');
  if (ov && ov.classList.contains('ouvert') && !_estSculptSalleActive()) {
    _ajusterMurPeinture();
  }
});

function afficherMurPlacement() {
  if (_estSculptSalleActive()) {
    /* Bascule vers sculpture : dé-wrapper la scène pour repartir d'un
       DOM identique au HTML statique (compat. afficherSolPlacement). */
    _desactiverSceneDecorPeinture();
    return afficherSolPlacement();
  }
  const bg = $('mur-placement');
  /* Reset des styles inline laissés par afficherSolPlacement (sculpture). */
  bg.removeAttribute('style');
  bg.className = 'placement-mur-bg';
  bg.innerHTML = '';
  /* Activer la scène (mur-piece + zone-basse) et dimensionner */
  _activerSceneDecorPeinture();
  _ajusterMurPeinture();
  requestAnimationFrame(_ajusterMurPeinture); /* après que le layout soit posé */
  /* Apparence : couleur + texture (gérer images jpg/png/webp comme appliquerApparence) */
  const isImgTex = /\.(jpg|jpeg|png|webp)$/i.test(textureActuelle);
  if (isImgTex) {
    bg.style.background = 'url("' + textureActuelle + '") center/cover, ' + couleurMurActuel;
    bg.style.backgroundBlendMode = 'multiply';
  } else {
    bg.style.backgroundBlendMode = '';
    const texStr = TEXTURES[textureActuelle] || '';
    bg.style.background = texStr ? `${texStr}, ${couleurMurActuel}` : couleurMurActuel;
  }
  bg.classList.toggle('grille-on', grilleVisiblePl);

  // Toiles déjà posées — recherche par couple (id, type de salle) en multi-types
  var _typePlMur = salleActive.type || ADMIN_CFG.type || 'peinture';
  (salleActive.positions || []).forEach(p => {
    const t = _trouverOeuvre(p.id, _typePlMur); if (!t) return;
    const estSel = peintureSurMurSel === p.id;
    const el = document.createElement('div');
    el.className = 'toile-posee' + (estSel ? ' sel-mur' : '');
    el.style.gridColumn = `${p.col} / span ${p.w}`;
    el.style.gridRow    = `${p.row} / span ${p.h}`;
    el.style.borderColor = couleurCadresActuel;
    el.style.borderWidth = epaisseurCadresActuel + 'px';
    if (t.photo) { const img = document.createElement('img'); img.src = t.photo; img.alt=''; img.draggable=false; el.appendChild(img); }
    if (!estSel) {
      const lbl = document.createElement('div'); lbl.className = 'tp-lbl'; lbl.textContent = t.titre||'—'; el.appendChild(lbl);
    }
    el.addEventListener('click', () => { peintureSurMurSel = peintureSurMurSel===p.id?null:p.id; afficherMurPlacement(); });
    bg.appendChild(el);
  });

  majCtrlPanel();

  // Overlay grille 12×8 si activé
  if (grilleVisiblePl) {
    var ov = document.createElement('div');
    ov.className = 'grille-ov';
    bg.appendChild(ov);
  }

  // Cellules vides — colorées vert/rouge si une toile est en attente de placement
  const _plWH = selectedToilePl ? calcCases(selectedToilePl.dimensions) : null;
  for (let r=1;r<=ROWS;r++) for (let c=1;c<=COLS;c++) {
    if (occupancy[`${c},${r}`]) continue;
    const cell = document.createElement('div'); cell.className='cellule';
    if (_plWH) cell.classList.add(canPlace(c,r,_plWH.w,_plWH.h,null) ? 'cel-ok' : 'cel-ko');
    cell.style.gridColumn=c; cell.style.gridRow=r;
    cell.dataset.col=c; cell.dataset.row=r;
    cell.addEventListener('mouseenter', () => survolCellule(c,r,'mur-placement'));
    cell.addEventListener('mouseleave', () => nettoyerSurvolBg('mur-placement'));
    cell.addEventListener('click', () => placerToilePl(c,r));
    bg.appendChild(cell);
  }
}

/* Retourne la salle (autre que salleActive) où la pièce est placée, ou null. */
function _salleDOrigine(id) {
  if (!salleActive) return null;
  /* En multi-types, ne regarder que les salles du MÊME type que salleActive
     (sinon la peinture id=5 est faussement détectée comme "origine = Salle E
     sculpture" qui contient la sculpture id=5). */
  var typeRef = salleActive.type || ADMIN_CFG.type || null;
  for (var i = 0; i < salles.length; i++) {
    var s = salles[i];
    if (s.id === salleActive.id) continue;
    if (typeRef && s.type && s.type !== typeRef) continue;
    var dansPos = (s.positions || []).some(function(p) { return p.id === id; });
    var dansMob = (s.positions_mobile || []).some(function(p) { return p.id === id; });
    if (dansPos || dansMob) return s;
  }
  return null;
}

function afficherStripPlacement() {
  const strip = $('pl-strip'); strip.innerHTML = '';
  const _sculptSalle = _estSculptSalleActive();
  const typeSalleStrip = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
  /* Sous-ensemble des œuvres du type de la salle active — évite la
     collision d'IDs entre peinture et sculpture en multi-types. */
  const toilesType = toiles.filter(function(t) { return typeDeLOeuvre(t) === typeSalleStrip; });
  const idsValides = new Set(toilesType.map(function(t) { return t.id; }));
  const poseeIds = new Set((_sculptSalle ? _getPositions() : (salleActive.positions||[])).map(p=>p.id));

  /* Le strip liste TOUTES les œuvres du type de la salle (peinture ou sculpture),
     pas seulement les placées ou sélectionnées : ça donne une vue d'ensemble du
     stock pour pouvoir glisser/placer librement, comme dans l'arrangeur sculpture. */
  const tousIds = [...new Set([...idsValides, ...poseeIds, ...toilesSelectionnees, ...(selectedToilePl ? [selectedToilePl.id] : [])])]
    .filter(function(id) { return idsValides.has(id); });

  /* Tri : 0 = sur le sol/mur, 1 = à placer (libre), 2 = dans une autre salle */
  const _rang = function(id) {
    if (poseeIds.has(id)) return 0;
    return _salleDOrigine(id) ? 2 : 1;
  };
  tousIds.sort(function(a, b) {
    var ra = _rang(a), rb = _rang(b);
    if (ra !== rb) return ra - rb;
    return a - b; /* stable par id à rang égal */
  });

  if (tousIds.length === 0) {
    strip.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:.5rem 1rem;align-self:center;">Aucun' + (_sculptSalle ? 'e pièce' : 'e toile') + '</div>';
    return;
  }

  tousIds.forEach(id => {
    const t = toilesType.find(x=>x.id===id); if(!t) return;
    const estPlace = poseeIds.has(id);
    const estSelMur = peintureSurMurSel === id;
    const estSelPlace = selectedToilePl?.id === id;

    const item = document.createElement('div');
    item.className = 'pl-item'
      + (estPlace ? ' pose' : '')
      + (estSelMur || estSelPlace ? ' sel' : '');

    const si = document.createElement('div'); si.className='simg';
    if (t.photo || t._preview) {
      const img=document.createElement('img');
      img.alt=''; img.loading='lazy';
      if (t._preview) {
        img.src = t._preview;
      } else {
        img.onerror = function() { this.onerror=null; this.style.display='none'; };
        img.src = t.photo;
      }
      si.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);font-size:12px;color:rgba(255,255,255,.5);border-radius:3px;';
      ph.textContent = t.glb ? '3D' : (t.photo ? 'Photo' : '?');
      si.appendChild(ph);
    }

    // Grille W×H sur la miniature quand mode grille actif (peinture uniquement)
    if (grilleVisiblePl && !_sculptSalle) {
      var _pos = (salleActive.positions||[]).find(function(p){ return p.id===id; });
      var _wh  = _pos ? {w:_pos.w, h:_pos.h} : calcCases(t.dimensions);
      si.style.position = 'relative';
      si.style.backgroundImage = [
        'repeating-linear-gradient(to right,rgba(255,255,255,.55) 0,rgba(255,255,255,.55) 1px,transparent 1px,transparent calc(100%/' + _wh.w + '))',
        'repeating-linear-gradient(to bottom,rgba(255,255,255,.55) 0,rgba(255,255,255,.55) 1px,transparent 1px,transparent calc(100%/' + _wh.h + '))'
      ].join(',');
      var _dim = document.createElement('div');
      _dim.style.cssText = 'position:absolute;bottom:2px;right:2px;font-size:7px;font-weight:700;color:#fff;background:rgba(0,0,0,.65);padding:0 3px;border-radius:2px;pointer-events:none;z-index:1;line-height:1.6;';
      _dim.textContent = _wh.w + '\u00d7' + _wh.h;
      si.appendChild(_dim);
    }

    item.appendChild(si);

    // Badge taille
    if (t.taille) {
      const tb = document.createElement('div'); tb.className='taille-badge';
      tb.textContent = t.taille; item.appendChild(tb);
    }

    // Badge état
    const estAutreSalle = _salleDOrigine(id);
    /* Posée dans l'AUTRE vue (PC↔GSM) de la même salle ? */
    const autreVue = (_placementVue === 'gsm') ? (salleActive.positions || []) : (salleActive.positions_mobile || []);
    const estAutreVue = autreVue.some(function(p) { return p.id === id; });
    const badge = document.createElement('div');
    badge.style.cssText = 'font-size:7px;padding:1px 3px;background:rgba(0,0,0,.5);color:#fff;';
    if (estPlace) {
      badge.textContent = _sculptSalle ? '🔒 sur le sol' : '🔒 sur le mur';
    } else if (estAutreVue) {
      /* Dans cette salle mais sur l'autre vue (ex: posée en PC, absente en GSM) */
      badge.textContent = (_placementVue === 'gsm') ? '🖥 posée en PC' : '📱 posée en GSM';
      badge.style.background = 'rgba(60,90,160,.85)';
    } else if (estAutreSalle) {
      badge.textContent = '📦 ' + estAutreSalle.nom;
      badge.style.background = 'rgba(160,90,30,.85)';
    } else {
      badge.textContent = '+ à placer';
    }
    item.appendChild(badge);

    const n = document.createElement('div'); n.className='snom'; n.textContent=t.titre||'—'; item.appendChild(n);

    item.addEventListener('click', () => {
      if (estPlace) {
        // Sélection pour déplacer avec flèches
        peintureSurMurSel = peintureSurMurSel===id ? null : id;
        selectedToilePl = null; selectedToile = null;
        $('pl-aide').textContent = peintureSurMurSel
          ? `"${t.titre||'—'}" → utilisez les flèches ou ✕ pour retirer`
          : 'Cliquez sur un' + (_sculptSalle ? 'e pièce' : 'e toile') + ' pour la déplacer';
      } else {
        // Sélection pour placer — confirmer si la pièce est dans une autre salle
        if (!(selectedToilePl && selectedToilePl.id === id)) {
          var origine = _salleDOrigine(id);
          if (origine && !confirm('\u00ab ' + (t.titre || 'Cette pièce') + ' \u00bb est déjà placée dans \u00ab ' + origine.nom + ' \u00bb.\n\nLa placer ici la retirera de \u00ab ' + origine.nom + ' \u00bb.\n\nContinuer ?')) {
            return;
          }
        }
        selectedToilePl = selectedToilePl?.id===id ? null : t;
        selectedToile = selectedToilePl;
        peintureSurMurSel = null;
        $('pl-aide').textContent = selectedToilePl
          ? `"${t.titre||'—'}" → cliquez sur ${_sculptSalle ? 'le sol' : 'le mur'} pour placer`
          : 'Sélectionnez un' + (_sculptSalle ? 'e pièce' : 'e toile') + ' à placer';
      }
      /* Sculpture : ne PAS recréer l'iframe (flash + pièces perdues).
         Peinture : afficherMurPlacement met à jour les cases occupées. */
      if (!_sculptSalle) afficherMurPlacement();
      afficherStripPlacement();
    });
    strip.appendChild(item);
  });
}

function placerToilePl(col, row) {
  if (!selectedToilePl || !salleActive) return;
  const {w,h} = calcCases(selectedToilePl.dimensions);
  if (!canPlace(col,row,w,h,null)) { toast('Emplacement occupé','err'); return; }
  /* Retire de toutes les salles du MÊME type (pas des autres types — sinon
     placer une peinture id=4 retirerait la sculpture id=4 de Salle E). */
  var _typeSalleAct = salleActive.type || ADMIN_CFG.type || 'peinture';
  salles.forEach(s => {
    if (s.type && s.type !== _typeSalleAct) return;
    s.toiles = s.toiles.filter(id => id !== selectedToilePl.id);
    s.positions = (s.positions || []).filter(p => p.id !== selectedToilePl.id);
  });
  salleActive.positions.push({id:selectedToilePl.id,col,row,w,h});
  salleActive.toiles.push(selectedToilePl.id);
  buildOccupancy();
  selectedToilePl = null; selectedToile = null;
  afficherMurPlacement(); afficherStripPlacement();
  toast('✓ Placée');
  $('pl-aide').textContent = LBL.Item + ' placée — continuez ou cliquez 💾 Enregistrer';
}

function survolCellule(col, row, bgId) {
  const t = selectedToilePl || selectedToile; if (!t) return;
  const {w,h} = calcCases(t.dimensions);
  const ok = canPlace(col,row,w,h,null);
  nettoyerSurvolBg(bgId);
  for (let c=col;c<col+w;c++) for (let r=row;r<row+h;r++) {
    const cell = $(bgId).querySelector(`[data-col="${c}"][data-row="${r}"]`);
    if (cell) cell.classList.add(ok?'survol':'survol-ko');
  }
}

function nettoyerSurvolBg(bgId) {
  $(bgId).querySelectorAll('.survol,.survol-ko').forEach(c=>c.classList.remove('survol','survol-ko'));
}

// ═══════════════════════════════════════════════
// CODES TAILLE
// ═══════════════════════════════════════════════
function remplirSelectTaille() {
  const sel = $('sel-taille'); if (!sel) return;
  sel.innerHTML = '<option value="">— Choisir —</option>';
  tailles.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.code;
    opt.textContent = `${t.code} — ${t.label}`;
    sel.appendChild(opt);
  });
}

function afficherNouveauTaille() {
  const wrap = $('new-taille-wrap');
  const visible = wrap.style.display === 'none' || wrap.style.display === '';
  wrap.style.display = visible ? 'flex' : 'none';
  if (visible) { wrap.style.flexDirection = 'column'; $('inp-new-taille-code').focus(); }
}

function confirmerNouveauTaille() {
  const code  = $('inp-new-taille-code').value.trim().toUpperCase();
  const label = $('inp-new-taille-label').value.trim();
  if (!code || !label) { toast('Code et libellé requis', 'err'); return; }
  if (tailles.find(t => t.code === code)) { toast(`Code "${code}" existe déjà`, 'err'); return; }
  tailles.push({ code, label });
  remplirSelectTaille();
  $('sel-taille').value = code;
  $('new-taille-wrap').style.display = 'none';
  $('inp-new-taille-code').value = ''; $('inp-new-taille-label').value = '';
  toast(`✓ Code "${code}" — ${label} créé`);
}

function initTailleForm() {
  $('btn-new-taille').addEventListener('click', afficherNouveauTaille);
  $('btn-confirm-taille').addEventListener('click', confirmerNouveauTaille);
  $('inp-new-taille-code').addEventListener('keydown', e => { if(e.key==='Enter') confirmerNouveauTaille(); });
}

/* Type majoritaire parmi les œuvres existantes (en cas d'absence d'argument
   dans ouvrirFormulaireNouvel). Si aucune œuvre, fallback ADMIN_CFG.type. */
function _typeMajoritaire() {
  if (typeof toiles === 'undefined' || !toiles.length) {
    return ADMIN_CFG.type || 'peinture';
  }
  var counts = {};
  toiles.forEach(function(t) {
    var ty = t._type || ADMIN_CFG.type || 'peinture';
    counts[ty] = (counts[ty] || 0) + 1;
  });
  var maxType = ADMIN_CFG.type || 'peinture';
  var maxN = -1;
  Object.keys(counts).forEach(function(ty) {
    if (counts[ty] > maxN) { maxN = counts[ty]; maxType = ty; }
  });
  return maxType;
}

function ouvrirFormulaireNouvel(typeOpt) {
  var typeEffectif = typeOpt || _typeMajoritaire();
  /* Sélecteur de type visible en création */
  var grpType = document.getElementById('grp-type-oeuvre');
  if (grpType) grpType.style.display = '';
  _appliquerTypeFormulaire(typeEffectif);
  toileEnEdition = null;
  /* Salle pré-sélectionnée UNIQUEMENT si le type de salleActive correspond
     au type de l'œuvre créée. Sinon, l'utilisateur doit choisir explicitement. */
  var _typeSalleAct = salleActive ? (salleActive.type || ADMIN_CFG.type || 'peinture') : null;
  salleCibleToile = (salleActive && _typeSalleAct === typeEffectif) ? salleActive.id : null;
  photoB64 = null; glbB64 = null; glbNom = null; window.photoEstPng = false;
  $('modal-toile-tit').textContent = _estSculptEdition() ? 'Nouvelle pièce' : 'Nouvelle toile';
  construireFavoris();
  viderFormToile();
  $('overlay-toile').classList.add('ouvert');
  var mb = $('overlay-toile').querySelector('.modal-body');
  if (mb) mb.scrollTop = 0;
}

function construirePillsSalle(salleSelId) {
  const pills = $('salle-pills'); if (!pills) return; pills.innerHTML = '';
  /* Filtre par type : une sculpture ne peut être placée que dans une salle
     sculpture, et inversement. Évite d'envoyer une sculpture en "Cuisine"
     (salle peinture) ou vice-versa. */
  var typeForm = (typeof _typeEdition !== 'undefined' ? _typeEdition : null) || ADMIN_CFG.type || 'peinture';
  salles.forEach(s => {
    var typeSalle = s.type || ADMIN_CFG.type || 'peinture';
    if (typeSalle !== typeForm) return;
    const p = document.createElement('button');
    p.className = 'salle-pill'; p.type = 'button';
    p.dataset.salle = s.id; p.textContent = s.nom;
    if (s.id === salleSelId) p.classList.add('sel');
    p.addEventListener('click', () => {
      pills.querySelectorAll('.salle-pill').forEach(x => x.classList.remove('sel'));
      p.classList.add('sel'); salleCibleToile = s.id;
    });
    pills.appendChild(p);
  });
}

function ouvrirFormulaireEdition(id, typeOpt) {
  /* En multi-types, l'id n'est pas unique entre peinture et sculpture
     (les compteurs next_id sont séparés). On disambigue via typeOpt
     fourni par la liste. Mono-type : typeOpt absent, comportement legacy. */
  var t;
  if (typeOpt) {
    t = toiles.find(function(x) {
      return x.id === id && ((x._type) || ADMIN_CFG.type) === typeOpt;
    });
  } else {
    t = toiles.find(function(x) { return x.id === id; });
  }
  if (!t) return;
  /* Type de l'œuvre éditée (multi-types). Fallback sur ADMIN_CFG.type
     pour la rétrocompat avec les anciennes œuvres sans _type. */
  /* Sélecteur de type masqué en édition (on ne change pas le type d'une
     œuvre existante — il faudrait migrer entre fichiers JSON séparés). */
  var grpType = document.getElementById('grp-type-oeuvre');
  if (grpType) grpType.style.display = 'none';
  _appliquerTypeFormulaire(t._type || ADMIN_CFG.type || 'peinture');
  toileEnEdition = id; photoB64 = null; glbB64 = null; glbNom = null; window.photoEstPng = false;
  const salleDeLaToile = _salleContenantOeuvre(id, _typeEdition)?.id || salleActive?.id || null;
  construirePillsSalle(salleDeLaToile);
  salleCibleToile = salleDeLaToile;
  $('modal-toile-tit').textContent = _estSculptEdition() ? 'Modifier la pièce' : 'Modifier la toile';
  construireFavoris();
  remplirFormToile(t);
  $('overlay-toile').classList.add('ouvert');
  var mb = $('overlay-toile').querySelector('.modal-body');
  if (mb) mb.scrollTop = 0;
}

function fermerModalToile() { $('overlay-toile').classList.remove('ouvert'); }

let ficheToileId = null;

function ouvrirFiche(id, typeOpt) {
  const t = _trouverOeuvre(id, typeOpt);
  if (!t) return;
  ficheToileId = id;

  const corps = $('fiche-corps');
  corps.innerHTML = '';

  // Photo
  if (t.photo) {
    const img = document.createElement('img');
    img.className = 'fiche-photo'; img.src = t.photo; img.alt = t.titre || '';
    corps.appendChild(img);
  }

  // Bloc texte
  const bloc = document.createElement('div');
  bloc.style.padding = t.photo ? '.9rem 0 0' : '0';

  // Titre & sous-titre
  const titre = document.createElement('div');
  titre.className = 'fiche-titre';
  titre.textContent = t.titre || 'Sans titre';
  bloc.appendChild(titre);

  // Sous-titre : date + style
  const sous = [t.date, t.style].filter(Boolean).join(' — ');
  if (sous) {
    const s = document.createElement('div');
    s.className = 'fiche-sous'; s.textContent = sous;
    bloc.appendChild(s);
  }

  // Lignes de données
  const lignes = [];
  if (t.dimensions) {
    const d = t.dimensions;
    const label = d.type === 'ronde' ? `Ronde ⌀${d.largeur} cm`
      : d.profondeur ? `${d.largeur} × ${d.hauteur} × ${d.profondeur} cm`
      : `${d.largeur} × ${d.hauteur} cm`;
    lignes.push(['Dimensions', label]);
  }
  if (t.taille) {
    const tObj = tailles.find(x => x.code === t.taille);
    lignes.push(['Format', tObj ? `${t.taille} — ${tObj.label}` : t.taille]);
  }
  if (t.materiaux?.length) lignes.push(['Matériaux', t.materiaux.join(', ')]);
  const salle = _salleContenantOeuvre(id, typeDeLOeuvre(t));
  if (salle) lignes.push(['Salle', salle.nom]);
  if (t.prix) lignes.push(['Prix', `${t.prix} €`]);
  if (t.description) lignes.push(['Notes', t.description]);
  if (t.visible === false) lignes.push(['Statut', 'En réserve (non visible)']);

  lignes.forEach(([lbl, val]) => {
    const row = document.createElement('div'); row.className = 'fiche-ligne';
    row.innerHTML = `<span class="fiche-lbl">${lbl}</span><span class="fiche-val">${val}</span>`;
    bloc.appendChild(row);
  });

  corps.appendChild(bloc);
  $('fiche-tit').textContent = t.titre || 'Sans titre';
  $('overlay-fiche').classList.add('ouvert');
}

function fermerFiche() {
  $('overlay-fiche').classList.remove('ouvert');
  ficheToileId = null;
}

function viderFormToile() {
  ['inp-titre','inp-date','inp-style','inp-mat','inp-prix','inp-desc'].forEach(id => $(id).value = '');
  if ($('inp-prof')) $('inp-prof').value = '';
  if ($('inp-glb')) $('inp-glb').value = '';
  glbB64 = null; glbNom = null;
  if ($('glb-info')) $('glb-info').style.display = 'none';
  if ($('glb-ph')) $('glb-ph').style.display = '';
  if ($('inp-glb-file')) $('inp-glb-file').style.display = '';
  if ($('glb-thumb-status')) { $('glb-thumb-status').style.display = 'none'; $('glb-thumb-status').textContent = ''; }
  var btnChgPhoto = document.getElementById('btn-change-photo-sculpt');
  if (btnChgPhoto) btnChgPhoto.style.display = 'none';
  var btnRegen = document.getElementById('btn-regen-thumb');
  if (btnRegen) btnRegen.style.display = 'none';
  $('inp-visible').checked = true;
  $('inp-larg').value = ''; $('inp-haut').value = '';
  if ($('inp-diam-sculpt')) $('inp-diam-sculpt').value = '';
  if ($('inp-sans-socle')) { $('inp-sans-socle').checked = false; $('inp-sans-socle').dispatchEvent(new Event('change')); }
  $('sel-format').value = '';
  document.querySelectorAll('#dims-favoris .dim-chip').forEach(c => c.classList.remove('sel'));
  remplirSelectTaille();
  $('sel-taille').value = '';
  afficherTailleAuto('');
  $('taille-manual-wrap').style.display = 'none';
  $('photo-prev').style.display = 'none';
  $('photo-ph').style.display = '';
  $('btn-recadrer-photo').classList.remove('visible');
  const pq = $('photo-qualite'); if (pq) { pq.style.display = 'none'; pq.textContent = ''; }
  document.querySelectorAll('.salle-pill').forEach(p => p.classList.remove('sel'));
  /* Salle pré-sélectionnée seulement si type compatible (cf. ouvrirFormulaireNouvel) */
  var _typeForm = (typeof _typeEdition !== 'undefined' ? _typeEdition : null) || ADMIN_CFG.type || 'peinture';
  var _typeSalleA = salleActive ? (salleActive.type || ADMIN_CFG.type || 'peinture') : null;
  salleCibleToile = (salleActive && _typeSalleA === _typeForm) ? salleActive.id : null;
  document.querySelectorAll('.salle-pill').forEach(p => {
    if (parseInt(p.dataset.salle) === salleCibleToile) p.classList.add('sel');
  });
}

function remplirFormToile(t) {
  $('inp-titre').value = t.titre || '';
  $('inp-date').value = t.date || '';
  $('inp-style').value = t.style || '';
  $('inp-mat').value = (t.materiaux || []).join(', ');
  $('inp-prix').value = t.prix || '';
  $('inp-desc').value = t.description || '';
  $('inp-visible').checked = t.visible !== false;
  $('sel-format').value = '';
  const d = t.dimensions;
  if (d && d.type === 'ronde') {
    $('sel-format').value = 'ronde50';
    $('inp-larg').value = ''; $('inp-haut').value = '';
    synchroChips(0, 0);
  } else if (d && d.largeur && d.hauteur) {
    $('inp-larg').value = d.largeur; $('inp-haut').value = d.hauteur;
    if (d.profondeur && $('inp-prof')) $('inp-prof').value = d.profondeur;
    synchroChips(d.largeur, d.hauteur);
  } else {
    $('inp-larg').value = ''; $('inp-haut').value = '';
    synchroChips(0, 0);
  }
  remplirSelectTaille();
  $('sel-taille').value = t.taille || '';
  afficherTailleAuto(t.taille || '');
  $('taille-manual-wrap').style.display = 'none';
  if (t.photo) {
    const prevImg = $('photo-prev');
    prevImg.onload = function() {
      afficherQualitePhoto(Math.max(this.naturalWidth, this.naturalHeight), false);
      this.onload = null;
    };
    prevImg.onerror = function() {
      var pq = $('photo-qualite'); if (pq) { pq.style.display = 'none'; pq.textContent = ''; }
      this.onerror = null;
    };
    /* _preview = base64 immédiat après upload (priorité sur l'URL qui peut être en cache) */
    prevImg.src = t._preview || (t.photo + '?v=' + Date.now());
    prevImg.style.display = 'block';
    $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
    /* Bouton "Changer la photo…" en mode sculpture */
    var btnChgPhoto = document.getElementById('btn-change-photo-sculpt');
    if (btnChgPhoto) btnChgPhoto.style.display = '';
    var btnRegen = document.getElementById('btn-regen-thumb');
    if (btnRegen) btnRegen.style.display = '';
    // Si déjà en cache
    if (prevImg.complete && prevImg.naturalWidth) {
      afficherQualitePhoto(Math.max(prevImg.naturalWidth, prevImg.naturalHeight), false);
      prevImg.onload = null;
    }
  } else {
    $('photo-prev').src = ''; $('photo-prev').style.display = 'none';
    $('photo-ph').style.display = '';
    $('btn-recadrer-photo').classList.remove('visible');
    var btnChgPhoto = document.getElementById('btn-change-photo-sculpt');
    if (btnChgPhoto) btnChgPhoto.style.display = 'none';
    var pq = $('photo-qualite'); if (pq) { pq.style.display = 'none'; pq.textContent = ''; }
  }
  salleCibleToile = _salleContenantOeuvre(t.id, typeDeLOeuvre(t))?.id || null;
  /* Champs sculpture */
  if ($('inp-glb')) $('inp-glb').value = t.glb || '';
  if ($('inp-prof') && t.dimensions?.profondeur) $('inp-prof').value = t.dimensions.profondeur;
  /* Afficher info GLB existant */
  if (t.glb && $('glb-info')) {
    $('glb-nom').textContent = t.glb.split('/').pop();
    $('glb-taille').textContent = '';
    $('glb-info').style.display = '';
    $('glb-ph').style.display = 'none';
    if ($('inp-glb-file')) $('inp-glb-file').style.display = 'none';
    /* Toujours proposer Recréer si GLB existe */
    var btnRegenEdit = document.getElementById('btn-regen-thumb');
    if (btnRegenEdit) btnRegenEdit.style.display = '';
  } else if ($('glb-info')) {
    $('glb-info').style.display = 'none';
    $('glb-ph').style.display = '';
  }
  glbB64 = null; glbNom = null;
  /* Remplir stepper socle */
  var inpDiamS = document.getElementById('inp-diam-sculpt');
  if (inpDiamS) inpDiamS.value = t.socle || '';
  var cbSansSocle = document.getElementById('inp-sans-socle');
  if (cbSansSocle) {
    cbSansSocle.checked = !!t.sans_socle;
    cbSansSocle.dispatchEvent(new Event('change')); /* applique le grisé */
  }
  document.querySelectorAll('.salle-pill').forEach(p => {
    p.classList.toggle('sel', parseInt(p.dataset.salle) === salleCibleToile);
  });
}

function lireFormToile() {
  let dim = null;
  if ($('sel-format').value === 'ronde50') {
    dim = { type: 'ronde', largeur: 50, hauteur: 50 };
  } else {
    const l = parseInt($('inp-larg').value), h = parseInt($('inp-haut').value);
    const p = $('inp-prof') ? parseInt($('inp-prof').value) : NaN;
    if (l && h) {
      dim = { type: l === h ? 'carre' : l > h ? 'paysage' : 'portrait', largeur: l, hauteur: h };
      if (p) dim.profondeur = p;
    }
  }
  const result = {
    titre: $('inp-titre').value.trim(),
    date: $('inp-date').value.trim(),
    style: $('inp-style').value.trim(),
    materiaux: $('inp-mat').value.split(',').map(s => s.trim()).filter(Boolean),
    prix: $('inp-prix').value ? parseInt($('inp-prix').value) : undefined,
    description: $('inp-desc').value.trim(),
    dimensions: dim,
    taille: $('sel-taille').value || undefined,
    visible: $('inp-visible').checked
  };
  if ($('inp-glb') && $('inp-glb').value) result.glb = $('inp-glb').value;
  var inpDiamS = document.getElementById('inp-diam-sculpt');
  if (inpDiamS) result.socle = inpDiamS.value ? parseInt(inpDiamS.value) : undefined;
  var cbSansSocle = document.getElementById('inp-sans-socle');
  if (cbSansSocle && cbSansSocle.checked) result.sans_socle = true;
  return result;
}

async function sauverToile() {
  const donnees = lireFormToile();

  /* Blocage : une pièce visible aux visiteurs DOIT avoir une photo/thumbnail.
     photoExistante = thumbnail déjà uploadé (édition) OU nouvelle photo en attente. */
  var photoExistante = !!photoB64;
  if (toileEnEdition !== null) {
    var tEdit = _trouverOeuvre(toileEnEdition, _typeEdition);
    if (tEdit && tEdit.photo) photoExistante = true;
  }
  if (donnees.visible && !photoExistante) {
    var _hasGlbNow = !!(donnees.glb || glbB64 ||
      (toileEnEdition !== null && _trouverOeuvre(toileEnEdition, _typeEdition) && _trouverOeuvre(toileEnEdition, _typeEdition).glb));
    var _msgPhoto = 'Impossible de rendre cette ' + LBL.item + ' visible sans photo valide.\n\n';
    if (_isSculptEdition() && _hasGlbNow) {
      _msgPhoto += 'Régénérez le thumbnail depuis le 3D, ou téléchargez votre propre image.\n\n';
    } else {
      _msgPhoto += 'Téléchargez une photo (image .jpg ou .png).\n\n';
    }
    _msgPhoto += 'Vous pouvez aussi décocher « Visible » pour l\u0027enregistrer en brouillon.';
    alert(_msgPhoto);
    return;
  }

  const lbl = $('sauver-lbl'), btn = $('btn-sauver-toile'), btnAnn = $('btn-annuler-toile');
  btn.disabled = true; btnAnn.disabled = true; lbl.textContent = 'En cours…';
  try {
    if (toileEnEdition === null) {
      const id = prochainId(_typeEdition);
      var _ext = window.photoEstPng ? 'png' : 'jpg';
      var _mime = window.photoEstPng ? 'image/png' : 'image/jpeg';
      let photo = '';
      if (photoB64) photo = await uploaderPhoto(id, photoB64, _ext, _typeEdition);
      let glb = donnees.glb || '';
      if (glbB64) { toast('Upload GLB…'); glb = await uploaderGLB(id, glbB64, _typeEdition); }
      const t = { id, photo, source_photo: 'admin', ...donnees, glb };
      /* _type est essentiel : il détermine dans quel fichier
         data/oeuvres/<type>.json l'œuvre sera écrite. Sans ça, une
         peinture créée chez un admin sculpture (cas Dinso) atterrirait
         dans sculpture.json. */
      t._type = _typeEdition || ADMIN_CFG.type || 'peinture';
      if (photoB64) t._preview = 'data:' + _mime + ';base64,' + photoB64; // aperçu immédiat avant propagation CDN
      toiles.push(t);
      if (salleCibleToile) {
        const s = salles.find(x => x.id === salleCibleToile);
        if (s && !s.toiles.includes(id)) s.toiles.push(id);
      }
      const lbl2 = _estSculptEdition() ? 'pièce' : 'toile';
      await sauvegarder(`[admin] Ajout ${lbl2} #${id}${donnees.titre ? ' — ' + donnees.titre : ''}`, '✓ ' + lbl2.charAt(0).toUpperCase() + lbl2.slice(1) + ' ajouté·e');
    } else {
      /* Recherche par couple (id, type) — sinon en multi-types une édition
         de peinture id=4 toucherait par erreur la sculpture id=4. */
      const idx = toiles.findIndex(x => x.id === toileEnEdition && typeDeLOeuvre(x) === _typeEdition);
      var _extE = window.photoEstPng ? 'png' : 'jpg';
      let photo = toiles[idx].photo;
      if (photoB64) photo = await uploaderPhoto(toileEnEdition, photoB64, _extE, _typeEdition);
      let glb = donnees.glb || toiles[idx].glb || '';
      if (glbB64) { toast('Upload GLB…'); glb = await uploaderGLB(toileEnEdition, glbB64, _typeEdition); }
      // Protection dimensions : si les cases changent, retirer du mur
      const ancienDim = toiles[idx].dimensions;
      const nouvelDim = donnees.dimensions;
      if (ancienDim && nouvelDim) {
        const avant = calcCases(ancienDim);
        const apres = calcCases(nouvelDim);
        if (avant.w !== apres.w || avant.h !== apres.h) {
          let retiree = false;
          /* Retirer seulement des salles du MÊME type que la toile éditée. */
          salles.forEach(s => {
            if (s.type && s.type !== _typeEdition) return;
            if ((s.positions||[]).some(p => p.id === toileEnEdition)) {
              s.positions = s.positions.filter(p => p.id !== toileEnEdition);
              retiree = true;
            }
          });
          if (retiree) toast("Dimensions modifiées — toile retirée du mur, à replacer via Arranger", "ok", 5000);
        }
      }
      // Déplace de salle si besoin — uniquement les salles du même type
      if (salleCibleToile) {
        salles.forEach(s => {
          if (s.type && s.type !== _typeEdition) return;
          s.toiles = s.toiles.filter(id => id !== toileEnEdition);
        });
        const s = salles.find(x => x.id === salleCibleToile);
        if (s) s.toiles.push(toileEnEdition);
      }
      toiles[idx] = { ...toiles[idx], photo, glb, ...donnees };
      /* sans_socle : retirer la clé si décochée (lireFormToile ne la met que si true) */
      if (!donnees.sans_socle) delete toiles[idx].sans_socle;
      const lbl2 = _estSculptEdition() ? 'pièce' : 'toile';
      await sauvegarder(`[admin] Modification ${lbl2} #${toileEnEdition}${donnees.titre ? ' — ' + donnees.titre : ''}`, '✓ Modifications enregistrées');
    }
    const idSauve = toileEnEdition === null
      ? toiles[toiles.length - 1].id
      : toileEnEdition;
    toilesEnAttente.set(idSauve, Date.now());
    demarrerTimerAttente();
    fermerModalToile();
    afficherPlan();
    if (salleActive) { buildOccupancy(); afficherMur(); afficherStock(); }
    if (typeof afficherOeuvres === 'function' && typeof _oeuvresTabActif === 'function' && _oeuvresTabActif()) afficherOeuvres();
    if (typeof majAlertePhotoManquante === 'function') majAlertePhotoManquante();
    toast("✓ Enregistré — site mis à jour dans ~1 min", "ok", 5000);
  } catch (e) { toast('Erreur : ' + e.message, 'err', 4000); }
  finally { btn.disabled = false; btnAnn.disabled = false; lbl.textContent = 'Enregistrer'; }
}

async function supprimerToile() {
  const idCible = toileEnEdition || selectedToile?.id;
  if (!idCible) return;
  /* Type : si on supprime depuis le formulaire en édition, _typeEdition est défini.
     Si c'est depuis l'onglet Œuvres ou stock, selectedToile contient l'objet. */
  var _typeCible = toileEnEdition
    ? _typeEdition
    : (selectedToile ? typeDeLOeuvre(selectedToile) : (ADMIN_CFG.type || 'peinture'));
  const t = _trouverOeuvre(idCible, _typeCible);
  if (!confirm(`Supprimer "${t?.titre || ('cette ' + LBL.item)}" ? Réversible via le backup.`)) return;
  /* Filtre par couple — ne pas supprimer la sculpture id=X quand on supprime la peinture id=X. */
  toiles = toiles.filter(x => !(x.id === idCible && typeDeLOeuvre(x) === _typeCible));
  /* Et ne retirer l'ID que des salles du bon type. */
  salles.forEach(s => {
    if (s.type && s.type !== _typeCible) return;
    s.toiles = s.toiles.filter(id => id !== idCible);
    s.positions = (s.positions || []).filter(p => p.id !== idCible);
    s.positions_mobile = (s.positions_mobile || []).filter(p => p.id !== idCible);
  });
  if (toileEnEdition) fermerModalToile();
  toilesSelectionnees.clear(); selectedToile = null; majBoutons();
  try {
    await sauvegarder(`[admin] Suppression toile #${idCible}${t?.titre ? ' — ' + t.titre : ''}`, '✓ Supprimé');
    afficherPlan();
    if (salleActive) { buildOccupancy(); afficherMur(); afficherStock(); }
    if (typeof afficherOeuvres === 'function' && typeof _oeuvresTabActif === 'function' && _oeuvresTabActif()) afficherOeuvres();
    if (typeof majAlertePhotoManquante === 'function') majAlertePhotoManquante();
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════
// MODAL SALLE
// ═══════════════════════════════════════════════
function ouvrirModalSalle() {
  $('inp-salle-nom').value = `Salle ${String.fromCharCode(65 + salles.length)}`;
  // Positions possibles
  const pg = $('pos-grille');
  pg.innerHTML = '';
  salles.forEach((s, i) => {
    const opt = document.createElement('div');
    opt.className = 'pos-opt';
    opt.textContent = `Après ${s.nom}`;
    opt.dataset.pos = i + 1;
    opt.addEventListener('click', () => {
      pg.querySelectorAll('.pos-opt').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
    });
    pg.appendChild(opt);
  });
  const fin = document.createElement('div');
  fin.className = 'pos-opt sel'; fin.textContent = 'En dernier'; fin.dataset.pos = salles.length;
  pg.appendChild(fin);
  // Helper : (re)peupler le select "Copier l'apparence de…" selon le type
  function _peuplerSelCopier(typeFiltre) {
    const selCopier = $('inp-salle-copier');
    if (!selCopier) return;
    const valActuelle = selCopier.value;
    selCopier.innerHTML = '<option value="">— Nouvelle salle vierge —</option>';
    salles
      .filter(function(s) { return (s.type || 'peinture') === typeFiltre; })
      .forEach(function(s) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nom || ('Salle ' + s.id);
        selCopier.appendChild(opt);
      });
    // Préserver la sélection si toujours valide, sinon retomber sur vierge
    if ([...selCopier.options].some(o => o.value === valActuelle)) selCopier.value = valActuelle;
    else selCopier.value = '';
  }
  // Type par défaut : type de l'admin courant
  const selType = $('inp-salle-type');
  const typeDef = (typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture') ? 'sculpture' : 'peinture';
  if (selType) {
    selType.value = typeDef;
    // Rafraîchir la liste à chaque changement de type (évite clonage cross-type)
    selType.onchange = function() { _peuplerSelCopier(selType.value); };
  }
  _peuplerSelCopier(typeDef);
  $('overlay-salle').classList.add('ouvert');
}

function fermerModalSalle() { $('overlay-salle').classList.remove('ouvert'); }

/* ══ VIDER SALLES ══ */
function ouvrirModalViderSalles() {
  var liste = $('vider-salles-liste');
  liste.innerHTML = '';

  if (!salles.length) { toast("Aucune salle disponible", "err"); return; }

  // Ligne "Tout sélectionner"
  var rowAll = document.createElement("label");
  rowAll.className = "vider-row vider-row-all";
  var cbAll = document.createElement("input");
  cbAll.type = "checkbox"; cbAll.id = "cb-vider-all";
  cbAll.addEventListener("change", function() {
    liste.querySelectorAll(".cb-vider-salle:not(:disabled)").forEach(function(cb) { cb.checked = cbAll.checked; });
  });
  var spanAll = document.createElement("span"); spanAll.textContent = "Toutes les salles";
  rowAll.appendChild(cbAll); rowAll.appendChild(spanAll);
  liste.appendChild(rowAll);

  salles.forEach(function(s) {
    var nb = (s.positions || []).length;
    var row = document.createElement("label");
    row.className = "vider-row" + (nb === 0 ? " desactivee" : "");
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.className = "cb-vider-salle";
    cb.value = s.id; cb.dataset.nom = s.nom || ("Salle " + s.id);
    if (nb === 0) cb.disabled = true;
    var span = document.createElement("span"); span.textContent = s.nom || ("Salle " + s.id);
    var count = document.createElement("span"); count.className = "vider-count";
    count.textContent = nb === 0 ? "vide" : (nb + " toile" + (nb > 1 ? "s" : ""));
    row.appendChild(cb); row.appendChild(span); row.appendChild(count);
    liste.appendChild(row);
  });

  $("overlay-vider-salles").classList.add("ouvert");
}

function fermerModalViderSalles() {
  $("overlay-vider-salles").classList.remove("ouvert");
}

async function validerViderSalles() {
  var checks = document.querySelectorAll(".cb-vider-salle:checked");
  if (!checks.length) { toast("Aucune salle sélectionnée", "err"); return; }

  var ids = Array.from(checks).map(function(cb) { return parseInt(cb.value); });
  var noms = Array.from(checks).map(function(cb) { return cb.dataset.nom; }).join(", ");

  ids.forEach(function(id) {
    var s = salles.find(function(x) { return x.id === id; });
    if (s) { s.positions = []; s.toiles = []; }
  });

  fermerModalViderSalles();
  afficherPlan();
  if (salleActive && ids.indexOf(salleActive.id) >= 0) afficherMur();

  try {
    await sauvegarder("Vider salle(s) : " + noms, null);
    toast("✓ " + ids.length + " salle" + (ids.length > 1 ? "s vidées" : " vidée"));
  } catch(e) {
    toast("Erreur lors de la sauvegarde", "err", 3000);
  }
}


async function creerSalle() {
  const nom    = $('inp-salle-nom').value.trim() || `Salle ${salles.length + 1}`;
  const posOpt = $('pos-grille').querySelector('.pos-opt.sel');
  const pos    = posOpt ? parseInt(posOpt.dataset.pos) : salles.length;
  const newId  = Math.max(...salles.map(s => s.id), 0) + 1;

  // Copie d'apparence depuis une salle source (optionnelle)
  const srcId = parseInt(($('inp-salle-copier') || {}).value) || null;
  const src   = srcId ? salles.find(function(s) { return s.id === srcId; }) : null;

  // Type lu depuis le sélecteur (peinture par défaut)
  const typeSalle = ($('inp-salle-type') || {}).value || 'peinture';
  const estSculpt = (typeSalle === 'sculpture');
  const couleurMurDefaut    = estSculpt ? '#2a2520' : '#2e2e2e';
  const couleurCadresDefaut = estSculpt ? undefined : '#3a3a3a';
  const textureDefaut       = estSculpt ? 'none'    : 'none';

  const salle = {
    id: newId, nom,
    type:               typeSalle,
    couleur_mur:        src ? src.couleur_mur        : couleurMurDefaut,
    couleur_mur_piece:  src ? src.couleur_mur_piece  : '#1a1a1a',
    couleur_mur_bas:    src ? src.couleur_mur_bas    : '#111111',
    couleur_cadres:     src ? src.couleur_cadres     : couleurCadresDefaut,
    epaisseur_cadres:   src ? src.epaisseur_cadres   : undefined,
    texture:            src ? src.texture            : textureDefaut,
    greffons:           src && src.greffons ? JSON.parse(JSON.stringify(src.greffons)) : undefined,
    visible: true,
    toiles: [],
    positions: [],
    positions_mobile: []
  };

  salles.splice(pos, 0, salle);
  fermerModalSalle();
  try {
    const logSrc = src ? ` (depuis "${src.nom}")` : '';
    await sauvegarder(`[admin] Ajout salle "${nom}"${logSrc}`, '✓ Salle ajoutée');
    marquerSalleEnAttente(newId);
    afficherPlan();
    selectSalle(newId);
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
}
// APPARENCE (couleurs + textures)
// ═══════════════════════════════════════════════

/* ══════════════════════════════════════════════════════════════
   PLACEMENT SCULPTURE — parquet x,y au lieu de grille 12×8
   ══════════════════════════════════════════════════════════════ */

function afficherSolPlacement() {
  /* Masquer l'aperçu normal */
  $('mur-bg').innerHTML = '';
  var oldRow = document.getElementById('mur-row-wrap');
  if (oldRow) {
    var bg = $('mur-bg');
    oldRow.parentNode.insertBefore(bg, oldRow);
    oldRow.remove();
  }

  const container = $('mur-placement');
  container.innerHTML = '';
  container.className = '';

  const isGsm = _placementVue === 'gsm';

  /* Dimensions calculées en JS pour garantir le ratio (PC 16:9, GSM 9:19).
     On part de l'espace dispo et on choisit la dimension limitante.
     #mur-placement est enfant direct de .placement-mur-zone — la scène
     peinture (.scene-peinture) est créée/détruite dynamiquement par
     afficherMurPlacement et a déjà été retirée si on arrive ici. */
  var zoneRect = container.parentElement.getBoundingClientRect();
  var availH = Math.max(200, zoneRect.height - 30);
  var availW = Math.max(200, zoneRect.width - 10);
  var ratio = isGsm ? (9 / 19) : (16 / 9); /* largeur / hauteur */
  /* Essayer de remplir la hauteur, sinon limiter par la largeur */
  var wrapH = availH;
  var wrapW = wrapH * ratio;
  if (wrapW > availW) { wrapW = availW; wrapH = wrapW / ratio; }

  container.style.cssText =
    'display:flex;align-items:center;justify-content:center;height:' + availH + 'px;width:100%;';

  /* Wrapper iframe — dimensions fixes calculées */
  const iframeWrap = document.createElement('div');
  iframeWrap.style.cssText =
    'width:' + Math.round(wrapW) + 'px;height:' + Math.round(wrapH) + 'px;' +
    'border-radius:' + (isGsm ? '12px' : '6px') + ';overflow:hidden;position:relative;' +
    (isGsm ? 'border:2px solid var(--gold);box-shadow:0 4px 24px rgba(0,0,0,.3);' : '');

  /* Label mode */
  if (isGsm) {
    var lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:10;font-size:9px;color:var(--gold);font-weight:700;letter-spacing:.1em;background:rgba(0,0,0,.5);padding:2px 8px;border-radius:6px;';
    lbl.textContent = '📱 Vue GSM';
    iframeWrap.appendChild(lbl);
  }

  /* Iframe charge la vraie galerie en mode édition */
  const galeriePath = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'galerie-edit.html';
  const iframe = document.createElement('iframe');
  iframe.id = 'edit-galerie-iframe';
  iframe.src = galeriePath + '?vue=' + (isGsm ? 'gsm' : 'pc') + '&v=' + Date.now();
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  iframeWrap.appendChild(iframe);
  container.appendChild(iframeWrap);

  /* Écouter les messages de l'iframe */
  function onMessage(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'iframe-awaiting-data') {
      /* L'iframe attend les données — envoyer l'état admin en mémoire (toujours frais).
         Évite que l'iframe lise un salles.json périmé via le CDN.
         Stock filtré selon le type de la salle (multi-types : éviter collisions). */
      var iframe = document.getElementById('edit-galerie-iframe');
      if (iframe && iframe.contentWindow) {
        var typeSalleArr = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
        iframe.contentWindow.postMessage({
          type: 'init-data',
          toiles: _stockParType(typeSalleArr),
          salles: { salles: [JSON.parse(JSON.stringify(salleActive))] }
        }, '*');
      }
    }

    if (e.data.type === 'edit-ready') {
      /* Galerie prête */
    }

    if (e.data.type === 'positions-updated') {
      /* Mettre à jour les positions dans les données admin (vue courante) */
      if (_placementVue === 'gsm') {
        salleActive.positions_mobile = e.data.positions;
      } else {
        salleActive.positions = e.data.positions;
      }
    }

    if (e.data.type === 'piece-removed') {
      afficherStripPlacement();
      fermerPanneauSupport();
    }

    if (e.data.type === 'piece-selected') {
      ouvrirPanneauSupport(e.data.id);
    }

    if (e.data.type === 'piece-deselected') {
      fermerPanneauSupport();
    }

    if (e.data.type === 'sol-click') {
      /* Placer la pièce sélectionnée dans le strip */
      if (selectedToilePl) {
        placerPieceSolViaIframe(e.data.x, e.data.y);
      }
    }
  }

  /* Nettoyer l'ancien listener si existait */
  if (window._editMessageHandler) {
    window.removeEventListener('message', window._editMessageHandler);
  }
  window._editMessageHandler = onMessage;
  window.addEventListener('message', onMessage);

  majCtrlPanel();
}

/* Placer une pièce via l'iframe */
function placerPieceSolViaIframe(x, y) {
  if (!selectedToilePl || !salleActive) return;
  var piece = selectedToilePl;
  var gab = _gabaritSculpt(piece.dimensions?.hauteur);
  var pos = _getPositions();

  /* Retirer la pièce de toute AUTRE salle (déplacement entre salles) — UNIQUEMENT
     du même type. Cohabitation : sculpture #N et peinture #N ont le même id. */
  var _typeSalleActP = salleActive.type || ADMIN_CFG.type || 'sculpture';
  salles.forEach(function(s) {
    if (s.id === salleActive.id) return;
    if (s.type && s.type !== _typeSalleActP) return;
    if (s.positions)        s.positions        = s.positions.filter(function(p) { return p.id !== piece.id; });
    if (s.positions_mobile) s.positions_mobile = s.positions_mobile.filter(function(p) { return p.id !== piece.id; });
    if (s.toiles)           s.toiles           = s.toiles.filter(function(t) { return t !== piece.id; });
  });

  /* Retirer si déjà placée dans ce mode */
  var idx = pos.findIndex(function(p) { return p.id === piece.id; });
  if (idx >= 0) pos.splice(idx, 1);

  pos.push({ id: piece.id, x: x, y: y, gabarit: gab });

  /* Assigner à la salle si pas encore dedans */
  if (!salleActive.toiles) salleActive.toiles = [];
  if (!salleActive.toiles.includes(piece.id)) salleActive.toiles.push(piece.id);

  /* Rafraîchir l'iframe — passer les positions mises à jour pour éviter re-fetch */
  var iframe = document.getElementById('edit-galerie-iframe');
  if (iframe) {
    iframe.contentWindow.postMessage({
      type: 'refresh',
      injectPositions: [{ id: piece.id, x: x, y: y, gabarit: gab }]
    }, '*');
    /* Sélectionner automatiquement la pièce posée (socle créé en asynchrone) */
    var _pid = piece.id;
    setTimeout(function() {
      if (iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'selectionner-piece', id: _pid }, '*');
    }, 80);
  }

  selectedToilePl = null;
  afficherStripPlacement();
  toast('"' + (piece.titre || '—') + '" placée');
}


/* placerPieceSol supprimée : ancienne version utilisant _checkOverlap
   (du bloc drag supprimé). Remplacée par placerPieceSolViaIframe qui
   reçoit les coordonnées via postMessage depuis l'iframe d'arrangement. */

function deplacerPieceSol(dx, dy) {
  if (peintureSurMurSel === null) return;
  const pos = _getPositions().find(p => p.id === peintureSurMurSel);
  if (!pos) return;
  pos.x = Math.max(5, Math.min(95, (pos.x || 50) + dx));
  pos.y = Math.max(5, Math.min(95, (pos.y || 50) - dy)); /* -dy : Up=+y, Down=-y */
  afficherSolPlacement();
}

/* Gabarit auto depuis hauteur (dupliqué de galerie-sculpture.js) */
function _gabaritSculpt(h) {
  if (!h)      return 'M';
  if (h <= 25) return 'S';
  if (h <= 50) return 'M';
  if (h <= 100) return 'L';
  return 'SOL';
}

/* ══════════════════════════════════════════════════════════════
   PANNEAU SUPPORT (sculpture) — édition graphique dans l'Arranger
   support attaché à la pièce : { type, couleur, texture, taille }
   ══════════════════════════════════════════════════════════════ */
var _supportPieceId = null;
var _supportPieceType = null; /* type de la pièce en cours d'édition support — pour disambiguer en cohabitation */

function _supportDefaut() {
  return { type: 'socle', couleur: '#eae6de', texture: 'marbre', taille: 40 };
}

function ouvrirPanneauSupport(pieceId) {
  /* Filtre par type sculpture : ce panneau n'existe que pour les sculptures.
     En cohabitation, peinture #N et sculpture #N ont le même id — il faut
     impérativement filtrer sinon on récupère la mauvaise œuvre. */
  var piece = toiles.find(function(t) {
    return t.id === pieceId && ((t._type)||ADMIN_CFG.type) === 'sculpture';
  });
  if (!piece) return;
  _supportPieceId = pieceId;
  _supportPieceType = 'sculpture';

  /* Migration douce : sans_socle → type aucun ; sinon socle par défaut */
  if (!piece.support) {
    piece.support = piece.sans_socle ? { type: 'aucun' } : _supportDefaut();
  }
  /* Compléter les champs manquants */
  var s = piece.support;
  if (s.type !== 'aucun') {
    if (!s.couleur) s.couleur = '#eae6de';
    if (!s.texture) s.texture = 'marbre';
    if (!s.taille)  s.taille = 40;
  }

  var panel = document.getElementById('support-panel');
  if (!panel) return;
  document.getElementById('support-piece-nom').textContent = piece.titre || '—';

  _supportSyncUI();
  panel.style.display = 'block';
  /* Masquer le texte d'aide (recouvert par le panneau) */
  var aide = document.getElementById('pl-aide');
  if (aide) aide.style.visibility = 'hidden';
  /* Toujours replié à l'ouverture (ne gêne pas le placement/déplacement) */
  _supportCorpsOuvert(false);

  /* Brancher les contrôles une seule fois */
  if (!panel.dataset.bound) {
    panel.dataset.bound = '1';
    /* Toggle accordéon au clic sur la barre (sauf boutons) */
    document.getElementById('support-barre').addEventListener('click', function(e) {
      if (e.target.closest('#support-retirer') || e.target.closest('#support-close')) return;
      var corps = document.getElementById('support-corps');
      _supportCorpsOuvert(corps.style.display === 'none');
    });
    document.getElementById('support-close').addEventListener('click', function() {
      fermerPanneauSupport();
    });
    document.getElementById('support-retirer').addEventListener('click', function() {
      if (_supportPieceId == null) return;
      var iframe = document.getElementById('edit-galerie-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'retirer-piece', id: _supportPieceId }, '*');
      }
    });
    /* Type */
    document.querySelectorAll('.support-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
        if (!p) return;
        var type = btn.dataset.type;
        /* Conserver couleur/texture/taille même en passant par "aucun" :
           on ne touche qu'au type. Les réglages d'apparence persistent. */
        if (!p.support) p.support = _supportDefaut();
        if (p.support.type === 'aucun' && type !== 'aucun') {
          /* On revient sur un support visible : compléter les champs manquants */
          if (!p.support.couleur) p.support.couleur = '#eae6de';
          if (!p.support.texture) p.support.texture = 'marbre';
          if (!p.support.taille)  p.support.taille = 40;
        }
        p.support.type = type;
        _supportSyncUI();
        _supportAppliquer();
      });
    });
    /* Texture */
    document.querySelectorAll('.support-tex-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
        if (!p || !p.support || p.support.type === 'aucun') return;
        p.support.texture = btn.dataset.tex;
        _supportSyncUI();
        _supportAppliquer();
      });
    });
    /* Couleur → picker HSV */
    document.getElementById('support-couleur-btn').addEventListener('click', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
      if (!p || !p.support || p.support.type === 'aucun') return;
      window._supportPickerCouleur = p.support.couleur || '#eae6de';
      window._supportPickerOnConfirm = function(hex) {
        p.support.couleur = hex;
        _supportSyncUI();
        _supportAppliquer();
      };
      ouvrirPickerCouleur('support');
    });
    /* Taille */
    document.getElementById('support-taille').addEventListener('input', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
      if (!p || !p.support || p.support.type === 'aucun') return;
      p.support.taille = parseInt(this.value);
      document.getElementById('support-taille-val').textContent = this.value + ' cm';
      _supportRenderApercu(p);
    });
    document.getElementById('support-taille').addEventListener('change', function() {
      _supportAppliquer();
    });
    /* Hauteur */
    document.getElementById('support-hauteur').addEventListener('input', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
      if (!p || !p.support || p.support.type === 'aucun') return;
      p.support.hauteur = parseInt(this.value);
      document.getElementById('support-hauteur-val').textContent = this.value + ' cm';
      _supportRenderApercu(p);
    });
    document.getElementById('support-hauteur').addEventListener('change', function() {
      _supportAppliquer();
    });
    /* Bouton Auto → supprime la hauteur explicite (retour calcul auto) */
    document.getElementById('support-hauteur-auto').addEventListener('click', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
      if (!p || !p.support || p.support.type === 'aucun') return;
      delete p.support.hauteur;
      _supportSyncUI();
      _supportAppliquer();
    });
  }
}

function fermerPanneauSupport() {
  var panel = document.getElementById('support-panel');
  if (panel) panel.style.display = 'none';
  var aide = document.getElementById('pl-aide');
  if (aide) aide.style.visibility = '';
  _supportPieceId = null;
  _supportPieceType = null;
}

/* Déplie (true) ou replie (false) le corps de l'accordéon support */
function _supportCorpsOuvert(ouvert) {
  var corps = document.getElementById('support-corps');
  var chevron = document.getElementById('support-chevron');
  if (corps) corps.style.display = ouvert ? 'block' : 'none';
  if (chevron) chevron.style.transform = ouvert ? 'rotate(90deg)' : 'rotate(0deg)';
}

/* Reflète l'état de piece.support dans l'UI du panneau */
function _supportSyncUI() {
  var p = toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); });
  if (!p || !p.support) return;
  var s = p.support;

  document.querySelectorAll('.support-type-btn').forEach(function(b) {
    b.classList.toggle('sel', b.dataset.type === s.type);
  });

  var app = document.getElementById('support-apparence');
  if (s.type === 'aucun') { app.style.display = 'none'; return; }
  app.style.display = 'block';

  document.querySelectorAll('.support-tex-btn').forEach(function(b) {
    b.classList.toggle('sel', b.dataset.tex === s.texture);
  });
  var btnCol = document.getElementById('support-couleur-btn');
  if (btnCol) btnCol.style.background = s.couleur || '#eae6de';
  var hexLbl = document.getElementById('support-couleur-hex');
  if (hexLbl) hexLbl.textContent = s.couleur || '#eae6de';

  var unite = document.getElementById('support-taille-unite');
  if (unite) unite.textContent = s.type === 'socle' ? '(diamètre cm)' : '(largeur cm)';
  var rng = document.getElementById('support-taille');
  if (rng) rng.value = s.taille || 40;
  var val = document.getElementById('support-taille-val');
  if (val) val.textContent = (s.taille || 40) + ' cm';

  /* Hauteur — masquée pour l'étagère (plate par nature) */
  var hGrp = document.getElementById('support-hauteur-grp');
  if (hGrp) hGrp.style.display = (s.type === 'etagere') ? 'none' : 'block';
  var hRng = document.getElementById('support-hauteur');
  var hVal = document.getElementById('support-hauteur-val');
  if (hRng) hRng.value = s.hauteur || 60;
  if (hVal) hVal.textContent = s.hauteur ? (s.hauteur + ' cm') : 'auto';

  _supportRenderApercu(p);
}

/* Mini-aperçu de la pièce posée sur son support (HTML/CSS autonome) */
function _supportRenderApercu(p) {
  var zone = document.getElementById('support-apercu');
  if (!zone || !p) return;
  zone.innerHTML = '';
  /* Centrer le groupe verticalement, fond damier léger pour révéler la transparence */
  zone.style.alignItems = 'center';
  zone.style.justifyContent = 'center';

  var s = p.support || { type: 'aucun' };
  var assetsBase = (typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.assetsBase) || '';

  /* Conteneur : pièce au-dessus du support, groupe centré dans la zone */
  var col = document.createElement('div');
  col.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;max-height:100%;';

  /* La zone fait 150px : on répartit ~60px photo + ~50px support max, marge incluse */
  var photoH = 64;

  /* Image de la pièce (thumbnail) ou placeholder photo manquante.
     On privilégie p.photo (PNG transparent sur le repo) ; _preview n'est utilisé
     que s'il est lui-même un PNG (sinon JPEG = fond noir). */
  var preview = (p._preview && /^data:image\/png/.test(p._preview)) ? p._preview : null;
  if (p.photo || preview) {
    var img = document.createElement('img');
    var src = /^https?:\/\//.test(p.photo || '') ? p.photo : assetsBase + (p.photo || '');
    img.src = preview || src;
    img.style.cssText = 'height:' + photoH + 'px;width:auto;max-width:110px;object-fit:contain;display:block;position:relative;z-index:5;';
    img.onerror = function() { this.style.display = 'none'; };
    col.appendChild(img);
  } else {
    var phm = document.createElement('div');
    phm.style.cssText = 'height:' + photoH + 'px;display:flex;align-items:center;justify-content:center;position:relative;z-index:5;';
    phm.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:.6;">' +
      '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" stroke="#888" stroke-width="1.5" fill="rgba(255,255,255,.3)"/>' +
      '<circle cx="12" cy="12.5" r="3.2" stroke="#888" stroke-width="1.5" fill="none"/>' +
      '<line x1="3" y1="3" x2="21" y2="21" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/></svg>';
    col.appendChild(phm);
  }

  /* Support sous la pièce — tailles plafonnées pour rester dans la zone */
  var coul = s.couleur || '#eae6de';
  if (s.type === 'socle') {
    var hPx = s.hauteur ? Math.min(60, Math.round(s.hauteur * 0.55)) : Math.round(photoH * 0.6);
    var wPx = Math.max(24, Math.min(64, Math.round((s.taille || 40) * 0.85)));
    var ped = document.createElement('div');
    ped.style.cssText = 'width:' + wPx + 'px;height:' + hPx + 'px;border-radius:6px;' +
      'background:linear-gradient(90deg,' + _teinteApercu(coul,-0.15) + ',' + _teinteApercu(coul,0.12) + ',' + _teinteApercu(coul,-0.15) + ');' +
      'box-shadow:0 4px 10px rgba(0,0,0,.25);';
    col.appendChild(ped);
  } else if (s.type === 'presentoir') {
    var hP = s.hauteur ? Math.min(64, Math.round(s.hauteur * 0.55)) : Math.round(photoH * 0.7);
    var wP = Math.max(14, Math.min(36, Math.round((s.taille || 40) * 0.45)));
    var colWrap = document.createElement('div');
    colWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    var colonne = document.createElement('div');
    colonne.style.cssText = 'width:' + wP + 'px;height:' + hP + 'px;border-radius:4px 4px 2px 2px;' +
      'background:linear-gradient(90deg,' + _teinteApercu(coul,-0.12) + ',' + _teinteApercu(coul,0.1) + ',' + _teinteApercu(coul,-0.12) + ');box-shadow:2px 3px 8px rgba(0,0,0,.2);';
    var base = document.createElement('div');
    base.style.cssText = 'width:' + Math.round(wP*1.5) + 'px;height:7px;border-radius:3px;background:' + _teinteApercu(coul,-0.08) + ';box-shadow:0 2px 5px rgba(0,0,0,.2);';
    colWrap.appendChild(colonne);
    colWrap.appendChild(base);
    col.appendChild(colWrap);
  } else if (s.type === 'etagere') {
    var hE = Math.max(9, Math.round(photoH * 0.18));
    var wE = Math.max(54, Math.min(120, Math.round((s.taille || 40) * 1.5)));
    var et = document.createElement('div');
    et.style.cssText = 'width:' + wE + 'px;height:' + hE + 'px;border-radius:3px;' +
      'background:' + coul + ';box-shadow:0 4px 10px rgba(0,0,0,.22),inset 0 2px 0 rgba(255,255,255,.1);';
    col.appendChild(et);
  } else {
    /* aucun — ombre au sol */
    var ombre = document.createElement('div');
    ombre.style.cssText = 'width:46px;height:7px;border-radius:50%;background:rgba(0,0,0,.25);filter:blur(3px);margin-top:2px;';
    col.appendChild(ombre);
  }

  zone.appendChild(col);
}

/* Éclaircit/assombrit une couleur hex (facteur -1..1) — version aperçu */
function _teinteApercu(hex, f) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex || '#ccc';
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  function adj(c){ return Math.max(0, Math.min(255, Math.round(c + 255*f))); }
  return 'rgb(' + adj(r) + ',' + adj(g) + ',' + adj(b) + ')';
}

/* Affiche/masque le bandeau d'alerte si une ou plusieurs pièces n'ont pas de photo */
function majAlertePhotoManquante() {
  var el = document.getElementById('alerte-photo-manquante');
  if (!el) return;
  var sansPhoto = (Array.isArray(toiles) ? toiles : []).filter(function(t) {
    return !t.photo;
  });
  if (sansPhoto.length === 0) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  var motItem = (typeof LBL !== 'undefined' ? LBL.items : 'objets');
  el.textContent =
    'Une ou plusieurs de vos ' + motItem + ' n\u0027ont pas de photo valide. ' +
    'Vous pouvez tenter de régénérer l\u0027image via Pièces > Modifier ou télécharger votre propre image dans Pièces > Modifier. ' +
    'Toute mise sur la galerie lui sera refusée dans cet état.';
  el.style.display = '';
}

/* Pousse le changement vers l'iframe (re-render de la pièce) + persiste en mémoire */
function _supportAppliquer() {
  var iframe = document.getElementById('edit-galerie-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'support-updated',
      pieceId: _supportPieceId,
      piece: JSON.parse(JSON.stringify(toiles.find(function(t) { return t.id === _supportPieceId && ((t._type)||ADMIN_CFG.type) === (_supportPieceType||'sculpture'); })))
    }, '*');
  }
}
