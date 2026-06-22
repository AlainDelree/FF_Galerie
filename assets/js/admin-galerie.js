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

  /* ── SCULPTURE : aperçu via iframes read-only (vrai moteur de rendu) ── */
  if (_isSculpt) {
    bg.className = '';
    bg.style.cssText = '';
    bg.innerHTML = '';

    /* Nettoyer un éventuel ancien row-wrap */
    var oldRow = document.getElementById('mur-row-wrap');
    if (oldRow) { oldRow.parentNode.insertBefore(bg, oldRow); oldRow.remove(); }

    var apercuPath = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'galerie-apercu.html';

    /* Données admin en mémoire à injecter dans les iframes */
    var injectData = {
      type: 'init-data',
      toiles: ADMIN_CFG.type === 'sculpture'
        ? { next_id: nextId, gabarits: tailles, pieces: toiles }
        : { next_id: nextId, tailles: tailles, toiles: toiles },
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
  const list = $('stock-list');
  list.innerHTML = '';
  // Met à jour le compteur
  const hdr = $('stock-hdr');
  const hdrSpan = hdr ? hdr.querySelector('span') : null;
  if (hdrSpan) hdrSpan.textContent = 'Stock (' + toiles.length + ' ' + LBL.items + ')';
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

    // Badge taille en haut à droite (peinture uniquement — pas de sens pour sculpture)
    if (!_isSculpt && (t.taille || t.dimensions)) {
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
    /* dblclick uniquement sur device souris (PC). Sur GSM, le tap rapide
       sur plusieurs toiles déclenchait par erreur la modal de détails.
       Sur GSM, la fiche est accessible via le bouton 👁 dans le mode Arranger. */
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      item.addEventListener('dblclick', () => ouvrirFiche(t.id));
    }
    list.appendChild(item);
  });
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
  /* Snapshot — restauré si retour sans sauvegarder */
  _arrangerSnapshot = {
    positions:        JSON.parse(JSON.stringify(salleActive.positions        || [])),
    positions_mobile: JSON.parse(JSON.stringify(salleActive.positions_mobile || [])),
    toiles:           JSON.parse(JSON.stringify(salleActive.toiles           || [])),
    /* Supports des pièces (vivent dans toiles[], hors salle) */
    supports:         toiles.map(function(t) {
      return { id: t.id, support: t.support ? JSON.parse(JSON.stringify(t.support)) : null, sans_socle: t.sans_socle || false };
    })
  };
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
  afficherMurPlacement(); afficherStripPlacement();
  toast(impossible>0
    ? `${placees} placée(s) — ${impossible} ne rentrent pas sur le mur`
    : `✓ ${placees} toile(s) placée(s)`);
}

/* Compare l'état actuel au snapshot (= dernier état enregistré).
   Retourne true s'il y a des modifications non sauvegardées. */
function _arrangerADesModifs() {
  if (!_arrangerSnapshot || !salleActive) return false;
  var j = function(o) { return JSON.stringify(o || []); };
  if (j(salleActive.positions)        !== j(_arrangerSnapshot.positions))        return true;
  if (j(salleActive.positions_mobile) !== j(_arrangerSnapshot.positions_mobile)) return true;
  if (j(salleActive.toiles)           !== j(_arrangerSnapshot.toiles))           return true;
  /* Supports */
  if (_arrangerSnapshot.supports) {
    for (var i = 0; i < _arrangerSnapshot.supports.length; i++) {
      var snap = _arrangerSnapshot.supports[i];
      var t = toiles.find(function(x) { return x.id === snap.id; });
      if (!t) continue;
      if (JSON.stringify(t.support || null) !== JSON.stringify(snap.support)) return true;
      if ((t.sans_socle || false) !== snap.sans_socle) return true;
    }
  }
  return false;
}

function quitterModePlacement() {
  $('overlay-placement').classList.remove('ouvert');
  /* Restaurer l'état avant ouverture si pas sauvegardé */
  if (_arrangerSnapshot && salleActive) {
    salleActive.positions        = _arrangerSnapshot.positions;
    salleActive.positions_mobile = _arrangerSnapshot.positions_mobile;
    salleActive.toiles           = _arrangerSnapshot.toiles;
    /* Restaurer les supports des pièces */
    if (_arrangerSnapshot.supports) {
      _arrangerSnapshot.supports.forEach(function(snap) {
        var t = toiles.find(function(x) { return x.id === snap.id; });
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
     Sculpture et peinture : placées + sélectionnées dans le stock */
  const tousIds = [...new Set([...poseeIds, ...toilesSelectionnees, ...(selectedToilePl ? [selectedToilePl.id] : [])])];

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

    // Grille W×H sur la miniature quand mode grille actif (peinture uniquement)
    if (grilleVisiblePl && !_isSculpt) {
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
    badge.textContent = estPlace ? (_isSculpt ? '🔒 sur le sol' : '🔒 sur le mur') : '+ à placer';
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
      /* Sculpture : ne PAS recréer l'iframe (flash + pièces perdues).
         Peinture : afficherMurPlacement met à jour les cases occupées. */
      if (!_isSculpt) afficherMurPlacement();
      afficherStripPlacement();
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
  toast('✓ Placée');
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
      await sauvegarder(`[admin] Ajout ${lbl2} #${id}${donnees.titre ? ' — ' + donnees.titre : ''}`, '✓ ' + lbl2.charAt(0).toUpperCase() + lbl2.slice(1) + ' ajouté·e');
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
      /* sans_socle : retirer la clé si décochée (lireFormToile ne la met que si true) */
      if (!donnees.sans_socle) delete toiles[idx].sans_socle;
      const lbl2 = _isSculpt ? 'pièce' : 'toile';
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
    await sauvegarder(`[admin] Suppression toile #${idCible}${t?.titre ? ' — ' + t.titre : ''}`, '✓ Supprimé');
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
    await sauvegarder("Vider salle(s) : " + noms, null);
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
    await sauvegarder(`[admin] Ajout salle "${nom}"`, '✓ Salle ajoutée');
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

  /* Remplir tout l'espace disponible */
  var zoneRect = container.parentElement.getBoundingClientRect();
  var availH = zoneRect.height - 30; /* marge pour pl-aide */
  container.style.cssText = isGsm
    ? 'display:flex;align-items:center;justify-content:center;height:' + availH + 'px;'
    : 'height:' + availH + 'px;';

  /* Wrapper iframe */
  const iframeWrap = document.createElement('div');
  iframeWrap.style.cssText = isGsm
    ? 'height:100%;aspect-ratio:9/19;border-radius:12px;overflow:hidden;border:2px solid var(--gold);box-shadow:0 4px 24px rgba(0,0,0,.3);position:relative;'
    : 'width:100%;height:100%;border-radius:6px;overflow:hidden;position:relative;';

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
  iframe.src = galeriePath + '?v=' + Date.now();
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  iframeWrap.appendChild(iframe);
  container.appendChild(iframeWrap);

  /* Écouter les messages de l'iframe */
  function onMessage(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'iframe-awaiting-data') {
      /* L'iframe attend les données — envoyer l'état admin en mémoire (toujours frais).
         Évite que l'iframe lise un salles.json périmé via le CDN. */
      var iframe = document.getElementById('edit-galerie-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'init-data',
          toiles: ADMIN_CFG.type === 'sculpture'
            ? { next_id: nextId, gabarits: tailles, pieces: toiles }
            : { next_id: nextId, tailles: tailles, toiles: toiles },
          salles: { salles: JSON.parse(JSON.stringify(salles)) }
        }, '*');
      }
    }

    if (e.data.type === 'edit-ready') {
      /* Galerie prête */
    }

    if (e.data.type === 'positions-updated') {
      /* Mettre à jour les positions dans les données admin */
      if (isGsm) {
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

  /* Retirer si déjà placée dans ce mode */
  var idx = pos.findIndex(function(p) { return p.id === piece.id; });
  if (idx >= 0) pos.splice(idx, 1);

  pos.push({ id: piece.id, x: x, y: y, gabarit: gab });

  /* Assigner à la salle si pas encore dedans */
  if (!salleActive.toiles) salleActive.toiles = [];
  if (!salleActive.toiles.includes(piece.id)) salleActive.toiles.push(piece.id);

  /* Rafraîchir l'iframe — passer les positions mises à jour pour éviter re-fetch */
  var iframe = document.getElementById('edit-galerie-iframe');
  if (iframe) iframe.contentWindow.postMessage({
    type: 'refresh',
    injectPositions: [{ id: piece.id, x: x, y: y, gabarit: gab }]
  }, '*');

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

function _supportDefaut() {
  return { type: 'socle', couleur: '#eae6de', texture: 'marbre', taille: 40 };
}

function ouvrirPanneauSupport(pieceId) {
  var piece = toiles.find(function(t) { return t.id === pieceId; });
  if (!piece) return;
  _supportPieceId = pieceId;

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

  /* Brancher les contrôles une seule fois */
  if (!panel.dataset.bound) {
    panel.dataset.bound = '1';
    document.getElementById('support-close').addEventListener('click', function() {
      fermerPanneauSupport();
    });
    /* Type */
    document.querySelectorAll('.support-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = toiles.find(function(t) { return t.id === _supportPieceId; });
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
        var p = toiles.find(function(t) { return t.id === _supportPieceId; });
        if (!p || !p.support || p.support.type === 'aucun') return;
        p.support.texture = btn.dataset.tex;
        _supportSyncUI();
        _supportAppliquer();
      });
    });
    /* Couleur → picker HSV */
    document.getElementById('support-couleur-btn').addEventListener('click', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId; });
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
      var p = toiles.find(function(t) { return t.id === _supportPieceId; });
      if (!p || !p.support || p.support.type === 'aucun') return;
      p.support.taille = parseInt(this.value);
      document.getElementById('support-taille-val').textContent = this.value + ' cm';
    });
    document.getElementById('support-taille').addEventListener('change', function() {
      _supportAppliquer();
    });
    /* Hauteur */
    document.getElementById('support-hauteur').addEventListener('input', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId; });
      if (!p || !p.support || p.support.type === 'aucun') return;
      p.support.hauteur = parseInt(this.value);
      document.getElementById('support-hauteur-val').textContent = this.value + ' cm';
    });
    document.getElementById('support-hauteur').addEventListener('change', function() {
      _supportAppliquer();
    });
    /* Bouton Auto → supprime la hauteur explicite (retour calcul auto) */
    document.getElementById('support-hauteur-auto').addEventListener('click', function() {
      var p = toiles.find(function(t) { return t.id === _supportPieceId; });
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
  _supportPieceId = null;
}

/* Reflète l'état de piece.support dans l'UI du panneau */
function _supportSyncUI() {
  var p = toiles.find(function(t) { return t.id === _supportPieceId; });
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
}

/* Pousse le changement vers l'iframe (re-render de la pièce) + persiste en mémoire */
function _supportAppliquer() {
  var iframe = document.getElementById('edit-galerie-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'support-updated',
      pieceId: _supportPieceId,
      piece: JSON.parse(JSON.stringify(toiles.find(function(t) { return t.id === _supportPieceId; })))
    }, '*');
  }
}
