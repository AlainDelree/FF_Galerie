/* ===========================================================================
   FF_Galerie — Worker « ff-data »
   ---------------------------------------------------------------------------
   Rôle : API devant le namespace KV FF_DATA. Remplace, pour les clés migrées,
   les commits GitHub comme mécanisme de sauvegarde des DONNÉES (salles,
   œuvres, scénarios, config) — voir PLAN_MIGRATION_CLOUDFLARE_KV.md.

     - GET  /api/<cle>   → lecture publique (pas d'auth : c'est ce que sert
                            aujourd'hui un fetch('/data/salles.json') public)
     - PUT  /api/<cle>   → écriture protégée. Clé de DONNÉES (hors auth/) :
                            secret maître (env.FF_DATA_SECRET) OU secret
                            d'écriture (env.FF_DATA_SECRET_ECRITURE). Clé
                            auth/* : secret maître SEUL. Voir estAutoriseMaitre
                            / estAutoriseEcriture / peutEcrire ci-dessous.
                            Si <cle> est archivable (CLE_VERS_CHEMIN) et
                            env.GITHUB_TOKEN est configuré, un commit
                            d'archive est poussé sur GitHub EN ARRIÈRE-PLAN
                            (ctx.waitUntil, ne retarde pas la réponse).
                            Entêtes optionnelles : X-FF-Branch (def. 'dev'),
                            X-FF-Message (message de commit).
     - DELETE /api/<cle> → suppression protégée par le secret MAÎTRE seul
                            (opération destructive ; rare, tests/admin)
     - CORS ouvert en lecture (données publiques, pas de cookies → pas de
       risque à autoriser toute origine) ; l'écriture est protégée par le
       secret, pas par CORS (CORS n'est jamais une frontière de sécurité).

   Migration KV Phase 1 (étapes 3+4) : ferette/salles est la seule clé
   archivable pour l'instant (Fred). PAS encore fait : interface de
   restauration Ctrl+Z (§3.4, Phase 4 du plan global), validation de schéma
   par type de clé.

   Auth par personne (token restitué après utilisateur/mot de passe) :
     - POST /api/auth/creer-utilisateur (protégé par FF_DATA_SECRET maître) :
       {nom, mot_de_passe, token, ff_secret?} → hache (PBKDF2) et stocke.
       Le champ ff_secret stocké DOIT être le secret d'ÉCRITURE
       (FF_DATA_SECRET_ECRITURE), jamais le maître : c'est cette valeur qui
       finira dans le navigateur au login. Voir gerer-utilisateurs.sh.
     - POST /api/auth/login (PUBLIC, forcément — c'est le point d'entrée
       sans token) : {utilisateur, mot_de_passe} → {token, ff_secret?}.
       ff_secret renvoyé = le secret d'écriture stocké sur le compte (jamais
       le maître, qui ne quitte pas le serveur).
       Anti brute-force : bloqué 15 min après 5 échecs sur le même nom.
     - Suppression d'un utilisateur (fuite d'un token) : DELETE générique
       sur auth/utilisateurs/<nom> (protégé par FF_DATA_SECRET, rien de
       spécifique à coder).
     - auth/* est bloqué en lecture publique (GET générique) même si le
       reste de KV est public par conception — ces enregistrements
       contiennent les tokens en clair.

   Convention de clé KV = miroir du chemin fichier actuel, préfixé par
   artiste : ex. "ferette/salles", "dinso/oeuvres/sculpture" (voir §3.6 du
   plan). Le worker ne connaît pas la liste des artistes : tout chemin
   /api/<x>/<y>/... devient la clé "<x>/<y>/..." telle quelle.
   =========================================================================== */

/* Clés KV archivables sur GitHub → chemin du fichier dans le repo. Seule
   ferette/salles existe pour l'instant (Phase 1, Fred uniquement) ; étendre
   ici quand les phases suivantes migrent d'autres clés. */
const CLE_VERS_CHEMIN = {
  'ferette/salles': 'data/salles.json'
};

const REPO_GITHUB = 'AlainDelree/FF_Galerie';

const EN_TETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-FF-Branch, X-FF-Message',
  'Access-Control-Max-Age': '86400'
};

function reponseJSON(corps, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', ...EN_TETES_CORS }
  });
}

/* Extrait la clé KV depuis le chemin de la requête. Ex: /api/ferette/salles
   → "ferette/salles". Renvoie null si le chemin est invalide. */
function extraireCle(pathname) {
  if (!pathname.startsWith('/api/')) return null;
  const cle = pathname.slice('/api/'.length).replace(/\/+$/, '');
  if (!cle) return null;
  // Anti path-traversal (même si KV n'a pas de notion de dossiers, on reste prudent)
  if (cle.includes('..') || cle.includes('//')) return null;
  return cle;
}

/* Comparaison à temps constant pour le secret (évite le timing attack basique). */
function secretsEgaux(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── Deux secrets, deux portées (voir README §« Deux secrets ») ───────────
   FF_DATA_SECRET           = secret MAÎTRE. Ne quitte JAMAIS le serveur (ni
                              Bitwarden). Autorise TOUT : création de compte,
                              DELETE, et PUT (y compris les clés auth/).
   FF_DATA_SECRET_ECRITURE  = secret d'ÉCRITURE. C'est LUI, et lui seul, qui
                              est renvoyé au navigateur par /api/auth/login
                              (champ ff_secret). Autorise UNIQUEMENT le PUT
                              sur des clés de DONNÉES (tout ce qui n'est PAS
                              sous le préfixe auth/). Jamais de création de
                              compte, jamais de DELETE, jamais d'écriture
                              sous auth/.

   Règle de partage appliquée par les points d'appel :
     - creer-utilisateur : maître SEUL          → estAutoriseMaitre()
     - DELETE (toute clé) : maître SEUL          → estAutoriseMaitre()
     - PUT clé auth/*     : maître SEUL          → estAutoriseMaitre()
     - PUT clé données    : maître OU écriture   → estAutoriseMaitre() || estAutoriseEcriture()

   Rationale : une fuite du secret d'écriture (il vit dans localStorage d'un
   navigateur, donc exposé XSS/appareil perdu) ne permet plus QUE d'écraser
   des données hors auth/ — ennuyeux mais récupérable via l'archive Git —,
   sans escalade vers la création de comptes ni la lecture des tokens. Le
   DELETE reste maître-seul même sur une clé de données : la suppression est
   destructive sans repli automatique (contrairement au PUT, tracé par
   l'archive Git), elle mérite le même niveau de confiance que creer. */

function estAutoriseMaitre(request, env) {
  if (!env.FF_DATA_SECRET) return false; // secret maître non configuré → tout refuser
  const entete = request.headers.get('Authorization') || '';
  const attendu = `Bearer ${env.FF_DATA_SECRET}`;
  return secretsEgaux(entete, attendu);
}

/* Vrai si l'en-tête porte le secret d'écriture. Ne donne accès qu'au PUT sur
   des clés de données (jamais auth/, jamais DELETE, jamais creer). Renvoie
   false si le secret n'est pas configuré (repli : seul le maître fonctionne). */
function estAutoriseEcriture(request, env) {
  if (!env.FF_DATA_SECRET_ECRITURE) return false;
  const entete = request.headers.get('Authorization') || '';
  const attendu = `Bearer ${env.FF_DATA_SECRET_ECRITURE}`;
  return secretsEgaux(entete, attendu);
}

/* Un PUT sur une clé de données accepte le maître OU le secret d'écriture ;
   un PUT sur une clé auth/* n'accepte que le maître. */
function peutEcrire(request, env, cle) {
  if (estAutoriseMaitre(request, env)) return true;
  if (cle.startsWith('auth/')) return false; // auth/ : écriture réservée au maître
  return estAutoriseEcriture(request, env);
}

/* Encode une chaîne UTF-8 en base64 (équivalent worker de
   btoa(unescape(encodeURIComponent(str))) utilisé côté admin.js). */
function versBase64Utf8(texte) {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  octets.forEach(function(o) { binaire += String.fromCharCode(o); });
  return btoa(binaire);
}

/* Archive un contenu KV sur GitHub, EN ARRIÈRE-PLAN (appelé via
   ctx.waitUntil, ne bloque jamais la réponse au client). Best-effort :
   la donnée est déjà en sécurité dans KV, donc un échec ici (réseau,
   conflit de sha, token absent/révoqué) est juste loggé — PAS de retry
   complexe façon commitMulti, ce n'est pas le chemin critique.
   Une seule tentative de plus si le sha était périmé (409). */
async function archiverVersGitHub(cle, contenuTexte, branche, message, env) {
  const chemin = CLE_VERS_CHEMIN[cle];
  if (!chemin) return; // clé non archivable (pas encore migrée en Phase 1+)
  if (!env.GITHUB_TOKEN) {
    console.warn('[ff-data archive] GITHUB_TOKEN absent, archive ignorée pour', cle);
    return;
  }
  const entetesCommuns = {
    'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ff-data-worker'
  };
  const urlContenu = 'https://api.github.com/repos/' + REPO_GITHUB + '/contents/' + chemin;
  const contenuB64 = versBase64Utf8(contenuTexte);
  const messageCommit = message || ('Archive KV : ' + cle);

  async function tenterCommit() {
    let sha = null;
    try {
      const repGet = await fetch(urlContenu + '?ref=' + encodeURIComponent(branche), { headers: entetesCommuns });
      if (repGet.ok) {
        const infos = await repGet.json();
        sha = infos.sha;
      } else if (repGet.status !== 404) {
        console.error('[ff-data archive] lecture sha échouée', repGet.status, cle);
      }
    } catch (e) {
      console.error('[ff-data archive] erreur réseau lecture sha', cle, String(e));
      return false;
    }
    const corps = { message: messageCommit, content: contenuB64, branch: branche };
    if (sha) corps.sha = sha;
    try {
      const repPut = await fetch(urlContenu, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, entetesCommuns),
        body: JSON.stringify(corps)
      });
      if (repPut.ok) return true;
      const texteErr = await repPut.text().catch(function() { return ''; });
      console.error('[ff-data archive] échec commit', repPut.status, cle, texteErr);
      return repPut.status === 409 ? 'conflit' : false;
    } catch (e) {
      console.error('[ff-data archive] erreur réseau commit', cle, String(e));
      return false;
    }
  }

  const resultat = await tenterCommit();
  if (resultat === 'conflit') {
    // sha périmé (quelqu'un d'autre a commité entre-temps) → une seule retentative
    await tenterCommit();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH PAR PERSONNE — un token GitHub par personne, restitué après un
   couple utilisateur/mot de passe, pour ne plus avoir à distribuer/faire
   retrouver le token brut à chaque perte d'appareil.

   Stockage KV :
     auth/utilisateurs/<nom>  → { hash, sel, iterations, token, ff_secret? }
     auth/tentatives/<nom>    → { echecs }  (TTL 15 min, anti brute-force par NOM : 5 échecs)
     auth/tentatives-ip/<ip>  → { echecs }  (TTL 1 h, anti brute-force par IP : 30 échecs)

   - POST /api/auth/creer-utilisateur  (protégé par FF_DATA_SECRET maître —
     PLUS le secret d'écriture n'y donne PAS accès) : { nom, mot_de_passe,
     token, ff_secret? } → hache le mot de passe et stocke l'enregistrement.
     Écrase si <nom> existe déjà (permet de changer un mot de passe ou faire
     tourner un token). Le ff_secret stocké est le secret d'ÉCRITURE.
   - POST /api/auth/login  (PUBLIC, par nécessité — c'est le point d'entrée
     sans token) : { utilisateur, mot_de_passe } → { token, ff_secret? } si
     valide ; ff_secret = le secret d'écriture stocké sur le compte, jamais
     le maître. Bloqué 15 min après 5 échecs sur le même nom (KV expirationTtl).
   - Suppression d'un utilisateur (ex. fuite d'un token) : PAS de nouvel
     endpoint, réutilise le DELETE générique existant sur la clé
     auth/utilisateurs/<nom> (déjà protégé par FF_DATA_SECRET).
   ═══════════════════════════════════════════════════════════════════════ */

function hexVersBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function bytesVersHex(bytes) {
  return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/* PBKDF2-SHA256, 100 000 itérations par défaut. selHex null → génère un sel
   aléatoire (création) ; fourni → redérive avec ce sel (vérification). */
async function hacherMotDePasse(motDePasse, selHex, iterations) {
  iterations = iterations || 100000;
  const selBytes = selHex ? hexVersBytes(selHex) : crypto.getRandomValues(new Uint8Array(16));
  const materiau = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: selBytes, iterations: iterations },
    materiau, 256
  );
  return { hash: bytesVersHex(new Uint8Array(bits)), sel: bytesVersHex(selBytes) };
}

/* Normalise un nom d'utilisateur en identifiant de clé KV sûr (minuscules,
   alphanumérique + tiret/underscore uniquement). */
function normaliserNomUtilisateur(nom) {
  return (nom || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

/* Normalise une adresse IP (en-tête CF-Connecting-IP) en identifiant de clé
   KV sûr : on garde chiffres/lettres (IPv6), point, deux-points, tiret,
   underscore. Renvoie '' si l'en-tête est absent/vide — l'appelant
   n'applique alors AUCUN comptage par IP (cas des tests locaux au curl, où
   Cloudflare ne pose pas cet en-tête). */
function normaliserIp(ip) {
  return (ip || '').trim().toLowerCase().replace(/[^a-z0-9.:_-]/g, '');
}

async function gererCreationUtilisateur(request, env) {
  // Création de compte : secret MAÎTRE seul (jamais le secret d'écriture).
  if (!estAutoriseMaitre(request, env)) return reponseJSON({ erreur: 'Non autorisé' }, 401);
  let corps;
  try { corps = await request.json(); } catch { return reponseJSON({ erreur: 'Corps JSON invalide' }, 400); }
  const nom = normaliserNomUtilisateur(corps.nom);
  const motDePasse = corps.mot_de_passe || '';
  const token = corps.token || '';
  if (!nom || !motDePasse || !token) {
    return reponseJSON({ erreur: 'nom, mot_de_passe et token sont requis' }, 400);
  }
  const iterations = 100000;
  const { hash, sel } = await hacherMotDePasse(motDePasse, null, iterations);
  const enregistrement = { hash: hash, sel: sel, iterations: iterations, token: token };
  if (corps.ff_secret) enregistrement.ff_secret = corps.ff_secret;
  await env.FF_DATA.put('auth/utilisateurs/' + nom, JSON.stringify(enregistrement));
  return reponseJSON({ ok: true, utilisateur: nom });
}

async function gererLogin(request, env) {
  let corps;
  try { corps = await request.json(); } catch { return reponseJSON({ erreur: 'Corps JSON invalide' }, 400); }
  const nom = normaliserNomUtilisateur(corps.utilisateur);
  const motDePasse = corps.mot_de_passe || '';
  if (!nom || !motDePasse) return reponseJSON({ erreur: 'Identifiants manquants' }, 400);

  /* Anti brute-force PAR IP (durcissement en profondeur, CUMULÉ avec le
     compteur par nom ci-dessous — les deux blocages sont indépendants). Il
     couvre l'angle mort du compteur par nom : une attaque essayant un mot
     de passe courant contre de nombreux noms différents ne déclenche jamais
     le blocage par nom. Seuil volontairement PERMISSIF (30 échecs par
     heure, toutes cibles confondues), pour ne pas gêner un utilisateur
     légitime maladroit tout en cassant un balayage massif.
     CF-Connecting-IP est posé par Cloudflare, non falsifiable côté worker.
     S'il est absent (tests locaux au curl), normaliserIp renvoie '' et on
     ne compte simplement pas — le login n'échoue jamais pour cette raison. */
  const ip = normaliserIp(request.headers.get('CF-Connecting-IP'));
  const cleTentativesIp = ip ? 'auth/tentatives-ip/' + ip : null;
  let echecsIp = 0;
  if (cleTentativesIp) {
    const brutIp = await env.FF_DATA.get(cleTentativesIp);
    echecsIp = brutIp ? (JSON.parse(brutIp).echecs || 0) : 0;
    if (echecsIp >= 30) {
      return reponseJSON({ erreur: 'Trop de tentatives échouées depuis cette adresse, réessayez plus tard' }, 429);
    }
  }

  const cleTentatives = 'auth/tentatives/' + nom;
  const brutTentatives = await env.FF_DATA.get(cleTentatives);
  const echecsActuels = brutTentatives ? (JSON.parse(brutTentatives).echecs || 0) : 0;
  if (echecsActuels >= 5) {
    return reponseJSON({ erreur: 'Trop de tentatives échouées, réessayez dans 15 minutes' }, 429);
  }

  const brutUtilisateur = await env.FF_DATA.get('auth/utilisateurs/' + nom);
  let valide = false, enregistrement = null;
  if (brutUtilisateur) {
    enregistrement = JSON.parse(brutUtilisateur);
    const { hash } = await hacherMotDePasse(motDePasse, enregistrement.sel, enregistrement.iterations);
    valide = secretsEgaux(hash, enregistrement.hash);
  } else {
    /* Utilisateur inconnu : on hache quand même contre un sel factice pour
       limiter (approximativement) la fuite d'info par timing — pas
       parfait, mais mieux que de répondre instantanément. */
    await hacherMotDePasse(motDePasse, '00000000000000000000000000000000', 100000);
  }

  if (!valide) {
    await env.FF_DATA.put(cleTentatives, JSON.stringify({ echecs: echecsActuels + 1 }), { expirationTtl: 900 });
    /* Incrémente aussi le compteur par IP (TTL 1 h) quand l'en-tête est
       présent. On ne le remet PAS à zéro sur un login réussi : il agrège
       plusieurs noms, le laisser expirer naturellement est plus prudent. */
    if (cleTentativesIp) {
      await env.FF_DATA.put(cleTentativesIp, JSON.stringify({ echecs: echecsIp + 1 }), { expirationTtl: 3600 });
    }
    return reponseJSON({ erreur: 'Identifiants invalides' }, 401);
  }

  await env.FF_DATA.delete(cleTentatives).catch(function() {});
  const reponse = { token: enregistrement.token };
  if (enregistrement.ff_secret) reponse.ff_secret = enregistrement.ff_secret;
  return reponseJSON(reponse);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: EN_TETES_CORS });
    }

    if (url.pathname === '/api/_health') {
      return reponseJSON({ ok: true, worker: 'ff-data', phase: '1 (3+4)' });
    }

    if (!env.FF_DATA) {
      return reponseJSON({ erreur: 'Namespace KV FF_DATA non lié à ce worker' }, 500);
    }

    if (url.pathname === '/api/auth/creer-utilisateur' && request.method === 'POST') {
      return gererCreationUtilisateur(request, env);
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return gererLogin(request, env);
    }

    const cle = extraireCle(url.pathname);
    if (!cle) return reponseJSON({ erreur: 'Clé invalide ou absente' }, 400);

    if (request.method === 'GET') {
      /* auth/* contient des tokens en clair (hash+sel+TOKEN+ff_secret) —
         JAMAIS public, même si le reste de KV l'est par conception.
         Personne n'a besoin de lire ces enregistrements directement : le
         login (gererLogin) les lit lui-même côté serveur. */
      if (cle.startsWith('auth/')) {
        return reponseJSON({ erreur: 'Non autorisé' }, 401);
      }
      const valeur = await env.FF_DATA.get(cle);
      if (valeur === null) return reponseJSON({ erreur: 'Clé introuvable', cle }, 404);
      // On stocke du JSON brut en valeur → on le renvoie tel quel, pas de ré-encapsulation.
      return new Response(valeur, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', ...EN_TETES_CORS }
      });
    }

    if (request.method === 'PUT') {
      // Données (hors auth/) : maître OU secret d'écriture. auth/* : maître seul.
      if (!peutEcrire(request, env, cle)) {
        return reponseJSON({ erreur: 'Non autorisé' }, 401);
      }
      let corpsTexte;
      try {
        corpsTexte = await request.text();
      } catch {
        return reponseJSON({ erreur: 'Corps de requête illisible' }, 400);
      }
      // Validation : le corps doit être du JSON valide (pas de JSON cassé en KV).
      try {
        JSON.parse(corpsTexte);
      } catch {
        return reponseJSON({ erreur: 'Corps de requête : JSON invalide' }, 400);
      }
      await env.FF_DATA.put(cle, corpsTexte);
      const branche = request.headers.get('X-FF-Branch') || 'dev';
      /* X-FF-Message est percent-encodé côté admin (encodeURIComponent) car les
         en-têtes HTTP sont du Latin-1 strict et refusent les caractères > 0xFF
         (tiret cadratin, guillemets courbes, emoji…). On le décode ici pour que
         le message de commit reste lisible en clair dans l'historique Git.
         try/catch : un client non à jour (ou un « % » littéral non échappé)
         enverrait une valeur non/malencodée → on garde alors le brut plutôt que
         de perdre le message sur une URIError. */
      let messageCommit = request.headers.get('X-FF-Message') || null;
      if (messageCommit) {
        try { messageCommit = decodeURIComponent(messageCommit); }
        catch { /* valeur non percent-encodée : on la conserve telle quelle */ }
      }
      ctx.waitUntil(archiverVersGitHub(cle, corpsTexte, branche, messageCommit, env));
      return reponseJSON({ ok: true, cle });
    }

    if (request.method === 'DELETE') {
      // Suppression (destructive, sans repli auto) : secret MAÎTRE seul,
      // quelle que soit la clé — y compris une clé de données hors auth/.
      if (!estAutoriseMaitre(request, env)) {
        return reponseJSON({ erreur: 'Non autorisé' }, 401);
      }
      await env.FF_DATA.delete(cle);
      return reponseJSON({ ok: true, cle, supprime: true });
    }

    return reponseJSON({ erreur: 'Méthode non supportée' }, 405);
  }
};
