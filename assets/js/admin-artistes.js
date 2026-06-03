/* admin-artistes.js — peuple le <select> artiste sur l'écran login
   Charge data/artistes.json (tous, y compris draft) */
(function () {
  var sel = document.getElementById("sel-artiste");
  if (!sel) return;

  fetch("data/artistes.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (artistes) {
      artistes.forEach(function (a) {
        var opt = document.createElement("option");
        opt.value = a.lien;
        opt.textContent = a.nom + (a.draft ? " (en préparation)" : "");
        sel.appendChild(opt);
      });
    })
    .catch(function () {});
})();
