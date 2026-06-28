/* ===========================================================================
   FF_Galerie — Enregistrement du Service Worker (PWA)
   ---------------------------------------------------------------------------
   - App installée : s'ouvre instantanément depuis le cache. Elle ne télécharge
     RIEN et ne se recharge JAMAIS toute seule à l'ouverture. La galerie ne se
     met à jour que quand l'utilisateur tape « ⟳ Mettre à jour ».
   - Site web (non installé) : prend la nouvelle version au déploiement suivant.
   - Installation depuis la page /app.html (#btn-install-app).
   Best-effort : sur un navigateur sans support, on ne fait rien.
   =========================================================================== */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var EST_APP =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var promptInstall = null;
  var majDemandee   = false;   // true UNIQUEMENT lors d'une MAJ explicite (⟳) ou côté site web
  var rechargeFaite = false;

  // L'app ne se recharge jamais d'elle-même : on ne recharge que si une MAJ a
  // été explicitement déclenchée.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!majDemandee || rechargeFaite) return;
    rechargeFaite = true;
    window.location.reload();
  });

  function toast(txt) {
    var t = document.createElement('div');
    t.textContent = txt;
    t.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:80px', 'transform:translateX(-50%)',
      'z-index:100000', 'background:#1a1a1a', 'color:#f0d080',
      'border:1px solid #c8a050', 'border-radius:8px', 'padding:8px 14px',
      'font-family:Lato,system-ui,sans-serif', 'font-size:13px', 'max-width:90%',
      'text-align:center', 'box-shadow:0 6px 24px rgba(0,0,0,.45)',
      'opacity:0', 'transition:opacity .2s'
    ].join(';');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 250);
    }, 2600);
  }

  /* --- Installation : bouton explicite #btn-install-app -------------------- */
  function majEtatBoutonInstall() {
    var b = document.getElementById('btn-install-app');
    if (!b) return;
    if (EST_APP) {
      b.textContent = b.dataset.labelInstallee || 'Application déjà installée ✓';
      b.disabled = true;
      b.style.opacity = '0.7';
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promptInstall = e;
  });
  window.addEventListener('appinstalled', function () {
    promptInstall = null;
    toast('Installée ✓ — préparation hors connexion…');
    majEtatBoutonInstall();
    precacheFull(function () { toast('Galerie disponible hors connexion ✓'); });
  });

  /* --- Téléchargement complet du snapshot média (à la demande) ------------- */
  function precacheFull(onDone) {
    navigator.serviceWorker.ready.then(function (reg) {
      var sw = reg.active || navigator.serviceWorker.controller;
      if (!sw) { if (onDone) onDone(false); return; }
      var ch = new MessageChannel();
      var fini = false;
      ch.port1.onmessage = function () { if (!fini) { fini = true; if (onDone) onDone(true); } };
      sw.postMessage({ type: 'PRECACHE_FULL' }, [ch.port2]);
      setTimeout(function () { if (!fini) { fini = true; if (onDone) onDone(true); } }, 60000);
    }).catch(function () { if (onDone) onDone(false); });
  }

  function cablerBoutonInstall() {
    var b = document.getElementById('btn-install-app');
    if (!b) return;
    majEtatBoutonInstall();
    if (EST_APP) return;
    b.addEventListener('click', function () {
      if (promptInstall) {
        promptInstall.prompt();
        promptInstall.userChoice.finally(function () { promptInstall = null; });
      } else {
        var aide = document.getElementById('install-aide');
        if (aide) { aide.style.display = 'block'; aide.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else toast('Menu du navigateur \u2192 « Installer l\u2019application »');
      }
    });
  }

  function cablerPrepOffline() {
    var b = document.getElementById('btn-offline-prep');
    if (!b) return;
    b.addEventListener('click', function () {
      if (!navigator.onLine) { toast('Pas de connexion'); return; }
      b.disabled = true; b.style.opacity = '0.6'; b.textContent = 'Téléchargement…';
      precacheFull(function () {
        b.style.opacity = '1';
        b.textContent = 'Disponible hors connexion ✓';
        toast('Galerie disponible hors connexion ✓');
      });
    });
  }

  /* --- Mise à jour à la demande (app installée) : bouton ⟳ ----------------- */
  function demanderRefresh() {
    return new Promise(function (resolve) {
      var sw = navigator.serviceWorker.controller;
      if (!sw) { resolve(); return; }
      var ch = new MessageChannel();
      var fini = false;
      ch.port1.onmessage = function () { if (!fini) { fini = true; resolve(); } };
      sw.postMessage({ type: 'REFRESH' }, [ch.port2]);
      setTimeout(function () { if (!fini) { fini = true; resolve(); } }, 30000);
    });
  }

  function attendreWaiting(reg) {
    return new Promise(function (resolve) {
      if (reg.waiting) { resolve(); return; }
      var sw = reg.installing;
      if (!sw) { resolve(); return; }
      sw.addEventListener('statechange', function () {
        if (sw.state === 'installed' || sw.state === 'redundant') resolve();
      });
      setTimeout(resolve, 15000);
    });
  }

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
      enCours = true; btn.style.opacity = '0.6'; btn.textContent = '…';
      majDemandee = true;                       // autorise le rechargement final
      // La MAJ ramène la version prod fraîche : on efface les modifs locales
      // de l'éditeur in-app (surcouche jamais publiée).
      try {
        localStorage.removeItem('ff_local_layout');
        sessionStorage.removeItem('ff_edit_mode');
      } catch (e) {}
      reg.update().catch(function () {})
        .then(function () { return attendreWaiting(reg); })
        .then(function () { return demanderRefresh(); })   // re-télécharge le snapshot frais
        .then(function () {
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          else window.location.reload();
        })
        .catch(function () {
          enCours = false; majDemandee = false;
          btn.style.opacity = '1'; btn.textContent = '⟳';
          toast('Échec de la mise à jour');
        });
    });
    document.body.appendChild(btn);
  }

  /* ------------------------------------------------------------------------ */
  window.addEventListener('load', function () {
    cablerBoutonInstall();
    cablerPrepOffline();

    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      if (EST_APP) injecterBoutonMaj(reg);

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            if (!EST_APP) {
              // Site web : prend la nouvelle version tout de suite (reste frais).
              majDemandee = true;
              demanderRefresh().finally(function () { sw.postMessage({ type: 'SKIP_WAITING' }); });
            }
            // App installée : on NE fait rien → mise à jour seulement via ⟳.
          }
        });
      });
    }).catch(function () {});
  });
})();
