// ═══════════════════════════════════════════════
// ADMIN-GALERIE.JS — Plan · Grille 12×8 · Stock · Placement · Fiche toile · Modal salle
// Dépend de : apiGH, commitMulti, lireRaw, toast, $, ADMIN_CFG, REPO, BRANCH (admin.js)
//             salles, toiles, salleActive, token, chargerTout (admin.js globals)

/* Labels adaptatifs peinture/sculpture */
const _isSculpt = typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture';
const LBL = _isSculpt
  ? { item:'pièce', items:'pièces', Item:'Pièce', Items:'Pièces', placee:'placée', retiree:'retirée' }
  : { item:'toile', items:'toiles', Item:'Toile', Items:'Toiles', placee:'placée', retiree:'retirée du mur' };

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
function afficherPlan() {
  const cont = $('chips-salles');
  cont.innerHTML = '';
  salles.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (s.toiles.length === 0 ? ' vide' : '');
    if (salleActive && s.id === salleActive.id) chip.classList.add('sel');
    chip.innerHTML = `<div class="cn">${s.nom}</div><div class="cb">${s.toiles.length || 'vide'} ${s.toiles.length > 1 ? LBL.items : LBL.item}</div>`;
    if (sallesEnAttente.has(s.id)) {
      const elapsed = Math.floor((Date.now() - sallesEnAttente.get(s.id)) / 1000);
      const restant = Math.max(0, 60 - elapsed);
      const badge = document.createElement('div');
      badge.className = 'chip-sync';
      badge.textContent = restant > 0 ? `⏳ ${restant}s` : '✓';
      chip.appendChild(badge);
    }
    chip.addEventListener('click', () => selectSalle(s.id));
    cont.appendChild(chip);
  });
  // Bouton ajouter
  const add = document.createElement('button');
  add.className = 'chip-add';
  add.innerHTML = '＋ Salle';
  add.addEventListener('click', () => ouvrirModalSalle());
  cont.appendChild(add);
}

function selectSalle(id) {
  salleActive = salles.find(s => s.id === id);
  if (!salleActive) return;
  // Met à jour badge et plan
  $('badge-salle').textContent = salleActive.nom;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  const chips = $('chips-salles').querySelectorAll('.chip');
  chips.forEach((c, i) => { if (salles[i]?.id === id) c.classList.add('sel'); });
  // Applique couleurs
  couleurMurActuel = salleActive.couleur_mur;
  couleurCadresActuel = salleActive.couleur_cadres;
  epaisseurCadresActuel = salleActive.epaisseur_cadres || 2;
  textureActuelle = salleActive.texture || 'none';
  if (typeof appliquerApparence === 'function') appliquerApparence();
  // Affiche mur + stock
  buildOccupancy();
  afficherMur();
  afficherStock();
  selectedToile = null;
  selectedToilePl = null;
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

  /* ── SCULPTURE : aperçu parquet avec socles en perspective ── */
  if (_isSculpt) {
    bg.className = '';
    const coulParquet = couleurMurActuel || '#8a6228';
    const texSol = textureActuelle || 'parquet';
    bg.style.cssText =
      'background:' + solPatternCSS(texSol, coulParquet) + ';position:relative;overflow:visible;' +
      (function() {
      var isMob = window.innerWidth <= 600;
      var overhead = isMob ? 250 : 220;
      var r = (window.innerWidth / Math.max(300, window.innerHeight - overhead)).toFixed(3);
      return isMob
        ? 'display:block;width:100%;border-radius:6px;aspect-ratio:' + r + ';max-height:55vh;'
        : 'display:block;border-radius:6px;margin:0 auto;height:42vh;width:auto;aspect-ratio:' + r + ';max-width:100%;';
    })();

    /* Pièces avec socles perspective */
    (salleActive.positions || []).slice().sort((a, b) => b.y - a.y).forEach(p => {
      const t = toiles.find(x => x.id === p.id); if (!t) return;
      const scale = (1 - (p.y / 100) * 0.42).toFixed(3);
      const zIdx  = Math.round((100 - p.y) * 10);

      const wrap = document.createElement('div');
      wrap.style.cssText =
        'position:absolute;left:' + p.x + '%;bottom:' + p.y + '%;' +
        'transform:translateX(-50%) scale(' + scale + ');transform-origin:bottom center;' +
        'z-index:' + zIdx + ';display:flex;flex-direction:column;align-items:center;';

      /* Image ou placeholder */
      const imgWrap = document.createElement('div');
      imgWrap.style.cssText = 'width:50px;height:50px;display:flex;align-items:flex-end;justify-content:center;';
      if (t.photo || t._preview) {
        const img = document.createElement('img');
        img.src = t._preview || t.photo; img.alt = ''; img.draggable = false;
        img.style.cssText = 'max-width:50px;max-height:50px;object-fit:contain;';
        imgWrap.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.style.cssText = 'width:36px;height:44px;background:rgba(255,255,255,.25);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.6);';
        ph.textContent = t.glb ? '3D' : '?';
        imgWrap.appendChild(ph);
      }
      wrap.appendChild(imgWrap);

      /* Piédestal marbre */
      const ped = document.createElement('div');
      ped.style.cssText =
        'width:40px;height:28px;border-radius:5px;' +
        'background:linear-gradient(to right,rgba(0,0,0,.15),rgba(255,255,255,.08) 45%,rgba(255,255,255,.12) 55%,rgba(0,0,0,.12));' +
        'background-color:#eae6de;position:relative;';
      /* Ellipse dessus */
      const top = document.createElement('div');
      top.style.cssText =
        'position:absolute;top:-4px;left:-15%;width:130%;height:8px;' +
        'background:radial-gradient(ellipse at 42% 40%,#f8f6f2,#d8d2c8);border-radius:50%;';
      ped.appendChild(top);
      wrap.appendChild(ped);

      /* Ombre */
      const ombre = document.createElement('div');
      ombre.style.cssText =
        'width:55px;height:6px;background:rgba(0,0,0,.25);border-radius:50%;filter:blur(3px);margin-top:1px;';
      wrap.appendChild(ombre);

      /* Titre */
      const lbl = document.createElement('div');
      lbl.style.cssText =
        'font-size:8px;color:#fff;white-space:nowrap;max-width:70px;overflow:hidden;' +
        'text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.6);margin-top:2px;';
      lbl.textContent = t.titre || '—';
      wrap.appendChild(lbl);

      bg.appendChild(wrap);
    });

    /* ── Aperçu GSM à côté ── */
    var oldGsmPrev = document.getElementById('gsm-preview-aside');
    if (oldGsmPrev) oldGsmPrev.remove();
    var oldRow = document.getElementById('mur-row-wrap');
    if (oldRow) { /* Dé-wrapper si déjà wrappé */
      oldRow.parentNode.insertBefore(bg, oldRow);
      oldRow.remove();
    }

    var mobilePos = salleActive.positions_mobile || [];
    if (mobilePos.length) {
      /* Wrapper row pour côte à côte */
      var rowWrap = document.createElement('div');
      rowWrap.id = 'mur-row-wrap';
      rowWrap.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
      bg.parentNode.insertBefore(rowWrap, bg);
      rowWrap.appendChild(bg);
      bg.style.flex = '1';

      var miniGsm = document.createElement('div');
      miniGsm.id = 'gsm-preview-aside';
      miniGsm.style.cssText = 'flex:0 0 80px;height:160px;border-radius:10px;overflow:hidden;border:1.5px solid var(--gold);display:flex;flex-direction:column;';

      var gsmLbl = document.createElement('div');
      gsmLbl.style.cssText = 'text-align:center;font-size:7px;color:#fff;padding:3px 0;background:#7a7a7a;font-weight:700;letter-spacing:.1em;';
      gsmLbl.textContent = '📱 GSM';
      miniGsm.appendChild(gsmLbl);

      var gsmMur = document.createElement('div');
      gsmMur.style.cssText = 'flex:0 0 20%;background:#7a7a7a;';
      miniGsm.appendChild(gsmMur);

      var gsmSol = document.createElement('div');
      gsmSol.style.cssText = 'flex:1;position:relative;background:' + solPatternCSS(texSol, coulParquet) + ';';
      mobilePos.forEach(function(p) {
        var t2 = toiles.find(function(x){ return x.id === p.id; }); if (!t2) return;
        var sc = 1 - (p.y / 100) * 0.42;
        var dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;left:' + p.x + '%;bottom:' + p.y + '%;transform:translateX(-50%) scale(' + (sc * 0.7).toFixed(2) + ');transform-origin:bottom center;width:8px;height:10px;background:#eae6de;border-radius:2px;border:1px solid rgba(0,0,0,.25);';
        gsmSol.appendChild(dot);
      });
      miniGsm.appendChild(gsmSol);
      rowWrap.appendChild(miniGsm);
    }

    return;
  }

  /* ── PEINTURE : grille mur ── */
  bg.classList.toggle('grille-on', grilleVisible);

  // Toiles posées
  (salleActive.positions || []).forEach(p => {
    const t = toiles.find(x => x.id === p.id);
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
        if (selectedToile) toast('Utilise "🔧 Arranger" pour placer les toiles', 'err');
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

function placerToile(col, row) {
  if (!selectedToile || !salleActive) return;
  const { w, h } = calcCases(selectedToile.dimensions);
  if (!canPlace(col, row, w, h, null)) { toast('Emplacement occupé', 'err'); return; }
  // Retire de TOUTES les salles (toiles + positions) avant de placer
  salles.forEach(s => {
    s.toiles = s.toiles.filter(id => id !== selectedToile.id);
    s.positions = (s.positions || []).filter(p => p.id !== selectedToile.id);
  });
  // Ajoute à la salle active
  salleActive.positions.push({ id: selectedToile.id, col, row, w, h });
  salleActive.toiles.push(selectedToile.id);
  buildOccupancy();
  afficherMur(); afficherStock();
  selectedToile = null;
  marquerChangement();
  toast('✓ ' + LBL.Item + ' ' + LBL.placee);
}

function retirerToile(toileId) {
  if (!salleActive) return;
  salleActive.positions = (salleActive.positions || []).filter(p => p.id !== toileId);
  peintureSurMurSel = null;
  buildOccupancy(); afficherMur(); afficherStock(); marquerChangement();
  toast(LBL.Item + ' ' + LBL.retiree);
}

function selectionnerPeintureMur(toileId) {
  peintureSurMurSel = peintureSurMurSel === toileId ? null : toileId;
  selectedToile = null;
  afficherMur(); afficherStock();
}

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
  buildOccupancy(); afficherMur(); marquerChangement();
}

// ═══════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════
function afficherStock() {
  const list = $('stock-list');
  list.innerHTML = '';
  // Met à jour le compteur
  const hdr = $('stock-hdr');
  if (hdr) hdr.textContent = 'Stock (' + toiles.length + ' ' + LBL.items + ')';
  if (!salleActive) return;

  const poseesDansCetteSalle = new Set((salleActive.positions || []).map(p => p.id));
  const poseesDansAutres = new Set(
    salles.filter(s => s.id !== salleActive.id)
          .flatMap(s => (s.positions || []).map(p => p.id))
  );

  // Tri : sur ce mur (0) → disponible (1) → autre salle (2)
  const grpOf = t => poseesDansCetteSalle.has(t.id) ? 0 : poseesDansAutres.has(t.id) ? 2 : 1;
  const toilesTri = [...toiles].sort((a, b) => grpOf(a) - grpOf(b));
  const labelsGrp = ['Sur ce mur', 'Disponibles', 'Autre salle'];
  let dernierGrp = -1;

  toilesTri.forEach(t => {
    const grp = grpOf(t);
    if (grp !== dernierGrp) {
      const sep = document.createElement('div');
      sep.style.cssText = 'font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:5px 3px 2px;flex-shrink:0;border-top:0.5px solid var(--brd);margin-top:2px;';
      if (dernierGrp === -1) sep.style.borderTop = 'none';
      sep.textContent = labelsGrp[grp];
      list.appendChild(sep);
      dernierGrp = grp;
    }

    const item = document.createElement('div');
    item.className = 'stock-item';
    if (poseesDansCetteSalle.has(t.id)) item.classList.add('pose');
    else if (poseesDansAutres.has(t.id)) item.classList.add('autre');
    if (toilesSelectionnees.has(t.id)) item.classList.add('coche');
    if (selectedToile && selectedToile.id === t.id) item.classList.add('sel');

    const simgDiv = document.createElement('div');
    simgDiv.className = 'simg';
    simgDiv.style.cssText = 'width:100%;height:72px;overflow:hidden;flex-shrink:0;display:block;';
    if (t.photo) {
      const img = document.createElement('img');
      img.alt = t.titre || ''; img.draggable = false; img.loading = 'lazy';
      img.onerror = function() { this.onerror=null; };
      img.src = t._preview || t.photo;
      simgDiv.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className = 'sph';
      ph.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);font-size:11px;color:var(--muted);';
      ph.textContent = t.glb ? '3D' : '?';
      simgDiv.appendChild(ph);
    }
    item.appendChild(simgDiv);

    const chk = document.createElement('div'); chk.className = 'check-ov'; chk.textContent = '✓';
    item.appendChild(chk);

    const nom = document.createElement('div'); nom.className = 'snom';
    nom.textContent = t.titre || '—'; item.appendChild(nom);

    // Badge taille en haut à droite
    if (t.taille || t.dimensions) {
      const badge = document.createElement('div'); badge.className = 'taille-badge';
      badge.textContent = t.taille || (t.dimensions ? `${t.dimensions.largeur}×${t.dimensions.hauteur}` : '');
      item.appendChild(badge);
    }

    item.dataset.toileId = t.id;
    if (toilesEnAttente.has(t.id)) {
      const elapsed = Math.floor((Date.now() - toilesEnAttente.get(t.id)) / 1000);
      const restant = Math.max(0, 60 - elapsed);
      const sb = document.createElement('div');
      sb.className = 'sync-badge'; sb.dataset.syncId = t.id;
      sb.textContent = restant > 0 ? `⏳ ${restant}s` : '✓ publié';
      item.appendChild(sb);
    }

    item.addEventListener('click', () => {
      if (toilesSelectionnees.has(t.id)) toilesSelectionnees.delete(t.id);
      else toilesSelectionnees.add(t.id);
      selectedToile = toilesSelectionnees.size === 1
        ? toiles.find(x => x.id === [...toilesSelectionnees][0]) : null;
      afficherStock();
      majBoutons();
    });
    item.addEventListener('dblclick', () => ouvrirFiche(t.id));
    list.appendChild(item);
  });
}

function majBtnPlacer() { /* bouton Placer supprimé — Arranger le mur le remplace */ }

function majBoutons() {
  const n = toilesSelectionnees.size;
  $('btn-modifier-toile').disabled  = (n !== 1);
  $('btn-supprimer-toile').disabled = (n !== 1);
}

function afficherConfirmAutreSalle(toile, nomAutre) {
  const ancien = document.getElementById('confirm-autre-salle');
  if (ancien) ancien.remove();
  const div = document.createElement('div');
  div.id = 'confirm-autre-salle';
  div.style.cssText = 'position:fixed;bottom:75px;left:50%;transform:translateX(-50%);z-index:400;background:var(--bg2);border:1.5px solid var(--gold);border-radius:14px;padding:.9rem 1rem;max-width:310px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,.6);';
  div.innerHTML = `<p style="font-size:13px;margin-bottom:.75rem;line-height:1.5;"><strong style="color:var(--gold);">"${toile.titre||'Sans titre'}"</strong> est dans <strong>${nomAutre}</strong>.<br>Que faire ?</p>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
      <button id="conf-ann" style="flex:1;padding:.5rem;border-radius:8px;border:0.5px solid var(--brd);background:transparent;color:var(--text);font-size:12px;cursor:pointer;">Annuler</button>
      <button id="conf-edit" style="flex:1;padding:.5rem;border-radius:8px;border:0.5px solid var(--gold);background:transparent;color:var(--gold);font-size:12px;cursor:pointer;">✏️ Modifier</button>
      <button id="conf-ok" style="flex:1;padding:.5rem;border-radius:8px;border:none;background:var(--gold);color:#111;font-size:12px;font-weight:600;cursor:pointer;">Retirer et placer ici</button>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('conf-ann').addEventListener('click', () => div.remove());
  document.getElementById('conf-edit').addEventListener('click', () => {
    div.remove();
    ouvrirFormulaireEdition(toile.id);
  });
  document.getElementById('conf-ok').addEventListener('click', () => {
    div.remove();
    toilesSelectionnees.add(toile.id);
    selectedToile = toile;
    afficherStock(); majBoutons();
    toast(`"${toile.titre||'—'}" prête — sera retirée de ${nomAutre} à la sauvegarde`);
  });
  setTimeout(() => {
    const fermer = e => { if (!div.contains(e.target)) { div.remove(); document.removeEventListener('click', fermer); } };
    document.addEventListener('click', fermer);
  }, 150);
}


// ═══════════════════════════════════════════════
// MODE PLACEMENT PLEIN ÉCRAN
// ═══════════════════════════════════════════════
let grilleVisiblePl = false;
let selectedToilePl = null; // toile sélectionnée dans le strip du mode placement
let _placementVue = 'pc'; // 'pc' ou 'gsm'

/* Retourne les positions actives selon le mode vue */
function _getPositions() {
  if (!salleActive) return [];
  if (_placementVue === 'gsm') {
    if (!salleActive.positions_mobile) salleActive.positions_mobile = [];
    return salleActive.positions_mobile;
  }
  return salleActive.positions || [];
}

/* Définit les positions actives selon le mode vue */
function _setPositions(pos) {
  if (!salleActive) return;
  if (_placementVue === 'gsm') salleActive.positions_mobile = pos;
  else salleActive.positions = pos;
}

/* DRAG-DROP GLOBAL — une seule paire de listeners */
let _dragStarted = false;
let _draggingPieceEl = null;
let _draggingPiece = null;
let _dragStartPos = { x: 0, y: 0 };
let _dragContainer = null;

function _startDragPiece(el, piecePos, mouseDownEvent, container) {
  _dragStarted = false; /* Reset flag pour click */
  _draggingPieceEl = el;
  _draggingPiece = piecePos;
  _dragStartPos = { x: mouseDownEvent.clientX, y: mouseDownEvent.clientY };
  _dragContainer = container;
  el.style.transition = 'none';
  el.style.zIndex = '10';
  document.addEventListener('mousemove', _onGlobalDragMove);
  document.addEventListener('mouseup', _onGlobalDragEnd);
}

function _onGlobalDragMove(e) {
  if (!_draggingPieceEl || !_draggingPiece) return;
  e.preventDefault(); /* Empêcher la sélection de texte/grille */
  _dragStarted = true; /* Marquer qu'il y a eu du mouvement */
  const rect = _dragContainer.getBoundingClientRect();
  const dx = ((e.clientX - _dragStartPos.x) / rect.width) * 100;
  const dy = -((e.clientY - _dragStartPos.y) / rect.height) * 100;
  const newX = Math.max(5, Math.min(95, parseFloat(_draggingPiece.x) + dx));
  const newY = Math.max(5, Math.min(95, parseFloat(_draggingPiece.y) + dy));
  _draggingPieceEl.style.left = newX + '%';
  _draggingPieceEl.style.bottom = newY + '%';
}

function _onGlobalDragEnd(e) {
  if (!_draggingPieceEl || !_draggingPiece) return;
  /* Appliquer les changements */
  const rect = _dragContainer.getBoundingClientRect();
  const dx = ((e.clientX - _dragStartPos.x) / rect.width) * 100;
  const dy = -((e.clientY - _dragStartPos.y) / rect.height) * 100;
  const newX = Math.max(5, Math.min(95, parseFloat(_draggingPiece.x) + dx));
  const newY = Math.max(5, Math.min(95, parseFloat(_draggingPiece.y) + dy));

  /* Anti-chevauchement : vérifier si la nouvelle position chevauche une autre pièce */
  const overlap = _isSculpt ? _checkOverlap(_draggingPiece.id, newX, newY) : false;

  _draggingPieceEl.style.transition = '';
  _draggingPieceEl.style.zIndex = '';
  document.removeEventListener('mousemove', _onGlobalDragMove);
  document.removeEventListener('mouseup', _onGlobalDragEnd);
  if (_dragStarted) {
    if (overlap) {
      /* Remettre à la position d'origine */
      _draggingPieceEl.style.left = _draggingPiece.x + '%';
      _draggingPieceEl.style.bottom = _draggingPiece.y + '%';
      toast('⚠ Chevauchement — position annulée', 'err');
    } else {
      _draggingPiece.x = newX;
      _draggingPiece.y = newY;
      marquerChangement();
      toast('✓ Pièce déplacée');
    }
  }
  _draggingPieceEl = null;
  _draggingPiece = null;
}

/* Vérifie si une pièce à (x,y) chevauche une autre pièce */
function _checkOverlap(pieceId, x, y) {
  if (!salleActive) return false;
  var _pos = _getPositions();
  const t1 = toiles.find(t => t.id === pieceId);
  const r1 = _pieceRadius(t1);
  for (const p of _pos) {
    if (p.id === pieceId) continue;
    const t2 = toiles.find(t => t.id === p.id);
    const r2 = _pieceRadius(t2);
    const dx = Math.abs(x - p.x);
    const dy = Math.abs(y - p.y);
    const minDist = r1 + r2;
    if (dx < minDist && dy < minDist * 0.7) return true;
  }
  return false;
}

/* Rayon d'une pièce en % du sol (basé sur le socle) */
function _pieceRadius(t) {
  if (!t) return 3;
  const socle = t.socle || t.dimensions?.largeur || 30;
  /* Approximation : 30cm socle ≈ 5% du sol */
  return Math.max(2, socle * 0.15);
}


function entrerModePlacement() {
  if (!salleActive) return;
  // Vérifier si des toiles sélectionnées viennent d'une autre salle
  const autresSelectionnees = [...toilesSelectionnees].filter(id => {
    const salle = salles.find(s => s.id !== salleActive.id && s.toiles.includes(id));
    return !!salle;
  });
  if (autresSelectionnees.length > 0) {
    const noms = autresSelectionnees.map(id => {
      const t = toiles.find(x => x.id === id);
      const s = salles.find(s => s.id !== salleActive.id && s.toiles.includes(id));
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
      // Retire les toiles de leur ancienne salle
      autresSelectionnees.forEach(id => {
        salles.forEach(s => {
          if (s.id !== salleActive.id) {
            s.toiles = s.toiles.filter(tid => tid !== id);
            s.positions = (s.positions||[]).filter(p => p.id !== id);
          }
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
  const nbPlacees = (salleActive.positions||[]).length;
  _placementVue = 'pc'; /* Toujours démarrer en mode PC */
  var btnSw = document.getElementById('btn-switch-vue');
  if (btnSw) { btnSw.textContent = '🖥 PC'; btnSw.style.background = ''; btnSw.style.color = ''; }
  $('overlay-placement').classList.add('ouvert');
  // Pousse un état pour intercepter le bouton retour Android
  history.pushState({ ff: 'arrangement' }, '');
  grilleVisiblePl = true;
  $('btn-grille-pl').style.color       = 'var(--gold)';
  $('btn-grille-pl').style.borderColor = 'var(--gold)';
  selectedToilePl = null;
  peintureSurMurSel = null;
  afficherMurPlacement();
  afficherStripPlacement();
  $('pl-aide').textContent = nbPlacees > 0
    ? 'Clique un' + (_isSculpt ? 'e pièce' : 'e toile') + ' du bas pour la placer ou la déplacer'
    : 'Sélectionne un' + (_isSculpt ? 'e pièce' : 'e toile') + ' en bas';
}



function autoPlacerTout() {
  if (!salleActive) return;
  const poseeIds = new Set((salleActive.positions||[]).map(p=>p.id));
  const aplacer = [...new Set([...poseeIds,...toilesSelectionnees])]
    .filter(id => !poseeIds.has(id))
    .map(id => toiles.find(x=>x.id===id)).filter(Boolean);

  if (aplacer.length === 0) { toast("Toutes les toiles sont déjà placées"); return; }

  let placees = 0, impossible = 0;
  for (const t of aplacer) {
    const {w,h} = calcCases(t.dimensions);
    let done = false;
    outer: for (let r=1; r<=ROWS-h+1; r++) {
      for (let col=1; col<=COLS-w+1; col++) {
        if (canPlace(col,r,w,h,null)) {
          salles.forEach(s => {
            s.toiles = s.toiles.filter(x=>x!==t.id);
            s.positions = (s.positions||[]).filter(p=>p.id!==t.id);
          });
          salleActive.positions.push({id:t.id,col,row:r,w,h});
          salleActive.toiles.push(t.id);
          for(let cc=col;cc<col+w;cc++) for(let rr=r;rr<r+h;rr++) occupancy[`${cc},${rr}`]=t.id;
          placees++; done=true; break outer;
        }
      }
    }
    if (!done) impossible++;
  }
  afficherMurPlacement(); afficherStripPlacement(); marquerChangement();
  toast(impossible>0
    ? `${placees} placée(s) — ${impossible} ne rentrent pas sur le mur`
    : `✓ ${placees} toile(s) placée(s)`);
}

function quitterModePlacement() {
  $('overlay-placement').classList.remove('ouvert');
  toilesSelectionnees.clear();
  selectedToilePl = null;
  selectedToile = null;
  peintureSurMurSel = null; // efface la sélection avant de revenir en vue normale
  salles.forEach(s => { s.toiles = (s.positions || []).map(p => p.id); });
  afficherPlan();
  toilesSelectionnees.clear(); afficherStock(); majBoutons();
  buildOccupancy(); afficherMur();
}

/* Met à jour le panneau de contrôle fixe selon la toile sélectionnée sur le mur */
function majCtrlPanel() {
  var panel = $("pl-ctrl-panel");
  var nomEl = $("pl-ctrl-nom");
  if (!panel) return;
  if (peintureSurMurSel === null) {
    panel.classList.remove("active");
    return;
  }
  var t = toiles.find(function(x){ return x.id === peintureSurMurSel; });
  panel.classList.add("active");
  if (nomEl) nomEl.textContent = t ? (t.titre || "Sans titre") : "—";
}

function afficherMurPlacement() {
  if (_isSculpt) return afficherSolPlacement();
  const bg = $('mur-placement');
  bg.className = 'placement-mur-bg'; /* Restaurer la classe grid pour peinture */
  bg.innerHTML = '';
  bg.style.background = couleurMurActuel;
  const texStr = TEXTURES[textureActuelle] || '';
  if (texStr) bg.style.background = `${texStr}, ${couleurMurActuel}`;
  bg.classList.toggle('grille-on', grilleVisiblePl);

  // Toiles déjà posées
  (salleActive.positions || []).forEach(p => {
    const t = toiles.find(x => x.id === p.id); if (!t) return;
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

function afficherStripPlacement() {
  const strip = $('pl-strip'); strip.innerHTML = '';
  const poseeIds = new Set((_isSculpt ? _getPositions() : (salleActive.positions||[])).map(p=>p.id));

  /* Sculpture : TOUTES les pièces de la salle (placées ou non dans le mode actif)
     Peinture : placées + sélectionnées + selectedToilePl */
  const tousIds = _isSculpt
    ? [...new Set([...(salleActive.toiles || []), ...poseeIds])]
    : [...new Set([...poseeIds, ...toilesSelectionnees, ...(selectedToilePl ? [selectedToilePl.id] : [])])];

  if (tousIds.length === 0) {
    strip.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:.5rem 1rem;align-self:center;">Aucun' + (_isSculpt ? 'e pièce' : 'e toile') + '</div>';
    return;
  }

  tousIds.forEach(id => {
    const t = toiles.find(x=>x.id===id); if(!t) return;
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
      ph.textContent = t.glb ? '3D' : '?';
      si.appendChild(ph);
    }

    // Grille W×H sur la miniature quand mode grille actif
    if (grilleVisiblePl) {
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
    const badge = document.createElement('div');
    badge.style.cssText = 'font-size:7px;padding:1px 3px;background:rgba(0,0,0,.5);color:#fff;';
    badge.textContent = estPlace ? '🔒 sur le mur' : '+ à placer';
    item.appendChild(badge);

    const n = document.createElement('div'); n.className='snom'; n.textContent=t.titre||'—'; item.appendChild(n);

    item.addEventListener('click', () => {
      if (estPlace) {
        // Sélection pour déplacer avec flèches
        peintureSurMurSel = peintureSurMurSel===id ? null : id;
        selectedToilePl = null; selectedToile = null;
        $('pl-aide').textContent = peintureSurMurSel
          ? `"${t.titre||'—'}" → utilise les flèches ou ✕ pour retirer`
          : 'Clique un' + (_isSculpt ? 'e pièce' : 'e toile') + ' pour la déplacer';
      } else {
        // Sélection pour placer
        selectedToilePl = selectedToilePl?.id===id ? null : t;
        selectedToile = selectedToilePl;
        peintureSurMurSel = null;
        $('pl-aide').textContent = selectedToilePl
          ? `"${t.titre||'—'}" → clique sur ${_isSculpt ? 'le sol' : 'le mur'} pour placer`
          : 'Sélectionne un' + (_isSculpt ? 'e pièce' : 'e toile') + ' à placer';
      }
      afficherMurPlacement(); afficherStripPlacement();
    });
    strip.appendChild(item);
  });
}

function placerToilePl(col, row) {
  if (!selectedToilePl || !salleActive) return;
  const {w,h} = calcCases(selectedToilePl.dimensions);
  if (!canPlace(col,row,w,h,null)) { toast('Emplacement occupé','err'); return; }
  // Retire de TOUTES les salles avant de placer
  salles.forEach(s => {
    s.toiles = s.toiles.filter(id => id !== selectedToilePl.id);
    s.positions = (s.positions || []).filter(p => p.id !== selectedToilePl.id);
  });
  salleActive.positions.push({id:selectedToilePl.id,col,row,w,h});
  salleActive.toiles.push(selectedToilePl.id);
  buildOccupancy();
  selectedToilePl = null; selectedToile = null;
  afficherMurPlacement(); afficherStripPlacement();
  marquerChangement(); toast('✓ Placée');
  $('pl-aide').textContent = LBL.Item + ' placée — continue ou clique 💾 Enregistrer';
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

function ouvrirFormulaireNouvel() {
  toileEnEdition = null; salleCibleToile = salleActive?.id || null; photoB64 = null; glbB64 = null; glbNom = null;
  $('modal-toile-tit').textContent = _isSculpt ? 'Nouvelle pièce' : 'Nouvelle toile';
  construireFavoris();
  viderFormToile();
  $('overlay-toile').classList.add('ouvert');
  var mb = $('overlay-toile').querySelector('.modal-body');
  if (mb) mb.scrollTop = 0;
}

function construirePillsSalle(salleSelId) {
  const pills = $('salle-pills'); if (!pills) return; pills.innerHTML = '';
  salles.forEach(s => {
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

function ouvrirFormulaireEdition(id) {
  const t = toiles.find(x => x.id === id);
  if (!t) return;
  toileEnEdition = id; photoB64 = null; glbB64 = null; glbNom = null;
  const salleDeLaToile = salles.find(s => s.toiles.includes(id))?.id || salleActive?.id || null;
  construirePillsSalle(salleDeLaToile);
  salleCibleToile = salleDeLaToile;
  $('modal-toile-tit').textContent = ADMIN_CFG.type === 'sculpture' ? 'Modifier la pièce' : 'Modifier la toile';
  construireFavoris();
  remplirFormToile(t);
  $('overlay-toile').classList.add('ouvert');
  var mb = $('overlay-toile').querySelector('.modal-body');
  if (mb) mb.scrollTop = 0;
}

function fermerModalToile() { $('overlay-toile').classList.remove('ouvert'); }

let ficheToileId = null;

function ouvrirFiche(id) {
  const t = toiles.find(x => x.id === id);
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
  const salle = salles.find(s => s.toiles.includes(id));
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
  salleCibleToile = salleActive?.id || null;
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
    prevImg.src = t.photo; prevImg.style.display = 'block';
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
  salleCibleToile = salles.find(s => s.toiles.includes(t.id))?.id || null;
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
  return result;
}

async function sauverToile() {
  const donnees = lireFormToile();
  const lbl = $('sauver-lbl'), btn = $('btn-sauver-toile'), btnAnn = $('btn-annuler-toile');
  btn.disabled = true; btnAnn.disabled = true; lbl.textContent = 'En cours…';
  try {
    if (toileEnEdition === null) {
      const id = prochainId();
      let photo = '';
      if (photoB64) photo = await uploaderPhoto(id, photoB64);
      let glb = donnees.glb || '';
      if (glbB64) { toast('Upload GLB…'); glb = await uploaderGLB(id, glbB64); }
      const t = { id, photo, source_photo: 'admin', ...donnees, glb };
      if (photoB64) t._preview = 'data:image/jpeg;base64,' + photoB64; // aperçu immédiat avant propagation CDN
      toiles.push(t);
      if (salleCibleToile) {
        const s = salles.find(x => x.id === salleCibleToile);
        if (s && !s.toiles.includes(id)) s.toiles.push(id);
      }
      const lbl2 = _isSculpt ? 'pièce' : 'toile';
      await sauvegarder(`[admin] Ajout ${lbl2} #${id}${donnees.titre ? ' — ' + donnees.titre : ''}`);
    } else {
      const idx = toiles.findIndex(x => x.id === toileEnEdition);
      let photo = toiles[idx].photo;
      if (photoB64) photo = await uploaderPhoto(toileEnEdition, photoB64);
      let glb = donnees.glb || toiles[idx].glb || '';
      if (glbB64) { toast('Upload GLB…'); glb = await uploaderGLB(toileEnEdition, glbB64); }
      // Protection dimensions : si les cases changent, retirer du mur
      const ancienDim = toiles[idx].dimensions;
      const nouvelDim = donnees.dimensions;
      if (ancienDim && nouvelDim) {
        const avant = calcCases(ancienDim);
        const apres = calcCases(nouvelDim);
        if (avant.w !== apres.w || avant.h !== apres.h) {
          let retiree = false;
          salles.forEach(s => {
            if ((s.positions||[]).some(p => p.id === toileEnEdition)) {
              s.positions = s.positions.filter(p => p.id !== toileEnEdition);
              retiree = true;
            }
          });
          if (retiree) toast("Dimensions modifiées — toile retirée du mur, à replacer via Arranger", "ok", 5000);
        }
      }
      // Déplace de salle si besoin
      if (salleCibleToile) {
        salles.forEach(s => { s.toiles = s.toiles.filter(id => id !== toileEnEdition); });
        const s = salles.find(x => x.id === salleCibleToile);
        if (s) s.toiles.push(toileEnEdition);
      }
      toiles[idx] = { ...toiles[idx], photo, glb, ...donnees };
      const lbl2 = _isSculpt ? 'pièce' : 'toile';
      await sauvegarder(`[admin] Modification ${lbl2} #${toileEnEdition}${donnees.titre ? ' — ' + donnees.titre : ''}`);
    }
    const idSauve = toileEnEdition === null
      ? toiles[toiles.length - 1].id
      : toileEnEdition;
    toilesEnAttente.set(idSauve, Date.now());
    demarrerTimerAttente();
    fermerModalToile();
    afficherPlan();
    if (salleActive) { buildOccupancy(); afficherMur(); afficherStock(); }
    toast("✓ Enregistré — site mis à jour dans ~1 min", "ok", 5000);
  } catch (e) { toast('Erreur : ' + e.message, 'err', 4000); }
  finally { btn.disabled = false; btnAnn.disabled = false; lbl.textContent = 'Enregistrer'; }
}

async function supprimerToile() {
  const idCible = toileEnEdition || selectedToile?.id;
  if (!idCible) return;
  const t = toiles.find(x => x.id === idCible);
  if (!confirm(`Supprimer "${t?.titre || ('cette ' + LBL.item)}" ? Réversible via le backup.`)) return;
  toiles = toiles.filter(x => x.id !== idCible);
  salles.forEach(s => {
    s.toiles = s.toiles.filter(id => id !== idCible);
    s.positions = (s.positions || []).filter(p => p.id !== idCible);
  });
  if (toileEnEdition) fermerModalToile();
  toilesSelectionnees.clear(); selectedToile = null; majBoutons();
  try {
    await sauvegarder(`[admin] Suppression toile #${idCible}${t?.titre ? ' — ' + t.titre : ''}`);
    afficherPlan();
    if (salleActive) { buildOccupancy(); afficherMur(); afficherStock(); }
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════
// MODAL SALLE
// ═══════════════════════════════════════════════
function ouvrirModalSalle() {
  $('inp-salle-nom').value = `Salle ${String.fromCharCode(65 + salles.length)}`;
  $('inp-salle-theme').value = '';
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
    await sauvegarder("Vider salle(s) : " + noms);
    toast("✓ " + ids.length + " salle" + (ids.length > 1 ? "s vidées" : " vidée"));
  } catch(e) {
    toast("Erreur lors de la sauvegarde", "err", 3000);
  }
}


async function creerSalle() {
  const nom = $('inp-salle-nom').value.trim() || `Salle ${salles.length + 1}`;
  const theme = $('inp-salle-theme').value.trim();
  const couleur = $('overlay-salle').querySelector('.sw.sel')?.dataset.val || '#2e2e2e';
  const posOpt = $('pos-grille').querySelector('.pos-opt.sel');
  const pos = posOpt ? parseInt(posOpt.dataset.pos) : salles.length;
  const newId = Math.max(...salles.map(s => s.id), 0) + 1;
  const salle = { id: newId, nom, theme, couleur_mur: couleur, couleur_cadres: '#3a3a3a', texture: 'none', visible: true, toiles: [], positions: [] };
  salles.splice(pos, 0, salle);
  fermerModalSalle();
  try {
    await sauvegarder(`[admin] Ajout salle "${nom}"`);
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
  /* Masquer l'aperçu normal pour éviter les doublons */
  $('mur-bg').innerHTML = '';
  const bg = $('mur-placement');
  bg.innerHTML = '';
  bg.className = '';

  const coulSol = couleurMurActuel || '#8a6228';
  const coulMur = '#7a7a7a'; /* Mur galerie sculpture */
  const texSol = textureActuelle || 'parquet';

  /* ── Structure galerie : mur + mur-inférieur + sol ── */
  const isGsm = _placementVue === 'gsm';
  bg.style.cssText = isGsm
    ? 'display:flex;flex-direction:column;height:100%;aspect-ratio:9/19;max-width:35%;margin:0 auto;border-radius:12px;overflow:hidden;border:2px solid var(--gold);box-shadow:0 4px 24px rgba(0,0,0,.3);'
    : 'display:flex;flex-direction:column;width:100%;height:100%;border-radius:6px;overflow:hidden;';

  /* MUR (fond gris de la galerie) */
  const murZone = document.createElement('div');
  murZone.style.cssText = 'flex:0 0 22%;background:' + coulMur + ';position:relative;z-index:1;';
  bg.appendChild(murZone);

  /* MUR INFÉRIEUR (bande sombre avec portes) */
  const murBas = document.createElement('div');
  murBas.style.cssText = 'flex:0 0 40px;background:#222;display:flex;align-items:center;justify-content:center;z-index:1;';
  const porteG = document.createElement('div');
  porteG.style.cssText = 'width:35px;height:28px;border-radius:35px 35px 0 0;background:#111;border:1px solid #333;border-bottom:none;';
  const porteD = porteG.cloneNode(true);
  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';
  murBas.appendChild(porteG);
  murBas.appendChild(spacer);
  murBas.appendChild(porteD);
  bg.appendChild(murBas);

  /* SOL (plancher avec perspective) */
  const sol = document.createElement('div');
  sol.id = 'sol-placement';
  sol.style.cssText = 'flex:1;position:relative;overflow:visible;cursor:crosshair;z-index:2;' +
    'background:' + (grilleVisiblePl ? coulSol : solPatternCSS(texSol, coulSol)) + ';';
  bg.appendChild(sol);

  /* Canvas perspective — dans un wrapper clipé */
  if (texSol === 'carrelage' || texSol === 'parquet') {
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;';
    canvasWrap.appendChild(canvas);
    sol.appendChild(canvasWrap);
    requestAnimationFrame(function() {
      const W = sol.clientWidth || 800, H = sol.clientHeight || 400;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const isPar = texSol === 'parquet';
      const lineC = 'rgba(0,0,0,' + (isPar ? '0.10' : '0.16') + ')';
      const vLineC = 'rgba(0,0,0,' + (isPar ? '0.05' : '0.16') + ')';
      const nbH = isPar ? 30 : 16, nbV = isPar ? 10 : 16;
      const vx = W / 2, vy = -H * 0.15;
      for (let i = 0; i <= nbH; i++) {
        const t = i / nbH, y = H * Math.pow(t, 2.2);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.strokeStyle = lineC; ctx.lineWidth = 0.3 + t * 1.5; ctx.stroke();
      }
      for (let i = -nbV; i <= nbV; i++) {
        const bx = vx + i * (W / (nbV * 0.8));
        ctx.beginPath(); ctx.moveTo(vx + i * (W * 0.02), 0); ctx.lineTo(bx, H);
        ctx.strokeStyle = vLineC; ctx.lineWidth = 0.5; ctx.stroke();
      }
    });
  }

  /* Grille 10×10 optionnelle */
  if (grilleVisiblePl) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;' +
      'background-image:' +
      'repeating-linear-gradient(to right,rgba(0,0,0,.25) 0,rgba(0,0,0,.25) 1px,transparent 1px,transparent 10%),' +
      'repeating-linear-gradient(to bottom,rgba(0,0,0,.25) 0,rgba(0,0,0,.25) 1px,transparent 1px,transparent 10%);';
    sol.appendChild(ov);
    const COLS = 'ABCDEFGHIJ';
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < 10; r++) {
        const lbl = document.createElement('div');
        lbl.style.cssText =
          'position:absolute;font-size:8px;font-family:monospace;color:rgba(0,0,0,.3);pointer-events:none;' +
          'left:' + (c * 10 + 5) + '%;bottom:' + (r * 10 + 5) + '%;transform:translate(-50%,50%);';
        lbl.textContent = COLS[c] + (r + 1);
        sol.appendChild(lbl);
      }
    }
  }

  /* ── Socles — même calcul que galerie-sculpture.js ── */
  const _ECH = window.innerWidth <= 600 ? 2.8 : 5.5;
  const _EMIN = window.innerWidth <= 600 ? 55 : 90;
  const _EMAXH = window.innerWidth <= 600 ? 200 : 380;

  const allPieces = _getPositions().map(p => {
    const t = toiles.find(x => x.id === p.id);
    if (!t) return null;
    const dim = t.dimensions || {};
    const hCm = dim.hauteur || 50;
    const lCm = dim.largeur || 30;
    const ratio = hCm / lCm;
    const pCm = dim.profondeur || Math.round(lCm * 0.5);
    const socleDiam = t.socle || pCm;
    const photoH = Math.min(_EMAXH, Math.max(_EMIN, Math.round(hCm * _ECH * (ratio < 1 ? ratio : 1))));
    const effScale = photoH / hCm;
    const socleW = Math.max(_EMIN, Math.round(socleDiam * effScale));
    const pedH = Math.max(20, Math.round(socleW * 0.5));
    return { pos: p, t, socleW, photoH, pedH };
  }).filter(Boolean);

  allPieces.slice().sort((a, b) => b.pos.y - a.pos.y).forEach(({ pos: p, t, socleW, photoH, pedH }) => {
    const estSel = peintureSurMurSel === p.id;
    const perspFactor = 1 - (p.y / 100) * 0.42;
    const zIdx = Math.round((100 - p.y) * 10) + 5;

    const wrap = document.createElement('div');
    wrap.dataset.pieceId = p.id;
    wrap.style.cssText =
      'position:absolute;left:' + p.x + '%;bottom:' + p.y + '%;' +
      'transform:translateX(-50%) scale(' + perspFactor.toFixed(3) + ');transform-origin:bottom center;' +
      'z-index:' + zIdx + ';display:flex;flex-direction:column;align-items:center;cursor:pointer;';
    if (estSel) wrap.style.outline = '2px solid var(--gold)';

    /* Image ou model-viewer 3D */
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'width:' + socleW + 'px;height:' + photoH + 'px;display:flex;align-items:flex-end;justify-content:center;';

    if (t.glb) {
      /* Model-viewer 3D statique (pas de rotation/zoom utilisateur) */
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', (ADMIN_CFG.repoPath ? '../../' : '') + t.glb + '?v=' + Date.now());
      mv.setAttribute('interaction-prompt', 'none');
      mv.setAttribute('disable-zoom', '');
      mv.style.cssText = 'width:' + socleW + 'px;height:' + photoH + 'px;pointer-events:none;--poster-color:transparent;';
      imgWrap.appendChild(mv);
      /* Charger model-viewer si pas déjà fait */
      if (typeof loadModelViewerAdmin === 'function') loadModelViewerAdmin();
    } else if (t.photo || t._preview) {
      const img = document.createElement('img');
      img.src = t._preview || t.photo; img.alt = ''; img.draggable = false;
      img.style.cssText = 'max-width:' + socleW + 'px;max-height:' + photoH + 'px;object-fit:contain;';
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = 'width:' + Math.round(socleW * 0.7) + 'px;height:' + Math.round(photoH * 0.8) + 'px;background:rgba(255,255,255,.25);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.6);';
      ph.textContent = '?';
      imgWrap.appendChild(ph);
    }
    wrap.appendChild(imgWrap);

    /* Piédestal */
    const ped = document.createElement('div');
    ped.style.cssText =
      'width:' + socleW + 'px;height:' + pedH + 'px;border-radius:5px;' +
      'background:linear-gradient(to right,rgba(0,0,0,.15),rgba(255,255,255,.08) 45%,rgba(255,255,255,.12) 55%,rgba(0,0,0,.12));' +
      'background-color:#eae6de;position:relative;';
    const topEl = document.createElement('div');
    topEl.style.cssText =
      'position:absolute;top:-' + Math.max(3, Math.round(pedH * 0.14)) + 'px;left:-15%;width:130%;height:' + Math.max(5, Math.round(pedH * 0.25)) + 'px;' +
      'background:radial-gradient(ellipse at 42% 40%,#f8f6f2,#d8d2c8);border-radius:50%;';
    ped.appendChild(topEl);
    wrap.appendChild(ped);

    /* Ombre */
    const ombre = document.createElement('div');
    ombre.style.cssText =
      'width:' + Math.round(socleW * 1.3) + 'px;height:' + Math.max(4, Math.round(socleW * 0.1)) + 'px;background:rgba(0,0,0,.25);border-radius:50%;filter:blur(3px);margin-top:1px;';
    wrap.appendChild(ombre);

    /* Titre */
    const lbl = document.createElement('div');
    lbl.style.cssText =
      'font-size:' + Math.max(7, Math.round(socleW * 0.16)) + 'px;color:#fff;white-space:nowrap;max-width:' + Math.round(socleW * 1.5) + 'px;overflow:hidden;' +
      'text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.6);margin-top:2px;';
    lbl.textContent = t.titre || '—';
    wrap.appendChild(lbl);

    /* Drag-drop */
    wrap.addEventListener('mousedown', e => {
      e.stopPropagation();
      peintureSurMurSel = p.id;
      _startDragPiece(wrap, p, e, sol);
      afficherStripPlacement();
    });
    wrap.addEventListener('click', e => {
      e.stopPropagation();
      if (!_dragStarted) {
        peintureSurMurSel = peintureSurMurSel === p.id ? null : p.id;
        afficherSolPlacement(); afficherStripPlacement();
        $('pl-aide').textContent = peintureSurMurSel
          ? '"' + (t.titre||'—') + '" → glisser pour déplacer ou ✕ retirer'
          : 'Clique une pièce du bas pour la placer';
        majCtrlPanel();
      }
    });
    sol.appendChild(wrap);
  });

  majCtrlPanel();

  /* Clic/touch sur le sol → placer */
  let _solTouched = false;
  sol.addEventListener('touchend', function(e) {
    if (!selectedToilePl || e.target !== sol) return;
    e.preventDefault();
    _solTouched = true;
    const touch = e.changedTouches[0];
    const rect = sol.getBoundingClientRect();
    const x = Math.round((touch.clientX - rect.left) / rect.width * 100);
    const y = Math.round((1 - (touch.clientY - rect.top) / rect.height) * 100);
    placerPieceSol(Math.max(5, Math.min(95, x)), Math.max(5, Math.min(95, y)));
  });
  sol.addEventListener('click', function(e) {
    if (_solTouched) { _solTouched = false; return; }
    if (!selectedToilePl) return;
    const rect = sol.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 100);
    const y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
    placerPieceSol(Math.max(5, Math.min(95, x)), Math.max(5, Math.min(95, y)));
  });

  /* ── Mini aperçu de l'autre mode (non-interactif) ── */
  _renderMiniPreview(bg);
}

function _renderMiniPreview(mainBg) {
  /* Nettoyer l'ancien */
  var old = document.getElementById('mini-preview-autre');
  if (old) old.remove();

  if (!_isSculpt || !salleActive) return;
  const isGsm = _placementVue === 'gsm';
  const otherPos = isGsm ? (salleActive.positions || []) : (salleActive.positions_mobile || []);
  if (!otherPos.length) return;

  const coulSol = couleurMurActuel || '#8a6228';
  const texSol = textureActuelle || 'parquet';

  /* Conteneur mini */
  const mini = document.createElement('div');
  mini.id = 'mini-preview-autre';
  mini.style.cssText = isGsm
    ? 'position:absolute;right:8px;top:8px;width:180px;height:100px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.3);opacity:.7;pointer-events:none;z-index:50;'
    : 'position:absolute;right:8px;top:8px;width:60px;height:120px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.3);opacity:.7;pointer-events:none;z-index:50;';

  /* Label */
  const lbl = document.createElement('div');
  lbl.style.cssText = 'position:absolute;top:2px;left:0;right:0;text-align:center;font-size:7px;color:#fff;z-index:2;text-shadow:0 1px 2px #000;letter-spacing:.08em;';
  lbl.textContent = isGsm ? '🖥 PC' : '📱 GSM';
  mini.appendChild(lbl);

  /* Mur + sol */
  mini.innerHTML += '<div style="height:22%;background:#7a7a7a;"></div><div style="height:5%;background:#222;"></div>';
  const solMini = document.createElement('div');
  solMini.style.cssText = 'height:73%;position:relative;background:' + solPatternCSS(texSol, coulSol) + ';';
  mini.appendChild(solMini);

  /* Pièces en miniature */
  otherPos.forEach(p => {
    const t = toiles.find(x => x.id === p.id); if (!t) return;
    const scale = 1 - (p.y / 100) * 0.42;
    const dot = document.createElement('div');
    dot.style.cssText =
      'position:absolute;left:' + p.x + '%;bottom:' + p.y + '%;' +
      'transform:translateX(-50%) scale(' + (scale * 0.8).toFixed(2) + ');transform-origin:bottom center;' +
      'width:8px;height:8px;background:#eae6de;border-radius:2px;border:1px solid rgba(0,0,0,.2);';
    solMini.appendChild(dot);
  });

  mainBg.parentNode.style.position = 'relative';
  mainBg.parentNode.appendChild(mini);
}

function placerPieceSol(x, y) {
  if (!selectedToilePl || !salleActive) return;
  const piece = selectedToilePl;

  /* Anti-chevauchement */
  if (_checkOverlap(piece.id, x, y)) {
    toast('⚠ Chevauchement — choisis un autre endroit', 'err');
    return;
  }

  const gab = _gabaritSculpt(piece.dimensions?.hauteur);

  /* Retirer des positions du mode actif (si déjà placée) */
  var pos = _getPositions();
  var idx = pos.findIndex(p => p.id === piece.id);
  if (idx >= 0) pos.splice(idx, 1);

  /* Placer dans le mode actif */
  pos.push({ id: piece.id, x, y, gabarit: gab });

  selectedToilePl = null; selectedToile = null;
  afficherSolPlacement(); afficherStripPlacement();
  marquerChangement();
  toast('✓ Pièce placée en ' + x + ',' + y);
  $('pl-aide').textContent = 'Pièce placée — continue ou clique 💾 Enregistrer';
}

function deplacerPieceSol(dx, dy) {
  if (peintureSurMurSel === null) return;
  const pos = _getPositions().find(p => p.id === peintureSurMurSel);
  if (!pos) return;
  pos.x = Math.max(5, Math.min(95, (pos.x || 50) + dx));
  pos.y = Math.max(5, Math.min(95, (pos.y || 50) - dy)); /* -dy : Up=+y, Down=-y */
  afficherSolPlacement();
  marquerChangement();
}

/* Gabarit auto depuis hauteur (dupliqué de galerie-sculpture.js) */
function _gabaritSculpt(h) {
  if (!h)      return 'M';
  if (h <= 25) return 'S';
  if (h <= 50) return 'M';
  if (h <= 100) return 'L';
  return 'SOL';
}
