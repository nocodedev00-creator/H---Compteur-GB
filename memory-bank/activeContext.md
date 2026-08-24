# Contexte Actif

## Travail en Cours

Le projet **HBC Nantes Live Stats Gardiens** est en phase d'implémentation initiale. Le squelette PWA est créé et la logique métier est implémentée dans `app.js`. Prochaine étape : tests manuels dans un navigateur.

## Objectifs de la Session

1. Mettre à jour le Memory Bank selon le MASTER BLUEPRINT (brief, stack, patterns, fonctions). ✅
2. Implémenter le squelette de l'application PWA (index.html, app.js, manifest.json, sw.js). ✅
3. Créer les icônes PWA. ✅
4. Tester l'application dans un navigateur (lancer un match, enregistrer des actions, vérifier les règles métier).

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

## Décisions Utilisateur (Session)

- **Structure** : PWA Vanilla légère en 4 fichiers (`index.html`, `app.js`, `manifest.json`, `sw.js`) + dossier `icons/`.
- **Affichage %** : % GB actif + % GB banc + % global (les 2 GB).
- **Série en cours** : Uniquement pour le gardien actif.
