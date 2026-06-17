# Tests automatisés — Plan d'attaque

> Ce dossier accueillera les tests automatisés. Pour l'instant, **plan d'attaque uniquement**.
> Setup à faire lors d'une session sur ordinateur (les commandes terminale ci-dessous ne sont pas pratiques sur GSM).

---

## Philosophie

Deux étages de tests, chacun fait pour ce qu'il fait bien :

### Étage 1 — Tests unitaires (`tests/unit/`) — **PRIORITÉ HAUTE**
- Outil : **`node --test`** natif (Node 18+), zéro dépendance
- Cible : fonctions **pures** extraites de `admin.js`, `galerie-core.js`, etc.
- Vitesse : ~2 secondes pour tout l'ensemble
- Robustesse : aucune flakiness, pas de browser
- Coût maintenance : très faible

### Étage 2 — Tests smoke (`tests/smoke/`) — **PRIORITÉ MOYENNE**
- Outil : **Playwright**
- Cible : vérifications "page-load + DOM-présent + zéro-erreur-console" sur chaque page publique et chaque admin
- Vitesse : ~30 secondes pour tout l'ensemble
- Robustesse : raisonnable (sélecteurs CSS stables = OK)
- Coût maintenance : moyen (à mettre à jour quand le DOM change)

### Ce qu'on NE fait PAS
- ❌ **Pas de visual regression** (screenshots diff) — trop bruyant pour notre stack
- ❌ **Pas de tests qui écrivent réellement via l'API GitHub** — le PAT n'a rien à faire en CI
- ❌ **Pas de framework lourd** (Jest, Vitest, Mocha) — `node:test` suffit
- ❌ **Pas de couverture de code** comme objectif — couvrir 100% d'admin.js ne sert à rien, on couvre **les fonctions critiques**

---

## Étage 1 — Tests unitaires : à extraire et tester

Pour chaque fonction listée, il faudra :
1. La **refactoriser** dans `admin.js` pour qu'elle soit pure (input → output, pas d'effet de bord)
2. L'exporter (ou la rendre testable via `globalThis`)
3. Écrire le test correspondant dans `tests/unit/`

### Fonctions candidates (par ordre de criticité)

| Fonction | Fichier source | Pourquoi tester |
|---|---|---|
| `encoderJSON(str)` | `admin.js` | `btoa(unescape(encodeURIComponent(...)))` — fragile, casse sur caractères spéciaux |
| `decoderJSON(b64)` | `admin.js` | Symétrique du précédent, doit être inverse exact |
| `syncToilesEtPositions(salle)` | `admin.js` | Logique critique : sync `toiles[]` ← `positions[]` |
| `calculerStockTri(toiles, salles)` | `admin.js` | Tri vert/dispo/rouge — bug visible immédiatement si cassé |
| `validerStructureSalle(salle)` | (à créer) | Vérifier qu'une salle a `type`, `toiles[]`, `positions[]` cohérents |
| `commitQueue.enqueue()` | `admin.js` | Promise chain — éviter régressions de concurrence |
| `NOMS_ROMAINS[N]` | `admin.js` | Vérifier que I à X retournent les bonnes valeurs |
| `genererSilhouettes(patterns)` | `galerie.js` | Doit retourner N silhouettes valides |
| `positionsFallback(mobile, pc)` | `galerie-core.js` | `positions_mobile → positions` — règle métier importante |

### Exemple de test unitaire

```js
// tests/unit/encodage.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { encoderJSON, decoderJSON } from '../../assets/js/admin.js';

test('encoderJSON gère les caractères accentués', () => {
  const input = JSON.stringify({ nom: 'Frédérique', ville: 'Bertogne' });
  const encoded = encoderJSON(input);
  const decoded = decoderJSON(encoded);
  assert.strictEqual(decoded, input);
});

test('encoderJSON est idempotent en cycle complet', () => {
  const input = JSON.stringify({ test: 'éàùç€' });
  assert.strictEqual(decoderJSON(encoderJSON(input)), input);
});
```

### Setup local (à faire sur ordi)

```bash
cd ~/FF_Galerie
mkdir -p tests/unit

# Exécution :
node --test tests/unit/
```

Pas besoin d'installer quoi que ce soit, Node 18+ inclut le test runner.

---

## Étage 2 — Tests smoke avec Playwright

### Scope

Pour chaque admin (`/admin.html`, `/artistes/daw/admin.html`, etc.) et chaque page publique :

1. **Page charge** sans erreur HTTP
2. **Pas d'erreur console** pendant le chargement
3. **Éléments DOM clés** présents (header, nav, conteneur principal, etc.)
4. **Token de login** : si présent, le formulaire de login s'affiche ; pas besoin de tester le vrai login en CI

### Setup local (à faire sur ordi)

```bash
cd ~/FF_Galerie
npm install --save-dev @playwright/test
npx playwright install chromium
mkdir -p tests/smoke

# Exécution :
npx playwright test tests/smoke/
```

### Exemple de smoke test

```js
// tests/smoke/admin-fred.spec.js
import { test, expect } from '@playwright/test';

test('admin Frédérique charge sans erreur console', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', (err) => erreurs.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') erreurs.push(msg.text());
  });

  await page.goto('https://dev.frederiqueferette.be/admin.html');
  await expect(page.locator('#login-form, #admin-panel')).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('page Backup contient bien la liste des backups', async ({ page }) => {
  // Si on peut bypass login en mode test (ex. ?testMode=1)
  await page.goto('https://dev.frederiqueferette.be/admin.html?section=backup');
  const backupList = page.locator('[data-section="backup"] .backup-item');
  await expect(backupList.first()).toBeVisible({ timeout: 5000 });
});
```

### Suite minimum à viser (12 tests)

- 1 test par page publique principale (5 pages × 1 = 5 tests)
- 1 smoke test par admin (Fred + 4 invités = 5 tests)
- 1 test "page Backup non vide" (le bug actuel)
- 1 test "mur d'aperçu cohérent entre salles" (le bug actuel)

---

## CI/CD — GitHub Actions

Créer `.github/workflows/tests.yml` :

```yaml
name: Tests
on:
  push:
    branches: [dev, main]
  pull_request:
    branches: [dev, main]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node --test tests/unit/
  smoke:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/smoke/
        env:
          BASE_URL: https://dev.frederiqueferette.be
```

Les tests smoke tournent **contre dev.frederiqueferette.be** (déjà déployé), donc aucun besoin de PAT ou de serveur local.

---

## Ordre d'implémentation suggéré

### Session 1 (ordi requis)
1. Setup `node --test` (5 min)
2. Refactor `encoderJSON`/`decoderJSON` en fonctions pures + 3 tests (30 min)
3. Setup Playwright + 1 test smoke admin Fred (30 min)
4. Setup GitHub Actions workflow (15 min)
5. Vérifier que tout passe en CI (10 min)

→ ~1h30 pour avoir l'infrastructure fonctionnelle.

### Session 2 et suivantes
- Ajouter tests unitaires au fur et à mesure des bugs rencontrés
- Étendre suite smoke à chaque nouvel admin
- Règle d'or : **chaque bug fixé doit avoir un test qui empêche sa régression**

---

## Lien avec `docs/BUGS.md`

Pour chaque entrée de `BUGS.md` :
- Si bug fixé → ajouter un test unitaire ou smoke qui aurait catché le bug
- Référencer le test dans le champ "Solution trouvée" du bug

Exemple :
> **Solution trouvée :** Encodage corrigé dans `encoderJSON()`. Test ajouté : `tests/unit/encodage.test.js::caractères accentués`.

C'est cette boucle qui fait que les bugs ne reviennent plus.
