// ═══════════════════════════════════════════════
// ADMIN-BACKUP.JS — Backup / Rollback
// Dépend de : commitMulti, apiGH, toast, $, ADMIN_CFG, REPO, BRANCH,
//             commitARestaurer (admin.js)
// ═══════════════════════════════════════════════

// BACKUP / ROLLBACK
// ═══════════════════════════════════════════════
async function chargerCommits() {
  const cont = $('commits-contenu');
  // Garde-fou : si l'élément n'existe pas, log et sort proprement
  if (!cont) {
    console.error('[BACKUP] Élément #commits-contenu introuvable dans le DOM');
    if (typeof toast === 'function') toast('Erreur : conteneur backup absent', 'err', 4000);
    return;
  }
  // Garde-fou : vérifie les dépendances avant l'appel API
  if (typeof apiGH !== 'function' || typeof REPO === 'undefined' || typeof ADMIN_CFG === 'undefined') {
    cont.innerHTML = '<div class="chargement" style="color:var(--danger)">Erreur : modules admin non chargés (apiGH/REPO/ADMIN_CFG manquant)</div>';
    return;
  }
  cont.innerHTML = '<div class="chargement"><svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Chargement…</div>';
  try {
    const url = `/repos/${REPO}/commits?path=${ADMIN_CFG.repoPath}toiles.json&per_page=50`;
    const tousCommits = await apiGH(url);
    // Diagnostic : log explicite pour faciliter le debug
    console.log(`[BACKUP] API GitHub a renvoyé ${Array.isArray(tousCommits) ? tousCommits.length : 'non-tableau'} commits pour ${ADMIN_CFG.repoPath}toiles.json`);
    if (!Array.isArray(tousCommits)) {
      cont.innerHTML = `<div class="chargement" style="color:var(--danger)">Erreur : réponse API inattendue (type ${typeof tousCommits}). Vérifier le token GitHub.</div>`;
      return;
    }
    if (tousCommits.length === 0) {
      cont.innerHTML = `<div class="chargement" style="color:var(--muted)">Aucun commit trouvé sur <code>${ADMIN_CFG.repoPath}toiles.json</code>.<br><small>Vérifier le chemin et les permissions du token.</small></div>`;
      return;
    }
    // Garde uniquement les commits admin (préfixe "Admin :") + le plus récent quel qu'il soit
    const commits = tousCommits.filter((c, i) =>
      i === 0 || c.commit.message.toLowerCase().startsWith('admin :')
    );
    console.log(`[BACKUP] Après filtrage "Admin :" : ${commits.length} commits affichables sur ${tousCommits.length} reçus`);
    if (!commits.length) {
      cont.innerHTML = `<div class="chargement" style="color:var(--muted)">Aucun historique restaurable.<br><small>${tousCommits.length} commits reçus mais aucun ne correspond au filtre "Admin :".</small></div>`;
      return;
    }
    cont.innerHTML = '';
    const liste = document.createElement('div'); liste.className = 'commits-liste';
    commits.forEach((c, i) => {
      const msg = c.commit.message.replace(/^Admin\s*:\s*/i, '');
      const date = formaterDate(c.commit.author.date);
      const item = document.createElement('div'); item.className = 'commit-item';
      item.innerHTML = `
        <div style="width:2rem;height:2rem;border-radius:50%;background:${i===0?'rgba(200,160,80,.15)':'var(--bg3)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${i===0?'var(--gold)':'var(--muted)'}" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
        </div>
        <div class="commit-corps">
          <div class="commit-msg">${msg}</div>
          <div class="commit-date">${date}</div>
        </div>
        ${i===0 ? '<span class="commit-actuel">Actuel</span>' : `<button class="btn btn-outline btn-sm" data-sha="${c.sha}" data-msg="${msg.replace(/"/g,'')}" data-date="${date}">Restaurer</button>`}`;
      liste.appendChild(item);
    });
    cont.appendChild(liste);
    cont.querySelectorAll('[data-sha]').forEach(btn => {
      btn.addEventListener('click', () => demanderRestauration(btn.dataset.sha, btn.dataset.msg, btn.dataset.date));
    });
  } catch (e) {
    console.error('[BACKUP] Erreur chargerCommits :', e);
    cont.innerHTML = `<div class="chargement" style="color:var(--danger)">Erreur : ${e.message || e}<br><small>Voir la console (F12) pour la stack complète.</small></div>`;
  }
}

function demanderRestauration(sha, msg, date) {
  commitARestaurer = sha;
  $('restore-txt1').innerHTML = `Restaurer à l'état du :<br><strong>${date}</strong><br><br>Version : <em>${msg}</em><br><br>Toutes les modifications <strong>après cette date</strong> seront annulées.`;
  $('restore-txt2').innerHTML = `Restauration vers :<br><strong style="color:var(--gold)">${msg}</strong><br><strong style="color:var(--danger)">${date}</strong>`;
  $('inp-restore').value = '';
  $('btn-restore-ok').disabled = true;
  document.querySelectorAll('.restore-step').forEach(s => s.classList.remove('active'));
  $('restore-s1').classList.add('active');
  $('overlay-restore').classList.add('ouvert');
}

async function executerRestauration() {
  const btn = $('btn-restore-ok'); btn.disabled = true; btn.textContent = '⟳ Restauration…';
  try {
    const [tf, sf] = await Promise.all([
      apiGH(`/repos/${REPO}/contents/${ADMIN_CFG.repoPath}toiles.json?ref=${commitARestaurer}`),
      apiGH(`/repos/${REPO}/contents/${ADMIN_CFG.repoPath}salles.json?ref=${commitARestaurer}`)
    ]);
    await commitMulti([
      { chemin: ADMIN_CFG.repoPath+'toiles.json', contenu: tf.content.replace(/\n/g, ''), encoding: 'base64' },
      { chemin: ADMIN_CFG.repoPath+'salles.json', contenu: sf.content.replace(/\n/g, ''), encoding: 'base64' }
    ], `Admin : Restauration vers ${commitARestaurer.substring(0, 7)}`);
    $('overlay-restore').classList.remove('ouvert');
    syncBadge('ok');
    toast('✓ Restauration effectuée — rechargement…');
    await chargerTout();
  } catch (e) { toast('Erreur : ' + e.message, 'err', 4000); btn.disabled = false; btn.textContent = 'Restaurer'; }
}

// ═══════════════════════════════════════════════
