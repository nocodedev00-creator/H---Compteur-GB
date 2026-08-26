# Contexte Actif

## Travail en Cours

Le projet **HBC Nantes Live Stats Gardiens** est en phase d'implémentation initiale. Le squelette PWA est créé et la logique métier est implémentée dans `app.js`. Prochaine étape : tests manuels dans un navigateur.

## Objectifs de la Session

1. Mettre à jour le Memory Bank selon le MASTER BLUEPRINT (brief, stack, patterns, fonctions). ✅
2. Implémenter le squelette de l'application PWA (index.html, app.js, manifest.json, sw.js). ✅
3. Créer les icônes PWA. ✅
4. Tester l'application dans un navigateur (lancer un match, enregistrer des actions, vérifier les règles métier).
5. Afficher le nom du GB actif dans le bloc "Série en cours". ✅
## Décisions Utilisateur (Session)

- **Structure** : PWA Vanilla légère en 4 fichiers (`index.html`, `app.js`, `manifest.json`, `sw.js`) + dossier `icons/`.
- **Affichage %** : Colonnes FIXES dans la zone stats centrale : colonne 1 = **GB1**, colonne 2 = **GB2**, colonne 3 = **Global**. Les colonnes 1 et 2 ne dépendent plus du gardien actif (elles affichent toujours respectivement les stats du GB1 et du GB2). Le gardien actif n'affecte que le bloc "Série en cours".

- **Série en cours** : Uniquement pour le gardien actif.
- **Bloc série en cours** : Disposition en 2 colonnes (sans trait vertical de séparation). **Colonne gauche** (`w-[55%]`) : le nom du GB actif en gros (`streak-gb-name`, `text-3xl`, `line-clamp-2` pour tenir sur 2 lignes si nom long) avec les **stats du GB actif** en dessous sur **3 lignes** (`streak-gb-stats`, police `text-lg` plus petite que le nom) : ligne 1 = % d'arrêts (`streak-gb-percent`), ligne 2 = ratio arrêts/tirs (`streak-gb-ratio`), ligne 3 = penaltys `(p x/x)` (`streak-gb-penalty`, vide si aucun penalty). **Colonne droite** (`flex-1 min-w-0`, occupe tout l'espace restant pour centrer son contenu) : le libellé "Série en cours" (ou "PENALTY" quand un penalty est actif) au-dessus de la valeur de série en très gros (`text-6xl`) et le label (Buts/Arrêts). Quand un penalty est actif, la valeur + le label sont masqués (seuls le nom du GB, ses stats et le libellé restent visibles). La limite verticale est décalée vers la gauche (colonne gauche 55%) pour équilibrer le conteneur.







- **Retour GB après penalty** : Le GB qui jouait avant l'activation du penalty est mémorisé (`gbBeforePenalty`). Après l'enregistrement d'un penalty :
  - **Pas de changement de GB pendant le penalty** → on continue la série : le GB qui a tiré reste actif ET le penalty **compte dans sa série** (un but en penalty ajoute un but à sa série, un arrêt en penalty ajoute un arrêt). Champ `countInStreak = true` sur l'événement.
  - **Changement de GB pendant le penalty** → on revient automatiquement au GB qui jouait avant (`gbBeforePenalty`) pour réafficher sa série, et le penalty **ne compte pas** dans la série (`countInStreak = false`).
  - Un flag `gbChangedDuringPenalty` (mis à `true` dans `switchGuardian` si un penalty est actif) permet de distinguer les deux cas. `computeStreak` inclut les penaltys avec `countInStreak === true` dans la série.
- **Remise à 0 de la série du GB qui entre pendant un penalty** : Quand on change de GB pendant un penalty, la série du GB qui entre est **remise à 0 définitivement** (flag `ui.gbStreakReset[gbId] = Date.now()`). `computeStreak` ignore les événements antérieurs au reset pour ce GB. **Scénario 3** : si le user re-sélectionne ce GB après le penalty, le dernier péno de ce GB (enregistré après son reset) est marqué `countInStreak = true` dans `switchGuardian` → le GB conserve sa série avec le péno.
- **Titre "PENALTY" en gros** : Quand un penalty est actif, `#streak-title` affiche "PENALTY" en **gros** (`text-4xl`, couleur `#f2c200`) au lieu du petit libellé "Série en cours".



- **Stats penaltys dans les ratios** : Les ratios (GB actif, GB banc, global) affichent les stats penaltys au format `3/11 (p 2/3)` (arrêts/tirs globaux + arrêts/tirs sur penaltys).
- **Hauteur sélecteurs gardiens** : Le conteneur des boutons G1/G2 a la même hauteur que le conteneur MT1/MT2 (`items-stretch` sur le parent + `h-full` sur les boutons gardiens), même si les noms sont sur une seule ligne.
- **Seuils visuels (% d'arrêts)** : La section "Seuils Visuels" affiche sur une seule ligne : `0% [couleur rouge] [seuil 25%] [couleur orange] [seuil 35%] [couleur vert] 100%`. Seuils par défaut : 25% (rouge) et 35% (orange). Pas de barre de progression.
- **Série de buts (couleurs par palier)** : L'utilisateur configure le nombre d'arrêts critiques (5 par défaut) et une couleur par palier de buts encaissés. Les couleurs sont générées automatiquement par `generateStreakColors(n)` en **gradation claire** du vert (1er palier) au rouge (palier critique), en passant par le jaune et l'orange. **Saturation (85%) et luminosité (45%) constantes** : seule la teinte varie (120°→0°), donc pas de variations de luminosité confuses. La gradation est claire et sans ambiguïté. S'adapte automatiquement au nombre de paliers. Stocké dans `settings.streak_colors` (tableau). `getStreakColor` utilise ce tableau pour colorer la série de buts. L'utilisateur peut modifier chaque couleur manuellement.
- **Sélecteur de couleur simplifié** : `createColorPicker()` crée un bouton rond + palette déroulante de swatches en gradation claire vert→rouge (`COLOR_PALETTE` = `generateGradientPalette(9)`, 9 nuances). Utilisé pour les % d'arrêts et les paliers de buts.

## État de la Mémoire

- **Architecture** : Définie dans `systemPatterns.md` (Event Sourcing, modèle de données, règles métier).
- **Stack** : Définie dans `techContext.md` (PWA Vanilla, Tailwind CDN, localStorage, Wake Lock).
- **Fonctions** : Cartographiées dans `functionMap.md` (core, ui, services, utils).
- **Brief** : Défini dans `projectBrief.md` (vision, objectifs, fonctionnalités clés).
- **Progression** : Suivie dans `progress.md` (implémentation initiale terminée, tests à faire).

## Points d'Attention (Règles Métier Critiques)

- **Indépendance des séries** : Série propre à chaque gardien, mise en pause/reprise au changement.
- **Penaltys** : Ne cassent pas la série, intégrés au % global, tagués `isPenalty`.
- **Mi-temps** : Reset des séries au passage MT1→MT2, % d'arrêts conservé (cumul match entier).
- **Undo** : Suppression de la dernière ligne d'événements + recalcul instantané.
