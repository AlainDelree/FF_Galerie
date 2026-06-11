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
  logo:     window.ADMIN_LOGO      || 'FF'
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
const BRANCH = 'main';
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
    afficherPlan();
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
      if (now - ts >= 65000) toilesEnAttente.delete(id);
    });
    afficherStock();
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
  if (etat === '...')  { b.classList.add('sync-enc'); b.textContent = '⟳ Sauvegarde en cours…'; }
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

function apresLogin() {
  token = localStorage.getItem(K.token) || '';
  if (!token) { afficherEcran('ecran-token'); return; }
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
    if (rep.status === 401) {
      /* Token invalide ou révoqué → vider le token et aller à l'écran token */
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

/* Lecture rapide via raw.githubusercontent.com (CDN GitHub, sans auth).
   À utiliser pour les lectures pures — ne renvoie pas le sha.
   Les écritures (commitMulti, uploaderPhoto) restent sur l'API. */
async function lireRaw(chemin) {
  const url = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/" + chemin + "?v=" + Date.now();
  const rep = await fetch(url);
  if (!rep.ok) throw new Error("Impossible de lire " + chemin + " (" + rep.status + ")");
  return rep.json();
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
  try { const r = await apiGH(`/repos/${REPO}/contents/${chemin}`); sha = r.sha; } catch (_) {}
  const corps = { message: `Admin : Photo toile #${id}`, content: b64, branch: BRANCH };
  if (sha) corps.sha = sha;
  await apiGH(`/repos/${REPO}/contents/${chemin}`, 'PUT', corps);
  return stored; /* chemin relatif stocké dans toiles.json */
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
    toiles = tData.toiles || [];
    tailles = tData.tailles || [];
    // Migre l'ancien format salles → nouveau format
    salles = (sData.salles || []).map(s => ({
      id: s.id, nom: s.nom,
      theme: s.theme || '',
      couleur_mur: s.couleur_mur || '#2e2e2e',
      couleur_cadres: s.couleur_cadres || '#3a3a3a',
      epaisseur_cadres: s.epaisseur_cadres || 2,
      texture: s.texture || 'none',
      visible: s.visible !== false,
      toiles: s.toiles || [],
      positions: s.positions || []
    }));
    afficherPlan();
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
      { chemin: ADMIN_CFG.repoPath+'toiles.json', contenu: JSON.stringify({ tailles, toiles }, null, 2) },
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
// PLAN DES SALLES
// ═══════════════════════════════════════════════
function afficherPlan() {
  const cont = $('chips-salles');
  cont.innerHTML = '';
  salles.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (s.toiles.length === 0 ? ' vide' : '');
    if (salleActive && s.id === salleActive.id) chip.classList.add('sel');
    chip.innerHTML = `<div class="cn">${s.nom}</div><div class="cb">${s.toiles.length || 'vide'} toile${s.toiles.length > 1 ? 's' : ''}</div>`;
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
  appliquerApparence();
  // Affiche mur + stock
  buildOccupancy();
  afficherMur();
  afficherStock();
  selectedToile = null;
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
  bg.classList.toggle('grille-on', grilleVisible);

  // Toiles posées
  (salleActive.positions || []).forEach(p => {
    const t = toiles.find(x => x.id === p.id);
    if (!t) return;
    const el = document.createElement('div');
    el.className = 'toile-posee' + (t.visible === false ? ' reserve-posee' : '');
    el.style.gridColumn = `${p.col} / span ${p.w}`;
    el.style.gridRow    = `${p.row} / span ${p.h}`;
    el.style.borderColor = t.visible === false ? '' : couleurCadresActuel;
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

function placerToile(col, row) {
  if (!selectedToile || !salleActive) return;
  const { w, h } = calcCases(selectedToile.dimensions);
  if (!canPlace(col, row, w, h, null)) { toast('Emplacement occupé', 'err'); return; }
  // Retire de TOUTES les salles (toiles + positions) avant de placer
  salles.forEach(s => {
    s.toiles = s.toiles.filter(id => id !== selectedToile.id);
    s.positions = (s.positions || []).filter(p => p.id !== selectedToile.id);
  });
  // Ajoute à la salle active
  salleActive.positions.push({ id: selectedToile.id, col, row, w, h });
  salleActive.toiles.push(selectedToile.id);
  buildOccupancy();
  afficherMur(); afficherStock();
  selectedToile = null;
  marquerChangement();
  toast('✓ Toile placée');
}

function retirerToile(toileId) {
  if (!salleActive) return;
  salleActive.positions = (salleActive.positions || []).filter(p => p.id !== toileId);
  peintureSurMurSel = null;
  buildOccupancy(); afficherMur(); afficherStock(); marquerChangement();
  toast('Toile retirée du mur');
}

function selectionnerPeintureMur(toileId) {
  peintureSurMurSel = peintureSurMurSel === toileId ? null : toileId;
  selectedToile = null;
  afficherMur(); afficherStock();
}

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
  buildOccupancy(); afficherMur(); marquerChangement();
}

// ═══════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════
function afficherStock() {
  const list = $('stock-list');
  list.innerHTML = '';
  // Met à jour le compteur
  const hdr = $('stock-hdr');
  if (hdr) hdr.textContent = 'Stock (' + toiles.length + ')';
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
      img.src = t.photo; img.alt = t.titre || ''; img.draggable = false; img.loading = 'lazy';
      simgDiv.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className = 'sph';
      ph.textContent = '?'; simgDiv.appendChild(ph);
    }
    item.appendChild(simgDiv);

    const chk = document.createElement('div'); chk.className = 'check-ov'; chk.textContent = '✓';
    item.appendChild(chk);

    const nom = document.createElement('div'); nom.className = 'snom';
    nom.textContent = t.titre || '—'; item.appendChild(nom);

    // Badge taille en haut à droite
    if (t.taille || t.dimensions) {
      const badge = document.createElement('div'); badge.className = 'taille-badge';
      badge.textContent = t.taille || (t.dimensions ? `${t.dimensions.largeur}×${t.dimensions.hauteur}` : '');
      item.appendChild(badge);
    }

    if (toilesEnAttente.has(t.id)) {
      const elapsed = Math.floor((Date.now() - toilesEnAttente.get(t.id)) / 1000);
      const restant = Math.max(0, 60 - elapsed);
      const sb = document.createElement('div');
      sb.className = 'sync-badge';
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
    item.addEventListener('dblclick', () => ouvrirFiche(t.id));
    list.appendChild(item);
  });
}

function majBtnPlacer() { /* bouton Placer supprimé — Arranger le mur le remplace */ }

function majBoutons() {
  const n = toilesSelectionnees.size;
  $('btn-modifier-toile').disabled = (n !== 1);
}

function afficherConfirmAutreSalle(toile, nomAutre) {
  const ancien = document.getElementById('confirm-autre-salle');
  if (ancien) ancien.remove();
  const div = document.createElement('div');
  div.id = 'confirm-autre-salle';
  div.style.cssText = 'position:fixed;bottom:75px;left:50%;transform:translateX(-50%);z-index:400;background:var(--bg2);border:1.5px solid var(--gold);border-radius:14px;padding:.9rem 1rem;max-width:310px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,.6);';
  div.innerHTML = `<p style="font-size:13px;margin-bottom:.75rem;line-height:1.5;"><strong style="color:var(--gold);">"${toile.titre||'Sans titre'}"</strong> est dans <strong>${nomAutre}</strong>.<br>Que faire ?</p>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
      <button id="conf-ann" style="flex:1;padding:.5rem;border-radius:8px;border:0.5px solid var(--brd);background:transparent;color:var(--text);font-size:12px;cursor:pointer;">Annuler</button>
      <button id="conf-edit" style="flex:1;padding:.5rem;border-radius:8px;border:0.5px solid var(--gold);background:transparent;color:var(--gold);font-size:12px;cursor:pointer;">✏️ Modifier</button>
      <button id="conf-ok" style="flex:1;padding:.5rem;border-radius:8px;border:none;background:var(--gold);color:#111;font-size:12px;font-weight:600;cursor:pointer;">Retirer et placer ici</button>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('conf-ann').addEventListener('click', () => div.remove());
  document.getElementById('conf-edit').addEventListener('click', () => {
    div.remove();
    ouvrirFormulaireEdition(toile.id);
  });
  document.getElementById('conf-ok').addEventListener('click', () => {
    div.remove();
    toilesSelectionnees.add(toile.id);
    selectedToile = toile;
    afficherStock(); majBoutons();
    toast(`"${toile.titre||'—'}" prête — sera retirée de ${nomAutre} à la sauvegarde`);
  });
  setTimeout(() => {
    const fermer = e => { if (!div.contains(e.target)) { div.remove(); document.removeEventListener('click', fermer); } };
    document.addEventListener('click', fermer);
  }, 150);
}


// ═══════════════════════════════════════════════
// MODE PLACEMENT PLEIN ÉCRAN
// ═══════════════════════════════════════════════
let grilleVisiblePl = false;
let selectedToilePl = null; // toile sélectionnée dans le strip du mode placement

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
  const nbPlacees = (salleActive.positions||[]).length;
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
    ? 'Clique une toile du bas pour la placer ou la déplacer'
    : 'Sélectionne une toile en bas, puis clique sur le mur';
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
  afficherMurPlacement(); afficherStripPlacement(); marquerChangement();
  toast(impossible>0
    ? `${placees} placée(s) — ${impossible} ne rentrent pas sur le mur`
    : `✓ ${placees} toile(s) placée(s)`);
}

function quitterModePlacement() {
  $('overlay-placement').classList.remove('ouvert');
  toilesSelectionnees.clear();
  selectedToilePl = null;
  selectedToile = null;
  peintureSurMurSel = null; // efface la sélection avant de revenir en vue normale
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
  const bg = $('mur-placement');
  bg.innerHTML = '';
  bg.style.background = couleurMurActuel;
  const texStr = TEXTURES[textureActuelle] || '';
  if (texStr) bg.style.background = `${texStr}, ${couleurMurActuel}`;
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
  const poseeIds = new Set((salleActive.positions||[]).map(p=>p.id));

  // UNION : toiles placées sur le mur + toiles sélectionnées depuis le stock
  const tousIds = [...new Set([...poseeIds, ...toilesSelectionnees])];

  if (tousIds.length === 0) {
    strip.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:.5rem 1rem;align-self:center;">Aucune toile</div>';
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
    if (t.photo) { const img=document.createElement('img'); img.src=t.photo; img.alt=''; img.loading='lazy'; si.appendChild(img); }

    // Grille W×H sur la miniature quand mode grille actif
    if (grilleVisiblePl) {
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
    badge.textContent = estPlace ? '🔒 sur le mur' : '+ à placer';
    item.appendChild(badge);

    const n = document.createElement('div'); n.className='snom'; n.textContent=t.titre||'—'; item.appendChild(n);

    item.addEventListener('click', () => {
      if (estPlace) {
        // Sélection pour déplacer avec flèches
        peintureSurMurSel = peintureSurMurSel===id ? null : id;
        selectedToilePl = null; selectedToile = null;
        $('pl-aide').textContent = peintureSurMurSel
          ? `"${t.titre||'—'}" → utilise les flèches ou ✕ pour retirer`
          : 'Clique une toile pour la déplacer ou en placer une nouvelle';
      } else {
        // Sélection pour placer
        selectedToilePl = selectedToilePl?.id===id ? null : t;
        selectedToile = selectedToilePl;
        peintureSurMurSel = null;
        $('pl-aide').textContent = selectedToilePl
          ? `"${t.titre||'—'}" → clique sur le mur pour placer`
          : 'Sélectionne une toile à placer';
      }
      afficherMurPlacement(); afficherStripPlacement();
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
  marquerChangement(); toast('✓ Placée');
  $('pl-aide').textContent = 'Toile placée — continue ou clique ← Retour';
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
  toileEnEdition = null; salleCibleToile = salleActive?.id || null; photoB64 = null;
  $('modal-toile-tit').textContent = 'Nouvelle toile';
  $('zone-suppr').classList.add('hidden');
  construireFavoris();
  viderFormToile();
  $('overlay-toile').classList.add('ouvert');
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
  toileEnEdition = id; photoB64 = null;
  const salleDeLaToile = salles.find(s => s.toiles.includes(id))?.id || salleActive?.id || null;
  construirePillsSalle(salleDeLaToile);
  salleCibleToile = salleDeLaToile;
  $('modal-toile-tit').textContent = 'Modifier la toile';
  $('zone-suppr').classList.remove('hidden');
  construireFavoris();
  remplirFormToile(t);
  $('overlay-toile').classList.add('ouvert');
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
    const label = d.type === 'ronde' ? `Ronde ⌀${d.largeur} cm` : `${d.largeur} × ${d.hauteur} cm`;
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
  $('inp-visible').checked = true;
  $('inp-larg').value = ''; $('inp-haut').value = '';
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
    prevImg.src = t.photo; prevImg.style.display = 'block';
    $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
    // Si déjà en cache
    if (prevImg.complete && prevImg.naturalWidth) {
      afficherQualitePhoto(Math.max(prevImg.naturalWidth, prevImg.naturalHeight), false);
      prevImg.onload = null;
    }
  }
  salleCibleToile = salles.find(s => s.toiles.includes(t.id))?.id || null;
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
    if (l && h) dim = { type: l === h ? 'carre' : l > h ? 'paysage' : 'portrait', largeur: l, hauteur: h };
  }
  return {
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
}

async function sauverToile() {
  const donnees = lireFormToile();
  const lbl = $('sauver-lbl'), btn = $('btn-sauver-toile');
  btn.disabled = true; lbl.textContent = '⟳ Sauvegarde…';
  try {
    if (toileEnEdition === null) {
      const id = prochainId();
      let photo = '';
      if (photoB64) photo = await uploaderPhoto(id, photoB64);
      const t = { id, photo, source_photo: 'admin', ...donnees };
      toiles.push(t);
      if (salleCibleToile) {
        const s = salles.find(x => x.id === salleCibleToile);
        if (s && !s.toiles.includes(id)) s.toiles.push(id);
      }
      await sauvegarder(`[admin] Ajout toile #${id}${donnees.titre ? ' — ' + donnees.titre : ''}`);
    } else {
      const idx = toiles.findIndex(x => x.id === toileEnEdition);
      let photo = toiles[idx].photo;
      if (photoB64) photo = await uploaderPhoto(toileEnEdition, photoB64);
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
      toiles[idx] = { ...toiles[idx], photo, ...donnees };
      await sauvegarder(`[admin] Modification toile #${toileEnEdition}${donnees.titre ? ' — ' + donnees.titre : ''}`);
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
  finally { btn.disabled = false; lbl.textContent = 'Enregistrer'; }
}

async function supprimerToile() {
  if (!toileEnEdition) return;
  const t = toiles.find(x => x.id === toileEnEdition);
  if (!confirm(`Supprimer "${t?.titre || 'cette toile'}" ? Réversible via le backup.`)) return;
  toiles = toiles.filter(x => x.id !== toileEnEdition);
  salles.forEach(s => {
    s.toiles = s.toiles.filter(id => id !== toileEnEdition);
    s.positions = (s.positions || []).filter(p => p.id !== toileEnEdition);
  });
  fermerModalToile();
  try {
    await sauvegarder(`[admin] Suppression toile #${toileEnEdition}${t?.titre ? ' — ' + t.titre : ''}`);
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
    await sauvegarder("Vider salle(s) : " + noms);
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
    await sauvegarder(`[admin] Ajout salle "${nom}"`);
    marquerSalleEnAttente(newId);
    afficherPlan();
    selectSalle(newId);
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
}
// APPARENCE (couleurs + textures)
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
    const old = token; token = t;
    await apiGH(`/repos/${REPO}`);
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
$('btn-ajouter-salle').addEventListener('click', ouvrirModalSalle);
$('btn-supprimer-salle').addEventListener('click', async () => {
  if (!salleActive) return;
  if (!confirm(`Supprimer "${salleActive.nom}" et toutes ses positions ? Réversible via le backup.`)) return;
  salles = salles.filter(s => s.id !== salleActive.id);
  salleActive = null;
  const btnDel = $('btn-supprimer-salle');
  btnDel.disabled = true;
  try {
    await sauvegarder(`[admin] Suppression salle`);
    afficherPlan();
    if (salles.length) selectSalle(salles[0].id);
    else { $('mur-bg').innerHTML = ''; $('stock-list').innerHTML = ''; $('badge-salle').textContent = '—'; }
  } catch (e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btnDel.disabled = false; }
});
// Contrôles mur
$('btn-coul-toggle').addEventListener('click', () => {
  const ouvert = $('coul-panel').classList.toggle('ouvert');
  $('coul-overlay').classList.toggle('ouvert', ouvert);
  $('btn-coul-toggle').classList.toggle('on', ouvert);
  if (ouvert) {
    $('musique-panel').classList.remove('ouvert');
    $('musique-overlay').classList.remove('ouvert');
    $('btn-musique-toggle').classList.remove('on');
    // Charger les textures GitHub si pas encore fait (race au démarrage)
    if (!window._texturesGHChargees) chargerTexturesGitHub();
  }
});
$('btn-close-coul').addEventListener('click', () => {
  $('coul-panel').classList.remove('ouvert');
  $('coul-overlay').classList.remove('ouvert');
  $('btn-coul-toggle').classList.remove('on');
});
$('coul-overlay').addEventListener('click', () => {
  $('coul-panel').classList.remove('ouvert');
  $('coul-overlay').classList.remove('ouvert');
  $('btn-coul-toggle').classList.remove('on');
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
$('btn-vider-salles')?.addEventListener('click', ouvrirModalViderSalles);
$('btn-close-vider')?.addEventListener('click', fermerModalViderSalles);
$('btn-vider-annuler')?.addEventListener('click', fermerModalViderSalles);
$('btn-vider-valider')?.addEventListener('click', validerViderSalles);
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
  try { await sauvegarder(`[admin] Renommage salle → "${nom}"`); marquerSalleEnAttente(salleActive?.id); afficherPlan(); }
  catch (e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btnRn.disabled = false; }
});

// Bouton arranger le mur
$('btn-arranger-mur').addEventListener('click', entrerModePlacement);

// Bouton Modifier : ouvre le formulaire d'édition pour la toile sélectionnée
$('btn-modifier-toile').addEventListener('click', () => {
  if (selectedToile) ouvrirFormulaireEdition(selectedToile.id);
});
$('btn-fin-placement').addEventListener('click', quitterModePlacement);
$('btn-tout-mettre').addEventListener('click', autoPlacerTout);
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
    deplacerPeinture(peintureSurMurSel, dc, dr);
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
  btn.textContent = '⟳ Sauvegarde…'; btn.disabled = true;
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
$('btn-close-toile').addEventListener('click', fermerModalToile);
$('btn-annuler-toile').addEventListener('click', fermerModalToile);
$('btn-sauver-toile').addEventListener('click', sauverToile);
$('btn-suppr-toile').addEventListener('click', supprimerToile);
$('overlay-toile').addEventListener('click', e => { if (e.target === $('overlay-toile')) fermerModalToile(); });

// Fiche consultation
$('btn-close-fiche').addEventListener('click', fermerFiche);
$('btn-fiche-fermer').addEventListener('click', fermerFiche);
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
  if (token) { afficherEcran('ecran-principal'); chargerTout(); initTexturesUI(); }
  else afficherEcran('ecran-token');
} else {
  if (localStorage.getItem(K.pw)) $('login-aide').style.display = 'none';
}
