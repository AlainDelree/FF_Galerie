# Smoke Test — Checklist avant merge dev → main

> À dérouler sur `dev.frederiqueferette.be` **avant chaque merge vers `main`**.
> Si une case rate, on ne merge pas. On logue le bug dans `BUGS.md` et on corrige.
>
> Durée estimée : 10–15 minutes pour la version complète, ~5 min pour les items critiques 🔄.
> Tester en **navigation privée** pour simuler une session fraîche (évite les surprises de cache).

## Légende

- 💻 — Tester sur **PC** uniquement (ou suffisant sur PC)
- 📱 — Tester sur **GSM** uniquement (ou comportement spécifique mobile)
- 🔄 — **Tester sur les deux** (item critique, parfois divergent : BUG-001 et BUG-002 viennent de là)

---

## 1. Pages publiques — Frédérique (site principal)

- 🔄 **Accueil** (`/`) — plan SVG dynamique affiché, salles cliquables
- 💻 **Galerie desktop** (`galerie.html`) — toutes les salles s'affichent, toiles placées correctement
- 📱 **Galerie mobile** — version responsive, navigation entre salles OK (swipe / boutons)
- 🔄 **Infos** (`infos.html`) — contenu chargé depuis JSON
- 🔄 **Contact** (`contact.html`) — formulaire visible, champs fonctionnels
- 💻 **À propos** (`apropos.html`) — page chargée
- 💻 **Choix cadres** (`choix-cadres.html`) — page chargée
- 🔄 **Aucune erreur console** sur ces pages (F12 sur PC ; sur GSM : Chrome remote debugging si dispo)

## 2. Pages publiques — artistes invités

Pour chaque artiste : Daw, Alain Delree, Raoul, Dinso.

- 💻 **Accueil artiste** (`artistes/{id}/`) — page chargée, bandeau "artiste invité" présent
- 💻 **Galerie artiste** — toiles/socles affichés correctement
- 📱 **Galerie artiste mobile** — responsive OK
- 💻 **Dinso** — galerie sculpture, socles + GLB chargés (vérifier au moins 1 GLB rendu)
- 💻 Balise `noindex` présente dans le HTML des artistes en brouillon (View source)

## 3. Admin Frédérique (`admin.html`) — 🔄 obligatoire PC + GSM

> Cette section est la plus critique. Tous les items doivent passer sur PC **et** sur GSM.
> C'est ici que BUG-001 (PC) et BUG-002 (GSM) ont été observés — donc validation croisée obligatoire.

- 🔄 **Chargement initial** — page s'affiche sans écran blanc, sans spinner infini
- 🔄 **Login GitHub** — saisie token, validation OK
- 🔄 **Liste des salles** affichée à gauche, navigation entre salles OK
- 🔄 **Mur d'aperçu — aspect-ratio respecté** (12:8 ≈ 1.5)
  - Vérifier sur Entrée (2 toiles), Couloir (3 toiles), Buanderie (3 toiles), Bureau (vide)
  - Les cellules vides du grid doivent être carrées
  - La hauteur du mur ne doit pas changer entre les salles
- 🔄 **Texture image visible** dans le mur d'aperçu (Couloir = écorce-grosse) — corrigé BUG-003
- 🔄 **Sélection toile** — clic affiche miniature, badge taille (XXS/XS/M/XL/XXL/E)
- 🔄 **Stock** — tri vert (disponibles), gris (placées ici), rouge (placées ailleurs)
- 🔄 **Mode Arranger** — bouton ouvre vue plein écran
- 🔄 **Placement clic + flèches** — clic sur toile dans le strip → clic sur cellule du mur pour placer ; clic sur toile posée → flèches haut/bas/gauche/droite s'affichent et permettent de déplacer
- 🔄 **Apparence dans Arranger** — couleur de fond + texture identiques à l'aperçu admin (BUG-004 fixé)
- 🔄 **Mode Arranger — aspect-ratio** — la grille en plein écran doit aussi respecter 12:8 sur toutes les salles
- 🔄 **Bouton "Tout mettre"** — place toutes les toiles disponibles
- 🔄 **Bottom sheet Couleurs/Textures** — s'ouvre, sélection persiste
- 🔄 **Sauvegarde** — bouton sauver → notification succès, pas d'erreur
- 🔄 **Reload après save** — données persistées correctement (rouvrir admin, vérifier modif)
- 🔄 **Page Backup** — liste des commits visible, panneau EmailJS replié par défaut — corrigé BUG-001
  - Cliquer sur "▶ Notifications email" → le panneau se déploie
  - Re-cliquer → se replie
- 🔄 **Gestion Infos/Agenda** — édition + sauvegarde OK
- 🔄 **Gestion Artistes Invités** — création / suppression OK
- 🔄 **Aucune erreur console** pendant tout le parcours

## 4. Admins artistes invités

Pour chaque admin (Daw, Alain Delree, Raoul, Dinso) :

- 💻 **Chargement** OK
- 💻 **Login** OK
- 💻 **Liste salles + mur aperçu** cohérents (aspect-ratio respecté)
- 💻 **Sauvegarde** sans erreur

### Admin Dinso spécifique (sculpture)

- 💻 Sélecteur sol (parquet/carrelage/moquette/none) fonctionne
- 💻 Champ profondeur visible
- 💻 Champ GLB visible
- 💻 Champs peinture (taille XXS-E, etc.) masqués
- 💻 Mode placement WYSIWYG (iframe `galerie-edit.html`) charge
- 💻 Drag socles dans iframe fonctionne en PC
- 📱 Drag socles dans iframe fonctionne en GSM (à finaliser selon TODO)
- 💻 Sauvegarde sculpture conserve `type:"sculpture"` dans `salles.json`

## 5. Workflow critique — sauvegarde complète

- 💻 Modifier 1 toile dans admin Fred → sauver → recharger admin → modif présente
- 💻 Modifier 1 toile → sauver → ouvrir galerie publique → modif présente
- 💻 Vérifier que `data/salles.json` sur GitHub a bien été mis à jour (via l'interface web GitHub)
- 💻 Faire 2 sauvegardes rapides successives → vérifier qu'aucune n'est perdue (queue commits)

## 6. Reporting d'erreurs

- 💻 Provoquer une erreur volontaire (ex. token invalide) → vérifier que `rapporterErreur()` est appelé (console : log présent)
- 💻 Vérifier création GitHub Issue (anti-spam : max 3/24h, donc tester avec parcimonie)
- 📱 Vérifier réception email EmailJS — à tester sur GSM aussi pour vérifier que l'envoi marche depuis mobile (cf. TODO global)

---

## Express checklist (5 min) — les items 🔄 critiques uniquement

Si tu n'as pas le temps pour la version complète :

1. Admin Fred PC + GSM : login, navigation salles, mur d'aperçu aspect-ratio, mode Arranger, sauvegarde, page Backup
2. Galerie publique PC + GSM : toiles bien affichées
3. Une sauvegarde end-to-end : modif admin → galerie publique reflète

---

## En cas d'échec

1. Loguer le bug dans `docs/BUGS.md` (ID incrémental, description, repro, hypothèses)
2. **Ne pas merger vers main**
3. Corriger sur dev
4. Re-dérouler la section concernée de la checklist
5. Une fois OK : merger
