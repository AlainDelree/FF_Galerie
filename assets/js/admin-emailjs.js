// ═══════════════════════════════════════════════
// TEXTURES GITHUB — upload + listing
// ═══════════════════════════════════════════════
let _texData = null; /* données compressées en attente de confirmation */

/* Compression canvas → JPEG ≤ 400 KB */
function compresserImageTexture(file) {
  return new Promise(function(resolve, reject) {
    if (file.size > 10 * 1024 * 1024) { reject('Fichier trop volumineux (max 10 Mo)'); return; }
    var MAX = 1200, TARGET = 400 * 1024 * (4/3); /* target base64 chars */
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function() {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      var q = 0.85, dataUrl = canvas.toDataURL('image/jpeg', q);
      while (dataUrl.length > TARGET && q > 0.3) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q); }
      resolve({
        dataUrl,
        b64: dataUrl.split(',')[1],
        nom: file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40),
        origKB: Math.round(file.size / 1024),
        finalKB: Math.round(dataUrl.length * 0.75 / 1024)
      });
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject('Image invalide'); };
    img.src = url;
  });
}

async function ouvrirOverlayTexture(file) {
  if (!file) return;
  try {
    _texData = await compresserImageTexture(file);
    $('tex-prev').style.backgroundImage = 'url("' + _texData.dataUrl + '")';
    $('tex-info').textContent = _texData.origKB + ' KB → ' + _texData.finalKB + ' KB après compression';
    // Suggestion de nom : fichier nettoyé
    var suggestion = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    $('inp-tex-upload-nom').value = suggestion;
    $('tex-partager').checked = false;
    $('tex-progress').textContent = '';
    $('overlay-tex-upload').style.display = 'flex';
    setTimeout(function() { $('inp-tex-upload-nom').select(); }, 150);
  } catch(e) { alert('Erreur : ' + e); }
}

async function uploaderTextureConfirmee() {
  if (!_texData) { $('tex-progress').textContent = '⚠ Aucune image — réessayez'; return; }
  if (!token)    { $('tex-progress').textContent = '⚠ Token GitHub requis'; return; }
  var nomSaisi = ($('inp-tex-upload-nom').value || '').trim();
  if (!nomSaisi) { $('tex-progress').textContent = '⚠ Entrez un nom pour la texture'; return; }
  var slug = nomSaisi.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40) || _texData.nom;
  var partager = $('tex-partager').checked;
  var dossier  = partager
    ? 'assets/images/textures/' + ADMIN_CFG.prefix + '/'
    : ADMIN_CFG.repoPath + 'textures/';
  var chemin   = dossier + slug + '.jpg';
  $('tex-progress').textContent = 'Upload en cours…';
  $('btn-tex-confirmer').disabled = true;
  try {
    await commitMulti([{ chemin, contenu: _texData.b64, encoding: 'base64' }], 'Texture : ' + nomSaisi);
    $('overlay-tex-upload').style.display = 'none';
    // Afficher le swatch immédiatement avec le dataUrl local
    TEXTURES[chemin] = 'url("' + _texData.dataUrl + '")';
    /* Injecter dans "Mes textures" (popover #pop-texture) — privée ou partagée par moi */
    var contMesTex = $('sw-texture');
    if (contMesTex) {
      contMesTex.prepend(creerSwatchGH(chemin, _texData.dataUrl, true));
    }
    _texData = null;
    toast('✓ Texture "' + nomSaisi + '" ajoutée');
    /* Le swatch a déjà été ajouté manuellement ci-dessus (ligne 74).
       Pas besoin de relancer chargerTexturesGitHub() ici : l'API GitHub
       a un délai de propagation imprévisible (3-10s) après un commit, et
       un refresh prématuré renvoie une liste sans le fichier qu'on vient
       d'uploader → cont.innerHTML='' efface le swatch fraîchement ajouté.
       La synchro complète se fait au prochain login (BUG-006 historique). */
  } catch(e) { $('tex-progress').textContent = 'Erreur : ' + e.message; }
  $('btn-tex-confirmer').disabled = false;
}

/* Cache des textures partagées (utilisées par afficherTexturesSysteme) */
var _texturesPartagees = []; // [{ path, download_url }]

async function chargerTexturesGitHub() {
  /* Architecture : la propriété d'une texture partagée est portée par le SOUS-DOSSIER.
     assets/images/textures/<prefix>/...  → appartient à <prefix>
     assets/images/textures/...           → racine (hérité ancien système, = Système pour tous) */
  var monPrefix = ADMIN_CFG.prefix;
  var estAdminSite = (monPrefix === 'ff'); // Fred = admin du site, peut tout supprimer
  var contMesTex = $('sw-texture');

  /* Retirer d'éventuelles textures GitHub déjà injectées (rerender) */
  if (contMesTex) {
    contMesTex.querySelectorAll('.sw.tex-gh').forEach(function(el){ el.remove(); });
  }

  /* 1) Textures privées de l'artiste → toutes dans Mes textures */
  try {
    var prives = await apiGH('/repos/' + REPO + '/contents/' + ADMIN_CFG.repoPath + 'textures?ref=' + BRANCH);
    var imgsP  = prives.filter(function(f){ return /\.(jpg|jpeg|png|webp)$/i.test(f.name); });
    imgsP.forEach(function(f) {
      TEXTURES[f.path] = 'url("' + f.download_url + '")';
      if (contMesTex) contMesTex.prepend(creerSwatchGH(f.path, f.download_url, true));
    });
  } catch(e) { /* dossier inexistant : OK */ }

  /* 2) Textures partagées : parcourir racine + un niveau de sous-dossiers */
  _texturesPartagees = [];
  try {
    var entrees = await apiGH('/repos/' + REPO + '/contents/assets/images/textures?ref=' + BRANCH);
    for (var i = 0; i < entrees.length; i++) {
      var e = entrees[i];
      if (e.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(e.name)) {
        /* Fichier en racine = hérité ancien système → Système pour tous */
        TEXTURES[e.path] = 'url("' + e.download_url + '")';
        _texturesPartagees.push({
          path: e.path,
          download_url: e.download_url,
          suppressible: estAdminSite
        });
      } else if (e.type === 'dir') {
        /* Sous-dossier <prefix> : lister son contenu */
        try {
          var contenu = await apiGH('/repos/' + REPO + '/contents/' + e.path + '?ref=' + BRANCH);
          var imgs = contenu.filter(function(f){ return /\.(jpg|jpeg|png|webp)$/i.test(f.name); });
          var auteur = e.name;
          imgs.forEach(function(f) {
            TEXTURES[f.path] = 'url("' + f.download_url + '")';
            if (auteur === monPrefix) {
              /* C'est ma texture → Mes textures, suppressible */
              if (contMesTex) contMesTex.prepend(creerSwatchGH(f.path, f.download_url, true));
            } else {
              /* Texture d'un autre artiste → Système */
              _texturesPartagees.push({
                path: f.path,
                download_url: f.download_url,
                suppressible: estAdminSite
              });
            }
          });
        } catch(_) { /* sous-dossier vide ou inaccessible : ignorer */ }
      }
    }
  } catch(e) { /* dossier racine inexistant : OK */ }

  /* Rafraîchir le mur si une texture GitHub est active (race avec chargerTout) */
  if (salleActive && typeof appliquerApparence === 'function') appliquerApparence();
  window._texturesGHChargees = true;
}

/* Affiche les textures système (partagées non miennes) dans #sw-tex-systeme */
function afficherTexturesSysteme() {
  var cont = $('sw-tex-systeme');
  if (!cont) return;
  /* Vider sauf le placeholder "Aucune texture système" */
  cont.querySelectorAll('.sw.tex-gh').forEach(function(el){ el.remove(); });
  var vide = $('tex-systeme-vide');
  if (!_texturesPartagees.length) {
    if (vide) vide.style.display = '';
    return;
  }
  if (vide) vide.style.display = 'none';
  _texturesPartagees.forEach(function(t) {
    cont.appendChild(creerSwatchGH(t.path, t.download_url, t.suppressible, /* estSysteme */ true));
  });
}

function creerSwatchGH(chemin, url, suppressible, estSysteme) {
  var sw = document.createElement('div');
  sw.className = 'sw tex-gh' + (textureActuelle === chemin ? ' sel' : '');
  sw.style.cssText = 'background-image:url("' + url + '");background-size:cover;position:relative;';
  sw.dataset.val = chemin;
  sw.title = chemin.split('/').pop().replace(/_[a-z0-9]+\.jpg$/i, '');
  sw.addEventListener('click', function() {
    /* En mode édition de son popover parent ET suppressible → suppression */
    var pop = sw.closest('.popover');
    if (pop && pop.classList.contains('mode-edit') && sw.dataset.suppressible === '1') {
      var estSys = sw.dataset.estSysteme === '1';
      if (estSys) {
        ouvrirModaleSupprTexture(chemin, url);
      } else {
        if (confirm('Supprimer cette texture ?')) {
          supprimerTextureGitHub(chemin);
        }
      }
      return;
    }
    /* Sinon : sélection normale */
    document.querySelectorAll('.sw').forEach(function(s){ s.classList.remove('sel'); });
    sw.classList.add('sel');
    setTexture(chemin);
  });
  if (suppressible) {
    sw.classList.add('suppressible');
    sw.dataset.suppressible = '1';
    sw.dataset.estSysteme = estSysteme ? '1' : '0';
  }
  return sw;
}

/* Modale de confirmation renforcée pour suppression d'une texture système */
function ouvrirModaleSupprTexture(chemin, url) {
  var overlay = $('overlay-suppr-tex');
  if (!overlay) {
    /* Fallback si la modale n'est pas dans le DOM */
    if (confirm('Supprimer cette texture partagée ?')) supprimerTextureGitHub(chemin);
    return;
  }
  /* Aperçu */
  $('suppr-tex-prev').style.backgroundImage = 'url("' + url + '")';
  /* Nom (dernière partie du chemin sans extension) */
  var fichier = chemin.split('/').pop();
  $('suppr-tex-nom').textContent = fichier.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  /* Auteur (segment <prefix> entre /textures/ et /<fichier>) */
  var m = chemin.match(/assets\/images\/textures\/([^\/]+)\//);
  var auteurLbl;
  if (m) {
    var auteurPrefix = m[1];
    /* Trouver le nom complet de l'artiste dans artistesData (admin Fred) */
    var nom = auteurPrefix;
    if (auteurPrefix === 'ff') nom = 'Frédérique Ferette';
    else if (typeof artistesData !== 'undefined' && artistesData) {
      var a = artistesData.find(function(x){ return x.prefix === auteurPrefix || x.id === auteurPrefix; });
      if (a) nom = a.nom;
    }
    auteurLbl = 'Texture partagée par ' + nom;
  } else {
    auteurLbl = 'Texture héritée (ancien système)';
  }
  $('suppr-tex-auteur').textContent = auteurLbl;
  /* Salles affectées (dans la galerie en cours uniquement — on ne peut pas savoir pour les autres artistes) */
  var sallesUtilisant = [];
  if (typeof salles !== 'undefined' && salles) {
    salles.forEach(function(s) { if (s.texture === chemin) sallesUtilisant.push(s.nom || ('Salle ' + s.id)); });
  }
  var avert = $('suppr-tex-salles');
  if (sallesUtilisant.length) {
    avert.innerHTML = '<strong>⚠ Salles affectées dans cette galerie :</strong><br>'
      + sallesUtilisant.map(function(n){ return '• ' + n; }).join('<br>')
      + '<br><br>Ces salles repasseront en "Uni" après la suppression.';
    avert.style.display = '';
  } else {
    avert.innerHTML = 'Aucune salle de cette galerie n\'utilise cette texture.<br>'
      + '<em style="color:var(--muted);">(D\'autres artistes peuvent l\'utiliser dans leur galerie.)</em>';
    avert.style.display = '';
  }
  /* Réinitialiser le champ et le bouton */
  $('inp-suppr-tex').value = '';
  var btnOk = $('btn-suppr-tex-ok');
  btnOk.disabled = true;
  btnOk.style.opacity = '.4';
  /* Mémoriser le chemin pour le bouton OK */
  overlay.dataset.cheminAsuppr = chemin;
  overlay.style.display = 'flex';
  setTimeout(function() { $('inp-suppr-tex').focus(); }, 100);
}

/* Bind immédiat des listeners de la modale (script chargé en fin de body) */
(function() {
  var inp = $('inp-suppr-tex');
  var btnOk = $('btn-suppr-tex-ok');
  var btnAnn = $('btn-suppr-tex-ann');
  var overlay = $('overlay-suppr-tex');
  if (!inp || !btnOk || !btnAnn || !overlay) return;

  inp.addEventListener('input', function() {
    var ok = inp.value.trim().toUpperCase() === 'SUPPRIMER';
    btnOk.disabled = !ok;
    btnOk.style.opacity = ok ? '1' : '.4';
  });
  btnAnn.addEventListener('click', function() {
    overlay.style.display = 'none';
  });
  /* Clic en dehors du panneau ferme aussi */
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.style.display = 'none';
  });
  /* Échap ferme aussi */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') overlay.style.display = 'none';
  });
  btnOk.addEventListener('click', async function() {
    if (btnOk.disabled) return;
    var chemin = overlay.dataset.cheminAsuppr;
    if (!chemin) return;
    overlay.style.display = 'none';
    await supprimerTextureGitHub(chemin);
  });

  /* Boutons crayon : bascule mode édition des popovers texture */
  function _bindCrayon(btnId, popId) {
    var btn = document.getElementById(btnId);
    var pop = document.getElementById(popId);
    if (!btn || !pop) return;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var actif = pop.classList.toggle('mode-edit');
      btn.classList.toggle('on', actif);
      btn.textContent = actif ? '✓' : '✎';
      btn.title = actif ? 'Terminer' : 'Gérer (supprimer)';
    });
  }
  _bindCrayon('btn-edit-mes-tex',    'pop-texture');
  _bindCrayon('btn-edit-tex-systeme', 'pop-tex-systeme');
})();

async function supprimerTextureGitHub(chemin) {
  try {
    var file = await apiGH('/repos/' + REPO + '/contents/' + chemin + '?ref=' + BRANCH);
    await apiGH('/repos/' + REPO + '/contents/' + chemin, 'DELETE', {
      message: 'Suppression texture : ' + chemin.split('/').pop(),
      sha: file.sha,
      branch: BRANCH
    });
    if (textureActuelle === chemin) { setTexture('none'); }
    await chargerTexturesGitHub();
    /* Rafraîchir aussi le popover système si ouvert */
    if (typeof afficherTexturesSysteme === 'function') afficherTexturesSysteme();
    toast('✓ Texture supprimée');
  } catch(e) { alert('Erreur : ' + e.message); }
}

/* ── Listener texture-custom : niveau module, garanti après chargement DOM ── */
(function() {
  var _inpTex = document.getElementById('inp-texture-custom');
  if (_inpTex) {
    _inpTex.addEventListener('change', function(e) {
      if (typeof ouvrirOverlayTexture === 'function') {
        ouvrirOverlayTexture(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  /* _texBound_module */
})();

/* ── Configuration EmailJS ── */
function chargerConfigEmailJS() {
  /* Charger depuis GitHub en priorité (disponible pour tous les admins)
     fallback : localStorage (valeurs saisies manuellement) */
  fetch('data/emailjs.json?v=' + Date.now())
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(cfg) {
      if (!cfg) cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
      if (!cfg) return;
      /* Mettre en cache local pour les prochains accès */
      localStorage.setItem('ff_emailjs', JSON.stringify(cfg));
      var s = document.getElementById('ejs-service');
      var t = document.getElementById('ejs-template');
      var p = document.getElementById('ejs-pubkey');
      if (s) s.value = cfg.serviceId  || '';
      if (t) t.value = cfg.templateId || '';
      if (p) p.value = cfg.publicKey  || '';
    })
    .catch(function() {
      /* fallback localStorage si fetch échoue */
      var cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
      if (!cfg) return;
      var s = document.getElementById('ejs-service');
      var t = document.getElementById('ejs-template');
      var p = document.getElementById('ejs-pubkey');
      if (s) s.value = cfg.serviceId  || '';
      if (t) t.value = cfg.templateId || '';
      if (p) p.value = cfg.publicKey  || '';
    });
}

function sauverEmailJS() {
  var cfg = {
    serviceId:  (document.getElementById('ejs-service')  || {}).value || '',
    templateId: (document.getElementById('ejs-template') || {}).value || '',
    publicKey:  (document.getElementById('ejs-pubkey')   || {}).value || ''
  };
  localStorage.setItem('ff_emailjs', JSON.stringify(cfg));
  var st = document.getElementById('ejs-status');
  if (st) { st.textContent = '✓ Sauvegardé'; setTimeout(function(){ st.textContent = ''; }, 2000); }
}

async function testerEmailJS() {
  var st = document.getElementById('ejs-status');
  if (st) st.textContent = 'Envoi en cours…';
  try {
    await envoyerEmailJS(
      'Bug : [TEST] Email FF_Galerie',
      'bug',
      'Test manuel depuis Admin > Backup',
      ''
    );
    if (st) st.textContent = '✓ Email envoyé — vérifie ta boîte';
  } catch(e) {
    if (st) st.textContent = '✗ Erreur : ' + e.message;
  }
}

async function envoyerEmailJS(titre, priorite, message, details) {
  var cfg = JSON.parse(localStorage.getItem('ff_emailjs') || 'null');
  if (!cfg || !cfg.publicKey || !cfg.serviceId || !cfg.templateId) return;
  var PREFIX = { bug: 'Bug', bloquant: 'Bloquant', effondrement: 'Effondrement' };
  var resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  cfg.serviceId,
      template_id: cfg.templateId,
      user_id:     cfg.publicKey,
      template_params: {
        subject:  titre,
        priorite: PREFIX[priorite] || 'Bug',
        message:  message.slice(0, 300),
        artiste:  ADMIN_CFG.nom,
        url:      location.href,
        date:     new Date().toLocaleString('fr-BE'),
        details:  details ? String(details).slice(0, 500) : ''
      }
    })
  });
  if (!resp.ok) throw new Error('EmailJS ' + resp.status);
}
