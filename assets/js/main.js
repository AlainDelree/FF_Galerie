/* FF_Galerie — main.js */

const THEME_KEY     = 'ff_galerie_theme';
const MUSIC_KEY     = 'ff_galerie_music';
const DEFAULT_THEME = 'theme-sombre';

/* ── Fichier audio ──────────────────────────────────────────────
   Pour changer la musique : remplacer le fichier MP3 dans
   assets/music/ et mettre son nom ici.
   ─────────────────────────────────────────────────────────────── */
const MUSIC_SRC    = 'assets/music/musique.mp3';
const MUSIC_VOLUME = 0.55;   // volume cible (0 à 1)
const FADE_MS      = 1800;   // durée du fondu en ms

// ── Thème ──────────────────────────────────────────────────────
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

/* ── Musique ────────────────────────────────────────────────────
   Active par défaut — l'utilisateur peut couper via le bouton ♪
   ────────────────────────────────────────────────────────────── */
let audio       = null;
let fadeTicker  = null;
let musiqueActive = localStorage.getItem(MUSIC_KEY) !== 'off'; // on par défaut

function creerAudio() {
  if (audio && audio.readyState > 0 && !audio.error) return;
  audio       = new Audio(MUSIC_SRC);
  audio.loop  = true;
  audio.volume = 0;
  audio.addEventListener('error', () => {
    console.error('FF Galerie — Audio introuvable :', MUSIC_SRC);
    musiqueActive = false;
    localStorage.setItem(MUSIC_KEY, 'off');
    majIconeMusique();
    audio = null; // permet de réessayer
    /* pas d'alerte — galerie sans musique, comportement normal */
  });
}

function fader(versVolume, callback) {
  clearInterval(fadeTicker);
  if (!audio) return;
  const duree = FADE_MS;
  const depart = audio.volume;
  const debut  = performance.now();
  fadeTicker = setInterval(() => {
    const t = Math.min((performance.now() - debut) / duree, 1);
    audio.volume = depart + (versVolume - depart) * t;
    if (t >= 1) {
      clearInterval(fadeTicker);
      audio.volume = versVolume;
      if (callback) callback();
    }
  }, 20);
}

function demarrerMusique() {
  creerAudio();
  audio.volume = 0;
  audio.play()
    .then(() => fader(MUSIC_VOLUME))
    .catch(() => {
      /* Autoplay bloqué par le navigateur — sera relancé au prochain clic */
    });
}

function arreterMusique() {
  if (!audio) return;
  fader(0, () => { audio.pause(); audio.currentTime = 0; });
}

function toggleMusique() {
  musiqueActive = !musiqueActive;
  localStorage.setItem(MUSIC_KEY, musiqueActive ? 'on' : 'off');
  majIconeMusique();
  if (musiqueActive) demarrerMusique();
  else              arreterMusique();
}

function majIconeMusique() {
  const icone = document.getElementById('iconeMusique');
  const btn   = document.getElementById('btnMusique');
  if (!icone || !btn) return;
  icone.textContent = '♪';
  btn.classList.toggle('off', !musiqueActive);
  btn.title = musiqueActive ? 'Couper la musique' : 'Activer la musique';
}

const btnMusique = document.getElementById('btnMusique');
btnMusique?.addEventListener('click', toggleMusique);

// Auto-démarrage musique sur la galerie uniquement
if (musiqueActive && document.body.dataset.page === 'galerie') {
  window.addEventListener('load', () => {
    demarrerMusique();
    // Fallback si autoplay bloqué : relance au premier clic
    const reprise = () => {
      if (musiqueActive && audio && audio.paused) demarrerMusique();
      document.removeEventListener('click',      reprise);
      document.removeEventListener('touchstart', reprise);
    };
    document.addEventListener('click',      reprise, { once: true });
    document.addEventListener('touchstart', reprise, { once: true, passive: true });
  });
}

// ── Init ───────────────────────────────────────────────────────
initTheme();
majIconeMusique();
