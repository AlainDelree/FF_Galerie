## Créer un fichier 3D (.glb) avec RealityScan
Ce guide explique comment transformer une série de photos d'une sculpture en un fichier .glb — un objet 3D que l'on peut ensuite ajouter à la galerie, faire tourner, et dont on choisit l'image de présentation.

### Préambule
Ce guide décrit la méthode pour créer le rendu d'un objet 3D avec RealityScan sur GSM Android, mais ce n'est pas la seule méthode : un fichier .glb peut se créer de plusieurs manières, depuis un téléphone ou depuis un PC, selon le matériel dont on dispose.

**Voici d'abord quelques alternatives**
    - Scaniverse — appli mobile iPhone et Android, entièrement gratuite (export .glb compris). La plus simple pour débuter, sur un téléphone récent.
    - Polycam — appli mobile iPhone et Android (+ web). Très facile, mais l'export .glb nécessite l'abonnement payant.
    - KIRI Engine — appli mobile iPhone et Android (+ web). Calcul dans le cloud, donc pas besoin de LiDAR. Intéressant pour les objets brillants ou métalliques, difficiles à scanner autrement. Gratuit limité, payant au-delà.
    - Meshroom — logiciel PC (Windows / Linux), gratuit et open-source. Exige une carte graphique NVIDIA (sinon, rendu brouillon seulement) et ne produit pas directement de .glb (conversion via Blender nécessaire).

### Matériel
RealityScan (Epic Games) existe en version PC (Windows) et en appli mobile (iPhone et Android). La version PC exige une carte graphique NVIDIA, mais la version téléphone n'exige rien de particulier ; les deux versions sont gratuites.

**Ce qu'il vous faut** ![Dispositif mis en place](docs/aide/img/dispositif.jpg)

    - Un appareil photo ou un smartphone récent.
    - De quoi tourner autour de la sculpture, ou un plateau tournant pour la faire pivoter.
    - Un fond uni et clair, et un éclairage diffus (lumière douce, sans reflets durs ni ombres marquées. Photographier à l'extérieur, à l'ombre, fonctionne très bien).
    - L'application RealityScan installée sur votre téléphone.

    💡 Les surfaces très brillantes ou métalliques sont difficiles à reconstruire. Si la pièce est polie, un éclairage très diffus (rideaux tirés, lumière indirecte) est nécessaire.

### Étape 1 — Choisir le mode de capture
À l'ouverture de l'appli, créez un nouveau projet en cliquant sur le "+". Vous aurez trois modes différents :

    - Object Mode : l'objet est isolé du fond automatiquement, parfait pour un plateau tournant. C'est le mode conseillé.
    - AR Guidance : une aide à la prise de vue. Pendant que vous photographiez, l'appli affiche en réalité augmentée un nuage de points par-dessus l'objet, en temps réel, pour montrer les zones déjà bien couvertes et celles où il manque des photos. Très utile pour éviter les trous dans le modèle — particulièrement sur les pièces compliquées ou métalliques où certains angles passent mal.
    - Standard Mode : seulement si une œuvre est trop grande ou fixe pour la mettre sur une table.

**Je vous conseille le 1er mode (Object Mode).** ![Menu RealityScan](docs/aide/img/menu-mode.jpg)

### Étape 2 — Photographier la sculpture
L'objectif est d'obtenir une couverture la plus complète possible de l'objet sous tous les angles. ![Écran de capture](docs/aide/img/object-mode.jpg)

#### Privilégier la diversité angulaire à la quantité brute :
    - Varier la distance à l'objet (proche pour les détails, plus loin pour le contexte global).
    - Varier la hauteur de prise de vue de façon continue plutôt qu'en 3 niveaux fixes (une spirale montante autour de l'objet plutôt que des cercles plats empilés).
    - Cibler spécifiquement les zones complexes (creux, appendices, intersections de formes) avec des angles supplémentaires dédiés.
    - Pour un objet réfléchissant : varier l'angle par rapport à la source de lumière fait bouger les reflets différemment et donne à l'algorithme plus de chances de trouver des points stables.

#### En pratique (60 photos → objet mat, 100 photos → objet brillant) :
    - Faites plusieurs tours à des niveaux différents (en plongée, à hauteur d'objet, en contre-plongée). Visez une spirale partant du bas vers le haut.
    - Objet mat : 3-4 niveaux × 15 photos = 45-60 photos de base + quelques clichés dessus/dessous selon la complexité.
    - Objet réfléchissant : 3-4 niveaux × 25 photos = 75-100 photos de base + plus généreux sur le dessus/dessous.
    - Pour que le programme puisse "lier" les photos entre elles, chaque photo doit chevaucher la suivante à 60 % minimum (70 % pour un objet brillant).
    - Gardez la pièce nette et l'éclairage constant.

Le compteur en bas à gauche indique le nombre de photos prises (ex. : "0 / 300" — 300 est le maximum autorisé). ![Accès aux photos](docs/aide/img/object-mode-commente.jpg)

### Étape 3 — Consulter les photos et vérifier la couverture
Via l'icône en bas à gauche, vous pouvez consulter toutes les photos prises. Vous trouverez deux types de photos : les photos normales et les photos **"Unconnected"**. ![Photos unconnected](docs/aide/img/apercu-photos.jpg)

Les photos Unconnected (étiquette rouge) n'ont pas pu être reliées aux autres — l'algorithme n'a pas trouvé assez de points communs avec les photos voisines. Vous pouvez les effacer, mais assurez-vous de reprendre des photos pour couvrir les parties de l'objet que ces images représentaient.

Une fois les photos faites, cliquez sur la flèche dans le rond bleu (→) pour passer à l'étape suivante.

### Étape 4 — Valider le nuage de points et envoyer pour reconstruction
L'application affiche alors l'écran **"Review Scan"** avec une vue 3D du **nuage de points** — un ensemble de petits points qui esquissent la forme de l'objet. Plus ce nuage ressemble à votre sculpture, meilleur sera le résultat final. ![Nuage de points](docs/aide/img/nuage-de-point.jpg)

Sur cet écran, deux outils sont disponibles :
    - **Icône gomme (orange)** : permet de supprimer manuellement des points parasites (fond, table, éléments indésirables qui se sont glissés dans le scan).
    - **Icône validation (✓)** : confirme la sélection nettoyée.

Deux boutons apparaissent en bas :
    - **"Take More Pictures"** : retourner en mode capture pour compléter les zones manquantes.
    - **"Next"** : valider et envoyer les photos aux serveurs cloud d'Epic Games pour la reconstruction 3D complète.

Cliquez sur **"Next"** quand le nuage vous semble satisfaisant. L'application envoie les photos, puis les serveurs d'Epic génèrent le maillage 3D dense. **Cette étape peut prendre de 10 à 30 minutes selon le nombre de photos.** Vous recevrez une notification quand c'est terminé — vous pouvez fermer l'app et vaquer à autre chose.

    💡 Le traitement se fait entièrement dans le cloud d'Epic Games (gratuit, sans limite connue). Votre téléphone n'a pas besoin de rester allumé pendant ce temps.

### Étape 5 — Vérifier le résultat texturé
Une fois la reconstruction terminée, l'application affiche le modèle 3D complet avec ses textures (couleurs issues de vos photos). Faites-le tourner dans tous les sens pour vérifier :

    - La forme générale correspond à la sculpture.
    - Pas de zones trop trouées ou déformées.
    - Les textures sont propres (pas de flou excessif ou de couleurs aberrantes).

La texturation est entièrement automatique — aucun réglage n'est nécessaire. Si le résultat n'est pas satisfaisant, la seule solution est de recommencer la prise de vue avec plus de photos et un meilleur éclairage.

    💡 Pour les sculptures métalliques brillantes, un résultat imparfait est normal. La vraie solution est de matifier la surface avant la prise de vue (spray anti-reflet AESUB, ou simplement de la craie blanche en bombe) puis de recommencer.

### Étape 6 — Exporter en .glb
Depuis l'écran du modèle terminé, cherchez le bouton d'export (icône de partage ou menu "···"). Choisissez le format **GLB** (ou glTF Binary).

L'application crée un fichier ZIP contenant :
    - **model.glb** — le modèle 3D
    - **2 fichiers JPG** — les textures (couleur diffuse + normal map)

    ⚠️ Ne perdez pas ces 3 fichiers ensemble ! Si vous ouvrez le .glb seul dans une autre application (Blender, etc.) sans les textures dans le même dossier, le modèle apparaîtra blanc ou grisé, sans couleur.

Sauvegardez le ZIP sur votre téléphone, puis transférez-le sur votre PC.

### Étape 7 — Ajouter la pièce dans l'admin

    1. Dans l'admin, onglet Œuvres, ajoutez une sculpture.
    2. Dans la section Objet, choisissez votre fichier .glb.
    3. Une image de présentation est générée automatiquement. Pour la régler vous-même, cliquez sur « 🎯 Choisir l'image depuis le 3D » : orientez la sculpture (glisser pour tourner, slider pour l'angle), puis « ✓ Utiliser cette vue ».

### Problèmes fréquents

    - **La reconstruction échoue / la pièce est trouée** : souvent un manque de photos ou des reflets. Reprenez des photos avec plus de chevauchement et une lumière plus diffuse.
    - **Photos Unconnected en grand nombre** : l'objet est trop brillant ou les photos se chevauchent insuffisamment. Réduisez les reflets (éclairage plus doux, fond plus clair) et resserrez les prises de vue.
    - **Le modèle texturé est blanc dans l'admin** : les textures JPG ne sont pas au même endroit que le .glb. Mettez les 3 fichiers (model.glb + 2 JPG) dans le même dossier avant d'importer.
    - **Le fichier est très lourd** : RealityScan produit des modèles haute résolution. Si le .glb dépasse 20-30 Mo, vous pouvez réduire le nombre de polygones via Blender (Modifier → Decimate) sans trop perdre en qualité visuelle à l'écran.
