/* ============================================================
 * Stat-GB - app.js
 * PWA Vanilla - Event Sourcing + localStorage + Wake Lock
 * ============================================================ */


'use strict';

/* ============================================================
 * 1. CONSTANTES & ÉTAT GLOBAL
 * ============================================================ */

const STORAGE_KEY = 'hbc_nantes_live_stats';

// État global de l'application (persisté dans localStorage)
let state = {
  settings: {
    colors: {
      streak_low: '#10B981',  // Vert (1-2 buts/arrêts)
      streak_mid: '#F59E0B',  // Orange (3-4 buts)
      streak_high: '#FF0000'  // Rouge clignotant (5+ buts)
    },
    thresholds: {
      percent_low: 25, // < 25% Rouge
      percent_mid: 35  // 25-35% Orange, > 35% Vert
    },
    streak_high_threshold: 5, // Nombre d'arrêts critiques (nb de paliers)
    streak_colors: ['#10B981', '#10B981', '#F59E0B', '#F59E0B', '#FF0000'] // Couleur par palier de buts encaissés
  },
  current_match: null,
  history: []
};

// État UI non persisté (session)
let ui = {
  activeGb: 'G1',      // Gardien actif
  period: 'MT1',       // Période courante
  penaltyActive: false, // Toggle penalty
  gbBeforePenalty: null, // GB qui jouait avant l'activation du penalty
  gbChangedDuringPenalty: false, // Indique si le GB a été changé pendant le penalty
  gbStreakReset: {} // GB dont la série a été remise à 0 (ex: { G2: true })
};



/* ============================================================
 * 2. UTILITAIRES
 * ============================================================ */

/** Génère un UUID v4. */
function generateUUID() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Retourne la date du jour au format YYYY-MM-DD. */
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Borne une valeur entre min et max. */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Convertit une couleur HSL en hex (#rrggbb). */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

/**
 * Génère une gradation naturelle de couleurs du vert clair (gauche) au rouge vif (droite).
 * @param {number} n - nombre de couleurs
 * @returns {string[]} tableau de couleurs hex
 */
function generateGradientPalette(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1); // 0 → 1
    // Teinte : 120° (vert) → 0° (rouge), en passant par le jaune (60°) et l'orange (30°)
    const hue = 120 - 120 * t;
    // Saturation et luminosité CONSTANTES pour éviter les variations confuses.
    // Seule la teinte varie : la gradation est claire et sans ambiguïté.
    // Luminosité 45% : texte blanc lisible dans #streak-block.
    const sat = 85;
    const light = 45;
    colors.push(hslToHex(hue, sat, light));
  }
  return colors;
}

// Palette de couleurs simplifiée (gradation naturelle vert clair → rouge vif, 9 nuances franches)
const COLOR_PALETTE = generateGradientPalette(9);

/**
 * Crée un sélecteur de couleur simplifié (bouton rond + palette de swatches).
 * @param {string} containerId - id du conteneur
 * @param {string} initialColor - couleur initiale (hex)
 * @param {function(string):void} onChange - callback appelé au changement de couleur
 */
function createColorPicker(containerId, initialColor, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.className = 'relative shrink-0';

  // Bouton rond affichant la couleur actuelle
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'w-8 h-8 rounded-full border-2 border-white/70 shadow cursor-pointer';
  btn.style.backgroundColor = initialColor;
  btn.setAttribute('aria-label', 'Choisir une couleur');

  // Palette déroulante (masquée par défaut)
  const palette = document.createElement('div');
  palette.className = 'hidden absolute top-10 left-0 z-20 bg-slate-800 border border-slate-600 rounded-xl p-2 shadow-xl w-40';
  palette.style.display = 'none';

  COLOR_PALETTE.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'w-6 h-6 rounded-full border-2 m-0.5 cursor-pointer ' + (color === initialColor ? 'border-white' : 'border-transparent');
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.style.backgroundColor = color;
      palette.querySelectorAll('button').forEach((b) => {
        const isSel = b.style.backgroundColor === color;
        b.classList.toggle('border-white', isSel);
        b.classList.toggle('border-transparent', !isSel);
      });
      palette.style.display = 'none';
      onChange(color);
    });
    palette.appendChild(swatch);
  });

  // Toggle de la palette au clic sur le bouton
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    palette.style.display = palette.style.display === 'none' ? 'block' : 'none';
  });

  // Ferme la palette si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) palette.style.display = 'none';
  });

  container.appendChild(btn);
  container.appendChild(palette);
}

/**
 * Génère automatiquement les couleurs des paliers de buts en gradation naturelle :
 * du vert clair (1er palier) au rouge vif (palier critique), en passant par le jaune et l'orange.
 * Toutes les couleurs sont différentes. La gradation s'adapte automatiquement au nombre de paliers.
 * @param {number} n - nombre de paliers (arrêts critiques)
 * @returns {string[]} tableau de couleurs hex
 */
function generateStreakColors(n) {
  return generateGradientPalette(n);
}

/* ============================================================
 * 3. STOCKAGE (localStorage - Event Sourcing)
 * ============================================================ */

/** Charge l'état depuis localStorage. */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Fusion avec les défauts pour tolérer les versions anciennes
      state = {
        settings: { ...state.settings, ...parsed.settings },
        current_match: parsed.current_match || null,
        history: parsed.history || []
      };
      state.settings.colors = { ...state.settings.colors, ...(parsed.settings && parsed.settings.colors) };
      state.settings.thresholds = { ...state.settings.thresholds, ...(parsed.settings && parsed.settings.thresholds) };
      // Migration : si streak_colors absent (ancienne version), on génère la déclinaison auto
      if (!state.settings.streak_colors || state.settings.streak_colors.length === 0) {
        state.settings.streak_colors = generateStreakColors(state.settings.streak_high_threshold);
      }
    }
  } catch (e) {
    console.error('Erreur chargement localStorage', e);
  }
}

/** Persiste l'état dans localStorage. */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erreur sauvegarde localStorage', e);
  }
}

/** Archive le match courant dans history et le remplace par un nouveau. */
function startNewMatch(opponent, g1Name, g1Num, g2Name, g2Num, date) {
  if (state.current_match && state.current_match.events.length > 0) {
    state.history.push(state.current_match);
  }
  state.current_match = {
    id: generateUUID(),
    date: date || todayISO(),
    opponent: opponent || 'Adversaire',

    gardiens: {
      G1: { name: g1Name || 'GB1', number: g1Num || '' },
      G2: { name: g2Name || 'GB2', number: g2Num || '' }
    },

    events: []
  };
  ui.activeGb = 'G1';
  ui.period = 'MT1';
  ui.penaltyActive = false;
  saveState();
  renderAll();
}

/** Efface toutes les données (zone danger). */
function clearAllData() {
  state.current_match = null;
  state.history = [];
  saveState();
  renderAll();
}

/* ============================================================
 * 4. LOGIQUE MÉTIER (Event Sourcing)
 * ============================================================ */

/**
 * Calcule le % d'arrêts global du match pour un gardien (cumul total, penaltys inclus).
 * @param {string} gbId - 'G1' ou 'G2'
 * @returns {number|null} Pourcentage arrondi, ou null si aucune action.
 */
function computePercent(events, gbId) {
  const gbEvents = events.filter((e) => e.activeGb === gbId);
  const shots = gbEvents.length;
  if (shots === 0) return null;
  const saves = gbEvents.filter((e) => e.action === 'ARRET').length;
  return Math.round((saves / shots) * 100);
}

/**
 * Calcule le % d'arrêts global de l'équipe (les 2 gardiens confondus).
 * @returns {number|null}
 */
function computeGlobalPercent(events) {
  if (events.length === 0) return null;
  const saves = events.filter((e) => e.action === 'ARRET').length;
  return Math.round((saves / events.length) * 100);
}

/**
 * Calcule le ratio arrêts/tirs d'un gardien (ex: 5 arrêts sur 7 tirs → "5/7").
 * @param {Array} events - événements du match
 * @param {string} gbId - 'G1' ou 'G2'
 * @returns {{ saves: number, shots: number }}
 */
function computeRatio(events, gbId) {
  const gbEvents = events.filter((e) => e.activeGb === gbId);
  const saves = gbEvents.filter((e) => e.action === 'ARRET').length;
  return { saves, shots: gbEvents.length };
}

/**
 * Calcule le ratio arrêts/tirs global de l'équipe (les 2 gardiens confondus).
 * @returns {{ saves: number, shots: number }}
 */
function computeGlobalRatio(events) {
  const saves = events.filter((e) => e.action === 'ARRET').length;
  return { saves, shots: events.length };
}

/**
 * Calcule le ratio arrêts/tirs sur les penaltys uniquement d'un gardien.
 * @param {Array} events - événements du match
 * @param {string} gbId - 'G1' ou 'G2'
 * @returns {{ saves: number, shots: number }}
 */
function computePenaltyRatio(events, gbId) {
  const penaltyEvents = events.filter((e) => e.activeGb === gbId && e.isPenalty);
  const saves = penaltyEvents.filter((e) => e.action === 'ARRET').length;
  return { saves, shots: penaltyEvents.length };
}

/**
 * Calcule le ratio arrêts/tirs sur les penaltys uniquement de l'équipe (les 2 gardiens confondus).
 * @returns {{ saves: number, shots: number }}
 */
function computeGlobalPenaltyRatio(events) {
  const penaltyEvents = events.filter((e) => e.isPenalty);
  const saves = penaltyEvents.filter((e) => e.action === 'ARRET').length;
  return { saves, shots: penaltyEvents.length };
}

/**
 * Formate un ratio arrêts/tirs avec les stats penaltys.
 * Ex: "3/11 (p 2/3)" = 3 arrêts sur 11 tirs, dont 2 arrêts sur 3 penaltys.
 * @param {{ saves: number, shots: number }} ratio - ratio global
 * @param {{ saves: number, shots: number }} penaltyRatio - ratio penaltys
 * @returns {string}
 */
function formatRatio(ratio, penaltyRatio) {
  const base = ratio.shots === 0 ? '0/0' : ratio.saves + '/' + ratio.shots;
  if (penaltyRatio.shots === 0) return base;
  return base + ' (p ' + penaltyRatio.saves + '/' + penaltyRatio.shots + ')';
}


/**
 * Calcule la série en cours (BUTS ou ARRÊTS) d'un gardien pour une période donnée.
 * Les penaltys ne cassent PAS la série. Un penalty compte dans la série du GB
 * uniquement s'il n'y a pas eu de changement de GB pendant le penalty (`countInStreak`).
 * @returns {{ type: 'BUT'|'ARRET'|null, count: number }}
 */
function computeStreak(events, gbId, period) {
  // Un événement compte dans la série s'il n'est pas un penalty, ou s'il est un penalty
  // qui doit compter dans la série (pas de changement de GB pendant le penalty).
  // Si la série du GB a été remise à 0 (entrée pendant un penalty), on ignore les
  // événements antérieurs au reset (la série repart de zéro).
  const resetTime = ui.gbStreakReset[gbId];
  const gbEvents = events.filter((e) =>
    e.activeGb === gbId &&
    e.period === period &&
    (!e.isPenalty || e.countInStreak) &&
    (!resetTime || e.timestamp >= resetTime)
  );
  if (gbEvents.length === 0) return { type: null, count: 0 };



  // On parcourt de la fin vers le début pour trouver la série en cours
  const last = gbEvents[gbEvents.length - 1];
  let count = 1;
  for (let i = gbEvents.length - 2; i >= 0; i--) {
    if (gbEvents[i].action === last.action) count++;
    else break;
  }
  return { type: last.action, count };
}

/**
 * Retourne la couleur de la série selon les paliers configurés.
 * @param {{type, count}} streak
 * @returns {string} couleur hex
 */
function getStreakColor(streak, settings) {
  if (streak.type === 'BUT') {
    // Couleur par palier de buts encaissés (streak_colors)
    const colors = settings.streak_colors || [];
    const idx = Math.min(streak.count - 1, colors.length - 1);
    return colors[idx] || settings.colors.streak_high;
  }
  // Série d'arrêts : toujours verte (positive)
  return settings.colors.streak_low;
}

/**
 * Retourne la couleur du % d'arrêts selon les seuils.
 * @param {number|null} percent
 */
function getPercentColor(percent, settings) {
  if (percent === null) return '#ffffff';
  if (percent < settings.thresholds.percent_low) return settings.colors.streak_high;
  if (percent < settings.thresholds.percent_mid) return settings.colors.streak_mid;
  return settings.colors.streak_low;
}

/**
 * Crée automatiquement un match par défaut si aucun match n'est lancé,
 * afin de pouvoir utiliser l'application immédiatement (sans passer par les paramètres).
 */
function ensureMatch() {
  if (!state.current_match) {
    startNewMatch('Adversaire', 'GB1', '', 'GB2', '');
  }
}

/**
 * Enregistre une action (BUT / ARRÊT) en tant qu'événement horodaté.
 * @param {'BUT'|'ARRET'} action
 */
function recordAction(action) {
  // Permet d'utiliser l'app sans lancer de match : création auto d'un match par défaut
  ensureMatch();

  const event = {
    id: generateUUID(),
    timestamp: Date.now(),
    action,
    isPenalty: ui.penaltyActive,
    // Un penalty compte dans la série du GB uniquement s'il n'y a pas eu de changement de GB pendant le penalty
    countInStreak: ui.penaltyActive && !ui.gbChangedDuringPenalty,
    period: ui.period,
    activeGb: ui.activeGb
  };
  state.current_match.events.push(event);
  // Désactivation automatique du toggle penalty après une action
  ui.penaltyActive = false;
  // Si c'était un penalty :
  //  - pas de changement de GB pendant le penalty → on continue la série (le GB qui a tiré reste actif)
  //  - changement de GB pendant le penalty → on revient au GB qui jouait avant le penalty
  if (event.isPenalty && ui.gbChangedDuringPenalty && ui.gbBeforePenalty) {
    ui.activeGb = ui.gbBeforePenalty;
  }
  ui.gbBeforePenalty = null;
  ui.gbChangedDuringPenalty = false;
  saveState();
  renderAll();
}



/** Annule la dernière action (Undo) et recalcule tout. */
function undoAction() {
  if (!state.current_match || state.current_match.events.length === 0) return;
  state.current_match.events.pop();
  saveState();
  renderAll();
}

/* ============================================================
 * 5. WAKE LOCK (No Sleep)
 * ============================================================ */

let wakeLock = null;

/** Demande le Wake Lock pour empêcher l'écran de s'éteindre. */
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        // Re-demande automatiquement si la page redevient visible
        if (document.visibilityState === 'visible') requestWakeLock();
      });
    }
  } catch (e) {
    console.warn('Wake Lock non disponible', e);
  }
}

// Re-demande le Wake Lock quand la page redevient visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

/* ============================================================
 * 6. RENDU UI
 * ============================================================ */

/** Met à jour l'ensemble de l'interface. */
function renderAll() {
  renderHeader();
  renderSelectors();
  renderStats();
  renderStreak();
  renderPenalty();
  renderSettingsForm();
}

/** Header : nom de l'adversaire. */
function renderHeader() {
  const el = document.getElementById('opponent-name');
  el.textContent = state.current_match ? state.current_match.opponent : '—';
}

/** Sélecteurs rapides : état actif MT1/MT2 et G1/G2. */
function renderSelectors() {
  const mt1 = document.getElementById('btn-mt1');
  const mt2 = document.getElementById('btn-mt2');
  const g1 = document.getElementById('btn-g1');
  const g2 = document.getElementById('btn-g2');

  // Période (largeur stricte, sans espace superflu)
  mt1.className = ui.period === 'MT1'
    ? 'px-2 py-3 text-base font-black uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-2 py-3 text-base font-black uppercase tracking-wide bg-slate-800 text-white/60';
  mt2.className = ui.period === 'MT2'
    ? 'px-2 py-3 text-base font-black uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-2 py-3 text-base font-black uppercase tracking-wide bg-slate-800 text-white/60';


  // Gardien (2 boutons égaux, noms sur 2 lignes si trop long)
  g1.className = ui.activeGb === 'G1'
    ? 'flex-1 px-2 py-2 text-sm font-black uppercase tracking-wide bg-[#4a266a] text-[#f2c200] min-w-0 leading-tight line-clamp-2 h-full'
    : 'flex-1 px-2 py-2 text-sm font-black uppercase tracking-wide bg-slate-800 text-white/60 min-w-0 leading-tight line-clamp-2 h-full';
  g2.className = ui.activeGb === 'G2'
    ? 'flex-1 px-2 py-2 text-sm font-black uppercase tracking-wide bg-[#4a266a] text-[#f2c200] min-w-0 leading-tight line-clamp-2 h-full'
    : 'flex-1 px-2 py-2 text-sm font-black uppercase tracking-wide bg-slate-800 text-white/60 min-w-0 leading-tight line-clamp-2 h-full';





  // Libellés des boutons gardiens
  if (state.current_match) {
    g1.textContent = state.current_match.gardiens.G1.name || 'GB1';
    g2.textContent = state.current_match.gardiens.G2.name || 'GB2';
  }

}

/**
 * Blocs % d'arrêts : GB1 (colonne 1), GB2 (colonne 2), global (colonne 3).
 * Les colonnes 1 et 2 sont FIXES : elles affichent toujours respectivement
 * les stats du GB1 et du GB2, indépendamment du gardien actif.
 */
function renderStats() {
  const events = state.current_match ? state.current_match.events : [];
  const settings = state.settings;

  const globalPercent = computeGlobalPercent(events);
  const globalRatio = computeGlobalRatio(events);
  const globalPenaltyRatio = computeGlobalPenaltyRatio(events);

  // Colonne 1 : GB1 (fixe)
  const g1Percent = computePercent(events, 'G1');
  const g1Ratio = computeRatio(events, 'G1');
  const g1PenaltyRatio = computePenaltyRatio(events, 'G1');

  const elG1Name = document.getElementById('gb-active-name');
  const elG1Percent = document.getElementById('gb-active-percent');
  const elG1Ratio = document.getElementById('gb-active-ratio');
  if (state.current_match) {
    elG1Name.textContent = state.current_match.gardiens.G1.name || 'GB1';
  }
  elG1Percent.textContent = g1Percent === null ? '0%' : g1Percent + '%';
  elG1Percent.style.color = getPercentColor(g1Percent, settings);
  elG1Ratio.textContent = formatRatio(g1Ratio, g1PenaltyRatio);
  elG1Ratio.style.color = getPercentColor(g1Percent, settings);

  // Colonne 2 : GB2 (fixe)
  const g2Percent = computePercent(events, 'G2');
  const g2Ratio = computeRatio(events, 'G2');
  const g2PenaltyRatio = computePenaltyRatio(events, 'G2');

  const elG2Name = document.getElementById('gb-bench-name');
  const elG2Percent = document.getElementById('gb-bench-percent');
  const elG2Ratio = document.getElementById('gb-bench-ratio');
  if (state.current_match) {
    elG2Name.textContent = state.current_match.gardiens.G2.name || 'GB2';
  }
  elG2Percent.textContent = g2Percent === null ? '0%' : g2Percent + '%';
  elG2Percent.style.color = getPercentColor(g2Percent, settings);
  elG2Ratio.textContent = formatRatio(g2Ratio, g2PenaltyRatio);
  elG2Ratio.style.color = getPercentColor(g2Percent, settings);

  // Colonne 3 : Global
  const elGlobalPercent = document.getElementById('gb-global-percent');
  const elGlobalRatio = document.getElementById('gb-global-ratio');
  elGlobalPercent.textContent = globalPercent === null ? '0%' : globalPercent + '%';
  elGlobalPercent.style.color = getPercentColor(globalPercent, settings);
  elGlobalRatio.textContent = formatRatio(globalRatio, globalPenaltyRatio);
  elGlobalRatio.style.color = getPercentColor(globalPercent, settings);
}




/** Bloc série en cours (gardien actif uniquement). */
function renderStreak() {
  const events = state.current_match ? state.current_match.events : [];
  const settings = state.settings;
  const streak = computeStreak(events, ui.activeGb, ui.period);

  const elValue = document.getElementById('streak-value');
  const elLabel = document.getElementById('streak-label');
  const elBlock = document.getElementById('streak-block');
  const elTitle = document.getElementById('streak-title');
  const elGbName = document.getElementById('streak-gb-name');
  const elGbPercent = document.getElementById('streak-gb-percent');
  const elGbRatio = document.getElementById('streak-gb-ratio');
  const elGbPenalty = document.getElementById('streak-gb-penalty');

  // Nom du gardien actif affiché en gros (le GB en place dans le but)
  const gbName = state.current_match ? (state.current_match.gardiens[ui.activeGb].name || 'GB') : 'GB';
  elGbName.textContent = gbName;

  // Stats du GB actif rappelées sous le nom, sur 3 lignes : % / ratio / (p x/x)
  const activeRatio = computeRatio(events, ui.activeGb);
  const activePercent = computePercent(events, ui.activeGb);
  const activePenaltyRatio = computePenaltyRatio(events, ui.activeGb);
  elGbPercent.textContent = activePercent === null ? '0%' : activePercent + '%';
  elGbRatio.textContent = activeRatio.shots === 0 ? '0/0' : activeRatio.saves + '/' + activeRatio.shots;
  elGbPenalty.textContent = activePenaltyRatio.shots === 0 ? '' : '(p ' + activePenaltyRatio.saves + '/' + activePenaltyRatio.shots + ')';


  // Si un penalty est actif, le titre devient "PENALTY" en GROS et on masque la valeur + le label
  elTitle.textContent = ui.penaltyActive ? 'PENALTY' : 'Série en cours';
  elTitle.className = ui.penaltyActive
    ? 'font-oswald font-black text-4xl uppercase tracking-widest text-[#f2c200] mb-1'
    : 'text-xs font-bold uppercase text-white/60 tracking-widest mb-1';
  elValue.style.display = ui.penaltyActive ? 'none' : '';
  elLabel.style.display = ui.penaltyActive ? 'none' : '';



  elValue.textContent = String(streak.count);
  elLabel.textContent = streak.type === null ? '—' : (streak.type === 'BUT' ? 'Buts' : 'Arrêts');


  // Le fond du bloc est coloré selon la série (texte en blanc pour la lisibilité).
  // S'il n'y a pas encore de série, le fond reste neutre (slate).
  if (streak.type === null) {
    elBlock.style.backgroundColor = '';
    elValue.style.color = '#ffffff';
    elLabel.style.color = '#ffffff';
  } else {
    const color = getStreakColor(streak, settings);
    elBlock.style.backgroundColor = color;
    elValue.style.color = '#ffffff';
    elLabel.style.color = '#ffffff';
  }

  // Alerte clignotante (pulse) sur le fond si série de buts au palier critique
  const isCritical = streak.type === 'BUT' && streak.count >= settings.streak_high_threshold;
  elBlock.classList.toggle('streak-alert', isCritical);
  if (isCritical) {
    elBlock.style.borderColor = settings.colors.streak_high;
  } else {
    elBlock.style.borderColor = '';
  }
}



/* ============================================================
 * 6bis. MODALE FIN DE MATCH - SÉRIES PAR MI-TEMPS
 * ============================================================ */

/**
 * Calcule la série en cours à chaque événement sur une période, en ALTERNANT
 * les gardiens sur une seule timeline. Quand le GB change, la série repart de 0
 * (un point de reset à 0 est inséré pour rendre la transition visible).
 * Les penaltys qui ne comptent pas dans la série (`countInStreak === false`)
 * sont ignorés, ainsi que les événements antérieurs au reset de série du GB.
 * @param {Array} events - événements du match
 * @param {string} period - 'MT1' ou 'MT2'
 * @returns {Array<{index:number, value:number, gb:string, reset?:boolean}>}
 */
function computeMergedStreakTimeline(events, period) {
  const periodEvents = events.filter((e) => e.period === period);
  const points = [];
  let currentGb = null;
  let pointIndex = 0;
  // Série par gardien (indépendante) : on conserve la série de chaque GB
  // pour gérer correctement les retours après pénalty (série conservée)
  // vs les changements normaux (série remise à 0).
  const streaks = { G1: 0, G2: 0 };

  periodEvents.forEach((e) => {
    // Ignore les penaltys qui ne comptent pas dans la série
    if (e.isPenalty && !e.countInStreak) return;

    // Changement de GB
    if (e.activeGb !== currentGb) {
      if (currentGb !== null) {
        points.push({ index: pointIndex++, value: 0, gb: e.activeGb, reset: true });
      }
      currentGb = e.activeGb;
      // Si le GB a été remis à 0 (reset posé par switchGuardian), sa série repart de 0.
      // Sinon (retour après pénalty), on conserve la série précédente du GB.
      const resetTime = ui.gbStreakReset[e.activeGb];
      if (resetTime) {
        streaks[e.activeGb] = 0;
      }
    }

    if (e.action === 'ARRET') {
      streaks[e.activeGb]++;
    } else {
      streaks[e.activeGb] = 0; // But encaissé → la série retombe à 0
    }
    points.push({ index: pointIndex++, value: streaks[e.activeGb], gb: currentGb });
  });

  return points;
}




/**
 * Génère un graphique en ligne SVG représentant l'évolution de la série d'arrêts
 * dans le temps sur une période donnée, en ALTERNANT les gardiens sur une seule
 * ligne (pas de superposition). La couleur de la ligne change selon le gardien
 * actif (GB1 en jaune, GB2 en bleu). Quand le gardien change, la série repart de 0.
 * - Axe X : les événements successifs (ligne du temps)
 * - Axe Y : la valeur de la série d'arrêts en cours
 * - La ligne monte quand il y a des arrêts, descend à 0 quand un but est encaissé
 * @param {Array} events - événements du match
 * @param {string} period - 'MT1' ou 'MT2'
 * @param {Object} gardiens - { G1: {name}, G2: {name} }
 * @returns {string} HTML SVG
 */
function renderStreakLineChart(events, period, gardiens) {
  const W = 320; // largeur SVG
  const H = 160; // hauteur SVG
  const PAD_L = 24; // padding gauche (axe Y)
  const PAD_R = 10; // padding droite
  const PAD_T = 10; // padding haut
  const PAD_B = 20; // padding bas (axe X)

  const colors = { G1: '#f2c200', G2: '#38bdf8' }; // Jaune pour GB1, Bleu clair pour GB2

  // Timeline unique alternant les gardiens
  const points = computeMergedStreakTimeline(events, period);
  if (points.length === 0) {
    return '<div class="text-white/40 text-sm text-center py-3">Aucune action sur cette période</div>';
  }

  let maxStreak = 1;
  points.forEach((p) => { if (p.value > maxStreak) maxStreak = p.value; });

  // Dimensions utiles du graphique
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const total = points.length;

  // Fonction de mapping : index → x, value → y
  const xFor = (idx) => PAD_L + (total <= 1 ? plotW / 2 : (idx / (total - 1)) * plotW);
  const yFor = (val) => PAD_T + plotH - (val / maxStreak) * plotH;

  // Construit les segments de ligne par gardien (la couleur change au changement de GB)
  let paths = '';
  let segStart = 0;
  let segGb = points[0].gb;
  for (let i = 1; i <= points.length; i++) {
    const isNew = i === points.length || points[i].gb !== segGb;
    if (isNew) {
      let d = `M ${xFor(points[segStart].index)} ${yFor(points[segStart].value)}`;
      for (let j = segStart + 1; j < i; j++) {
        d += ` L ${xFor(points[j].index)} ${yFor(points[j].value)}`;
      }
      paths += `<path d="${d}" fill="none" stroke="${colors[segGb]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (i < points.length) {
        segGb = points[i].gb;
        segStart = i;
      }
    }
  }

  // Points SVG (cercles) : blanc = arrêt, rouge = but encaissé, gris = reset de série
  const dots = points.map((p) => {
    const cx = xFor(p.index);
    const cy = yFor(p.value);
    let fill = '#ffffff';
    if (p.reset) {
      fill = '#94a3b8'; // gris = changement de gardien (série remise à 0)
    } else if (p.value === 0 && p.index > 0) {
      fill = '#b91c1c'; // rouge = but encaissé
    }
    return `<circle cx="${cx}" cy="${cy}" r="3" fill="${fill}" stroke="#0f172a" stroke-width="1"/>`;
  }).join('');

  // Grille horizontale (lignes de référence pour les valeurs de série)
  let gridHtml = '';
  for (let v = 1; v <= maxStreak; v++) {
    const y = yFor(v);
    gridHtml += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3"/>`;
    gridHtml += `<text x="${PAD_L - 4}" y="${y + 3}" fill="#64748b" font-size="8" text-anchor="end">${v}</text>`;
  }

  // Légende
  const legendHtml = `
    <div class="flex items-center gap-4 mb-2">
      <span class="flex items-center gap-1.5 text-xs text-white/70">
        <span class="w-3 h-0.5 inline-block" style="background-color:${colors.G1}"></span>
        ${gardiens.G1.name || 'GB1'}
      </span>
      <span class="flex items-center gap-1.5 text-xs text-white/70">
        <span class="w-3 h-0.5 inline-block" style="background-color:${colors.G2}"></span>
        ${gardiens.G2.name || 'GB2'}
      </span>
      <span class="flex items-center gap-1.5 text-xs text-white/50 ml-auto">
        <span class="w-2 h-2 rounded-full inline-block bg-red-600"></span> But
      </span>
    </div>`;

  return `
    ${legendHtml}
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" style="background-color:#1e293b;border-radius:8px;">
      ${gridHtml}
      ${paths}
      ${dots}
    </svg>`;
}


/**
 * Calcule les stats d'un gardien sur une période donnée (ou tout le match si period = null).
 * @param {Array} events - événements du match
 * @param {string} gbId - 'G1' ou 'G2'
 * @param {string|null} period - 'MT1', 'MT2' ou null (tout le match)
 * @returns {{ saves:number, goals:number, shots:number, percent:number|null, penaltySaves:number, penaltyShots:number }}
 */
function computeGbStats(events, gbId, period) {
  const gbEvents = events.filter((e) =>
    e.activeGb === gbId &&
    (period === null || e.period === period)
  );
  const saves = gbEvents.filter((e) => e.action === 'ARRET').length;
  const goals = gbEvents.filter((e) => e.action === 'BUT').length;
  const shots = gbEvents.length;
  const percent = shots === 0 ? null : Math.round((saves / shots) * 100);
  const penaltyEvents = gbEvents.filter((e) => e.isPenalty);
  const penaltySaves = penaltyEvents.filter((e) => e.action === 'ARRET').length;
  return { saves, goals, shots, percent, penaltySaves, penaltyShots: penaltyEvents.length };
}

/**
 * Génère une ligne de stats d'un gardien (nom + arrêts/buts/% + penaltys).
 * @param {string} gbId - 'G1' ou 'G2'
 * @param {Object} stats - stats calculées par computeGbStats
 * @param {Object} gardiens - { G1: {name}, G2: {name} }
 * @param {boolean} isLast - si true, pas de bordure basse
 * @returns {string} HTML
 */
function renderGbStatsRow(gbId, stats, gardiens, isLast) {
  const name = gardiens[gbId].name || gbId;
  const percentText = stats.percent === null ? '—' : stats.percent + '%';
  const penaltyText = stats.penaltyShots === 0 ? '' : ` (p ${stats.penaltySaves}/${stats.penaltyShots})`;
  return `
    <div class="flex items-center justify-between py-1.5 ${isLast ? '' : 'border-b border-slate-700/50'}">
      <span class="text-sm font-semibold text-white/80">${name}</span>
      <span class="text-sm text-white/60">
        <span class="text-emerald-400 font-bold">${stats.saves}</span> arrêts
        <span class="mx-1 text-white/30">·</span>
        <span class="text-red-400 font-bold">${stats.goals}</span> buts
        <span class="mx-1 text-white/30">·</span>
        <span class="text-[#f2c200] font-bold">${percentText}</span>${penaltyText}
      </span>
    </div>`;
}

/**
 * Génère le contenu complet de la modale "Fin de match" :
 * - pour chaque mi-temps : graphique en ligne (alternance des GB) + stats des 2 GB
 * - en bas du 2ème graph : stats totales du match (GB1, GB2, Global)
 * - boutons d'export (JSON / CSV) de toutes les données collectées
 */
function renderEndMatchModal() {
  const container = document.getElementById('end-match-content');
  if (!container) return;

  const events = state.current_match ? state.current_match.events : [];
  const gardiens = state.current_match ? state.current_match.gardiens : { G1: { name: 'GB1' }, G2: { name: 'GB2' } };

  if (events.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-800/60 rounded-xl p-6 border border-slate-700 text-center">
        <p class="text-white/60 text-sm">Aucune donnée pour ce match.</p>
      </div>`;
    return;
  }

  let html = '';

  // En-tête du match : adversaire + date (affiché sur la page ET sur l'image exportée)
  const opponent = state.current_match ? state.current_match.opponent : 'Match';
  const matchDate = state.current_match ? state.current_match.date : todayISO();
  html += `
    <section class="bg-slate-800/60 rounded-xl p-4 border border-slate-700 text-center">
      <h3 class="font-oswald font-bold text-2xl text-[#f2c200] uppercase tracking-wide">${opponent}</h3>
      <p class="text-white/60 text-sm mt-1">${matchDate}</p>
    </section>`;

  // Pour chaque mi-temps : graphique + stats des 2 GB
  ['MT1', 'MT2'].forEach((period) => {

    const periodEvents = events.filter((e) => e.period === period);
    const saves = periodEvents.filter((e) => e.action === 'ARRET').length;
    const goals = periodEvents.filter((e) => e.action === 'BUT').length;

    const g1Stats = computeGbStats(events, 'G1', period);
    const g2Stats = computeGbStats(events, 'G2', period);

    html += `
      <section class="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-oswald font-bold text-lg text-[#f2c200] uppercase">
            ${period === 'MT1' ? 'Mi-temps 1' : 'Mi-temps 2'}
          </h3>
          <span class="text-xs text-white/50">
            <span class="text-emerald-400 font-bold">${saves} arrêts</span>
            <span class="mx-1">·</span>
            <span class="text-red-400 font-bold">${goals} buts</span>
          </span>
        </div>
        ${renderStreakLineChart(events, period, gardiens)}
        <div class="mt-3 bg-slate-900/50 rounded-lg p-3">
          ${renderGbStatsRow('G1', g1Stats, gardiens, false)}
          ${renderGbStatsRow('G2', g2Stats, gardiens, true)}
        </div>
      </section>`;
  });

  // Stats totales du match (en bas du 2ème graph)
  const g1Match = computeGbStats(events, 'G1', null);
  const g2Match = computeGbStats(events, 'G2', null);
  const matchSaves = events.filter((e) => e.action === 'ARRET').length;
  const matchGoals = events.filter((e) => e.action === 'BUT').length;
  const matchShots = events.length;
  const matchPercent = matchShots === 0 ? null : Math.round((matchSaves / matchShots) * 100);
  const matchPenaltyEvents = events.filter((e) => e.isPenalty);
  const matchPenaltySaves = matchPenaltyEvents.filter((e) => e.action === 'ARRET').length;
  const matchPenaltyText = matchPenaltyEvents.length === 0 ? '' : ` (p ${matchPenaltySaves}/${matchPenaltyEvents.length})`;

  html += `
    <section class="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-oswald font-bold text-lg text-[#f2c200] uppercase">Total Match</h3>
        <span class="text-xs text-white/50">
          <span class="text-emerald-400 font-bold">${matchSaves} arrêts</span>
          <span class="mx-1">·</span>
          <span class="text-red-400 font-bold">${matchGoals} buts</span>
        </span>
      </div>
      <div class="bg-slate-900/50 rounded-lg p-3">
        ${renderGbStatsRow('G1', g1Match, gardiens, false)}
        ${renderGbStatsRow('G2', g2Match, gardiens, false)}
        <div class="flex items-center justify-between py-1.5 border-t border-slate-700/50 mt-1 pt-2">
          <span class="text-sm font-bold text-white">Global</span>
          <span class="text-sm text-white/60">
            <span class="text-emerald-400 font-bold">${matchSaves}</span> arrêts
            <span class="mx-1 text-white/30">·</span>
            <span class="text-red-400 font-bold">${matchGoals}</span> buts
            <span class="mx-1 text-white/30">·</span>
            <span class="text-[#f2c200] font-bold">${matchPercent === null ? '—' : matchPercent + '%'}</span>${matchPenaltyText}
          </span>
        </div>
      </div>
    </section>`;

  // Boutons d'export (toutes les données collectées + image de la page)
  // NB : ce bloc est masqué lors de la capture d'image (exportEndMatchImage)
  html += `
    <div id="end-match-export-buttons" class="flex flex-col gap-3 mt-4">
      <button id="btn-export-image-modal" class="w-full px-4 py-3 rounded-xl bg-[#4a266a] border border-[#f2c200]/40 text-[#f2c200] font-bold text-sm hover:bg-[#5a307a] transition-colors flex items-center justify-center gap-2">
        <i data-lucide="image" class="w-4 h-4"></i> Exporter cette page en image
      </button>
      <div class="flex gap-3">
        <button id="btn-export-json-modal" class="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-bold text-sm hover:bg-slate-700 transition-colors">
          Export JSON
        </button>
        <button id="btn-export-csv-modal" class="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-bold text-sm hover:bg-slate-700 transition-colors">
          Export CSV
        </button>
      </div>
    </div>`;


  container.innerHTML = html;

  // Bind les boutons d'export de la modale fin de match
  document.getElementById('btn-export-image-modal').addEventListener('click', exportEndMatchImage);
  document.getElementById('btn-export-json-modal').addEventListener('click', () => exportHistory('json'));
  document.getElementById('btn-export-csv-modal').addEventListener('click', () => exportHistory('csv'));
}

/**
 * Exporte la page "Fin de match" (graphiques + stats) en image PNG.
 * Format idéal pour un envoi rapide par email ou WhatsApp (universel, lisible partout).
 * Utilise html2canvas pour capturer le contenu de la modale.
 */
function exportEndMatchImage() {
  const content = document.getElementById('end-match-content');
  if (!content) return;

  const btn = document.getElementById('btn-export-image-modal');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> Génération...';
  btn.disabled = true;

  // Masque les boutons d'export pour qu'ils n'apparaissent PAS sur l'image
  const exportButtons = document.getElementById('end-match-export-buttons');
  if (exportButtons) exportButtons.style.display = 'none';

  // Capture le contenu en image PNG haute résolution
  html2canvas(content, {
    backgroundColor: '#0f172a',
    scale: 2, // Haute résolution pour un rendu net
    useCORS: true,
    logging: false
  }).then((canvas) => {
    // Restaure les boutons d'export
    if (exportButtons) exportButtons.style.display = '';

    // Ajoute un en-tête professionnel (adversaire + date) au-dessus de l'image
    const opponent = state.current_match ? state.current_match.opponent : 'Match';
    const date = state.current_match ? state.current_match.date : todayISO();
    const headerCanvas = document.createElement('canvas');
    const headerHeight = 80;
    headerCanvas.width = canvas.width;
    headerCanvas.height = canvas.height + headerHeight;
    const ctx = headerCanvas.getContext('2d');

    // Fond de l'en-tête (violet HBC Nantes)
    ctx.fillStyle = '#4a266a';
    ctx.fillRect(0, 0, headerCanvas.width, headerHeight);
    // Ligne dorée
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(0, headerHeight - 3, headerCanvas.width, 3);

    // Titre
    ctx.fillStyle = '#f2c200';
    ctx.font = 'bold 32px Oswald, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STAT-GB — FIN DE MATCH', headerCanvas.width / 2, 34);

    // Sous-titre (adversaire + date)
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Montserrat, Arial, sans-serif';
    ctx.fillText(`${opponent} — ${date}`, headerCanvas.width / 2, 62);

    // Colle le contenu capturé sous l'en-tête
    ctx.drawImage(canvas, 0, headerHeight);

    // Télécharge le PNG
    const url = headerCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `stat-gb_fin-match_${opponent.replace(/\s+/g, '_')}_${date}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Restaure le bouton
    btn.innerHTML = originalText;
    btn.disabled = false;
  }).catch((err) => {
    console.error('Erreur export image', err);
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}




/** Ouvre la modale "Fin de match". */
function openEndMatchModal() {
  renderEndMatchModal();
  document.getElementById('end-match-modal').classList.remove('hidden');
}

/** Ferme la modale "Fin de match". */
function closeEndMatchModal() {
  document.getElementById('end-match-modal').classList.add('hidden');
}

/** Toggle penalty : état visuel actif/inactif. */
function renderPenalty() {

  const btn = document.getElementById('btn-penalty');
  btn.classList.toggle('penalty-active', ui.penaltyActive);
  btn.textContent = ui.penaltyActive ? 'Penalty actif ✓' : '7 Mètres / Penalty';
}

/** Génère les sélecteurs de couleur par palier de buts encaissés. */
function renderStreakColors() {
  const s = state.settings;
  const container = document.getElementById('streak-colors-container');
  if (!container) return;
  container.innerHTML = '';

  const n = s.streak_high_threshold;
  // Si la taille ne correspond pas, on régénère les couleurs par défaut (déclinaison auto)
  if (!s.streak_colors || s.streak_colors.length !== n) {
    s.streak_colors = generateStreakColors(n);
  }

  for (let i = 0; i < n; i++) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';

    const label = document.createElement('span');
    label.className = 'text-white/70 text-sm font-semibold w-16 shrink-0';
    label.textContent = (i + 1) + ' but' + (i === 0 ? '' : 's');

    const picker = document.createElement('div');
    picker.id = 'picker-streak-' + i;
    picker.className = 'shrink-0';

    row.appendChild(label);
    row.appendChild(picker);
    container.appendChild(row);

    // Crée le sélecteur de couleur simplifié
    createColorPicker('picker-streak-' + i, s.streak_colors[i], (color) => {
      s.streak_colors[i] = color;
      saveState(); renderAll();
    });
  }
}

/** Pré-remplit le formulaire de la modale avec les valeurs actuelles. */
function renderSettingsForm() {
  const s = state.settings;
  document.getElementById('inp-percent-low').value = s.thresholds.percent_low;
  document.getElementById('inp-percent-mid').value = s.thresholds.percent_mid;
  document.getElementById('inp-streak-high').value = s.streak_high_threshold;

  // Sélecteurs de couleur simplifiés pour les % d'arrêts
  createColorPicker('picker-color-high', s.colors.streak_high, (color) => {
    s.colors.streak_high = color;
    saveState(); renderAll();
  });
  createColorPicker('picker-color-mid', s.colors.streak_mid, (color) => {
    s.colors.streak_mid = color;
    saveState(); renderAll();
  });
  createColorPicker('picker-color-low', s.colors.streak_low, (color) => {
    s.colors.streak_low = color;
    saveState(); renderAll();
  });

  // Paliers de buts
  renderStreakColors();

  // Pré-remplir les champs du match si un match existe
  if (state.current_match) {
    document.getElementById('inp-date').value = state.current_match.date || todayISO();
    document.getElementById('inp-opponent').value = state.current_match.opponent;
    document.getElementById('inp-g1-name').value = state.current_match.gardiens.G1.name;
    document.getElementById('inp-g1-num').value = state.current_match.gardiens.G1.number;
    document.getElementById('inp-g2-name').value = state.current_match.gardiens.G2.name;
    document.getElementById('inp-g2-num').value = state.current_match.gardiens.G2.number;
  } else {
    // Pas de match actif : date du jour par défaut
    document.getElementById('inp-date').value = todayISO();
  }
}


/* ============================================================
 * 7. EXPORT (JSON / CSV)
 * ============================================================ */

/** Exporte l'historique au format demandé. */
function exportHistory(format) {
  const data = {
    settings: state.settings,
    current_match: state.current_match,
    history: state.history
  };

  let content, mime, filename;
  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    mime = 'application/json';
    filename = 'hbc_nantes_export.json';
  } else {
    // CSV : aplatit les événements de tous les matchs
    const rows = [['match_id', 'date', 'opponent', 'gb', 'gb_name', 'period', 'action', 'is_penalty', 'timestamp']];
    const allMatches = [...(state.current_match ? [state.current_match] : []), ...state.history];
    allMatches.forEach((m) => {
      m.events.forEach((e) => {
        rows.push([
          m.id, m.date, m.opponent, e.activeGb,
          m.gardiens[e.activeGb].name, e.period, e.action, e.isPenalty, e.timestamp
        ]);
      });
    });
    content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    mime = 'text/csv';
    filename = 'hbc_nantes_export.csv';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
 * 8. MODALE CONFIRMATION GÉNÉRIQUE
 * ============================================================ */

let confirmCallback = null;

/** Affiche une modale de confirmation. */
function showConfirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-modal').classList.remove('hidden');
  confirmCallback = onConfirm;
}

function hideConfirm() {
  document.getElementById('confirm-modal').classList.add('hidden');
  confirmCallback = null;
}

/* ============================================================
 * 9. GESTION DES ÉVÉNEMENTS UI
 * ============================================================ */

function bindEvents() {
  // Boutons d'action
  document.getElementById('btn-but').addEventListener('click', () => recordAction('BUT'));
  document.getElementById('btn-arret').addEventListener('click', () => recordAction('ARRET'));
  document.getElementById('btn-undo').addEventListener('click', undoAction);

  // Toggle penalty
  document.getElementById('btn-penalty').addEventListener('click', () => {
    ui.penaltyActive = !ui.penaltyActive;
    // Mémorise le GB qui jouait avant l'activation du penalty
    if (ui.penaltyActive) {
      ui.gbBeforePenalty = ui.activeGb;
      ui.gbChangedDuringPenalty = false;
    } else {
      ui.gbBeforePenalty = null;
      ui.gbChangedDuringPenalty = false;
    }
    renderPenalty();
    renderStreak();
  });


  // Sélecteurs période
  document.getElementById('btn-mt1').addEventListener('click', () => switchPeriod('MT1'));
  document.getElementById('btn-mt2').addEventListener('click', () => switchPeriod('MT2'));

  // Sélecteurs gardien
  document.getElementById('btn-g1').addEventListener('click', () => switchGuardian('G1'));
  document.getElementById('btn-g2').addEventListener('click', () => switchGuardian('G2'));

  // Modale fin de match
  document.getElementById('btn-end-match').addEventListener('click', openEndMatchModal);
  document.getElementById('btn-close-end-match').addEventListener('click', closeEndMatchModal);

  // Modale paramètres

  document.getElementById('btn-settings').addEventListener('click', () => {
    renderSettingsForm();
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });

  // Lancer un match
  document.getElementById('btn-start-match').addEventListener('click', () => {
    const date = document.getElementById('inp-date').value.trim();
    const opponent = document.getElementById('inp-opponent').value.trim();
    const g1Name = document.getElementById('inp-g1-name').value.trim();
    const g1Num = document.getElementById('inp-g1-num').value.trim();
    const g2Name = document.getElementById('inp-g2-name').value.trim();
    const g2Num = document.getElementById('inp-g2-num').value.trim();
    startNewMatch(opponent, g1Name, g1Num, g2Name, g2Num, date);
    document.getElementById('settings-modal').classList.add('hidden');
  });


  // Seuils visuels (% d'arrêts)
  document.getElementById('inp-percent-low').addEventListener('input', (e) => {
    state.settings.thresholds.percent_low = clamp(parseInt(e.target.value, 10) || 0, 0, 100);
    saveState(); renderAll();
  });
  document.getElementById('inp-percent-mid').addEventListener('input', (e) => {
    state.settings.thresholds.percent_mid = clamp(parseInt(e.target.value, 10) || 0, 0, 100);
    saveState(); renderAll();
  });
  // Stepper "Nombre d'arrêts critiques" : incrément/décrément de 1 en 1 (mobile-friendly)
  const applyStreakHigh = (value) => {
    state.settings.streak_high_threshold = clamp(value, 1, 10);
    // Régénère la déclinaison automatique des couleurs selon le nouveau nombre de paliers
    state.settings.streak_colors = generateStreakColors(state.settings.streak_high_threshold);
    saveState(); renderAll();
  };
  document.getElementById('btn-streak-minus').addEventListener('click', () => {
    applyStreakHigh(state.settings.streak_high_threshold - 1);
  });
  document.getElementById('btn-streak-plus').addEventListener('click', () => {
    applyStreakHigh(state.settings.streak_high_threshold + 1);
  });


  // Export
  document.getElementById('btn-export-json').addEventListener('click', () => exportHistory('json'));
  document.getElementById('btn-export-csv').addEventListener('click', () => exportHistory('csv'));

  // Effacer toutes les données
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    showConfirm('Effacer définitivement toutes les données ?', () => {
      clearAllData();
      hideConfirm();
    });
  });

  // Modale confirmation
  document.getElementById('btn-confirm-cancel').addEventListener('click', hideConfirm);
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
  });

  // Icônes Lucide
  if (window.lucide) lucide.createIcons();
}

/** Change la période (MT1/MT2) et brise les séries. */
function switchPeriod(period) {
  if (ui.period === period) return;
  ui.period = period;
  // Les séries sont recalculées automatiquement via computeStreak (par période),
  // donc le passage MT1→MT2 brise naturellement les séries.
  // On purge les timestamps de reset de série : ils ne sont valables que dans la
  // période où ils ont été posés (évite les re-sélections de pénalty obsolètes).
  ui.gbStreakReset = {};
  renderAll();
}

/** Change le gardien actif (G1/G2). */
function switchGuardian(gbId) {
  if (ui.activeGb === gbId) return;

  const leavingGb = ui.activeGb;

  if (ui.penaltyActive) {
    // Changement de GB pendant un penalty (cas particulier) :
    //  - la série du GB qui ENTRE est remise à 0 (définitivement)
    //  - la série du GB qui SORT n'est PAS remise à 0 (il conserve sa série d'avant péno,
    //    car il sera rétabli automatiquement dans les buts après le péno)
    ui.gbChangedDuringPenalty = true;
    ui.gbStreakReset[gbId] = Date.now();
  } else {
    // Changement normal de GB : la série du GB qui SORT est remise à 0.
    // Quand il reviendra dans les buts, sa série repartira de zéro.
    ui.gbStreakReset[leavingGb] = Date.now();

    // Re-sélection d'un GB après un penalty (scénario 3) : le dernier péno de ce GB
    // (enregistré après son reset) compte désormais dans sa série. Le GB conserve
    // sa série (remise à 0 + résultat du péno).
    if (state.current_match && ui.gbStreakReset[gbId]) {
      const resetTime = ui.gbStreakReset[gbId];
      const events = state.current_match.events;
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.activeGb === gbId && e.isPenalty && !e.countInStreak && e.timestamp >= resetTime) {
          e.countInStreak = true;
          saveState();
          break;
        }
      }
    }
  }

  ui.activeGb = gbId;
  renderAll();
}





/* ============================================================
 * 10. INITIALISATION
 * ============================================================ */

function init() {
  loadState();
  bindEvents();
  renderAll();
  requestWakeLock();
  registerServiceWorker();
}

/** Enregistre le Service Worker pour le fonctionnement hors-ligne. */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker non enregistré', err);
    });
  }
}

// Démarrage
document.addEventListener('DOMContentLoaded', init);


