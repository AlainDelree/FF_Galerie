/* =============================================================
   FF_Galerie — galerie-peinture.js
   Rendu galerie peinture — nécessite galerie-core.js chargé avant
   Deux modes : grille (positions admin) + flux (mobile sans positions)
   ============================================================= */

    function creerTableau(toile, H) {
      H = H || 200;
      const dim = toile.dimensions;
      const isMob = window.innerWidth <= 600;
      const maxW = isMob ? Math.floor((document.querySelector('.mur').clientWidth - 44) / 2) - 16 : 99999;
      let W = (dim && dim.largeur && dim.hauteur) ? Math.round(H * dim.largeur / dim.hauteur) : H;
      W = Math.min(W, maxW);
      const art = document.createElement('article');
      art.style.width = (W + (isMob ? 16 : 26)) + 'px';
      art.className = 'tableau';
      art.tabIndex  = 0;
      art.setAttribute('role', 'button');
      art.setAttribute('aria-label', (toile.titre || 'Sans titre') + (toile.date ? ', ' + toile.date : ''));
      const cadre = document.createElement('div');
      cadre.className = 'cadre';
      if (toile.photo) {
        const img = document.createElement('img');
        // Mur : miniature WebP (fallback → JPG original → drap blanc)
        var _srcOrig  = (/^https?:\/\//.test(toile.photo)) ? toile.photo : GALERIE_CFG.assetsBase + toile.photo;
        var _srcThumb = /^https?:\/\//.test(toile.photo) ? toile.photo
                        : (GALERIE_CFG.assetsBase + toile.photo).replace(/\.jpg$/i, '-thumb.webp');
        img.alt      = toile.titre || 'Toile';
        img.loading  = 'lazy';   // AVANT src pour que lazy soit actif dès le chargement
        img.decoding = 'async';
        img.style.width      = W + 'px';
        img.style.height     = H + 'px';
        img.style.objectFit  = 'cover';
        img.style.display    = 'block';
        img.srcset  = _srcThumb + ' 400w, ' + _srcOrig.replace(/\.jpg$/i, '.webp') + ' 1200w';
        img.sizes   = '400px';
        img.onerror = function() {
          if (!this._fbDone) {
            this._fbDone = true; this.loading = 'lazy'; this.srcset = ''; this.src = _srcOrig;
          } else { cadre.replaceChild(creerDrapBlanc(W, H), this); }
        };
        img.src = _srcThumb;     // src en dernier — lazy déjà configuré
        cadre.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.style.width  = W + 'px';
        ph.style.height = H + 'px';
        ph.innerHTML = '<span class="placeholder-num">' + toile.id + '</span><span class="placeholder-txt">Sans photo</span>';
        cadre.appendChild(ph);
      }
      const etiq = document.createElement('div');
      etiq.className = 'etiquette';
      const plaq = document.createElement('div');
      plaq.className = 'plaquette';
      const titreDiv = document.createElement('div');
      titreDiv.className = 'etiquette-titre';
      titreDiv.textContent = toile.titre || '';
      plaq.appendChild(titreDiv);
      if (toile.date) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'etiquette-date';
        dateDiv.textContent = toile.date;
        plaq.appendChild(dateDiv);
      }
      /* Plaquette : largeur max = largeur du cadre (évite la troncature sur mobile) */
      plaq.style.maxWidth = (W + 2) + 'px';
      etiq.appendChild(plaq);
      art.appendChild(cadre);
      art.appendChild(etiq);
      /* Masque la plaquette si ni titre ni date */
      if (!toile.titre && !toile.date) etiq.style.display = 'none';
      const ouvrir = () => ouvrirModal(toile);
      art.addEventListener('click', ouvrir);
      art.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });
      return art;
    }

    Promise.all([
      fetch(GALERIE_CFG.toiles + '?v=' + Date.now()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(GALERIE_CFG.salles + '?v=' + Date.now()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    ])
    .then(([tData, sData]) => {
      const toileMap = {};
      (tData.toiles || []).forEach(t => { toileMap[t.id] = t; });

      // Génère les salles dynamiquement depuis le JSON
      const salles = sData.salles || [];
      TOTAL_SALLES = salles.length;
      // Salle affichée en premier (hash ou salle 1) — utilisée pour fetchpriority
      const _hm = window.location.hash.match(/^#salle-(\d+)$/);
      const _hId = _hm ? parseInt(_hm[1]) : null;
      const prioSalleId = (_hId && salles.some(function(s){ return s.id===_hId; }))
        ? _hId : (salles[0] ? salles[0].id : null);
      // Largeur du conteneur = N salles × 100% de la fenêtre
      conteneur.style.width = (TOTAL_SALLES * 100) + '%';
      salles.forEach(salle => {
        const salleDiv = document.createElement('div');
        salleDiv.className = 'salle';
        salleDiv.id = 'salle' + salle.id;
        // Largeur dynamique : 100/N % du conteneur = toujours 100vw
        salleDiv.style.width = (100 / TOTAL_SALLES) + '%';
        salleDiv.setAttribute('aria-label', salle.nom || ('Salle ' + salle.id));
        const nomEl = document.createElement('p');
        nomEl.className = 'nom-salle';
        nomEl.textContent = salle.nom || ('Salle ' + NOMS_ROMAINS[salle.id - 1]);
        salleDiv.appendChild(nomEl);
        const mur = document.createElement('div');
        mur.className = 'mur';
        mur.id = 'mur' + salle.id;
        salleDiv.appendChild(mur);
        conteneur.appendChild(salleDiv);
      });

      // Crée les portes mode C pour toutes les salles
      salles.forEach((salle, si) => {
        const mur = document.getElementById('mur' + salle.id);
        if (!mur) return;
        ['g','d'].forEach(cote => {
          const p = document.createElement('div');
          p.className = 'porte porte-' + cote + ' invisible';
          p.dataset.murId = si + 1; // index 1-based dans l'ordre d'affichage (pas salle.id)
          p.dataset.cote = cote;
          p.innerHTML = '<span class="porte-nom"></span>' +
            '<div class="porte-forme"><div class="porte-interieur"></div>' +
            '<span class="porte-fleche">'+(cote==='g'?'&#8249;':'&#8250;')+'</span></div>';
          p.addEventListener('click', () => {
            if (p.dataset.cible === 'accueil') { window.location.href=GALERIE_CFG.home; return; }
            const n = parseInt(p.dataset.cible);
            if (n >= 1 && n <= TOTAL_SALLES) allerSalle(n);
          });
          mur.appendChild(p);
        });
      });
      mettreAJourNav();

      salles.forEach(salle => {
        const mur = document.getElementById('mur' + salle.id);
        if (!mur) return;

        // Applique couleur/texture du mur depuis l'admin
        if (salle.couleur_mur) mur.style.backgroundColor = salle.couleur_mur;

        // Détermine la couleur et l'épaisseur des cadres
        const couleurCadres  = salle.couleur_cadres  || '#3a3a3a';
        const epaisseurCadres = salle.epaisseur_cadres || 2;

        const positions = salle.positions || [];
        const toilesSalle = (salle.toiles || []).map(id => toileMap[id]).filter(Boolean);
        const salleIdx = salles.indexOf(salle) + 1; // index d'affichage 1-based

        // Salle vide (ni positions ni toiles) : afficher quand même le plancher
        if (!toilesSalle.length && !positions.length) {
          mur.classList.add('mur-grille');
          const salleEl = mur.closest('.salle');
          if (salleEl) salleEl.classList.add('salle-grille');
          const plancher = creerPlancher(salleIdx, salles.length, salles, NOMS_ROMAINS, salle.couleur_mur);
          if (salleEl) salleEl.appendChild(plancher);
          return;
        }
        if (!toilesSalle.length) return;

        // ── MODE GRILLE (positions définies dans l'admin) ──────────
        if (positions.length > 0) {
          const toilesPosees = positions.map(p => toileMap[p.id]).filter(Boolean);
          if (!toilesPosees.length) return;

          // Supprime les vieilles portes latérales (remplacées par zone-basse)
          mur.querySelectorAll('.porte').forEach(p => p.remove());
          // Active la classe grille sur le mur et la salle
          mur.classList.add('mur-grille');
          const salleEl = mur.closest('.salle');
          if (salleEl) salleEl.classList.add('salle-grille');

          // Texture du mur
          const textures = {
            tissu: 'repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 4px)',
            bois:  'repeating-linear-gradient(rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 3px)',
            pierre:'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 0,transparent 6px)',
            damier:'repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/8px 8px',
            parquet:'repeating-linear-gradient(90deg,rgba(74,56,40,.5) 0,rgba(74,56,40,.5) 2px,rgba(58,40,24,.5) 0,rgba(58,40,24,.5) 8px)',
            velours:'radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px) 0 0/5px 5px',
            brique: 'repeating-conic-gradient(rgba(0,0,0,.08) 0% 25%,rgba(255,255,255,.03) 0% 50%) 0 0/8px 8px'
          };
          if (salle.texture && salle.texture !== 'none') {
            if (textures[salle.texture]) {
              /* Texture CSS (tissu, bois, pierre…) */
              mur.style.background = textures[salle.texture] + ', ' + (salle.couleur_mur || '#2e2e2e');
            } else if (/\.(jpg|jpeg|png|webp)$/i.test(salle.texture)) {
              /* Texture image — préfixe assetsBase pour les galeries en sous-dossier */
              var texUrl = GALERIE_CFG.assetsBase + salle.texture;
              mur.style.background = 'url("' + texUrl + '") center/cover, ' + (salle.couleur_mur || '#2e2e2e');
              mur.style.backgroundBlendMode = 'multiply';
            }
          }

          // Place chaque toile selon sa position dans la grille
          positions.forEach(p => {
            const t = toileMap[p.id]; if (!t) return;
            const art = document.createElement('article');
            art.className = 'tableau-grille';
            art.style.gridColumn = `${p.col} / span ${p.w}`;
            art.style.gridRow    = `${p.row} / span ${p.h}`;
            art.tabIndex = 0;
            art.setAttribute('role', 'button');
            art.setAttribute('aria-label', t.titre || 'Toile');

            const cadre = document.createElement('div');
            cadre.className = 'cadre-grille';
            cadre.style.border = `${epaisseurCadres}px solid ${couleurCadres}`;
            cadre.style.boxShadow = `0 0 0 1px rgba(0,0,0,.5), 2px 4px 14px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)`;

            if (t.photo) {
              const img = document.createElement('img');
              // Mur desktop : miniature WebP (fallback → JPG original → drap blanc)
              var _srcOrigD  = (/^https?:\/\//.test(t.photo)) ? t.photo : GALERIE_CFG.assetsBase + t.photo;
              var _srcThumbD = /^https?:\/\//.test(t.photo) ? t.photo
                               : (GALERIE_CFG.assetsBase + t.photo).replace(/\.jpg$/i, '-thumb.webp');
              img.alt      = t.titre || '';
              img.loading  = 'lazy';    // AVANT src
              img.decoding = 'async';
              if (salle.id === prioSalleId) img.fetchPriority = 'high';
              img.srcset  = _srcThumbD + ' 400w, ' + _srcOrigD.replace(/\.jpg$/i, '.webp') + ' 1200w';
              img.sizes   = '400px';
              img.onerror = function() {
                if (!this._fbDone) {
                  this._fbDone = true; this.loading = 'lazy'; this.srcset = ''; this.src = _srcOrigD;
                } else {
                  const drap = creerDrapBlanc(); drap.style.position = 'absolute'; drap.style.inset = '0';
                  cadre.replaceChild(drap, this);
                }
              };
              img.src = _srcThumbD;    // src en dernier
              cadre.appendChild(img);
            } else {
              cadre.style.background = 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(0,0,0,.1))';
            }

            if (t.titre) {
              const lbl = document.createElement('div');
              lbl.className = 'tg-titre';
              lbl.textContent = t.titre;
              cadre.appendChild(lbl);
            }

            art.appendChild(cadre);
            const ouvrir = () => ouvrirModal(t);
            art.addEventListener('click', ouvrir);
            art.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();ouvrir();} });
            mur.appendChild(art);
          });

          // Ajoute le plancher avec silhouettes et portes
          const plancher = creerPlancher(salleIdx, salles.length, salles, NOMS_ROMAINS, salle.couleur_mur);
          const salleElPl = mur.closest('.salle');
          if (salleElPl) salleElPl.appendChild(plancher);

        } else {
          // ── MODE FLUX (pas de positions → comportement original) ──
          const isMobile = window.innerWidth <= 600;
          const H_PREF = isMobile ? 155 : 200, H_FALLBACK = isMobile ? 120 : 160;
          const BORD = isMobile ? 16 : 26, N = isMobile ? 2 : toilesSalle.length;
          const cs = getComputedStyle(mur);
          const gapPx = parseFloat(cs.gap) || (isMobile ? 6 : 32);
          const padL  = parseFloat(cs.paddingLeft)  || (isMobile ? 8 : 40);
          const padR  = parseFloat(cs.paddingRight) || (isMobile ? 8 : 40);
          const dispo  = mur.clientWidth - padL - padR - (N-1)*gapPx - N*BORD;
          const totalW = toilesSalle.slice(0,N).reduce((s,t) => {
            const d = t.dimensions;
            return s + (d && d.largeur && d.hauteur ? Math.round(H_PREF*d.largeur/d.hauteur) : H_PREF);
          }, 0);
          const H = totalW <= dispo ? H_PREF : H_FALLBACK;
          toilesSalle.forEach(t => {
            const el = creerTableau(t, H);
            el.style.borderColor = couleurCadres;
            mur.appendChild(el);
          });
        }
      });

      // ── Navigation depuis Accueil : hash #salle-ID → index d'affichage ──
      // Doit être ici car salles[] et TOTAL_SALLES sont disponibles seulement après chargement JSON
      const hashId = parseInt((window.location.hash.match(/^#salle-(\d+)$/) || [])[1]);
      if (hashId) {
        // Cherche l'index d'affichage (1-based) de la salle ayant cet id JSON
        const hashIdx = salles.findIndex(function(s) { return s.id === hashId; }) + 1;
        const cible = hashIdx > 0 ? hashIdx : 1; // fallback salle 1 si id inconnu
        conteneur.style.transition = "none";
        allerSalle(cible);
        conteneur.getBoundingClientRect(); // force reflow
        requestAnimationFrame(function() { requestAnimationFrame(function() {
          conteneur.style.transition = "";
        }); });
      }

      // ── Préchargement de toutes les images en arrière-plan ──
      // ── Préchargement intelligent — salle courante sans délai, reste en parallèle ──
      // La salle courante est déterminée par le hash (#salle-ID) ou la première salle.
      // Les autres salles sont chargées par ordre de proximité après 600ms.
      (function() {
        var salleActuelleIdx = 0;
        var mHash = window.location.hash.match(/^#salle-(\d+)$/);
        if (mHash) {
          var hId = parseInt(mHash[1]);
          var fi = salles.findIndex(function(s) { return s.id === hId; });
          if (fi >= 0) salleActuelleIdx = fi;
        }

        // Ordre de chargement : salle courante en tête, puis voisines par proximité
        var vus = new Set();
        var photosPrio = [];   // salle courante → immédiat
        var photosReste = [];  // autres salles → après 600ms

        var idxOrdonnes = salles.map(function(_, i) { return i; }).sort(function(a, b) {
          return Math.abs(a - salleActuelleIdx) - Math.abs(b - salleActuelleIdx);
        });

        idxOrdonnes.forEach(function(si) {
          var salle = salles[si];
          (salle.positions || []).forEach(function(p) {
            if (!p.toile || vus.has(p.toile)) return;
            vus.add(p.toile);
            var t = toileMap[p.toile];
            if (!t || !t.photo) return;
            var src = /^https?:\/\//.test(t.photo) ? t.photo
                        : (GALERIE_CFG.assetsBase + t.photo).replace(/\.jpg$/i, '-thumb.webp');
            if (si === salleActuelleIdx) photosPrio.push(src);
            else photosReste.push(src);
          });
        });

        // Salle courante : lancement immédiat (toutes en parallèle)
        window._ffPreload = window._ffPreload || [];
        photosPrio.forEach(function(src) { var img = new Image(); img.src = src; window._ffPreload.push(img); });

        // Autres salles : 600ms après pour ne pas concurrencer la salle visible
        setTimeout(function() {
          photosReste.forEach(function(src) { var img = new Image(); img.src = src; window._ffPreload.push(img); });
        }, 600);
      })();
    })
    .catch(() => {
      document.querySelectorAll('.mur').forEach(mur => {
        mur.innerHTML = '<p style="color:var(--text-doux);font-style:italic;padding:2rem;">Données non disponibles.</p>';
      });
    });
  
    
