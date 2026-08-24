# Contexte Technique

## Stack Logicielle

- **Core** : JavaScript ES6+ (modulaire, Vanilla).
- **Framework** : Aucun framework lourd (pas de React/Angular, pas de Node.js). PWA Vanilla "Single-File".
- **Dépendances Clés** :
  - Tailwind CSS (via CDN) pour le style.
  - Lucide Icons / Phosphor / FontAwesome (via CDN) pour les icônes.
  - Google Fonts : Montserrat ou Oswald (police sportive à fort impact).
  - Wake Lock API (`navigator.wakeLock.request('screen')`) pour le No Sleep.

## Contraintes & Choix Architecturaux

- **Performance** : Zéro scrolling sur l'écran principal, interface pensée pour une utilisation au pouce (mobile-first absolu).
- **Compatibilité** : Navigateur moderne (smartphone/tablette), PWA hébergeable gratuitement en 1 clic (GitHub Pages, Vercel).
- **Sécurité** : Aucune clé API, aucune dépendance lourde. Code exécutable directement dans un navigateur.
- **Stockage** : localStorage avec **Architecture Event Sourcing** (chaque action est un événement horodaté, permettant l'Undo sans bug).
- **Anti-Refresh** : `overscroll-behavior-y: contain;` sur le `body` pour désactiver le pull-to-refresh natif.

## Identité Visuelle (Dark Mode Premium)

- **Fond** : Mode sombre obligatoire, gris anthracite très foncé ou violet quasi-noir (`bg-slate-900`).
- **Header & éléments neutres** : Violet HBC Nantes (`#4a266a`) avec textes/icônes en Jaune/Or (`#f2c200`) ou Blanc.
- **Boutons BUT/ARRÊT** : Couleurs mates/pastel (Rouge brique / Vert émeraude) pour ne pas agresser les yeux.
- **Alerte série de buts** : Rouge Vif pur (`#ff0000`) avec animation clignotante (pulse) au palier critique (défaut 5 buts).

## Structure des Dossiers (Standard)

*À adapter selon la nature du projet (voir .clinerules)*

- `src/core/` : Logique métier pure (calculs stats, séries, règles métier).
- `src/services/` : Appels API, BDD (localStorage), I/O (export JSON/CSV).
- `src/ui/` : Composants d'interface (dashboard, modale paramètres).
- `src/utils/` : Fonctions utilitaires génériques (UUID, helpers).
