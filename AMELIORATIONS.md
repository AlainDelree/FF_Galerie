# FF_Galerie — Liste d'améliorations
> Repris à zéro le 2026-08-25 — l'historique détaillé (gains immédiats, performance images, architecture, infra) est archivé dans `git log` et les commits de l'époque ; ce fichier ne garde que ce qui reste réellement à faire.

**Légende effort :** 🟢 rapide (< 30 min) · 🟡 moyen (1–3 h) · 🔴 chantier (> 3 h)
**Légende impact :** ⭐ cosmétique · ⭐⭐ utile · ⭐⭐⭐ critique

---

## To-do active

_Rien pour l'instant._

---

## Idées futures (non planifiées)

- [ ] 💡 **Palette de couleurs par artiste invité**
- [ ] 💡 **Choix du nombre de silhouettes par plan de profondeur** dans l'admin (actuellement aléatoire dans `genererSilhouettes()`)

---

## Fait — pour mémoire (détail dans `git log`)

- Rendu galerie desktop, admin gestion musique, HTTPS enforce
- Sécurité : restriction domaine EmailJS, PAT fine-grained, révocation token classic Fred
- Performance images : miniatures + plein format WebP, srcset, préchargement (60 fichiers `.webp`), lazy loading natif confirmé efficace sur GSM (25/08/2026)
- Architecture : templates HTML externalisés, `admin.js` splitté en modules, `galerie.js` → core + renderers, propagation automatique du `<head>`
- Infra : Cloudflare Workers, `dev.frederiqueferette.be`, PWA (`sw.js`, `manifest.webmanifest`, `app-worker/`)
- Galerie sculpture : renderer complet, admin complet (greffons, scénarios vitrine, gabarits/supports, anti-chevauchement) — pas juste les fondations, tout le système vitrine est en place

---

*Mis à jour 2026-08-25*
