# Se connecter : mot de passe et jeton, appareil par appareil

Pour modifier la galerie, l'admin demande deux choses : un **mot de passe** (que vous choisissez) et un **jeton** (en anglais *token*) qui autorise l'enregistrement des modifications. Le point le plus important à comprendre : **chaque appareil est indépendant**.

## Pourquoi « appareil par appareil » ?

Le mot de passe et le jeton sont mémorisés **localement, sur l'appareil et le navigateur que vous utilisez**. Ils ne vous suivent pas d'un appareil à l'autre. Concrètement :

- Sur votre ordinateur, vous les réglez une fois.
- Sur votre téléphone, il faudra les régler **à nouveau** — c'est normal, ce n'est pas un bug.
- Si vous changez de navigateur (par exemple Chrome puis Firefox), ou si vous effacez les données de navigation, il faudra recommencer la configuration.

## La première connexion sur un appareil

1. **Créer un mot de passe.** Choisissez-en un (6 caractères minimum). Il reste sur cet appareil et vous sera redemandé à chaque nouvelle session.
2. **Coller le jeton.** C'est une longue suite de caractères fournie par Alain. Collez-la dans le champ prévu : elle est vérifiée, puis mémorisée sur cet appareil.

Une fois ces deux étapes faites, vous entrez dans l'admin.

## Les fois suivantes

- À chaque réouverture de l'admin, on vous redemande **le mot de passe** (sécurité de session).
- Le **jeton**, lui, reste en place : vous ne le retapez pas à chaque fois.

## Le jeton ne fonctionne plus ?

Les jetons ont une durée de vie limitée et sont renouvelés de temps en temps, pour la sécurité. Si un message du type **« Token révoqué ou expiré »** apparaît, c'est que l'ancien n'est plus valable :

> **Demandez le nouveau jeton à Alain**, collez-le, et c'est reparti. Il n'y a rien d'autre à faire.

## À ne jamais faire

- **Ne partagez votre jeton avec personne.** Il donne le droit de modifier le site.
- Ne le collez pas ailleurs que dans l'écran de connexion, et ne l'écrivez pas dans un message ou un document partagé.

## En résumé

Mot de passe (par appareil, redemandé à chaque session) **+** jeton (par appareil, fourni par Alain). Nouvel appareil = nouvelle configuration. Jeton expiré = en redemander un à Alain.
