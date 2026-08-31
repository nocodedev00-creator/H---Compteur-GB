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
- [x] Déploiement V1 sur GitHub Pages. Correction du cache Service Worker : incrémentation du `CACHE_NAME` à `v10` pour forcer la mise à jour des navigateurs (stratégie cache-first bloquait l'affichage de la nouvelle version).
- [x] Stepper mobile pour le "Nombre d'arrêts critiques" (`inp-streak-high`) : remplacement du champ `number` (qui forçait à 10 sur mobile) par des boutons **−** / **+** incrémentant de 1 en 1, champ en `readonly`. Logique dans `applyStreakHigh`.
- [x] Utilisation immédiate sans lancer de match : fonction `ensureMatch()` qui crée automatiquement un match par défaut (adversaire "Adversaire", GB1 "GB1", GB2 "GB2") au premier clic sur But/Arrêt si aucun match n'est actif.
- [x] Colonnes stats centrales FIXES : colonne 1 = GB1, colonne 2 = GB2, colonne 3 = Global. `renderStats()` affiche désormais les stats du GB1 et du GB2 de façon fixe, indépendamment du gardien actif (le gardien actif n'affecte plus que le bloc "Série en cours"). Libellés par défaut mis à jour dans `index.html` (GB1 / GB2 au lieu de GB Actif / GB Banc).
- [x] Refonte du bloc série en cours : "Série en cours" déplacé au-dessus de `#streak-value` (même taille de police) ; ajout des stats du GB actif sous `#streak-gb-name` ; limite verticale décalée vers la gauche (colonne gauche `w-[55%]`) pour équilibrer le conteneur.
- [x] Stats du GB actif dans le bloc série affichées sur **3 lignes** (police `text-lg`, plus petite que le nom) : ligne 1 = % d'arrêts, ligne 2 = ratio arrêts/tirs, ligne 3 = penaltys `(p x/x)` (vide si aucun penalty).
- [x] Correction centrage colonne droite du bloc série : passage de `shrink-0` à `flex-1 min-w-0` pour que la colonne occupe tout l'espace restant et que son contenu soit centré (élimine l'espace libre à droite).
- [x] Titre "PENALTY" en **gros** (`text-4xl`, couleur `#f2c200`) dans le bloc série quand un penalty est actif (au lieu du petit libellé "Série en cours").
- [x] Remise à 0 **définitive** de la série du GB qui entre pendant un penalty (`ui.gbStreakReset[gbId]` + `computeStreak` ignore les événements avant le reset). Scénario 3 : si le user re-sélectionne ce GB après le penalty, le dernier péno de ce GB est marqué `countInStreak = true` → il conserve sa série avec le péno.
- [x] Bouton "Fin de match" (`#btn-end-match`) à droite de `#btn-mt2`, même largeur (conteneur flex identique, texte "Fin" = 3 caractères comme "MT2"). Le bloc gardien (`flex-1`) est réduit proportionnellement pour laisser la place.
- [x] Modale "Fin de match" (`#end-match-modal`) : affiche pour chaque mi-temps (MT1, MT2) un **graphique en ligne SVG** (`renderStreakLineChart`) montrant l'évolution de la série d'arrêts dans le temps pour les 2 gardiens. Axe X = événements successifs, axe Y = valeur de la série. La ligne **monte** quand il y a des arrêts, **descend à 0** quand un but est encaissé. **GB1 en jaune** (`#f2c200`), **GB2 en bleu clair** (`#38bdf8`). Points rouges = buts encaissés. Légende avec noms des gardiens. Résumé par mi-temps (nb arrêts / nb buts). Fonctions : `computeStreakTimeline`, `renderStreakLineChart`, `renderEndMatchModal`, `openEndMatchModal`, `closeEndMatchModal`.
- [x] **Correction régression : reset des séries à chaque changement de gardien.** `switchGuardian` remet désormais la série du GB qui SORT à 0 (`ui.gbStreakReset[leavingGb] = Date.now()`) en changement normal. Exception pénalty : le GB qui sort pendant un pénalty conserve sa série (il sera rétabli automatiquement). `computeMergedStreakTimeline` (graphique fin de match) applique les mêmes règles (filtre `countInStreak` + reset).
- [x] **Purge des resets de série au changement de mi-temps.** `switchPeriod` vide `ui.gbStreakReset = {}` pour éviter les re-sélections de pénalty obsolètes d'une période à l'autre.
- [x] **Graphique fin de match en alternance des GB sur une seule ligne.** `computeStreakTimeline` remplacé par `computeMergedStreakTimeline` : une seule timeline qui alterne les GB (point de reset à 0 au changement de GB). `renderStreakLineChart` dessine une seule ligne dont la couleur change selon le GB actif (GB1 jaune, GB2 bleu), plus de superposition de 2 lignes.
- [x] **Stats des GB par mi-temps + total match + export dans la modale fin de match.** `renderEndMatchModal` affiche désormais : pour chaque mi-temps, les stats des 2 GB (arrêts, buts, %, penaltys) sous le graphique ; en bas du 2ème graph, les stats totales du match (GB1, GB2, Global) ; des boutons d'export image PNG / JSON / CSV (toutes les données collectées). Nouvelles fonctions : `computeGbStats`, `renderGbStatsRow`, `exportEndMatchImage`.
- [x] **Export image PNG de la page fin de match.** Bouton "Exporter cette page en image" dans la modale fin de match. Utilise html2canvas (CDN) pour capturer le contenu (graphiques + stats) en PNG haute résolution (scale 2), avec un en-tête professionnel (adversaire + date). Format idéal pour envoi email/WhatsApp. Cache Service Worker incrémenté à `v11`.
- [x] **Affichage adversaire + date sur la page fin de match.** En-tête de section en haut de la modale (adversaire en gros doré + date). Les boutons d'export sont masqués lors de la capture d'image (`#end-match-export-buttons` caché avant html2canvas, restauré après) pour ne pas apparaître sur l'image exportée.
- [x] **Stats des colonnes centrales filtrées par mi-temps.** `renderStats()` filtre désormais les événements par la mi-temps sélectionnée (`ui.period`) : si MT1 est actif, les colonnes GB1, GB2 et Global affichent les stats de la mi-temps 1 ; si MT2, celles de la mi-temps 2.
- [x] **Bouton "Fin" renommé en "Stats".** Le libellé du bouton `#btn-end-match` dans `index.html` passe de "Fin" à "Stats".
- [x] **Uniformisation des largeurs des boutons MT1/MT2/Stats.** Ajout de `flex-1` sur les 3 boutons du conteneur période pour qu'ils aient tous la même largeur (visuellement parfait). Réduction de la police du bouton "Stats" (`text-sm` au lieu de `text-base`) pour compenser le texte plus long. Classes synchronisées dans `renderSelectors()` (`app.js`).
- [x] **Correction No Sleep sur iPhone.** L'API Wake Lock n'est pas supportée par Safari iOS → l'écran s'éteignait. Solution : **NoSleep.js** (CDN) ajouté dans `index.html` + logique dans `app.js` (`isIOS()`, `requestWakeLock()` utilise NoSleep sur iOS, Wake Lock natif ailleurs). NoSleep nécessite un geste utilisateur sur iOS → activation au premier tap (`touchstart`/`click` avec `{ once: true }`). Cache Service Worker incrémenté à `v13` pour forcer la mise à jour.
- [x] **Correction safe-area iOS (encoche / Dynamic Island).** Sur iPhone, la barre de statut empietait sur le header et bloquait le clic sur `#btn-settings`. Ajout de la classe CSS `.safe-top` (`padding-top: max(env(safe-area-inset-top), 12px)`) appliquée au header principal + aux headers des modales (paramètres, fin de match) pour aligner tous les conteneurs vers le bas et garantir l'accès aux boutons. Cache Service Worker incrémenté à `v14`.

















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
