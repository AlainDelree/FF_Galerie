/* =============================================================
   FF_Galerie — galerie-sculpture.js
   Rendu galerie sculpture — nécessite galerie-core.js chargé avant
   Positions socles : x/y en % du sol (x = gauche-droite, y = avant-arrière)
   ============================================================= */

/* ── Chargement du CSS sculpture (auto, une seule fois) ── */
(function () {
  const id = 'css-galerie-sculpture';
  if (!document.getElementById(id)) {
    const lnk = document.createElement('link');
    lnk.id = id; lnk.rel = 'stylesheet';
    lnk.href = (window.GALERIE_ASSETS_BASE || '') + 'assets/css/galerie-sculpture.css';
    document.head.appendChild(lnk);
  }
})();

/* ── Pré-chargement de <model-viewer> dès le démarrage ── */
(function () {
  const id = 'script-model-viewer';
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id; s.type = 'module';
  s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
  document.head.appendChild(s);
})();

/* ── Hauteurs du viewer inline par gabarit ── */
const VIEWER_H = { s: 90, m: 120, l: 160, sol: 130 };

/* ── creerSocle : piédestal + photo + viewer inline + titre + ombre ── */
function creerSocle(piece, gabarit, pos) {
  const gCode = (gabarit && gabarit.code) ? gabarit.code.toLowerCase() : 'm';

  const wrapper = document.createElement('div');
  wrapper.className             = 'socle-wrapper';
  wrapper.style.left            = pos.x + '%';
  wrapper.style.bottom          = pos.y + '%';
  wrapper.style.transformOrigin = 'bottom center';

  /* Échelle de profondeur : y=0 avant (×1), y=100 arrière (×0.58) */
  const scale = (1 - (pos.y / 100) * 0.42).toFixed(3);
  wrapper.style.transform = 'translateX(-50%) scale(' + scale + ')';
  wrapper.style.zIndex    = String(Math.round((100 - pos.y) * 10));

  const hasGlb = !!piece.glb;

  const socle = document.createElement('div');
  socle.className = 'socle socle--' + gCode;
  socle.tabIndex  = hasGlb ? 0 : -1;
  socle.dataset.glb = hasGlb ? '1' : '0';
  socle.setAttribute('role', hasGlb ? 'button' : 'img');
  socle.setAttribute('aria-label', piece.titre || 'Sculpture');

  /* Badge 3D */
  if (hasGlb) {
    const badge = document.createElement('span');
    badge.className = 'socle-badge-3d';
    badge.textContent = '3D';
    socle.appendChild(badge);
  }

  /* Photo principale */
  if (piece.photo) {
    const img = document.createElement('img');
    img.className = 'socle-photo';
    img.alt = piece.titre || '';
    img.loading = 'lazy'; img.decoding = 'async';
    const src = /^https?:\/\//.test(piece.photo)
      ? piece.photo : GALERIE_CFG.assetsBase + piece.photo;
    img.onerror = function () {
      if (!this._fbDone) { this._fbDone = true; this.loading = 'lazy'; this.src = src; }
      else { this.style.display = 'none'; }
    };
    img.src = src;
    socle.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'socle-placeholder';
    socle.appendChild(ph);
  }

  /* Piédestal + ombre portée */
  const ped = document.createElement('div');
  ped.className = 'socle-piedestal socle-piedestal--' + gCode;
  const ombre = document.createElement('div');
  ombre.className = 'socle-ombre';
  ped.appendChild(ombre);
  socle.appendChild(ped);

  /* Titre */
  if (piece.titre) {
    const titre = document.createElement('div');
    titre.className = 'socle-titre';
    titre.textContent = piece.titre;
    socle.appendChild(titre);
  }

  /* ── Viewer inline (créé au premier clic, lazy) ── */
  let viewerEl = null;

  if (hasGlb) {
    const glbSrc = /^https?:\/\//.test(piece.glb)
      ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;

    socle.addEventListener('click', () => {
      const isActif = socle.classList.toggle('socle--active');

      if (isActif && !viewerEl) {
        /* Premier clic : créer le model-viewer */
        viewerEl = document.createElement('model-viewer');
        viewerEl.setAttribute('src',              glbSrc);
        viewerEl.setAttribute('alt',              piece.titre || '');
        viewerEl.setAttribute('auto-rotate',      '');
        viewerEl.setAttribute('camera-controls',  '');
        viewerEl.setAttribute('shadow-intensity', '0.8');
        viewerEl.className     = 'socle-viewer-inline';
        viewerEl.style.height  = (VIEWER_H[gCode] || 120) + 'px';
        socle.insertBefore(viewerEl, ped);
      }

      /* Pause/reprise de la rotation */
      if (viewerEl) {
        if (isActif) viewerEl.setAttribute('auto-rotate', '');
        else         viewerEl.removeAttribute('auto-rotate');
      }
    });

    socle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); socle.click(); }
    });
  }

  wrapper.appendChild(socle);
  return wrapper;
}

/* ── Init principale ── */
Promise.all([
  fetch(GALERIE_CFG.toiles + '?v=' + Date.now()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  fetch(GALERIE_CFG.salles + '?v=' + Date.now()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
])
.then(([tData, sData]) => {
  const gabarits = {};
  const pieces   = {};
  (tData.gabarits || []).forEach(g => { gabarits[g.code] = g; });
  (tData.pieces   || []).forEach(p => { pieces[p.id]     = p; });

  const salles = sData.salles || [];
  TOTAL_SALLES = salles.length;

  const _hm = window.location.hash.match(/^#salle-(\d+)$/);

  conteneur.style.width = (TOTAL_SALLES * 100) + '%';

  salles.forEach((salle, si) => {
    const salleDiv = document.createElement('div');
    salleDiv.className   = 'salle salle-sculpture';
    salleDiv.id          = 'salle' + salle.id;
    salleDiv.style.width = (100 / TOTAL_SALLES) + '%';
    salleDiv.setAttribute('aria-label', salle.nom || ('Salle ' + salle.id));
    if (salle.couleur_mur) salleDiv.style.setProperty('--salle-mur', salle.couleur_mur);

    const nomEl = document.createElement('p');
    nomEl.className = 'nom-salle';
    nomEl.textContent = salle.nom || ('Salle ' + NOMS_ROMAINS[salle.id - 1]);
    salleDiv.appendChild(nomEl);

    const scene = document.createElement('div');
    scene.className = 'scene-sculpture';
    if (salle.couleur_mur) scene.style.backgroundColor = salle.couleur_mur;

    const sol = document.createElement('div');
    sol.className = 'sol-sculpture';
    if (salle.couleur_sol) sol.style.backgroundColor = salle.couleur_sol;

    /* Socles triés arrière → avant (z-order) */
    (salle.positions || []).slice().sort((a, b) => b.y - a.y).forEach(pos => {
      const piece   = pieces[pos.id];
      const gabarit = gabarits[pos.gabarit] || gabarits['M'];
      if (!piece) return;
      sol.appendChild(creerSocle(piece, gabarit, pos));
    });

    scene.appendChild(sol);
    salleDiv.appendChild(scene);
    conteneur.appendChild(salleDiv);

    salleDiv.appendChild(creerPlancher(si + 1, salles.length, salles, NOMS_ROMAINS, salle.couleur_mur));
  });

  mettreAJourNav();

  const hashId = parseInt((_hm || [])[1]);
  if (hashId) {
    const hashIdx = salles.findIndex(s => s.id === hashId) + 1;
    const cible   = hashIdx > 0 ? hashIdx : 1;
    conteneur.style.transition = 'none';
    allerSalle(cible);
    conteneur.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => { conteneur.style.transition = ''; }));
  }
})
.catch(() => {
  document.querySelectorAll('.salle-sculpture').forEach(s => {
    s.innerHTML = '<p style="color:var(--text-doux);font-style:italic;padding:2rem;">Données non disponibles.</p>';
  });
});
