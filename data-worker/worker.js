/* ===========================================================================
   FF_Galerie — Worker « ff-data »
   ---------------------------------------------------------------------------
   Rôle : API minimaliste devant le namespace KV FF_DATA. Remplace, à terme,
   les commits GitHub comme mécanisme de sauvegarde des DONNÉES (salles,
   œuvres, scénarios, config) — voir PLAN_MIGRATION_CLOUDFLARE_KV.md.

   Phase 0 (ce fichier) : fondations seulement.
     - GET  /api/<cle>   → lecture publique (pas d'auth : c'est ce que sert
                            aujourd'hui un fetch('/data/salles.json') public)
     - PUT  /api/<cle>   → écriture protégée par secret (env.FF_DATA_SECRET)
     - DELETE /api/<cle> → suppression protégée (rare, prévu pour tests/admin)
     - CORS ouvert en lecture (données publiques, pas de cookies → pas de
       risque à autoriser toute origine) ; l'écriture est protégée par le
       secret, pas par CORS (CORS n'est jamais une frontière de sécurité).

   PAS encore dans ce fichier (phases suivantes) :
     - archive Git en arrière-plan après un PUT (§3.4, Phase 1)
     - interface de restauration Ctrl+Z (§3.4, Phase 4)
     - validation de schéma par type de clé (Phase 1+)

   Convention de clé KV = miroir du chemin fichier actuel, préfixé par
   artiste : ex. "ferette/salles", "dinso/oeuvres/sculpture" (voir §3.6 du
   plan). Le worker ne connaît pas la liste des artistes : tout chemin
   /api/<x>/<y>/... devient la clé "<x>/<y>/..." telle quelle.
   =========================================================================== */

const EN_TETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: EN_TETES_CORS });
    }

    if (url.pathname === '/api/_health') {
      return reponseJSON({ ok: true, worker: 'ff-data', phase: 0 });
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
