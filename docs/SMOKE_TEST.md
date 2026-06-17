# Smoke Test — Checklist avant merge dev → main

> À dérouler sur `dev.frederiqueferette.be` **avant chaque merge vers `main`**.
> Si une case rate, on ne merge pas. On logue le bug dans `BUGS.md` et on corrige.
>
> Durée estimée : 5–10 minutes. Tester en navigation privée pour simuler une session fraîche.

---

## 1. Pages publiques — Frédérique (site principal)

- [ ] **Accueil** (`/`) — plan SVG dynamique affiché, salles cliquables
- [ ] **Galerie** (`galerie.html`) — toutes les salles s'affichent, toiles placées correctement
- [ ] **Galerie GSM** — version mobile responsive, navigation entre salles OK
- [ ] **Infos** (`infos.html`) — contenu chargé depuis JSON
- [ ] **Contact** (`contact.html`) — formulaire visible, champs fonctionnels
- [ ] **À propos** (`apropos.html`) — page chargée
- [ ] **Choix cadres** (`choix-cadres.html`) — page chargée
- [ ] **Aucune erreur console** sur ces pages (F12 → Console vide)

## 2. Pages publiques — artistes invités

- [ ] **Daw** (`artistes/daw/`) — accueil + galerie OK
- [ ] **Alain Delree** (`artistes/alaindelree/`) — accueil + galerie OK
- [ ] **Raoul** (`artistes/raoul/`) — accueil + galerie OK
- [ ] **Dinso** (`artistes/dinso/`) — accueil + galerie sculpture OK, socles affichés
- [ ] Bandeau "artiste invité" / "draft" présent sur les artistes en brouillon
- [ ] Balise `noindex` présente dans le HTML des artistes en brouillon

## 3. Admin Frédérique (`admin.html`)

- [ ] **Chargement initial** — page s'affiche sans écran blanc
- [ ] **Login GitHub** — saisie token, validation OK
- [ ] **Liste des salles** affichée à gauche
- [ ] **Mur d'aperçu** — dimensions cohérentes entre TOUTES les salles (Entrée, Couloir, Salon, etc.)
- [ ] **Sélection toile** — clic affiche miniature, badge taille (XXS/XS/M/XL/XXL/E)
- [ ] **Stock** — tri vert (disponibles), gris (placées ici), rouge (placées ailleurs)
- [ ] **Mode Arranger** — bouton ouvre vue plein écran
- [ ] **Drag PC** — drag toile dans Arranger fonctionne
- [ ] **Drag GSM (tactile)** — testable sur téléphone
- [ ] **Bouton "Tout mettre"** — place toutes les toiles disponibles
- [ ] **Bottom sheet Couleurs/Textures** — s'ouvre, sélection persiste
- [ ] **Sauvegarde** — bouton sauver → notification succès
- [ ] **Reload après save** — données persistées correctement
- [ ] **Page Backup** — contenu présent (liste des backups, boutons restauration)
- [ ] **Gestion Infos/Agenda** — édition + sauvegarde OK
- [ ] **Aucune erreur console** pendant tout le parcours

## 4. Admins artistes invités

Pour chaque admin (Daw, Alain Delree, Raoul, Dinso) :

- [ ] **Chargement** OK
- [ ] **Login** OK
- [ ] **Liste salles + mur aperçu** cohérents
- [ ] **Sauvegarde** sans erreur
- [ ] **Admin Dinso spécifique** :
  - [ ] Sélecteur sol (parquet/carrelage/moquette/none) fonctionne
  - [ ] Champ profondeur visible
  - [ ] Champ GLB visible
  - [ ] Champs peinture (taille XXS-E, etc.) masqués
  - [ ] Mode placement WYSIWYG (iframe `galerie-edit.html`) charge
  - [ ] Drag socles dans iframe fonctionne (PC + GSM)
  - [ ] Sauvegarde sculpture conserve `type:"sculpture"` dans `salles.json`

## 5. Workflow critique — sauvegarde complète

- [ ] Modifier 1 toile dans admin Fred → sauver → recharger admin → modif présente
- [ ] Modifier 1 toile → sauver → ouvrir galerie publique → modif présente
- [ ] Vérifier que `data/salles.json` sur GitHub a bien été mis à jour (via web)
- [ ] Faire 2 sauvegardes rapides successives → vérifier qu'aucune n'est perdue (queue commits)

## 6. Reporting d'erreurs

- [ ] Provoquer une erreur volontaire (ex. token invalide) → vérifier que `rapporterErreur()` est appelé
- [ ] Vérifier création GitHub Issue (anti-spam : max 3/24h, donc tester avec parcimonie)
- [ ] Vérifier réception email EmailJS

---

## En cas d'échec

1. Loguer le bug dans `docs/BUGS.md` (ID incrémental, description, repro, hypothèses)
2. **Ne pas merger vers main**
3. Corriger sur dev
4. Re-dérouler la checklist
5. Une fois OK : merger
