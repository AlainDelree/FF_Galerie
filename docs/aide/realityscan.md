# Créer un fichier 3D (.glb) avec RealityScan

> ## Préambule

Ce guide décrit **RealityScan** testé sur gsm Android, la méthode que nous utilisons ici. Mais ce n'est
pas la seule : un fichier `.glb` peut se créer de plusieurs manières, depuis un
simple téléphone ou depuis un PC, selon le matériel dont on dispose.

- **RealityScan (Epic Games)** — *la méthode décrite ci-dessous.* Existe en
  version **PC (Windows)** et en **appli mobile (iPhone et Android)**. La version
  PC exige une **carte graphique NVIDIA** ; les deux versions sont gratuites.
  
- **Scaniverse** — appli mobile **iPhone et Android**, entièrement **gratuite**
  (export `.glb` compris). La plus simple pour débuter, sur un téléphone récent.
  
- **Polycam** — appli mobile **iPhone et Android** (+ web). Très facile, mais
  l'**export `.glb` nécessite l'abonnement payant**.
  
- **KIRI Engine** — appli mobile **iPhone et Android** (+ web). Calcul dans le
  cloud, donc pas besoin de LiDAR. Intéressant pour les **objets brillants ou
  métalliques**, difficiles à scanner autrement. Gratuit limité, payant au-delà.
  
- **Meshroom** — logiciel **PC (Windows / Linux)**, **gratuit et open-source**.
  Exige une **carte graphique NVIDIA** (sinon, rendu brouillon seulement) et ne
  produit pas directement de `.glb` (conversion via Blender nécessaire).

Ce guide explique comment transformer une série de photos d'une sculpture en un fichier **`.glb`** — un objet 3D que l'on peut ensuite ajouter à la galerie, faire tourner, et dont on choisit l'image de présentation.

## Ce qu'il vous faut

- Un appareil photo ou un smartphone récent.
- De quoi tourner autour de la sculpture, ou un **plateau tournant** pour la faire pivoter.
- Un **fond uni et clair** et un **éclairage diffus** (lumière douce, sans reflets durs ni ombres marquées.  A l'extérieur à l'ombre fonctionne très bien).
- L'application **RealityScan** installé sur votre téléphone.

> 💡 Les surfaces très brillantes ou métalliques sont difficiles à reconstruire. Si la pièce est polie, un éclairage très diffusé (rideaux tirés, lumière indirecte) aide beaucoup.

-Object Mode : l'objet est isolé du fond automatiquement, parfait pour un plateau tournant.
-AR Guidance : une aide à la prise de vue. Pendant que vous photographiez, l'appli affiche en réalité augmentée un nuage de points par-dessus l'objet, en temps réel, pour montrer les zones déjà bien couvertes et celles où il manque des photos. Très utile pour éviter les trous dans le modèle — particulièrement sur les pièces compliquées ou métalliques où certains angles passent mal.
-Standard Mode seulement si une œuvre est trop grande ou fixe pour la mettre sur une table.

## Étape 1 — Photographier la sculpture

L'objectif est d'obtenir une couverture complète de l'objet, vu sous tous les angles.

- Nombre de photos : 150-200
- Faites **plusieurs tours** à des hauteurs différentes (en plongée, à hauteur d'objet, en contre-plongée).
- Chevauchez largement chaque photo avec la précédente (au moins ~60 %).
- Gardez la pièce nette et l'éclairage constant.

![Disposition de prise de vue](docs/aide/img/realityscan-prise-de-vue.jpg)

-Object Mode un bon choix : l'objet est isolé du fond automatiquement, parfait pour un plateau tournant.
-AR Guidance une aide à la prise de vue: Pendant qu'on photographies, l'appli affiche en réalité augmentée un nuage de points par-dessus l'objet, en temps réel, pour montrer les zones déjà bien couvertes et celles où il manque des photos. Très utile pour éviter les trous dans le modèle — particulièrement sur les pièces compliquées ou métalliques où certains angles passent mal.
-Standard Mode seulement si une œuvre est trop grande ou fixe pour la mettre sur une table.

## Étape 2 — Importer les photos dans RealityScan

1. *(à préciser : créer un nouveau projet / glisser-déposer les photos)*
2. *(capture de l'écran d'import)*

![Import des photos](docs/aide/img/realityscan-import.jpg)

## Étape 3 — Aligner les photos

*(à préciser : lancer l'alignement, vérifier le nuage de points, supprimer les photos non alignées)*

## Étape 4 — Passer en mode Objet (Object Mode)

C'est l'étape clé pour une sculpture isolée. Le **mode Objet** indique au logiciel qu'on reconstruit un objet posé, et non une scène ou un décor.

*(à préciser : où activer Object Mode, réglages de la boîte de délimitation autour de la pièce)*

![Mode Objet](docs/aide/img/realityscan-object-mode.jpg)

## Étape 5 — Générer le maillage (mesh)

*(à préciser : qualité de reconstruction choisie, temps approximatif)*

## Étape 6 — Texturer

*(à préciser : réglages de texture)*

## Étape 7 — Exporter en .glb

*(à préciser : menu d'export, format glTF/GLB, options à cocher)*

Vous obtenez un fichier **`.glb`**. C'est ce fichier que vous chargerez dans l'admin.

![Export GLB](docs/aide/img/realityscan-export.jpg)

## Étape 8 — Ajouter la pièce dans l'admin

1. Dans l'admin, onglet **Œuvres**, ajoutez une **sculpture**.
2. Dans la section **Objet**, choisissez votre fichier `.glb`.
3. Une image de présentation est générée automatiquement. Pour la régler vous-même, cliquez sur **« 🎯 Choisir l'image depuis le 3D »** : orientez la sculpture (glisser pour tourner, slider pour l'angle), puis **« ✓ Utiliser cette vue »**.

## Problèmes fréquents

- **La reconstruction échoue / la pièce est trouée** : souvent un manque de photos ou des reflets. Reprenez des photos avec plus de chevauchement et une lumière plus diffuse.
- **Le fichier est très lourd** : *(à préciser : réduction du nombre de polygones / de la taille de texture)*.
- *(autres cas rencontrés à ajouter ici)*
