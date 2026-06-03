/* FF_Galerie — contact.js
   Config : window.CONTACT_DATA_PATH (défaut: 'data/contact.json') */

(function () {

  var PATH = window.CONTACT_DATA_PATH || 'data/contact.json';

  var RESEAUX = [
    { id: 'instagram', label: 'Instagram',  icon: '📸' },
    { id: 'facebook',  label: 'Facebook',   icon: '👤' },
    { id: 'tiktok',    label: 'TikTok',     icon: '🎵' },
    { id: 'pinterest', label: 'Pinterest',  icon: '📌' },
    { id: 'youtube',   label: 'YouTube',    icon: '▶' },
    { id: 'twitter',   label: 'X / Twitter',icon: '🐦' },
    { id: 'linkedin',  label: 'LinkedIn',   icon: '💼' },
    { id: 'site',      label: 'Site web',   icon: '🌐' }
  ];

  function rendrePage(data) {
    var bloc = document.querySelector('.contact-bloc');
    if (!bloc) return;
    bloc.innerHTML = '';

    /* Email */
    if (data.email) {
      var parts = data.email.split('@');
      var u = parts[0], d = parts[1] || '';
      bloc.innerHTML += '<div class="contact-item">' +
        '<span class="contact-label">📧 Courrier électronique</span>' +
        '<div class="contact-email-wrap">' +
          '<a class="lien-email" href="mailto:' + data.email + '">' + data.email + '</a>' +
          '<button class="btn-copier" id="btnCopier" title="Copier">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '<span class="copie-ok">Copié !</span>' +
          '</button>' +
        '</div></div>';
      /* bouton copier */
      setTimeout(function () {
        var btn = document.getElementById('btnCopier');
        if (btn) btn.addEventListener('click', function () {
          navigator.clipboard.writeText(data.email).then(function () {
            btn.classList.add('copie-active');
            setTimeout(function () { btn.classList.remove('copie-active'); }, 1800);
          });
        });
      }, 0);
    }

    /* Téléphone */
    if (data.telephone) {
      bloc.innerHTML += '<div class="contact-item">' +
        '<span class="contact-label">📞 Téléphone</span>' +
        '<a class="lien-email" href="tel:' + data.telephone.replace(/\s/g,'') + '">' + data.telephone + '</a>' +
        '</div>';
    }

    /* Réseaux sociaux */
    var reseauxHTML = '';
    RESEAUX.forEach(function (r) {
      var url = data[r.id];
      if (!url) return;
      /* Accepter username ou URL complète */
      if (url.indexOf('http') !== 0) url = 'https://' + r.id + '.com/' + url;
      reseauxHTML += '<div class="contact-item">' +
        '<span class="contact-label">' + r.icon + ' ' + r.label + '</span>' +
        '<a class="lien-email" href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' +
        '</div>';
    });
    if (reseauxHTML) {
      bloc.innerHTML += '<div class="contact-sep" style="border-top:1px solid rgba(255,255,255,.08);margin:.8rem 0;"></div>' + reseauxHTML;
    }

    if (!bloc.innerHTML) {
      bloc.innerHTML = '<p style="color:var(--text-doux);font-style:italic;font-size:.85rem;">Aucune information de contact disponible.</p>';
    }
  }

  /* Chargement */
  fetch(PATH + '?v=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(rendrePage)
    .catch(function () {
      /* Fallback : lire les data-attributes du lien email si présent */
      var a = document.querySelector('.lien-email');
      if (a && a.dataset.u) {
        var email = a.dataset.u + '\u0040' + a.dataset.d;
        a.href = 'mailto:' + email;
        a.textContent = email;
      }
    });

  /* Header auto-hide */
  (function () {
    var h = document.querySelector('.entete');
    if (!h) return;
    var t;
    function show() { h.classList.remove('cache'); clearTimeout(t); t = setTimeout(function () { h.classList.add('cache'); }, 2500); }
    document.addEventListener('mousemove', function (e) { if (e.clientY < 80) show(); });
    document.addEventListener('touchstart', show, { passive: true });
    t = setTimeout(function () { h.classList.add('cache'); }, 2500);
  })();

})();
