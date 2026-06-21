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
  var dossier  = partager ? 'assets/images/textures/' : ADMIN_CFG.repoPath + 'textures/';
  var chemin   = dossier + slug + '.jpg';
  $('tex-progress').textContent = 'Upload en cours…';
  $('btn-tex-confirmer').disabled = true;
  try {
    await commitMulti([{ chemin, contenu: _texData.b64, encoding: 'base64' }], 'Texture : ' + nomSaisi);
    $('overlay-tex-upload').style.display = 'none';
    // Afficher le swatch immédiatement avec le dataUrl local
    TEXTURES[chemin] = 'url("' + _texData.dataUrl + '")';
    var _cont = partager ? $('textures-gh-partage') : $('textures-gh-prive');
    var _wrap = partager ? $('tex-gh-partage-wrap') : $('tex-gh-prive-wrap');
    if (_cont && _wrap) {
      _wrap.style.display = '';
      _cont.appendChild(creerSwatchGH(chemin, _texData.dataUrl, partager && ADMIN_CFG.prefix === 'ff'));
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

async function chargerTexturesGitHub() {
  var dossiers = [
    { chemin: 'assets/images/textures',        wrap: $('tex-gh-partage-wrap'), cont: $('textures-gh-partage'),
      suppressible: ADMIN_CFG.prefix === 'ff'  /* Fred peut supprimer les partagées, pas les invités */ },
    { chemin: ADMIN_CFG.repoPath + 'textures', wrap: $('tex-gh-prive-wrap'),   cont: $('textures-gh-prive'),
      suppressible: true }
  ];
  for (var i = 0; i < dossiers.length; i++) {
    var d = dossiers[i];
    if (!d.cont) continue;
    try {
      var files = await apiGH('/repos/' + REPO + '/contents/' + d.chemin + '?ref=' + BRANCH);
      var imgs  = files.filter(function(f){ return /\.(jpg|jpeg|png|webp)$/i.test(f.name); });
      if (!imgs.length) { if (d.wrap) d.wrap.style.display = 'none'; continue; }
      if (d.wrap) d.wrap.style.display = '';
      d.cont.innerHTML = '';
      imgs.forEach(function(f) {
        TEXTURES[f.path] = 'url("' + f.download_url + '")';
        d.cont.appendChild(creerSwatchGH(f.path, f.download_url, d.suppressible));
      });
    } catch(e) { if (d.wrap) d.wrap.style.display = 'none'; }
  }
  // Rafraîchir le mur si une texture GitHub est active (race avec chargerTout)
  if (salleActive && typeof appliquerApparence === 'function') appliquerApparence();
  window._texturesGHChargees = true;
}

function creerSwatchGH(chemin, url, suppressible) {
  var sw = document.createElement('div');
  sw.className = 'sw tex-gh' + (textureActuelle === chemin ? ' sel' : '');
  sw.style.cssText = 'background-image:url("' + url + '");background-size:cover;position:relative;';
  sw.dataset.val = chemin;
  sw.title = chemin.split('/').pop().replace(/_[a-z0-9]+\.jpg$/i, '');
  sw.addEventListener('click', function() {
    document.querySelectorAll('.sw').forEach(function(s){ s.classList.remove('sel'); });
    sw.classList.add('sel');
    setTexture(chemin);
  });
  if (suppressible) {
    var del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'tex-del-btn';
    del.style.cssText = 'position:absolute;top:1px;right:1px;width:13px;height:13px;'
      + 'border-radius:50%;background:#c0392b;color:#fff;border:none;font-size:8px;'
      + 'cursor:pointer;line-height:13px;padding:0;z-index:2;display:none;'
      + 'align-items:center;justify-content:center;';
    del.title = 'Supprimer';
    del.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!confirm('Supprimer cette texture ?')) return;
      await supprimerTextureGitHub(chemin);
    });
    sw.appendChild(del);
  }
  return sw;
}

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

/* Mode suppression textures */
let _texDelMode = false;
function toggleModeSupprTexture() {
  _texDelMode = !_texDelMode;
  document.querySelectorAll('.tex-del-btn').forEach(function(b) {
    b.style.display = _texDelMode ? '' : 'none';
  });
  var btn = document.getElementById('btn-tex-del-toggle');
  if (btn) btn.style.color = _texDelMode ? '#c0392b' : '';
}

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
