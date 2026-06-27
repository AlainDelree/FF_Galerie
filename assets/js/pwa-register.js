/* ===========================================================================
   FF_Galerie — Enregistrement du Service Worker (PWA)
   Chargé uniquement sur les pages publiques (via le <head> propagé).
   Tout est best-effort : sur un navigateur sans support, on ne fait rien.
   =========================================================================== */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  // Petit bandeau discret « nouvelle version disponible ».
  function bandeauMaj(worker) {
    if (document.getElementById('pwa-maj')) return;
    var b = document.createElement('div');
    b.id = 'pwa-maj';
    b.setAttribute('role', 'status');
    b.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
      'z-index:99999', 'max-width:90%',
      'background:#1a1a1a', 'color:#f0d080',
      'border:1px solid #c8a050', 'border-radius:10px',
      'padding:10px 14px', 'font-family:Lato,system-ui,sans-serif', 'font-size:14px',
      'box-shadow:0 6px 24px rgba(0,0,0,.45)', 'cursor:pointer',
      'display:flex', 'gap:10px', 'align-items:center'
    ].join(';');
    b.innerHTML = '<span>Nouvelle version disponible</span>' +
                  '<strong style="text-decoration:underline">Mettre à jour</strong>';
    b.addEventListener('click', function () {
      if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(b);
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      // Un nouveau SW est trouvé → on guette son installation.
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          // Installé alors qu'un SW contrôle déjà la page = vraie mise à jour.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            bandeauMaj(sw);
          }
        });
      });
    }).catch(function () { /* silencieux */ });

    // Quand le nouveau SW prend le contrôle (après SKIP_WAITING) → on recharge.
    var recharge = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recharge) return;
      recharge = true;
      window.location.reload();
    });
  });
})();
