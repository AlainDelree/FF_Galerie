/* ===========================================================================
   FF_Galerie — Enregistrement du Service Worker (PWA)
   ---------------------------------------------------------------------------
   - Site web (non installé)  : se met à jour tout seul quand une nouvelle
     version est déployée (comportement de site normal).
   - App installée (standalone): NE bouge jamais seule. Un bouton flottant
     « ⟳ Mettre à jour » retélécharge le snapshot à la demande, puis recharge.
   Best-effort : sur un navigateur sans support, on ne fait rien.
   =========================================================================== */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var EST_APP =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var rechargeFaite = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (rechargeFaite) return;
    rechargeFaite = true;
    window.location.reload();
  });

  // --- Petit toast éphémère ------------------------------------------------
  function toast(txt) {
    var t = document.createElement('div');
    t.textContent = txt;
    t.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:80px', 'transform:translateX(-50%)',
      'z-index:100000', 'background:#1a1a1a', 'color:#f0d080',
      'border:1px solid #c8a050', 'border-radius:8px', 'padding:8px 14px',
      'font-family:Lato,system-ui,sans-serif', 'font-size:13px',
      'box-shadow:0 6px 24px rgba(0,0,0,.45)', 'opacity:0', 'transition:opacity .2s'
    ].join(';');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 250);
    }, 2200);
  }

  // --- Bouton « Mettre à jour » (app installée uniquement) -----------------
  function injecterBoutonMaj(reg) {
    if (document.getElementById('pwa-maj-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'pwa-maj-btn';
    btn.type = 'button';
    btn.title = 'Mettre à jour la galerie';
    btn.setAttribute('aria-label', 'Mettre à jour la galerie');
    btn.textContent = '⟳';
    btn.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:99999',
      'width:44px', 'height:44px', 'border-radius:50%',
      'background:#1a1a1a', 'color:#f0d080', 'border:1px solid #c8a050',
      'font-size:20px', 'line-height:1', 'cursor:pointer',
      'box-shadow:0 4px 16px rgba(0,0,0,.45)',
      'display:flex', 'align-items:center', 'justify-content:center'
    ].join(';');

    var enCours = false;
    btn.addEventListener('click', function () {
      if (enCours) return;
      if (!navigator.onLine) { toast('Pas de connexion'); return; }
      enCours = true;
      btn.style.opacity = '0.6';
      btn.textContent = '…';

      // 1) Cherche un éventuel nouveau code (sw.js).
      reg.update().catch(function () {}).then(function () {
        // 2) Demande au SW actif de retélécharger le snapshot de contenu.
        return demanderRefresh();
      }).then(function () {
        // 3) Si un nouveau SW attend, on bascule dessus (→ reload auto).
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      }).catch(function () {
        enCours = false;
        btn.style.opacity = '1';
        btn.textContent = '⟳';
        toast('Échec de la mise à jour');
      });
    });

    document.body.appendChild(btn);
  }

  function demanderRefresh() {
    return new Promise(function (resolve) {
      var sw = navigator.serviceWorker.controller;
      if (!sw) { resolve(); return; }
      var ch = new MessageChannel();
      var fini = false;
      ch.port1.onmessage = function () { if (!fini) { fini = true; resolve(); } };
      sw.postMessage({ type: 'REFRESH' }, [ch.port2]);
      // Garde-fou : on ne reste pas bloqué si le SW ne répond pas.
      setTimeout(function () { if (!fini) { fini = true; resolve(); } }, 25000);
    });
  }

  // -------------------------------------------------------------------------
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {

      if (EST_APP) injecterBoutonMaj(reg);

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            // Site web : on prend la nouvelle version tout de suite (frais).
            // App installée : on attend que l'utilisateur tape « Mettre à jour ».
            if (!EST_APP) sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

    }).catch(function () { /* silencieux */ });
  });
})();
