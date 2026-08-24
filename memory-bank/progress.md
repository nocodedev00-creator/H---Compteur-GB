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
