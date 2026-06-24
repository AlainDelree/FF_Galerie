/* admin-liste.js — Composant liste unique des œuvres
 * ─────────────────────────────────────────────────
 * listeOeuvres(opts) — rend une liste scrollable dans un container.
 *
 * Légendes « disponibilite » (par VUE, pas par salle) :
 *   VERT  = œuvre présente dans la vue courante (positions[] ou positions_mobile[])
 *   ROUGE = œuvre dans une AUTRE salle (toute vue)
 *   GRIS  = libre (pas dans une autre salle — peut être dans une autre vue de cette salle)
 *
 * opts = {
 *   container  : HTMLElement            — où rendre (obligatoire)
 *   filtre     : 'toutes'|'salle'|'disponibles'|'placees'   (défaut 'toutes')
 *   salleRef   : Object|null            — salle active (pour filtrage + légende)
 *   vue        : 'pc'|'gsm'            — vue courante pour légende VERT/GRIS (défaut 'pc')
 *   tri        : 'statut'|'titre'|'taille'|'ordre'          (défaut 'statut')
 *   mode       : 'lecture'|'selection'|'edition'            (défaut 'lecture')
 *   legendes   : ['disponibilite','taille','salle']          (défaut [])
 *   selection  : Set<id>               — ids actuellement sélectionnés (défaut Set vide)
 *   onSelect   : function(id)          — callback clic (mode selection)
 *   onDblClick : function(id)          — callback dblclick PC (facultatif)
 * }
 */

function listeOeuvres(opts) {
  var container  = opts.container;
  var filtre     = opts.filtre     || 'toutes';
  var typeFiltre = opts.typeFiltre || null;  /* 'peinture' / 'sculpture' / null = pas de filtre par type */
  var salleRef   = opts.salleRef   || null;
  var vue        = opts.vue        || 'pc';
  var tri        = opts.tri        || 'statut';
  var triInverse = !!opts.triInverse;
  var mode       = opts.mode       || 'lecture';
  var legendes   = opts.legendes   || [];
  var selection  = opts.selection  || new Set();
  var onSelect   = opts.onSelect   || null;
  var onDblClick = opts.onDblClick || null;
  var recherche  = (opts.recherche || '').trim().toLowerCase();

  if (!container) return;
  container.innerHTML = '';

  var toutesOeuvres = Array.isArray(toiles) ? toiles : [];
  var toutesSalles  = Array.isArray(salles)  ? salles  : [];

  /* ─── Calcul des sets de placement ─── */

  function _posVueCourante(salle) {
    if (!salle) return new Set();
    var arr = (vue === 'gsm')
      ? (salle.positions_mobile && salle.positions_mobile.length ? salle.positions_mobile : salle.positions || [])
      : (salle.positions || []);
    return new Set(arr.map(function(p) { return p.id; }));
  }

  function _posAutresSalles(salleCourante) {
    var idCourant = salleCourante ? salleCourante.id : -Infinity;
    /* En multi-types, ne considérer comme "autres salles" que celles du même
       type que la salle courante (ou du type filtré). Sinon une peinture id=5
       est marquée "en salle" parce qu'une sculpture id=5 est posée ailleurs. */
    var typeRef = (salleCourante && salleCourante.type)
      || typeFiltre
      || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : null)
      || null;
    var ids = new Set();
    toutesSalles.forEach(function(s) {
      if (s.id === idCourant) return;
      if (typeRef && s.type && s.type !== typeRef) return;
      (s.positions        || []).forEach(function(p) { ids.add(p.id); });
      (s.positions_mobile || []).forEach(function(p) { ids.add(p.id); });
    });
    return ids;
  }

  var posVue    = _posVueCourante(salleRef);
  var posAutres = _posAutresSalles(salleRef);

  function _legende(id) {
    if (posVue.has(id))    return 'vert';
    if (posAutres.has(id)) return 'rouge';
    return 'gris';
  }

  /* ─── Filtrage ─── */
  var items = toutesOeuvres.slice();

  /* Filtre par type d'œuvre (3b-2 cohabitation multi-types) */
  if (typeFiltre) {
    items = items.filter(function(t) {
      return ((t._type) || ADMIN_CFG.type || 'peinture') === typeFiltre;
    });
  }

  if (filtre === 'salle' && salleRef) {
    var posSalle = new Set();
    (salleRef.positions        || []).forEach(function(p) { posSalle.add(p.id); });
    (salleRef.positions_mobile || []).forEach(function(p) { posSalle.add(p.id); });
    items = items.filter(function(t) { return posSalle.has(t.id); });
  } else if (filtre === 'disponibles') {
    /* Sans salleRef → "disponible" = pas placée dans aucune salle (ni vue) */
    if (!salleRef) {
      items = items.filter(function(t) { return !posAutres.has(t.id); });
    } else {
      items = items.filter(function(t) { return _legende(t.id) === 'gris'; });
    }
  } else if (filtre === 'placees') {
    /* Sans salleRef → "placée" = présente dans au moins une salle */
    if (!salleRef) {
      items = items.filter(function(t) { return posAutres.has(t.id); });
    } else {
      items = items.filter(function(t) { return posVue.has(t.id); });
    }
  }
  /* filtre === 'toutes' → pas de filtrage par placement */

  /* Recherche par titre (sous-chaîne, insensible à la casse) */
  if (recherche) {
    items = items.filter(function(t) {
      return (t.titre || '').toLowerCase().indexOf(recherche) >= 0;
    });
  }

  /* ─── Tri ─── */
  if (tri === 'statut') {
    function _grpOf(t) {
      var l = _legende(t.id);
      return l === 'vert' ? 0 : l === 'gris' ? 1 : 2;
    }
    items.sort(function(a, b) { return _grpOf(a) - _grpOf(b); });
  } else if (tri === 'titre') {
    items.sort(function(a, b) {
      return (a.titre || '').localeCompare(b.titre || '', 'fr', { sensitivity: 'base' });
    });
  } else if (tri === 'taille') {
    /* Peinture : tri par code de taille (XXS→E). Sculpture : tri par
       hauteur en cm croissante (champ dimensions.hauteur, pas de code).
       Détection via typeFiltre si présent (colonne dédiée), sinon
       ADMIN_CFG.type (admin mono-type). */
    var typePourTri = typeFiltre || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : '');
    if (typePourTri === 'sculpture') {
      items.sort(function(a, b) {
        var ha = (a.dimensions && a.dimensions.hauteur) || 0;
        var hb = (b.dimensions && b.dimensions.hauteur) || 0;
        return ha - hb;
      });
    } else {
      var tOrd = (Array.isArray(tailles) ? tailles : []).map(function(t) { return t.code; });
      items.sort(function(a, b) {
        var ia = tOrd.indexOf(a.taille), ib = tOrd.indexOf(b.taille);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
  } else if (tri === 'ajout') {
    /* ID croissant = ordre chronologique d'ajout via l'admin (prochainId monotone).
       On affiche en décroissant : œuvre la plus récemment ajoutée en tête. */
    items.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
  } else if (tri === 'date') {
    /* Date de l'œuvre (champ t.date, peut être '2023', '2023-05', etc.).
       Tri décroissant : œuvre la plus récente d'abord. Œuvres sans date à la fin. */
    items.sort(function(a, b) {
      var da = a.date || '', db = b.date || '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da); /* desc */
    });
  }
  /* tri === 'ordre' → ordre JSON original conservé (cas spécial pour rétrocompat) */

  /* Inversion de l'ordre si l'utilisateur a basculé le bouton ↑/↓.
     Le tri par défaut est dans le sens "naturel" (alpha A→Z, taille petit→grand,
     date récent→ancien, etc.) ; reverse() bascule simplement. */
  if (triInverse) items.reverse();

  /* ─── Render ─── */
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'font-size:.75rem;color:var(--muted);padding:.8rem;text-align:center;';
    var _isSculpt = typeof ADMIN_CFG !== 'undefined' && ADMIN_CFG.type === 'sculpture';
    empty.textContent = 'Aucune ' + (_isSculpt ? 'pièce' : 'toile');
    container.appendChild(empty);
    return;
  }

  var showLegende = legendes.indexOf('disponibilite') >= 0;
  var showTaille  = legendes.indexOf('taille')        >= 0;
  var showSalle   = legendes.indexOf('salle')         >= 0;
  var showId      = legendes.indexOf('id')            >= 0;
  var assetsBase  = (typeof window.ADMIN_CFG !== 'undefined' && window.ADMIN_CFG.assetsBase) || '';

  /* Séparateurs de groupe (uniquement si tri statut + légende disponibilite).
     Labels adaptés selon contexte : avec salleRef (vue d'une salle) on parle de
     "Sur cette vue", sans salleRef (inventaire global) c'est "Placées"/"Non placées". */
  var labGrp = salleRef
    ? ['Sur cette vue', 'Disponibles', 'Autre salle']
    : ['',              'Non placées', 'Placées'];
  var dernierGrp = -1;

  items.forEach(function(t) {
    var leg = _legende(t.id);
    var grp = leg === 'vert' ? 0 : leg === 'gris' ? 1 : 2;

    if (tri === 'statut' && showLegende && grp !== dernierGrp) {
      var sep = document.createElement('div');
      sep.className = 'lo-sep';
      if (dernierGrp === -1) sep.style.borderTop = 'none';
      sep.textContent = labGrp[grp];
      container.appendChild(sep);
      dernierGrp = grp;
    }

    var item = document.createElement('div');
    var itemType = (t._type) || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture');
    item.className = 'lo-item' + (selection.has(t.id) ? ' sel' : '');
    item.dataset.id = String(t.id);
    item.dataset.type = itemType;  /* Indispensable en multi-types : Tiki sculpture id=1
                                       et Rivière peinture id=1 doivent être différenciés. */

    /* Bord gauche coloré (indicateur légende) */
    var bord = document.createElement('div');
    bord.className = 'lo-bord';
    if (showLegende) {
      if (leg === 'vert')  bord.style.background = 'var(--success)';
      else if (leg === 'rouge') bord.style.background = 'var(--danger)';
      else                 bord.style.background = 'var(--brd2)';
    }
    item.appendChild(bord);

    /* Numéro d'ordre (ID) — affiché à gauche de la miniature en mode
       inventaire global (jeu franc : c'est l'ID monotone qui sert aussi
       de tri "Date d'ajout"). */
    if (showId) {
      var idEl = document.createElement('div');
      idEl.className = 'lo-id';
      idEl.textContent = '#' + t.id;
      item.appendChild(idEl);
    }

    /* Thumbnail */
    var thumb = document.createElement('div');
    thumb.className = 'lo-thumb';
    var photo = t.photo
      ? (t.photo.startsWith('http') ? t.photo : assetsBase + t.photo)
      : '';
    if (photo) {
      var img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.draggable = false;
      img.onerror = function() { this.onerror = null; this.style.display = 'none'; };
      img.src = t._preview || photo;
      thumb.appendChild(img);
    } else {
      var ph = document.createElement('span');
      ph.className = 'lo-thumb-ph';
      ph.style.cssText = 'display:flex;align-items:center;justify-content:center;';
      ph.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:.6;">' +
        '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" stroke="#999" stroke-width="1.5" fill="none"/>' +
        '<circle cx="12" cy="12.5" r="3.2" stroke="#999" stroke-width="1.5" fill="none"/>' +
        '<line x1="3" y1="3" x2="21" y2="21" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/></svg>';
      ph.title = 'Photo manquante';
      thumb.appendChild(ph);
    }
    item.appendChild(thumb);

    /* Infos texte */
    var infos = document.createElement('div');
    infos.className = 'lo-infos';

    var titreEl = document.createElement('div');
    titreEl.className = 'lo-titre';
    titreEl.textContent = t.titre || '—';
    infos.appendChild(titreEl);

    if (showTaille) {
      var lblTaille = '';
      /* Le type vient de l'œuvre elle-même (multi-types) ou retombe sur
         ADMIN_CFG.type pour les admins mono-type historiques. */
      var typeItem = (t._type) || (typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture');
      if (typeItem === 'sculpture' && t.dimensions && t.dimensions.hauteur) {
        lblTaille = t.dimensions.hauteur + ' cm';
      } else if (typeItem !== 'sculpture' && t.taille) {
        lblTaille = t.taille;
      }
      if (lblTaille) {
        var tailleEl = document.createElement('div');
        tailleEl.className = 'lo-meta';
        tailleEl.textContent = lblTaille;
        infos.appendChild(tailleEl);
      }
    }

    if (showSalle) {
      var nomS = _loNomSalle(t.id, salleRef);
      if (nomS) {
        var salleEl = document.createElement('div');
        salleEl.className = 'lo-meta lo-salle-lbl';
        salleEl.textContent = nomS;
        infos.appendChild(salleEl);
      }
    }
    item.appendChild(infos);

    /* Bouton édition (mode edition) */
    if (mode === 'edition') {
      var editBtn = document.createElement('button');
      editBtn.className = 'lo-edit-btn';
      editBtn.title = 'Modifier';
      editBtn.textContent = '✏️';
      editBtn.dataset.editId = String(t.id);
      item.appendChild(editBtn);
    }

    /* Interactions */
    if (mode === 'selection' && onSelect) {
      item.addEventListener('click', (function(id, type) {
        return function(e) {
          if (e.target.classList && e.target.classList.contains('lo-edit-btn')) return;
          onSelect(id, type);
        };
      })(t.id, itemType));
    }

    if (onDblClick && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      item.addEventListener('dblclick', (function(id, type) {
        return function() { onDblClick(id, type); };
      })(t.id, itemType));
    }

    container.appendChild(item);
  });
}

/* Nom de la salle qui contient l'œuvre (hors salle courante) */
function _loNomSalle(oeuvreId, salleCourante) {
  var all = Array.isArray(salles) ? salles : [];
  var idC = salleCourante ? salleCourante.id : -Infinity;
  var s = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === idC) continue;
    var inPos  = (all[i].positions        || []).some(function(p) { return p.id === oeuvreId; });
    var inMob  = (all[i].positions_mobile || []).some(function(p) { return p.id === oeuvreId; });
    if (inPos || inMob) { s = all[i]; break; }
  }
  return s ? (s.nom || '') : '';
}
