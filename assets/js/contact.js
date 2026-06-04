/* FF_Galerie — contact.js
   Config : window.CONTACT_DATA_PATH (défaut: 'data/contact.json') */

(function () {

  var PATH = window.CONTACT_DATA_PATH || 'data/contact.json';

  /* ── Icônes SVG minimalistes ── */
  var SVG = {
    instagram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    facebook:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    tiktok:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>',
    pinterest: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.03-2.83.19-.78 1.27-5.37 1.27-5.37s-.32-.65-.32-1.61c0-1.51.87-2.63 1.96-2.63.92 0 1.37.69 1.37 1.53 0 .93-.59 2.32-.9 3.61-.26 1.08.53 1.96 1.59 1.96 1.9 0 3.37-2.01 3.37-4.9 0-2.57-1.84-4.36-4.48-4.36-3.05 0-4.84 2.29-4.84 4.65 0 .92.35 1.9.8 2.44.09.1.1.19.07.3l-.3 1.2c-.05.18-.16.22-.36.13-1.39-.65-2.26-2.68-2.26-4.31 0-3.51 2.55-6.74 7.35-6.74 3.86 0 6.86 2.75 6.86 6.42 0 3.83-2.41 6.9-5.75 6.9-1.12 0-2.18-.58-2.54-1.27l-.69 2.59c-.25.97-.93 2.18-1.38 2.92.04.01.09.01.13.02A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z"/></svg>',
    youtube:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/></svg>',
    twitter:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    linkedin:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
    site:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
  };

  var RESEAUX = [
    { id: 'instagram', label: 'Instagram'   },
    { id: 'facebook',  label: 'Facebook'    },
    { id: 'tiktok',    label: 'TikTok'      },
    { id: 'pinterest', label: 'Pinterest'   },
    { id: 'youtube',   label: 'YouTube'     },
    { id: 'twitter',   label: 'X / Twitter' },
    { id: 'linkedin',  label: 'LinkedIn'    },
    { id: 'site',      label: 'Site web'    }
  ];

  /* Extrait le nom/handle depuis une URL */
  function extraireNom(id, url) {
    try {
      var full = url.indexOf('http') === 0 ? url : 'https://' + url;
      var u    = new URL(full);
      var last = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || '';
      switch (id) {
        case 'instagram': case 'tiktok': case 'twitter':
          return (last.startsWith('@') ? '' : '@') + last;
        case 'youtube':
          return (last.startsWith('@') ? '' : '@') + last;
        case 'site':
          return u.hostname.replace(/^www\./, '');
        default:
          return last || u.hostname;
      }
    } catch(e) { return url; }
  }

  function rendrePage(data) {
    var bloc = document.querySelector('.contact-bloc');
    if (!bloc) return;
    bloc.innerHTML = '';

    /* Email */
    if (data.email) {
      bloc.innerHTML +=
        '<div class="contact-item">' +
          '<span class="contact-label">📧 Courrier électronique</span>' +
          '<div class="contact-email-wrap">' +
            '<a class="lien-email" href="mailto:' + data.email + '">' + data.email + '</a>' +
            '<button class="btn-copier" id="btnCopier" title="Copier">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
              '<span class="copie-ok">Copié !</span>' +
            '</button>' +
          '</div>' +
        '</div>';
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
      bloc.innerHTML +=
        '<div class="contact-item">' +
          '<span class="contact-label">📞 Téléphone</span>' +
          '<a class="lien-email" href="tel:' + data.telephone.replace(/\s/g,'') + '">' + data.telephone + '</a>' +
        '</div>';
    }

    /* Réseaux sociaux — logo + nom, URL cachée */
    var reseauxHTML = '';
    RESEAUX.forEach(function (r) {
      var valeur = data[r.id];
      if (!valeur) return;
      var url = valeur.indexOf('http') === 0 ? valeur : 'https://' + r.id + '.com/' + valeur;
      /* Nom affiché : champ _nom en priorité, sinon extraction auto depuis URL */
      var nom = data[r.id + '_nom'] || extraireNom(r.id, url);
      reseauxHTML +=
        '<div class="contact-item">' +
          '<span class="contact-label reseau-label">' +
            '<span class="reseau-icone">' + (SVG[r.id] || '') + '</span>' +
            r.label +
          '</span>' +
          '<a class="reseau-lien" href="' + url + '" target="_blank" rel="noopener">' + nom + '</a>' +
        '</div>';
    });
    if (reseauxHTML) {
      bloc.innerHTML += '<div class="contact-sep"></div>' + reseauxHTML;
    }

    if (!bloc.innerHTML) {
      bloc.innerHTML = '<p style="color:var(--text-doux);font-style:italic;font-size:.85rem;">Aucune information de contact disponible.</p>';
    }
  }

  fetch(PATH + '?v=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(rendrePage)
    .catch(function () {});

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
