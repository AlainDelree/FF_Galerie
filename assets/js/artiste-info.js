/* artiste-info.js — met à jour nom/logo/titre depuis artistes.json
   Appelé sur toutes les pages d'un artiste invité.
   Aucune variable de config nécessaire : l'id est lu dans l'URL. */
(function () {
  var id = (location.pathname.match(/\/artistes\/([^\/]+)\//) || [])[1];
  if (!id) return;

  fetch('../../data/artistes.json?v=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (artistes) {
      var a = artistes.find(function (x) { return x.id === id; });
      if (!a) return;

      /* Nom de l'artiste */
      document.querySelectorAll('.nom-artiste').forEach(function (el) {
        el.textContent = a.nom;
      });
      /* Signature (initiales) */
      document.querySelectorAll('.signature-artiste').forEach(function (el) {
        el.textContent = a.logo;
      });
      /* Mentions copyright */
      document.querySelectorAll('.mention').forEach(function (el) {
        if (el.textContent.includes('\u00a9') || el.textContent.includes('©')) {
          el.textContent = '\u00a9\u00a0' + a.nom;
        }
      });
      /* Titre de l'onglet */
      if (document.title && a.nom) {
        document.title = document.title.replace(/^[^\u2014—]+/, a.nom + ' ');
      }
      /* Bandeau "Invité·e de" */
      var invite = a.genre === 'm' ? 'Invité' : a.genre === 'n' ? 'Invité·e' : 'Invitée';
      var bandeau = document.querySelector('.bandeau-invite');
      if (bandeau) {
        var lien = bandeau.querySelector('a');
        if (lien) bandeau.innerHTML = invite + ' de ' + lien.outerHTML;
      }
    })
    .catch(function () {});
})();
