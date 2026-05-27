/* FF_Galerie - main.js */

const THEME_KEY     = 'ff_galerie_theme';
const MUSIC_KEY     = 'ff_galerie_music';
const DEFAULT_THEME = 'theme-sombre';

function appliquerTheme(theme) {
  document.body.className = theme;
  document.querySelectorAll('.btn-theme').forEach(btn => {
    btn.classList.toggle('actif', btn.dataset.theme === theme);
  });
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  appliquerTheme(saved);
}

document.querySelectorAll('.btn-theme').forEach(btn => {
  btn.addEventListener('click', () => appliquerTheme(btn.dataset.theme));
});

let musiqueActive = localStorage.getItem(MUSIC_KEY) === 'on';

function majIconeMusique() {
  const icone = document.getElementById('iconeMusique');
  const btn   = document.getElementById('btnMusique');
  if (!icone || !btn) return;
  icone.innerHTML = musiqueActive ? '&#9834;' : '&#9835;';
  btn.classList.toggle('off', !musiqueActive);
  btn.title = musiqueActive ? 'Couper la musique' : 'Activer la musique';
}

document.getElementById('btnMusique')?.addEventListener('click', () => {
  musiqueActive = !musiqueActive;
  localStorage.setItem(MUSIC_KEY, musiqueActive ? 'on' : 'off');
  majIconeMusique();
});

initTheme();
majIconeMusique();
