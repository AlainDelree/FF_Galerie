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
/* ── Génère le mur en SVG — polygones géométriques irréguliers ──
   6 lignes diagonales → 15 polygones jointifs, lignes claires séparantes
   Coordonnées calculées depuis les vraies intersections des lignes
   ─────────────────────────────────────────────────────────────── */
function creerMurSVG() {
  const W = 1080, H = 100;

  /* 10 couleurs de galerie — aucune adjacente de même couleur */
  const C = [
    '#7a2525', /* C0 bordeaux     */
    '#1a3055', /* C1 marine       */
    '#2a5035', /* C2 vert forêt   */
    '#a04820', /* C3 terre cuite  */
    '#1a4555', /* C4 teal         */
    '#4a2060', /* C5 prune        */
    '#805020', /* C6 ambre        */
    '#2a1a55', /* C7 indigo       */
    '#405010', /* C8 olive        */
    '#5c2040', /* C9 merlot       */
  ];

  /* 15 polygones issus de 6 lignes diagonales sur 1080×100
     Points-clés calculés depuis les intersections réelles :
       L1 : (0,40)→(1080,25)   L2 : (0,70)→(1080,55)
       L3 : (200,0)→(350,100)  L4 : (520,0)→(620,100)
       L5 : (780,0)→(680,100)  L6 : (960,0)→(860,100)
     Intersections (arrondi) :
       L1∩L3=(255,37) L1∩L4=(552,32) L1∩L5=(750,30) L1∩L6=(933,27)
       L2∩L3=(299,66) L2∩L4=(582,62) L2∩L5=(720,60) L2∩L6=(903,58) */
  const polys = [
    /* ── Zone haute (au-dessus de L1) ── */
    { p:[0,0, 200,0, 255,37, 0,40],                   c:0 },
    { p:[200,0, 520,0, 552,32, 255,37],                c:2 },
    { p:[520,0, 780,0, 750,30, 552,32],                c:4 },
    { p:[780,0, 960,0, 933,27, 750,30],                c:6 },
    { p:[960,0, 1080,0, 1080,25, 933,27],              c:1 },
    /* ── Zone médiane (entre L1 et L2) ── */
    { p:[0,40, 255,37, 299,66, 0,70],                  c:3 },
    { p:[255,37, 552,32, 582,62, 299,66],              c:5 },
    { p:[552,32, 750,30, 720,60, 582,62],              c:7 },
    { p:[750,30, 933,27, 903,58, 720,60],              c:8 },
    { p:[933,27, 1080,25, 1080,55, 903,58],            c:6 },
    /* ── Zone basse (sous L2) ── */
    { p:[0,70, 299,66, 350,100, 0,100],                c:9 },
    { p:[299,66, 582,62, 620,100, 350,100],            c:0 },
    { p:[582,62, 720,60, 680,100, 620,100],            c:2 },
    { p:[720,60, 903,58, 860,100, 680,100],            c:5 },
    { p:[903,58, 1080,55, 1080,100, 860,100],          c:1 },
  ];

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;

  /* Polygones colorés avec lignes séparatrices claires */
  for (const { p, c } of polys) {
    const pts = [];
    for (let i = 0; i < p.length; i += 2) pts.push(`${p[i]},${p[i+1]}`);
    s += `<polygon points="${pts.join(' ')}" fill="${C[c]}" stroke="#e8e0cc" stroke-width="2.5" stroke-linejoin="round"/>`;
  }

  /* Texture diagonale subtile */
  s += `<defs>
    <pattern id="tx" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)">
      <line x1="0" y1="0" x2="0" y2="22" stroke="rgba(255,255,255,.04)" stroke-width="3"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#tx)"/>`;

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

  const plafond = document.createElement('div');
  plafond.className = 'obs-plafond';
  chambre.appendChild(plafond);

  const sol = document.createElement('div');
  sol.className = 'obs-sol';
  chambre.appendChild(sol);

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
  viewer.setAttribute('auto-rotate-speed', '20deg/s');
  viewer.className = 'obs-viewer';

  /* Murs + sol : RAF autonome calibré — même vitesse */
  let wallPos = 0;
  (function wallFrame() {
    wallPos = (wallPos - 1 + OBS_BG_W) % OBS_BG_W;
    murs.style.backgroundPositionX = wallPos + 'px';
    sol.style.backgroundPositionX  = wallPos + 'px';
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
