/* FF_Galerie — main.js */

const THEME_KEY     = 'ff_galerie_theme';
const MUSIC_KEY     = 'ff_galerie_music';
const DEFAULT_THEME = 'theme-sombre';

/* ── Fichier audio ──────────────────────────────────────────────
   Le chemin est lu dynamiquement depuis data/infos.json (champ
   musique.fichier). La valeur ci-dessous sert uniquement de
   fallback si le JSON est inaccessible.
   ─────────────────────────────────────────────────────────────── */
let    MUSIC_SRC    = 'assets/music/musique.mp3'; // mis à jour par chargerConfigMusique()
const  MUSIC_VOLUME = 0.55;   // volume cible (0 à 1)
const  FADE_MS      = 1800;   // durée du fondu en ms

let _configMusiqueChargee = false;
async function chargerConfigMusique() {
  if (_configMusiqueChargee) return;
  try {
    const r = await fetch('data/infos.json?v=' + Date.now());
    if (r.ok) {
      const d = await r.json();
      if (d.musique) {
        if (d.musique.fichier) MUSIC_SRC = d.musique.fichier;
        // Crédit musique dans le footer (toutes les pages)
        const credEl = document.querySelector('.mention-musique');
        if (credEl) {
          const txt = buildCreditMusique(d.musique);
          if (txt) { credEl.innerHTML = txt; }
        }
      }
    }
  } catch(e) { /* garde valeur par défaut */ }
  _configMusiqueChargee = true;
}

function buildCreditMusique(m) {
  if (!m || (!m.titre && !m.auteur)) return '';
  var titre  = m.titre  ? '<em>' + m.titre + '</em>' : '';
  var auteur = m.auteur || '';
  var base   = [titre, auteur].filter(Boolean).join('\u00a0\u2014\u00a0');
  var parts  = base ? [base] : [];
  if (m.interprete) {
    parts.push(m.lien
      ? '<a href="' + m.lien + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">' + m.interprete + '</a>'
      : m.interprete);
  }
  if (m.licence) parts.push(m.licence.replace(' ', '\u00a0'));
  return 'Musique\u00a0:\u00a0' + parts.join('\u00a0\u00b7\u00a0');
}

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
if (document.body.dataset.page === 'galerie') {
  window.addEventListener('load', async () => {
    await chargerConfigMusique(); // chemin depuis infos.json
    if (!musiqueActive) return;
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
} else {
  // Sur les autres pages : charge quand même pour afficher les crédits footer
  chargerConfigMusique();
}

// ── Init ───────────────────────────────────────────────────────
initTheme();
majIconeMusique();
