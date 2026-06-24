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


/* ══════════════════════════════════════════════════════════════
   RENDERER PEINTURE — enregistré dans GALERIE_RENDERERS
   ══════════════════════════════════════════════════════════════ */
GALERIE_RENDERERS['peinture'] = function(salleDiv, salle, si, salles, tData) {
  const toileMap = {};
  (tData.toiles || []).forEach(t => { toileMap[t.id] = t; });

  /* Couleur du mur de la pièce (décor autour du mur d'expo) — par salle */
  if (salle.couleur_mur_piece) salleDiv.style.backgroundColor = salle.couleur_mur_piece;

  /* Mur (grille de tableaux) */
  const mur = document.createElement('div');
  mur.className = 'mur';
  mur.id = 'mur' + salle.id;
  salleDiv.appendChild(mur);

  /* Portes mode C */
  ['g','d'].forEach(cote => {
    const p = document.createElement('div');
    p.className = 'porte porte-' + cote + ' invisible';
    p.dataset.murId = si + 1;
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

  /* Couleur/texture du mur */
  if (salle.couleur_mur) mur.style.backgroundColor = salle.couleur_mur;
  const couleurCadres   = salle.couleur_cadres  || '#3a3a3a';
  const epaisseurCadres = salle.epaisseur_cadres || 2;

  const positions   = salle.positions || [];
  const toilesSalle = (salle.toiles || []).map(id => toileMap[id]).filter(Boolean);
  const salleIdx    = si + 1;

  /* Salle vide */
  if (!toilesSalle.length && !positions.length) {
    mur.classList.add('mur-grille');
    salleDiv.classList.add('salle-grille');
    const plancher = creerPlancher(salleIdx, salles.length, salles, NOMS_ROMAINS, salle);
    salleDiv.appendChild(plancher);
    return;
  }
  if (!toilesSalle.length) return;

  /* MODE GRILLE (positions admin) */
  if (positions.length > 0) {
    const toilesPosees = positions.map(p => toileMap[p.id]).filter(Boolean);
    if (!toilesPosees.length) return;

    mur.querySelectorAll('.porte').forEach(p => p.remove());
    mur.classList.add('mur-grille');
    salleDiv.classList.add('salle-grille');

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
        mur.style.background = textures[salle.texture] + ', ' + (salle.couleur_mur || '#2e2e2e');
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(salle.texture)) {
        var texUrl = GALERIE_CFG.assetsBase + salle.texture;
        mur.style.background = 'url("' + texUrl + '") center/cover, ' + (salle.couleur_mur || '#2e2e2e');
        mur.style.backgroundBlendMode = 'multiply';
      }
    }

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
        var _srcOrigD  = (/^https?:\/\//.test(t.photo)) ? t.photo : GALERIE_CFG.assetsBase + t.photo;
        var _srcThumbD = /^https?:\/\//.test(t.photo) ? t.photo
                         : (GALERIE_CFG.assetsBase + t.photo).replace(/\.jpg$/i, '-thumb.webp');
        img.alt      = t.titre || '';
        img.loading  = 'lazy';
        img.decoding = 'async';
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
        img.src = _srcThumbD;
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

    const plancher = creerPlancher(salleIdx, salles.length, salles, NOMS_ROMAINS, salle);
    salleDiv.appendChild(plancher);

  } else {
    /* MODE FLUX */
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
};

