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
    /* Uniquement les fichiers garantis créés par genererFichiers() */
    const fichiersSup = [
      base + "index.html", base + "galerie.html",
      base + "infos.html", base + "contact.html", base + "admin.html",
      base + "data/toiles.json", base + "data/salles.json",
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
      const r = await apiGH('/repos/' + REPO + '/contents/' + chemin);
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
  document.getElementById("art-type").value  = "peinture";
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
  document.getElementById("art-type").value  = a.type  || "peinture";
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
  const type  = document.getElementById("art-type").value;
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
    /* Message délai déploiement — affiché dans la liste, hors du form */
    var banner = document.createElement("div");
    banner.textContent = "✓ Espace créé ! Les pages seront accessibles dans 1-2 minutes (déploiement GitHub en cours).";
    banner.style.cssText = "padding:.6rem 1rem;background:rgba(200,160,80,.15);color:var(--gold);border-radius:4px;font-size:.8rem;margin-bottom:.6rem;";
    var liste = document.getElementById("liste-artistes");
    liste.insertBefore(banner, liste.firstChild);
    setTimeout(function(){ banner.remove(); }, 10000);
  } catch (e) {
    err.textContent = "Erreur : " + e.message;
    prog.style.display = "none";
    rapporterErreur("Création artiste échouée : " + e.message, "bloquant", e.stack || "");
  }
  document.getElementById("btn-sauver-artiste").disabled = false;
}

async function sauvegarderArtistesJSON(message) {
  await commitMulti([
    { chemin: "data/artistes.json", contenu: JSON.stringify(artistesData, null, 2) }
  ], message);
}

/* ── Chargement et cache des templates HTML ── */
let _tplCache = null;
async function chargerTemplates() {
  if (_tplCache) return _tplCache;
  const noms = ['index', 'galerie', 'infos', 'contact', 'admin'];
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
  const renderer = (a.type === "sculpture") ? "galerie-sculpture.js" : "galerie-peinture.js";

  function r(tpl) {
    return tpl
      .replace(/{{NOM}}/g,              a.nom)
      .replace(/{{LOGO}}/g,             a.logo)
      .replace(/{{ID}}/g,               a.id)
      .replace(/{{INVITE}}/g,           invite)
      .replace(/{{EMAIL_U}}/g,          emailU)
      .replace(/{{EMAIL_D}}/g,          emailD)
      .replace(/{{GALERIE_RENDERER}}/g, renderer);
  }

  /* ── JSON peinture ── */
  const toilesPeinture = JSON.stringify({
    tailles: [{code:"XXS",label:"Très petite"},{code:"XS",label:"Petite"},
              {code:"M",label:"Moyenne"},{code:"XL",label:"Grande"},
              {code:"XXL",label:"Très grande"},{code:"E",label:"Étirée"}],
    toiles: []
  }, null, 2);

  const sallesPeinture = JSON.stringify({
    salles: [{id:1,nom:"Salle I",theme:"",couleur_mur:"#1e1e1e",
      couleur_cadres:"#3a3a3a",texture:"none",visible:true,toiles:[],positions:[]}]
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

  const sallesSculpture = JSON.stringify({
    salles: [{id:1,nom:"Salle I",theme:"",couleur_mur:"#2a2520",couleur_sol:"#b8a890",
      texture:"none",visible:true,pieces:[],positions:[]}]
  }, null, 2);

  const estSculpture = a.type === "sculpture";
  const toiles = estSculpture ? toilesScupture  : toilesPeinture;
  const salles = estSculpture ? sallesSculpture : sallesPeinture;

  const infos = JSON.stringify({ evenements: [], collegues: [] }, null, 2);

  const contact = JSON.stringify({
    email:"", telephone:"", instagram:"", facebook:"", tiktok:"",
    pinterest:"", youtube:"", twitter:"", linkedin:"", site:""
  }, null, 2);

  return [
    { chemin: base + "data/toiles.json",  contenu: toiles   },
    { chemin: base + "data/salles.json",  contenu: salles   },
    { chemin: base + "data/infos.json",   contenu: infos    },
    { chemin: base + "data/contact.json", contenu: contact  },
    { chemin: base + "index.html",       contenu: r(tpls.index)   },
    { chemin: base + "galerie.html",     contenu: r(tpls.galerie) },
    { chemin: base + "infos.html",       contenu: r(tpls.infos)   },
    { chemin: base + "contact.html",     contenu: r(tpls.contact) },
    { chemin: base + "admin.html",       contenu: r(tpls.admin)   },
  ];
}
