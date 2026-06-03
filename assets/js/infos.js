/* FF_Galerie — infos.js
   Config: window.INFOS_DATA_PATH (défaut: 'data/infos.json')
*/

(function(){
  var INFOS_PATH = window.INFOS_DATA_PATH || 'data/infos.json';

    /* ── Rendu des infos depuis infos.json ── */
    fetch(INFOS_PATH)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var wrap = document.getElementById('infosWrap');
        wrap.innerHTML = '';

        /* ── Agenda ── */
        var secEvt = document.createElement('section');
        secEvt.setAttribute('aria-label', 'Agenda et expositions');

        var titEvt = document.createElement('h2');
        titEvt.className = 'section-titre';
        titEvt.textContent = 'Agenda';
        secEvt.appendChild(titEvt);

        var evts = data.evenements || [];
        if (evts.length === 0) {
          var vide = document.createElement('p');
          vide.className = 'vide';
          vide.textContent = 'Aucun événement en cours.';
          secEvt.appendChild(vide);
        } else {
          evts.forEach(function(e){
            var art = document.createElement('article');
            art.className = 'evenement';

            var dateEl = document.createElement('div');
            dateEl.className = 'evt-date';
            dateEl.textContent = e.dateAffichage || '';
            art.appendChild(dateEl);

            var corps = document.createElement('div');
            corps.className = 'evt-corps';

            var titre = document.createElement('h3');
            titre.className = 'evt-titre';
            titre.textContent = e.titre || '';
            corps.appendChild(titre);

            if (e.lieu) {
              var lieu = document.createElement('p');
              lieu.className = 'evt-lieu';
              lieu.textContent = e.lieu;
              corps.appendChild(lieu);
            }
            if (e.description) {
              var desc = document.createElement('p');
              desc.className = 'evt-desc';
              desc.textContent = e.description;
              corps.appendChild(desc);
            }
            if (e.lien) {
              var lien = document.createElement('a');
              lien.className = 'evt-lien';
              lien.href = e.lien;
              lien.target = '_blank';
              lien.rel = 'noopener';
              lien.textContent = 'En savoir plus';
              corps.appendChild(lien);
            }

            art.appendChild(corps);
            secEvt.appendChild(art);
          });
        }
        wrap.appendChild(secEvt);

        /* ── Collègues & liens ── */
        var secCol = document.createElement('section');
        secCol.setAttribute('aria-label', 'Collègues et liens artistiques');

        var titCol = document.createElement('h2');
        titCol.className = 'section-titre';
        titCol.textContent = 'Liens artistiques';
        secCol.appendChild(titCol);

        var cols = data.collegues || [];
        if (cols.length === 0) {
          var vide2 = document.createElement('p');
          vide2.className = 'vide';
          vide2.textContent = 'Aucun lien pour l\'instant.';
          secCol.appendChild(vide2);
        } else {
          var liste = document.createElement('div');
          liste.className = 'collegues-liste';
          cols.forEach(function(c){
            var a = document.createElement('a');
            a.className = 'collegue';
            a.href = c.lien || '#';
            a.target = '_blank';
            a.rel = 'noopener';

            var info = document.createElement('div');
            info.className = 'collegue-info';

            var nom = document.createElement('p');
            nom.className = 'collegue-nom';
            nom.textContent = c.nom || '';
            info.appendChild(nom);

            if (c.description) {
              var desc = document.createElement('p');
              desc.className = 'collegue-desc';
              desc.textContent = c.description;
              info.appendChild(desc);
            }
            a.appendChild(info);

            if (c.type) {
              var type = document.createElement('span');
              type.className = 'collegue-type';
              type.textContent = c.type;
              a.appendChild(type);
            }

            liste.appendChild(a);
          });
          secCol.appendChild(liste);
        }
        wrap.appendChild(secCol);
      })
      .catch(function(){
        document.getElementById('infosWrap').innerHTML =
          '<p class="vide">Impossible de charger les informations.</p>';
      });

    /* Header auto-hide */
    (function(){
      var h = document.querySelector('.entete');
      var t;
      function show(){ h.classList.remove('cache'); clearTimeout(t); t = setTimeout(function(){ h.classList.add('cache'); }, 2500); }
      document.addEventListener('mousemove', function(e){ if(e.clientY < 80) show(); });
      document.addEventListener('touchstart', show, { passive:true });
      t = setTimeout(function(){ h.classList.add('cache'); }, 2500);
    })();


})();
