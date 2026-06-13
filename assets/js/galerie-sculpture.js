/* =============================================================
   FF_Galerie — galerie-sculpture.js
   Rendu galerie sculpture — nécessite galerie-core.js chargé avant
   ============================================================= */

(function () {
  const id = 'css-galerie-sculpture';
  if (!document.getElementById(id)) {
    const lnk = document.createElement('link');
    lnk.id = id; lnk.rel = 'stylesheet';
    lnk.href = (window.GALERIE_ASSETS_BASE || '') + 'assets/css/galerie-sculpture.css?v=' + Date.now();
    document.head.appendChild(lnk);
  }
})();

(function () {
  const id = 'script-model-viewer';
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id; s.type = 'module';
  s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
  document.head.appendChild(s);
})();

/* ── Facteur d'échelle px/cm (desktop vs mobile) ── */
const ECHELLE      = window.innerWidth <= 600 ? 1.4 : 2.2;
const ECHELLE_MIN  = window.innerWidth <= 600 ? 35  : 50;
const ECHELLE_MAXH = window.innerWidth <= 600 ? 180 : 290;

/* ── Grille de repérage avec perspective (SVG) ─────────────────
   10 colonnes A→J · 5 rangées 1→5
   Correspondance JSON : case D3 → x:35, y:50
   ─────────────────────────────────────────────────────────────── */
function ajouterGrilleDevParquet(sol) {
  const COLS = 'ABCDEFGHIJ'.split('');
  const NC = COLS.length, NR = 5;

  /* Overlay + bouton toggle */
  const overlay = document.createElement('div');
  overlay.className = 'grille-dev';

  const btn = document.createElement('button');
  btn.className   = 'grille-toggle';
  btn.title       = 'Afficher / masquer la grille';
  btn.textContent = '⊞';
  btn.addEventListener('click', () => overlay.classList.toggle('grille-masquee'));

  sol.appendChild(overlay);
  sol.appendChild(btn);

  /* Génération SVG après layout (dimensions réelles disponibles) */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const W = sol.clientWidth  || 1000;
    const H = sol.clientHeight || 300;

    /* ── Calcul des frontières de rangée en perspective ──
       Chaque rangée a une hauteur visuelle proportionnelle à son échelle
       (même formule que les socles : scale = 1 - t*0.42)             */
    const scaleAt = t => 1 - t * 0.42; /* t=0 avant(bas), t=1 fond(haut) */

    const rowScales = Array.from({ length: NR }, (_, r) => scaleAt((r + 0.5) / NR));
    const totalS    = rowScales.reduce((a, b) => a + b, 0);

    const rowBounds = [0]; /* fractions cumulées depuis le bas */
    rowScales.forEach(s => rowBounds.push(rowBounds.at(-1) + s / totalS));

    /* Coordonnées écran depuis les fractions perspective */
    const sY = t  => H * (1 - t);                                  /* bas→haut */
    const sX = (xN, t) => W * (0.5 + (xN - 0.5) * scaleAt(t));   /* convergence centrale */

    const SVG = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width',  '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';

    const mk = tag => document.createElementNS(SVG, tag);

    /* 1. Damier — cellules trapézoïdales alternées */
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        if ((r + c) % 2 === 0) continue;
        const t0 = rowBounds[r], t1 = rowBounds[r + 1];
        const x0 = c / NC,      x1 = (c + 1) / NC;
        const pts = [
          sX(x0, t0), sY(t0),
          sX(x1, t0), sY(t0),
          sX(x1, t1), sY(t1),
          sX(x0, t1), sY(t1),
        ].join(',');
        const poly = mk('polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'rgba(0,0,0,.06)');
        svg.appendChild(poly);
      }
    }

    /* 2. Lignes horizontales */
    rowBounds.forEach(t => {
      const ln = mk('line');
      ln.setAttribute('x1', sX(0, t)); ln.setAttribute('y1', sY(t));
      ln.setAttribute('x2', sX(1, t)); ln.setAttribute('y2', sY(t));
      ln.setAttribute('stroke', 'rgba(0,0,0,.50)');
      ln.setAttribute('stroke-width', '1.8');
      svg.appendChild(ln);
    });

    /* 3. Lignes verticales (convergentes) */
    for (let c = 0; c <= NC; c++) {
      const xN = c / NC;
      const ln = mk('line');
      ln.setAttribute('x1', sX(xN, 0)); ln.setAttribute('y1', sY(0));
      ln.setAttribute('x2', sX(xN, 1)); ln.setAttribute('y2', sY(1));
      ln.setAttribute('stroke', 'rgba(0,0,0,.50)');
      ln.setAttribute('stroke-width', '1.8');
      svg.appendChild(ln);
    }

    /* 4. Coordonnées dans chaque case */
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        const tC  = (rowBounds[r] + rowBounds[r + 1]) / 2;
        const xNC = (c + 0.5) / NC;
        const rowH = (rowBounds[r + 1] - rowBounds[r]) * H;
        const fs   = Math.max(7, Math.min(11, Math.round(rowH * 0.28)));
        const txt  = mk('text');
        txt.setAttribute('x', sX(xNC, tC));
        txt.setAttribute('y', sY(tC));
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('dominant-baseline', 'middle');
        txt.setAttribute('font-size', fs);
        txt.setAttribute('font-family', 'monospace');
        txt.setAttribute('font-weight', 'bold');
        txt.setAttribute('fill', 'rgba(0,0,0,.30)');
        txt.textContent = COLS[c] + (r + 1);
        svg.appendChild(txt);
      }
    }

    /* 5. Lettres colonnes (bas) */
    COLS.forEach((col, c) => {
      const xNC = (c + 0.5) / NC;
      const txt  = mk('text');
      txt.setAttribute('x', sX(xNC, 0.01));
      txt.setAttribute('y', sY(0.01) - 5);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size', '12');
      txt.setAttribute('font-family', 'monospace');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'rgba(0,0,0,.55)');
      txt.textContent = col;
      svg.appendChild(txt);
    });

    /* 6. Chiffres rangées (gauche) */
    for (let r = 0; r < NR; r++) {
      const tC = (rowBounds[r] + rowBounds[r + 1]) / 2;
      const txt = mk('text');
      txt.setAttribute('x', sX(0.015, tC) + 5);
      txt.setAttribute('y', sY(tC));
      txt.setAttribute('dominant-baseline', 'middle');
      txt.setAttribute('font-size', '12');
      txt.setAttribute('font-family', 'monospace');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'rgba(0,0,0,.55)');
      txt.textContent = r + 1;
      svg.appendChild(txt);
    }

    overlay.appendChild(svg);
  }));
}

/* ── Gabarit automatique depuis la hauteur de la pièce ──────────
   ≤ 25 cm → S  |  26–50 cm → M  |  51–100 cm → L  |  > 100 cm → SOL
   ──────────────────────────────────────────────────────────────── */
function gabaritDepuisHauteur(hauteurCm) {
  if (!hauteurCm)      return 'M';
  if (hauteurCm <= 25) return 'S';
  if (hauteurCm <= 50) return 'M';
  if (hauteurCm <= 100) return 'L';
  return 'SOL';
}

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

  const socle = document.createElement('div');
  socle.className = 'socle socle--' + gCode;
  socle.setAttribute('aria-label', piece.titre || 'Sculpture');

  /* Dimensions visuelles proportionnelles aux vraies mesures cm */
  const dim    = piece.dimensions || {};
  const viewerH = Math.min(ECHELLE_MAXH, Math.max(ECHELLE_MIN, Math.round((dim.hauteur || 50) * ECHELLE)));
  const socleW  = Math.max(ECHELLE_MIN,  Math.round((dim.largeur  || 30) * ECHELLE));
  socle.style.width = socleW + 'px';

  if (piece.glb) {
    const glbSrc = /^https?:\/\//.test(piece.glb)
      ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;
    const viewer = document.createElement('model-viewer');
    viewer.setAttribute('src',              glbSrc);
    viewer.setAttribute('alt',              piece.titre || '');
    viewer.setAttribute('auto-rotate',      '');
    viewer.setAttribute('camera-controls',  '');
    viewer.setAttribute('shadow-intensity', '0.8');
    viewer.className    = 'socle-viewer-inline';
    viewer.style.height = viewerH + 'px';
    socle.appendChild(viewer);
  } else {
    const ph = document.createElement('div');
    ph.className    = 'socle-placeholder';
    ph.style.height = viewerH + 'px';
    socle.appendChild(ph);
  }

  const ped = document.createElement('div');
  ped.className = 'socle-piedestal socle-piedestal--' + gCode;
  const ombre = document.createElement('div');
  ombre.className = 'socle-ombre';
  ped.appendChild(ombre);
  socle.appendChild(ped);

  if (piece.titre) {
    const titre = document.createElement('div');
    titre.className   = 'socle-titre';
    titre.textContent = piece.titre;
    socle.appendChild(titre);
  }

  wrapper.appendChild(socle);
  return wrapper;
}

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
    nomEl.className   = 'nom-salle';
    nomEl.textContent = salle.nom || ('Salle ' + NOMS_ROMAINS[salle.id - 1]);
    salleDiv.appendChild(nomEl);

    const plancher = creerPlancher(si + 1, salles.length, salles, NOMS_ROMAINS, salle.couleur_mur);

    /* Supprimer les silhouettes — elles gênent les sculptures */
    const sils = plancher.querySelector('.silhouettes-sol');
    if (sils) sils.remove();

    /* Socles sur le parquet */
    const plancherSol = plancher.querySelector('.plancher-sol');
    if (plancherSol) {
      (salle.positions || []).slice().sort((a, b) => b.y - a.y).forEach(pos => {
        const piece = pieces[pos.id];
        if (!piece) return;
        /* Gabarit : explicite dans positions, sinon calculé depuis dimensions.hauteur */
        const gCode   = pos.gabarit || gabaritDepuisHauteur(piece.dimensions && piece.dimensions.hauteur);
        const gabarit = gabarits[gCode] || gabarits['M'];
        plancherSol.appendChild(creerSocle(piece, gabarit, pos));
      });
      /* Grille de repérage — outil de travail */
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
