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
const COLS = 12, ROWS = 8; // grille magnétique
const CM_PAR_CASE = 15;    // 1 case ≈ 15 cm

// ═══════════════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════════════
let token = '';
let tailles = []; // codes de taille {code, label}
let toiles = [], salles = [];
let nextId = 1; // ID plancher monotone — ne redescend jamais après suppression
let salleActive = null;
let selectedToile = null;
let peintureSurMurSel = null;
let toilesSelectionnees = new Set(); // Multi-sélection pour mode placement
let occupancy = {};
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
let couleurMurPieceActuel = '#1a1a1a';   /* fond/décor de la pièce autour du mur d'expo */
let couleurMurBasActuel   = '#111111';   /* mur du bas (plinthe + portes) */
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
  let rep = await fetch(API + url, opts);
  /* 401 sur écriture : retry unique après 1.5s avant de conclure que le token est révoqué
     (GitHub peut envoyer un 401 transitoire sans que le token soit réellement invalide) */
  if (!rep.ok && rep.status === 401 && methode !== 'GET') {
    await new Promise(r => setTimeout(r, 1500));
    rep = await fetch(API + url, opts);
  }
  if (!rep.ok) {
    const e = await rep.json().catch(() => ({ message: rep.statusText }));
    if (rep.status === 401 && methode !== 'GET') {
      /* Toujours 401 après retry → token vraiment révoqué */
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

async function uploaderPhoto(id, b64, ext) {
  /* Dossier propre à chaque artiste, relatif à la racine du repo.
     Frédérique : assets/images/toiles/
     Alain      : artistes/alaindelree/assets/images/toiles/
     Le chemin stocké dans toiles.json est relatif à la galerie.html de l'artiste.
     ext optionnel ('png' pour thumbnails 3D transparents, défaut 'jpg'). */
  ext = ext || 'jpg';
  const base   = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'assets/images/toiles/';
  const prefix = (ADMIN_CFG.type === 'sculpture') ? 'piece' : 'toile';
  const chemin = base + `${prefix}-${String(id).padStart(3, '0')}.${ext}`;
  const stored = chemin; /* stocké tel quel dans toiles.json */
  let sha = null;
  try { const r = await apiGH(`/repos/${REPO}/contents/${chemin}?ref=${BRANCH}`); sha = r.sha; } catch (_) {}
  const corps = { message: `Admin : Photo ${prefix} #${id}`, content: b64, branch: BRANCH };
  if (sha) corps.sha = sha;
  await apiGH(`/repos/${REPO}/contents/${chemin}`, 'PUT', corps);
  return stored; /* chemin relatif stocké dans toiles.json */
}

async function uploaderGLB(id, b64) {
  /* Upload le fichier GLB dans le dossier models de l'artiste.
     Chemin GitHub = chemin stocké dans toiles.json (relatif au repo) */
  const base   = ADMIN_CFG.repoPath.replace(/data\/?$/, '') + 'assets/models/';
  const prefix = (typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture') ? 'piece-' : 'toile-';
  const chemin = base + prefix + String(id).padStart(3, '0') + '.glb';
  let sha = null;
  try { const r = await apiGH('/repos/' + REPO + '/contents/' + chemin + '?ref=' + BRANCH); sha = r.sha; } catch (_) {}
  const corps = { message: 'Admin : GLB ' + prefix.replace('-','') + ' #' + id, content: b64, branch: BRANCH };
  if (sha) corps.sha = sha;
  const rep = await apiGH('/repos/' + REPO + '/contents/' + chemin, 'PUT', corps);
  /* Vérifier que le commit a bien créé le fichier (évite les pièces fantômes
     avec un chemin GLB qui pointe vers un fichier inexistant). */
  if (!rep || !rep.content || !rep.content.sha) {
    throw new Error('Upload GLB non confirmé par GitHub');
  }
  return chemin; /* chemin relatif stocké dans toiles.json */
}

// ═══════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════
/* Chemin du stock d'œuvres : nouveau format data/oeuvres/<type>.json.
   Fallback transparent vers data/toiles.json (ancien format) en lecture
   pour les éventuels environnements pas encore migrés. L'écriture va
   toujours dans le nouveau chemin (sauvegarder() ci-dessous). */
function _oeuvresPath() {
  return ADMIN_CFG.repoPath + 'oeuvres/' + ADMIN_CFG.type + '.json';
}

/* Helper d'introspection — retourne le type d'une œuvre quel que soit
   son contexte. Utilisé par tout le code qui doit s'adapter selon
   peinture/sculpture sans dépendre d'ADMIN_CFG.type (qui n'est que le
   type principal de l'artiste, pas celui de l'œuvre individuelle). */
function typeDeLOeuvre(t) {
  return (t && t._type) || ADMIN_CFG.type || 'peinture';
}

/* Helpers de recherche d'œuvre en multi-types. En mono-type ces helpers
   sont équivalents aux toiles.find(...) historiques ; en multi-types,
   ils évitent les collisions d'ID entre peinture et sculpture (id=1 partagé). */
function _trouverOeuvre(id, typeOpt) {
  if (typeOpt) return toiles.find(function(t) {
    return t.id === id && typeDeLOeuvre(t) === typeOpt;
  });
  return toiles.find(function(t) { return t.id === id; });
}
function _salleContenantOeuvre(id, typeOpt) {
  return salles.find(function(s) {
    if (typeOpt && s.type && s.type !== typeOpt) return false;
    return (s.toiles || []).indexOf(id) >= 0;
  });
}

/* Construit le payload "stockData" d'un type donné, à envoyer à une
   iframe (galerie-apercu ou galerie-edit). En multi-types, c'est
   indispensable de filtrer toiles[] par type AVANT d'envoyer : sinon
   les peintures et sculptures de même id se collisionnent. */
function _stockParType(type) {
  var items = toiles.filter(function(t) { return typeDeLOeuvre(t) === type; });
  var codes = (typeof _taillesParType !== 'undefined' && _taillesParType[type]) ? _taillesParType[type] : [];
  var nid   = (typeof _nextIdParType  !== 'undefined' && _nextIdParType[type])  ? _nextIdParType[type]  : 1;
  return (type === 'sculpture')
    ? { next_id: nid, gabarits: codes, pieces: items }
    : { next_id: nid, tailles:  codes, toiles: items };
}

/* Dictionnaires par type peuplés au chargement (étape 3b-2 cohabitation).
   - _taillesParType : {peinture: [codes tailles], sculpture: [gabarits]}
   - _nextIdParType  : {peinture: N, sculpture: M}
   Permettent à sauvegarder() (étape suivante) de dispatcher correctement. */
var _taillesParType = {};
var _nextIdParType  = {};

/* Lit tous les fichiers data/oeuvres/<type>.json présents pour cet artiste
   et retourne un dict {type: contenu}. Fallback transparent vers l'ancien
   data/toiles.json si le répertoire oeuvres/ n'existe pas. */
async function _lireToutesOeuvres() {
  var dirPath = ADMIN_CFG.repoPath + 'oeuvres';
  var listing;
  try {
    listing = await apiGH('/repos/' + REPO + '/contents/' + dirPath + '?ref=' + BRANCH);
  } catch (e) {
    if ((e.message || '').match(/404|Not Found/i)) {
      /* Pas encore migré : fallback ancien data/toiles.json sous le type principal */
      console.log('[oeuvres] répertoire ' + dirPath + ' absent → fallback data/toiles.json');
      var legacy = await lireRaw(ADMIN_CFG.repoPath + 'toiles.json');
      var t = ADMIN_CFG.type || 'peinture';
      var r = {}; r[t] = legacy; return r;
    }
    throw e;
  }
  /* Filtre fichiers JSON (ignore les sous-répertoires éventuels) */
  var files = (Array.isArray(listing) ? listing : []).filter(function(f) {
    return f.type === 'file' && /\.json$/i.test(f.name);
  });
  var result = {};
  await Promise.all(files.map(async function(f) {
    var type = f.name.replace(/\.json$/i, '');
    result[type] = await lireRaw(dirPath + '/' + f.name);
  }));
  return result;
}

async function chargerTout() {
  const _ov = document.getElementById('overlay-chargement');
  if (_ov) _ov.classList.add('visible');
  try {
    const [oeuvresParType, sData] = await Promise.all([
      _lireToutesOeuvres(),
      lireRaw(ADMIN_CFG.repoPath + 'salles.json')
    ]);

    /* Construit le stock fusionné en mémoire : chaque œuvre porte _type pour
       qu'on puisse plus tard la sauver dans le bon fichier. */
    toiles = [];
    _taillesParType = {};
    _nextIdParType  = {};
    Object.keys(oeuvresParType).forEach(function(type) {
      var data  = oeuvresParType[type];
      var items = (type === 'sculpture') ? (data.pieces   || []) : (data.toiles  || []);
      var codes = (type === 'sculpture') ? (data.gabarits || []) : (data.tailles || []);
      items.forEach(function(it) { it._type = type; toiles.push(it); });
      _taillesParType[type] = codes;
      var maxId = items.length ? Math.max.apply(null, items.map(function(t) { return t.id; })) : 0;
      _nextIdParType[type] = Math.max(data.next_id || 0, maxId + 1);
    });

    /* Compat : variables globales basées sur le type principal de l'admin.
       Tant qu'aucun artiste n'a plusieurs types, ces variables sont les
       seules pertinentes. Le jour où on en aura, le code qui doit
       différencier doit appeler typeDeLOeuvre(t) au lieu de regarder
       ADMIN_CFG.type. */
    var typePrincipal = ADMIN_CFG.type || 'peinture';
    tailles = _taillesParType[typePrincipal] || [];
    nextId  = _nextIdParType[typePrincipal]  || 1;
    // Migre l'ancien format salles → nouveau format
    salles = (sData.salles || []).map(s => ({
      id: s.id, nom: s.nom,
      type: s.type || (ADMIN_CFG.type !== 'peinture' ? ADMIN_CFG.type : undefined),
      couleur_mur: s.couleur_mur || '#2e2e2e',
      /* Champs récents — préservés tels quels (undefined si absents,
         appliquera le default à l'usage). Les omettre ici les perdait
         silencieusement à chaque chargement : le JSON GitHub gardait
         les valeurs, mais salleActive en mémoire avait undefined →
         aperçu admin restait au gris/noir default malgré sauvegarde OK. */
      couleur_mur_piece: s.couleur_mur_piece,
      couleur_mur_bas:   s.couleur_mur_bas,
      couleur_cadres: s.couleur_cadres || '#3a3a3a',
      epaisseur_cadres: s.epaisseur_cadres || 2,
      texture: s.texture || 'none',
      visible: s.visible !== false,
      toiles: s.toiles || [],
      positions: s.positions || [],
      positions_mobile: s.positions_mobile || [],
      greffons: s.greffons || undefined
    }));
    if (typeof afficherPlan === 'function') afficherPlan();
    if (typeof majAlertePhotoManquante === 'function') majAlertePhotoManquante();
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

async function sauvegarder(message, toastMsg = '✓ Sauvegardé') {
  syncBadge('...');
  // Synchronise toiles[] depuis positions[] avant chaque sauvegarde
  salles.forEach(s => { s.toiles = (s.positions || []).map(p => p.id); });
  /* Replacer : ne jamais persister les champs temporaires (_preview, _photo_backup, _type…) */
  var _sansTemp = function(key, val) { return key.charAt(0) === '_' ? undefined : val; };
  try {
    /* Dispatch des œuvres par _type → un fichier data/oeuvres/<type>.json par type.
       Tous les types présents dans _taillesParType OU dans le toiles[] mémoire sont
       inclus (même vides), pour ne JAMAIS perdre un type qui aurait été chargé. */
    var typesPresents = {};
    Object.keys(_taillesParType).forEach(function(t) { typesPresents[t] = true; });
    toiles.forEach(function(t) { typesPresents[typeDeLOeuvre(t)] = true; });

    var fichiers = [];
    Object.keys(typesPresents).forEach(function(type) {
      var items = toiles.filter(function(t) { return typeDeLOeuvre(t) === type; });
      var codes = _taillesParType[type] || [];
      var maxId = items.length ? Math.max.apply(null, items.map(function(t) { return t.id; })) : 0;
      var nid   = Math.max(_nextIdParType[type] || 0, maxId + 1);
      _nextIdParType[type] = nid;
      var payload = (type === 'sculpture')
        ? { next_id: nid, gabarits: codes, pieces: items }
        : { next_id: nid, tailles:  codes, toiles: items };
      fichiers.push({
        chemin:  ADMIN_CFG.repoPath + 'oeuvres/' + type + '.json',
        contenu: JSON.stringify(payload, _sansTemp, 2)
      });
    });
    /* Sync nextId compat avec le type principal */
    var typePrincipal = ADMIN_CFG.type || 'peinture';
    if (_nextIdParType[typePrincipal]) nextId = _nextIdParType[typePrincipal];

    fichiers.push({ chemin: ADMIN_CFG.repoPath+'salles.json', contenu: JSON.stringify({ salles }, _sansTemp, 2) });
    await commitMulti(fichiers, 'Admin : ' + message);
    syncBadge('ok');
    if (toastMsg) toast(toastMsg);
    /* Snapshot mis à jour — retour après save ne restaure plus l'ancien état */
    if (typeof _arrangerSnapshot !== 'undefined' && _arrangerSnapshot && salleActive) {
      _arrangerSnapshot = {
        positions:        JSON.parse(JSON.stringify(salleActive.positions        || [])),
        positions_mobile: JSON.parse(JSON.stringify(salleActive.positions_mobile || [])),
        toiles:           JSON.parse(JSON.stringify(salleActive.toiles           || [])),
        supports:         toiles.map(function(t) {
          return {
            id:         t.id,
            _type:      typeDeLOeuvre(t),
            support:    t.support ? JSON.parse(JSON.stringify(t.support)) : null,
            sans_socle: t.sans_socle || false
          };
        })
      };
    }
  } catch (e) {
    rapporterErreur('Impossible de charger les données : ' + e.message, 'bloquant', e.stack || '');
    syncBadge('err');
    toast('Erreur : ' + e.message, 'err', 4000);
    throw e;
  }
}

/* marquerChangement() supprimée : le bouton flottant n'existe plus.
   Toutes les sauvegardes passent par des boutons intégrés (Enregistrer
   du mode Arranger, bottom-sheets Couleurs/Textures, modales toile, etc.) */

function prochainId(typeOpt) {
  /* Avec l'arrivée de la cohabitation peinture+sculpture, chaque type a
     son propre compteur (next_id séparé dans data/oeuvres/<type>.json).
     Le param optionnel permet de générer un ID dans le type souhaité ;
     par défaut, c'est le type principal de l'admin. */
  var type = typeOpt || ADMIN_CFG.type || 'peinture';
  if (!_nextIdParType[type]) _nextIdParType[type] = 1;
  var id = _nextIdParType[type];
  _nextIdParType[type]++;
  /* Sync la variable globale nextId pour le code legacy qui la lit */
  if (type === (ADMIN_CFG.type || 'peinture')) nextId = _nextIdParType[type];
  return id;
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
$('btn-changer-token')?.addEventListener('click', () => { token = ''; afficherEcran('ecran-token'); });

// Onglets
document.querySelectorAll('.onglet').forEach(o => {
  o.addEventListener('click', () => {
    /* Changer d'onglet ferme le panneau d'édition d'œuvre s'il est ouvert
       (sinon il reste flottant à droite alors qu'on a quitté la vue Œuvres). */
    if (typeof fermerModalToile === 'function') fermerModalToile();
    document.querySelectorAll('.onglet').forEach(x => x.classList.remove('actif'));
    document.querySelectorAll('.vue').forEach(x => x.classList.remove('active'));
    o.classList.add('actif');
    $(o.dataset.vue).classList.add('active');
    if (o.dataset.vue === 'vue-backup') chargerCommits();
    if (o.dataset.vue === 'vue-pages')  chargerInfos();
    if (o.dataset.vue === 'vue-artistes') { chargerVueArtistes(); chargerTemplates(); }
    if (o.dataset.vue === 'vue-oeuvres') {
      _oeuvresSelection.clear();
      if (typeof afficherOeuvres === 'function') afficherOeuvres();
    }
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
document.getElementById('btn-modifier-plan')?.addEventListener('click', function() {
  if (typeof _entrerModeEditionPlan === 'function') _entrerModeEditionPlan();
});
document.getElementById('btn-annuler-plan')?.addEventListener('click', function() {
  if (typeof _ordreAvantEdition !== 'undefined' && _ordreAvantEdition) {
    var ordreRef = _ordreAvantEdition.slice();
    salles.sort(function(a, b) {
      return ordreRef.indexOf(a.id) - ordreRef.indexOf(b.id);
    });
  }
  if (typeof _quitterModeEditionPlan === 'function') _quitterModeEditionPlan();
});
document.getElementById('btn-appliquer-plan')?.addEventListener('click', async function() {
  var btn = this;
  btn.disabled = true;
  try {
    await sauvegarder('[admin] Ordre des salles modifié', '✓ Ordre sauvegardé');
    if (typeof _quitterModeEditionPlan === 'function') _quitterModeEditionPlan();
  } catch(e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btn.disabled = false; }
});

$('btn-ajouter-salle')?.addEventListener('click', () => ouvrirModalSalle()); /* défensif : élément retiré du DOM, chip "＋ Salle" prend le relais */
// ── Système popover (1 popover ouvert max, fermeture clic dehors / Échap) ──
let _popoverOuvert = null;
function fermerPopover() {
  if (_popoverOuvert) {
    var pop = document.getElementById(_popoverOuvert.id);
    if (pop) {
      pop.classList.remove('ouvert');
      /* Sortir du mode édition si actif */
      if (pop.classList.contains('mode-edit')) {
        pop.classList.remove('mode-edit');
        var crayon = pop.querySelector('.pop-edit-btn');
        if (crayon) {
          crayon.classList.remove('on');
          crayon.textContent = '✎';
          crayon.title = 'Gérer (supprimer)';
        }
      }
    }
    document.getElementById(_popoverOuvert.btn)?.classList.remove('on');
    _popoverOuvert = null;
  }
}
function ouvrirPopover(popId, btnId) {
  if (_popoverOuvert && _popoverOuvert.id === popId) { fermerPopover(); return; }
  fermerPopover();
  const pop = document.getElementById(popId);
  const btn = document.getElementById(btnId);
  if (!pop || !btn) return;
  // Positionner sous le bouton (aligné à droite si dépassement)
  const r = btn.getBoundingClientRect();
  pop.style.visibility = 'hidden';
  pop.classList.add('ouvert');
  const popW = pop.offsetWidth;
  const popH = pop.offsetHeight;
  const margin = 6;
  let left = r.left;
  if (left + popW > window.innerWidth - margin) left = window.innerWidth - popW - margin;
  if (left < margin) left = margin;
  let top = r.bottom + 4;
  if (top + popH > window.innerHeight - margin) top = Math.max(margin, r.top - popH - 4);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
  pop.style.visibility = '';
  btn.classList.add('on');
  _popoverOuvert = { id: popId, btn: btnId };
}
// Clic en dehors → ferme
document.addEventListener('click', (e) => {
  if (!_popoverOuvert) return;
  const pop = document.getElementById(_popoverOuvert.id);
  const btn = document.getElementById(_popoverOuvert.btn);
  if (pop && (pop.contains(e.target) || btn?.contains(e.target))) return;
  fermerPopover();
});
// Échap → ferme
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerPopover(); });

// Mapping bouton → popover
[
  ['btn-pop-mur',       'pop-mur'],
  ['btn-pop-mur-piece', 'pop-mur-piece'],
  ['btn-pop-mur-bas',   'pop-mur-bas'],
  ['btn-pop-cadres',    'pop-cadres'],
  ['btn-pop-epaisseur', 'pop-epaisseur'],
  ['btn-pop-texture',   'pop-texture'],
  ['btn-pop-revetement','pop-revetement'],
  ['btn-pop-musique',   'pop-musique'],
].forEach(([btnId, popId]) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    ouvrirPopover(popId, btnId);
    // Chargements à la demande
    if (popId === 'pop-musique') chargerEtAfficherMusique();
    if (popId === 'pop-texture' && !window._texturesGHChargees) chargerTexturesGitHub();
  });
});

/* Sous-popovers Texture : "Ajouter une texture" et "Textures système" */
document.getElementById('btn-tex-plus')?.addEventListener('click', (e) => {
  e.stopPropagation();
  ouvrirPopover('pop-tex-plus', 'btn-tex-plus');
});
document.getElementById('btn-tex-systeme')?.addEventListener('click', (e) => {
  e.stopPropagation();
  ouvrirPopover('pop-tex-systeme', 'btn-tex-systeme');
  if (typeof afficherTexturesSysteme === 'function') afficherTexturesSysteme();
});

// ── Modal Vider salles ───────────────────────────────────────────
$('btn-vider-salles')?.addEventListener('click', () => ouvrirModalViderSalles());
$('btn-close-vider')?.addEventListener('click', () => fermerModalViderSalles());
$('btn-vider-annuler')?.addEventListener('click', () => fermerModalViderSalles());
$('btn-vider-valider')?.addEventListener('click', () => validerViderSalles());
$('overlay-vider-salles')?.addEventListener('click', function(e) {
  if (e.target === this) fermerModalViderSalles();
});
$('btn-rename').addEventListener('click', async () => {
  const nom = $('inp-rename').value.trim();
  if (!nom || !salleActive) return;
  const btnRn = $('btn-rename');
  salleActive.nom = nom;
  $('badge-salle').textContent = nom;
  $('inp-rename').value = '';
  btnRn.disabled = true;
  try { await sauvegarder(`[admin] Renommage salle → "${nom}"`, '✓ Renommé'); marquerSalleEnAttente(salleActive?.id); if (typeof afficherPlan === 'function') afficherPlan(); }
  catch (e) { toast('Erreur : ' + e.message, 'err'); }
  finally { btnRn.disabled = false; }
});

// Bouton arranger le mur
$('btn-arranger-mur').addEventListener('click', () => entrerModePlacement());

// Bouton Modifier : ouvre le formulaire d'édition pour la toile sélectionnée
$('btn-modifier-toile').addEventListener('click', () => {
  if (selectedToile) ouvrirFormulaireEdition(selectedToile.id);
});
$('btn-apercu-placement').addEventListener('click', () => {
  if (_arrangerADesModifs()) {
    if (!confirm('Des modifications ne sont pas enregistrées et seront perdues.\n\nQuitter quand même ?')) return;
  }
  quitterModePlacement();
});

/* Switch vue PC / GSM — dispatch sol/mur selon le type de la salle active */
$('btn-switch-vue')?.addEventListener('click', function() {
  _placementVue = _placementVue === 'pc' ? 'gsm' : 'pc';
  this.textContent = _placementVue === 'pc' ? '🖥 PC' : '📱 GSM';
  this.style.background = _placementVue === 'gsm' ? 'var(--gold)' : '';
  this.style.color = _placementVue === 'gsm' ? '#fff' : '';
  peintureSurMurSel = null;
  /* En GSM peinture : si pas encore de positions mobiles, partir d'une
     copie des positions PC (cohérent avec ouvrirArrangerApresConfirm) */
  if (_placementVue === 'gsm' && salleActive
      && (!salleActive.positions_mobile || !salleActive.positions_mobile.length)) {
    salleActive.positions_mobile = JSON.parse(JSON.stringify(salleActive.positions || []));
  }
  afficherMurPlacement(); /* dispatch interne vers afficherSolPlacement si sculpture */
  afficherStripPlacement();
});
$('btn-sauver-placement').addEventListener('click', async () => {
  const btn = $('btn-sauver-placement');
  btn.disabled = true; btn.textContent = 'En cours…';
  try {
    const lbl = _isSculpt ? 'pièces' : 'toiles';
    salles.forEach(s => { s.toiles = (s.positions || []).map(p => p.id); });
    await sauvegarder('[admin] Placement ' + lbl + ' — ' + (salleActive?.nom || 'salle'), null);
    toast('✓ Placement enregistré');
    /* Mettre à jour le snapshot → plus de "modifs non sauvegardées" après save */
    if (typeof _refreshArrangerSnapshot === 'function') _refreshArrangerSnapshot();
    /* Rester dans l'Arranger : le flux est souvent organiser PC → sauver →
       basculer GSM → organiser → sauver. La sortie se fait via ← Retour. */
  } catch (e) {
    toast('Erreur : ' + e.message, 'err');
  }
  btn.disabled = false; btn.textContent = '💾 Enregistrer';
});
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
    /* Comportement basé sur le type de la SALLE active, pas de l'admin —
       chez Dinso, une salle peinture doit utiliser deplacerPeinture même
       si ADMIN_CFG.type vaut 'sculpture'. */
    var _typeSalleSel = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
    if (_typeSalleSel === 'sculpture') {
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
  $("pl-btn-details")?.addEventListener("click", function() {
    if (peintureSurMurSel === null) return;
    var _typeAct = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
    if (typeof ouvrirFiche === 'function') ouvrirFiche(peintureSurMurSel, _typeAct);
  });
  $("pl-btn-rm")   ?.addEventListener("click", function() {
    if (peintureSurMurSel === null) return;
    var _typeRm = (salleActive && salleActive.type) || ADMIN_CFG.type || 'peinture';
    var titre = (_trouverOeuvre(peintureSurMurSel, _typeRm) || {}).titre || "—";
    if (_typeRm === 'sculpture') {
      var pos = _getPositions();
      var idx = pos.findIndex(function(x){ return x.id === peintureSurMurSel; });
      if (idx >= 0) pos.splice(idx, 1);
      /* toiles reste inchangé — la pièce est toujours dans la salle */
    } else {
      salleActive.positions = (salleActive.positions||[]).filter(function(x){ return x.id !== peintureSurMurSel; });
      salleActive.toiles    = (salleActive.toiles||[]).filter(function(id){ return id !== peintureSurMurSel; });
    }
    toilesSelectionnees.add(peintureSurMurSel);
    peintureSurMurSel = null; selectedToilePl = null;
    buildOccupancy(); afficherMurPlacement(); afficherStripPlacement();
    $("pl-aide").textContent = "\"" + titre + "\" retirée — cliquez sur " + (_typeRm === 'sculpture' ? 'le sol' : 'le mur') + " pour la replacer";
  });

  /* ── Drag-and-drop du panneau de contrôle ──
     L'utilisateur peut déplacer librement le panneau pour ne pas masquer
     une toile du strip. Seuil de 6px avant d'activer le drag pour que les
     clics sur les boutons ↑↓←→ ✕ 👁 restent fiables. Position préservée
     pendant toute la session (jusqu'à reload). */
  (function _initDragPanelCtrl() {
    var panel = document.getElementById('pl-ctrl-panel');
    if (!panel) return;
    panel.style.cursor = 'grab';
    panel.style.touchAction = 'none';
    var _personalise = false; /* devient true dès qu'un drag aboutit */
    function _onDown(e) {
      /* Ne pas démarrer si le clic est sur un bouton interactif */
      if (e.target.closest('button')) return;
      var pt = e.touches ? e.touches[0] : e;
      var rect = panel.getBoundingClientRect();
      var startX = pt.clientX, startY = pt.clientY;
      var startLeft = rect.left, startTop = rect.top;
      var seuil = 6, dragActif = false;
      function _onMove(ev) {
        var p = ev.touches ? ev.touches[0] : ev;
        var dx = p.clientX - startX, dy = p.clientY - startY;
        if (!dragActif && (Math.abs(dx) + Math.abs(dy)) > seuil) {
          dragActif = true;
          panel.style.cursor = 'grabbing';
          /* Désactiver le centrage CSS pour pouvoir bouger en absolute pur */
          panel.style.transform = 'none';
          panel.style.bottom    = 'auto';
          panel.style.left      = startLeft + 'px';
          panel.style.top       = startTop  + 'px';
          _personalise = true;
        }
        if (dragActif) {
          if (ev.cancelable) ev.preventDefault();
          var w = panel.offsetWidth, h = panel.offsetHeight;
          var nl = Math.max(4, Math.min(window.innerWidth  - w - 4, startLeft + dx));
          var nt = Math.max(4, Math.min(window.innerHeight - h - 4, startTop  + dy));
          panel.style.left = nl + 'px';
          panel.style.top  = nt + 'px';
        }
      }
      function _onUp() {
        panel.style.cursor = 'grab';
        document.removeEventListener('mousemove', _onMove);
        document.removeEventListener('mouseup',   _onUp);
        document.removeEventListener('touchmove', _onMove);
        document.removeEventListener('touchend',  _onUp);
        document.removeEventListener('touchcancel', _onUp);
      }
      document.addEventListener('mousemove', _onMove);
      document.addEventListener('mouseup',   _onUp);
      document.addEventListener('touchmove', _onMove, { passive: false });
      document.addEventListener('touchend',  _onUp);
      document.addEventListener('touchcancel', _onUp);
    }
    panel.addEventListener('mousedown',  _onDown);
    panel.addEventListener('touchstart', _onDown, { passive: true });
    /* Si la fenêtre rétrécit, recadrer la position personnalisée pour
       qu'elle reste visible (sinon perdue hors viewport). */
    window.addEventListener('resize', function() {
      if (!_personalise) return;
      var rect = panel.getBoundingClientRect();
      var w = panel.offsetWidth, h = panel.offsetHeight;
      var nl = Math.max(4, Math.min(window.innerWidth  - w - 4, rect.left));
      var nt = Math.max(4, Math.min(window.innerHeight - h - 4, rect.top));
      panel.style.left = nl + 'px';
      panel.style.top  = nt + 'px';
    });
  })();
})();

// Intercepte le bouton retour Android quand le mode arrangement est ouvert
window.addEventListener('popstate', () => {
  if ($('overlay-placement').classList.contains('ouvert')) {
    quitterModePlacement();
  }
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
