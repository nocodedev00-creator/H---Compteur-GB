# Cartographie des Fonctions

Ce document recense les fonctions clés du projet pour faciliter la maintenance et le debugging.

*À mettre à jour par l'IA à chaque ajout de fonctionnalité majeure.*

## 📁 `src/core/` (Logique Métier)

| Fichier | Fonction | Description |
| :--- | :--- | :--- |
| `stats.js` | `computeStats(events, gbId)` | Calcule le % d'arrêts global du match pour un gardien (cumul total, penaltys inclus). |
| `streak.js` | `computeStreak(events, gbId, period)` | Calcule la série en cours (BUTS/ARRÊTS) d'un gardien pour une période donnée. |
| `streak.js` | `getStreakColor(streak, settings)` | Retourne la couleur (low/mid/high) selon les paliers configurés. |
| `streak.js` | `getPercentColor(percent, settings)` | Retourne la couleur du % d'arrêts selon les seuils (percent_low/percent_mid). |
| `rules.js` | `applyPeriodChange(events, newPeriod)` | Brise les séries de tous les gardiens au passage MT1→MT2 (reset séries, % conservé). |
| `rules.js` | `isPenaltyBreakingStreak(event)` | Vérifie si un événement penalty casse la série (toujours false : les penaltys ne cassent pas la série). |

## 📁 `src/ui/` (Interface)

| Fichier | Fonction | Description |
| :--- | :--- | :--- |
| `dashboard.js` | `renderDashboard(state)` | Met à jour l'écran principal (%, série, couleurs, alertes). |
| `dashboard.js` | `handleAction(action)` | Gère le clic BUT/ARRÊT : crée l'événement, gère le toggle penalty, recalcule et rend. |
| `dashboard.js` | `handleUndo()` | Supprime la dernière ligne d'événements et recalcule l'état instantanément. |
| `dashboard.js` | `togglePenalty()` | Active/désactive le toggle penalty (état visuel démarqué, désactivation auto après action). |
| `dashboard.js` | `switchGuardian(gbId)` | Change le gardien actif (G1/G2), met en pause/reprend les séries. |
| `dashboard.js` | `switchPeriod(period)` | Change la période (MT1/MT2), déclenche la remise à zéro des séries. |
| `modal.js` | `openSettings()` / `closeSettings()` | Ouvre/ferme la modale Paramètres (fond plein en superposition). |
| `modal.js` | `startNewMatch(formData)` | Archive le match en cours dans `history` et lance un nouveau match (date auto). |
| `modal.js` | `updateThresholds(settings)` | Met à jour les paliers de pourcentages et les couleurs des séries. |
| `modal.js` | `openEndMatchModal()` / `closeEndMatchModal()` | Ouvre/ferme la modale "Fin de match" (séries par mi-temps). |
| `modal.js` | `renderEndMatchModal()` | Génère le contenu de la modale : pour chaque mi-temps, un graphique en ligne (alternance des GB) + stats des 2 GB ; en bas du 2ème graph, stats totales du match (GB1, GB2, Global) ; boutons d'export image PNG / JSON / CSV. |
| `modal.js` | `exportEndMatchImage()` | Exporte la page "Fin de match" (graphiques + stats) en image PNG avec en-tête professionnel (adversaire + date). Format idéal pour envoi email/WhatsApp. Utilise html2canvas. |

| `modal.js` | `computeMergedStreakTimeline(events, period)` | Calcule la série en cours à chaque événement sur une période, en ALTERNANT les gardiens sur une seule timeline (point de reset à 0 au changement de GB). |
| `modal.js` | `renderStreakLineChart(events, period, gardiens)` | Génère un graphique en ligne SVG unique (axe X = événements, axe Y = série d'arrêts). La couleur de la ligne change selon le GB actif (GB1 jaune, GB2 bleu). |
| `modal.js` | `computeGbStats(events, gbId, period)` | Calcule les stats d'un gardien (arrêts, buts, %, penaltys) sur une période donnée ou tout le match. |
| `modal.js` | `renderGbStatsRow(gbId, stats, gardiens, isLast)` | Génère une ligne de stats d'un gardien (nom + arrêts/buts/% + penaltys). |





## 📁 `src/services/` (Données & APIs)

| Fichier | Fonction | Description |
| :--- | :--- | :--- |
| `storage.js` | `loadState()` | Charge l'objet global depuis `localStorage` (settings, current_match, history). |
| `storage.js` | `saveState(state)` | Persiste l'objet global dans `localStorage`. |
| `storage.js` | `archiveMatch(state)` | Déplace `current_match` vers `history`. |
| `storage.js` | `clearAllData()` | Efface toutes les données (zone danger rouge avec confirmation). |
| `export.js` | `exportHistory(format)` | Exporte l'historique en JSON ou CSV. |
| `wakeLock.js` | `requestWakeLock()` | Invoque `navigator.wakeLock.request('screen')` pour le No Sleep. |

## 📁 `src/utils/` (Utilitaires)

| Fichier | Fonction | Description |
| :--- | :--- | :--- |
| `uuid.js` | `generateUUID()` | Génère un identifiant unique (UUID) pour les matchs et événements. |
| `date.js` | `todayISO()` | Retourne la date du jour au format `YYYY-MM-DD`. |
| `helpers.js` | `clamp(value, min, max)` | Borne une valeur entre min et max (pour les sliders de seuils). |
