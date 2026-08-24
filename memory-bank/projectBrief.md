# HBC Nantes Live Stats Gardiens - Brief & Vision

## Vision du Projet

Application web (PWA) destinée au staff d'un club de handball professionnel (HBC Nantes) pour une utilisation en direct depuis le banc de touche (sur smartphone/tablette).

L'objectif est de tracer les arrêts et buts encaissés des gardiens en temps réel, de calculer le pourcentage d'arrêts global, et d'afficher des alertes visuelles (codes couleurs) sur les séries de buts encaissés pour faciliter la prise de décision (changement de gardien).

## Objectifs Principaux

1. **Tracé temps réel** : Enregistrer chaque action (BUT / ARRÊT) du gardien actif en un seul clic.
2. **Statistiques live** : Calculer le % d'arrêts global du match et la série en cours par gardien.
3. **Alertes visuelles** : Codes couleurs (Vert/Orange/Rouge clignotant) sur les séries de buts pour déclencher les changements de gardien.
4. **Robustesse terrain** : Interface mobile-first, zéro scrolling, No Sleep (Wake Lock), anti-refresh accidentel.

## Fonctionnalités Clés

### 1. Dashboard Live (Écran Principal)
- **Header** : Logo/Texte "HBC Nantes Live", nom de l'adversaire, icône ⚙️ (Paramètres).
- **Sélecteurs rapides** : Bascule MT1/MT2, bascule Gardien G1/G2.
- **Stats centrales** : Bloc % d'arrêts (cumul match, code couleur) + Bloc série en cours (compteur coloré).
- **Bouton Penalty (Toggle)** : Tag `isPenalty` sur la prochaine action, désactivation auto.
- **Zone d'action** : Gros boutons BUT (rouge mat) / ARRÊT (vert mat) + bouton ↩️ Annuler (Undo).

### 2. Modale Paramètres
- **Nouveau Match** : Champs Adversaire, G1 (Nom/Numéro), G2 (Nom/Numéro), bouton "Lancer le match" (archive le match en cours), date auto.
- **Seuils Visuels** : Réglage des 3 paliers de pourcentages et des couleurs des séries (color picker).
- **Données** : Export Historique (JSON/CSV), Effacer toutes les données (zone danger rouge avec confirmation).

### 3. Règles Métier
- **Indépendance des séries** : Série propre à chaque gardien, mise en pause lors d'un changement, reprise à la valeur précédente.
- **Gestion des penaltys** : Ne cassent pas la série, intégrés au % global, tagués `isPenalty`.
- **Remise à zéro mi-temps** : Séries brisées au passage MT1→MT2, % d'arrêts conservé (cumul match entier).
- **Annuler (Undo)** : Supprime la dernière ligne d'événements et recalcule tout instantanément.

## Stack Technique (Prévisionnelle)

- **Langage** : HTML5, JavaScript (ES6+ modulaire), CSS3.
- **Interface** : PWA Vanilla "Single-File", Tailwind CSS (CDN), Lucide/Phosphor/FontAwesome (CDN).
- **Données** : localStorage (Architecture Event Sourcing).
- **Services Externes** : Aucun (hébergement gratuit 1 clic : GitHub Pages, Vercel).
