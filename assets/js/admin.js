// ╔══════════════════════════════════════════════════════════════╗
// ║  admin.js — Fichier principal (3076 lignes)                  ║
// ║  Chargé en premier. Les modules suivants dépendent de lui :  ║
// ║    admin-vue-artistes.js  — Vue Artistes invités (Fred)      ║
// ║    admin-emailjs.js       — Config & test EmailJS            ║
// ║    admin-artistes.js      — Combobox login artistes          ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  SECTIONS (chercher les marqueurs ═══ pour naviguer)         ║
// ║   ~  48  RAPPORT D'ERREURS    rapporterErreur()              ║
// ║   ~ 155  VARIABLES GLOBALES   token, toiles, salles...       ║
// ║   ~ 224  UI HELPERS           toast, syncBadge, sha256...    ║
// ║   ~ 263  AUTH                 verifierLogin, apresLogin...   ║
// ║   ~ 313  GITHUB API           apiGH, commitMulti, lireRaw... ║
// ║   ~ 423  DONNÉES              chargerTout, sauvegarder...    ║
// ║   ~ 514  PLAN                 afficherPlan, selectSalle...   ║
// ║   ~ 567  MUR / GRILLE         afficherMur, placerToile...    ║
// ║   ~ 717  STOCK                afficherStock, majBoutons...   ║
// ║   ~ 808  TOILE FICHE          ficheToile, afficherToiles...  ║
// ║   ~1217  ARRANGER             mode plein écran placement     ║
// ║   ~1714  MUSIQUE              upload, suppression, crédits   ║
// ║   ~1820  TEXTURES / COULEURS  presets, swatches, upload...   ║
// ║   ~2148  INIT & EVENT HANDLERS câblage DOM                   ║
// ║   ~2422  CROP                 ouvrirCrop, fermerCrop...      ║
// ║   ~2610  GUIDE / TAILLES      ouvrirGuide, favoris...        ║
// ║   ~2804  ARRANGER (init)      init mode Arranger             ║
// ║   ~2822  PAGES / INFOS        chargerInfos, événements...    ║
// ║   ~3001  COLLÈGUES            afficherCollegues...           ║
// ╚══════════════════════════════════════════════════════════════╝

/* =============================================================
   FF_Galerie — admin.js
   Config :
     window.ADMIN_DATA_PATH  (défaut: 'data/')
     window.ADMIN_REPO_PATH  (défaut: 'data/')  — chemin GitHub API
   ============================================================= */

const ADMIN_CFG = {
  dataPath: window.ADMIN_DATA_PATH || 'data/',
  repoPath: window.ADMIN_REPO_PATH || 'data/',
  prefix:   window.ADMIN_PREFIX    || 'ff',
  nom:      window.ADMIN_NOM       || 'Frédérique Ferette',
  logo:     window.ADMIN_LOGO      || 'FF',
  type:     window.ADMIN_TYPE      || 'peinture'
};

/* Appliquer le nom/logo dès le chargement */
(function () {
  const logoEl = document.querySelector('.login-logo');
  const sousEl = document.querySelector('.login-sous');
  const hdrEl  = document.querySelector('.adm-logo');
  if (logoEl) logoEl.textContent = ADMIN_CFG.logo;
  if (sousEl) sousEl.textContent = ADMIN_CFG.nom;
  if (hdrEl)  hdrEl.textContent  = ADMIN_CFG.nom;
  document.title = ADMIN_CFG.nom + ' — Admin';
  /* Masquer le combobox artiste sur les admins invités */
  if (ADMIN_CFG.prefix !== 'ff') {
    const wrap = document.getElementById('div-sel-artiste');
    if (wrap) wrap.style.display = 'none';
    /* EmailJS : config réservée à Frédérique */
    const ejs = document.getElementById('bloc-emailjs');
    if (ejs) ejs.style.display = 'none';
  }
})();
/* Clés de stockage dérivées du prefix */
const K = {
  pw:       ADMIN_CFG.prefix + '_pw_hash',
  auth:     ADMIN_CFG.prefix + '_auth',
  token:    'ff_gh_token',          /* token partagé — même repo */
  presets:  ADMIN_CFG.prefix + '_presets',
  textures: ADMIN_CFG.prefix + '_textures_custom',
  mur_hist: ADMIN_CFG.prefix + '_mur_hist',
  cad_hist: ADMIN_CFG.prefix + '_cad_hist'
};

const MUR_DEFAULTS = ['#2e2e2e','#1c1c1c','#2a2420','#2c2535','#1e3a2a','#3a2a1e','#e8e4dc','#f5f5f5'];
const CAD_DEFAULTS = ['#3a3a3a','#c8a050','#f0f0f0','#1c1c1c','#5c3d2e'];

// ═══════════════════════════════════════════════
// RAPPORT D'ERREURS AUTOMATIQUE → GitHub Issues
// Crée une issue avec le titre Bug/Bloquant/Effondrement
// GitHub envoie un email au propriétaire du repo
// ═══════════════════════════════════════════════
/* Cache session : évite les appels API répétés en rafale (30s) */
const _rapportCache = {};

async function rapporterErreur(message, priorite, details) {
  if (!token) return;

  const PREFIX = { bug: 'Bug', bloquant: 'Bloquant', effondrement: 'Effondrement' };
  const titre = (PREFIX[priorite] || 'Bug') + ' : ' + message.slice(0, 90);

  /* Verrou session court (30s) pour éviter les appels API en rafale */
  const cle = titre.slice(0, 80);
  if (_rapportCache[cle] && Date.now() - _rapportCache[cle] < 30000) return;
  _rapportCache[cle] = Date.now();

  try {
    /* Chercher les issues identiques créées dans les dernières 24h */
    const depuis24h = new Date(Date.now() - 86400000).toISOString();
    const q = encodeURIComponent('repo:' + REPO + ' is:issue in:title "' + titre.slice(0, 60) + '" created:>' + depuis24h.slice(0, 10));
    const recherche = await fetch(
      'https://api.github.com/search/issues?q=' + q + '&sort=created&order=desc&per_page=5',
      { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
    ).then(function(r) { return r.ok ? r.json() : { items: [] }; });

    const nbRecentes = (recherche.items || []).filter(function(i) {
      return new Date(i.created_at) > new Date(Date.now() - 86400000);
    }).length;

    /* Silence si 3 issues ou plus dans la fenêtre de 24h */
    if (nbRecentes >= 3) {
      _rapportCache[cle] = Date.now() + 3570000; /* rallonge le verrou session */
      return;
    }

    const corps = [
      '### Rapport automatique FF_Galerie',
      '',
      '| | |',
      '|---|---|',
      '| **Message** | `' + message.replace(/`/g, "'").slice(0, 200) + '` |',
      '| **Priorité** | **' + (PREFIX[priorite] || 'Bug') + '** |',
      '| **Occurrence** | ' + (nbRecentes + 1) + '/3 dans les dernières 24h |',
      '| **Admin** | ' + ADMIN_CFG.nom + ' |',
      '| **URL** | ' + location.href + ' |',
      '| **Date** | ' + new Date().toLocaleString('fr-BE') + ' |',
      '',
      details ? '**Détails :**\n```\n' + String(details).slice(0, 1200) + '\n```' : ''
    ].filter(Boolean).join('\n');

    /* Envoi email via EmailJS */
    try { await envoyerEmailJS(titre, priorite, message, details || ''); } catch(e) { /* silencieux */ }

    var issueResp = await fetch('https://api.github.com/repos/' + REPO + '/issues', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ title: titre, body: corps, assignees: [REPO.split('/')[0]] })
    });
    /* Ajouter un commentaire @mention pour forcer la notification email
       GitHub supprime les notifs pour ses propres issues mais pas pour les mentions */
    if (issueResp.ok) {
      var issue = await issueResp.json();
      if (issue.number) {
        await fetch('https://api.github.com/repos/' + REPO + '/issues/' + issue.number + '/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({ body: '@' + REPO.split('/')[0] + ' — rapport automatique FF_Galerie' })
        });
      }
    }
  } catch(e) { /* silencieux — éviter la boucle infinie */ }
}

/* Intercepteur JS global — erreurs non gérées */
window.onerror = function(msg, src, line, col, err) {
  rapporterErreur(
    String(msg),
    'bug',
    'Fichier: ' + src + ' | Ligne: ' + line + '\n' + (err && err.stack ? err.stack : '')
  );
};

/* Intercepteur promesses non gérées */
window.addEventListener('unhandledrejection', function(e) {
  const msg = e.reason ? (e.reason.message || String(e.reason)) : 'Promesse rejetée';
  const priorite =
    (msg.includes('401') || msg.includes('credential') || msg.includes('Token'))
      ? 'effondrement'
    : (msg.includes('fast forward') || msg.includes('BadObject') || msg.includes('GitHub') || msg.includes('API'))
      ? 'bloquant'
    : 'bug';
  rapporterErreur(msg, priorite, e.reason && e.reason.stack ? e.reason.stack : String(e.reason || ''));
});

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const REPO   = 'AlainDelree/FF_Galerie';
// Branche dynamique : dev sur les URLs de développement, main sinon
const BRANCH = (
  location.hostname === 'dev.frederiqueferette.be' ||
  location.hostname.endsWith('.workers.dev') ||
  location.hostname === 'localhost'
) ? 'dev' : 'main';
const API    = 'https://api.github.com';
const MAX_PX = 1400;
const JPEG_Q = 0.83;
const COLS = 12, ROWS = 8; // grille magnétique
const CM_PAR_CASE = 15;    // 1 case ≈ 15 cm

// ═══════════════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════════════
let token = '';
let tailles = []; // codes de taille {code, label}
let toiles = [], salles = [];
let salleActive = null;
let selectedToile = null;
let peintureSurMurSel = null;
let toilesSelectionnees = new Set(); // Multi-sélection pour mode placement
let occupancy = {};
let pendingChanges = false;
let toileEnEdition = null;
let salleCibleToile = null;
let photoB64 = null;
let glbB64 = null;   // base64 du fichier GLB en attente d'upload
let glbNom = null;   // nom original du fichier GLB
let _origPhotoMaxDim = 0; // dimensions originales avant crop, pour qualité photo
let toilesEnAttente = new Map(); // id → timestamp de sauvegarde
let timerAttenteInterval = null;
let sallesEnAttente = new Map(); // id → timestamp de sauvegarde
let timerAttenteChipInterval = null;

function marquerSalleEnAttente(id) {
  if (!id) return;
  sallesEnAttente.set(id, Date.now());
  if (timerAttenteChipInterval) return;
  timerAttenteChipInterval = setInterval(() => {
    const now = Date.now();
    sallesEnAttente.forEach((ts, sid) => {
      if (now - ts >= 65000) sallesEnAttente.delete(sid);
    });
    if (typeof afficherPlan === 'function') afficherPlan();
    if (sallesEnAttente.size === 0) {
      clearInterval(timerAttenteChipInterval);
      timerAttenteChipInterval = null;
    }
  }, 1000);
}

function demarrerTimerAttente() {
  if (timerAttenteInterval) return;
  timerAttenteInterval = setInterval(() => {
    const now = Date.now();
    toilesEnAttente.forEach((ts, id) => {
      const elapsed = Math.floor((now - ts) / 1000);
      const restant = Math.max(0, 60 - elapsed);
      // Met à jour uniquement le badge sans reconstruire tout le stock
      const sb = document.querySelector(`.sync-badge[data-sync-id="${id}"]`);
      if (sb) sb.textContent = restant > 0 ? `⏳ ${restant}s` : '✓ publié';
      if (now - ts >= 65000) toilesEnAttente.delete(id);
    });
    if (toilesEnAttente.size === 0) {
      clearInterval(timerAttenteInterval);
      timerAttenteInterval = null;
    }
  }, 1000);
}
let commitARestaurer = null;
let couleurMurActuel = '#2e2e2e';
let couleurCadresActuel = '#3a3a3a';
let epaisseurCadresActuel = 2;
let textureActuelle = 'none';

// ═══════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════
const $ = id => document.getElementById(id);

function toast(msg, type='ok', ms=2400) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'visible ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, ms);
}

function syncBadge(etat) {
  const b = $('badge-sync');
  b.className = 'sync-barre';
  if (!etat) { return; }
  b.classList.add('visible');
  if (etat === 'ok')  { b.classList.add('sync-ok');  b.textContent = '✓ Synchronisé'; setTimeout(function(){ b.classList.remove('visible'); }, 3000); }
  if (etat === 'err') { b.classList.add('sync-ko');  b.textContent = '✗ Erreur de sauvegarde'; }
  if (etat === '...')  { b.classList.add('sync-enc'); b.textContent = 'En cours…'; }
}

function afficherEcran(id) {
  document.querySelectorAll('.ecran').forEach(e => e.classList.remove('actif'));
  $(id).classList.add('actif');
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function formaterDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-BE', { day:'numeric', month:'long', year:'numeric' })
       + ' à ' + d.toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit' });
}

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
async function verifierLogin() {
  /* Si un artiste invité est sélectionné → redirection vers son admin */
  const sel = $('sel-artiste');
  if (sel && sel.value) {
    window.location.href = sel.value + 'admin.html';
    return;
  }
  /* Afficher le champ mdp si caché */
  const mdp = $('inp-mdp').value.trim();
  if (!mdp) { $('login-err').textContent = 'Entrez un mot de passe.'; return; }
  const hash = await sha256(mdp);
  const stocke = localStorage.getItem(K.pw);
  if (!stocke) { $('login-err').textContent = 'Aucun mot de passe configuré. Cliquez sur "Créer un mot de passe".'; return; }
  if (hash !== stocke) { $('login-err').textContent = 'Mot de passe incorrect.'; $('inp-mdp').value = ''; return; }
  sessionStorage.setItem(K.auth, '1');
  apresLogin();
}

async function creerMotDePasse() {
  const mdp = $('inp-mdp').value.trim();
  if (mdp.length < 6) { $('login-err').textContent = 'Minimum 6 caractères.'; return; }
  if (localStorage.getItem(K.pw)) { $('login-err').textContent = 'Un mot de passe existe déjà.'; return; }
  localStorage.setItem(K.pw, await sha256(mdp));
  sessionStorage.setItem(K.auth, '1');
  apresLogin();
}

async function apresLogin() {
  token = localStorage.getItem(K.token) || '';
  if (!token) { afficherEcran('ecran-token'); return; }
  // Vérifie que le token stocké est encore valide avant de lancer les appels API
  try {
    const rep = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'FF-Admin' }
    });
    if (rep.status === 401) {
      localStorage.removeItem(K.token);
      token = '';
      afficherEcran('ecran-token');
      document.getElementById('token-err').textContent = 'Token révoqué ou expiré. Entrez votre nouveau token.';
      return;
    }
  } catch (e) { /* réseau indisponible — on tente quand même */ }
  afficherEcran('ecran-principal');
  chargerTout();
  initTexturesUI();
  // chargerConfigEmailJS() appelé après chargement de admin-emailjs.js (admin.html)
}

function initTexturesUI() {
  /* Charger les textures GitHub — guard si admin-emailjs.js pas encore chargé */
  if (typeof chargerTexturesGitHub === 'function') chargerTexturesGitHub();
}

function deconnecter() {
  sessionStorage.removeItem(K.auth);
  afficherEcran('ecran-login');
  $('inp-mdp').value = '';
}

// ═══════════════════════════════════════════════
// GITHUB API
// ═══════════════════════════════════════════════
async function apiGH(url, methode = 'GET', corps = null) {
  const opts = {
    method: methode,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (corps) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(corps); }
  const rep = await fetch(API + url, opts);
  if (!rep.ok) {
    const e = await rep.json().catch(() => ({ message: rep.statusText }));
    if (rep.status === 401 && methode !== 'GET') {
      /* 401 sur écriture → token révoqué, redirection obligatoire */
      localStorage.removeItem(K.token);
      token = '';
      rapporterErreur('Token GitHub invalide ou révoqué — admin inaccessible', 'effondrement', url);
      afficherEcran('ecran-token');
      document.getElementById('token-err').textContent = 'Token invalide ou révoqué. Entrez votre nouveau token.';
      throw new Error('Token invalide');
    }
    throw new Error(e.message);
  }
  return methode === 'DELETE' ? null : rep.json();
}

async function lireFichierJSON(chemin) {
  const rep = await apiGH(`/repos/${REPO}/contents/${chemin}`);
  const bytes = Uint8Array.from(atob(rep.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  const contenu = new TextDecoder('utf-8').decode(bytes);
  return { data: JSON.parse(contenu), sha: rep.sha };
}

async function lireFichierTexte(chemin) {
  const rep = await apiGH(`/repos/${REPO}/contents/${chemin}`);
  const bytes = Uint8Array.from(atob(rep.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/* Lecture via l'API GitHub (toujours frais, pas de cache CDN).
   Décode le contenu base64 retourné par l'API.
   Les écritures (commitMulti, uploaderPhoto) restent sur l'API. */
async function lireRaw(chemin) {
  const r = await apiGH("/repos/" + REPO + "/contents/" + chemin + "?ref=" + BRANCH);
  const bytes = Uint8Array.from(atob(r.content.replace(/\n/g, '')), function(c) { return c.charCodeAt(0); });
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* File d'attente : garantit que les commits s'exécutent
   séquentiellement même si plusieurs sont déclenchés en même temps.
   Élimine les conflits 'Update is not a fast forward'. */
let _commitQueue = Promise.resolve();

async function commitMulti(fichiers, message) {
  _commitQueue = _commitQueue.then(function() {
    return _commitMultiImpl(fichiers, message);
  });
  return _commitQueue;
}

async function _commitMultiImpl(fichiers, message) {
  const ref = await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`);
  const commitSha = ref.object.sha;
  const baseCommit = await apiGH(`/repos/${REPO}/git/commits/${commitSha}`);
  const blobs = await Promise.all(fichiers.map(async f => {
    const b64 = f.encoding === 'base64' ? f.contenu : btoa(unescape(encodeURIComponent(f.contenu)));
    const blob = await apiGH(`/repos/${REPO}/git/blobs`, 'POST', { content: b64, encoding: 'base64' });
    return { path: f.chemin, mode: '100644', type: 'blob', sha: blob.sha };
  }));
  const tree = await apiGH(`/repos/${REPO}/git/trees`, 'POST', { base_tree: baseCommit.tree.sha, tree: blobs });
  const commit = await apiGH(`/repos/${REPO}/git/commits`, 'POST', { message, tree: tree.sha, parents: [commitSha] });
  /* Mise à jour du ref — retry avec force si fast-forward impossible */
  try {
    await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
  } catch (e) {
    /* La file d'attente devrait éviter ce cas, mais on garde le fallback */
    if (e.message && (e.message.includes('fast forward') || e.message.includes('Update is not'))) {
      await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: true });
    } else {
      throw e;
    }
  }
}

async function uploaderPhoto(id, b64) {
  /* Dossier propre à chaque artiste, relatif à la racine du repo.
     Frédérique : assets/images/toiles/
     Alain      : artistes/alaindelree/assets/images/toiles/
     Le chemin stocké dans toiles.json est TOUJOURS assets/images/toiles/toile-NNN.jpg
     (relatif à la galerie.html de l'artiste) */
  /* chemin GitHub (upload) = chemin stocké dans toiles.json
     = chemin visible depuis la racine du repo
     Fred  : assets/images/toiles/toile-NNN.jpg
     Alain : artistes/alaindelree/assets/images/toiles/toile-NNN.jpg */
  const base   = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'assets/images/toiles/';
  const chemin = base + `toile-${String(id).padStart(3, '0')}.jpg`;
  const stored = chemin; /* stocké tel quel dans toiles.json */
  let sha = null;
  try { const r = await apiGH(`/repos/${REPO}/contents/${chemin}?ref=${BRANCH}`); sha = r.sha; } catch (_) {}
  const corps = { message: `Admin : Photo toile #${id}`, content: b64, branch: BRANCH };
  if (sha) corps.sha = sha;
  await apiGH(`/repos/${REPO}/contents/${chemin}`, 'PUT', corps);
  return stored; /* chemin relatif stocké dans toiles.json */
}

async function uploaderGLB(id, b64) {
  /* Upload le fichier GLB dans le dossier models de l'artiste.
     Chemin GitHub = chemin stocké dans toiles.json (relatif au repo) */
  const base   = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'assets/models/';
  const chemin = base + 'toile-' + String(id).padStart(3, '0') + '.glb';
  let sha = null;
  try { const r = await apiGH('/repos/' + REPO + '/contents/' + chemin + '?ref=' + BRANCH); sha = r.sha; } catch (_) {}
  const corps = { message: 'Admin : GLB piece #' + id, content: b64, branch: BRANCH };
  if (sha) corps.sha = sha;
  await apiGH('/repos/' + REPO + '/contents/' + chemin, 'PUT', corps);
  return chemin; /* chemin relatif stocké dans toiles.json */
}

// ═══════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════
async function chargerTout() {
  const _ov = document.getElementById('overlay-chargement');
  if (_ov) _ov.classList.add('visible');
  try {
    const [tData, sData] = await Promise.all([
      lireRaw(ADMIN_CFG.repoPath + 'toiles.json'),
      lireRaw(ADMIN_CFG.repoPath + 'salles.json')
    ]);
    toiles  = ADMIN_CFG.type === 'sculpture' ? (tData.pieces   || []) : (tData.toiles  || []);
    tailles = ADMIN_CFG.type === 'sculpture' ? (tData.gabarits  || []) : (tData.tailles || []);
    // Migre l'ancien format salles → nouveau format
    salles = (sData.salles || []).map(s => ({
      id: s.id, nom: s.nom,
      type: s.type || (ADMIN_CFG.type !== 'peinture' ? ADMIN_CFG.type : undefined),
      theme: s.theme || '',
      couleur_mur: s.couleur_mur || '#2e2e2e',
      couleur_cadres: s.couleur_cadres || '#3a3a3a',
      epaisseur_cadres: s.epaisseur_cadres || 2,
      texture: s.texture || 'none',
      visible: s.visible !== false,
      toiles: s.toiles || [],
      positions: s.positions || []
    }));
    if (typeof afficherPlan === 'function') afficherPlan();
    if (salles.length > 0) selectSalle(salles[0].id);
    syncBadge('ok');

    // Préchargement silencieux — salle courante immédiatement, reste après 800ms
    window._adminPreload = [];
    var _prioPhotos = new Set();
    var _premSalle = salles[0];
    if (_premSalle) {
      (_premSalle.positions || []).forEach(function(p) {
        var t = toiles.find(function(x){ return x.id === p.id; });
        if (t && t.photo) {
          var img = new Image(); img.src = t.photo;
          window._adminPreload.push(img);
          _prioPhotos.add(t.photo);
        }
      });
    }
    setTimeout(function() {
      toiles.forEach(function(t) {
        if (t.photo && !_prioPhotos.has(t.photo)) {
          var img = new Image(); img.src = t.photo;
          window._adminPreload.push(img);
        }
      });
    }, 800);
  } catch (e) {
    rapporterErreur('Chargement galerie échoué : ' + e.message, 'bloquant', e.stack || '');
    toast('Erreur chargement : ' + e.message, 'err', 4000);
    syncBadge('err');
  } finally {
    const _ov = document.getElementById('overlay-chargement');
    if (_ov) _ov.classList.remove('visible');
  }
}

async function sauvegarder(message) {
  syncBadge('...');
  // Synchronise toiles[] depuis positions[] avant chaque sauvegarde
  salles.forEach(s => { s.toiles = (s.positions || []).map(p => p.id); });
  try {
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath+'toiles.json', contenu: JSON.stringify(
        ADMIN_CFG.type === 'sculpture'
          ? { gabarits: tailles, pieces: toiles }
          : { tailles, toiles }
      , null, 2) },
      { chemin: ADMIN_CFG.repoPath+'salles.json', contenu: JSON.stringify({ salles }, null, 2) }
    ], 'Admin : ' + message);
    syncBadge('ok');
    toast('✓ Sauvegardé');
    pendingChanges = false;
    $('btn-sauver-flottant').classList.remove('visible');
  } catch (e) {
    rapporterErreur('Impossible de charger les données : ' + e.message, 'bloquant', e.stack || '');
    syncBadge('err');
    toast('Erreur : ' + e.message, 'err', 4000);
    throw e;
  }
}

function marquerChangement() {
  pendingChanges = true;
  $('btn-sauver-flottant').classList.add('visible');
}

function prochainId() {
  return toiles.length ? Math.max(...toiles.map(t => t.id)) + 1 : 1;
}

// ═══════════════════════════════════════════════
// GRILLE toggle
// ═══════════════════════════════════════════════
let grilleVisible = false;
function toggleGrille() {
  grilleVisible = !grilleVisible;
  $('mur-bg').classList.toggle('grille-on', grilleVisible);
  $('btn-grille').classList.toggle('on', grilleVisible);
}

// ═══════════════════════════════════════════════
// TOKEN SETUP
// ═══════════════════════════════════════════════
async function validerToken() {
  const t = $('inp-token').value.trim();
  if (!t) { $('token-err').textContent = 'Entrez un token.'; return; }
  const btn = $('btn-token'); btn.disabled = true; btn.textContent = 'Vérification…';
  $('token-err').textContent = '';
  try {
    token = t;
    // Test sur /user : endpoint authentifié (public repo = 200 sans token → test insuffisant)
    // 401 = token invalide/révoqué ; 200 ou 403 = token valide (scope peut être limité)
    const rep = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'Bearer ' + t, 'User-Agent': 'FF-Admin' }
    });
    if (rep.status === 401) throw new Error('token révoqué ou invalide');
    localStorage.setItem(K.token, t);
    afficherEcran('ecran-principal');
    chargerTout();
  } catch (e) { $('token-err').textContent = 'Token invalide : ' + e.message; token = ''; }
  finally { btn.disabled = false; btn.textContent = 'Vérifier et enregistrer'; }
}

// ═══════════════════════════════════════════════
// INIT ÉVÉNEMENTS
// ═══════════════════════════════════════════════
// Login
$('inp-mdp').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-login').click(); });
$('btn-login').addEventListener('click', verifierLogin);
$('lien-creer').addEventListener('click', e => { e.preventDefault(); creerMotDePasse(); });
$('btn-oeil').addEventListener('click', () => {
  const i = $('inp-mdp'); const v = i.type === 'text';
  i.type = v ? 'password' : 'text';
  $('oeil-svg').innerHTML = v
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
});

// Token
$('inp-token').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-token').click(); });
$('btn-token').addEventListener('click', validerToken);

// Logout
$('btn-logout').addEventListener('click', () => { if (confirm('Se déconnecter ?')) deconnecter(); });

// Onglets
document.querySelectorAll('.onglet').forEach(o => {
  o.addEventListener('click', () => {
    document.querySelectorAll('.onglet').forEach(x => x.classList.remove('actif'));
    document.querySelectorAll('.vue').forEach(x => x.classList.remove('active'));
    o.classList.add('actif');
    $(o.dataset.vue).classList.add('active');
    if (o.dataset.vue === 'vue-backup') chargerCommits();
    if (o.dataset.vue === 'vue-pages')  chargerInfos();
    if (o.dataset.vue === 'vue-artistes') { chargerVueArtistes(); chargerTemplates(); }
  });
});

// Sous-navigation "Autres pages"
document.querySelectorAll('.sous-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sous-nav-btn').forEach(b => b.classList.remove('actif'));
    document.querySelectorAll('.sous-page').forEach(p => p.style.display = 'none');
    btn.classList.add('actif');
    const cible = document.getElementById(btn.dataset.sous);
    if (cible) { cible.style.display = 'flex'; cible.style.flexDirection = 'column'; }
  });
});

// Plan salles
$('btn-ajouter-salle').addEventListener('click', () => ouvrirModalSalle());
$('btn-supprimer-salle').addEventListener('click', async () => {
  if (!salleActive) return;
  if (!confirm(`Supprimer "${salleActive.nom}" et toutes ses positions ? Réversible via le backup.`)) return;
  salles = salles.filter(s => s.id !== salleActive.id);
  salleActive = null;
  const btnDel = $('btn-supprimer-salle');
  btnDel.disabled = true;
  try {
    await sauvegarder(`[admin] Suppression salle`);
    if (typeof afficherPlan === 'function') afficherPlan();
    if (salles.length) selectSalle(salles[0].id);
    else { $('mur-bg').innerHTML = ''; $('stock-list').innerHTML = ''; $('badge-salle').textContent = '—'; }
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btnDel.disabled = false; }
});
// Contrôles mur
function fermerPanneauCoul() {
  $('coul-panel').classList.remove('ouvert');
  $('coul-overlay').classList.remove('ouvert');
  $('btn-coul-toggle').classList.remove('on');
}
$('btn-coul-toggle').addEventListener('click', () => {
  const ouvert = $('coul-panel').classList.toggle('ouvert');
  $('coul-overlay').classList.toggle('ouvert', ouvert);
  $('btn-coul-toggle').classList.toggle('on', ouvert);
  if (ouvert) {
    $('musique-panel').classList.remove('ouvert');
    $('musique-overlay').classList.remove('ouvert');
    $('btn-musique-toggle').classList.remove('on');
    if (!window._texturesGHChargees) chargerTexturesGitHub();
    if (typeof prendreSnapshotApparence === 'function') prendreSnapshotApparence();
  }
});
// Annuler : restaure le snapshot et ferme
function annulerPanneauCoul() {
  if (typeof restaurerSnapshotApparence === 'function') restaurerSnapshotApparence();
  fermerPanneauCoul();
}
$('btn-annuler-coul').addEventListener('click', annulerPanneauCoul);
$('coul-overlay').addEventListener('click', annulerPanneauCoul);
// Sauvegarder : écrit sur GitHub et ferme
$('btn-sauver-coul').addEventListener('click', async () => {
  const btn = $('btn-sauver-coul');
  btn.textContent = 'En cours…'; btn.disabled = true;
  try {
    await sauvegarder('[admin] Couleurs/texture salle');
    _snapshotApparence = null;
    fermerPanneauCoul();
  } catch (_) {}
  btn.textContent = '💾 Sauvegarder'; btn.disabled = false;
});

// ── Panneau Musique ──────────────────────────────────────────────
$('btn-musique-toggle')?.addEventListener('click', () => {
  const ouvert = $('musique-panel').classList.toggle('ouvert');
  $('musique-overlay').classList.toggle('ouvert', ouvert);
  $('btn-musique-toggle').classList.toggle('on', ouvert);
  if (ouvert) {
    $('coul-panel').classList.remove('ouvert');
    $('coul-overlay').classList.remove('ouvert');
    $('btn-coul-toggle').classList.remove('on');
    chargerEtAfficherMusique();
  }
});
$('btn-close-musique')?.addEventListener('click', () => {
  $('musique-panel').classList.remove('ouvert');
  $('musique-overlay').classList.remove('ouvert');
  $('btn-musique-toggle').classList.remove('on');
});
$('musique-overlay')?.addEventListener('click', () => {
  $('musique-panel').classList.remove('ouvert');
  $('musique-overlay').classList.remove('ouvert');
  $('btn-musique-toggle').classList.remove('on');
});

// ── Modal Vider salles ───────────────────────────────────────────
$('btn-vider-salles')?.addEventListener('click', () => ouvrirModalViderSalles());
$('btn-close-vider')?.addEventListener('click', () => fermerModalViderSalles());
$('btn-vider-annuler')?.addEventListener('click', () => fermerModalViderSalles());
$('btn-vider-valider')?.addEventListener('click', () => validerViderSalles());
$('overlay-vider-salles')?.addEventListener('click', function(e) {
  if (e.target === this) fermerModalViderSalles();
});
// Plan repliable
let planOuvert = true;
$('btn-toggle-plan').addEventListener('click', () => {
  planOuvert = !planOuvert;
  const chips = $('chips-salles');
  const btns = document.querySelector('.plan-actions').querySelectorAll('.plan-btn');
  chips.style.display = planOuvert ? '' : 'none';
  btns.forEach(b => b.style.display = planOuvert ? '' : 'none');
  $('btn-toggle-plan').textContent = planOuvert ? '▲' : '▼';
  $('plan-section').style.minHeight = planOuvert ? '' : '0';
});
$('btn-rename').addEventListener('click', async () => {
  const nom = $('inp-rename').value.trim();
  if (!nom || !salleActive) return;
  const btnRn = $('btn-rename');
  salleActive.nom = nom;
  $('badge-salle').textContent = nom;
  $('inp-rename').value = '';
  btnRn.disabled = true;
  try { await sauvegarder(`[admin] Renommage salle → "${nom}"`); marquerSalleEnAttente(salleActive?.id); if (typeof afficherPlan === 'function') afficherPlan(); }
  catch (e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btnRn.disabled = false; }
});

// Bouton arranger le mur
$('btn-arranger-mur').addEventListener('click', () => entrerModePlacement());

// Bouton Modifier : ouvre le formulaire d'édition pour la toile sélectionnée
$('btn-modifier-toile').addEventListener('click', () => {
  if (selectedToile) ouvrirFormulaireEdition(selectedToile.id);
});
$('btn-fin-placement').addEventListener('click', () => quitterModePlacement());
$('btn-tout-mettre').addEventListener('click', () => autoPlacerTout());
$('btn-grille-pl').addEventListener('click', function() {
  grilleVisiblePl = !grilleVisiblePl;
  $('btn-grille-pl').style.color       = grilleVisiblePl ? 'var(--gold)' : '';
  $('btn-grille-pl').style.borderColor = grilleVisiblePl ? 'var(--gold)' : '';
  afficherMurPlacement();
  afficherStripPlacement();
});

/* Panneau de contrôle fixe — déplacement et suppression de la toile sélectionnée */
(function() {
  function mvSel(dc, dr) {
    if (peintureSurMurSel === null) return;
    if (ADMIN_CFG.type === 'sculpture') {
      deplacerPieceSol(dc * 2, dr * 2);
    } else {
      deplacerPeinture(peintureSurMurSel, dc, dr);
    }
    afficherMurPlacement();
  }
  $("pl-btn-up")   ?.addEventListener("click", function(){ mvSel( 0,-1); });
  $("pl-btn-down") ?.addEventListener("click", function(){ mvSel( 0, 1); });
  $("pl-btn-left") ?.addEventListener("click", function(){ mvSel(-1, 0); });
  $("pl-btn-right")?.addEventListener("click", function(){ mvSel( 1, 0); });
  $("pl-btn-rm")   ?.addEventListener("click", function() {
    if (peintureSurMurSel === null) return;
    var titre = (toiles.find(function(x){ return x.id === peintureSurMurSel; }) || {}).titre || "—";
    salleActive.positions = (salleActive.positions||[]).filter(function(x){ return x.id !== peintureSurMurSel; });
    salleActive.toiles    = (salleActive.toiles||[]).filter(function(id){ return id !== peintureSurMurSel; });
    toilesSelectionnees.add(peintureSurMurSel);
    peintureSurMurSel = null; selectedToilePl = null;
    buildOccupancy(); afficherMurPlacement(); afficherStripPlacement();
    marquerChangement();
    $("pl-aide").textContent = "\"" + titre + "\" retirée — clique sur le mur pour la replacer";
  });
})();

// Intercepte le bouton retour Android quand le mode arrangement est ouvert
window.addEventListener('popstate', () => {
  if ($('overlay-placement').classList.contains('ouvert')) {
    quitterModePlacement();
  }
});
$('btn-sauver-flottant').addEventListener('click', async () => {
  const btn = $('btn-sauver-flottant');
  btn.textContent = 'En cours…'; btn.disabled = true;
  try { await sauvegarder('[admin] Mise à jour galerie'); marquerSalleEnAttente(salleActive?.id); }
  catch (_) {}
  btn.textContent = '💾 Sauvegarder'; btn.disabled = false;
});

// Barre basse
$('btn-ajouter-toile').addEventListener('click', () => {
  construirePillsSalle(salleActive?.id || null);
  ouvrirFormulaireNouvel();
});

// Modal toile
$('btn-close-toile').addEventListener('click', () => fermerModalToile());
$('btn-annuler-toile').addEventListener('click', () => fermerModalToile());
$('btn-sauver-toile').addEventListener('click', () => sauverToile());
$('btn-supprimer-toile').addEventListener('click', () => supprimerToile());
$('overlay-toile').addEventListener('click', e => { if (e.target === $('overlay-toile')) fermerModalToile(); });

// Fiche consultation
$('btn-close-fiche').addEventListener('click', () => fermerFiche());
$('btn-fiche-fermer').addEventListener('click', () => fermerFiche());
$('btn-fiche-modifier').addEventListener('click', () => {
  const id = ficheToileId;
  fermerFiche();
  if (id) ouvrirFormulaireEdition(id);
});
$('overlay-fiche').addEventListener('click', e => { if (e.target === $('overlay-fiche')) fermerFiche(); });
let swFiche = null, swFicheHandle = false;
$('overlay-fiche').querySelector('.fiche-modal').addEventListener('touchstart', e => {
  swFiche = e.touches[0].clientY;
  swFicheHandle = !!e.target.closest('.modal-handle');
}, { passive: true });
$('overlay-fiche').querySelector('.fiche-modal').addEventListener('touchend', e => {
  if (swFiche && swFicheHandle && e.changedTouches[0].clientY - swFiche > 60) fermerFiche();
  swFiche = null; swFicheHandle = false;
}, { passive: true });

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════
if (sessionStorage.getItem(K.auth) === '1') {
  token = localStorage.getItem(K.token) || '';
  if (!token) { afficherEcran('ecran-token'); }
  else {
    // Valide le token stocké avant de lancer les appels API
    (async () => {
      try {
        const rep = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'FF-Admin' }
        });
        if (rep.status === 401) {
          localStorage.removeItem(K.token); token = '';
          afficherEcran('ecran-token');
          document.getElementById('token-err').textContent = 'Token révoqué ou expiré. Entrez votre nouveau token.';
          return;
        }
      } catch (e) { /* réseau — on tente quand même */ }
      afficherEcran('ecran-principal');
      // chargerTout() et initTexturesUI() sont appelés dans le post-load d'admin.html
      // après que tous les modules soient chargés (évite race condition galerie)
    })();
  }
} else {
  if (localStorage.getItem(K.pw)) $('login-aide').style.display = 'none';
}
