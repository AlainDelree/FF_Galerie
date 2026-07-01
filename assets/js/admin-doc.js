/* admin-doc.js — Onglet Documentation (hub de docs Markdown)
 * Source : docs/aide/index.json + fichiers .md.
 * Rendu Markdown intégré (sans dépendance) ; PDF via html2pdf.js (à la demande).
 * Impression via feuille @media print (isolation de #doc-reader).
 */
(function () {
  /* Les .md/.json sont lus depuis raw.githubusercontent.com (fichiers bruts du
     dépôt public) : Cloudflare (dev) ne sert pas les .md et GitHub Pages (prod)
     peut les transformer via Jekyll — raw contourne les deux, sur dev ET prod.
     REPO et BRANCH sont des globals définis dans admin.js (chargé avant). */
  function rawBase() {
    var repo = (typeof REPO !== 'undefined' && REPO) ? REPO : 'AlainDelree/FF_Galerie';
    var br   = (typeof BRANCH !== 'undefined' && BRANCH) ? BRANCH : 'main';
    return 'https://raw.githubusercontent.com/' + repo + '/' + br + '/docs/aide/';
  }
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
  function ensureH2P() {
    if (window.html2pdf) return Promise.resolve();
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  }

  /* Convertisseur Markdown → HTML intégré (sous-ensemble utilisé par nos docs :
     titres #/##/###, gras **, italique * ou _, code `, liens, images, citations >,
     listes - et 1., règles ---, paragraphes). Aucune dépendance externe. */
  function mdToHtml(md) {
    function e(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function inline(s) {
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, a, u) { return '<img alt="' + a + '" src="' + u + '" style="max-width:400px;height:auto;display:block;margin:1rem 0">'; });
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; });
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
      s = s.replace(/(^|[^\w])_([^_]+)_/g, '$1<em>$2</em>');
      return s;
    }
    var lines = String(md).replace(/\r\n/g, '\n').split('\n');
    var out = [], i = 0, inUl = false, inOl = false;
    function closeLists() { if (inUl) { out.push('</ul>'); inUl = false; } if (inOl) { out.push('</ol>'); inOl = false; } }
    while (i < lines.length) {
      var raw = lines[i];
      if (/^\s*$/.test(raw)) { closeLists(); i++; continue; }
      if (/^---+\s*$/.test(raw)) { closeLists(); out.push('<hr>'); i++; continue; }
      var h = raw.match(/^(#{1,3})\s+(.*)$/);
      if (h) { closeLists(); var lvl = h[1].length; out.push('<h' + lvl + '>' + inline(e(h[2])) + '</h' + lvl + '>'); i++; continue; }
      if (/^\s*>\s?/.test(raw)) { closeLists(); out.push('<blockquote>' + inline(e(raw.replace(/^\s*>\s?/, ''))) + '</blockquote>'); i++; continue; }
      var ul = raw.match(/^\s*[-*]\s+(.*)$/);
      if (ul) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        var li = [e(ul[1])]; i++;
        while (i < lines.length && !/^\s*$/.test(lines[i]) &&
               !/^(#{1,3}\s|\s*>\s?|\s*[-*]\s|\s*\d+\.\s|---+\s*$)/.test(lines[i])) {
          li.push(e(lines[i].trim())); i++;
        }
        out.push('<li>' + inline(li.join(' ')) + '</li>');
        continue;
      }
      var ol = raw.match(/^\s*\d+\.\s+(.*)$/);
      if (ol) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        var lo = [e(ol[1])]; i++;
        while (i < lines.length && !/^\s*$/.test(lines[i]) &&
               !/^(#{1,3}\s|\s*>\s?|\s*[-*]\s|\s*\d+\.\s|---+\s*$)/.test(lines[i])) {
          lo.push(e(lines[i].trim())); i++;
        }
        out.push('<li>' + inline(lo.join(' ')) + '</li>');
        continue;
      }
      closeLists();
      var para = [e(raw)]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,3}\s|\s*>\s?|\s*[-*]\s|\s*\d+\.\s|---+\s*$)/.test(lines[i])) {
        para.push(e(lines[i])); i++;
      }
      out.push('<p>' + inline(para.join('<br>')) + '</p>');
    }
    closeLists();
    return out.join('\n');
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
    return fetch(rawBase() + doc.fichier + "?v=" + Date.now())
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
    fetch(rawBase() + 'index.json?v=' + Date.now())
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
    fetchMd(d)
      .then(function (md) { contenu.innerHTML = mdToHtml(md); })
      .catch(function (err) {
        contenu.innerHTML = '<p style="color:var(--danger);">Erreur de chargement du document (' +
          (err && err.message ? err.message : 'inconnue') + ').</p>';
      });
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
    ensureH2P()
      .then(function () { return fetchMd(d); })
      .then(function (md) {
        var overlay = document.createElement('div');
        overlay.id = 'doc-pdf-overlay';
        var wrap = document.createElement('div');
        wrap.className = 'doc-pdf-page';
        wrap.innerHTML = mdToHtml(md);
        overlay.appendChild(wrap);
        document.body.appendChild(overlay);
        var nettoyer = function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
        var opt = {
          margin: 0,
          filename: (d.id || 'document') + '.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', imageTimeout: 5000, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        };
        return window.html2pdf().set(opt).from(wrap).save()
          .then(nettoyer, function (e) { nettoyer(); throw e; });
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
