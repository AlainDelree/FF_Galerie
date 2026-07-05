/* =============================================================
   FF_Galerie — plan.js  (plan SVG + header auto-hide)
   Config :
     window.PLAN_SALLES_PATH  (défaut: 'data/salles.json')
     window.PLAN_GALERIE_PATH (défaut: 'galerie.html')
   ============================================================= */

(function(){
  var SALLES_PATH  = window.PLAN_SALLES_PATH  || 'data/salles.json';
  var GALERIE_PATH = window.PLAN_GALERIE_PATH || 'galerie.html';

    fetch(SALLES_PATH + '?v=' + Date.now())
      .then(r => r.json())
      .then(data => {
        /* Filtre visibilite : le plan SVG ne montre que les salles visibles
           (visible !== false), coherent avec la galerie publique. */
        const salles = (data.salles || []).filter(s => s.nom && s.visible !== false);
        if (!salles.length) return;

        const ROOM_W=155, ROOM_H=95, H_GAP=60, V_GAP=40, M=15, DOOR=36;
        const COLS = salles.length === 1 ? 1 : 2;
        const ROWS = Math.ceil(salles.length / COLS);
        const W = M*2 + COLS*ROOM_W + (COLS-1)*H_GAP;
        const H = M*2 + ROWS*ROOM_H + (ROWS-1)*V_GAP;

        const p = [];

        // Couloirs horizontaux entre rangées
        for (let r=0; r<ROWS-1; r++) {
          const cy = M + r*(ROOM_H+V_GAP) + ROOM_H;
          p.push('<rect class="plan-couloir" x="'+M+'" y="'+cy+'" width="'+(W-2*M)+'" height="'+V_GAP+'"/>');
        }

        salles.forEach((salle, i) => {
          const col = COLS===1 ? 0 : i%COLS;
          const row = Math.floor(i/COLS);
          // Centre la dernière salle si impaire
          const isLast = i===salles.length-1;
          const isOddLast = isLast && salles.length%2===1 && COLS===2;
          const rx = isOddLast ? (W-ROOM_W)/2 : M + col*(ROOM_W+H_GAP);
          const ry = M + row*(ROOM_H+V_GAP);
          const doorX = rx + Math.floor((ROOM_W-DOOR)/2);
          const hasTop = row > 0;
          const hasBot = row < ROWS-1;

          // Salle (visuel)
          p.push('<rect class="plan-salle" x="'+rx+'" y="'+ry+'" width="'+ROOM_W+'" height="'+ROOM_H+'" rx="1"/>');

          // Mur haut
          if (hasTop) {
            p.push('<line class="plan-mur" x1="'+rx+'" y1="'+ry+'" x2="'+doorX+'" y2="'+ry+'"/>');
            p.push('<line class="plan-mur" x1="'+(doorX+DOOR)+'" y1="'+ry+'" x2="'+(rx+ROOM_W)+'" y2="'+ry+'"/>');
          } else {
            p.push('<line class="plan-mur" x1="'+rx+'" y1="'+ry+'" x2="'+(rx+ROOM_W)+'" y2="'+ry+'"/>');
          }
          // Mur bas
          const by = ry+ROOM_H;
          if (hasBot) {
            p.push('<line class="plan-mur" x1="'+rx+'" y1="'+by+'" x2="'+doorX+'" y2="'+by+'"/>');
            p.push('<line class="plan-mur" x1="'+(doorX+DOOR)+'" y1="'+by+'" x2="'+(rx+ROOM_W)+'" y2="'+by+'"/>');
          } else {
            p.push('<line class="plan-mur" x1="'+rx+'" y1="'+by+'" x2="'+(rx+ROOM_W)+'" y2="'+by+'"/>');
          }
          // Murs gauche et droit
          p.push('<line class="plan-mur" x1="'+rx+'" y1="'+ry+'" x2="'+rx+'" y2="'+by+'"/>');
          p.push('<line class="plan-mur" x1="'+(rx+ROOM_W)+'" y1="'+ry+'" x2="'+(rx+ROOM_W)+'" y2="'+by+'"/>');

          // Arc porte bas
          if (hasBot) {
            p.push('<line class="plan-porte" x1="'+(doorX+DOOR)+'" y1="'+by+'" x2="'+(doorX+DOOR)+'" y2="'+(by-DOOR)+'"/>');
            p.push('<path class="plan-porte" d="M '+doorX+','+by+' A '+DOOR+','+DOOR+' 0 0,0 '+(doorX+DOOR)+','+(by-DOOR)+'"/>');
          }
          // Arc porte haut
          if (hasTop) {
            p.push('<line class="plan-porte" x1="'+(doorX+DOOR)+'" y1="'+ry+'" x2="'+(doorX+DOOR)+'" y2="'+(ry+DOOR)+'"/>');
            p.push('<path class="plan-porte" d="M '+doorX+','+ry+' A '+DOOR+','+DOOR+' 0 0,1 '+(doorX+DOOR)+','+(ry+DOOR)+'"/>');
          }

          // Toiles décoratives
          const nb = (salle.toiles||[]).length;
          if (nb>0) {
            for (let t=0;t<Math.min(2,nb);t++) p.push('<rect class="plan-toile" x="'+(rx+40+t*50)+'" y="'+ry+'" width="16" height="5"/>');
            p.push('<rect class="plan-toile" x="'+rx+'" y="'+(ry+35)+'" width="5" height="14"/>');
            p.push('<rect class="plan-toile" x="'+(rx+ROOM_W-5)+'" y="'+(ry+35)+'" width="5" height="14"/>');
          }

          // Label
          const lx = rx+ROOM_W/2, ly = ry+ROOM_H/2+5;
          p.push('<text class="plan-label" x="'+lx+'" y="'+ly+'">'+salle.nom+'</text>');
          p.push('<text class="plan-count" x="'+lx+'" y="'+(ly+14)+'">'+nb+' toile'+(nb!==1?'s':'')+'</text>');

          // Zone cliquable transparente, au-dessus (navigation JS, fiable en PWA)
          p.push('<rect class="plan-hit" data-salle="'+salle.id+'" x="'+rx+'" y="'+ry+'" width="'+ROOM_W+'" height="'+ROOM_H+'" fill="transparent" style="cursor:pointer"/>');
        });

        const svg = '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plan de la galerie">'+p.join('')+'</svg>';
        const wrap = document.getElementById('plan-svg-wrap');
        if (wrap) {
          wrap.innerHTML = svg;
          wrap.addEventListener('click', function (ev) {
            var t = ev.target, id = null;
            if (t && t.getAttribute) id = t.getAttribute('data-salle');
            if (!id && t && t.closest) {
              var c = t.closest('[data-salle]');
              if (c) id = c.getAttribute('data-salle');
            }
            if (id) window.location.href = GALERIE_PATH + '#salle-' + id;
          });
        }

        /* Préchargement des toiles pendant que l'utilisateur consulte le plan */
        const toilesPath = window.PLAN_TOILES_PATH || 'data/toiles.json';
        const assetsBase = window.GALERIE_ASSETS_BASE || '';
        fetch(toilesPath + '?v=' + Date.now())
          .then(function(r) { return r.json(); })
          .then(function(td) {
            (td.toiles || []).forEach(function(t) {
              if (!t.photo) return;
              var img = new Image();
              img.src = /^https?:\/\//.test(t.photo) ? t.photo : assetsBase + t.photo;
            });
          })
          .catch(function() {});
      })
      .catch(() => {});

  /* Header auto-hide */
      var h = document.querySelector('.entete');
      var timer;
      function show(){ h.classList.remove('cache'); clearTimeout(timer); timer = setTimeout(function(){ h.classList.add('cache'); }, 2500); }
      document.addEventListener('mousemove', function(e){ if(e.clientY < 80) show(); });
      document.addEventListener('touchstart', show);
      timer = setTimeout(function(){ h.classList.add('cache'); }, 2500);
})();
