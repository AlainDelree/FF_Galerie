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
    { p:[960,0, 1080,0, 1080,25, 933,27],              c:0 }, /* bord droit = bord gauche */
    /* ── Zone médiane (entre L1 et L2) ── */
    { p:[0,40, 255,37, 299,66, 0,70],                  c:3 },
    { p:[255,37, 552,32, 582,62, 299,66],              c:5 },
    { p:[552,32, 750,30, 720,60, 582,62],              c:7 },
    { p:[750,30, 933,27, 903,58, 720,60],              c:8 },
    { p:[933,27, 1080,25, 1080,55, 903,58],            c:3 }, /* bord droit = bord gauche */
    /* ── Zone basse (sous L2) ── */
    { p:[0,70, 299,66, 350,100, 0,100],                c:9 },
    { p:[299,66, 582,62, 620,100, 350,100],            c:0 },
    { p:[582,62, 720,60, 680,100, 620,100],            c:2 },
    { p:[720,60, 903,58, 860,100, 680,100],            c:5 },
    { p:[903,58, 1080,55, 1080,100, 860,100],          c:9 }, /* bord droit = bord gauche */
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

  /* ── Porte en arc — x=490→555, arche à y=44, base à y=100 ── */
  /* Cadre extérieur or */
  s += `<path d="M487,${H} L487,45 A36,36,0,0,0,558,45 L558,${H}" fill="none" stroke="#c8a050" stroke-width="3.5"/>`;
  /* Ouverture (ombre profonde) */
  s += `<path d="M490,${H} L490,44 A32.5,32.5,0,0,0,555,44 L555,${H} Z" fill="#060402"/>`;
  /* Moulure intérieure */
  s += `<path d="M494,${H} L494,48 A28.5,28.5,0,0,0,551,48 L551,${H}" fill="none" stroke="rgba(200,160,80,.35)" stroke-width="1.5"/>`;
  /* Cimaise (bandeau au-dessus de la porte) */
  s += `<rect x="481" y="5" width="83" height="6" rx="1" fill="#c8a050" opacity="0.55"/>`;
  /* Poignée */
  s += `<circle cx="549" cy="73" r="3.5" fill="#f0d080"/>`;
  s += `<circle cx="549" cy="73" r="2" fill="#c8a050"/>`;

  s += '</svg>';
  const blob = new Blob([s], { type:'image/svg+xml' });
  return URL.createObjectURL(blob);
}

let _obsRAF    = null;
let _obsTheta  = 0;
let _obsPaused = false;
const OBS_SPEED  = 0.3;          /* °/frame — vitesse orbite caméra */
const OBS_BG_W   = 2160;         /* px — un tour complet (assez large pour 1 seule porte visible) */
const OBS_SCALE  = OBS_BG_W / 90; /* 4 pilastres par révolution (360°/4 = 90°) */

/* ── Texture marbre pour le socle ───────────────────────────── */
function creerSocleSVG(w, h) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
  s += `<rect width="${w}" height="${h}" fill="#f3f3f3"/>`;
  const V = [[w*.12,0,w*.10,h*.3,w*.15,h*.65,w*.11,h,'#9aacb8',1.8,.70],
             [w*.12,0,w*.18,h*.28,w*.20,h*.6, w*.19,h,'#b0bec8', .9,.52],
             [w*.38,0,w*.35,h*.35,w*.42,h*.65,w*.36,h,'#8a9eaa',2.0,.66],
             [w*.40,h*.2,w*.46,h*.4,w*.50,h*.55,w*.47,h*.85,'#a0b0bc',.8,.50],
             [w*.62,0,w*.60,h*.30,w*.65,h*.68,w*.60,h,'#7a9098',1.6,.63],
             [w*.65,h*.1,w*.70,h*.32,w*.73,h*.55,w*.71,h*.92,'#9aacb8',.7,.46],
             [w*.85,0,w*.84,h*.38,w*.88,h*.68,w*.85,h,'#889aaa',1.5,.60]];
  V.forEach(([x1,y1,cx1,cy1,cx2,cy2,x2,y2,col,sw,op])=>{
    s += `<path d="M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${op}"/>`;
  });
  const BR = [[w*.14,h*.35,w*.22,h*.38,w*.30,h*.36,w*.36,h*.42,'#9aaebb',.7,.44],
              [w*.38,h*.55,w*.45,h*.58,w*.52,h*.55,w*.60,h*.62,'#9aaebb',.7,.40],
              [w*.62,h*.30,w*.70,h*.33,w*.78,h*.31,w*.85,h*.38,'#a0b0bc',.6,.38],
              [0,h*.22,w*.05,h*.26,w*.09,h*.30,w*.12,h*.36,'#9aacb8',1.0,.52],
              [w,h*.22,w*.95,h*.26,w*.91,h*.30,w*.88,h*.36,'#9aacb8',1.0,.52]];
  BR.forEach(([x1,y1,cx1,cy1,cx2,cy2,x2,y2,col,sw,op])=>{
    s += `<path d="M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${op}"/>`;
  });
  s += `<defs><linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="rgba(0,0,0,.20)"/>
    <stop offset="18%"  stop-color="rgba(0,0,0,.00)"/>
    <stop offset="65%"  stop-color="rgba(255,255,255,.06)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,.16)"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#cyl)"/>`;
  s += '</svg>';
  return URL.createObjectURL(new Blob([s], { type:'image/svg+xml' }));
}

function ouvrirSalleObservation(piece) {
  if (document.querySelector('.obs-overlay')) return;
  chargerModelViewer();

  /* ── Mesures ─────────────────────────────────────── */
  const VW    = window.innerWidth;
  const VH    = window.innerHeight;
  const MOB   = VW <= 600;
  const VW2   = VW / 2;

  const VIEW_W  = Math.min(Math.round(VW * 0.88), 580);
  const VIEW_H  = Math.min(Math.round(VH * 0.44), 360);
  const SOC_W   = Math.round(VIEW_W * 0.44);
  const SOC_H   = MOB ? 78 : 110;
  const SOC_R   = SOC_W / 2;
  const SOC_CIRC = Math.round(Math.PI * 2 * SOC_R);

  const TITLE_H  = 44;
  const META_H   = 32;
  const FLOOR_H  = Math.round(VH * 0.22);
  const TOP_Y    = Math.max(8, Math.round((VH - FLOOR_H - TITLE_H - VIEW_H - SOC_H - META_H) / 2));
  const VIEW_TOP = TOP_Y + TITLE_H;
  const SOC_TOP  = VIEW_TOP + VIEW_H;
  const FLOOR_Y  = SOC_TOP + SOC_H;

  const ORB_CX   = VW2;
  const ORB_CY   = FLOOR_Y;
  const ORB_RX   = Math.round(VIEW_W * 0.52);
  const ORB_RY   = MOB ? 20 : 30;
  const PIQ_H    = MOB ? 110 : 150;
  const SOCLE_EDGE_Y = SOC_TOP + Math.round(SOC_H * 0.38);

  /* ── Overlay ─────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.className = 'obs-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;' +
    'overflow:hidden;opacity:0;transition:opacity .35s ease;background:#0e0a06;';

  /* 1. MUR */
  const chambre = document.createElement('div');
  chambre.className = 'obs-chambre';
  const murs = document.createElement('div');
  murs.className = 'obs-murs-mobiles';
  const murUrl = creerMurSVG();
  murs.style.backgroundImage = `url('${murUrl}')`;
  murs.style.cssText += 'top:0;bottom:' + FLOOR_H + 'px;';
  chambre.appendChild(murs);
  overlay.appendChild(chambre);

  /* 2. PARQUET (tourne autour de la base du socle) */
  const parquetWrap = document.createElement('div');
  parquetWrap.style.cssText =
    `position:absolute;left:0;top:${FLOOR_Y}px;width:100%;height:${FLOOR_H + 20}px;overflow:hidden;`;
  const PQ = Math.round(Math.sqrt(VW * VW + VH * VH) * 1.2);
  const parquetEl = document.createElement('div');
  parquetEl.style.cssText =
    `position:absolute;left:${-PQ}px;top:${-PQ / 3}px;` +
    `width:${VW + PQ * 2}px;height:${FLOOR_H + PQ}px;` +
    `transform-origin:${PQ + VW2}px ${PQ / 3}px;` +
    `background-color:#8a6228;` +
    `background-image:` +
    `repeating-linear-gradient(to bottom,transparent 0px,transparent 17px,rgba(0,0,0,.18) 17px,rgba(0,0,0,.18) 19px),` +
    `repeating-linear-gradient(to right,transparent 0px,transparent 58px,rgba(0,0,0,.08) 58px,rgba(0,0,0,.08) 60px);`;
  parquetWrap.appendChild(parquetEl);
  overlay.appendChild(parquetWrap);

  /* 3. CORDE SVG overlay */
  const cordeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cordeSvg.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:22;overflow:visible;';
  const ropePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ropePath.setAttribute('fill', 'none');
  ropePath.setAttribute('stroke', '#9e0020');
  ropePath.setAttribute('stroke-width', MOB ? '3.2' : '4');
  ropePath.setAttribute('stroke-linecap', 'round');
  cordeSvg.appendChild(ropePath);
  overlay.appendChild(cordeSvg);

  /* 4. PIQUETS (divs positionnés par RAF) */
  const piquets = Array.from({ length: 4 }, () => {
    const el = document.createElement('div');
    el.className = 'obs-piquet';
    el.style.position = 'absolute';
    overlay.appendChild(el);
    return el;
  });

  /* 5. SOCLE marbre */
  const socleWrap = document.createElement('div');
  socleWrap.style.cssText =
    `position:absolute;left:${VW2 - SOC_W / 2}px;top:${SOC_TOP}px;width:${SOC_W}px;z-index:18;`;
  const socleUrl  = creerSocleSVG(SOC_CIRC, SOC_H);
  const socleBody = document.createElement('div');
  socleBody.style.cssText =
    `width:100%;height:${SOC_H}px;border-radius:3px;overflow:hidden;` +
    `background-image:url('${socleUrl}');` +
    `background-size:${SOC_CIRC}px 100%;background-repeat:repeat-x;`;
  const socleTop = document.createElement('div');
  socleTop.style.cssText =
    `position:absolute;top:-9px;left:-12%;width:124%;height:18px;` +
    `background:radial-gradient(ellipse at 38% 38%,#fafafa 0%,#f0eeea 60%,#d8d4cc 100%);` +
    `border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.14);z-index:2;`;
  const socleBotEl = document.createElement('div');
  socleBotEl.style.cssText =
    `position:absolute;bottom:-6px;left:-8%;width:116%;height:12px;` +
    `background:radial-gradient(ellipse at 40% 30%,#e0ddd6 0%,#c8c4ba 100%);` +
    `border-radius:50%;clip-path:polygon(0% 50%,100% 50%,100% 100%,0% 100%);z-index:2;`;
  const ombre = document.createElement('div');
  ombre.style.cssText =
    `position:absolute;top:${SOC_H + 2}px;left:-20%;width:140%;height:14px;` +
    `background:rgba(0,0,0,.32);border-radius:50%;filter:blur(4px);`;
  socleWrap.appendChild(socleBody);
  socleWrap.appendChild(socleTop);
  socleWrap.appendChild(socleBotEl);
  socleWrap.appendChild(ombre);
  overlay.appendChild(socleWrap);

  /* 6. Titre */
  const titreEl = document.createElement('h2');
  titreEl.className   = 'obs-titre';
  titreEl.textContent = piece.titre || '';
  titreEl.style.cssText =
    `position:absolute;top:${TOP_Y}px;left:0;width:100%;text-align:center;z-index:30;`;
  overlay.appendChild(titreEl);

  /* 7. Viewer */
  const glbSrc = /^https?:\/\//.test(piece.glb)
    ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;
  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('src',                glbSrc);
  viewer.setAttribute('alt',                piece.titre || '');
  viewer.setAttribute('auto-rotate',        '');
  viewer.setAttribute('auto-rotate-delay',  '0');
  viewer.setAttribute('auto-rotate-speed',  '20deg/s');
  viewer.setAttribute('camera-controls',    '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('shadow-intensity',   '1');
  viewer.style.cssText =
    `position:absolute;left:${VW2 - VIEW_W / 2}px;top:${VIEW_TOP}px;` +
    `width:${VIEW_W}px;height:${VIEW_H}px;z-index:20;--poster-color:transparent;`;
  overlay.appendChild(viewer);

  /* 8. Meta */
  const meta = document.createElement('div');
  meta.className = 'obs-meta';
  const dim   = piece.dimensions || {};
  const mParts = [];
  if (piece.materiaux && piece.materiaux.length) mParts.push(piece.materiaux.join(', '));
  const dimParts = [dim.largeur, dim.profondeur, dim.hauteur].filter(Boolean);
  if (dimParts.length) mParts.push(dimParts.join(' \u00d7 ') + '\u202fcm');
  meta.textContent = mParts.join('\u2002\u00b7\u2002');
  meta.style.cssText =
    `position:absolute;bottom:${FLOOR_H + 8}px;left:0;width:100%;text-align:center;z-index:30;`;
  overlay.appendChild(meta);

  /* 9. Bouton fermer */
  const btnFermer = document.createElement('button');
  btnFermer.className = 'obs-fermer';
  btnFermer.setAttribute('aria-label', 'Fermer');
  btnFermer.innerHTML = '\u2715';
  overlay.appendChild(btnFermer);

  /* ── RAF : tout synchronisé ─────────────────────── */
  let wallPos = 0;
  const SOCLE_HALF = SOC_W / 2 + 6;

  (function obsFrame() {
    wallPos = (wallPos - 1 + OBS_BG_W) % OBS_BG_W;

    /* Mur */
    murs.style.backgroundPositionX = wallPos + 'px';

    /* Socle texture (rotation de la texture = cylindre qui tourne) */
    socleBody.style.backgroundPositionX =
      ((wallPos / OBS_BG_W) * SOC_CIRC % SOC_CIRC) + 'px';

    /* Parquet (tourne autour de la base du socle) */
    parquetEl.style.transform =
      'rotate(' + (wallPos / OBS_BG_W * 360).toFixed(2) + 'deg)';

    /* Piquets */
    const theta = wallPos / OBS_BG_W * Math.PI * 2;
    const pts = [0,1,2,3].map(i => {
      const a    = theta + i * Math.PI / 2;
      const sinA = Math.sin(a);
      const zn   = (sinA + 1) / 2;
      return {
        x: ORB_CX + ORB_RX * Math.cos(a),
        y: ORB_CY + ORB_RY * sinA,
        zn, sinA
      };
    });

    pts.forEach((p, i) => {
      const sc   = (0.60 + 0.40 * p.zn).toFixed(3);
      const op   = (0.28 + 0.72 * p.zn).toFixed(2);
      const h_px = Math.round(PIQ_H * (0.65 + 0.35 * p.zn));
      const bFromBottom = VH - p.y;
      piquets[i].style.cssText =
        `position:absolute;bottom:${bFromBottom}px;left:${(p.x - 6).toFixed(1)}px;` +
        `width:${Math.round(10 * (0.6 + 0.4 * p.zn))}px;height:${h_px}px;` +
        `transform-origin:bottom center;` +
        `opacity:${op};z-index:${p.sinA > 0 ? 28 : 8};`;
    });

    /* Corde */
    let ropeD = '';
    for (let i = 0; i < 4; i++) {
      const p1   = pts[i];
      const p2   = pts[(i + 1) % 4];
      const h1  = Math.round(PIQ_H * (0.65 + 0.35 * p1.zn));
      const h2  = Math.round(PIQ_H * (0.65 + 0.35 * p2.zn));
      const rh1  = h1 * 0.65;
      const rh2  = h2 * 0.65;
      let x1 = p1.x, y1 = p1.y - rh1;
      let x2 = p2.x, y2 = p2.y - rh2;

      /* Clip sur bord du socle si piquet derrière */
      if (p1.sinA < 0) {
        x1 = ORB_CX + (p1.x < ORB_CX ? -1 : 1) * SOCLE_HALF;
        y1 = SOCLE_EDGE_Y;
      }
      if (p2.sinA < 0) {
        x2 = ORB_CX + (p2.x < ORB_CX ? -1 : 1) * SOCLE_HALF;
        y2 = SOCLE_EDGE_Y;
      }

      if (Math.abs(x1 - x2) < 3 && Math.abs(y1 - y2) < 3) continue;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 10;
      ropeD += `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} `;
    }
    ropePath.setAttribute('d', ropeD.trim());

    _obsRAF = requestAnimationFrame(obsFrame);
  })();

  /* Fermeture */
  function fermer() {
    if (_obsRAF) { cancelAnimationFrame(_obsRAF); _obsRAF = null; }
    URL.revokeObjectURL(murUrl);
    URL.revokeObjectURL(socleUrl);
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow            = '';
      document.documentElement.style.overflow = '';
    }, 300);
  }

  btnFermer.addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
  const onKey = e => {
    if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.style.overflow            = 'hidden';
  document.documentElement.style.overflow = 'hidden';
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
