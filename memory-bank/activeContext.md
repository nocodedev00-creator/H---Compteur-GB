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
- **Affichage %** : % GB actif + % GB banc + % global (les 2 GB).
- **Série en cours** : Uniquement pour le gardien actif.
- **Titre série** : Le bloc "Série en cours" affiche aussi le nom du GB actif (ex: "Série en cours — Dupont").
- **Titre penalty** : Quand un penalty est actif, le bloc affiche "PENALTY - [Nom du GB]" et masque la valeur + le label (seul le titre reste visible).
- **Retour GB après penalty** : Le GB qui jouait avant l'activation du penalty est mémorisé (`gbBeforePenalty`). Après l'enregistrement d'un penalty, on revient automatiquement à ce GB pour réafficher sa série.
- **Stats penaltys dans les ratios** : Les ratios (GB actif, GB banc, global) affichent les stats penaltys au format `3/11 (p 2/3)` (arrêts/tirs globaux + arrêts/tirs sur penaltys).
- **Hauteur sélecteurs gardiens** : Le conteneur des boutons G1/G2 a la même hauteur que le conteneur MT1/MT2 (`items-stretch` sur le parent + `h-full` sur les boutons gardiens), même si les noms sont sur une seule ligne.
- **Seuils visuels (% d'arrêts)** : La section "Seuils Visuels" affiche sur une seule ligne : `0% [couleur rouge] [seuil 25%] [couleur orange] [seuil 35%] [couleur vert] 100%`. Seuils par défaut : 25% (rouge) et 35% (orange). Pas de barre de progression.
- **Série de buts (couleurs par palier)** : L'utilisateur configure le nombre d'arrêts critiques (5 par défaut) et une couleur par palier de buts encaissés. Les couleurs sont générées automatiquement par `generateStreakColors(n)` en **gradation naturelle** du vert clair (1er palier, le plus faible) au rouge vif (palier critique), en passant par le jaune et l'orange. Toutes les couleurs sont différentes. La gradation s'adapte automatiquement au nombre de paliers (via `generateGradientPalette` + interpolation HSL). **Luminosité 45%→35%** : le vert clair est plus faible que le vert foncé, et toutes les couleurs restent suffisamment foncées pour garder le texte blanc lisible dans `#streak-block`. Stocké dans `settings.streak_colors` (tableau). `getStreakColor` utilise ce tableau pour colorer la série de buts. L'utilisateur peut modifier chaque couleur manuellement.
- **Sélecteur de couleur simplifié** : `createColorPicker()` crée un bouton rond + palette déroulante de swatches en gradation naturelle vert clair→rouge vif (`COLOR_PALETTE` = `generateGradientPalette(9)`, 9 nuances franches). Utilisé pour les % d'arrêts et les paliers de buts.

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
