# Progression du Projet

## Statut Global

**Phase : Implémentation initiale** — Le squelette de l'application PWA est créé. Les modules core, services, ui et utils sont implémentés dans `app.js` (architecture Single-File + PWA).

## Étapes Réalisées

- [x] Intégration du MASTER BLUEPRINT dans le Memory Bank.
- [x] Définition du brief & vision (`projectBrief.md`).
- [x] Définition de la stack technique (`techContext.md`).
- [x] Définition de l'architecture & patterns (`systemPatterns.md`).
- [x] Cartographie des fonctions (`functionMap.md`).
- [x] Mise à jour du contexte actif (`activeContext.md`).
- [x] Création du squelette PWA : `index.html`, `app.js`, `manifest.json`, `sw.js`.
- [x] Création des icônes PWA (`icons/icon-192.png`, `icons/icon-512.png`).
- [x] Implémentation de la logique métier (Event Sourcing, séries, penaltys, mi-temps, undo).
- [x] Implémentation du stockage localStorage, export JSON/CSV, Wake Lock, Service Worker.
- [x] Affichage du nom du GB actif dans le bloc "Série en cours".
- [x] Affichage "PENALTY - [GB]" dans le bloc série quand un penalty est actif (masque la valeur + le label).
- [x] Refonte du bloc série en cours : disposition en 2 colonnes (sans trait vertical de séparation). Colonne gauche : nom du GB en gros (`streak-gb-name`, `line-clamp-2` pour 2 lignes) + "Série en cours" (ou "PENALTY") en dessous. Colonne droite : valeur de série en très gros + label (Buts/Arrêts).




- [x] Retour automatique au GB de match après l'enregistrement d'un penalty (réaffiche sa série).
- [x] Précision sur le retour GB après penalty : si **pas de changement de GB** pendant le penalty → on continue la série (le GB qui a tiré reste actif) ET le penalty **compte dans sa série** (`countInStreak = true`, un but en penalty ajoute un but à sa série) ; si **changement de GB** pendant le penalty → on revient au GB qui jouait avant (`gbBeforePenalty`) et le penalty **ne compte pas** dans la série (`countInStreak = false`). Flag `gbChangedDuringPenalty` ajouté dans `switchGuardian`, champ `countInStreak` sur l'événement, `computeStreak` inclut les penaltys avec `countInStreak === true`.


- [x] Affichage des stats penaltys dans les ratios (GB actif, GB banc, global) au format `3/11 (p 2/3)`.
- [x] Alignement de la hauteur du conteneur des boutons G1/G2 sur celle du conteneur MT1/MT2.
- [x] Refonte de la section "Seuils Visuels" (% d'arrêts) sur 1 ligne : `0% [couleur rouge] [seuil 25%] [couleur orange] [seuil 35%] [couleur vert] 100%` (sans barre de progression).
- [x] Ajout des couleurs par palier de buts encaissés (`streak_colors`) : nombre d'arrêts critiques (5 par défaut) + couleur par palier.
- [x] Création du sélecteur de couleur simplifié (`createColorPicker`) avec palette de swatches vert→orange→rouge.
- [x] Déclinaison automatique des couleurs des paliers (`generateStreakColors`) en **gradation naturelle** du vert clair au rouge vif (via `generateGradientPalette` + interpolation HSL), toutes couleurs différentes, adaptée au nombre de paliers.
- [x] Palette de couleurs simplifiée (`COLOR_PALETTE`) en gradation naturelle vert clair→rouge vif (`generateGradientPalette(9)`, 9 nuances franches).
- [x] Gradation claire des couleurs des paliers : saturation (85%) et luminosité (45%) constantes, seule la teinte varie (120°→0°). Pas de variations de luminosité confuses, texte blanc lisible dans `#streak-block`.

## Prochaines Étapes (Backlog)

- [ ] Tester manuellement l'application dans un navigateur (lancer un match, enregistrer des actions).
- [ ] Vérifier les règles métier (séries indépendantes, penaltys, mi-temps, undo).
- [ ] Vérifier les contraintes matérielles (No Sleep, anti-refresh, mobile-first).
- [ ] Tester l'installation PWA (manifest, Service Worker, hors-ligne).
- [ ] Tester l'export JSON/CSV.

## Notes

- Le fichier `progress.md` contenait auparavant un contenu erroné (copie du context-bridge). Il a été corrigé pour refléter la vraie progression du projet.
- Structure retenue (choix utilisateur) : PWA Vanilla légère en 4 fichiers (`index.html`, `app.js`, `manifest.json`, `sw.js`) + dossier `icons/`.
- Clarifications utilisateur : afficher % GB actif + % GB banc + % global ; série en cours uniquement pour le gardien actif.
