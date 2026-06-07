import { toISODateString, getTodayDate } from './dateUtils';

export const STORAGE_SETTINGS = 'lt-promodoro-v1-settings';
export const STORAGE_TIMER = 'lt-promodoro-v1-timer';
export const STORAGE_LOG = 'lt-promodoro-v1-log';

export const DEFAULT_SETTINGS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodorosBeforeLong: 4,
};

const LIMITS = {
  work: [1, 60],
  short: [1, 30],
  long: [1, 45],
  pomos: [2, 8],
};

/**
 * On phase end: auto-starts the next break; returning to focus stays paused
 * (see usePomodoroTimer).
 */
export function clampSettings(raw) {
  return {
    workMinutes: Math.min(
      LIMITS.work[1],
      Math.max(LIMITS.work[0], Math.round(Number(raw.workMinutes) || DEFAULT_SETTINGS.workMinutes))
    ),
    shortBreakMinutes: Math.min(
      LIMITS.short[1],
      Math.max(LIMITS.short[0], Math.round(Number(raw.shortBreakMinutes) || DEFAULT_SETTINGS.shortBreakMinutes))
    ),
    longBreakMinutes: Math.min(
      LIMITS.long[1],
      Math.max(LIMITS.long[0], Math.round(Number(raw.longBreakMinutes) || DEFAULT_SETTINGS.longBreakMinutes))
    ),
    pomodorosBeforeLong: Math.min(
      LIMITS.pomos[1],
      Math.max(LIMITS.pomos[0], Math.round(Number(raw.pomodorosBeforeLong) || DEFAULT_SETTINGS.pomodorosBeforeLong))
    ),
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return clampSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  const c = clampSettings(s);
  try {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(c));
  } catch {
    /* ignore */
  }
  return c;
}

function readLog() {
  try {
    const raw = localStorage.getItem(STORAGE_LOG);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeLog(map) {
  try {
    localStorage.setItem(STORAGE_LOG, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getTodayIso() {
  return toISODateString(getTodayDate());
}

/**
 * @returns {{ entries: { at: string, label: string }[] }}
 */
export function getDayLog(isoDate) {
  const map = readLog();
  const day = map[isoDate];
  if (!day || !Array.isArray(day.entries)) return { entries: [] };
  return { entries: [...day.entries] };
}

export function addCompletedPomodoro(isoDate, label) {
  const map = readLog();
  const day = map[isoDate] || { entries: [] };
  if (!Array.isArray(day.entries)) day.entries = [];
  day.entries.push({ at: new Date().toISOString(), label: (label || '').trim() });
  map[isoDate] = day;
  writeLog(map);
  return getDayLog(isoDate);
}

export function removeLogEntry(isoDate, index) {
  const map = readLog();
  const day = map[isoDate];
  if (!day?.entries) return;
  day.entries = day.entries.filter((_, i) => i !== index);
  if (day.entries.length === 0) delete map[isoDate];
  else map[isoDate] = day;
  writeLog(map);
}

/**
 * @typedef {object} TimerSnapshot
 * @property {string} phase 'focus' | 'shortBreak' | 'longBreak'
 * @property {number} secondsRemaining
 * @property {number} focusesSinceLong
 * @property {string} [taskLabel]
 * @property {boolean} [isRunning]
 * @property {number | null} [endsAt] when isRunning, wall-clock end (ms); when paused, null/absent
 */

export function loadTimerSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_TIMER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTimerSnapshot(snapshot) {
  try {
    localStorage.setItem(STORAGE_TIMER, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function getSecondsForPhase(phase, settings) {
  const s = clampSettings(settings);
  if (phase === 'focus') return s.workMinutes * 60;
  if (phase === 'shortBreak') return s.shortBreakMinutes * 60;
  if (phase === 'longBreak') return s.longBreakMinutes * 60;
  return s.workMinutes * 60;
}
