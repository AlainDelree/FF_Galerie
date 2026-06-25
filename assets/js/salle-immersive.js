/* =============================================================
   FF_Galerie — salle-immersive.js
   Salle d'observation 3D avec Three.js
   Charge Three.js + GLTFLoader dynamiquement
   ============================================================= */

let _threeLoaded = false;
let _immRAF = null;

/* ── Charger Three.js + GLTFLoader ── */
function chargerThreeJS() {
  return new Promise((resolve) => {
    if (_threeLoaded) return resolve();
    const s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s1.onload = () => {
      /* GLTFLoader pour r128 — version globale (non-module) */
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
      s2.onload = () => { _threeLoaded = true; resolve(); };
      s2.onerror = () => {
        /* Fallback : pas de GLB, placeholder géométrique */
        console.warn('GLTFLoader indisponible, mode placeholder');
        _threeLoaded = true; resolve();
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
}

/* ══════════════════════════════════════════════════════════════
   SALLE IMMERSIVE THREE.JS
   ══════════════════════════════════════════════════════════════ */
/* Convertit '#rrggbb' en entier 0xrrggbb pour Three.js */
function _hexToInt(hex) {
  if (!hex || typeof hex !== 'string') return null;
  return parseInt(hex.replace('#', ''), 16) || null;
}

/* Décor par défaut (valeurs originales) */
var DECOR_IMMERSIVE_DEFAUT = {
  fond:            '#12100c',   /* atmosphère/fog (non exposé en config) */
  exposure:        1.0,         /* exposition renderer (0.5–3.0) */
  sol:             '#8a6228',
  socle_couleur:   '#f0ece4',   /* couleur par défaut du socle */
  socle_use_piece: false,       /* si true : utilise piece.support.couleur */
  pan_a:  '#7a2525',        /* palette des 12 panneaux du mur */
  pan_b:  '#1a3055',
  pan_c:  '#2a5035',
  pan_d:  '#a04820',
  piquet: '#c8a050',
  corde:  '#8b0020'
};

async function ouvrirSalleImmersive(piece, decor, descDecor) {
  if (document.querySelector('.imm-overlay')) return;
  await chargerThreeJS();

  /* Fusion décor reçu + valeurs par défaut */
  var D = Object.assign({}, DECOR_IMMERSIVE_DEFAUT, decor || {});
  var C_FOND   = _hexToInt(D.fond)   || 0x12100c;
  var C_SOL    = _hexToInt(D.sol)    || 0x8a6228;
  var C_PIQUET = _hexToInt(D.piquet) || 0xc8a050;
  var C_CORDE  = _hexToInt(D.corde)  || 0x8b0020;
  /* Socle : couleur selon decor.socle_use_piece */
  var C_SOCLE  = ((D.socle_use_piece && piece.support && piece.support.couleur)
    ? (_hexToInt(piece.support.couleur) || _hexToInt(D.socle_couleur) || 0xf0ece4)
    : (_hexToInt(D.socle_couleur) || 0xf0ece4));

  const VW = window.innerWidth;
  const VH = window.innerHeight;

  /* ── Overlay plein écran ── */
  const overlay = document.createElement('div');
  overlay.className = 'imm-overlay';
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;' +
    'background:#000;opacity:0;transition:opacity .4s ease;';

  /* ── Canvas Three.js ── */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);

  /* ── UI overlay ── */
  const titre = document.createElement('div');
  titre.style.cssText =
    'position:absolute;top:0;left:0;width:100%;text-align:center;z-index:10;' +
    'padding:14px 0 18px;' +
    'font-family:Cinzel,serif;font-size:1rem;letter-spacing:.2em;color:rgba(240,208,128,.9);' +
    'background:linear-gradient(to bottom,rgba(0,0,0,.6),rgba(0,0,0,.25),transparent);';
  titre.textContent = piece.titre || '';
  overlay.appendChild(titre);

  const meta = document.createElement('div');
  meta.style.cssText =
    'position:absolute;bottom:0;left:0;width:100%;text-align:center;z-index:10;' +
    'padding:18px 0 14px;' +
    'font-family:Lato,sans-serif;font-size:.75rem;letter-spacing:.08em;color:rgba(255,255,255,.5);' +
    'background:linear-gradient(to top,rgba(0,0,0,.6),rgba(0,0,0,.25),transparent);';
  const dim = piece.dimensions || {};
  const parts = [];
  if (piece.materiaux && piece.materiaux.length) parts.push(piece.materiaux.join(', '));
  const dp = [dim.largeur, dim.profondeur, dim.hauteur].filter(Boolean);
  if (dp.length) parts.push(dp.join(' \u00d7 ') + '\u202fcm');
  meta.textContent = parts.join('\u2002\u00b7\u2002');
  overlay.appendChild(meta);

  const btnFermer = document.createElement('button');
  btnFermer.className = 'obs-fermer';
  btnFermer.setAttribute('aria-label', 'Fermer');
  btnFermer.innerHTML = '\u2715';
  overlay.appendChild(btnFermer);

  /* ── Porte gauche → retour galerie ── */
  const porteG = document.createElement('div');
  porteG.className = 'porte-nav porte-nav--gauche';
  porteG.innerHTML = '<div class="porte-nav__arche"></div>' +
    '<span class="porte-nav__fleche">\u2190</span>' +
    '<span class="porte-nav__label">Galerie</span>';
  porteG.addEventListener('click', fermer);
  overlay.appendChild(porteG);

  /* ── Porte droite → salle d'observation (détail) ── */
  const porteD = document.createElement('div');
  porteD.className = 'porte-nav porte-nav--droite';
  porteD.innerHTML = '<div class="porte-nav__arche"></div>' +
    '<span class="porte-nav__fleche">\u2192</span>' +
    '<span class="porte-nav__label">D\u00e9tail</span>';
  porteD.addEventListener('click', () => {
    const ecran = document.createElement('div');
    ecran.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;';
    document.body.appendChild(ecran);
    fermer();
    setTimeout(() => {
      if (typeof ouvrirSalleObservation === 'function') ouvrirSalleObservation(piece, descDecor, true);
      setTimeout(() => ecran.remove(), 150);
    }, 350);
  });
  overlay.appendChild(porteD);

  /* ── Pancartes mobiles ── */
  const plaqueG = document.createElement('div');
  plaqueG.className = 'plaque-nav plaque-nav--gauche';
  plaqueG.innerHTML = '<span class="plaque-nav__label">\u2190 Galerie</span>';
  plaqueG.addEventListener('click', fermer);
  overlay.appendChild(plaqueG);

  const plaqueD2 = document.createElement('div');
  plaqueD2.className = 'plaque-nav plaque-nav--droite';
  plaqueD2.innerHTML = '<span class="plaque-nav__label">D\u00e9tail \u2192</span>';
  plaqueD2.addEventListener('click', () => {
    const ecran = document.createElement('div');
    ecran.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;';
    document.body.appendChild(ecran);
    fermer();
    setTimeout(() => {
      if (typeof ouvrirSalleObservation === 'function') ouvrirSalleObservation(piece, descDecor, true);
      setTimeout(() => ecran.remove(), 150);
    }, 350);
  });
  overlay.appendChild(plaqueD2);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  window.scrollTo(0, 0);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  /* ══ THREE.JS SCENE ══ */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(VW, VH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = (typeof D.exposure === 'number') ? D.exposure : 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C_FOND);
  scene.fog = new THREE.Fog(C_FOND, 10, 22);

  const camera = new THREE.PerspectiveCamera(50, VW / VH, 0.1, 50);
  camera.position.set(0, 2.2, 5);
  camera.lookAt(0, 1, 0);

  /* ── Éclairage — galerie bien éclairée ── */
  const ambient = new THREE.AmbientLight(0xfff8f0, 0.7);
  scene.add(ambient);

  const spot = new THREE.SpotLight(0xfff0d0, 1.8, 14, Math.PI / 5, 0.5);
  spot.position.set(0, 6, 0);
  spot.target.position.set(0, 1.1, 0);
  spot.castShadow = true;
  scene.add(spot);
  scene.add(spot.target);

  const fill1 = new THREE.PointLight(0xfff0d0, 0.6, 12);
  fill1.position.set(-3, 3, 2);
  scene.add(fill1);

  const fill2 = new THREE.PointLight(0xe0e8ff, 0.4, 12);
  fill2.position.set(3, 2.5, -2);
  scene.add(fill2);

  const fill3 = new THREE.PointLight(0xfff0d0, 0.3, 10);
  fill3.position.set(0, 3, -4);
  scene.add(fill3);

  /* Environment pour matériaux PBR des GLB */
  const hemiLight = new THREE.HemisphereLight(0xfff8f0, C_SOL, 0.5);
  scene.add(hemiLight);

  /* ── SOL — parquet ── */
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    color: C_SOL, roughness: 0.75, metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ── MURS — cylindre intérieur avec panneaux colorés ── */
  const WALL_R  = 6;
  const WALL_H  = 5;
  const SEGMENTS = 12;
  const _PALETTE = [
    _hexToInt(D.pan_a) || 0x7a2525,
    _hexToInt(D.pan_b) || 0x1a3055,
    _hexToInt(D.pan_c) || 0x2a5035,
    _hexToInt(D.pan_d) || 0xa04820
  ];
  for (let i = 0; i < SEGMENTS; i++) {
    const geo = new THREE.CylinderGeometry(
      WALL_R, WALL_R, WALL_H, 1, 1, true,
      i * Math.PI * 2 / SEGMENTS, Math.PI * 2 / SEGMENTS
    );
    const mat = new THREE.MeshStandardMaterial({
      color: _PALETTE[i % _PALETTE.length], side: THREE.BackSide, roughness: 0.85
    });
    const panel = new THREE.Mesh(geo, mat);
    panel.position.y = WALL_H / 2;
    scene.add(panel);
  }

  /* Lignes séparatrices entre panneaux */
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * Math.PI * 2 / SEGMENTS;
    const geo = new THREE.CylinderGeometry(0.015, 0.015, WALL_H, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8e0cc });
    const line = new THREE.Mesh(geo, mat);
    line.position.set(Math.sin(a) * (WALL_R - 0.01), WALL_H / 2, Math.cos(a) * (WALL_R - 0.01));
    scene.add(line);
  }

  /* ── PIÉDESTAL marbre ── */
  const pedGeo = new THREE.CylinderGeometry(0.35, 0.38, 1.1, 24);
  const pedMat = new THREE.MeshStandardMaterial({
    color: C_SOCLE, roughness: 0.35, metalness: 0.02
  });
  const pedestal = new THREE.Mesh(pedGeo, pedMat);
  pedestal.position.y = 0.55;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  /* ── PIQUETS dorés (4) ── */
  const PIQ_R     = 0.03;
  const PIQ_H     = 1.0;
  const PIQ_DIST  = 1.2;
  const CORDE_H   = 0.72;
  const stanchions = [];

  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const x = Math.sin(a) * PIQ_DIST;
    const z = Math.cos(a) * PIQ_DIST;

    /* Colonne */
    const colGeo = new THREE.CylinderGeometry(PIQ_R, PIQ_R, PIQ_H, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: C_PIQUET, metalness: 0.7, roughness: 0.3 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, PIQ_H / 2, z);
    col.castShadow = true;
    scene.add(col);

    /* Chapeau */
    const capGeo = new THREE.SphereGeometry(0.06, 12, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: C_PIQUET, metalness: 0.8, roughness: 0.2 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, PIQ_H + 0.03, z);
    scene.add(cap);

    /* Base */
    const baseGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.04, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: C_PIQUET, metalness: 0.6, roughness: 0.4 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(x, 0.02, z);
    scene.add(base);

    stanchions.push({ x, z });
  }

  /* ── CORDE velours entre piquets ── */
  for (let i = 0; i < 4; i++) {
    const s1 = stanchions[i];
    const s2 = stanchions[(i + 1) % 4];
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(s1.x, CORDE_H, s1.z),
      new THREE.Vector3((s1.x + s2.x) / 2, CORDE_H - 0.12, (s1.z + s2.z) / 2),
      new THREE.Vector3(s2.x, CORDE_H, s2.z)
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.018, 6, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: C_CORDE, roughness: 0.8 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.castShadow = true;
    scene.add(tube);
  }

  /* ── Charger le GLB ── */
  const glbSrc = /^https?:\/\//.test(piece.glb)
    ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;

  /* ── Barre de chargement ── */
  const loadWrap = document.createElement('div');
  loadWrap.style.cssText =
    'position:absolute;bottom:50%;left:50%;transform:translate(-50%,50%);z-index:25;' +
    'display:flex;flex-direction:column;align-items:center;gap:10px;';
  const loadText = document.createElement('div');
  loadText.style.cssText =
    'font-family:Cinzel,serif;font-size:1rem;color:rgba(240,208,128,.9);letter-spacing:.15em;';
  loadText.textContent = 'Chargement\u2026';
  const loadBar = document.createElement('div');
  loadBar.style.cssText =
    'width:180px;height:5px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden;';
  const loadFill = document.createElement('div');
  loadFill.style.cssText =
    'width:0%;height:100%;background:rgba(240,208,128,.85);border-radius:3px;transition:width .15s;';
  loadBar.appendChild(loadFill);
  loadWrap.appendChild(loadText);
  loadWrap.appendChild(loadBar);
  overlay.appendChild(loadWrap);

  if (typeof THREE.GLTFLoader !== 'undefined') {
    const loader = new THREE.GLTFLoader();
    loader.load(glbSrc, (gltf) => {
      loadWrap.remove();
      const model = gltf.scene;
      const box  = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxD = Math.max(size.x, size.y, size.z);
      const targetH = 0.8;
      const s = targetH / maxD;
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = 1.1 - box2.min.y;
      model.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          /* Booster la luminosité des modèles photogrammétriques */
          if (c.material) {
            c.material.metalness = Math.min(c.material.metalness, 0.15);
            c.material.roughness = Math.max(c.material.roughness, 0.6);
            c.material.envMapIntensity = 2.0;
            c.material.needsUpdate = true;
          }
        }
      });
      scene.add(model);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round(progress.loaded / progress.total * 100);
        loadFill.style.width = pct + '%';
        loadText.textContent = pct + '%';
      }
    },
    () => { loadText.textContent = 'Erreur de chargement'; });
  } else {
    /* Placeholder si GLTFLoader absent */
    const phGeo = new THREE.BoxGeometry(0.5, 0.4, 0.3);
    const phMat = new THREE.MeshStandardMaterial({ color: 0x7a5028, roughness: 0.6 });
    const ph = new THREE.Mesh(phGeo, phMat);
    ph.position.y = 1.35;
    ph.castShadow = true;
    scene.add(ph);
  }

  /* ══ ANIMATION — caméra orbite autour ══ */
  const CAM_R     = 4.5;
  const CAM_Y     = 2.0;
  const CAM_SPEED = Math.PI * 2 / 24; /* 1 tour en 24 secondes */
  let angle       = 0;
  let lastT       = performance.now();
  let dragging    = false;
  let dragStartX  = 0;
  let dragAngle   = 0;

  /* Contrôle tactile/souris */
  canvas.addEventListener('pointerdown', e => {
    dragging   = true;
    dragStartX = e.clientX;
    dragAngle  = angle;
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    angle = dragAngle - dx * 0.005;
  });
  canvas.addEventListener('pointerup',    () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { dragging = false; });

  function animate() {
    const now = performance.now();
    const dt  = (now - lastT) / 1000;
    lastT     = now;

    if (!dragging) angle += CAM_SPEED * dt;

    camera.position.x = Math.sin(angle) * CAM_R;
    camera.position.z = Math.cos(angle) * CAM_R;
    camera.position.y = CAM_Y;
    camera.lookAt(0, 1.1, 0);

    renderer.render(scene, camera);
    _immRAF = requestAnimationFrame(animate);
  }
  animate();

  /* Resize */
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  /* ── Fermeture ── */
  function fermer() {
    if (_immRAF) { cancelAnimationFrame(_immRAF); _immRAF = null; }
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }, 350);
  }

  btnFermer.addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
  const onKey = e => {
    if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

/* ══════════════════════════════════════════════════════════════
   APERÇU IMMERSIF (mode iframe — pour l'admin TDB)
   Rend la scène dans un canvas fourni, retourne { updateDecor, dispose }
   ══════════════════════════════════════════════════════════════ */
async function renderImmersiveApercu(canvas, piece, decor) {
  await chargerThreeJS();

  var D = Object.assign({}, DECOR_IMMERSIVE_DEFAUT, decor || {});

  var VW = canvas.width  || window.innerWidth;
  var VH = canvas.height || window.innerHeight;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(VW, VH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = (typeof D.exposure === 'number') ? D.exposure : 1.0;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(_hexToInt(D.fond) || 0x12100c);
  scene.fog = new THREE.Fog(_hexToInt(D.fond) || 0x12100c, 10, 22);

  var camera = new THREE.PerspectiveCamera(50, VW / VH, 0.1, 50);
  camera.position.set(0, 2.2, 5);
  camera.lookAt(0, 1, 0);

  /* Éclairage */
  scene.add(new THREE.AmbientLight(0xfff8f0, 0.7));
  var spot = new THREE.SpotLight(0xfff0d0, 1.8, 14, Math.PI / 5, 0.5);
  spot.position.set(0, 6, 0); spot.target.position.set(0, 1.1, 0);
  spot.castShadow = true; scene.add(spot); scene.add(spot.target);
  var fill1 = new THREE.PointLight(0xfff0d0, 0.6, 12);
  fill1.position.set(-3, 3, 2); scene.add(fill1);
  var fill2 = new THREE.PointLight(0xe0e8ff, 0.4, 12);
  fill2.position.set(3, 2.5, -2); scene.add(fill2);
  var fill3 = new THREE.PointLight(0xfff0d0, 0.3, 10);
  fill3.position.set(0, 3, -4); scene.add(fill3);
  var hemi = new THREE.HemisphereLight(0xfff8f0, _hexToInt(D.sol) || 0x8a6228, 0.5);
  scene.add(hemi);

  /* Sol */
  var floorMat = new THREE.MeshStandardMaterial({ color: _hexToInt(D.sol) || 0x8a6228, roughness: 0.75, metalness: 0.05 });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* Murs */
  var WALL_R = 6, WALL_H = 5, SEG = 12;
  var wallMats = [];
  var _pal = [
    _hexToInt(D.pan_a) || 0x7a2525,
    _hexToInt(D.pan_b) || 0x1a3055,
    _hexToInt(D.pan_c) || 0x2a5035,
    _hexToInt(D.pan_d) || 0xa04820
  ];
  for (var i = 0; i < SEG; i++) {
    var wMat = new THREE.MeshStandardMaterial({ color: _pal[i % _pal.length], side: THREE.BackSide, roughness: 0.85 });
    wallMats.push(wMat);
    var wGeo = new THREE.CylinderGeometry(WALL_R, WALL_R, WALL_H, 1, 1, true, i * Math.PI * 2 / SEG, Math.PI * 2 / SEG);
    var panel = new THREE.Mesh(wGeo, wMat); panel.position.y = WALL_H / 2; scene.add(panel);
    var a = i * Math.PI * 2 / SEG;
    var line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, WALL_H, 4), new THREE.MeshBasicMaterial({ color: 0xe8e0cc }));
    line.position.set(Math.sin(a) * (WALL_R - 0.01), WALL_H / 2, Math.cos(a) * (WALL_R - 0.01)); scene.add(line);
  }

  /* Piédestal */
  var C_SOCLE = ((D.socle_use_piece && piece.support && piece.support.couleur)
    ? (_hexToInt(piece.support.couleur) || _hexToInt(D.socle_couleur) || 0xf0ece4)
    : (_hexToInt(D.socle_couleur) || 0xf0ece4));
  var pedMat = new THREE.MeshStandardMaterial({ color: C_SOCLE, roughness: 0.35, metalness: 0.02 });
  var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 1.1, 24), pedMat);
  ped.position.y = 0.55; ped.castShadow = true; ped.receiveShadow = true; scene.add(ped);

  /* Piquets + corde */
  var PIQ_R = 0.03, PIQ_H = 1.0, PIQ_DIST = 1.2, CORDE_H = 0.72;
  var piqMats = [], cordMats = [], stanchions = [];
  for (var j = 0; j < 4; j++) {
    var pA = j * Math.PI / 2, px = Math.sin(pA) * PIQ_DIST, pz = Math.cos(pA) * PIQ_DIST;
    var cM = new THREE.MeshStandardMaterial({ color: _hexToInt(D.piquet) || 0xc8a050, metalness: 0.7, roughness: 0.3 });
    piqMats.push(cM);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(PIQ_R, PIQ_R, PIQ_H, 8), cM);
    col.position.set(px, PIQ_H / 2, pz); col.castShadow = true; scene.add(col);
    var capM = new THREE.MeshStandardMaterial({ color: _hexToInt(D.piquet) || 0xc8a050, metalness: 0.8, roughness: 0.2 });
    piqMats.push(capM);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), capM);
    cap.position.set(px, PIQ_H + 0.03, pz); scene.add(cap);
    var baseM = new THREE.MeshStandardMaterial({ color: _hexToInt(D.piquet) || 0xc8a050, metalness: 0.6, roughness: 0.4 });
    piqMats.push(baseM);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.04, 12), baseM);
    base.position.set(px, 0.02, pz); scene.add(base);
    stanchions.push({ x: px, z: pz });
  }
  for (var k = 0; k < 4; k++) {
    var s1 = stanchions[k], s2 = stanchions[(k + 1) % 4];
    var curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(s1.x, CORDE_H, s1.z),
      new THREE.Vector3((s1.x + s2.x) / 2, CORDE_H - 0.12, (s1.z + s2.z) / 2),
      new THREE.Vector3(s2.x, CORDE_H, s2.z)
    );
    var cordM = new THREE.MeshStandardMaterial({ color: _hexToInt(D.corde) || 0x8b0020, roughness: 0.8 });
    cordMats.push(cordM);
    var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 6, false), cordM);
    tube.castShadow = true; scene.add(tube);
  }

  /* GLB (si disponible) */
  var glbSrc = piece && piece.glb
    ? (/^https?:\/\//.test(piece.glb) ? piece.glb : ((window.GALERIE_CFG && window.GALERIE_CFG.assetsBase) || '') + piece.glb)
    : null;
  if (glbSrc && window.THREE && THREE.GLTFLoader) {
    try {
      var loader = new THREE.GLTFLoader();
      loader.load(glbSrc, function(gltf) {
        var obj = gltf.scene;
        var box = new THREE.Box3().setFromObject(obj);
        var size = new THREE.Vector3(); box.getSize(size);
        var cx = new THREE.Vector3(); box.getCenter(cx);
        var scale = Math.min(1.0 / Math.max(size.x, size.y, size.z), 2.0);
        obj.scale.setScalar(scale);
        obj.position.set(-cx.x * scale, (1.1 - box.min.y * scale), -cx.z * scale);
        scene.add(obj);
      });
    } catch(e) {}
  } else if (glbSrc === null) {
    /* Pas de GLB — cadre suspendu avec la photo de la pièce, ou boîte neutre */
    var photoUrl = (piece && piece.photo)
      ? (/^https?:\/\//.test(piece.photo) ? piece.photo
          : ((window.GALERIE_CFG && window.GALERIE_CFG.assetsBase) || '') + piece.photo)
      : null;
    if (photoUrl) {
      var texLoader = new THREE.TextureLoader();
      texLoader.load(photoUrl, function(tex) {
        var imgW = (tex.image && tex.image.naturalWidth)  || tex.image.width  || 3;
        var imgH = (tex.image && tex.image.naturalHeight) || tex.image.height || 4;
        var aspect = imgW / imgH;
        var fH = 0.75, fW = fH * aspect;
        var border = 0.03;
        /* Cadre (moulure dorée) */
        var cadreM = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.4, metalness: 0.5 });
        var cadreG = new THREE.BoxGeometry(fW + border * 2, fH + border * 2, 0.02);
        var cadreMesh = new THREE.Mesh(cadreG, cadreM);
        cadreMesh.position.set(0, 1.55, 0); cadreMesh.castShadow = true; scene.add(cadreMesh);
        /* Photo (plane légèrement devant le cadre) */
        var photoM = new THREE.MeshBasicMaterial({ map: tex });
        var photoG = new THREE.PlaneGeometry(fW, fH);
        var photoMesh = new THREE.Mesh(photoG, photoM);
        photoMesh.position.set(0, 1.55, 0.012); scene.add(photoMesh);
        /* Fil de suspension */
        var filM = new THREE.LineBasicMaterial({ color: 0xc8a050 });
        var filPts = [new THREE.Vector3(0, 1.55 + fH / 2 + border, 0), new THREE.Vector3(0, 2.8, 0)];
        var filG = new THREE.BufferGeometry().setFromPoints(filPts);
        scene.add(new THREE.Line(filG, filM));
      }, undefined, function() {
        /* Erreur chargement photo → boîte neutre */
        var phM = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.7 });
        var phMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.04), phM);
        phMesh.position.y = 1.55; scene.add(phMesh);
      });
    } else {
      /* Ni GLB ni photo — boîte neutre sobre */
      var phMat2 = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.7 });
      var ph2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.04), phMat2);
      ph2.position.y = 1.55; ph2.castShadow = true; scene.add(ph2);
    }
  }

  /* Boucle */
  var _raf = null, angle = 0, lastT = performance.now();
  function animate() {
    var now = performance.now();
    angle += 0.2 * (now - lastT) / 1000; lastT = now;
    camera.position.x = Math.sin(angle) * 5;
    camera.position.z = Math.cos(angle) * 5;
    camera.position.y = 2.2;
    camera.lookAt(0, 1.1, 0);
    renderer.render(scene, camera);
    _raf = requestAnimationFrame(animate);
  }
  animate();

  /* Resize */
  window.addEventListener('resize', function() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return {
    updateDecor: function(newDecor) {
      var D2 = Object.assign({}, DECOR_IMMERSIVE_DEFAUT, newDecor || {});
      floorMat.color.setHex(_hexToInt(D2.sol) || 0x8a6228);
      hemi.groundColor.setHex(_hexToInt(D2.sol) || 0x8a6228);
      scene.background = new THREE.Color(_hexToInt(D2.fond) || 0x12100c);
      scene.fog.color.setHex(_hexToInt(D2.fond) || 0x12100c);
      var _pal2 = [
        _hexToInt(D2.pan_a) || 0x7a2525,
        _hexToInt(D2.pan_b) || 0x1a3055,
        _hexToInt(D2.pan_c) || 0x2a5035,
        _hexToInt(D2.pan_d) || 0xa04820
      ];
      wallMats.forEach(function(m, idx) { m.color.setHex(_pal2[idx % _pal2.length]); });
      piqMats.forEach(function(m)  { m.color.setHex(_hexToInt(D2.piquet) || 0xc8a050); });
      cordMats.forEach(function(m) { m.color.setHex(_hexToInt(D2.corde)  || 0x8b0020); });
      if (typeof D2.exposure === 'number') renderer.toneMappingExposure = D2.exposure;
      var _newSocle = ((D2.socle_use_piece && piece && piece.support && piece.support.couleur)
        ? (_hexToInt(piece.support.couleur) || _hexToInt(D2.socle_couleur) || 0xf0ece4)
        : (_hexToInt(D2.socle_couleur) || 0xf0ece4));
      pedMat.color.setHex(_newSocle);
    },
    dispose: function() { cancelAnimationFrame(_raf); renderer.dispose(); }
  };
}
