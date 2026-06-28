/* ===========================================================================
   FF_Galerie — Éditeur LOCAL de galerie (hors ligne, non publié)
   ---------------------------------------------------------------------------
   But : permettre à l'artiste de réarranger SA galerie directement dans
   l'app (ou sur le site), SANS jamais rien repousser en ligne.

   Principes :
   - Les modifications sont stockées dans localStorage ('ff_local_layout'),
     totalement séparées du snapshot en cache. Cet éditeur n'a AUCUN accès à
     GitHub : il est structurellement impossible qu'une modif parte en prod.
   - Au chargement, galerie-core appelle window._FF_APPLY_LOCAL_LAYOUT(salles)
     qui fusionne la surcouche par-dessus salles.json (et mémorise la base).
   - Le bouton ⟳ (pwa-register) purge la surcouche : retour à la version prod
     fraîchement téléchargée.

   v1 : repositionnement sur la grille 12×8 + masquer / réafficher une toile.
   (Couleurs / murs / textures : phase ultérieure — boutons grisés à venir.)

   Déclencheur : appui long (~1,1 s) sur la signature « FF » du pied de page.
   =========================================================================== */
(function () {
  'use strict';

  var CLE_STORE = 'ff_local_layout';
  var CLE_MODE  = 'ff_edit_mode';       // sessionStorage : ré-entrer après reload
  var GALERIE   = (window.GALERIE_LOCAL_ID || 'peinture'); // future multi-artistes
  var COLS = 12, ROWS = 8;
  var SEUIL_DRAG = 6;                    // px avant qu'un appui devienne un glisser

  /* ===================== STORE (surcouche locale) ========================= */
  function lireStore() {
    try {
      var brut = localStorage.getItem(CLE_STORE);
      if (!brut) return null;
      var d = JSON.parse(brut);
      if (!d || d.galerie !== GALERIE) return null;   // surcouche d'une autre galerie → ignorée
      return d;
    } catch (e) { return null; }
  }
  function ecrireStore(d) {
    try { localStorage.setItem(CLE_STORE, JSON.stringify(d)); } catch (e) {}
  }
  function storeSalles() {
    var d = lireStore();
    if (!d) { d = { v: 1, galerie: GALERIE, salles: {} }; }
    if (!d.salles) d.salles = {};
    return d;
  }
  function basePositions(salleId) {
    var base = window._FF_BASE_SALLES || [];
    for (var i = 0; i < base.length; i++) {
      if (base[i].id === salleId) return (base[i].positions || []);
    }
    return [];
  }
  function memesPositions(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var norm = function (p) { return p.id + ':' + p.col + ':' + p.row + ':' + p.w + ':' + p.h; };
    var sa = a.map(norm).sort().join('|');
    var sb = b.map(norm).sort().join('|');
    return sa === sb;
  }

  /* ===================== HOOK appelé par galerie-core ====================== */
  /* Doit être défini AVANT initGalerie() (script placé avant l'appel). */
  window._FF_APPLY_LOCAL_LAYOUT = function (salles) {
    try { window._FF_BASE_SALLES = JSON.parse(JSON.stringify(salles)); } catch (e) {}
    var d = lireStore();
    if (!d || !d.salles) return;
    salles.forEach(function (s) {
      var o = d.salles[String(s.id)];
      if (o && Array.isArray(o.positions)) s.positions = o.positions;
    });
  };

  /* ===================== Outils DOM ======================================= */
  function salleActiveEl() {
    var salles = document.querySelectorAll('.salle');
    var best = null, bestDist = Infinity;
    salles.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.width <= 0) return;
      var d = Math.abs(r.left);
      if (d < bestDist) { bestDist = d; best = s; }
    });
    return best;
  }
  function salleIdDe(el) {
    var m = (el && el.id || '').match(/salle(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  function murDe(salleEl) { return salleEl ? salleEl.querySelector('.mur-grille') : null; }
  function tuilesDe(murEl) {
    return murEl ? Array.prototype.slice.call(murEl.querySelectorAll('.tableau-grille')) : [];
  }
  function lirePos(t) {
    var gc = (t.style.gridColumn || '').match(/(\d+)\s*\/\s*span\s*(\d+)/);
    var gr = (t.style.gridRow || '').match(/(\d+)\s*\/\s*span\s*(\d+)/);
    return {
      id:  parseInt(t.dataset.id, 10),
      col: gc ? +gc[1] : 1, w: gc ? +gc[2] : 1,
      row: gr ? +gr[1] : 1, h: gr ? +gr[2] : 1
    };
  }
  function ecrirePos(t, p) {
    t.style.gridColumn = p.col + ' / span ' + p.w;
    t.style.gridRow    = p.row + ' / span ' + p.h;
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* Sauvegarde l'état courant d'une salle dans la surcouche. */
  function sauverSalle(salleEl) {
    var sid = salleIdDe(salleEl);
    var mur = murDe(salleEl);
    if (sid == null || !mur) return;
    var visibles = tuilesDe(mur).filter(function (t) { return !t.classList.contains('ff-hidden'); });
    var positions = visibles.map(lirePos).filter(function (p) { return !isNaN(p.id); });

    var d = storeSalles();
    if (memesPositions(positions, basePositions(sid))) {
      delete d.salles[String(sid)];                 // identique à la base → pas de surcouche
    } else {
      d.salles[String(sid)] = { positions: positions };
    }
    ecrireStore(d);
    majBadgeMasquees();
  }

  /* ===================== Carte des toiles (titres) ======================== */
  /* Pour la liste « masquées » : id → {titre, photo}. Source = peinture.json
     (déjà en cache → marche hors ligne). Best-effort. */
  var _toilesMap = null;
  function chargerToilesMap() {
    if (_toilesMap) return Promise.resolve(_toilesMap);
    var path = (window.GALERIE_TOILES_PATH || 'data/oeuvres/peinture.json');
    return fetch(path).then(function (r) { return r.json(); }).then(function (data) {
      _toilesMap = {};
      (data.toiles || []).forEach(function (t) { _toilesMap[t.id] = t; });
      return _toilesMap;
    }).catch(function () { _toilesMap = {}; return _toilesMap; });
  }
  function titreToile(id) {
    var t = _toilesMap && _toilesMap[id];
    return (t && t.titre) ? t.titre : ('Toile #' + id);
  }
  function photoToile(id) {
    var t = _toilesMap && _toilesMap[id];
    return t && t.photo ? t.photo : null;
  }

  /* Liste des toiles masquées d'une salle : présentes en base mais absentes
     des positions courantes (visibles). */
  function idsMasquees(salleEl) {
    var sid = salleIdDe(salleEl);
    var mur = murDe(salleEl);
    if (sid == null || !mur) return [];
    var visibles = {};
    tuilesDe(mur).forEach(function (t) {
      if (!t.classList.contains('ff-hidden')) visibles[lirePos(t).id] = true;
    });
    var base = window._FF_BASE_SALLES || [];
    var salleBase = null;
    for (var i = 0; i < base.length; i++) if (base[i].id === sid) { salleBase = base[i]; break; }
    /* Référence = toiles affichées en prod (positions de base). Une toile est
       « masquée » seulement si elle figurait dans la base mais n'est plus visible.
       (Ajouter une toile non placée = hors périmètre v1.) */
    var tousIds = (salleBase && salleBase.positions)
      ? salleBase.positions.map(function (p) { return p.id; }) : [];
    return tousIds.filter(function (id) { return !visibles[id]; });
  }

  /* ===================== État édition ===================================== */
  var enEdition = false;
  var tuileSelect = null;

  /* --- Drag ---------------------------------------------------------------- */
  var drag = null;   // { tuile, mur, startX, startY, moved, cellW, cellH, origRect }

  function onPointerDown(e) {
    if (!enEdition) return;
    var t = e.target.closest && e.target.closest('.tableau-grille');
    if (!t) return;
    var mur = t.closest('.mur-grille');
    if (!mur) return;
    e.preventDefault();
    var rMur = mur.getBoundingClientRect();
    drag = {
      tuile: t, mur: mur,
      startX: e.clientX, startY: e.clientY, moved: false,
      cellW: rMur.width / COLS, cellH: rMur.height / ROWS,
      rMur: rMur, pointerId: e.pointerId
    };
    try { t.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onPointerMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > SEUIL_DRAG) {
      drag.moved = true;
      drag.tuile.classList.add('ff-dragging');
    }
    if (drag.moved) {
      drag.tuile.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
  }
  function onPointerUp(e) {
    if (!drag) return;
    var t = drag.tuile;
    try { t.releasePointerCapture(drag.pointerId); } catch (_) {}

    if (drag.moved) {
      var p = lirePos(t);
      var rTile = t.getBoundingClientRect();      // inclut le translate courant
      var colIdx = Math.round((rTile.left - drag.rMur.left) / drag.cellW);
      var rowIdx = Math.round((rTile.top  - drag.rMur.top)  / drag.cellH);
      p.col = clamp(colIdx, 0, COLS - p.w) + 1;
      p.row = clamp(rowIdx, 0, ROWS - p.h) + 1;
      t.style.transform = '';
      t.classList.remove('ff-dragging');
      ecrirePos(t, p);
      sauverSalle(t.closest('.salle'));
    } else {
      selectionner(t);                             // simple tap → sélection
    }
    drag = null;
  }

  /* --- Sélection / masquer ------------------------------------------------- */
  function deselectionner() {
    if (tuileSelect) tuileSelect.classList.remove('ff-selected');
    tuileSelect = null;
    var b = document.getElementById('ff-masquer-flottant');
    if (b) b.remove();
  }
  function selectionner(t) {
    if (tuileSelect === t) { deselectionner(); return; }
    deselectionner();
    tuileSelect = t;
    t.classList.add('ff-selected');
    var btn = document.createElement('button');
    btn.id = 'ff-masquer-flottant';
    btn.type = 'button';
    btn.className = 'ff-mini-action';
    btn.textContent = '✕ Masquer';
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      masquer(t);
    });
    var r = t.getBoundingClientRect();
    btn.style.left = (r.left + r.width / 2) + 'px';
    btn.style.top  = (r.top + 6) + 'px';
    document.body.appendChild(btn);
  }
  function masquer(t) {
    var salleEl = t.closest('.salle');
    var mur = murDe(salleEl);
    var visibles = tuilesDe(mur).filter(function (x) { return !x.classList.contains('ff-hidden'); });
    if (visibles.length <= 1) { toast('Au moins une toile doit rester affichée'); return; }
    t.classList.add('ff-hidden');
    deselectionner();
    sauverSalle(salleEl);
    toast('Toile masquée');
  }
  function reafficher(salleEl, id) {
    var mur = murDe(salleEl);
    // déjà dans le DOM (masquée cette session) → on la ré-affiche directement
    var dom = mur && mur.querySelector('.tableau-grille[data-id="' + id + '"]');
    if (dom) {
      dom.classList.remove('ff-hidden');
      sauverSalle(salleEl);
      ouvrirTiroir();                              // rafraîchit la liste
      return;
    }
    // sinon (masquée lors d'une session précédente, absente du DOM) :
    // on la remet dans la surcouche depuis sa géométrie de base, puis on recharge.
    var sid = salleIdDe(salleEl);
    var base = basePositions(sid);
    var pos = null;
    for (var i = 0; i < base.length; i++) if (base[i].id === id) { pos = base[i]; break; }
    var d = storeSalles();
    var cur = (d.salles[String(sid)] && d.salles[String(sid)].positions)
              ? d.salles[String(sid)].positions.slice() : base.slice();
    if (pos && !cur.some(function (p) { return p.id === id; })) cur.push(pos);
    d.salles[String(sid)] = { positions: cur };
    ecrireStore(d);
    rechargerEnGardantEtat(sid);
  }

  /* ===================== Recharge en gardant l'état ======================= */
  function rechargerEnGardantEtat(salleId) {
    try { sessionStorage.setItem(CLE_MODE, '1'); } catch (e) {}
    if (salleId != null) {
      try { location.hash = '#salle-' + salleId; } catch (e) {}
    }
    location.reload();
  }

  /* ===================== Reset ============================================ */
  function resetSalle() {
    var salleEl = salleActiveEl();
    var sid = salleIdDe(salleEl);
    if (sid == null) return;
    if (!confirm('Réinitialiser cette salle (revenir à la version en ligne) ?')) return;
    var d = lireStore();
    if (d && d.salles) { delete d.salles[String(sid)]; ecrireStore(d); }
    rechargerEnGardantEtat(sid);
  }
  function resetTout() {
    if (!confirm('Tout réinitialiser : annuler TOUTES vos modifications locales ?')) return;
    try { localStorage.removeItem(CLE_STORE); } catch (e) {}
    rechargerEnGardantEtat(salleIdDe(salleActiveEl()));
  }

  /* ===================== Interface (barre + tiroir) ====================== */
  function entrerEdition() {
    if (enEdition) return;
    enEdition = true;
    document.body.classList.add('ff-edit-on');
    chargerToilesMap();

    document.querySelectorAll('.tableau-grille').forEach(function (t) {
      t.classList.add('ff-editable');
    });

    // Intercepteurs : bloquer le swipe galerie + le clic d'ouverture modale.
    document.addEventListener('touchstart', bloquerSwipe, true);
    document.addEventListener('touchmove',  bloquerSwipe, true);
    document.addEventListener('click',      bloquerClicTuile, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup',   onPointerUp, true);
    document.addEventListener('pointercancel', function () { drag = null; }, true);

    injecterBarre();
    majBadgeMasquees();
    toast('Mode local — réarrangez, rien n\u2019est publié');
  }
  function quitterEdition() {
    if (!enEdition) return;
    enEdition = false;
    deselectionner();
    fermerTiroir();
    document.body.classList.remove('ff-edit-on');
    document.querySelectorAll('.tableau-grille').forEach(function (t) {
      t.classList.remove('ff-editable', 'ff-selected', 'ff-dragging');
      t.style.transform = '';
    });
    document.removeEventListener('touchstart', bloquerSwipe, true);
    document.removeEventListener('touchmove',  bloquerSwipe, true);
    document.removeEventListener('click',      bloquerClicTuile, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup',   onPointerUp, true);
    var b = document.getElementById('ff-barre'); if (b) b.remove();
    try { sessionStorage.removeItem(CLE_MODE); } catch (e) {}
  }
  function bloquerSwipe(e) {
    if (!enEdition) return;
    if (e.target.closest && e.target.closest('.salle')) e.stopPropagation();
  }
  function bloquerClicTuile(e) {
    if (!enEdition) return;
    if (e.target.closest && e.target.closest('.tableau-grille')) {
      e.stopPropagation(); e.preventDefault();
    }
  }

  function injecterBarre() {
    if (document.getElementById('ff-barre')) return;
    var bar = document.createElement('div');
    bar.id = 'ff-barre';
    bar.innerHTML =
      '<span class="ff-barre-titre">✎ Mode local <em>— non publié</em></span>' +
      '<span class="ff-barre-actions">' +
        '<button type="button" id="ff-btn-masquees">Masquées <b id="ff-badge">0</b></button>' +
        '<button type="button" id="ff-btn-reset">Réinitialiser</button>' +
        '<button type="button" id="ff-btn-fin" class="ff-primaire">Terminer</button>' +
      '</span>';
    document.body.appendChild(bar);
    document.getElementById('ff-btn-fin').addEventListener('click', quitterEdition);
    document.getElementById('ff-btn-reset').addEventListener('click', resetSalle);
    document.getElementById('ff-btn-masquees').addEventListener('click', basculerTiroir);
  }
  function majBadgeMasquees() {
    var b = document.getElementById('ff-badge');
    if (!b) return;
    var n = idsMasquees(salleActiveEl()).length;
    b.textContent = n;
    b.parentNode.style.opacity = n ? '1' : '.5';
  }

  function basculerTiroir() {
    if (document.getElementById('ff-tiroir')) fermerTiroir();
    else ouvrirTiroir();
  }
  function fermerTiroir() {
    var t = document.getElementById('ff-tiroir'); if (t) t.remove();
  }
  function ouvrirTiroir() {
    fermerTiroir();
    var salleEl = salleActiveEl();
    var ids = idsMasquees(salleEl);
    var pan = document.createElement('div');
    pan.id = 'ff-tiroir';
    var html = '<div class="ff-tiroir-tete"><span>Toiles masquées (cette salle)</span>' +
               '<button type="button" id="ff-tiroir-x">✕</button></div>';
    if (!ids.length) {
      html += '<p class="ff-tiroir-vide">Aucune toile masquée.</p>';
    } else {
      html += '<ul class="ff-tiroir-liste">';
      ids.forEach(function (id) {
        var ph = photoToile(id);
        html += '<li data-id="' + id + '">' +
                  (ph ? '<img src="' + ph + '" alt="">' : '<span class="ff-vig"></span>') +
                  '<span class="ff-tiroir-nom">' + titreToile(id) + '</span>' +
                  '<button type="button" class="ff-reafficher">Réafficher</button>' +
                '</li>';
      });
      html += '</ul>';
    }
    html += '<div class="ff-tiroir-pied"><button type="button" id="ff-reset-tout">Tout réinitialiser</button></div>';
    pan.innerHTML = html;
    document.body.appendChild(pan);
    document.getElementById('ff-tiroir-x').addEventListener('click', fermerTiroir);
    document.getElementById('ff-reset-tout').addEventListener('click', resetTout);
    pan.querySelectorAll('.ff-reafficher').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.closest('li').dataset.id, 10);
        reafficher(salleEl, id);
      });
    });
  }

  /* ===================== Toast ============================================ */
  function toast(txt) {
    var t = document.createElement('div');
    t.className = 'ff-toast';
    t.textContent = txt;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 250); }, 2400);
  }

  /* ===================== Signature FF + appui long ======================= */
  function injecterSignature() {
    var pied = document.querySelector('footer.pied') || document.querySelector('.pied');
    if (!pied || document.getElementById('ff-sign')) return;
    var sign = document.createElement('button');
    sign.id = 'ff-sign';
    sign.type = 'button';
    sign.textContent = 'FF';
    sign.setAttribute('aria-label', 'Signature');
    pied.insertBefore(sign, pied.firstChild);

    var timer = null;
    function debut(e) {
      // n'interférer ni avec un appui multi-touch ni un clic droit
      if (e.button && e.button !== 0) return;
      timer = setTimeout(function () {
        timer = null;
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
        entrerEdition();
      }, 1100);
    }
    function fin() { if (timer) { clearTimeout(timer); timer = null; } }
    sign.addEventListener('pointerdown', debut);
    sign.addEventListener('pointerup', fin);
    sign.addEventListener('pointerleave', fin);
    sign.addEventListener('pointercancel', fin);
    // évite le menu contextuel sur appui long mobile
    sign.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ===================== Styles =========================================== */
  function injecterStyles() {
    if (document.getElementById('ff-edit-styles')) return;
    var css = document.createElement('style');
    css.id = 'ff-edit-styles';
    css.textContent = [
      '#ff-sign{font-family:"Playfair Display",serif;font-size:1.4rem;line-height:1;',
        'background:linear-gradient(135deg,#c8a050,#f0d080,#c8a050);-webkit-background-clip:text;',
        'background-clip:text;-webkit-text-fill-color:transparent;border:0;cursor:default;',
        'padding:0 .2rem;opacity:.7;letter-spacing:.05em;-webkit-user-select:none;user-select:none;',
        '-webkit-touch-callout:none;touch-action:none;}',
      '.ff-edit-on .tableau-grille.ff-editable{cursor:grab;touch-action:none;}',
      '.ff-edit-on .tableau-grille.ff-editable:active{cursor:grabbing;}',
      '.tableau-grille.ff-dragging{opacity:.9;z-index:60;outline:2px dashed #f0d080;outline-offset:2px;}',
      '.tableau-grille.ff-selected{outline:2px solid #f0d080;outline-offset:2px;}',
      '.tableau-grille.ff-hidden{display:none!important;}',
      // grille repère discrète sur le mur en édition
      '.ff-edit-on .mur-grille{background-image:' +
        'linear-gradient(to right,rgba(240,208,128,.10) 1px,transparent 1px),' +
        'linear-gradient(to bottom,rgba(240,208,128,.10) 1px,transparent 1px)!important;' +
        'background-size:calc(100%/12) calc(100%/8)!important;}',
      // barre
      '#ff-barre{position:fixed;top:0;left:0;right:0;z-index:100000;display:flex;',
        'align-items:center;justify-content:space-between;gap:.6rem;padding:8px 12px;',
        'background:#1a1a1a;border-bottom:1px solid #c8a050;font-family:Lato,system-ui,sans-serif;}',
      '.ff-barre-titre{color:#f0d080;font-size:13px;letter-spacing:.04em;}',
      '.ff-barre-titre em{color:#caa;font-style:normal;opacity:.8;}',
      '.ff-barre-actions{display:flex;gap:6px;}',
      '#ff-barre button{font:inherit;font-size:12.5px;color:#e8dcc4;background:#262626;',
        'border:1px solid #5a4a28;border-radius:7px;padding:6px 10px;cursor:pointer;}',
      '#ff-barre button:hover{border-color:#c8a050;}',
      '#ff-barre button.ff-primaire{background:linear-gradient(135deg,#c8a050,#f0d080);',
        'color:#1a1a1a;border:0;font-weight:700;}',
      '#ff-badge{display:inline-block;min-width:14px;}',
      // bouton masquer flottant
      '.ff-mini-action{position:fixed;z-index:100001;transform:translate(-50%,0);',
        'font-family:Lato,system-ui,sans-serif;font-size:12px;font-weight:700;color:#1a1a1a;',
        'background:linear-gradient(135deg,#f0d080,#e8c060);border:0;border-radius:14px;',
        'padding:5px 11px;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.5);}',
      // tiroir masquées
      '#ff-tiroir{position:fixed;left:0;right:0;bottom:0;z-index:100001;max-height:55vh;overflow:auto;',
        'background:#1a1a1a;border-top:1px solid #c8a050;font-family:Lato,system-ui,sans-serif;color:#e8dcc4;',
        'border-radius:14px 14px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.5);}',
      '.ff-tiroir-tete{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;',
        'border-bottom:1px solid rgba(200,160,80,.25);font-size:14px;color:#f0d080;}',
      '#ff-tiroir-x{background:0;border:0;color:#f0d080;font-size:18px;cursor:pointer;}',
      '.ff-tiroir-vide{padding:18px 14px;color:#aaa;font-size:13px;}',
      '.ff-tiroir-liste{list-style:none;margin:0;padding:6px 0;}',
      '.ff-tiroir-liste li{display:flex;align-items:center;gap:10px;padding:8px 14px;',
        'border-bottom:1px solid rgba(255,255,255,.05);}',
      '.ff-tiroir-liste img,.ff-vig{width:44px;height:44px;border-radius:6px;object-fit:cover;',
        'background:#333;flex:0 0 auto;}',
      '.ff-tiroir-nom{flex:1 1 auto;font-size:13px;}',
      '.ff-reafficher{font:inherit;font-size:12px;color:#1a1a1a;background:linear-gradient(135deg,#c8a050,#f0d080);',
        'border:0;border-radius:7px;padding:6px 10px;cursor:pointer;}',
      '.ff-tiroir-pied{padding:10px 14px;text-align:center;border-top:1px solid rgba(200,160,80,.25);}',
      '#ff-reset-tout{font:inherit;font-size:12px;color:#e8a;background:#262626;border:1px solid #633;',
        'border-radius:7px;padding:7px 12px;cursor:pointer;}',
      // toast
      '.ff-toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:100002;',
        'background:#1a1a1a;color:#f0d080;border:1px solid #c8a050;border-radius:8px;padding:8px 14px;',
        'font-family:Lato,system-ui,sans-serif;font-size:13px;max-width:90%;text-align:center;',
        'box-shadow:0 6px 24px rgba(0,0,0,.45);opacity:0;transition:opacity .2s;}',
      '.ff-toast.on{opacity:1;}'
    ].join('');
    document.head.appendChild(css);
  }

  /* ===================== Démarrage ======================================= */
  function demarrer() {
    injecterStyles();
    injecterSignature();
    // Ré-entrée en édition après un reload déclenché par l'éditeur lui-même.
    var reEntrer = false;
    try { reEntrer = sessionStorage.getItem(CLE_MODE) === '1'; } catch (e) {}
    if (reEntrer) {
      var essais = 0;
      var iv = setInterval(function () {
        essais++;
        if (document.querySelector('.salle .mur-grille .tableau-grille')) {
          clearInterval(iv);
          try { sessionStorage.removeItem(CLE_MODE); } catch (e) {}
          entrerEdition();
        } else if (essais > 25) { clearInterval(iv); }
      }, 150);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else { demarrer(); }
})();
