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

/* ── Facteur d'échelle px/cm ── */
const ECHELLE      = window.innerWidth <= 600 ? 1.4 : 2.2;
const ECHELLE_MIN  = window.innerWidth <= 600 ? 35  : 50;
const ECHELLE_MAXH = window.innerWidth <= 600 ? 180 : 290;

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
/* ── Génère le mur en SVG mosaïque (3 rangées, cellules irrégulières) ── */
function creerMurSVG() {
  const W = 1080, H = 100;
  const C = ['#7a2525','#1a3055','#2a5035','#a04820','#1a4555','#4a2060','#805020','#2a1a55'];
  const GOLD = '#c8a050';
  const DARK = '#0e0905';

  const rows = [
    { y:0,  h:35, cells:[
      [0,175,0],[175,140,1],[315,130,2],[445,120,3],
      [565,145,4],[710,110,5],[820,135,6],[955,125,7]
    ]},
    { y:35, h:32, cells:[
      [0,130,4],[130,155,2],[285,140,5],[425,130,7],
      [555,160,0],[715,120,3],[835,145,6],[980,100,1]
    ]},
    { y:67, h:33, cells:[
      [0,160,5],[160,125,7],[285,150,1],[435,140,6],
      [575,130,2],[705,155,0],[860,110,4],[970,110,3]
    ]}
  ];

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  s += `<rect width="${W}" height="${H}" fill="${DARK}"/>`;
  s += `<defs>
    <pattern id="diag" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)">
      <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(255,255,255,.045)" stroke-width="3"/>
    </pattern>
  </defs>`;

  for (const row of rows) {
    for (const [x, w, ci] of row.cells) {
      s += `<rect x="${x}" y="${row.y}" width="${w}" height="${row.h}" fill="${C[ci]}"/>`;
      s += `<rect x="${x + w*0.25}" y="${row.y}" width="${w*0.5}" height="${row.h}" fill="rgba(255,255,255,.04)"/>`;
    }
  }

  s += `<rect width="${W}" height="${H}" fill="url(#diag)"/>`;
  s += `<rect x="0" y="33" width="${W}" height="3" fill="${GOLD}"/>`;
  s += `<rect x="0" y="65" width="${W}" height="3" fill="${GOLD}"/>`;

  for (const row of rows) {
    for (let i = 1; i < row.cells.length; i++) {
      const x = row.cells[i][0];
      s += `<rect x="${x-1}" y="${row.y}" width="2" height="${row.h}" fill="${GOLD}"/>`;
    }
  }

  const hlines = [33, 65];
  for (const row of rows) {
    for (let i = 1; i < row.cells.length; i++) {
      const x = row.cells[i][0];
      for (const hy of hlines) {
        if (hy >= row.y && hy <= row.y + row.h) {
          s += `<rect x="${x-3}" y="${hy-2}" width="6" height="5" fill="${GOLD}"/>`;
        }
      }
    }
  }

  s += '</svg>';
  const blob = new Blob([s], { type:'image/svg+xml' });
  return URL.createObjectURL(blob);
}

let _obsRAF    = null;
let _obsTheta  = 0;
let _obsPaused = false;
const OBS_SPEED  = 0.3;          /* °/frame — vitesse orbite caméra */
const OBS_BG_W   = 1080;         /* px — un tour complet */
const OBS_SCALE  = OBS_BG_W / 90; /* 4 pilastres par révolution (360°/4 = 90°) */

function ouvrirSalleObservation(piece) {
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

  /* ── Décor de salle ── */
  const chambre = document.createElement('div');
  chambre.className = 'obs-chambre';

  /* Couche murs avec mosaïque SVG (animée en JS) */
  const murs = document.createElement('div');
  murs.className = 'obs-murs-mobiles';
  const murUrl = creerMurSVG();
  murs.style.backgroundImage = `url('${murUrl}')`;
  chambre.appendChild(murs);

  overlay.appendChild(chambre);

  /* ── Contenu central ── */
  const contenu = document.createElement('div');
  contenu.className = 'obs-contenu';

  const titreEl = document.createElement('h2');
  titreEl.className   = 'obs-titre';
  titreEl.textContent = piece.titre || '';
  contenu.appendChild(titreEl);

  /* ── model-viewer grand ── */
  const glbSrc = /^https?:\/\//.test(piece.glb)
    ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;

  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('src',                glbSrc);
  viewer.setAttribute('alt',                piece.titre || '');
  viewer.setAttribute('auto-rotate',        '');
  viewer.setAttribute('auto-rotate-delay',  '0');
  viewer.setAttribute('camera-controls',    '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('shadow-intensity',   '1');
  viewer.className = 'obs-viewer';

  /* Murs : RAF autonome — indépendant de model-viewer */
  let wallPos = 0;
  (function wallFrame() {
    wallPos = (wallPos + 1.5) % OBS_BG_W;
    murs.style.backgroundPositionX = wallPos + 'px';
    _obsRAF = requestAnimationFrame(wallFrame);
  })();

  contenu.appendChild(viewer);

  /* Métadonnées */
  const meta = document.createElement('div');
  meta.className = 'obs-meta';
  const dim   = piece.dimensions || {};
  const parts = [];
  if (piece.materiaux && piece.materiaux.length) parts.push(piece.materiaux.join(', '));
  const dimParts = [dim.largeur, dim.profondeur, dim.hauteur].filter(Boolean);
  if (dimParts.length) parts.push(dimParts.join(' \u00d7 ') + '\u202fcm');
  meta.textContent = parts.join('\u2002\u00b7\u2002');
  contenu.appendChild(meta);

  overlay.appendChild(contenu);

  /* ── Bouton fermer ── */
  const btnFermer = document.createElement('button');
  btnFermer.className = 'obs-fermer';
  btnFermer.setAttribute('aria-label', 'Fermer');
  btnFermer.innerHTML = '\u2715';
  overlay.appendChild(btnFermer);

  function fermer() {
    if (_obsRAF) { cancelAnimationFrame(_obsRAF); _obsRAF = null; }
    URL.revokeObjectURL(murUrl);
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
   GRILLE DE REPÉRAGE SVG PERSPECTIVE
   ══════════════════════════════════════════════════════════════ */
function ajouterGrilleDevParquet(sol) {
  const COLS = 'ABCDEFGHIJ'.split('');
  const NC = COLS.length, NR = 5;

  const overlay = document.createElement('div');
  overlay.className = 'grille-dev';

  const btn = document.createElement('button');
  btn.className = 'grille-toggle'; btn.title = 'Afficher / masquer la grille';
  btn.textContent = '\u229e';
  btn.addEventListener('click', () => overlay.classList.toggle('grille-masquee'));

  sol.appendChild(overlay);
  sol.appendChild(btn);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const W = sol.clientWidth || 1000, H = sol.clientHeight || 300;
    const scaleAt = t => 1 - t * 0.42;
    const rowScales = Array.from({ length: NR }, (_, r) => scaleAt((r + 0.5) / NR));
    const totalS    = rowScales.reduce((a, b) => a + b, 0);
    const rowBounds = [0];
    rowScales.forEach(s => rowBounds.push(rowBounds.at(-1) + s / totalS));

    const sY = t  => H * (1 - t);
    const sX = (xN, t) => W * (0.5 + (xN - 0.5) * scaleAt(t));

    const SVG = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
    const mk = tag => document.createElementNS(SVG, tag);

    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        if ((r + c) % 2 === 0) continue;
        const t0 = rowBounds[r], t1 = rowBounds[r + 1];
        const x0 = c / NC, x1 = (c + 1) / NC;
        const poly = mk('polygon');
        poly.setAttribute('points', [sX(x0,t0),sY(t0),sX(x1,t0),sY(t0),sX(x1,t1),sY(t1),sX(x0,t1),sY(t1)].join(','));
        poly.setAttribute('fill', 'rgba(0,0,0,.06)');
        svg.appendChild(poly);
      }
    }
    rowBounds.forEach(t => {
      const ln = mk('line');
      ln.setAttribute('x1', sX(0,t)); ln.setAttribute('y1', sY(t));
      ln.setAttribute('x2', sX(1,t)); ln.setAttribute('y2', sY(t));
      ln.setAttribute('stroke', 'rgba(0,0,0,.50)'); ln.setAttribute('stroke-width', '1.8');
      svg.appendChild(ln);
    });
    for (let c = 0; c <= NC; c++) {
      const xN = c / NC;
      const ln = mk('line');
      ln.setAttribute('x1', sX(xN,0)); ln.setAttribute('y1', sY(0));
      ln.setAttribute('x2', sX(xN,1)); ln.setAttribute('y2', sY(1));
      ln.setAttribute('stroke', 'rgba(0,0,0,.50)'); ln.setAttribute('stroke-width', '1.8');
      svg.appendChild(ln);
    }
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        const tC  = (rowBounds[r] + rowBounds[r+1]) / 2;
        const xNC = (c + 0.5) / NC;
        const rowH = (rowBounds[r+1] - rowBounds[r]) * H;
        const fs = Math.max(7, Math.min(11, Math.round(rowH * 0.28)));
        const txt = mk('text');
        txt.setAttribute('x', sX(xNC, tC)); txt.setAttribute('y', sY(tC));
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'middle');
        txt.setAttribute('font-size', fs); txt.setAttribute('font-family', 'monospace');
        txt.setAttribute('font-weight', 'bold'); txt.setAttribute('fill', 'rgba(0,0,0,.30)');
        txt.textContent = COLS[c] + (r + 1);
        svg.appendChild(txt);
      }
    }
    COLS.forEach((col, c) => {
      const txt = mk('text');
      txt.setAttribute('x', sX((c+0.5)/NC, 0.01)); txt.setAttribute('y', sY(0.01) - 5);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '12');
      txt.setAttribute('font-family', 'monospace'); txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'rgba(0,0,0,.55)'); txt.textContent = col;
      svg.appendChild(txt);
    });
    for (let r = 0; r < NR; r++) {
      const tC = (rowBounds[r] + rowBounds[r+1]) / 2;
      const txt = mk('text');
      txt.setAttribute('x', sX(0.015,tC) + 5); txt.setAttribute('y', sY(tC));
      txt.setAttribute('dominant-baseline', 'middle'); txt.setAttribute('font-size', '12');
      txt.setAttribute('font-family', 'monospace'); txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'rgba(0,0,0,.55)'); txt.textContent = r + 1;
      svg.appendChild(txt);
    }
    overlay.appendChild(svg);
  }));
}

/* ══════════════════════════════════════════════════════════════
   SOCLE — photo statique + clic → salle d'observation
   ══════════════════════════════════════════════════════════════ */
function creerSocle(piece, gabarit, pos) {
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
  const socleW = Math.max(ECHELLE_MIN, Math.round(lCm * ECHELLE));
  const photoH = Math.min(ECHELLE_MAXH,
    Math.max(ECHELLE_MIN, Math.round(hCm * ECHELLE * (ratio < 1 ? ratio : 1))));

  const hasGlb = !!piece.glb;

  const socle = document.createElement('div');
  socle.className = 'socle socle--' + gCode;
  socle.setAttribute('aria-label', piece.titre || 'Sculpture');
  socle.style.width = socleW + 'px';
  if (hasGlb) { socle.tabIndex = 0; socle.style.cursor = 'pointer'; }

  /* Photo statique */
  if (piece.photo) {
    const img = document.createElement('img');
    img.className = 'socle-photo';
    img.alt = piece.titre || ''; img.loading = 'lazy'; img.decoding = 'async';
    img.style.height = photoH + 'px';
    img.style.objectFit = 'contain';
    const src = /^https?:\/\//.test(piece.photo) ? piece.photo : GALERIE_CFG.assetsBase + piece.photo;
    img.onerror = function() {
      if (!this._fb) { this._fb = true; this.loading = 'lazy'; this.src = src; }
      else { this.style.display = 'none'; }
    };
    img.src = src;
    socle.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'socle-placeholder';
    ph.style.height = photoH + 'px';
    socle.appendChild(ph);
  }

  /* Badge 3D */
  if (hasGlb) {
    const badge = document.createElement('span');
    badge.className = 'socle-badge-3d'; badge.textContent = '3D';
    socle.appendChild(badge);
  }

  /* Piédestal + ombre */
  const ped = document.createElement('div');
  ped.className = 'socle-piedestal socle-piedestal--' + gCode;
  const ombre = document.createElement('div');
  ombre.className = 'socle-ombre';
  ped.appendChild(ombre);
  socle.appendChild(ped);

  /* Titre */
  if (piece.titre) {
    const titre = document.createElement('div');
    titre.className = 'socle-titre'; titre.textContent = piece.titre;
    socle.appendChild(titre);
  }

  /* Clic → salle d'observation */
  if (hasGlb) {
    const ouvrir = () => ouvrirSalleObservation(piece);
    socle.addEventListener('click', ouvrir);
    socle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); }
    });
  }

  wrapper.appendChild(socle);
  return wrapper;
}

/* ══════════════════════════════════════════════════════════════
   INIT PRINCIPALE
   ══════════════════════════════════════════════════════════════ */
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

    const nomEl = document.createElement('p');
    nomEl.className = 'nom-salle'; nomEl.textContent = salle.nom || ('Salle ' + NOMS_ROMAINS[salle.id - 1]);
    salleDiv.appendChild(nomEl);

    const plancher = creerPlancher(si + 1, salles.length, salles, NOMS_ROMAINS, salle.couleur_mur);
    const sils = plancher.querySelector('.silhouettes-sol');
    if (sils) sils.remove();

    const plancherSol = plancher.querySelector('.plancher-sol');
    if (plancherSol) {
      (salle.positions || []).slice().sort((a, b) => b.y - a.y).forEach(pos => {
        const piece   = pieces[pos.id];
        const gCode   = pos.gabarit || gabaritDepuisHauteur(piece && piece.dimensions && piece.dimensions.hauteur);
        const gabarit = gabarits[gCode] || gabarits['M'];
        if (!piece) return;
        plancherSol.appendChild(creerSocle(piece, gabarit, pos));
      });
      ajouterGrilleDevParquet(plancherSol);
    }

    salleDiv.appendChild(plancher);
    conteneur.appendChild(salleDiv);
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
