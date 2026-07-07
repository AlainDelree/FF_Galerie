// ═══════════════════════════════════════════════
// VUE ARTISTES INVITÉS (Fred uniquement)
// ═══════════════════════════════════════════════

/* Afficher l'onglet uniquement pour Frédérique */
(function () {
  if (ADMIN_CFG.prefix === "ff") {
    const btn = document.getElementById("onglet-artistes");
    if (btn) btn.style.display = "";
  }
})();

let artistesData = [];

/* Chargement au clic sur l'onglet */
async function chargerVueArtistes() {
  try {
    const res = await lireRaw("data/artistes.json");
    artistesData = res || [];
    afficherArtistes();
  } catch (e) {
    artistesData = [];
    afficherArtistes();
  }
}

function afficherArtistes() {
  const liste = document.getElementById("liste-artistes");
  if (!liste) return;
  if (!artistesData.length) {
    liste.innerHTML = "<div class=\"event-vide\">Aucun artiste invité pour l'instant</div>";
    return;
  }
  liste.innerHTML = artistesData.map((a, i) => {
    const badge = a.draft
      ? "<span class=\"artiste-badge draft\">Draft</span>"
      : "<span class=\"artiste-badge live\">En ligne</span>";
    const btnPublier = a.draft
      ? "<button class=\"event-btn\" onclick=\"toggleDraftArtiste(" + i + ")\">Publier</button>"
      : "<button class=\"event-btn\" onclick=\"toggleDraftArtiste(" + i + ")\">Masquer</button>";
    const base = location.origin + "/";
    const urlSite  = base + "artistes/" + a.id + "/";
    const urlAdmin = base + "admin.html?artiste=" + a.id;
    const btnCopier = function(url, id) {
      return "<button class=\"event-btn\" title=\"Copier\" " +
        "onclick=\"navigator.clipboard.writeText('" + url + "').then(function(){" +
          "var b=document.getElementById('cp-" + id + "');b.textContent='✓';setTimeout(function(){b.textContent='⎘';},1500);" +
        "})\" " +
        "id=\"cp-" + id + "\">⎘</button>";
    };
    return "<div class=\"artiste-card\">" +
      "<div class=\"artiste-logo-mini\">" + (a.logo || "?") + "</div>" +
      "<div class=\"artiste-infos\">" +
        "<div class=\"artiste-nom\">" + a.nom + " " + badge + "</div>" +
        "<div class=\"artiste-meta\">" +
          "<span class=\"artiste-url-lbl\">Site</span>" +
          "<span class=\"artiste-url\">" + urlSite + "</span>" +
          btnCopier(urlSite, "s" + i) +
        "</div>" +
        "<div class=\"artiste-meta\">" +
          "<span class=\"artiste-url-lbl\">Admin</span>" +
          "<span class=\"artiste-url\">" + urlAdmin + "</span>" +
          btnCopier(urlAdmin, "a" + i) +
        "</div>" +
      "</div>" +
      "<div class=\"artiste-actions\">" +
        btnPublier +
        "<button class=\"event-btn\" title=\"Modifier\" onclick=\"ouvrirModifierArtiste(" + i + ")\">✏️</button>" +
        "<button class=\"event-btn del\" title=\"Supprimer\" onclick=\"supprimerArtiste(" + i + ")\">✕</button>" +
        "<button class=\"event-btn\" title=\"Vers l'accueil\" onclick=\"ouvrirGalerieArtiste('" + a.id + "')\">↗</button>" +
      "</div>" +
    "</div>";
  }).join("");
}

function ouvrirGalerieArtiste(id) {
  window.open("artistes/" + id + "/", "_blank");
}

async function supprimerArtiste(idx) {
  const a = artistesData[idx];
  /* Modale de confirmation */
  document.getElementById("suppr-artiste-msg").textContent = "Supprimer " + a.nom + " ?";
  const overlay = document.getElementById("overlay-suppr-artiste");
  overlay.style.display = "flex";
  const confirme = await new Promise(resolve => {
    document.getElementById("btn-suppr-confirmer").onclick = () => { overlay.style.display = "none"; resolve(true); };
    document.getElementById("btn-suppr-annuler").onclick   = () => { overlay.style.display = "none"; resolve(false); };
  });
  if (!confirme) return; /* Annulation silencieuse — pas une erreur */
  artistesData.splice(idx, 1);
  try {
    /* Fichiers à supprimer */
    const base = "artistes/" + a.id + "/";
    /* Uniquement les fichiers garantis créés par genererFichiers().
       On inclut les deux emplacements possibles du stock d'œuvres
       (ancien data/toiles.json + nouveau data/oeuvres/<type>.json). */
    const fichiersSup = [
      base + "index.html", base + "galerie.html",
      base + "infos.html", base + "contact.html", base + "admin.html",
      base + "data/toiles.json",
      base + "data/oeuvres/peinture.json",
      base + "data/oeuvres/sculpture.json",
      base + "data/salles.json",
      base + "data/infos.json", base + "data/contact.json"
    ].map(path => ({ path, mode: "100644", type: "blob", sha: null })); /* mode+type requis meme pour suppression */

    /* Commit unique : suppression fichiers + MAJ artistes.json */
    const ref        = await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`);
    const commitSha  = ref.object.sha;
    const baseCommit = await apiGH(`/repos/${REPO}/git/commits/${commitSha}`);

    /* Filtrer : ne supprimer que les fichiers qui existent vraiment dans le repo */
    const treeData     = await apiGH(`/repos/${REPO}/git/trees/${baseCommit.tree.sha}?recursive=1`);
    const existingPaths = new Set(treeData.tree.map(e => e.path));
    const fichiersSupFiltres = fichiersSup.filter(e => existingPaths.has(e.path));

    /* Ajouter artistes.json mis à jour au même tree */
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(artistesData, null, 2))));
    const blob = await apiGH(`/repos/${REPO}/git/blobs`, "POST", { content: b64, encoding: "base64" });
    const tree = await apiGH(`/repos/${REPO}/git/trees`, "POST", {
      base_tree: baseCommit.tree.sha,
      tree: [...fichiersSupFiltres, { path: "data/artistes.json", mode: "100644", type: "blob", sha: blob.sha }]
    });
    const commit = await apiGH(`/repos/${REPO}/git/commits`, "POST", {
      message: "Suppression artiste : " + a.nom,
      tree: tree.sha, parents: [commitSha]
    });
    try {
      await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, "PATCH", { sha: commit.sha, force: false });
    } catch(e) {
      if (e.message && (e.message.includes("fast forward") || e.message.includes("Update is not"))) {
        await apiGH(`/repos/${REPO}/git/refs/heads/${BRANCH}`, "PATCH", { sha: commit.sha, force: true });
      } else throw e;
    }

    afficherArtistes();
    if (artisteEditIdx !== null && (artisteEditIdx === idx || artisteEditIdx >= artistesData.length)) {
      artisteEditIdx = null;
      document.getElementById("form-artiste-wrap").style.display = "none";
    }
  } catch(e) {
    artistesData.splice(idx, 0, a); // rollback
    rapporterErreur("Suppression artiste échouée : " + e.message, "bloquant", e.stack || "");
    alert("Erreur : " + e.message);
  }
}

async function toggleDraftArtiste(idx) {
  const artiste = artistesData[idx];
  artiste.draft = !artiste.draft;
  const publier = !artiste.draft; // true = on publie (retire noindex)
  const base = artiste.lien;     // ex: "artistes/daw/"
  const NOINDEX = '  <meta name="robots" content="noindex, nofollow">\n';
  const CHARSET = '  <meta charset="UTF-8">\n';
  const modifs = [];
  for (const page of ['index.html', 'galerie.html', 'infos.html', 'contact.html']) {
    const chemin = base + page;
    try {
      const r = await apiGH('/repos/' + REPO + '/contents/' + chemin + '?ref=' + BRANCH);
      let c = decodeURIComponent(escape(atob(r.content.replace(/\s/g, ''))));
      if (publier) {
        c = c.replace(NOINDEX, '');
      } else if (!c.includes('noindex')) {
        c = c.replace(CHARSET, CHARSET + NOINDEX);
      }
      modifs.push({ chemin, contenu: c });
    } catch(e) { /* page absente, on ignore */ }
  }
  const prefMsg = publier ? 'Publication artiste : ' : 'Masquage artiste : ';
  await commitMulti([
    ...modifs,
    { chemin: 'data/artistes.json', contenu: JSON.stringify(artistesData, null, 2) }
  ], prefMsg + artiste.nom);
  afficherArtistes();
}

/* ── Formulaire nouvel artiste ── */
function slugify(nom) {
  return nom.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 12);
}
function initiales(nom) {
  return nom.split(/\s+/).map(w => w[0] || "").join("").slice(0, 4).toUpperCase();
}

let artisteEditIdx = null; /* null = création, nombre = modification */

document.getElementById("btn-ajouter-artiste").addEventListener("click", () => {
  artisteEditIdx = null;
  document.getElementById("form-artiste-titre").textContent = "Nouvel artiste invité";
  document.getElementById("btn-sauver-artiste").textContent = "✦ Créer l'espace";
  document.getElementById("art-nom").value   = "";
  document.getElementById("art-id").value    = "";
  document.getElementById("art-logo").value  = "";
  document.getElementById("art-genre").value = "f";
  document.getElementById("art-draft").checked = true;
  document.getElementById("art-id").removeAttribute("readonly");
  document.getElementById("art-id").style.opacity = "";
  document.getElementById("form-artiste-err").textContent = "";
  document.getElementById("artiste-progress").style.display = "none";
  document.getElementById("form-artiste-wrap").style.display = "";
  document.getElementById("art-nom").focus();
});

function ouvrirModifierArtiste(idx) {
  const a = artistesData[idx];
  artisteEditIdx = idx;
  document.getElementById("form-artiste-titre").textContent = "Modifier — " + a.nom;
  document.getElementById("btn-sauver-artiste").textContent = "💾 Enregistrer";
  document.getElementById("art-nom").value   = a.nom   || "";
  document.getElementById("art-id").value    = a.id    || "";
  document.getElementById("art-logo").value  = a.logo  || "";
  document.getElementById("art-genre").value = a.genre || "f";
  document.getElementById("art-draft").checked = !!a.draft;
  /* id non modifiable en édition */
  document.getElementById("art-id").setAttribute("readonly", true);
  document.getElementById("art-id").style.opacity = "0.5";
  document.getElementById("form-artiste-err").textContent = "";
  document.getElementById("artiste-progress").style.display = "none";
  document.getElementById("form-artiste-wrap").style.display = "";
  document.getElementById("art-nom").focus();
}

document.getElementById("art-nom").addEventListener("input", function () {
  const v = this.value.trim();
  if (!document.getElementById("art-id").dataset.modifie)
    document.getElementById("art-id").value = slugify(v);
  if (!document.getElementById("art-logo").dataset.modifie)
    document.getElementById("art-logo").value = initiales(v);
});
document.getElementById("art-id").addEventListener("input",   function () { this.dataset.modifie = "1"; });
document.getElementById("art-logo").addEventListener("input",  function () { this.dataset.modifie = "1"; });

document.getElementById("btn-annuler-artiste").addEventListener("click", () => {
  document.getElementById("form-artiste-wrap").style.display = "none";
  delete document.getElementById("art-id").dataset.modifie;
  delete document.getElementById("art-logo").dataset.modifie;
});

document.getElementById("btn-sauver-artiste").addEventListener("click", creerArtiste);

/* ── Création complète ── */
async function creerArtiste() {
  const nom   = document.getElementById("art-nom").value.trim();
  const id    = document.getElementById("art-id").value.trim().toLowerCase();
  const logo  = document.getElementById("art-logo").value.trim().toUpperCase() || id.slice(0,4).toUpperCase();
  const genre = document.getElementById("art-genre").value;
  /* Le « type de galerie » n'existe plus : un invité supporte les deux types
     (dispatch par salle via galerie-core.js). On garde a.type en interne pour les
     replis techniques (ADMIN_CFG.type) : 'peinture' par défaut, préservé en édition. */
  const type  = (artisteEditIdx !== null && artistesData[artisteEditIdx])
    ? (artistesData[artisteEditIdx].type || "peinture")
    : "peinture";
  const draft = document.getElementById("art-draft").checked;
  const err   = document.getElementById("form-artiste-err");
  const prog  = document.getElementById("artiste-progress");

  if (!nom) { err.textContent = "Le nom est obligatoire."; return; }

  /* ── Mode modification ── */
  if (artisteEditIdx !== null) {
    const a = artistesData[artisteEditIdx];
    const ancienNom  = a.nom;
    const ancienLogo = a.logo;
    a.nom   = nom;
    a.logo  = logo;
    a.genre = genre;
    a.type  = type;
    a.draft = draft;
    err.textContent = "";
    prog.style.display = "";
    prog.textContent = "En cours…";
    document.getElementById("btn-sauver-artiste").disabled = true;
    try {
      /* artiste-info.js rend les pages dynamiques → seul artistes.json à mettre à jour */
      await commitMulti(
        [{ chemin: "data/artistes.json", contenu: JSON.stringify(artistesData, null, 2) }],
        "Modification artiste : " + nom
      );
      prog.textContent = "✓ Enregistré";
      document.getElementById("form-artiste-wrap").style.display = "none";
      afficherArtistes();
    } catch (e) { err.textContent = "Erreur : " + e.message; prog.style.display = "none"; rapporterErreur("Modification artiste échouée : " + e.message, "bloquant", e.stack || ""); }
    document.getElementById("btn-sauver-artiste").disabled = false;
    return;
  }

  /* ── Mode création ── */
  if (!id || !/^[a-z0-9]+$/.test(id)) { err.textContent = "L'identifiant ne peut contenir que des lettres et chiffres."; return; }
  if (artistesData.find(a => a.id === id)) { err.textContent = "Cet identifiant existe déjà."; return; }

  err.textContent = "";
  prog.style.display = "";
  prog.textContent = "Génération des fichiers…";
  document.getElementById("btn-sauver-artiste").disabled = true;

  const artiste = { id, nom, logo, genre, type,
    lien: "artistes/" + id + "/",
    repoPath: "artistes/" + id + "/data/",
    prefix: id, draft };

  _tplCache = null; /* forcer rechargement templates frais */
  try {
    const fichiers = await genererFichiers(artiste);
    /* Inclure artistes.json dans le même commit — évite le conflit "not a fast forward" */
    const { lien, repoPath, prefix } = artiste;
    const nouveauxArtistes = artistesData.concat([{ id, nom, logo, lien, repoPath, prefix, draft, genre, type }]);
    fichiers.push({ chemin: "data/artistes.json", contenu: JSON.stringify(nouveauxArtistes, null, 2) });
    prog.textContent = "Création sur GitHub (" + fichiers.length + " fichiers)…";
    await commitMulti(fichiers, "Nouvel artiste invité : " + nom);
    artistesData = nouveauxArtistes;
    document.getElementById("form-artiste-wrap").style.display = "none";
    afficherArtistes();
    /* Modal confirmation déploiement */
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;";
    overlay.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:1.6rem 2rem;max-width:380px;width:90%;text-align:center;">' +
      '<div style="font-size:1.5rem;margin-bottom:.8rem;">✅</div>' +
      '<div style="font-weight:600;margin-bottom:.6rem;color:var(--gold);">Espace créé avec succès !</div>' +
      '<div style="font-size:.82rem;color:var(--muted);line-height:1.6;margin-bottom:1.2rem;">Les pages de l\'artiste seront accessibles dans <strong>1 à 2 minutes</strong>, le temps que GitHub déploie les fichiers.</div>' +
      '<button id="btn-ok-deploy" class="btn btn-or" style="width:100%;">OK</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("btn-ok-deploy").onclick = function(){ overlay.remove(); };
  } catch (e) {
    err.textContent = "Erreur : " + e.message;
    prog.style.display = "none";
    rapporterErreur("Création artiste échouée : " + e.message, "bloquant", e.stack || "");
  }
  document.getElementById("btn-sauver-artiste").disabled = false;
}

/* ── Chargement et cache des templates HTML ── */
let _tplCache = null;
async function chargerTemplates() {
  if (_tplCache) return _tplCache;
  const noms = ['index', 'galerie', 'galerie-edit',
                'galerie-apercu', 'galerie-apercu-peinture',
                'descriptive-apercu', 'immersive-apercu',
                'infos', 'contact', 'admin'];
  const resultats = await Promise.all(
    noms.map(n => fetch('templates/artiste-' + n + '.html?v=' + Date.now()).then(r => {
      if (!r.ok) throw new Error('Template introuvable : artiste-' + n + '.html');
      return r.text();
    }))
  );
  _tplCache = {};
  noms.forEach((n, i) => { _tplCache[n] = resultats[i]; });
  return _tplCache;
}

/* ── Générateur de fichiers ── */
async function genererFichiers(a) {
  const tpls = await chargerTemplates();
  const invite = a.genre === "m" ? "Invité" : a.genre === "n" ? "Invité·e" : "Invitée";
  const emailU = a.email ? a.email.split("@")[0] : "";
  const emailD = a.email ? a.email.split("@")[1] : "";
  const base   = "artistes/" + a.id + "/";

  function r(tpl) {
    return tpl
      .replace(/{{NOM}}/g,              a.nom)
      .replace(/{{LOGO}}/g,             a.logo)
      .replace(/{{ID}}/g,               a.id)
      .replace(/{{INVITE}}/g,           invite)
      .replace(/{{EMAIL_U}}/g,          emailU)
      .replace(/{{EMAIL_D}}/g,          emailD)
      .replace(/{{TOILES_PATH}}/g,      "data/oeuvres/peinture.json");
  }

  /* ── JSON peinture ── */
  const toilesPeinture = JSON.stringify({
    tailles: [{code:"XXS",label:"Très petite"},{code:"XS",label:"Petite"},
              {code:"M",label:"Moyenne"},{code:"XL",label:"Grande"},
              {code:"XXL",label:"Très grande"},{code:"E",label:"Étirée"}],
    toiles: []
  }, null, 2);

  /* ── JSON sculpture ── */
  const toilesScupture = JSON.stringify({
    gabarits: [
      { code: "S",   label: "Petit",  largeur_cm: 20 },
      { code: "M",   label: "Moyen",  largeur_cm: 35 },
      { code: "L",   label: "Grand",  largeur_cm: 55 },
      { code: "SOL", label: "Au sol", largeur_cm: 70 }
    ],
    pieces: []
  }, null, 2);

  /* Galerie multi-type : l'invité démarre SANS salle (le type se choisit à la
     création de chaque salle depuis son admin ; galerie-core.js dispatche par
     salle.type). Repli « travaux » côté public tant qu'aucune salle. */
  const sallesVides = JSON.stringify({ salles: [] }, null, 2);

  const infos = JSON.stringify({ evenements: [], collegues: [] }, null, 2);

  const contact = JSON.stringify({
    email:"", telephone:"", instagram:"", facebook:"", tiktok:"",
    pinterest:"", youtube:"", twitter:"", linkedin:"", site:""
  }, null, 2);

  return [
    { chemin: base + "data/oeuvres/peinture.json",  contenu: toilesPeinture },
    { chemin: base + "data/oeuvres/sculpture.json", contenu: toilesScupture },
    { chemin: base + "data/salles.json",  contenu: sallesVides },
    { chemin: base + "data/infos.json",   contenu: infos    },
    { chemin: base + "data/contact.json", contenu: contact  },
    { chemin: base + "index.html",       contenu: r(tpls.index)   },
    { chemin: base + "galerie.html",     contenu: r(tpls.galerie) },
    { chemin: base + "galerie-edit.html", contenu: r(tpls['galerie-edit']) },
    { chemin: base + "galerie-apercu.html",          contenu: r(tpls['galerie-apercu']) },
    { chemin: base + "galerie-apercu-peinture.html", contenu: r(tpls['galerie-apercu-peinture']) },
    { chemin: base + "descriptive-apercu.html",      contenu: r(tpls['descriptive-apercu']) },
    { chemin: base + "immersive-apercu.html",        contenu: r(tpls['immersive-apercu']) },
    { chemin: base + "infos.html",       contenu: r(tpls.infos)   },
    { chemin: base + "contact.html",     contenu: r(tpls.contact) },
    { chemin: base + "admin.html",       contenu: r(tpls.admin)   },
  ];
}
