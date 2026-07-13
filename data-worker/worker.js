/* ===========================================================================
   FF_Galerie — Worker « ff-data »
   ---------------------------------------------------------------------------
   Rôle : API devant le namespace KV FF_DATA. Remplace, pour les clés migrées,
   les commits GitHub comme mécanisme de sauvegarde des DONNÉES (salles,
   œuvres, scénarios, config) — voir PLAN_MIGRATION_CLOUDFLARE_KV.md.

     - GET  /api/<cle>   → lecture publique (pas d'auth : c'est ce que sert
                            aujourd'hui un fetch('/data/salles.json') public)
     - PUT  /api/<cle>   → écriture protégée par secret (env.FF_DATA_SECRET) ;
                            si <cle> est archivable (CLE_VERS_CHEMIN) et
                            env.GITHUB_TOKEN est configuré, un commit
                            d'archive est poussé sur GitHub EN ARRIÈRE-PLAN
                            (ctx.waitUntil, ne retarde pas la réponse).
                            Entêtes optionnelles : X-FF-Branch (def. 'dev'),
                            X-FF-Message (message de commit).
     - DELETE /api/<cle> → suppression protégée (rare, prévu pour tests/admin)
     - CORS ouvert en lecture (données publiques, pas de cookies → pas de
       risque à autoriser toute origine) ; l'écriture est protégée par le
       secret, pas par CORS (CORS n'est jamais une frontière de sécurité).

   Migration KV Phase 1 (étapes 3+4) : ferette/salles est la seule clé
   archivable pour l'instant (Fred). PAS encore fait : interface de
   restauration Ctrl+Z (§3.4, Phase 4 du plan global), validation de schéma
   par type de clé.

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
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

function estAutorise(request, env) {
  if (!env.FF_DATA_SECRET) return false; // secret non configuré → tout refuser
  const entete = request.headers.get('Authorization') || '';
  const attendu = `Bearer ${env.FF_DATA_SECRET}`;
  return secretsEgaux(entete, attendu);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: EN_TETES_CORS });
    }

    if (url.pathname === '/api/_health') {
      return reponseJSON({ ok: true, worker: 'ff-data', phase: '1 (3+4)' });
    }

    const cle = extraireCle(url.pathname);
    if (!cle) return reponseJSON({ erreur: 'Clé invalide ou absente' }, 400);

    if (!env.FF_DATA) {
      return reponseJSON({ erreur: 'Namespace KV FF_DATA non lié à ce worker' }, 500);
    }

    if (request.method === 'GET') {
      const valeur = await env.FF_DATA.get(cle);
      if (valeur === null) return reponseJSON({ erreur: 'Clé introuvable', cle }, 404);
      // On stocke du JSON brut en valeur → on le renvoie tel quel, pas de ré-encapsulation.
      return new Response(valeur, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', ...EN_TETES_CORS }
      });
    }

    if (request.method === 'PUT') {
      if (!estAutorise(request, env)) {
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
      const messageCommit = request.headers.get('X-FF-Message') || null;
      ctx.waitUntil(archiverVersGitHub(cle, corpsTexte, branche, messageCommit, env));
      return reponseJSON({ ok: true, cle });
    }

    if (request.method === 'DELETE') {
      if (!estAutorise(request, env)) {
        return reponseJSON({ erreur: 'Non autorisé' }, 401);
      }
      await env.FF_DATA.delete(cle);
      return reponseJSON({ ok: true, cle, supprime: true });
    }

    return reponseJSON({ erreur: 'Méthode non supportée' }, 405);
  }
};
