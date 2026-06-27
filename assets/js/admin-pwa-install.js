/* ===========================================================================
   FF_Galerie — Bouton « Installer l'app » côté ADMIN
   ---------------------------------------------------------------------------
   Installe l'app de CONSULTATION (galerie publique) depuis l'admin, où
   Alain et Frédérique travaillent. L'admin lui-même reste hors cache :
   le service worker l'exclut par chemin ET par referrer (voir sw.js).
   Note : à la 1re installation (ou après un changement de version du SW),
   le snapshot de la galerie (~25 Mo) est mis en cache en tâche de fond.
   =========================================================================== */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var EST_APP =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var promptInstall = null;

  function toast(txt) {
    var t = document.createElement('div');
    t.textContent = txt;
    t.style.cssText = [
      'position:fixed', 'left:50%', 'top:64px', 'transform:translateX(-50%)',
      'z-index:100000', 'background:#1a1a1a', 'color:#f0d080',
      'border:1px solid #c8a050', 'border-radius:8px', 'padding:8px 14px',
      'font-family:system-ui,sans-serif', 'font-size:13px', 'max-width:90%',
      'text-align:center', 'box-shadow:0 6px 24px rgba(0,0,0,.45)',
      'opacity:0', 'transition:opacity .2s'
    ].join(';');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 250);
    }, 3000);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promptInstall = e;
  });

  window.addEventListener('appinstalled', function () {
    promptInstall = null;
    var b = document.getElementById('btn-install-app');
    if (b) b.style.display = 'none';
    toast('Installée ✓ — préparation hors connexion…');
    navigator.serviceWorker.ready.then(function (reg) {
      var sw = reg.active;
      if (sw) sw.postMessage({ type: 'PRECACHE_FULL' });
    }).catch(function () {});
  });

  window.addEventListener('load', function () {
    // Enregistre le SW → rend l'app installable. (Admin protégé du cache.)
    navigator.serviceWorker.register('/sw.js').catch(function () {});

    var b = document.getElementById('btn-install-app');
    if (!b) return;
    if (EST_APP) { b.style.display = 'none'; return; }

    b.addEventListener('click', function () {
      if (promptInstall) {
        promptInstall.prompt();
        promptInstall.userChoice.finally(function () { promptInstall = null; });
      } else {
        toast('Si rien ne s\u2019affiche : menu \u22EE du navigateur \u2192 « Installer l\u2019application »');
      }
    });
  });
})();
