/* admin-oeuvres.js — Onglet gestion des œuvres / pièces
 * Inventaire global : liste, ajout, modification, suppression, catalogue
 * Utilise listeOeuvres() (admin-liste.js) en mode sélection.
 */

var _oeuvresSelection = new Set(); /* au plus 1 id sélectionné */
var _oeuvresRecherche = '';
var _oeuvresTri       = 'titre';
var _oeuvresTriDesc   = false; /* false = ordre naturel, true = inversé */
var _oeuvresFiltre    = 'toutes';

/* ── Initialisation (appelée après chargement de tous les modules) ── */
function initOeuvresTab() {
  /* Label de l'onglet : 'Œuvres' fixe (terme générique couvrant toiles
     ET pièces, cohérent avec la cohabitation peinture+sculpture). */
  var ongletEl = document.getElementById('onglet-oeuvres');
  if (ongletEl) ongletEl.textContent = 'Œuvres';

  /* Boutons toolbar */
  var btnAjt = document.getElementById('btn-oeuvres-ajouter');
  var btnSup = document.getElementById('btn-oeuvres-supprimer');
  var btnCat = document.getElementById('btn-oeuvres-catalogue');

  if (btnAjt) btnAjt.addEventListener('click', function() {
    _oeuvresSelection.clear();
    majBoutonsOeuvres();
    if (typeof construirePillsSalle === 'function') construirePillsSalle(null);
    if (typeof ouvrirFormulaireNouvel === 'function') ouvrirFormulaireNouvel();
  });

  if (btnSup) btnSup.addEventListener('click', function() {
    var id = [..._oeuvresSelection][0];
    if (id == null) return;
    selectedToile = (typeof toiles !== 'undefined')
      ? toiles.find(function(t) { return t.id === id; }) || null
      : null;
    if (typeof supprimerToile === 'function') supprimerToile();
  });

  if (btnCat) btnCat.addEventListener('click', function() {
    if (typeof ouvrirCatalogue === 'function') ouvrirCatalogue();
  });

  /* Recherche par titre — re-render à chaque frappe */
  var inpRech = document.getElementById('oeuvres-recherche');
  if (inpRech) inpRech.addEventListener('input', function() {
    _oeuvresRecherche = inpRech.value;
    afficherOeuvres();
  });

  /* Tri (select) */
  var selTri = document.getElementById('oeuvres-tri');
  if (selTri) selTri.addEventListener('change', function() {
    _oeuvresTri = selTri.value;
    afficherOeuvres();
  });

  /* Bouton d'inversion du sens du tri (↓ par défaut = ordre naturel) */
  var btnDir = document.getElementById('btn-oeuvres-tri-dir');
  if (btnDir) {
    var _majBtnDir = function() {
      btnDir.textContent = _oeuvresTriDesc ? '↑' : '↓';
      btnDir.title = _oeuvresTriDesc ? 'Ordre inverse — cliquer pour ordre naturel' : 'Ordre naturel — cliquer pour inverser';
    };
    _majBtnDir();
    btnDir.addEventListener('click', function() {
      _oeuvresTriDesc = !_oeuvresTriDesc;
      _majBtnDir();
      afficherOeuvres();
    });
  }

  /* Chips de filtre par statut */
  var chips = document.querySelectorAll('.oeuvres-chip');
  chips.forEach(function(c) {
    c.addEventListener('click', function() {
      chips.forEach(function(x) { x.classList.remove('actif'); });
      c.classList.add('actif');
      _oeuvresFiltre = c.dataset.filtre || 'toutes';
      afficherOeuvres();
    });
  });
}

/* ── Affichage de la liste ── */
function afficherOeuvres() {
  var container = document.getElementById('oeuvres-list');
  if (!container) return;

  /* Détecter les types présents (à partir de _taillesParType chargé par
     admin.js, OU à partir des _type vus dans toiles[]). Si un seul type
     → layout single-colonne historique. Si plusieurs → une colonne par type. */
  var typesPresents = Object.keys(typeof _taillesParType !== 'undefined' ? _taillesParType : {});
  if (typesPresents.length === 0) {
    typesPresents = [(typeof ADMIN_CFG !== 'undefined' ? ADMIN_CFG.type : 'peinture')];
  }

  /* Multi-types → masquer le bouton "+ Ajouter" global (chaque colonne a
     son propre bouton "+"). Mono-type → garder le bouton global visible. */
  var btnAjt = document.getElementById('btn-oeuvres-ajouter');
  if (btnAjt) btnAjt.style.display = (typesPresents.length > 1) ? 'none' : '';
  /* Ordre prévisible : peinture toujours à gauche, sculpture à droite */
  typesPresents.sort(function(a, b) {
    var ORDRE = { peinture: 0, sculpture: 1 };
    return (ORDRE[a] || 99) - (ORDRE[b] || 99);
  });

  container.innerHTML = '';
  container.classList.toggle('multi-types', typesPresents.length > 1);

  var commonOpts = {
    filtre:     _oeuvresFiltre,
    salleRef:   null,
    vue:        'pc',
    tri:        _oeuvresTri,
    triInverse: _oeuvresTriDesc,
    recherche:  _oeuvresRecherche,
    mode:       'selection',
    legendes:   ['disponibilite', 'id', 'salle', 'taille'],
    selection:  _oeuvresSelection,
    onSelect: function(id) {
      /* Sélection visuelle (indique l'œuvre en cours d'édition) */
      container.querySelectorAll('.lo-item').forEach(function(el) {
        el.classList.remove('sel');
      });
      _oeuvresSelection.clear();
      _oeuvresSelection.add(id);
      var el = container.querySelector('[data-id="' + id + '"]');
      if (el) el.classList.add('sel');
      majBoutonsOeuvres();
      if (typeof ouvrirFormulaireEdition === 'function') ouvrirFormulaireEdition(id);
    },
    onDblClick: function(id) {
      if (typeof ouvrirFormulaireEdition === 'function') ouvrirFormulaireEdition(id);
    }
  };

  if (typesPresents.length === 1) {
    /* Mono-type : pas de header, comportement identique au code historique */
    listeOeuvres(Object.assign({}, commonOpts, { container: container }));
  } else {
    /* Multi-types : une colonne par type avec en-tête + bouton "+" dédié */
    typesPresents.forEach(function(type) {
      var col = document.createElement('div');
      col.className = 'oeuvres-col';
      col.dataset.type = type;

      var nbTotal = toiles.filter(function(t) {
        return ((t._type) || ADMIN_CFG.type) === type;
      }).length;

      var hdr = document.createElement('div');
      hdr.className = 'oeuvres-col-hdr';
      var lblType = (type === 'sculpture') ? 'Sculptures' : 'Peintures';
      hdr.innerHTML = '<span class="oeuvres-col-titre">' + lblType +
        ' <span class="oeuvres-col-nb">(' + nbTotal + ')</span></span>';
      var btnPlus = document.createElement('button');
      btnPlus.className = 'oeuvres-col-add';
      btnPlus.type = 'button';
      btnPlus.textContent = '+';
      btnPlus.title = 'Ajouter une ' + (type === 'sculpture' ? 'sculpture' : 'peinture');
      btnPlus.addEventListener('click', function() {
        _oeuvresSelection.clear();
        majBoutonsOeuvres();
        /* TODO 3b-2-4b : passer le type au formulaire pour qu'il s'adapte.
           Pour l'instant, le formulaire reste basé sur ADMIN_CFG.type. */
        if (typeof construirePillsSalle === 'function') construirePillsSalle(null);
        if (typeof ouvrirFormulaireNouvel === 'function') ouvrirFormulaireNouvel();
      });
      hdr.appendChild(btnPlus);
      col.appendChild(hdr);

      var corps = document.createElement('div');
      corps.className = 'oeuvres-col-corps';
      col.appendChild(corps);
      container.appendChild(col);

      listeOeuvres(Object.assign({}, commonOpts, {
        container:  corps,
        typeFiltre: type
      }));
    });
  }

  majBoutonsOeuvres();
}

/* ── Enable/disable boutons selon sélection ── */
function majBoutonsOeuvres() {
  var ok = _oeuvresSelection.size === 1;
  var btnSup = document.getElementById('btn-oeuvres-supprimer');
  if (btnSup) btnSup.disabled = !ok;
}

/* ── Vrai si l'onglet Œuvres est l'onglet actif ── */
function _oeuvresTabActif() {
  var el = document.getElementById('vue-oeuvres');
  return !!(el && el.classList.contains('active'));
}
