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
  textures: ADMIN_CFG.prefix + '_textures_custom'
};

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
  chargerConfigEmailJS();
}

function initTexturesUI() {
  /* Charger les textures GitHub (partagées + privées) */
  chargerTexturesGitHub();
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
  $('pl-salle-nom').textContent = salleActive.nom;
  $('overlay-placement').classList.add('ouvert');
  // Pousse un état pour intercepter le bouton retour Android
  history.pushState({ ff: 'arrangement' }, '');
  grilleVisiblePl = false;
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

  // Cellules vides
  for (let r=1;r<=ROWS;r++) for (let c=1;c<=COLS;c++) {
    if (occupancy[`${c},${r}`]) continue;
    const cell = document.createElement('div'); cell.className='cellule';
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

// ═══════════════════════════════════════════════
// PHOTO — resize & compress
// ═══════════════════════════════════════════════
function traiterPhoto(fichier) {
  return new Promise((ok, ko) => {
    const img = new Image(), url = URL.createObjectURL(fichier);
    img.onload = () => {
      let w = img.width, h = img.height;
      // Redimensionne si l'une ou l'autre dimension dépasse MAX_PX (gère les portraits)
      const ratio = Math.min(MAX_PX / w, MAX_PX / h, 1);
      if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', JPEG_Q).split(',')[1]);
    };
    img.onerror = ko; img.src = url;
  });
}

// ── Qualité photo ───────────────────────────────────────────────
function afficherQualitePhoto(maxDim, isOriginal) {
  const el = $('photo-qualite');
  if (!el || !maxDim) return;
  let niveau, icone, color;
  if (isOriginal) {
    // Seuils sur dimensions originales (avant compression)
    if      (maxDim < 800)  { niveau = 'Qualité photo faible';   icone = '\u25cf\u25cb\u25cb\u25cb'; color = 'var(--danger)'; }
    else if (maxDim < 1400) { niveau = 'Qualité photo correcte'; icone = '\u25cf\u25cf\u25cb\u25cb'; color = 'var(--muted)'; }
    else if (maxDim < 2500) { niveau = 'Qualité photo bonne';    icone = '\u25cf\u25cf\u25cf\u25cb'; color = 'var(--success)'; }
    else                    { niveau = 'Qualité photo parfaite'; icone = '\u25cf\u25cf\u25cf\u25cf'; color = 'var(--gold2)'; }
  } else {
    // Seuils sur photo stockée (déjà compressée à max 1400px)
    if      (maxDim < 700)  { niveau = 'Qualité photo faible';   icone = '\u25cf\u25cb\u25cb\u25cb'; color = 'var(--danger)'; }
    else if (maxDim < 1000) { niveau = 'Qualité photo correcte'; icone = '\u25cf\u25cf\u25cb\u25cb'; color = 'var(--muted)'; }
    else if (maxDim < 1300) { niveau = 'Qualité photo bonne';    icone = '\u25cf\u25cf\u25cf\u25cb'; color = 'var(--success)'; }
    else                    { niveau = 'Qualité photo parfaite'; icone = '\u25cf\u25cf\u25cf\u25cf'; color = 'var(--gold2)'; }
  }
  el.innerHTML = '<span style="letter-spacing:.12em;font-size:.68rem;">' + icone + '</span>\u00a0' + niveau;
  el.style.color = color;
  el.style.display = '';
}

// ═══════════════════════════════════════════════
// BACKUP / ROLLBACK
// ═══════════════════════════════════════════════
async function chargerCommits() {
  const cont = $('commits-contenu');
  cont.innerHTML = '<div class="chargement"><svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Chargement…</div>';
  try {
    const tousCommits = await apiGH(`/repos/${REPO}/commits?path=${ADMIN_CFG.repoPath}toiles.json&per_page=50`);
    // Garde uniquement les commits admin (préfixe "Admin :") + le plus récent quel qu'il soit
    const commits = tousCommits.filter((c, i) => 
      i === 0 || c.commit.message.toLowerCase().startsWith('admin :')
    );
    if (!commits.length) { cont.innerHTML = '<div class="chargement" style="color:var(--muted)">Aucun historique.</div>'; return; }
    cont.innerHTML = '';
    const liste = document.createElement('div'); liste.className = 'commits-liste';
    commits.forEach((c, i) => {
      const msg = c.commit.message.replace(/^Admin\s*:\s*/i, '');
      const date = formaterDate(c.commit.author.date);
      const item = document.createElement('div'); item.className = 'commit-item';
      item.innerHTML = `
        <div style="width:2rem;height:2rem;border-radius:50%;background:${i===0?'rgba(200,160,80,.15)':'var(--bg3)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${i===0?'var(--gold)':'var(--muted)'}" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
        </div>
        <div class="commit-corps">
          <div class="commit-msg">${msg}</div>
          <div class="commit-date">${date}</div>
        </div>
        ${i===0 ? '<span class="commit-actuel">Actuel</span>' : `<button class="btn btn-outline btn-sm" data-sha="${c.sha}" data-msg="${msg.replace(/"/g,'')}" data-date="${date}">Restaurer</button>`}`;
      liste.appendChild(item);
    });
    cont.appendChild(liste);
    cont.querySelectorAll('[data-sha]').forEach(btn => {
      btn.addEventListener('click', () => demanderRestauration(btn.dataset.sha, btn.dataset.msg, btn.dataset.date));
    });
  } catch (e) { cont.innerHTML = `<div class="chargement" style="color:var(--danger)">Erreur : ${e.message}</div>`; }
}

function demanderRestauration(sha, msg, date) {
  commitARestaurer = sha;
  $('restore-txt1').innerHTML = `Restaurer à l'état du :<br><strong>${date}</strong><br><br>Version : <em>${msg}</em><br><br>Toutes les modifications <strong>après cette date</strong> seront annulées.`;
  $('restore-txt2').innerHTML = `Restauration vers :<br><strong style="color:var(--gold)">${msg}</strong><br><strong style="color:var(--danger)">${date}</strong>`;
  $('inp-restore').value = '';
  $('btn-restore-ok').disabled = true;
  document.querySelectorAll('.restore-step').forEach(s => s.classList.remove('active'));
  $('restore-s1').classList.add('active');
  $('overlay-restore').classList.add('ouvert');
}

async function executerRestauration() {
  const btn = $('btn-restore-ok'); btn.disabled = true; btn.textContent = '⟳ Restauration…';
  try {
    const [tf, sf] = await Promise.all([
      apiGH(`/repos/${REPO}/contents/${ADMIN_CFG.repoPath}toiles.json?ref=${commitARestaurer}`),
      apiGH(`/repos/${REPO}/contents/${ADMIN_CFG.repoPath}salles.json?ref=${commitARestaurer}`)
    ]);
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath+'toiles.json', contenu: tf.content.replace(/\n/g, ''), encoding: 'base64' },
      { chemin: ADMIN_CFG.repoPath+'salles.json', contenu: sf.content.replace(/\n/g, ''), encoding: 'base64' }
    ], `Admin : Restauration vers ${commitARestaurer.substring(0, 7)}`);
    $('overlay-restore').classList.remove('ouvert');
    syncBadge('ok');
    toast('✓ Restauration effectuée — rechargement…');
    await chargerTout();
  } catch (e) { toast('Erreur : ' + e.message, 'err', 4000); btn.disabled = false; btn.textContent = 'Restaurer'; }
}

// ═══════════════════════════════════════════════
// APPARENCE (couleurs + textures)
// ═══════════════════════════════════════════════
const TEXTURES = {
  none:   '',
  tissu:  'repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 4px)',
  bois:   'repeating-linear-gradient(rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 3px)',
  pierre: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 6px)',
  damier: 'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/8px 8px'
};

function appliquerApparence() {
  const bg = $('mur-bg');
  const isImgTex = /\.(jpg|jpeg|png|webp)$/i.test(textureActuelle);
  if (isImgTex) {
    /* Texture image : multiply blend pour laisser voir la couleur */
    bg.style.background = 'url("' + (TEXTURES[textureActuelle] || '').replace(/url\("|"\)/g,'') + '") center/cover, ' + couleurMurActuel;
    bg.style.backgroundBlendMode = 'multiply';
    return;
  }
  bg.style.backgroundBlendMode = '';
  const tex = TEXTURES[textureActuelle] || '';
  bg.style.background = tex
    ? `${tex}, ${couleurMurActuel}`
    : couleurMurActuel;
  // Swatches
  document.querySelectorAll('#sw-mur .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === couleurMurActuel));
  document.querySelectorAll('#sw-cadres .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === couleurCadresActuel));
  document.querySelectorAll('#sw-texture .sw').forEach(s => s.classList.toggle('sel', s.dataset.val === textureActuelle));
  // Met à jour les cadres affichés
  document.querySelectorAll('.toile-posee').forEach(el => {
    if (!el.classList.contains('reserve-posee')) el.style.borderColor = couleurCadresActuel;
  });
}

// ═══════════════════════════════════════════════
// MUSIQUE
// ═══════════════════════════════════════════════
let _musiqueChargee = false;

/* Charge depuis GitHub si pas encore fait, puis affiche */
async function chargerEtAfficherMusique() {
  if (!_musiqueChargee) {
    try {
      var d = await lireRaw(ADMIN_CFG.repoPath + "infos.json").catch(function(){ return {}; });
      infosData.musique = d.musique || { fichier: "" };
      _musiqueChargee = true;
    } catch(e) {
      infosData.musique = infosData.musique || { fichier: '' };
    }
  }
  afficherSectionMusique();
}

function afficherSectionMusique() {
  var fichier = (infosData.musique && infosData.musique.fichier) || '';
  var nomEl  = $('musique-nom');
  var prevEl = $('musique-prev');
  var delBtn = $('btn-musique-del');
  if (!nomEl) return;
  if (fichier) {
    nomEl.textContent = fichier.split('/').pop();
    nomEl.title = fichier;
    prevEl.src = fichier + '?v=' + Date.now();
    prevEl.style.display = '';
    if (delBtn) delBtn.style.display = '';
  } else {
    nomEl.textContent = 'Aucune';
    nomEl.title = '';
    if (prevEl) { prevEl.src = ''; prevEl.style.display = 'none'; }
    if (delBtn) delBtn.style.display = 'none';
  }
  // Remplir les champs crédits
  var m = infosData.musique || {};
  var setV = function(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
  setV('mus-titre', m.titre); setV('mus-auteur', m.auteur);
  setV('mus-interprete', m.interprete); setV('mus-lien', m.lien); setV('mus-licence', m.licence);
}

async function uploaderMusique(fichier) {
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  if (fichier.size > 12 * 1024 * 1024) { toast('Fichier trop lourd (max 12 MB)', 'err'); return; }
  toast('Upload musique…');
  try {
    var b64 = await new Promise(function(ok, ko) {
      var reader = new FileReader();
      reader.onload = function(e) { ok(e.target.result.split(',')[1]); };
      reader.onerror = ko;
      reader.readAsDataURL(fichier);
    });
    var nom = fichier.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    var base = ADMIN_CFG.repoPath.replace(/data\/?$/, '');
    var cheminGH = base + 'assets/music/' + nom;
    var cheminStocke = 'assets/music/' + nom; // relatif à galerie.html artiste

    // Supprime l'ancien fichier s'il est différent
    var ancienFichier = (infosData.musique && infosData.musique.fichier) || '';
    if (ancienFichier && ancienFichier !== cheminStocke) {
      var ancienGH = base + ancienFichier;
      try {
        var rAnc = await apiGH('/repos/' + REPO + '/contents/' + ancienGH);
        await apiGH('/repos/' + REPO + '/contents/' + ancienGH, 'DELETE', {
          message: 'Admin : Suppression ancienne musique', sha: rAnc.sha, branch: BRANCH
        });
      } catch(_) {}
    }

    if (!infosData.musique) infosData.musique = {};
    infosData.musique.fichier = cheminStocke;
    await commitMulti([
      { chemin: cheminGH,                                  contenu: b64, encoding: 'base64' },
      { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosData, null, 2) }
    ], 'Admin : Musique galerie mise à jour');

    _musiqueChargee = true;
    afficherSectionMusique();
    toast('✓ Musique mise à jour');
  } catch(e) {
    toast('Erreur upload musique : ' + e.message, 'err');
  }
}

async function supprimerMusique() {
  var fichier = (infosData.musique && infosData.musique.fichier) || '';
  if (!fichier) return;
  if (!confirm('Supprimer la musique de la galerie ?')) return;
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  var base = ADMIN_CFG.repoPath.replace(/data\/?$/, '');
  var cheminGH = base + fichier;
  try {
    var r = await apiGH('/repos/' + REPO + '/contents/' + cheminGH);
    await apiGH('/repos/' + REPO + '/contents/' + cheminGH, 'DELETE', {
      message: 'Admin : Suppression musique galerie', sha: r.sha, branch: BRANCH
    });
  } catch(_) { /* fichier déjà absent */ }
  infosData.musique = { fichier: '' };
  await commitMulti([
    { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosData, null, 2) }
  ], 'Admin : Musique galerie supprimée');
  afficherSectionMusique();
  toast('✓ Musique supprimée');
}

// ═══════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════
function ouvrirModalPreset() {
  // Prérempli la preview
  $('preset-prev-mur').style.background = couleurMurActuel;
  $('preset-prev-mur-val').textContent = couleurMurActuel;
  $('preset-prev-cadres').style.background = couleurCadresActuel;
  $('preset-prev-cadres-val').textContent = couleurCadresActuel;
  const nomsTex = {none:'Uni',tissu:'Tissu',bois:'Bois clair',parquet:'Parquet',pierre:'Pierre',damier:'Damier',velours:'Velours',brique:'Béton/Brique'};
  $('preset-prev-texture-val').textContent = nomsTex[textureActuelle] || textureActuelle;
  if (TEXTURES[textureActuelle]) $('preset-prev-texture').style.background = TEXTURES[textureActuelle] + ',#555';
  $('inp-preset-nom').value = '';
  $('overlay-preset').classList.add('ouvert');
  setTimeout(() => $('inp-preset-nom').focus(), 200);
}

function confirmerPreset() {
  const nom = $('inp-preset-nom').value.trim();
  if (!nom) { toast('Entrez un nom pour le preset', 'err'); return; }
  const presets = JSON.parse(localStorage.getItem(K.presets) || '{}');
  presets[nom] = { couleur_mur: couleurMurActuel, couleur_cadres: couleurCadresActuel, texture: textureActuelle };
  localStorage.setItem(K.presets, JSON.stringify(presets));
  $('overlay-preset').classList.remove('ouvert');
  toast(`✓ Preset "${nom}" sauvegardé`);
}

function chargerPreset() {
  const presets = JSON.parse(localStorage.getItem(K.presets) || '{}');
  const noms = Object.keys(presets);
  if (!noms.length) { toast('Aucun preset — sauvegardez-en un d\'abord', 'err'); return; }
  const choix = noms.length === 1 ? noms[0] : prompt(`Presets disponibles :\n${noms.map((n,i) => `${i+1}. ${n}`).join('\n')}\n\nEntrez le nom :`);
  if (!choix || !presets[choix]) { if(choix) toast('Preset non trouvé', 'err'); return; }
  const p = presets[choix];
  couleurMurActuel = p.couleur_mur;
  couleurCadresActuel = p.couleur_cadres;
  textureActuelle = p.texture || 'none';
  if (salleActive) {
    salleActive.couleur_mur = couleurMurActuel;
    salleActive.couleur_cadres = couleurCadresActuel;
    salleActive.texture = textureActuelle;
    marquerChangement();
  }
  appliquerApparence(); afficherMur();
  toast(`✓ Preset "${choix}" appliqué`);
}

function gererTextureCustom(fichier) {
  if (!fichier) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const key = 'tex_custom_' + Date.now();
    const customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
    customs.push({ key, url: dataUrl, nom: fichier.name.split('.')[0] });
    if (customs.length > 5) customs.shift(); // garde max 5
    localStorage.setItem(K.textures, JSON.stringify(customs));
    afficherTexturesCustom();
    setTexture(key);
    toast('✓ Texture ajoutée');
  };
  reader.readAsDataURL(fichier);
}

function afficherTexturesCustom() {
  const cont = $('textures-custom'); if (!cont) return;
  cont.innerHTML = '';
  const customs = JSON.parse(localStorage.getItem(K.textures) || '[]');
  customs.forEach(t => {
    TEXTURES[t.key] = `url("${t.url}")`;
    const sw = document.createElement('div');
    sw.className = 'sw' + (textureActuelle === t.key ? ' sel' : '');
    sw.style.backgroundImage = `url("${t.url}")`;
    sw.style.backgroundSize = 'cover';
    sw.dataset.val = t.key;
    sw.title = t.nom;
    sw.addEventListener('click', () => {
      document.querySelectorAll('#sw-texture .sw, #textures-custom .sw').forEach(s => s.classList.remove('sel'));
      sw.classList.add('sel'); setTexture(t.key);
    });
    cont.appendChild(sw);
  });
}




function swSelect(el, groupe) {
  el.closest('.swatches').querySelectorAll('.sw').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
}

function initSwatches() {
  document.querySelectorAll('#sw-mur .sw').forEach(sw => {
    sw.addEventListener('click', () => { swSelect(sw, 'mur'); setCouleurMur(sw.dataset.val); });
  });
  document.querySelectorAll('#sw-cadres .sw').forEach(sw => {
    sw.addEventListener('click', () => { swSelect(sw, 'cadres'); setCouleurCadres(sw.dataset.val); });
  });
  document.querySelectorAll('#sw-texture .sw').forEach(sw => {
    sw.addEventListener('click', () => { swSelect(sw, 'texture'); setTexture(sw.dataset.val); });
  });
  $('mur-custom').addEventListener('change', e => {
    document.querySelectorAll('#sw-mur .sw').forEach(s => s.classList.remove('sel'));
    setCouleurMur(e.target.value);
  });
  $('btn-preset-sauver').addEventListener('click', ouvrirModalPreset);
  $('btn-preset-charger').addEventListener('click', chargerPreset);
  $('btn-close-preset').addEventListener('click', () => $('overlay-preset').classList.remove('ouvert'));
  $('btn-annuler-preset').addEventListener('click', () => $('overlay-preset').classList.remove('ouvert'));
  $('btn-confirmer-preset').addEventListener('click', confirmerPreset);
  $('inp-preset-nom').addEventListener('keydown', e => { if(e.key==='Enter') confirmerPreset(); });
  $('overlay-preset').addEventListener('click', e => { if(e.target===$('overlay-preset')) $('overlay-preset').classList.remove('ouvert'); });
  $('cadres-custom').addEventListener('change', e => {
    document.querySelectorAll('#sw-cadres .sw').forEach(s => s.classList.remove('sel'));
    setCouleurCadres(e.target.value);
  });
  afficherTexturesCustom();
}

function setCouleurMur(col) {
  couleurMurActuel = col;
  if (salleActive) { salleActive.couleur_mur = col; marquerChangement(); }
  appliquerApparence();
}

function setCouleurCadres(col) {
  couleurCadresActuel = col;
  if (salleActive) { salleActive.couleur_cadres = col; marquerChangement(); }
  appliquerApparence();
  afficherMur();
}

function setTexture(val) {
  textureActuelle = val;
  if (salleActive) { salleActive.texture = val; marquerChangement(); }
  appliquerApparence();
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
    if (o.dataset.vue === 'vue-artistes') chargerVueArtistes();
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
async function sauverCreditsMusique() {
  if (!token) { toast('Token GitHub requis', 'err'); return; }
  if (!infosData.musique) infosData.musique = {};
  var getV = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  infosData.musique.titre      = getV('mus-titre');
  infosData.musique.auteur     = getV('mus-auteur');
  infosData.musique.interprete = getV('mus-interprete');
  infosData.musique.lien       = getV('mus-lien');
  infosData.musique.licence    = getV('mus-licence');
  var btn = document.getElementById('btn-credits-sauver');
  if (btn) btn.disabled = true;
  try {
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath + 'infos.json', contenu: JSON.stringify(infosData, null, 2) }
    ], 'Admin : Crédits musique mis à jour');
    toast('✓ Crédits sauvegardés');
  } catch(e) {
    toast('Erreur : ' + e.message, 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Câblage bouton crédits
document.getElementById('btn-credits-sauver')?.addEventListener('click', sauverCreditsMusique);
// Bouton Changer → déclenche directement le file picker
$('btn-musique-changer')?.addEventListener('click', () => {
  $('inp-musique-upload').click();
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
  $('mur-placement').classList.toggle('grille-on', grilleVisiblePl);
  $('btn-grille-pl').style.color = grilleVisiblePl ? 'var(--gold)' : '';
  $('btn-grille-pl').style.borderColor = grilleVisiblePl ? 'var(--gold)' : '';
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
// RECADRAGE PHOTO (Cropper.js)
// ═══════════════════════════════════════════════
let cropperInst = null;
let cropCallback = null;

function ouvrirCrop(file, callback) {
  cropCallback = callback;
  const reader = new FileReader();
  reader.onload = e => {
    if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
    const img = $('crop-img');
    $('overlay-crop').classList.add('ouvert');
    // onload AVANT src pour éviter le race condition mobile
    img.onload = () => {
      _origPhotoMaxDim = Math.max(img.width, img.height); // capture avant compression/crop
      if (typeof Cropper === "undefined") {
        // Fallback si Cropper.js pas chargé : utilise la photo sans recadrage
        fermerCrop();
        toast('Outil de recadrage non disponible (réseau lent) — photo utilisée sans recadrage', 'err');
        if (cropCallback) cropCallback(e.target.result.split(",")[1]);
        return;
      }
      cropperInst = new Cropper(img, {
        viewMode: 1,
        dragMode: 'move',
        autoCrop: false,
        restore: false,
        guides: false,
        center: false,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        responsive: true,
        movable: true,
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: false,
      });
      // Étape 1 visible, étape 2 cachée
      $('crop-etape1').style.display = '';
      $('crop-etape2').style.display = 'none';
      $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function fermerCrop() {
  $('overlay-crop').classList.remove('ouvert');
  if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
  cropCallback = null;
  $('inp-photo').value = '';
}

$('btn-crop-valider').addEventListener('click', () => {
  if (!cropperInst) return;
  // Si pas encore de cropBox, activer sur l'image entière
  if (!cropperInst.getCropBoxData().width) {
    cropperInst.crop();
  }
  const canvas = cropperInst.getCroppedCanvas({
    maxWidth: 1400, maxHeight: 1400,
    fillColor: '#fff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });
  const b64 = canvas.toDataURL('image/jpeg', 0.90).split(',')[1];
  const cb = cropCallback;
  fermerCrop();
  if (cb) cb(b64);
});
function ouvrirCropDepuisSrc(src, callback) {
  cropCallback = callback;
  if (cropperInst) { cropperInst.destroy(); cropperInst = null; }
  const img = $('crop-img');
  img.crossOrigin = "anonymous";
  $('overlay-crop').classList.add('ouvert');
  img.onload = () => {
    if (typeof Cropper === "undefined") {
      fermerCrop();
      toast("Outil de recadrage non disponible", "err");
      if (cropCallback) cropCallback(null);
      return;
    }
    cropperInst = new Cropper(img, {
      viewMode: 1, dragMode: "move", autoCrop: false,
      restore: false, guides: false, center: false, highlight: false,
      cropBoxMovable: true, cropBoxResizable: true,
      toggleDragModeOnDblclick: false, responsive: true,
      movable: true, zoomable: true, zoomOnTouch: true, zoomOnWheel: false,
    });
    $('crop-etape1').style.display = '';
    $('crop-etape2').style.display = 'none';
    $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
  };
  img.src = src;
}

$('btn-recadrer-photo').addEventListener('click', () => {
  const src = $('photo-prev').src;
  if (!src) return;
  ouvrirCropDepuisSrc(src, b64 => {
    if (!b64) return;
    photoB64 = b64;
    $('photo-prev').src = 'data:image/jpeg;base64,' + photoB64;
    $('photo-prev').style.display = 'block'; $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
  });
});

$('btn-close-crop').addEventListener('click', fermerCrop);
$('btn-crop-annuler').addEventListener('click', fermerCrop);
$('btn-rot-g').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(-90); });
$('btn-rot-d').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(90); });
$('btn-rot-180').addEventListener('click', () => { if (cropperInst) cropperInst.rotate(180); });

$('btn-crop-suivant').addEventListener('click', () => {
  if (!cropperInst) return;
  // Passer à l'étape 2 : activer le cadre de recadrage sur l'image entière
  cropperInst.crop();
  setTimeout(() => {
    const c = cropperInst.getCanvasData();
    cropperInst.setCropBoxData({ left: c.left, top: c.top, width: c.width, height: c.height });
  }, 100);
  $('crop-etape1').style.display = 'none';
  $('crop-etape2').style.display = '';
  $('crop-hdr-titre').textContent = 'Étape 2 — Recadrer';
});

$('btn-crop-retour').addEventListener('click', () => {
  if (!cropperInst) return;
  // Retour à l'étape 1 : masquer le cadre
  cropperInst.clear();
  $('crop-etape1').style.display = '';
  $('crop-etape2').style.display = 'none';
  $('crop-hdr-titre').textContent = 'Étape 1 — Orienter';
});

$('inp-photo').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  ouvrirCrop(f, b64 => {
    photoB64 = b64;
    $('photo-prev').src = 'data:image/jpeg;base64,' + photoB64;
    $('photo-prev').style.display = 'block'; $('photo-ph').style.display = 'none';
    $('btn-recadrer-photo').classList.add('visible');
    afficherQualitePhoto(_origPhotoMaxDim, true);
  });
});

// ── Guide des tailles ──
function ouvrirGuide() {
  const tbody = $('guide-tbody');
  tbody.innerHTML = '';
  // Dimensions types par code (portrait/paysage)
  const dims = {
    'XXS': '40×30 cm',
    'XS':  '40×50 cm',
    'M':   '70×50, 75×55 cm',
    'XL':  '80×60, 80×45 cm',
    'XXL': '100×75, 115×75 cm',
    'E':   '100×40 cm (étirée)'
  };
  tailles.forEach(t => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:0.5px solid var(--brd);';
    tr.innerHTML = '<td style="padding:.45rem .5rem;font-weight:600;color:var(--gold);">'+t.code+'</td>' +
      '<td style="padding:.45rem .5rem;">'+t.label+'</td>' +
      '<td style="padding:.45rem .5rem;color:var(--muted);font-size:11px;">'+(dims[t.code]||'—')+'</td>';
    tbody.appendChild(tr);
  });
  $('overlay-guide').classList.add('ouvert');
  $('overlay-guide').style.display = 'flex';
}
$('btn-guide-tailles').addEventListener('click', ouvrirGuide);
$('btn-close-guide').addEventListener('click', () => {
  $('overlay-guide').classList.remove('ouvert');
  $('overlay-guide').style.display = 'none';
});
$('overlay-guide').addEventListener('click', e => {
  if (e.target === $('overlay-guide')) { $('overlay-guide').style.display = 'none'; }
});

// ── Dimensions favoris + taille automatique ────────────────────

function construireFavoris() {
  var cont = $('dims-favoris');
  if (!cont) return;
  cont.innerHTML = '';
  var seen = new Set(), favoris = [];
  toiles.forEach(function(t) {
    var d = t.dimensions;
    if (!d || !d.largeur || !d.hauteur || d.type === 'ronde') return;
    var key = d.largeur + 'x' + d.hauteur;
    if (!seen.has(key)) { seen.add(key); favoris.push({ l: d.largeur, h: d.hauteur, taille: t.taille || '' }); }
  });
  // Portraits (h>l) en premier, paysages/carrés ensuite — surface croissante dans chaque groupe
  favoris.sort(function(a, b) {
    var aPort = a.h > a.l ? 0 : 1;
    var bPort = b.h > b.l ? 0 : 1;
    if (aPort !== bPort) return aPort - bPort;
    return (a.l * a.h) - (b.l * b.h);
  });
  if (!favoris.length) { cont.style.display = 'none'; return; }
  cont.style.display = 'flex';
  favoris.forEach(function(f) {
    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'dim-chip';
    chip.textContent = f.l + '\u00d7' + f.h;
    chip.dataset.l = f.l; chip.dataset.h = f.h; chip.dataset.taille = f.taille;
    chip.addEventListener('click', function() {
      $('inp-larg').value = f.l; $('inp-haut').value = f.h;
      $('sel-format').value = '';
      synchroChips(f.l, f.h);
      afficherTailleAuto(f.taille || autoComputeTaille(f.l, f.h));
    });
    cont.appendChild(chip);
  });
}

function synchroChips(l, h) {
  document.querySelectorAll('#dims-favoris .dim-chip').forEach(function(c) {
    c.classList.toggle('sel', parseInt(c.dataset.l) === l && parseInt(c.dataset.h) === h);
  });
}

function autoComputeTaille(l, h) {
  if (!l || !h) return '';
  for (var i = 0; i < toiles.length; i++) {
    var t = toiles[i];
    if (t.taille && t.dimensions && t.dimensions.largeur === l && t.dimensions.hauteur === h) return t.taille;
  }
  var surface = l * h, best = null, bestDelta = Infinity;
  toiles.forEach(function(t) {
    if (!t.taille || !t.dimensions || !t.dimensions.largeur || !t.dimensions.hauteur) return;
    var delta = Math.abs(t.dimensions.largeur * t.dimensions.hauteur - surface);
    if (delta < bestDelta) { bestDelta = delta; best = t.taille; }
  });
  if (best) return best;
  var s = new Set([l, h]);
  var f = function(a, b) { return s.has(a) && s.has(b); };
  if (f(40,30)) return 'XXS';
  if (f(40,50)||f(50,40)) return 'XS';
  if (f(70,50)||f(75,55)||f(55,75)||f(60,50)) return 'M';
  if (f(80,60)||f(60,80)||f(80,45)) return 'XL';
  if (f(115,75)||f(100,75)) return 'XXL';
  if (f(100,40)) return 'E';
  return '';
}

function afficherTailleAuto(code) {
  var badge = $('taille-auto-badge');
  if (!badge) return;
  remplirSelectTaille();
  if (code) {
    var tObj = tailles.find(function(x) { return x.code === code; });
    badge.textContent = code + (tObj ? ' \u00b7 ' + tObj.label : '');
    badge.className = 'taille-auto-badge';
    if ($('sel-taille').querySelector('option[value="' + code + '"]')) {
      $('sel-taille').value = code;
    } else {
      $('sel-taille').value = '';
      $('taille-manual-wrap').style.display = '';
    }
  } else {
    badge.textContent = '\u2014';
    badge.className = 'taille-auto-badge vide';
    $('sel-taille').value = '';
  }
}

['inp-larg', 'inp-haut'].forEach(function(id) {
  var el = $(id); if (!el) return;
  el.addEventListener('input', function() {
    var l = parseInt($('inp-larg').value) || 0;
    var h = parseInt($('inp-haut').value) || 0;
    synchroChips(l, h);
    if (l && h) afficherTailleAuto(autoComputeTaille(l, h));
    $('sel-format').value = '';
  });
});

$('sel-format').addEventListener('change', function() {
  var fv = this.value;
  if (!fv) return;
  if (fv === 'ronde50') {
    $('inp-larg').value = ''; $('inp-haut').value = '';
    synchroChips(0, 0); afficherTailleAuto(''); return;
  }
  var parts = fv.split('x');
  if (parts.length === 2) {
    var l = parseInt(parts[0]), h = parseInt(parts[1]);
    $('inp-larg').value = l; $('inp-haut').value = h;
    synchroChips(l, h);
    afficherTailleAuto(autoComputeTaille(l, h));
  }
});

$('btn-toggle-chassis').addEventListener('click', function() {
  var open = $('dims-chassis').style.display !== 'none';
  $('dims-chassis').style.display = open ? 'none' : '';
  this.textContent = (open ? '\u25b8' : '\u25be') + ' Formats ch\u00e2ssis fran\u00e7ais';
});

$('btn-taille-modifier').addEventListener('click', function() {
  var wrap = $('taille-manual-wrap');
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : '';
  this.textContent = open ? 'Modifier \u25be' : 'R\u00e9duire \u25b4';
});

// Swipe bas pour fermer modal toile — déclenché uniquement depuis la poignée
let swY = null, swHandle = false;
$('overlay-toile').querySelector('.modal').addEventListener('touchstart', e => {
  swY = e.touches[0].clientY;
  swHandle = !!e.target.closest('.modal-handle');
}, { passive: true });
$('overlay-toile').querySelector('.modal').addEventListener('touchend', e => {
  if (swY && swHandle && e.changedTouches[0].clientY - swY > 60) fermerModalToile();
  swY = null; swHandle = false;
}, { passive: true });

// Modal salle
$('btn-close-salle').addEventListener('click', fermerModalSalle);
$('btn-annuler-salle').addEventListener('click', fermerModalSalle);
$('btn-creer-salle').addEventListener('click', creerSalle);
$('overlay-salle').addEventListener('click', e => { if (e.target === $('overlay-salle')) fermerModalSalle(); });

// Restore
$('btn-restore-ann1').addEventListener('click', () => $('overlay-restore').classList.remove('ouvert'));
$('btn-restore-ann2').addEventListener('click', () => $('overlay-restore').classList.remove('ouvert'));
$('btn-restore-suite').addEventListener('click', () => {
  document.querySelectorAll('.restore-step').forEach(s => s.classList.remove('active'));
  $('restore-s2').classList.add('active'); $('inp-restore').focus();
});
$('inp-restore').addEventListener('input', () => {
  $('btn-restore-ok').disabled = $('inp-restore').value !== 'RESTAURER';
});
$('btn-restore-ok').addEventListener('click', executerRestauration);
$('overlay-restore').addEventListener('click', e => { if (e.target === $('overlay-restore')) $('overlay-restore').classList.remove('ouvert'); });

// Init swatches couleurs
initSwatches();
initTailleForm();

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


// ═══════════════════════════════════════════════
// VUE INFOS & AGENDA
// ═══════════════════════════════════════════════
let infosData = { evenements: [], collegues: [] };
let infosModifiees = false;

/* Charge infos.json au passage sur l'onglet */
async function chargerInfos() {
  try {
    const infos = await lireRaw(ADMIN_CFG.repoPath + 'infos.json');
    infosData = infos || { evenements: [], collegues: [] };
    infosData.evenements    = infosData.evenements    || [];
    infosData.collegues     = infosData.collegues     || [];
    infosData.musique       = infosData.musique       || { fichier: '' };
    infosData.presentation  = infosData.presentation  || { titre: '', texte: '', photo: '' };
    _musiqueChargee = true;
    afficherEvents();
    afficherCollegues();
    remplirFormulairePresentation();
  } catch(e) {
    infosData = { evenements: [], collegues: [], musique: { fichier: '' }, presentation: { titre: '', texte: '', photo: '' } };
    afficherEvents();
  }
  /* Charger contact.json */
  try {
    const rc = await lireRaw(ADMIN_CFG.repoPath + 'contact.json');
    remplirFormulaireContact(rc || {});
  } catch(e) { /* pas de contact.json encore */ }
}

function remplirFormulaireContact(d) {
  var champs = ['email','tel','instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  var RESEAUX = ['instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  champs.forEach(function(c) {
    var el = document.getElementById('cnt-' + c);
    if (el) el.value = d[c === 'tel' ? 'telephone' : c] || '';
  });
  RESEAUX.forEach(function(r) {
    var el = document.getElementById('cnt-' + r + '-nom');
    if (el) el.value = d[r + '_nom'] || '';
  });
}

function lireFormulaireContact() {
  var RESEAUX = ['instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  var data = {
    email:     document.getElementById('cnt-email')?.value.trim() || '',
    telephone: document.getElementById('cnt-tel')?.value.trim()   || ''
  };
  RESEAUX.forEach(function(r) {
    data[r]          = document.getElementById('cnt-' + r)       ?.value.trim() || '';
    data[r + '_nom'] = document.getElementById('cnt-' + r + '-nom')?.value.trim() || '';
  });
  return data;
}

function afficherEvents() {
  const liste = document.getElementById('liste-events');
  if (!liste) return;
  if (!infosData.evenements.length) {
    liste.innerHTML = "<div class=\"event-vide\">Aucun événement pour l'instant</div>";
    return;
  }
  liste.innerHTML = infosData.evenements.map((ev, i) => `
    <div class="event-card">
      <div class="event-info">
        <div class="event-titre">${ev.titre || '—'}</div>
        <div class="event-meta">${[ev.dateAffichage, ev.lieu].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="event-actions">
        <button class="event-btn" onclick="ouvrirFormulaireEvent(${i})">✏️</button>
        <button class="event-btn del" onclick="supprimerEvent(${i})">✕</button>
      </div>
    </div>`
  ).join('');
}

function ouvrirFormulaireEvent(idx) {
  const ev = idx !== null ? infosData.evenements[idx] : null;
  document.getElementById('form-event-id').value  = idx !== null ? idx : '';
  document.getElementById('evt-titre').value       = ev ? (ev.titre        || '') : '';
  document.getElementById('evt-date').value        = ev ? (ev.dateAffichage|| '') : '';
  document.getElementById('evt-lieu').value        = ev ? (ev.lieu         || '') : '';
  document.getElementById('evt-desc').value        = ev ? (ev.description  || '') : '';
  document.getElementById('evt-lien').value        = ev ? (ev.lien         || '') : '';
  document.getElementById('form-event-err').textContent = '';
  document.getElementById('form-event-titre').textContent = ev ? 'Modifier l\'événement' : 'Nouvel événement';
  document.getElementById('form-event-wrap').style.display = '';
  document.getElementById('evt-titre').focus();
}

function fermerFormulaireEvent() {
  document.getElementById('form-event-wrap').style.display = 'none';
}

async function sauverFormulaireEvent() {
  const titre = document.getElementById('evt-titre').value.trim();
  if (!titre) { document.getElementById('form-event-err').textContent = 'Le titre est obligatoire.'; return; }
  const ev = {
    titre,
    dateAffichage: document.getElementById('evt-date').value.trim(),
    lieu:          document.getElementById('evt-lieu').value.trim(),
    description:   document.getElementById('evt-desc').value.trim(),
    lien:          document.getElementById('evt-lien').value.trim(),
  };
  const idxStr = document.getElementById('form-event-id').value;
  if (idxStr !== '') {
    infosData.evenements[parseInt(idxStr)] = ev;
  } else {
    ev.id = Date.now();
    infosData.evenements.push(ev);
  }
  infosModifiees = true;
  afficherEvents();
  fermerFormulaireEvent();
  /* Feedback visuel pendant la sauvegarde automatique */
  const btnSauver = document.getElementById('btn-sauver-infos');
  const texteOriginal = btnSauver ? btnSauver.textContent : '';
  if (btnSauver) { btnSauver.textContent = '💾 Sauvegarde en cours…'; btnSauver.disabled = true; }
  await sauvegarderInfos();
  if (btnSauver) { btnSauver.textContent = '✓ Sauvegardé'; btnSauver.disabled = false; }
  setTimeout(() => { if (btnSauver) btnSauver.textContent = texteOriginal; }, 2500);
}

async function supprimerEvent(idx) {
  if (!confirm('Supprimer cet événement ?')) return;
  infosData.evenements.splice(idx, 1);
  infosModifiees = true;
  afficherEvents();
  /* Fermer le formulaire si ouvert */
  fermerFormulaireEvent();
  const btnSauverS = document.getElementById('btn-sauver-infos');
  const texteOriginalS = btnSauverS ? btnSauverS.textContent : '';
  if (btnSauverS) { btnSauverS.textContent = '💾 Sauvegarde en cours…'; btnSauverS.disabled = true; }
  await sauvegarderInfos();
  if (btnSauverS) { btnSauverS.textContent = '✓ Sauvegardé'; btnSauverS.disabled = false; }
  setTimeout(() => { if (btnSauverS) btnSauverS.textContent = texteOriginalS; }, 2500);
}

function remplirFormulairePresentation() {
  const p = infosData.presentation || {};
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setV('pres-titre', p.titre);
  setV('pres-texte', p.texte);
  setV('pres-photo', p.photo);
}

function lireFormulairePresentation() {
  const getV = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  return { titre: getV('pres-titre'), texte: getV('pres-texte'), photo: getV('pres-photo') };
}

async function sauvegarderInfos() {
  const badge = document.getElementById('badge-infos');
  const btnInf = document.getElementById('btn-sauver-infos');
  if (!token) { alert('Token GitHub requis pour sauvegarder.'); return; }
  if (btnInf) btnInf.disabled = true;
  badge.textContent = '…';
  badge.className = 'sync-badge';
  // Lire la présentation depuis le formulaire avant de sauvegarder
  infosData.presentation = lireFormulairePresentation();
  try {
    const contactData = lireFormulaireContact();
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath + 'infos.json',   contenu: JSON.stringify(infosData, null, 2) },
      { chemin: ADMIN_CFG.repoPath + 'contact.json', contenu: JSON.stringify(contactData, null, 2) }
    ], 'Mise à jour infos + contact');
    badge.textContent = '✓';
    badge.className = 'sync-badge ok';
    infosModifiees = false;
    setTimeout(() => badge.classList.add('hidden'), 3000);
  } catch(e) {
    badge.textContent = '✗';
    badge.className = 'sync-badge err';
    rapporterErreur('Sauvegarde infos/contact échouée : ' + e.message, 'bloquant', e.stack || '');
  } finally {
    if (btnInf) btnInf.disabled = false;
  }
}

/* Wirer les boutons */
document.getElementById('btn-ajouter-event').addEventListener('click', () => ouvrirFormulaireEvent(null));
document.getElementById('btn-sauver-event').addEventListener('click', sauverFormulaireEvent);
document.getElementById('btn-annuler-event').addEventListener('click', fermerFormulaireEvent);

// ═══════════════════════════════════════════════
// LIENS ARTISTIQUES (collegues)
// ═══════════════════════════════════════════════
let collegueEnEdition = null;

function afficherCollegues() {
  const liste = document.getElementById('liste-collegues');
  if (!liste) return;
  const cols = infosData.collegues || [];
  if (!cols.length) {
    liste.innerHTML = '<p style="font-size:.8rem;color:var(--muted);padding:.4rem .8rem;">Aucun lien pour l\'instant.</p>';
    return;
  }
  liste.innerHTML = cols.map((c, i) => `
    <div class="event-item">
      <div class="event-info">
        <span class="event-titre">${c.nom || '—'}</span>
        <span class="event-date">${c.type || ''} ${c.lien ? '· <a href="' + c.lien + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">' + (c.lien.replace(/^https?:\/\//, '').split('/')[0]) + '</a>' : ''}</span>
      </div>
      <div style="display:flex;gap:.3rem;">
        <button class="event-btn" onclick="ouvrirFormulaireCollegue(${i})">✏</button>
        <button class="event-btn" onclick="supprimerCollegue(${i})" style="color:var(--danger);">✕</button>
      </div>
    </div>`).join('');
}

function ouvrirFormulaireCollegue(idx) {
  collegueEnEdition = idx === undefined ? null : idx;
  const c = idx !== undefined ? (infosData.collegues || [])[idx] : null;
  document.getElementById('form-collegue-titre').textContent = c ? 'Modifier le lien' : 'Nouveau lien';
  document.getElementById('form-collegue-id').value  = c ? idx : '';
  document.getElementById('col-nom').value    = c?.nom    || '';
  document.getElementById('col-desc').value   = c?.description || '';
  document.getElementById('col-lien').value   = c?.lien   || '';
  document.getElementById('col-type').value   = c?.type   || 'site';
  document.getElementById('form-collegue-err').textContent = '';
  document.getElementById('form-collegue-wrap').style.display = '';
  document.getElementById('col-nom').focus();
}

function fermerFormulaireCollegue() {
  document.getElementById('form-collegue-wrap').style.display = 'none';
  collegueEnEdition = null;
}

async function sauverCollegue() {
  const nom  = document.getElementById('col-nom').value.trim();
  const lien = document.getElementById('col-lien').value.trim();
  if (!nom) { document.getElementById('form-collegue-err').textContent = 'Le nom est requis.'; return; }
  const obj = {
    id:          collegueEnEdition !== null ? (infosData.collegues[collegueEnEdition]?.id || Date.now()) : Date.now(),
    nom,
    description: document.getElementById('col-desc').value.trim(),
    lien,
    type:        document.getElementById('col-type').value,
  };
  if (!infosData.collegues) infosData.collegues = [];
  if (collegueEnEdition !== null) infosData.collegues[collegueEnEdition] = obj;
  else infosData.collegues.push(obj);
  fermerFormulaireCollegue();
  infosModifiees = true;
  afficherCollegues();
}

async function supprimerCollegue(idx) {
  if (!confirm('Supprimer ce lien ?')) return;
  infosData.collegues.splice(idx, 1);
  infosModifiees = true;
  afficherCollegues();
}

document.getElementById('btn-ajouter-collegue').addEventListener('click', () => ouvrirFormulaireCollegue());
document.getElementById('btn-sauver-collegue').addEventListener('click', sauverCollegue);
document.getElementById('btn-annuler-collegue').addEventListener('click', fermerFormulaireCollegue);
document.getElementById('btn-sauver-infos').addEventListener('click', sauvegarderInfos);


// ═══════════════════════════════════════════════
// VUE ARTISTES INVITÉS (Fred uniquement)
// ═══════════════════════════════════════════════

/* Afficher l'onglet uniquement pour Frédérique */
(function () {
  if (ADMIN_CFG.prefix === "ff") {
    const btn = document.getElementById("onglet-artistes");
    if (btn) btn.style.display = "";
  }
})();

let artistesData = [];

/* Chargement au clic sur l'onglet */
async function chargerVueArtistes() {
  try {
    const res = await lireRaw("data/artistes.json");
    artistesData = res || [];
    afficherArtistes();
  } catch (e) {
    artistesData = [];
    afficherArtistes();
  }
}

function afficherArtistes() {
  const liste = document.getElementById("liste-artistes");
  if (!liste) return;
  if (!artistesData.length) {
    liste.innerHTML = "<div class=\"event-vide\">Aucun artiste invité pour l'instant</div>";
    return;
  }
  liste.innerHTML = artistesData.map((a, i) => {
    const badge = a.draft
      ? "<span class=\"artiste-badge draft\">Draft</span>"
      : "<span class=\"artiste-badge live\">En ligne</span>";
    const btnPublier = a.draft
      ? "<button class=\"event-btn\" onclick=\"toggleDraftArtiste(" + i + ")\">Publier</button>"
      : "<button class=\"event-btn\" onclick=\"toggleDraftArtiste(" + i + ")\">Masquer</button>";
    const base = location.href.replace(/admin\.html.*$/, "");
    const urlSite  = base + "artistes/" + a.id + "/";
    const urlAdmin = base + "admin.html?artiste=" + a.id;
    const btnCopier = function(url, id) {
      return "<button class=\"event-btn\" title=\"Copier\" " +
        "onclick=\"navigator.clipboard.writeText('" + url + "').then(function(){" +
          "var b=document.getElementById('cp-" + id + "');b.textContent='✓';setTimeout(function(){b.textContent='⎘';},1500);" +
        "})\" " +
        "id=\"cp-" + id + "\">⎘</button>";
    };
    return "<div class=\"artiste-card\">" +
      "<div class=\"artiste-logo-mini\">" + (a.logo || "?") + "</div>" +
      "<div class=\"artiste-infos\">" +
        "<div class=\"artiste-nom\">" + a.nom + " " + badge + "</div>" +
        "<div class=\"artiste-meta\">" +
          "<span class=\"artiste-url-lbl\">Site</span>" +
          "<span class=\"artiste-url\">" + urlSite + "</span>" +
          btnCopier(urlSite, "s" + i) +
        "</div>" +
        "<div class=\"artiste-meta\">" +
          "<span class=\"artiste-url-lbl\">Admin</span>" +
          "<span class=\"artiste-url\">" + urlAdmin + "</span>" +
          btnCopier(urlAdmin, "a" + i) +
        "</div>" +
      "</div>" +
      "<div class=\"artiste-actions\">" +
        btnPublier +
        "<button class=\"event-btn\" title=\"Modifier\" onclick=\"ouvrirModifierArtiste(" + i + ")\">✏️</button>" +
        "<button class=\"event-btn del\" title=\"Supprimer\" onclick=\"supprimerArtiste(" + i + ")\">✕</button>" +
        "<button class=\"event-btn\" title=\"Vers l'accueil\" onclick=\"ouvrirGalerieArtiste('" + a.id + "')\">↗</button>" +
      "</div>" +
    "</div>";
  }).join("");
}

function ouvrirGalerieArtiste(id) {
  window.open("artistes/" + id + "/", "_blank");
}

async function supprimerArtiste(idx) {
  const a = artistesData[idx];
  /* Modale de confirmation */
  document.getElementById("suppr-artiste-msg").textContent = "Supprimer " + a.nom + " ?";
  const overlay = document.getElementById("overlay-suppr-artiste");
  overlay.style.display = "flex";
  await new Promise(resolve => {
    document.getElementById("btn-suppr-confirmer").onclick = () => { overlay.style.display = "none"; resolve(true); };
    document.getElementById("btn-suppr-annuler").onclick   = () => { overlay.style.display = "none"; resolve(false); };
  }).then(ok => { if (!ok) throw new Error("annulé"); });
  artistesData.splice(idx, 1);
  try {
    /* Fichiers à supprimer */
    const base = "artistes/" + a.id + "/";
    /* Uniquement les fichiers garantis créés par genererFichiers() */
    const fichiersSup = [
      base + "index.html", base + "galerie.html",
      base + "infos.html", base + "contact.html", base + "admin.html",
      base + "data/toiles.json", base + "data/salles.json",
      base + "data/infos.json", base + "data/contact.json"
    ].map(path => ({ path, sha: null })); /* sha:null sans mode/type = suppression propre */

    /* Commit unique : suppression fichiers + MAJ artistes.json */
    const ref        = await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`);
    const commitSha  = ref.object.sha;
    const baseCommit = await apiGH(`/repos/${REPO}/git/commits/${commitSha}`);

    /* Ajouter artistes.json mis à jour au même tree */
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(artistesData, null, 2))));
    const blob = await apiGH(`/repos/${REPO}/git/blobs`, "POST", { content: b64, encoding: "base64" });
    const tree = await apiGH(`/repos/${REPO}/git/trees`, "POST", {
      base_tree: baseCommit.tree.sha,
      tree: [...fichiersSup, { path: "data/artistes.json", mode: "100644", type: "blob", sha: blob.sha }]
    });
    const commit = await apiGH(`/repos/${REPO}/git/commits`, "POST", {
      message: "Suppression artiste : " + a.nom,
      tree: tree.sha, parents: [commitSha]
    });
    try {
      await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, "PATCH", { sha: commit.sha, force: false });
    } catch(e) {
      if (e.message && (e.message.includes("fast forward") || e.message.includes("Update is not"))) {
        await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, "PATCH", { sha: commit.sha, force: true });
      } else throw e;
    }

    afficherArtistes();
    if (artisteEditIdx !== null && (artisteEditIdx === idx || artisteEditIdx >= artistesData.length)) {
      artisteEditIdx = null;
      document.getElementById("form-artiste-wrap").style.display = "none";
    }
  } catch(e) {
    if (e.message !== "annulé") {
      artistesData.splice(idx, 0, a); // rollback
      rapporterErreur("Suppression artiste échouée : " + e.message, "bloquant", e.stack || "");
      alert("Erreur : " + e.message);
    }
  }
}

async function toggleDraftArtiste(idx) {
  const artiste = artistesData[idx];
  artiste.draft = !artiste.draft;
  const publier = !artiste.draft; // true = on publie (retire noindex)
  const base = artiste.lien;     // ex: "artistes/daw/"
  const NOINDEX = '  <meta name="robots" content="noindex, nofollow">\n';
  const CHARSET = '  <meta charset="UTF-8">\n';
  const modifs = [];
  for (const page of ['index.html', 'galerie.html', 'infos.html', 'contact.html']) {
    const chemin = base + page;
    try {
      const r = await apiGH('/repos/' + REPO + '/contents/' + chemin);
      let c = decodeURIComponent(escape(atob(r.content.replace(/\s/g, ''))));
      if (publier) {
        c = c.replace(NOINDEX, '');
      } else if (!c.includes('noindex')) {
        c = c.replace(CHARSET, CHARSET + NOINDEX);
      }
      modifs.push({ chemin, contenu: c });
    } catch(e) { /* page absente, on ignore */ }
  }
  const prefMsg = publier ? 'Publication artiste : ' : 'Masquage artiste : ';
  await commitMulti([
    ...modifs,
    { chemin: 'data/artistes.json', contenu: JSON.stringify(artistesData, null, 2) }
  ], prefMsg + artiste.nom);
  afficherArtistes();
}

/* ── Formulaire nouvel artiste ── */
function slugify(nom) {
  return nom.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 12);
}
function initiales(nom) {
  return nom.split(/\s+/).map(w => w[0] || "").join("").slice(0, 4).toUpperCase();
}

let artisteEditIdx = null; /* null = création, nombre = modification */

document.getElementById("btn-ajouter-artiste").addEventListener("click", () => {
  artisteEditIdx = null;
  document.getElementById("form-artiste-titre").textContent = "Nouvel artiste invité";
  document.getElementById("btn-sauver-artiste").textContent = "✦ Créer l'espace";
  document.getElementById("art-nom").value   = "";
  document.getElementById("art-id").value    = "";
  document.getElementById("art-logo").value  = "";
  document.getElementById("art-genre").value = "f";
  document.getElementById("art-draft").checked = true;
  document.getElementById("art-id").removeAttribute("readonly");
  document.getElementById("art-id").style.opacity = "";
  document.getElementById("form-artiste-err").textContent = "";
  document.getElementById("artiste-progress").style.display = "none";
  document.getElementById("form-artiste-wrap").style.display = "";
  document.getElementById("art-nom").focus();
});

function ouvrirModifierArtiste(idx) {
  const a = artistesData[idx];
  artisteEditIdx = idx;
  document.getElementById("form-artiste-titre").textContent = "Modifier — " + a.nom;
  document.getElementById("btn-sauver-artiste").textContent = "💾 Enregistrer";
  document.getElementById("art-nom").value   = a.nom   || "";
  document.getElementById("art-id").value    = a.id    || "";
  document.getElementById("art-logo").value  = a.logo  || "";
  document.getElementById("art-genre").value = a.genre || "f";
  document.getElementById("art-draft").checked = !!a.draft;
  /* id non modifiable en édition */
  document.getElementById("art-id").setAttribute("readonly", true);
  document.getElementById("art-id").style.opacity = "0.5";
  document.getElementById("form-artiste-err").textContent = "";
  document.getElementById("artiste-progress").style.display = "none";
  document.getElementById("form-artiste-wrap").style.display = "";
  document.getElementById("art-nom").focus();
}

document.getElementById("art-nom").addEventListener("input", function () {
  const v = this.value.trim();
  if (!document.getElementById("art-id").dataset.modifie)
    document.getElementById("art-id").value = slugify(v);
  if (!document.getElementById("art-logo").dataset.modifie)
    document.getElementById("art-logo").value = initiales(v);
});
document.getElementById("art-id").addEventListener("input",   function () { this.dataset.modifie = "1"; });
document.getElementById("art-logo").addEventListener("input",  function () { this.dataset.modifie = "1"; });

document.getElementById("btn-annuler-artiste").addEventListener("click", () => {
  document.getElementById("form-artiste-wrap").style.display = "none";
  delete document.getElementById("art-id").dataset.modifie;
  delete document.getElementById("art-logo").dataset.modifie;
});

document.getElementById("btn-sauver-artiste").addEventListener("click", creerArtiste);

/* ── Création complète ── */
async function creerArtiste() {
  const nom   = document.getElementById("art-nom").value.trim();
  const id    = document.getElementById("art-id").value.trim().toLowerCase();
  const logo  = document.getElementById("art-logo").value.trim().toUpperCase() || id.slice(0,4).toUpperCase();
  const genre = document.getElementById("art-genre").value;
  const draft = document.getElementById("art-draft").checked;
  const err   = document.getElementById("form-artiste-err");
  const prog  = document.getElementById("artiste-progress");

  if (!nom) { err.textContent = "Le nom est obligatoire."; return; }

  /* ── Mode modification ── */
  if (artisteEditIdx !== null) {
    const a = artistesData[artisteEditIdx];
    const ancienNom  = a.nom;
    const ancienLogo = a.logo;
    a.nom   = nom;
    a.logo  = logo;
    a.genre = genre;
    a.draft = draft;
    err.textContent = "";
    prog.style.display = "";
    prog.textContent = "Sauvegarde…";
    document.getElementById("btn-sauver-artiste").disabled = true;
    try {
      /* artiste-info.js rend les pages dynamiques → seul artistes.json à mettre à jour */
      await commitMulti(
        [{ chemin: "data/artistes.json", contenu: JSON.stringify(artistesData, null, 2) }],
        "Modification artiste : " + nom
      );
      prog.textContent = "✓ Enregistré";
      document.getElementById("form-artiste-wrap").style.display = "none";
      afficherArtistes();
    } catch (e) { err.textContent = "Erreur : " + e.message; prog.style.display = "none"; rapporterErreur("Modification artiste échouée : " + e.message, "bloquant", e.stack || ""); }
    document.getElementById("btn-sauver-artiste").disabled = false;
    return;
  }

  /* ── Mode création ── */
  if (!id || !/^[a-z0-9]+$/.test(id)) { err.textContent = "L'identifiant ne peut contenir que des lettres et chiffres."; return; }
  if (artistesData.find(a => a.id === id)) { err.textContent = "Cet identifiant existe déjà."; return; }

  err.textContent = "";
  prog.style.display = "";
  prog.textContent = "Génération des fichiers…";
  document.getElementById("btn-sauver-artiste").disabled = true;

  const artiste = { id, nom, logo, genre,
    lien: "artistes/" + id + "/",
    repoPath: "artistes/" + id + "/data/",
    prefix: id, draft };

  try {
    const fichiers = genererFichiers(artiste);
    /* Inclure artistes.json dans le même commit — évite le conflit "not a fast forward" */
    const { lien, repoPath, prefix } = artiste;
    const nouveauxArtistes = artistesData.concat([{ id, nom, logo, lien, repoPath, prefix, draft, genre }]);
    fichiers.push({ chemin: "data/artistes.json", contenu: JSON.stringify(nouveauxArtistes, null, 2) });
    prog.textContent = "Création sur GitHub (" + fichiers.length + " fichiers)…";
    await commitMulti(fichiers, "Nouvel artiste invité : " + nom);
    artistesData = nouveauxArtistes;
    prog.textContent = "✓ Espace créé !";
    document.getElementById("form-artiste-wrap").style.display = "none";
    afficherArtistes();
  } catch (e) {
    err.textContent = "Erreur : " + e.message;
    prog.style.display = "none";
    rapporterErreur("Création artiste échouée : " + e.message, "bloquant", e.stack || "");
  }
  document.getElementById("btn-sauver-artiste").disabled = false;
}

async function sauvegarderArtistesJSON(message) {
  await commitMulti([
    { chemin: "data/artistes.json", contenu: JSON.stringify(artistesData, null, 2) }
  ], message);
}

/* ── Générateur de fichiers ── */
function genererFichiers(a) {
  const invite = a.genre === "m" ? "Invité" : a.genre === "n" ? "Invité·e" : "Invitée";
  const emailU = a.email ? a.email.split("@")[0] : "";
  const emailD = a.email ? a.email.split("@")[1] : "";
  const base   = "artistes/" + a.id + "/";

  function r(tpl) {
    return tpl
      .replace(/{{NOM}}/g,     a.nom)
      .replace(/{{LOGO}}/g,    a.logo)
      .replace(/{{ID}}/g,      a.id)
      .replace(/{{INVITE}}/g,  invite)
      .replace(/{{EMAIL_U}}/g, emailU)
      .replace(/{{EMAIL_D}}/g, emailD);
  }

  const toiles = JSON.stringify({
    tailles: [{code:"XXS",label:"Très petite"},{code:"XS",label:"Petite"},
              {code:"M",label:"Moyenne"},{code:"XL",label:"Grande"},
              {code:"XXL",label:"Très grande"},{code:"E",label:"Étirée"}],
    toiles: []
  }, null, 2);

  const salles = JSON.stringify({
    salles: [{id:1,nom:"Salle I",theme:"",couleur_mur:"#1e1e1e",
      couleur_cadres:"#3a3a3a",texture:"none",visible:true,toiles:[],positions:[]}]
  }, null, 2);

  const infos = JSON.stringify({ evenements: [], collegues: [] }, null, 2);

  const contact = JSON.stringify({
    email:"", telephone:"", instagram:"", facebook:"", tiktok:"",
    pinterest:"", youtube:"", twitter:"", linkedin:"", site:""
  }, null, 2);

  return [
    { chemin: base + "data/toiles.json",  contenu: toiles   },
    { chemin: base + "data/salles.json",  contenu: salles   },
    { chemin: base + "data/infos.json",   contenu: infos    },
    { chemin: base + "data/contact.json", contenu: contact  },
    { chemin: base + "index.html",       contenu: r(TPL_INDEX)   },
    { chemin: base + "galerie.html",     contenu: r(TPL_GALERIE) },
    { chemin: base + "infos.html",       contenu: r(TPL_INFOS)   },
    { chemin: base + "contact.html",     contenu: r(TPL_CONTACT) },
    { chemin: base + "admin.html",       contenu: r(TPL_ADMIN)   },
  ];
}

/* ── Templates HTML ── */
const TPL_INDEX = `<!DOCTYPE html>
<html lang="fr">
<head>
  <link rel="icon" type="image/svg+xml" href="../../assets/images/favicon-invite.svg">
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{{NOM}} — Peintures</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400&family=Pinyon+Script&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="../../assets/css/plan.css">
  <link rel="stylesheet" href="../../assets/css/invite.css">
</head>
<body class="theme-sombre">
  <div class="bandeau-invite">
    {{INVITE}} de <a href="../../index.html">Frédérique Ferette</a>
  </div>
  <div class="scene-entree">
    <header class="entete">
      <nav class="nav-pages">
        <a href="index.html" class="lien-contact actif">Accueil</a>
        <span class="nav-sep">|</span>
        <a href="infos.html" class="lien-contact">Infos</a>
        <span class="nav-sep">|</span>
        <a href="contact.html" class="lien-contact">Contact</a>
      </nav>
    </header>
    <main class="contenu-principal">
      <div class="encadre-titre">
        <h1 class="nom-artiste">{{NOM}}</h1>
        <p class="sous-titre">Peintures</p>
        <div class="separateur"></div>
        <p class="titre-galerie">Galerie</p>
        <div class="plan-galerie" id="plan-galerie">
          <div id="plan-svg-wrap" style="width:100%;"></div>
          <p class="plan-legende">Cliquez sur une salle pour y entrer</p>
        </div>
      </div>
    </main>
    <footer class="pied">
      <div class="signature-artiste">{{LOGO}}</div>
      <span class="mention">&copy; {{NOM}}</span>
    </footer>
  </div>
  <script>
    window.PLAN_SALLES_PATH  = "data/salles.json";
    window.PLAN_GALERIE_PATH = "galerie.html";
  </script>
  <script src="../../assets/js/main.js"></script>
  <script src="../../assets/js/plan.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
</body>
</html>`;

const TPL_GALERIE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Galerie — {{NOM}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400&family=Cinzel:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="../../assets/css/galerie.css">
  <link rel="stylesheet" href="../../assets/css/invite.css">
  <link rel="icon" type="image/svg+xml" href="../../assets/images/favicon-invite.svg">
</head>
<body class="theme-sombre" data-page="galerie" style="background-color:#111111;">
  <div class="bandeau-invite">
    {{INVITE}} de <a href="../../index.html">Frédérique Ferette</a>
  </div>
  <header class="entete" style="margin-top:1.6rem;">
    <nav class="nav-pages">
      <a href="index.html" class="lien-contact">Accueil</a>
      <span class="nav-sep">|</span>
      <a href="infos.html" class="lien-contact">Infos</a>
      <span class="nav-sep">|</span>
      <a href="contact.html" class="lien-contact">Contact</a>
    </nav>
    <div class="controles">
      <button class="btn-musique off" id="btnMusique" aria-label="Musique on/off">
        <span id="iconeMusique">&#9835;</span>
      </button>
    </div>
  </header>
  <main class="galerie-principale">
    <nav class="barre-navigation" aria-label="Navigation entre les salles">
      <button class="btn-nav-salle" id="btnPrecedent" aria-label="Salle précédente" disabled>&#8249;</button>
      <span class="indicateur-salle">Salle <span id="numSalle">1</span>&thinsp;/&thinsp;1</span>
      <button class="btn-nav-salle" id="btnSuivant" aria-label="Salle suivante">&#8250;</button>
    </nav>
    <div class="dots" id="dotsNav" aria-hidden="true"><div class="dot actif"></div></div>
    <div class="conteneur-salles" id="conteneurSalles"></div>
    <div class="nav-mobile" id="navMobile">
      <button class="nav-mobile-btn" id="navMobG" onclick="allerSalle(salleCourante-1)">&#8249;</button>
      <span class="nav-mobile-info" id="navMobInfo"></span>
      <button class="nav-mobile-btn" id="navMobD" onclick="allerSalle(salleCourante+1)">&#8250;</button>
    </div>
  </main>
  <div class="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitre">
    <div class="modal-contenu">
      <button class="modal-fermer" id="modalFermer" aria-label="Fermer">
        <svg viewBox="0 0 14 14" width="13" height="13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none">
          <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
        </svg>
      </button>
      <div class="modal-image-wrap" id="modalImageWrap"></div>
      <div class="modal-fiche">
        <h2 class="modal-titre" id="modalTitre"></h2>
        <div class="modal-separateur"></div>
        <div class="modal-ligne"><span class="modal-label">Date</span><span class="modal-valeur" id="modalDate"></span></div>
        <div class="modal-ligne"><span class="modal-label">Style</span><span class="modal-valeur" id="modalStyle"></span></div>
        <div class="modal-ligne"><span class="modal-label">Matériaux</span><span class="modal-valeur" id="modalMateriaux"></span></div>
        <div class="modal-ligne"><span class="modal-label">Dimensions</span><span class="modal-valeur" id="modalDimensions"></span></div>
        <div class="modal-ligne" id="modalDescLigne"><span class="modal-label">Description</span><span class="modal-valeur" id="modalDesc"></span></div>
      </div>
    </div>
  </div>
  <footer class="pied"><span class="mention">&copy; {{NOM}}</span></footer>
  <script>
    window.GALERIE_TOILES_PATH  = "data/toiles.json";
    window.GALERIE_SALLES_PATH  = "data/salles.json";
    window.GALERIE_ASSETS_BASE  = "../../";
    window.GALERIE_ASSETS_BASE  = "../../";
    window.PLAN_TOILES_PATH     = "data/toiles.json";
    window.GALERIE_HOME         = "index.html";
    window.GALERIE_INFOS_PATH   = "infos.html";
    window.GALERIE_CONTACT_PATH = "contact.html";
  </script>
  <script src="../../assets/js/main.js"></script>
  <script src="../../assets/js/galerie.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
</body>
</html>`;

const TPL_INFOS = `<!DOCTYPE html>
<html lang="fr">
<head>
  <link rel="icon" type="image/svg+xml" href="../../assets/images/favicon-invite.svg">
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{{NOM}} — Infos &amp; Agenda</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400&family=Cinzel:wght@400;500&family=Pinyon+Script&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="../../assets/css/infos.css">
  <link rel="stylesheet" href="../../assets/css/invite.css">
</head>
<body class="theme-sombre">
  <div class="bandeau-invite">
    {{INVITE}} de <a href="../../index.html">Frédérique Ferette</a>
  </div>
  <div class="scene-entree">
    <header class="entete">
      <nav class="nav-pages">
        <a href="index.html" class="lien-contact">Accueil</a>
        <span class="nav-sep">|</span>
        <a href="infos.html" class="lien-contact actif">Infos</a>
        <span class="nav-sep">|</span>
        <a href="contact.html" class="lien-contact">Contact</a>
      </nav>
    </header>
    <main class="contenu-principal">
      <div class="encadre-titre">
        <h1 class="contact-titre" style="font-family:'Cinzel',serif;font-weight:400;font-size:1.6rem;letter-spacing:.38em;text-transform:uppercase;background:linear-gradient(135deg,#c8a050 0%,#f0d080 40%,#c8a050 60%,#e8c060 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 1.2rem;">Infos &amp; Agenda</h1>
        <div class="separateur"></div>
        <div class="infos-wrap" id="infosWrap"><p class="vide">Chargement…</p></div>
      </div>
    </main>
    <footer class="pied">
      <div class="signature-artiste">{{LOGO}}</div>
      <span class="mention">&copy; {{NOM}}</span>
    </footer>
  </div>
  <script>window.INFOS_DATA_PATH = "data/infos.json";</script>
  <script src="../../assets/js/main.js"></script>
  <script src="../../assets/js/infos.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
</body>
</html>`;

const TPL_CONTACT = `<!DOCTYPE html>
<html lang="fr">
<head>
  <link rel="icon" type="image/svg+xml" href="../../assets/images/favicon-invite.svg">
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{{NOM}} — Contact</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Lato:wght@300;400&family=Cinzel:wght@400;500&family=Pinyon+Script&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="../../assets/css/contact.css">
  <link rel="stylesheet" href="../../assets/css/invite.css">
</head>
<body class="theme-sombre">
  <div class="bandeau-invite">
    {{INVITE}} de <a href="../../index.html">Frédérique Ferette</a>
  </div>
  <div class="scene-entree">
    <header class="entete">
      <nav class="nav-pages">
        <a href="index.html" class="lien-contact">Accueil</a>
        <span class="nav-sep">|</span>
        <a href="infos.html" class="lien-contact">Infos</a>
        <span class="nav-sep">|</span>
        <a href="contact.html" class="lien-contact actif">Contact</a>
      </nav>
    </header>
    <main class="contenu-principal">
      <div class="encadre-titre">
        <h1 class="contact-titre">Contact</h1>
        <p class="contact-accroche">Pour tout renseignement</p>
        <div class="separateur"></div>
        <div class="contact-bloc"><p style="color:var(--text-doux);font-style:italic;font-size:.85rem;">Chargement…</p></div>
      </div>
    </main>
    <footer class="pied">
      <div class="signature-artiste">{{LOGO}}</div>
      <span class="mention">&copy; {{NOM}}</span>
    </footer>
  </div>
  <script>window.CONTACT_DATA_PATH = "data/contact.json";</script>
  <script src="../../assets/js/main.js"></script>
  <script src="../../assets/js/contact.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
  <script src="../../assets/js/artiste-info.js"></script>
</body>
</html>`;

const TPL_ADMIN = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=../../admin.html?artiste={{ID}}">
  <script>window.location.replace("../../admin.html?artiste={{ID}}");<\/script>
</head>
<body></body>
</html>`;

/* ── Test du système de rapport d'erreurs ── */
async function testerRapports() {
  const res = document.getElementById('test-rapport-resultat');
  const btn = document.getElementById('btn-test-rapport');
  if (!token) { res.textContent = "⚠ Connectez-vous d'abord (token requis)."; return; }
  btn.disabled = true;
  res.textContent = 'Envoi de 4 issues test…';

  /* Vider le cache session pour ce test */
  const cleTest = 'Bug : [TEST] Rapport automatique — issue de test'.slice(0, 80);
  delete _rapportCache[cleTest];

  for (let i = 1; i <= 4; i++) {
    res.textContent = 'Envoi ' + i + '/4…';
    /* Vider le cache session avant chaque envoi pour que le vrai anti-spam (GitHub Search) s'applique */
    delete _rapportCache[cleTest];
    await rapporterErreur('[TEST] Rapport automatique — issue de test', 'bug', 'Envoi ' + i + '/4 — test du système anti-spam (3 max par 24h)');
    /* Délai entre chaque appel pour laisser GitHub Search se mettre à jour */
    await new Promise(r => setTimeout(r, 1500));
  }
  res.textContent = '✓ Terminé — vérifie tes emails et github.com/' + REPO + '/issues';
  btn.disabled = false;
}

document.getElementById('btn-test-rapport')?.addEventListener('click', testerRapports);


// ═══════════════════════════════════════════════
// TEXTURES GITHUB — upload + listing
// ═══════════════════════════════════════════════
let _texData = null; /* données compressées en attente de confirmation */

/* Compression canvas → JPEG ≤ 400 KB */
function compresserImageTexture(file) {
  return new Promise(function(resolve, reject) {
    if (file.size > 10 * 1024 * 1024) { reject('Fichier trop volumineux (max 10 Mo)'); return; }
    var MAX = 1200, TARGET = 400 * 1024 * (4/3); /* target base64 chars */
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function() {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      var q = 0.85, dataUrl = canvas.toDataURL('image/jpeg', q);
      while (dataUrl.length > TARGET && q > 0.3) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q); }
      resolve({
        dataUrl,
        b64: dataUrl.split(',')[1],
        nom: file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40),
        origKB: Math.round(file.size / 1024),
        finalKB: Math.round(dataUrl.length * 0.75 / 1024)
      });
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject('Image invalide'); };
    img.src = url;
  });
}

async function ouvrirOverlayTexture(file) {
  if (!file) return;
  try {
    _texData = await compresserImageTexture(file);
    $('tex-prev').style.backgroundImage = 'url("' + _texData.dataUrl + '")';
    $('tex-info').textContent = _texData.origKB + ' KB → ' + _texData.finalKB + ' KB après compression';
    $('tex-partager').checked = false;
    $('tex-progress').textContent = '';
    $('overlay-tex-upload').style.display = 'flex';
  } catch(e) { alert('Erreur : ' + e); }
}

async function uploaderTextureConfirmee() {
  if (!_texData) { $('tex-progress').textContent = '⚠ Aucune image — réessayez'; return; }
  if (!token)    { $('tex-progress').textContent = '⚠ Token GitHub requis'; return; }
  var partager = $('tex-partager').checked;
  var dossier  = partager ? 'assets/images/textures/' : ADMIN_CFG.repoPath + 'textures/';
  var chemin   = dossier + _texData.nom + '_' + Date.now().toString(36) + '.jpg';
  $('tex-progress').textContent = 'Upload en cours…';
  $('btn-tex-confirmer').disabled = true;
  try {
    await commitMulti([{ chemin, contenu: _texData.b64, encoding: 'base64' }], 'Texture : ' + _texData.nom);
    $('overlay-tex-upload').style.display = 'none';
    _texData = null;
    toast('✓ Texture uploadée');
    await chargerTexturesGitHub();
  } catch(e) { $('tex-progress').textContent = 'Erreur : ' + e.message; }
  $('btn-tex-confirmer').disabled = false;
}

async function chargerTexturesGitHub() {
  var dossiers = [
    { chemin: 'assets/images/textures',        wrap: $('tex-gh-partage-wrap'), cont: $('textures-gh-partage'),
      suppressible: ADMIN_CFG.prefix === 'ff'  /* Fred peut supprimer les partagées, pas les invités */ },
    { chemin: ADMIN_CFG.repoPath + 'textures', wrap: $('tex-gh-prive-wrap'),   cont: $('textures-gh-prive'),
      suppressible: true }
  ];
  for (var i = 0; i < dossiers.length; i++) {
    var d = dossiers[i];
    if (!d.cont) continue;
    try {
      var files = await apiGH('/repos/' + REPO + '/contents/' + d.chemin);
      var imgs  = files.filter(function(f){ return /\.(jpg|jpeg|png|webp)$/i.test(f.name); });
      if (!imgs.length) { if (d.wrap) d.wrap.style.display = 'none'; continue; }
      if (d.wrap) d.wrap.style.display = '';
      d.cont.innerHTML = '';
      imgs.forEach(function(f) {
        TEXTURES[f.path] = 'url("' + f.download_url + '")';
        d.cont.appendChild(creerSwatchGH(f.path, f.download_url, d.suppressible));
      });
    } catch(e) { if (d.wrap) d.wrap.style.display = 'none'; }
  }
}

function creerSwatchGH(chemin, url, suppressible) {
  var sw = document.createElement('div');
  sw.className = 'sw tex-gh' + (textureActuelle === chemin ? ' sel' : '');
  sw.style.cssText = 'background-image:url("' + url + '");background-size:cover;position:relative;overflow:visible;';
  sw.dataset.val = chemin;
  sw.title = chemin.split('/').pop().replace(/_[a-z0-9]+\.jpg$/i, '');
  sw.addEventListener('click', function() {
    document.querySelectorAll('.sw').forEach(function(s){ s.classList.remove('sel'); });
    sw.classList.add('sel');
    setTexture(chemin);
  });
  if (suppressible) {
    var del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'tex-del-btn';
    del.style.cssText = 'position:absolute;top:-5px;right:-5px;width:14px;height:14px;'
      + 'border-radius:50%;background:#c0392b;color:#fff;border:none;font-size:8px;'
      + 'cursor:pointer;line-height:14px;padding:0;z-index:2;display:none;';
    del.title = 'Supprimer';
    del.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!confirm('Supprimer cette texture ?')) return;
      await supprimerTextureGitHub(chemin);
    });
    sw.appendChild(del);
  }
  return sw;
}

async function supprimerTextureGitHub(chemin) {
  try {
    var file = await apiGH('/repos/' + REPO + '/contents/' + chemin);
    await apiGH('/repos/' + REPO + '/contents/' + chemin, 'DELETE', {
      message: 'Suppression texture : ' + chemin.split('/').pop(),
      sha: file.sha
    });
    if (textureActuelle === chemin) { setTexture('none'); }
    await chargerTexturesGitHub();
    toast('✓ Texture supprimée');
  } catch(e) { alert('Erreur : ' + e.message); }
}

/* ── Listener texture-custom : niveau module, garanti après chargement DOM ── */
(function() {
  var _inpTex = document.getElementById('inp-texture-custom');
  if (_inpTex) {
    _inpTex.addEventListener('change', function(e) {
      if (typeof ouvrirOverlayTexture === 'function') {
        ouvrirOverlayTexture(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  var _inpMusique = document.getElementById('inp-musique-upload');
  if (_inpMusique) {
    _inpMusique.addEventListener('change', function() {
      if (this.files[0]) uploaderMusique(this.files[0]);
      this.value = '';
    });
  }
  /* _texBound_module */
})();

/* Mode suppression textures */
let _texDelMode = false;
function toggleModeSupprTexture() {
  _texDelMode = !_texDelMode;
  document.querySelectorAll('.tex-del-btn').forEach(function(b) {
    b.style.display = _texDelMode ? '' : 'none';
  });
  var btn = document.getElementById('btn-tex-del-toggle');
  if (btn) btn.style.color = _texDelMode ? '#c0392b' : '';
}

/* ── Configuration EmailJS ── */
function chargerConfigEmailJS() {
  /* Charger depuis GitHub en priorité (disponible pour tous les admins)
     fallback : localStorage (valeurs saisies manuellement) */
  fetch('data/emailjs.json?v=' + Date.now())
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(cfg) {
      if (!cfg) cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
      if (!cfg) return;
      /* Mettre en cache local pour les prochains accès */
      localStorage.setItem('ff_emailjs', JSON.stringify(cfg));
      var s = document.getElementById('ejs-service');
      var t = document.getElementById('ejs-template');
      var p = document.getElementById('ejs-pubkey');
      if (s) s.value = cfg.serviceId  || '';
      if (t) t.value = cfg.templateId || '';
      if (p) p.value = cfg.publicKey  || '';
    })
    .catch(function() {
      /* fallback localStorage si fetch échoue */
      var cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
      if (!cfg) return;
      var s = document.getElementById('ejs-service');
      var t = document.getElementById('ejs-template');
      var p = document.getElementById('ejs-pubkey');
      if (s) s.value = cfg.serviceId  || '';
      if (t) t.value = cfg.templateId || '';
      if (p) p.value = cfg.publicKey  || '';
    });
}

function sauverEmailJS() {
  var cfg = {
    serviceId:  (document.getElementById('ejs-service')  || {}).value || '',
    templateId: (document.getElementById('ejs-template') || {}).value || '',
    publicKey:  (document.getElementById('ejs-pubkey')   || {}).value || ''
  };
  localStorage.setItem('ff_emailjs', JSON.stringify(cfg));
  var st = document.getElementById('ejs-status');
  if (st) { st.textContent = '✓ Sauvegardé'; setTimeout(function(){ st.textContent = ''; }, 2000); }
}

async function testerEmailJS() {
  var st = document.getElementById('ejs-status');
  if (st) st.textContent = 'Envoi en cours…';
  try {
    await envoyerEmailJS(
      'Bug : [TEST] Email FF_Galerie',
      'bug',
      'Test manuel depuis Admin > Backup',
      ''
    );
    if (st) st.textContent = '✓ Email envoyé — vérifie ta boîte';
  } catch(e) {
    if (st) st.textContent = '✗ Erreur : ' + e.message;
  }
}

async function envoyerEmailJS(titre, priorite, message, details) {
  var cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
  if (!cfg || !cfg.publicKey || !cfg.serviceId || !cfg.templateId) return;
  var PREFIX = { bug: 'Bug', bloquant: 'Bloquant', effondrement: 'Effondrement' };
  var resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  cfg.serviceId,
      template_id: cfg.templateId,
      user_id:     cfg.publicKey,
      template_params: {
        subject:  titre,
        priorite: PREFIX[priorite] || 'Bug',
        message:  message.slice(0, 300),
        artiste:  ADMIN_CFG.nom,
        url:      location.href,
        date:     new Date().toLocaleString('fr-BE'),
        details:  details ? String(details).slice(0, 500) : ''
      }
    })
  });
  if (!resp.ok) throw new Error('EmailJS ' + resp.status);
}
