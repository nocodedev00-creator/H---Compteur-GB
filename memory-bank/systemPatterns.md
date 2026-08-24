# Architecture Système & Patterns

## Architecture Globale

Le projet est une **PWA Vanilla "Single-File"** (HTML5 + JS ES6 modulaire + CSS3). Le code est exécutable directement dans un navigateur et hébergeable gratuitement en 1 clic (GitHub Pages, Vercel).

L'architecture repose sur une séparation claire entre la logique métier (`core`), l'interface (`ui`) et les données (`services`), conformément à la structure standard des dossiers.

## Design Patterns Clés

### 1. Event Sourcing (Gestion d'État)

- **Concept** : Toute action (BUT / ARRÊT) est un événement horodaté ajouté à l'array `events` du match courant. L'état (stats, séries, couleurs) est **dérivé** de la liste des événements, jamais stocké séparément.
- **Règle** : Pas de mutation directe de l'état calculé. Chaque modification passe par l'ajout/suppression d'un événement, puis un **recalcul complet** de l'état.
- **Avantage** : La fonction "Annuler (Undo)" supprime simplement la dernière ligne de `events` et recalcule tout, sans bug d'état incohérent.

### 2. Modèle de Données (localStorage)

- **Concept** : Un objet global persistant dans `localStorage` contenant `settings`, `current_match` et `history`.
- **Structure** :
  - `settings.colors` : `streak_low` (#10B981), `streak_mid` (#F59E0B), `streak_high` (#FF0000).
  - `settings.thresholds` : `percent_low` (30), `percent_mid` (40).
  - `current_match` : `id`, `date`, `opponent`, `gardiens` (G1/G2), `events[]`.
  - `history` : Liste des anciens matchs archivés.

### 3. Règles Métier (Séries & Penaltys)

- **Indépendance des séries** : La série en cours est propre à chaque gardien. Un changement de gardien "met en pause" la série du gardien sortant ; elle reprend à sa valeur précédente au retour.
- **Gestion des penaltys** : Les penaltys (buts ou arrêts) **ne cassent pas la série** et sont intégrés au % d'arrêts global. Ils sont tagués `isPenalty` pour les exports futurs.
- **Remise à zéro mi-temps** : Au passage MT1→MT2, les séries de tous les gardiens sont brisées et repartent à zéro. Le % d'arrêts affiché reste le **cumul total du match entier** (pas de reset du %).

### 4. Contraintes Matérielles (Terrain)

- **No Sleep** : `navigator.wakeLock.request('screen')` pour empêcher l'écran de s'éteindre.
- **Anti-Refresh** : `overscroll-behavior-y: contain;` sur le `body` pour désactiver le pull-to-refresh natif.
- **Mobile-First** : Interface pensée pour une utilisation au pouce, zéro scrolling sur l'écran principal.

## Flux de Données Type

1. **Input** : Clic utilisateur sur BUT / ARRÊT / Penalty / changement de gardien ou de mi-temps.
2. **Traitement** : Création d'un événement horodaté (`{ id, timestamp, action, isPenalty, period, activeGb }`) ajouté à `events`.
3. **Stockage/État** : Persistance dans `localStorage` (Event Sourcing) + **recalcul** des stats, séries et couleurs.
4. **Output** : Rendu UI du dashboard (%, série, alertes couleurs) ou export fichier (JSON/CSV).
