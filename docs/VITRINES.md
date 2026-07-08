# Vitrines & scénarios

Documentation de référence sur les vitrines de la galerie sculpture : ce
qu'elles sont, comment elles s'affichent, et comment les **scénarios** pilotent
le parcours du visiteur.

---

## 1. Qu'est-ce qu'une vitrine

Une vitrine est une **pièce spéciale** (`est_vitrine: true`) stockée dans
`sculpture.json`, pour que `pieces[oid]` résolve les œuvres qu'elle contient.
On la crée dans l'admin via la 3ᵉ valeur « **Vitrine** » du sélecteur de type
(mappée en interne sur `_type='sculpture'` + `est_vitrine`).

C'est un **meuble d'exposition posé au sol** dans une salle sculpture. Il
contient des œuvres (sous forme de **photos**) et sert de **porte d'entrée**
vers les salles immersive et/ou descriptive.

> Décision arrêtée : une vitrine affiche **des photos uniquement**. La 3D
> (GLB) ne vit que dans les salles immersive/descriptive, jamais dans la
> vitrine.

---

## 2. Rendu

### Styles (`piece.style`)

- **`bois`** — meuble opaque. Portes **fermées** = coffre : on ne voit pas
  l'intérieur (effet mystère). Portes **ouvertes** = vantaux écartés, œuvres
  visibles.
- **`vitree`** — montants sombres + verre translucide. On **devine** les
  œuvres même portes fermées.

### Couleur (`piece.couleur`)

Une **seule** couleur pilote fond + parois + planches, via `_teinte()`. Les
étagères en verre restent translucides et ne prennent pas la couleur.

### Portes (`piece.portes` = `fermees` | `ouvertes`)

Réglage **par vitrine** dans l'admin. Les vantaux sont dessinés :

- dans la **miniature au sol** (`creerVitrine`) — effet mystère dès le parquet ;
- dans le **plein-écran** (`ouvrirVitrine`).

Les vantaux bois sont factorisés dans `_vantauxBois()` (partagé miniature +
plein-écran) ; les portes verre dans `makeDoor()`. Les deux sont posées **à ras
des montants** du meuble (le meuble porte déjà ses montants en `border`, donc
retrait latéral = 0, sinon un trou apparaît).

### Contenu (`piece.contenu` / `piece.contenu_mobile`)

Contenu **indépendant PC / GSM**. Règle « un objet = une salle » appliquée dans
tous les sens.

---

## 3. Parcours visiteur — sans scénario (comportement historique)

Miniature au sol (avec halo) → **clic** → plein-écran (portes selon
`piece.portes`) → **clic sur une œuvre** → salle **descriptive** (si le greffon
descriptif est actif), avec une porte gauche « **retour vitrine** ».

---

## 4. Scénarios

### Principe

- Réglé **par salle** (comme les greffons), dans l'admin : *Tableau de bord de
  la salle → section « Scénario vitrine »*. S'applique à **toutes les vitrines**
  de la salle. Bouton « **Appliquer aux autres salles** » pour uniformiser.
- Ne pilote que les objets **en vitrine**. Les objets **posés au sol** gardent
  leur comportement (inchangé).
- Le choix se fait par **liste de radios illustrés** : chaque scénario montre
  sa séquence de **miniatures** (vitrine fermée / ouverte, salle immersive,
  salle descriptive) dérivée de `ouverture/cible/suivant`. La liste est
  **filtrée selon les greffons actifs** et **grisée** si la salle ne contient
  aucune vitrine.
- Stocké dans `salle.scenario` (une clé du catalogue). Whitelisté dans
  `chargerTout` (admin.js) ; persisté tel quel à la sauvegarde.

### Anatomie (3 axes)

1. **Ouverture** — `directe` (clic → œuvres visibles d'emblée) ou `2temps`
   (clic → vitrine fermée en plein-écran, 2ᵉ clic → les portes s'ouvrent).
2. **Clic sur une œuvre** → immersive / descriptive / rien.
3. **« Suivant »** — bouton dans la salle atteinte menant à l'autre salle. Il
   **coexiste** avec le « retour vitrine ».

### Catalogue (`VITRINE_SCENARIOS`, galerie-sculpture.js)

| Clé            | Ouverture | Clic œuvre | Suivant | Greffons requis |
|----------------|-----------|------------|---------|-----------------|
| `imm_desc`     | directe   | immersive  | détail  | imm + desc      |
| `imm_desc_2t`  | 2 temps   | immersive  | détail  | imm + desc      |
| `desc`         | directe   | détail     | —       | desc            |
| `desc_imm`     | directe   | détail     | immersive | desc + imm    |
| `imm`          | directe   | immersive  | —       | imm             |
| `vitrine`      | directe   | (aucune salle) | —   | —               |

### Effet sur les portes (résolution du conflit)

Dès qu'une salle porte un scénario, **le scénario pilote l'état des portes
partout** (miniature au sol **et** plein-écran) :

- `2temps` → vitrine **fermée** (mystère / prestance) ;
- `directe` → vitrine **ouverte**.

Le réglage manuel `piece.portes` est alors **ignoré** — et **grisé** dans
l'admin vitrine (avec une note), pour éviter de le régler en pure perte. Sans
scénario, `piece.portes` reprend son rôle normal.

---

## 5. Transitions

- **Voile noir partagé** (`_poserVoile` / `_leverVoile`) : posé dès le clic sur
  une œuvre, levé seulement quand la salle (immersive ou descriptive) a fini de
  fondre. Évite le flash du parquet pendant le chargement de la 3D.
- **retour vitrine + Suivant** : `_portesNavScenario` pose les portes gauche
  (retour) / droite (suivant). Les **deux salles** honorent le paramètre `nav`
  (immersive via `ouvrirSalleImmersive(…, nav)`, descriptive via
  `ouvrirSalleObservation(…, nav)`).

---

## 6. Chargement (performance)

- La **librairie 3D** (Three.js + GLTFLoader pour l'immersive ; model-viewer
  pour la descriptive) et le **GLB** de la sculpture sont chargés **à la
  demande**, à l'ouverture d'une salle. **Aucun préchargement.**
- Une **barre de progression** informe le visiteur pendant le chargement du
  GLB.
- Décision : **on ne précharge pas les GLB** (fichiers potentiellement lourds,
  ménagement de la data mobile). Réserve possible : précharger uniquement la
  *librairie* 3D à l'ouverture de la vitrine (gain gratuit, non prioritaire).

---

## 7. Points de code & fichiers

- **`galerie-sculpture.js`** — `creerVitrine` (miniature), `ouvrirVitrine`
  (plein-écran), `_vantauxBois` (vantaux bois partagés), `VITRINE_SCENARIOS`,
  `_resoudreScenario`, `_ouvrirDepuisVitrine`, `_ouvrirSalle`,
  `_portesNavScenario`, `_poserVoile` / `_leverVoile`.
- **`salle-immersive.js`** — `ouvrirSalleImmersive(piece, decor, descDecor, nav)`.
- **`admin-tdb.js`** — section « Scénario vitrine » : `VITRINE_SCENARIOS_ADMIN`
  (miroir), `_renderSectionScenario`, `_salleAUneVitrine`.
- **`admin.js`** — whitelist `scenario` dans `chargerTout`.
- **`admin-galerie.js`** — grisage du réglage portes vitrine sous scénario
  (`remplirFormToile` / `_majNoteVitrinePortes`).

### À ne pas oublier lors des évolutions

- **Synchroniser** `VITRINE_SCENARIOS` (renderer) et `VITRINE_SCENARIOS_ADMIN`
  (admin) : **clés**, **`req`**, **`ouverture`/`cible`/`suivant`** doivent rester
  alignés (ces derniers servent à dériver la séquence de miniatures). Les
  libellés peuvent différer — ceux de l'admin sont rédigés pour le propriétaire.
- **Cache-busters** : bumper le `?v=` de `galerie-sculpture.js` **et**
  `salle-immersive.js` dans **tous** les HTML à chaque modif de ces fichiers
  (`admin-tdb.js`, `admin-galerie.js` se chargent en `?v=Date.now()`, pas de
  bump).
