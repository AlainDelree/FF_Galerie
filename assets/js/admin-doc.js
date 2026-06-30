/* admin-doc.js — Onglet Documentation (hub de docs Markdown)
 * Source : docs/aide/index.json + fichiers .md.
 * Rendu via marked.js (CDN, à la demande) ; PDF via html2pdf.js (à la demande).
 * Impression via feuille @media print (isolation de #doc-reader).
 */
(function () {
  var BASE = 'docs/aide/';
  var _index = null;       /* [{id,fichier,titre,concerne,maj}] */
  var _cacheMd = {};       /* id -> markdown brut */
  var _inited = false;
  var _currentId = null;   /* doc affiché dans le lecteur */

  var CONCERNE = {
    peintres:   { ico: '🎨', lbl: 'Peintres' },
    sculpteurs: { ico: '🗿', lbl: 'Sculpteurs' },
    tous:       { ico: '👥', lbl: 'Tous' }
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('Chargement échoué : ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureMarked() {
    if (window.marked) return Promise.resolve();
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/marked/16.3.0/lib/marked.umd.min.js');
  }
  function ensureH2P() {
    if (window.html2pdf) return Promise.resolve();
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : s); return d.innerHTML; }

  function fmtDate(s) {
    if (!s) return '—';
    var p = String(s).split('-');
    return (p.length === 3) ? (p[2] + '/' + p[1] + '/' + p[0]) : s;
  }

  /* Estimation automatique du nombre de pages : ~450 mots/page + ~0,5 page/image. */
  function estimePages(md) {
    if (!md) return 1;
    var sansImg = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    var mots = (sansImg.trim().match(/\S+/g) || []).length;
    var imgs = (md.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
    return Math.max(1, Math.ceil(mots / 450 + imgs * 0.5));
  }

  function fetchMd(doc) {
    if (_cacheMd[doc.id] != null) return Promise.resolve(_cacheMd[doc.id]);
    return fetch(BASE + doc.fichier + '?v=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { _cacheMd[doc.id] = t; return t; });
  }

  function _docById(id) { return (_index || []).find(function (d) { return d.id === id; }); }

  /* ── Initialisation (au premier affichage de l'onglet) ── */
  function initDocTab() {
    if (_inited) return;
    _inited = true;
    var statut = document.getElementById('doc-statut');
    if (statut) statut.textContent = 'Chargement…';
    fetch(BASE + 'index.json?v=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        _index = (j && j.docs) || [];
        return Promise.all(_index.map(function (d) { return fetchMd(d).catch(function () { return ''; }); }));
      })
      .then(function () { rendreListe(); if (statut) statut.textContent = ''; })
      .catch(function () {
        _inited = false; /* permettre une nouvelle tentative */
        if (statut) statut.textContent = 'Impossible de charger la documentation.';
      });
  }

  /* ── Rendu de la liste (tableau desktop + cartes mobile) ── */
  function rendreListe() {
    var corps = document.getElementById('doc-liste-corps');
    var cards = document.getElementById('doc-cards');
    if (corps) corps.innerHTML = '';
    if (cards) cards.innerHTML = '';

    _index.forEach(function (d) {
      var c = CONCERNE[d.concerne] || CONCERNE.tous;
      var pages = estimePages(_cacheMd[d.id]);
      var pagesTxt = '≈ ' + pages + ' p.';

      if (corps) {
        var tr = document.createElement('tr');
        tr.className = 'doc-row';
        tr.innerHTML =
          '<td class="doc-nom" data-lire="' + d.id + '">' + esc(d.titre) + '</td>' +
          '<td class="doc-concerne">' + c.ico + ' ' + c.lbl + '</td>' +
          '<td class="doc-pages" title="environ ' + pages + ' pages">' + pagesTxt + '</td>' +
          '<td class="doc-maj">' + fmtDate(d.maj) + '</td>' +
          '<td class="doc-act"><button class="doc-ico-btn" data-pdf="' + d.id + '" title="Télécharger en PDF">📥</button></td>' +
          '<td class="doc-act"><button class="doc-ico-btn" data-print="' + d.id + '" title="Imprimer">🖨</button></td>';
        corps.appendChild(tr);
      }

      if (cards) {
        var card = document.createElement('div');
        card.className = 'doc-card';
        card.innerHTML =
          '<div class="doc-card-titre" data-lire="' + d.id + '">' + esc(d.titre) + '</div>' +
          '<div class="doc-card-meta">' + c.ico + ' ' + c.lbl + ' · ' + pagesTxt + ' · maj ' + fmtDate(d.maj) + '</div>' +
          '<div class="doc-card-act">' +
            '<button class="doc-btn-lire" data-lire="' + d.id + '">Lire</button>' +
            '<button class="doc-ico-btn" data-pdf="' + d.id + '" title="Télécharger en PDF">📥</button>' +
            '<button class="doc-ico-btn" data-print="' + d.id + '" title="Imprimer">🖨</button>' +
          '</div>';
        cards.appendChild(card);
      }
    });

    var zone = document.getElementById('vue-doc');
    zone.querySelectorAll('[data-lire]').forEach(function (b) { b.addEventListener('click', function () { ouvrirDoc(b.getAttribute('data-lire')); }); });
    zone.querySelectorAll('[data-pdf]').forEach(function (b) { b.addEventListener('click', function () { telechargerPdf(b.getAttribute('data-pdf')); }); });
    zone.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { imprimerDoc(b.getAttribute('data-print')); }); });
  }

  /* ── Lecture d'un doc ── */
  function ouvrirDoc(id) {
    var d = _docById(id);
    if (!d) return;
    _currentId = id;
    var reader = document.getElementById('doc-reader');
    var liste = document.getElementById('doc-liste');
    var contenu = document.getElementById('doc-contenu');
    document.getElementById('doc-reader-titre').textContent = d.titre;
    contenu.innerHTML = '<p style="color:var(--muted);">Chargement…</p>';
    liste.style.display = 'none';
    reader.style.display = '';
    var rb = document.querySelector('#vue-doc');
    if (rb) rb.scrollTop = 0;
    ensureMarked()
      .then(function () { return fetchMd(d); })
      .then(function (md) { contenu.innerHTML = window.marked.parse(md); })
      .catch(function () { contenu.innerHTML = '<p>Erreur de chargement du document.</p>'; });
  }

  function fermerReader() {
    document.getElementById('doc-reader').style.display = 'none';
    document.getElementById('doc-liste').style.display = '';
    _currentId = null;
  }

  /* ── Impression (ouvre le doc, attend les images, puis window.print) ── */
  function _attendreImagesPuis(contenu, cb) {
    var imgs = contenu.querySelectorAll('img');
    var reste = imgs.length;
    if (!reste) { cb(); return; }
    imgs.forEach(function (im) {
      if (im.complete) { if (--reste === 0) cb(); }
      else {
        im.addEventListener('load', function () { if (--reste === 0) cb(); });
        im.addEventListener('error', function () { if (--reste === 0) cb(); });
      }
    });
  }
  function imprimerDoc(id) {
    ouvrirDoc(id);
    var contenu = document.getElementById('doc-contenu');
    /* petit délai pour laisser le markdown se rendre, puis attendre les images */
    setTimeout(function () { _attendreImagesPuis(contenu, function () { window.print(); }); }, 300);
  }

  /* ── Téléchargement PDF (un clic, via html2pdf.js) ── */
  function telechargerPdf(id) {
    var d = _docById(id);
    if (!d) return;
    if (typeof toast === 'function') toast('Préparation du PDF…');
    Promise.all([ensureMarked(), ensureH2P()])
      .then(function () { return fetchMd(d); })
      .then(function (md) {
        var wrap = document.createElement('div');
        wrap.className = 'doc-pdf-page';
        wrap.innerHTML = '<h1 class="doc-pdf-h1">' + esc(d.titre) + '</h1>' + window.marked.parse(md);
        document.body.appendChild(wrap);
        var opt = {
          margin: [12, 12, 16, 12],
          filename: (d.id || 'document') + '.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        return window.html2pdf().set(opt).from(wrap).save()
          .then(function () { document.body.removeChild(wrap); });
      })
      .catch(function (e) { if (typeof toast === 'function') toast('Échec PDF : ' + (e.message || e), 'err'); });
  }

  /* ── Listeners statiques du lecteur ── */
  (function attach() {
    var back = document.getElementById('btn-doc-retour');
    if (back) back.addEventListener('click', fermerReader);
    var pr = document.getElementById('btn-doc-print');
    if (pr) pr.addEventListener('click', function () {
      var contenu = document.getElementById('doc-contenu');
      _attendreImagesPuis(contenu, function () { window.print(); });
    });
    var pdf = document.getElementById('btn-doc-pdf');
    if (pdf) pdf.addEventListener('click', function () { if (_currentId) telechargerPdf(_currentId); });
  })();

  /* Expose + déclenche l'init à l'ouverture de l'onglet */
  window.initDocTab = initDocTab;
  var onglet = document.querySelector('[data-vue="vue-doc"]');
  if (onglet) onglet.addEventListener('click', initDocTab);
})();
