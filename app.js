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
      percent_low: 30, // < 30% Rouge
      percent_mid: 40  // 30-40% Orange, > 40% Vert
    },
    streak_high_threshold: 5 // Palier critique série de buts
  },
  current_match: null,
  history: []
};

// État UI non persisté (session)
let ui = {
  activeGb: 'G1',      // Gardien actif
  period: 'MT1',       // Période courante
  penaltyActive: false // Toggle penalty
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
      G1: { name: g1Name || 'G1', number: g1Num || '' },
      G2: { name: g2Name || 'G2', number: g2Num || '' }
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
    if (streak.count >= settings.streak_high_threshold) return settings.colors.streak_high;
    if (streak.count >= 3) return settings.colors.streak_mid;
    return settings.colors.streak_low;
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

  // Période
  mt1.className = ui.period === 'MT1'
    ? 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-slate-800 text-white/60';
  mt2.className = ui.period === 'MT2'
    ? 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-slate-800 text-white/60';

  // Gardien
  g1.className = ui.activeGb === 'G1'
    ? 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-slate-800 text-white/60';
  g2.className = ui.activeGb === 'G2'
    ? 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#4a266a] text-[#f2c200]'
    : 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-slate-800 text-white/60';

  // Libellés des boutons gardiens
  if (state.current_match) {
    g1.textContent = state.current_match.gardiens.G1.name || 'G1';
    g2.textContent = state.current_match.gardiens.G2.name || 'G2';
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

  // GB actif
  const elActiveName = document.getElementById('gb-active-name');
  const elActivePercent = document.getElementById('gb-active-percent');
  if (state.current_match) {
    elActiveName.textContent = state.current_match.gardiens[activeGb].name || 'GB Actif';
  }
  elActivePercent.textContent = activePercent === null ? '0%' : activePercent + '%';
  elActivePercent.style.color = getPercentColor(activePercent, settings);

  // GB banc
  const elBenchName = document.getElementById('gb-bench-name');
  const elBenchPercent = document.getElementById('gb-bench-percent');
  if (state.current_match) {
    elBenchName.textContent = state.current_match.gardiens[benchGb].name || 'GB Banc';
  }
  elBenchPercent.textContent = benchPercent === null ? '0%' : benchPercent + '%';
  elBenchPercent.style.color = getPercentColor(benchPercent, settings);

  // Global
  const elGlobalPercent = document.getElementById('gb-global-percent');
  elGlobalPercent.textContent = globalPercent === null ? '0%' : globalPercent + '%';
  elGlobalPercent.style.color = getPercentColor(globalPercent, settings);
}

/** Bloc série en cours (gardien actif uniquement). */
function renderStreak() {
  const events = state.current_match ? state.current_match.events : [];
  const settings = state.settings;
  const streak = computeStreak(events, ui.activeGb, ui.period);

  const elValue = document.getElementById('streak-value');
  const elLabel = document.getElementById('streak-label');
  const elBlock = document.getElementById('streak-block');

  elValue.textContent = String(streak.count);
  elLabel.textContent = streak.type === null ? '—' : (streak.type === 'BUT' ? 'Buts' : 'Arrêts');

  const color = getStreakColor(streak, settings);
  elValue.style.color = color;
  elLabel.style.color = color;

  // Alerte clignotante si série de buts au palier critique
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

/** Pré-remplit le formulaire de la modale avec les valeurs actuelles. */
function renderSettingsForm() {
  const s = state.settings;
  document.getElementById('inp-percent-low').value = s.thresholds.percent_low;
  document.getElementById('inp-percent-mid').value = s.thresholds.percent_mid;
  document.getElementById('val-percent-low').textContent = s.thresholds.percent_low;
  document.getElementById('val-percent-mid').textContent = s.thresholds.percent_mid;
  document.getElementById('inp-color-low').value = s.colors.streak_low;
  document.getElementById('inp-color-mid').value = s.colors.streak_mid;
  document.getElementById('inp-color-high').value = s.colors.streak_high;
  document.getElementById('inp-streak-high').value = s.streak_high_threshold;
  document.getElementById('val-streak-high').textContent = s.streak_high_threshold;

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
    renderPenalty();
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

  // Seuils visuels
  document.getElementById('inp-percent-low').addEventListener('input', (e) => {
    state.settings.thresholds.percent_low = parseInt(e.target.value, 10);
    document.getElementById('val-percent-low').textContent = e.target.value;
    saveState(); renderAll();
  });
  document.getElementById('inp-percent-mid').addEventListener('input', (e) => {
    state.settings.thresholds.percent_mid = parseInt(e.target.value, 10);
    document.getElementById('val-percent-mid').textContent = e.target.value;
    saveState(); renderAll();
  });
  document.getElementById('inp-streak-high').addEventListener('input', (e) => {
    state.settings.streak_high_threshold = parseInt(e.target.value, 10);
    document.getElementById('val-streak-high').textContent = e.target.value;
    saveState(); renderAll();
  });
  document.getElementById('inp-color-low').addEventListener('input', (e) => {
    state.settings.colors.streak_low = e.target.value;
    saveState(); renderAll();
  });
  document.getElementById('inp-color-mid').addEventListener('input', (e) => {
    state.settings.colors.streak_mid = e.target.value;
    saveState(); renderAll();
  });
  document.getElementById('inp-color-high').addEventListener('input', (e) => {
    state.settings.colors.streak_high = e.target.value;
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


