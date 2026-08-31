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

## 2026-08-26 : Modale "Fin de match" avec graphique en ligne des séries par mi-temps

**Contexte** : L'utilisateur veut visualiser les séries d'arrêts et de buts encaissés de chaque gardien par mi-temps, avec un graphique en ligne (timeline).

### ✅ Solution Validée

- **Principe** : Bouton "Fin" à droite de `#btn-mt2` (même largeur, conteneur flex identique). Modale plein écran avec **graphique en ligne SVG** par mi-temps : axe X = événements successifs, axe Y = série d'arrêts en cours. La ligne **monte** à chaque arrêt, **descend à 0** à chaque but. **GB1 en jaune** (`#f2c200`), **GB2 en bleu clair** (`#38bdf8`). Points rouges = buts encaissés. Le bloc gardien (`flex-1`) est réduit proportionnellement.
- **Implémentation** : `app.js` (`computeStreakTimeline`, `renderStreakLineChart`, `renderEndMatchModal`, `openEndMatchModal`, `closeEndMatchModal`), `index.html`.

## 2026-08-26 : Correction régression - reset des séries à chaque changement de gardien

**Contexte** : Les séries des GB ne se réinitialisaient pas à chaque changement de gardien (régression). Seuls les changements pendant un pénalty remettaient la série à 0. Le GB qui sortait en changement normal conservait sa série quand il revenait.

### ✅ Solution Validée

- **Principe** : `switchGuardian` remet désormais la série du GB qui SORT à 0 (`ui.gbStreakReset[leavingGb] = Date.now()`) en changement normal. Exception pénalty : le GB qui sort pendant un pénalty **conserve** sa série (il sera rétabli automatiquement dans les buts). `computeMergedStreakTimeline` (graphique fin de match) applique les mêmes règles (filtre `countInStreak` + reset). `switchPeriod` purge `ui.gbStreakReset = {}` au changement de mi-temps pour éviter les re-sélections de pénalty obsolètes.
- **Implémentation** : `app.js` (`switchGuardian`, `switchPeriod`, `computeMergedStreakTimeline`).

## 2026-08-26 : Graphique fin de match - alternance des GB sur une seule ligne

**Contexte** : Le graphique fin de match affichait 2 lignes superposées (une par GB), ce qui était confus. L'utilisateur veut voir les GB alterner sur le même graph.

### ✅ Solution Validée

- **Principe** : `computeStreakTimeline` (par GB) remplacé par `computeMergedStreakTimeline` (une seule timeline qui alterne les GB). Quand le GB change, un point de reset à 0 est inséré (gris). `renderStreakLineChart` dessine une seule ligne dont la couleur change selon le GB actif (GB1 jaune, GB2 bleu). Plus de superposition.
- **Implémentation** : `app.js` (`computeMergedStreakTimeline`, `renderStreakLineChart`).

## 2026-08-26 : Modale fin de match - stats des GB par mi-temps + total match + export

**Contexte** : L'utilisateur veut voir les stats des GB par mi-temps au niveau des graphs, les stats totales du match en bas du 2ème graph, et des fonctions d'export sur cette page.

### ✅ Solution Validée

- **Principe** : `renderEndMatchModal` affiche désormais : pour chaque mi-temps, les stats des 2 GB (arrêts, buts, %, penaltys) sous le graphique ; en bas du 2ème graph, les stats totales du match (GB1, GB2, Global) ; des boutons d'export image PNG / JSON / CSV (toutes les données collectées via `exportHistory`). Nouvelles fonctions : `computeGbStats`, `renderGbStatsRow`.
- **Implémentation** : `app.js` (`computeGbStats`, `renderGbStatsRow`, `renderEndMatchModal`).

## 2026-08-26 : Export image PNG de la page fin de match

**Contexte** : L'utilisateur veut pouvoir exporter la page fin de match (graphiques + stats) dans un format facile à envoyer par email ou WhatsApp. C'est une app pour professionnels.

### ✅ Solution Validée

- **Principe** : Le meilleur format pour un envoi rapide par email/WhatsApp est une **image PNG** (universel, lisible partout, professionnel). Bouton "Exporter cette page en image" dans la modale fin de match. Utilise **html2canvas** (CDN) pour capturer le contenu en PNG haute résolution (scale 2), avec un en-tête professionnel (adversaire + date). Cache Service Worker incrémenté à `v11`.
- **Implémentation** : `index.html` (CDN html2canvas), `app.js` (`exportEndMatchImage`), `sw.js` (cache v11).

## 2026-08-26 : Export image - affichage adversaire/date + exclusion des boutons d'export

**Contexte** : Retour utilisateur sur l'export image : afficher l'adversaire et la date du match sur la page fin de match, et ne pas exporter les boutons d'export sur l'image.

### ✅ Solution Validée

- **Principe** : En-tête de section en haut de la modale fin de match (adversaire en gros doré + date). Le bloc des boutons d'export est identifié par `#end-match-export-buttons` et masqué (`display:none`) avant la capture html2canvas, puis restauré après (dans `.then` et `.catch`).
- **Implémentation** : `app.js` (`renderEndMatchModal`, `exportEndMatchImage`).

## 2026-08-31 : No Sleep sur iPhone (Wake Lock non supporté par Safari iOS)

**Contexte** : Sur iPhone, l'écran s'éteignait malgré le Wake Lock. Safari iOS ne supporte pas l'API `navigator.wakeLock`.

### ✅ Solution Validée

- **Principe** : Utilisation de **NoSleep.js** (vidéo invisible en boucle) sur iOS, Wake Lock natif ailleurs. Détection iOS via `isIOS()`. NoSleep nécessite un geste utilisateur sur iOS → activation au premier tap (`touchstart`/`click` avec `{ once: true }`). Cache Service Worker incrémenté à `v13`.
- **Implémentation** : `index.html` (CDN NoSleep), `app.js` (`isIOS`, `requestWakeLock`, `activateNoSleepOnFirstTouch`), `sw.js` (cache v13).

## 2026-08-26 : Bug graphique incomplet dans la modale fin de match

**Contexte** : Quand on clique sur "Fin", seules les dernières actions du match apparaissent sur le graphique (ex: les 4 dernières). Il faut cliquer sur MT1 puis MT2 pour que les graphiques soient complets. Le graphique MT1 est souvent vide.

### ✅ Solution Validée

- **Principe** : `computeMergedStreakTimeline` **supprimait** les événements antérieurs au reset de série (`ui.gbStreakReset`) au lieu de les afficher. Quand un GB était changé, tous ses événements précédents disparaissaient du graphique. Fix : on **conserve tous les événements** et on gère la série par gardien (`streaks = { G1: 0, G2: 0 }`). Au changement de GB, on vérifie si `ui.gbStreakReset[gbId]` est défini : si oui (changement normal), la série repart de 0 ; si non (retour après pénalty), la série est conservée. Les événements ne sont plus jamais supprimés du graphique.
- **Implémentation** : `app.js` (`computeMergedStreakTimeline`).










