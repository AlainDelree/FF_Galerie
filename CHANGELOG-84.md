# CHANGELOG — Issue #84 : Échapper le HTML (XSS stocké)

## Sécurité — contact.js & infos.js

Correction d'une XSS stockée possible via `data/contact.json` (et durcissement
de `infos.js`), sans changement d'apparence pour toute donnée légitime.

### contact.js
- Ajout d'un helper `esc()` (échappement HTML : `& < > " '`) et d'un helper
  `urlSure()` (n'accepte que les schémas `http:`/`https:`).
- Email : `data.email` échappé dans le `href="mailto:…"` **et** dans le texte du lien.
- Téléphone : `data.telephone` échappé dans le `href="tel:…"` **et** dans le texte.
- Réseaux sociaux : URL validée par `urlSure()` (un schéma refusé — `javascript:`,
  `data:` — omet proprement l'entrée sans casser le rendu), URL et nom affiché
  (`_nom` ou extraction auto) échappés par `esc()`.
- Les fragments statiques (icônes SVG internes, `r.label`) restent inchangés.

### infos.js
- Le texte passait déjà systématiquement par `textContent` (aucune injection
  HTML) — inchangé.
- Durcissement des deux seuls `href` issus de données : `e.lien` (agenda) et
  `c.lien` (collègues) validés par `urlSure()`. Schéma refusé → lien d'événement
  omis, lien collègue retombe sur `#` (la carte reste affichée).

### Vérification
- `node --check assets/js/contact.js` : OK
- `node --check assets/js/infos.js` : OK
- Rendu visuel identique pour des données normales (les helpers sont neutres sur
  des chaînes sans caractères spéciaux et sur des URL http/https valides).
