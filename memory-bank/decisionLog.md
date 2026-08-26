# Journal des Décisions Techniques & Résolutions

Ce document trace l'historique des problèmes techniques complexes et les solutions validées pour éviter les régressions.

## 2026-08-24 : Architecture Event Sourcing pour l'Undo sans bug

**Contexte** : Le cahier des charges exige une fonction "Annuler (Undo)" fiable sur le terrain. Une gestion d'état classique (variables mutées) risquait de produire des états incohérents.

### ✅ Solution Validée

- **Principe** : Toute action est un événement horodaté ajouté à `events`. L'état (stats, séries, couleurs) est **dérivé** de la liste des événements, jamais stocké séparément. L'Undo supprime la dernière ligne et recalcule tout.
- **Implémentation** : `src/core/` (stats, streak, rules) + `src/services/storage.js`.

## 2026-08-24 : Indépendance des séries par gardien + gestion penaltys

**Contexte** : Les séries de buts/arrêts doivent être propres à chaque gardien (pause/reprise au changement), et les penaltys ne doivent pas casser la série tout en étant intégrés au % global.

### ✅ Solution Validée

- **Principe** : La série est calculée par `(gardien, période)` à partir des événements. Les penaltys sont tagués `isPenalty` et exclus du calcul de série (mais inclus dans le % global). Au passage MT1→MT2, les séries sont brisées mais le % cumulé du match est conservé.
- **Implémentation** : `src/core/streak.js`, `src/core/rules.js`.

## 2026-08-24 : Contraintes matérielles terrain (No Sleep & Anti-Refresh)

**Contexte** : L'app est utilisée en direct depuis le banc de touche sur smartphone/tablette. L'écran ne doit pas s'éteindre et le pull-to-refresh doit être désactivé.

### ✅ Solution Validée

- **Principe** : `navigator.wakeLock.request('screen')` pour le No Sleep + `overscroll-behavior-y: contain;` sur le `body` pour l'anti-refresh. Interface mobile-first absolue (zéro scrolling).
- **Implémentation** : `src/services/wakeLock.js`, CSS global.

## 2026-08-26 : Colonnes stats centrales fixes (GB1 / GB2 / Global)

**Contexte** : L'utilisateur souhaite que les colonnes 1 et 2 de la zone stats affichent toujours respectivement les stats du GB1 et du GB2, quel que soit le gardien actif.

### ✅ Solution Validée

- **Principe** : `renderStats()` calcule désormais les stats de G1 et G2 de façon fixe (plus de notion actif/banc dans ces colonnes). Le gardien actif n'affecte plus que le bloc "Série en cours". Libellés par défaut mis à jour dans `index.html`.
- **Implémentation** : `app.js` (`renderStats`), `index.html`.


