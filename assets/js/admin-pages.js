// ═══════════════════════════════════════════════
// ADMIN-PAGES.JS — Infos/Agenda + Collègues
// Dépend de : lireRaw, commitMulti, toast, $, ADMIN_CFG (admin.js)
//             _musiqueChargee (admin-media.js)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// VUE INFOS & AGENDA
// ═══════════════════════════════════════════════
let infosData = { evenements: [], collegues: [] };
let infosModifiees = false;

/* Charge infos.json au passage sur l'onglet */
async function chargerInfos() {
  try {
    const infos = await lireRaw(ADMIN_CFG.repoPath + 'infos.json');
    infosData = infos || { evenements: [], collegues: [] };
    infosData.evenements    = infosData.evenements    || [];
    infosData.collegues     = infosData.collegues     || [];
    infosData.musique       = infosData.musique       || { fichier: '' };
    infosData.presentation  = infosData.presentation  || { titre: '', texte: '', photo: '' };
    _musiqueChargee = true;
    afficherEvents();
    afficherCollegues();
    remplirFormulairePresentation();
  } catch(e) {
    infosData = { evenements: [], collegues: [], musique: { fichier: '' }, presentation: { titre: '', texte: '', photo: '' } };
    afficherEvents();
  }
  /* Charger contact.json */
  try {
    const rc = await lireRaw(ADMIN_CFG.repoPath + 'contact.json');
    remplirFormulaireContact(rc || {});
  } catch(e) { /* pas de contact.json encore */ }
}

function remplirFormulaireContact(d) {
  var champs = ['email','tel','instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  var RESEAUX = ['instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  champs.forEach(function(c) {
    var el = document.getElementById('cnt-' + c);
    if (el) el.value = d[c === 'tel' ? 'telephone' : c] || '';
  });
  RESEAUX.forEach(function(r) {
    var el = document.getElementById('cnt-' + r + '-nom');
    if (el) el.value = d[r + '_nom'] || '';
  });
}

function lireFormulaireContact() {
  var RESEAUX = ['instagram','facebook','tiktok','pinterest','youtube','twitter','linkedin','site'];
  var data = {
    email:     document.getElementById('cnt-email')?.value.trim() || '',
    telephone: document.getElementById('cnt-tel')?.value.trim()   || ''
  };
  RESEAUX.forEach(function(r) {
    data[r]          = document.getElementById('cnt-' + r)       ?.value.trim() || '';
    data[r + '_nom'] = document.getElementById('cnt-' + r + '-nom')?.value.trim() || '';
  });
  return data;
}

function afficherEvents() {
  const liste = document.getElementById('liste-events');
  if (!liste) return;
  if (!infosData.evenements.length) {
    liste.innerHTML = "<div class=\"event-vide\">Aucun événement pour l'instant</div>";
    return;
  }
  liste.innerHTML = infosData.evenements.map((ev, i) => `
    <div class="event-card">
      <div class="event-info">
        <div class="event-titre">${ev.titre || '—'}</div>
        <div class="event-meta">${[ev.dateAffichage, ev.lieu].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="event-actions">
        <button class="event-btn" onclick="ouvrirFormulaireEvent(${i})">✏️</button>
        <button class="event-btn del" onclick="supprimerEvent(${i})">✕</button>
      </div>
    </div>`
  ).join('');
}

function ouvrirFormulaireEvent(idx) {
  const ev = idx !== null ? infosData.evenements[idx] : null;
  document.getElementById('form-event-id').value  = idx !== null ? idx : '';
  document.getElementById('evt-titre').value       = ev ? (ev.titre        || '') : '';
  document.getElementById('evt-date').value        = ev ? (ev.dateAffichage|| '') : '';
  document.getElementById('evt-lieu').value        = ev ? (ev.lieu         || '') : '';
  document.getElementById('evt-desc').value        = ev ? (ev.description  || '') : '';
  document.getElementById('evt-lien').value        = ev ? (ev.lien         || '') : '';
  document.getElementById('form-event-err').textContent = '';
  document.getElementById('form-event-titre').textContent = ev ? 'Modifier l\'événement' : 'Nouvel événement';
  document.getElementById('form-event-wrap').style.display = '';
  document.getElementById('evt-titre').focus();
}

function fermerFormulaireEvent() {
  document.getElementById('form-event-wrap').style.display = 'none';
}

async function sauverFormulaireEvent() {
  const titre = document.getElementById('evt-titre').value.trim();
  if (!titre) { document.getElementById('form-event-err').textContent = 'Le titre est obligatoire.'; return; }
  const ev = {
    titre,
    dateAffichage: document.getElementById('evt-date').value.trim(),
    lieu:          document.getElementById('evt-lieu').value.trim(),
    description:   document.getElementById('evt-desc').value.trim(),
    lien:          document.getElementById('evt-lien').value.trim(),
  };
  const idxStr = document.getElementById('form-event-id').value;
  if (idxStr !== '') {
    infosData.evenements[parseInt(idxStr)] = ev;
  } else {
    ev.id = Date.now();
    infosData.evenements.push(ev);
  }
  infosModifiees = true;
  afficherEvents();
  fermerFormulaireEvent();
  await _sauvegarderTout('badge-agenda', 'btn-sauver-event');
}

async function supprimerEvent(idx) {
  if (!confirm('Supprimer cet événement ?')) return;
  infosData.evenements.splice(idx, 1);
  infosModifiees = true;
  afficherEvents();
  fermerFormulaireEvent();
  await _sauvegarderTout('badge-agenda', null);
}

function remplirFormulairePresentation() {
  const p = infosData.presentation || {};
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setV('pres-titre', p.titre);
  setV('pres-texte', p.texte);
  setV('pres-photo', p.photo);
}

function lireFormulairePresentation() {
  const getV = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  return { titre: getV('pres-titre'), texte: getV('pres-texte'), photo: getV('pres-photo') };
}

async function _sauvegarderTout(badgeId, btnId) {
  const badge    = document.getElementById(badgeId);
  const btn      = document.getElementById(btnId);
  const lblOrig  = btn ? btn.textContent : '';
  if (!token) { alert('Token GitHub requis pour sauvegarder.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'En cours…'; }
  if (badge) { badge.textContent = '…'; badge.className = 'sync-badge'; badge.classList.remove('hidden'); }
  infosData.presentation = lireFormulairePresentation();
  try {
    const contactData = lireFormulaireContact();
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath + 'infos.json',   contenu: JSON.stringify(infosData, null, 2) },
      { chemin: ADMIN_CFG.repoPath + 'contact.json', contenu: JSON.stringify(contactData, null, 2) }
    ], 'Mise à jour infos + contact');
    if (badge) { badge.textContent = '✓'; badge.className = 'sync-badge ok'; setTimeout(() => badge.classList.add('hidden'), 3000); }
    infosModifiees = false;
    toast('✓ Sauvegardé');
  } catch(e) {
    if (badge) { badge.textContent = '✗'; badge.className = 'sync-badge err'; }
    rapporterErreur('Sauvegarde infos/contact échouée : ' + e.message, 'bloquant', e.stack || '');
    toast('Erreur : ' + e.message, 'err', 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lblOrig || 'Enregistrer'; }
  }
}
async function sauvegarderContact() { await _sauvegarderTout('badge-contact', 'btn-gh-sauver-contact'); }
async function sauvegarderPresentation() { await _sauvegarderTout('badge-pres', 'btn-gh-sauver-pres'); }

/* Wirer les boutons */
document.getElementById('btn-ajouter-event').addEventListener('click', () => ouvrirFormulaireEvent(null));
document.getElementById('btn-sauver-event').addEventListener('click', sauverFormulaireEvent);
document.getElementById('btn-annuler-event').addEventListener('click', fermerFormulaireEvent);

// ═══════════════════════════════════════════════
// LIENS ARTISTIQUES (collegues)
// ═══════════════════════════════════════════════
let collegueEnEdition = null;

function afficherCollegues() {
  const liste = document.getElementById('liste-collegues');
  if (!liste) return;
  const cols = infosData.collegues || [];
  if (!cols.length) {
    liste.innerHTML = '<p style="font-size:.8rem;color:var(--muted);padding:.4rem .8rem;">Aucun lien pour l\'instant.</p>';
    return;
  }
  liste.innerHTML = cols.map((c, i) => `
    <div class="event-item">
      <div class="event-info">
        <span class="event-titre">${c.nom || '—'}</span>
        <span class="event-date">${c.type || ''} ${c.lien ? '· <a href="' + c.lien + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">' + (c.lien.replace(/^https?:\/\//, '').split('/')[0]) + '</a>' : ''}</span>
      </div>
      <div style="display:flex;gap:.3rem;">
        <button class="event-btn" onclick="ouvrirFormulaireCollegue(${i})">✏</button>
        <button class="event-btn" onclick="supprimerCollegue(${i})" style="color:var(--danger);">✕</button>
      </div>
    </div>`).join('');
}

function ouvrirFormulaireCollegue(idx) {
  collegueEnEdition = idx === undefined ? null : idx;
  const c = idx !== undefined ? (infosData.collegues || [])[idx] : null;
  document.getElementById('form-collegue-titre').textContent = c ? 'Modifier le lien' : 'Nouveau lien';
  document.getElementById('form-collegue-id').value  = c ? idx : '';
  document.getElementById('col-nom').value    = c?.nom    || '';
  document.getElementById('col-desc').value   = c?.description || '';
  document.getElementById('col-lien').value   = c?.lien   || '';
  document.getElementById('col-type').value   = c?.type   || 'site';
  document.getElementById('form-collegue-err').textContent = '';
  document.getElementById('form-collegue-wrap').style.display = '';
  document.getElementById('col-nom').focus();
}

function fermerFormulaireCollegue() {
  document.getElementById('form-collegue-wrap').style.display = 'none';
  collegueEnEdition = null;
}

async function sauverCollegue() {
  const nom  = document.getElementById('col-nom').value.trim();
  const lien = document.getElementById('col-lien').value.trim();
  if (!nom) { document.getElementById('form-collegue-err').textContent = 'Le nom est requis.'; return; }
  const obj = {
    id:          collegueEnEdition !== null ? (infosData.collegues[collegueEnEdition]?.id || Date.now()) : Date.now(),
    nom,
    description: document.getElementById('col-desc').value.trim(),
    lien,
    type:        document.getElementById('col-type').value,
  };
  if (!infosData.collegues) infosData.collegues = [];
  if (collegueEnEdition !== null) infosData.collegues[collegueEnEdition] = obj;
  else infosData.collegues.push(obj);
  fermerFormulaireCollegue();
  infosModifiees = true;
  afficherCollegues();
  await _sauvegarderTout('badge-liens', 'btn-sauver-collegue');
}

async function supprimerCollegue(idx) {
  if (!confirm('Supprimer ce lien ?')) return;
  infosData.collegues.splice(idx, 1);
  infosModifiees = true;
  afficherCollegues();
  await _sauvegarderTout('badge-liens', null);
}

document.getElementById('btn-ajouter-collegue').addEventListener('click', () => ouvrirFormulaireCollegue());
document.getElementById('btn-sauver-collegue').addEventListener('click', sauverCollegue);
document.getElementById('btn-annuler-collegue').addEventListener('click', fermerFormulaireCollegue);
document.getElementById('btn-enregistrer-contact')?.addEventListener('click', sauvegarderContact);
document.getElementById('btn-enregistrer-pres')?.addEventListener('click', sauvegarderPresentation);
// build: 1780947709
