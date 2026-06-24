/* admin-oeuvres.js — Onglet gestion des œuvres / pièces
 * Inventaire global : liste, ajout, modification, suppression, catalogue
 * Utilise listeOeuvres() (admin-liste.js) en mode sélection.
 */

var _oeuvresSelection = new Set(); /* au plus 1 id sélectionné */

/* ── Initialisation (appelée après chargement de tous les modules) ── */
function initOeuvresTab() {
  /* Label adaptatif "Toiles" / "Pièces" sur l'onglet */
  var ongletEl = document.getElementById('onglet-oeuvres');
  if (ongletEl && typeof LBL !== 'undefined') ongletEl.textContent = LBL.Items;

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
}

/* ── Affichage de la liste ── */
function afficherOeuvres() {
  var container = document.getElementById('oeuvres-list');
  if (!container) return;

  listeOeuvres({
    container:  container,
    filtre:     'toutes',
    salleRef:   null,          /* inventaire global — pas de salle de référence */
    vue:        'pc',
    tri:        'titre',
    mode:       'selection',  /* active les handlers de clic */
    legendes:   ['salle', 'taille'],
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
      /* Ouverture directe du formulaire d'édition (plus de bouton Modifier
         intermédiaire). Sur PC large, le formulaire s'affiche en panneau
         de droite via CSS responsive ; sur GSM il reste en plein écran. */
      if (typeof ouvrirFormulaireEdition === 'function') ouvrirFormulaireEdition(id);
    },
    onDblClick: function(id) {
      if (typeof ouvrirFormulaireEdition === 'function') ouvrirFormulaireEdition(id);
    }
  });

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
