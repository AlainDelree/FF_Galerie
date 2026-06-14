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
async function ouvrirSalleImmersive(piece) {
  if (document.querySelector('.imm-overlay')) return;
  await chargerThreeJS();

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
    'position:absolute;top:16px;left:0;width:100%;text-align:center;z-index:10;' +
    'font-family:Cinzel,serif;font-size:1rem;letter-spacing:.2em;color:rgba(240,208,128,.85);';
  titre.textContent = piece.titre || '';
  overlay.appendChild(titre);

  const meta = document.createElement('div');
  meta.style.cssText =
    'position:absolute;bottom:16px;left:0;width:100%;text-align:center;z-index:10;' +
    'font-family:Lato,sans-serif;font-size:.75rem;letter-spacing:.08em;color:rgba(255,255,255,.38);';
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

  /* ── Bouton DÉTAIL → salle d'observation (model-viewer gros plan) ── */
  const btnDetail = document.createElement('button');
  btnDetail.style.cssText =
    'position:absolute;bottom:3.5rem;left:50%;transform:translateX(-50%);z-index:10;' +
    'padding:10px 24px;border-radius:6px;border:2px solid rgba(200,160,80,.6);' +
    'background:rgba(20,16,10,.75);color:rgba(240,208,128,.95);' +
    'font-family:Cinzel,serif;font-size:.85rem;letter-spacing:.15em;cursor:pointer;' +
    'backdrop-filter:blur(4px);';
  btnDetail.textContent = 'D\u00c9TAIL';
  btnDetail.addEventListener('click', () => {
    fermer();
    setTimeout(() => {
      if (typeof ouvrirSalleObservation === 'function') ouvrirSalleObservation(piece);
    }, 400);
  });
  overlay.appendChild(btnDetail);

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806);
  scene.fog = new THREE.Fog(0x0a0806, 8, 18);

  const camera = new THREE.PerspectiveCamera(50, VW / VH, 0.1, 50);
  camera.position.set(0, 2.2, 5);
  camera.lookAt(0, 1, 0);

  /* ── Éclairage ── */
  const ambient = new THREE.AmbientLight(0xfff0d8, 0.3);
  scene.add(ambient);

  const spot = new THREE.SpotLight(0xfff0d0, 1.2, 12, Math.PI / 6, 0.6);
  spot.position.set(0, 6, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  scene.add(spot);
  scene.add(spot.target);

  const fill1 = new THREE.PointLight(0xc8a050, 0.4, 10);
  fill1.position.set(-3, 3, 2);
  scene.add(fill1);

  const fill2 = new THREE.PointLight(0x5080c0, 0.2, 10);
  fill2.position.set(3, 2, -2);
  scene.add(fill2);

  /* ── SOL — parquet ── */
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8a6228, roughness: 0.75, metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ── MURS — cylindre intérieur avec panneaux colorés ── */
  const WALL_R  = 6;
  const WALL_H  = 5;
  const SEGMENTS = 12;
  const COLORS = [0x7a2525, 0x1a3055, 0x2a5035, 0xa04820, 0x1a4555,
                  0x4a2060, 0x805020, 0x2a1a55, 0x405010, 0x5c2040,
                  0x7a2525, 0x1a3055];

  for (let i = 0; i < SEGMENTS; i++) {
    const geo = new THREE.CylinderGeometry(
      WALL_R, WALL_R, WALL_H, 1, 1, true,
      i * Math.PI * 2 / SEGMENTS, Math.PI * 2 / SEGMENTS
    );
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS[i], side: THREE.BackSide, roughness: 0.85
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
    color: 0xf0ece4, roughness: 0.35, metalness: 0.02
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
    const colMat = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.7, roughness: 0.3 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, PIQ_H / 2, z);
    col.castShadow = true;
    scene.add(col);

    /* Chapeau */
    const capGeo = new THREE.SphereGeometry(0.06, 12, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf0d080, metalness: 0.8, roughness: 0.2 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, PIQ_H + 0.03, z);
    scene.add(cap);

    /* Base */
    const baseGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.04, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a6800, metalness: 0.6, roughness: 0.4 });
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
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x8b0020, roughness: 0.8 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.castShadow = true;
    scene.add(tube);
  }

  /* ── Charger le GLB ── */
  const glbSrc = /^https?:\/\//.test(piece.glb)
    ? piece.glb : (GALERIE_CFG.assetsBase || '') + piece.glb;

  if (typeof THREE.GLTFLoader !== 'undefined') {
    const loader = new THREE.GLTFLoader();
    loader.load(glbSrc, (gltf) => {
      const model = gltf.scene;
      /* Centrer et ajuster la taille */
      const box  = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxD = Math.max(size.x, size.y, size.z);
      const targetH = 0.8; /* hauteur cible en unités scène */
      const s = targetH / maxD;
      model.scale.setScalar(s);
      /* Recentrer */
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.position.y = 1.1 + (box2.getSize(new THREE.Vector3()).y) / 2;
      model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      scene.add(model);
    });
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
