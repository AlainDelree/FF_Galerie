/* nav-artistes.js — dropdown Artistes invités
   Nécessite window.ARTISTES_JSON_PATH défini avant ce script
   et un bloc nav avec id="nav-artistes" + id="sep-artistes" */
(function () {
  var path = window.ARTISTES_JSON_PATH || "data/artistes.json";
  var urlPreview = new URLSearchParams(window.location.search).get("preview") === "boss";
  if (urlPreview) sessionStorage.setItem("ff_boss_preview", "1");
  var isPreview = urlPreview || sessionStorage.getItem("ff_boss_preview") === "1";

  fetch(path + "?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (artistes) {
      var visibles = artistes.filter(function (a) { return !a.draft || isPreview; });
      if (!visibles.length) return;

      var sep  = document.getElementById("sep-artistes");
      var nav  = document.getElementById("nav-artistes");
      var menu = document.getElementById("nav-artistes-menu");
      if (!nav || !menu) return;

      visibles.forEach(function (a) {
        var link = document.createElement("a");
        link.href = a.lien;
        link.textContent = a.nom;
        menu.appendChild(link);
      });

      if (sep) sep.style.display = "";
      nav.style.display = "";

      /* Toggle au clic */
      var trigger = nav.querySelector(".nav-dropdown-trigger");
      if (trigger) {
        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          nav.classList.toggle("open");
        });
      }
      document.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    })
    .catch(function () {});
})();
