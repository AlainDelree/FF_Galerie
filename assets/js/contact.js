/* FF_Galerie — contact.js */

(function(){
    /* Anti-spam : reconstruit l'adresse mail depuis les data-attributes */
    (function () {
      var a = document.querySelector('.lien-email');
      var email = a.dataset.u + '\u0040' + a.dataset.d;
      a.href = 'mailto:' + email;
      a.textContent = email;

      /* Bouton copier */
      var btn = document.getElementById('btnCopier');
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(email).then(function () {
          btn.classList.add('copie-active');
          setTimeout(function () { btn.classList.remove('copie-active'); }, 1800);
        }).catch(function () {
          /* Fallback si clipboard API indisponible */
          var ta = document.createElement('textarea');
          ta.value = email;
          ta.style.cssText = 'position:fixed;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.classList.add('copie-active');
          setTimeout(function () { btn.classList.remove('copie-active'); }, 1800);
        });
      });
    })();

    /* Header auto-hide */
    (function () {
      var h = document.querySelector('.entete');
      var t;
      function show() { h.classList.remove('cache'); clearTimeout(t); t = setTimeout(function () { h.classList.add('cache'); }, 2500); }
      document.addEventListener('mousemove', function (e) { if (e.clientY < 80) show(); });
      document.addEventListener('touchstart', show, { passive: true });
      t = setTimeout(function () { h.classList.add('cache'); }, 2500);
    })();


})();
