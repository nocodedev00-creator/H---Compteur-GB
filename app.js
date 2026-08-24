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
  gbBeforePenalty: null // GB qui jouait avant l'activation du penalty
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
    // Saturation : 75% → 100% (plus vif vers le rouge)
    const sat = 75 + 25 * t;
    // Luminosité : 45% → 35% (plus profond vers le rouge).
    // Le vert clair (1er palier) est plus faible que le vert foncé (2e palier).
    // Les couleurs restent suffisamment foncées pour garder le texte blanc lisible dans #streak-block.
    const light = 45 - 10 * t;
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
function startNewMatch(opponent, g1Name, g1Num, g2Name, g2Num) {
  if (state.current_match && state.current_match.events.length > 0) {
    state.history.push(state.current_match);
  }
  state.current_match = {
    id: generateUUID(),
    date: todayISO(),
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
 * Les penaltys ne cassent PAS la série.
 * @returns {{ type: 'BUT'|'ARRET'|null, count: number }}
 */
function computeStreak(events, gbId, period) {
  const gbEvents = events.filter((e) => e.activeGb === gbId && e.period === period && !e.isPenalty);
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
 * Enregistre une action (BUT / ARRÊT) en tant qu'événement horodaté.
 * @param {'BUT'|'ARRET'} action
 */
function recordAction(action) {
  if (!state.current_match) {
    alert('Veuillez d\'abord lancer un match dans les paramètres.');
    return;
  }
  const event = {
    id: generateUUID(),
    timestamp: Date.now(),
    action,
    isPenalty: ui.penaltyActive,
    period: ui.period,
    activeGb: ui.activeGb
  };
  state.current_match.events.push(event);
  // Désactivation automatique du toggle penalty après une action
  ui.penaltyActive = false;
  // Si c'était un penalty, on revient au GB qui jouait pendant le match
  if (event.isPenalty && ui.gbBeforePenalty) {
    ui.activeGb = ui.gbBeforePenalty;
  }
  ui.gbBeforePenalty = null;
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

/** Blocs % d'arrêts : GB actif, GB banc, global. */
function renderStats() {
  const events = state.current_match ? state.current_match.events : [];
  const settings = state.settings;

  const activeGb = ui.activeGb;
  const benchGb = activeGb === 'G1' ? 'G2' : 'G1';

  const activePercent = computePercent(events, activeGb);
  const benchPercent = computePercent(events, benchGb);
  const globalPercent = computeGlobalPercent(events);

  const activeRatio = computeRatio(events, activeGb);
  const benchRatio = computeRatio(events, benchGb);
  const globalRatio = computeGlobalRatio(events);

  const activePenaltyRatio = computePenaltyRatio(events, activeGb);
  const benchPenaltyRatio = computePenaltyRatio(events, benchGb);
  const globalPenaltyRatio = computeGlobalPenaltyRatio(events);

  // GB actif
  const elActiveName = document.getElementById('gb-active-name');
  const elActivePercent = document.getElementById('gb-active-percent');
  const elActiveRatio = document.getElementById('gb-active-ratio');
  if (state.current_match) {
    elActiveName.textContent = state.current_match.gardiens[activeGb].name || 'GB Actif';
  }
  elActivePercent.textContent = activePercent === null ? '0%' : activePercent + '%';
  elActivePercent.style.color = getPercentColor(activePercent, settings);
  elActiveRatio.textContent = formatRatio(activeRatio, activePenaltyRatio);
  elActiveRatio.style.color = getPercentColor(activePercent, settings);


  // GB banc
  const elBenchName = document.getElementById('gb-bench-name');
  const elBenchPercent = document.getElementById('gb-bench-percent');
  const elBenchRatio = document.getElementById('gb-bench-ratio');
  if (state.current_match) {
    elBenchName.textContent = state.current_match.gardiens[benchGb].name || 'GB Banc';
  }
  elBenchPercent.textContent = benchPercent === null ? '0%' : benchPercent + '%';
  elBenchPercent.style.color = getPercentColor(benchPercent, settings);
  elBenchRatio.textContent = formatRatio(benchRatio, benchPenaltyRatio);
  elBenchRatio.style.color = getPercentColor(benchPercent, settings);


  // Global
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

  // Affiche le nom du gardien actif à côté de "Série en cours"
  const gbName = state.current_match ? (state.current_match.gardiens[ui.activeGb].name || 'GB') : 'GB';
  // Si un penalty est actif, on affiche "PENALTY - GB??" et on masque les autres infos
  elTitle.textContent = ui.penaltyActive ? 'PENALTY - ' + gbName : 'Série en cours — ' + gbName;
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
    document.getElementById('inp-opponent').value = state.current_match.opponent;
    document.getElementById('inp-g1-name').value = state.current_match.gardiens.G1.name;
    document.getElementById('inp-g1-num').value = state.current_match.gardiens.G1.number;
    document.getElementById('inp-g2-name').value = state.current_match.gardiens.G2.name;
    document.getElementById('inp-g2-num').value = state.current_match.gardiens.G2.number;
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
    } else {
      ui.gbBeforePenalty = null;
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
    const opponent = document.getElementById('inp-opponent').value.trim();
    const g1Name = document.getElementById('inp-g1-name').value.trim();
    const g1Num = document.getElementById('inp-g1-num').value.trim();
    const g2Name = document.getElementById('inp-g2-name').value.trim();
    const g2Num = document.getElementById('inp-g2-num').value.trim();
    startNewMatch(opponent, g1Name, g1Num, g2Name, g2Num);
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
  document.getElementById('inp-streak-high').addEventListener('input', (e) => {
    state.settings.streak_high_threshold = clamp(parseInt(e.target.value, 10) || 1, 1, 10);
    // Régénère la déclinaison automatique des couleurs selon le nouveau nombre de paliers
    state.settings.streak_colors = generateStreakColors(state.settings.streak_high_threshold);
    saveState(); renderAll();
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
  renderAll();
}

/** Change le gardien actif (G1/G2). */
function switchGuardian(gbId) {
  if (ui.activeGb === gbId) return;
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


