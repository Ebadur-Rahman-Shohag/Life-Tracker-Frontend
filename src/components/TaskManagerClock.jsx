import { useState, useEffect, useRef } from 'react';

const CLOCK_12H_STORAGE_KEY = 'lifeTrackerTasksClock12h';
const CLOCK_CHIME_ENABLED_KEY = 'lifeTrackerTasksClockChimeEnabled';
const CLOCK_CHIME_MODE_KEY = 'lifeTrackerTasksClockChimeMode';
const CLOCK_CHIME_MINUTE_KEY = 'lifeTrackerTasksClockChimeMinute';
const CLOCK_CHIME_DAILY_KEY = 'lifeTrackerTasksClockChimeDaily';

function readClockHour12() {
  try {
    const v = localStorage.getItem(CLOCK_12H_STORAGE_KEY);
    if (v === 'false') return false;
  } catch {
    /* ignore */
  }
  return true;
}

function persistClockHour12(hour12) {
  try {
    localStorage.setItem(CLOCK_12H_STORAGE_KEY, hour12 ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function readChimeEnabled() {
  try {
    if (localStorage.getItem(CLOCK_CHIME_ENABLED_KEY) === 'false') return false;
  } catch {
    /* ignore */
  }
  return true;
}

function persistChimeEnabled(v) {
  try {
    localStorage.setItem(CLOCK_CHIME_ENABLED_KEY, v ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function readChimeMode() {
  try {
    const v = localStorage.getItem(CLOCK_CHIME_MODE_KEY);
    if (v === 'daily') return 'daily';
  } catch {
    /* ignore */
  }
  return 'eachHour';
}

function persistChimeMode(mode) {
  try {
    localStorage.setItem(CLOCK_CHIME_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function clampChimeMinute(n) {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return 0;
  return Math.min(59, Math.max(0, x));
}

function readChimeMinute() {
  try {
    return clampChimeMinute(localStorage.getItem(CLOCK_CHIME_MINUTE_KEY) ?? '0');
  } catch {
    return 0;
  }
}

function persistChimeMinute(n) {
  try {
    localStorage.setItem(CLOCK_CHIME_MINUTE_KEY, String(clampChimeMinute(n)));
  } catch {
    /* ignore */
  }
}

function readChimeDailyTime() {
  try {
    const v = localStorage.getItem(CLOCK_CHIME_DAILY_KEY);
    if (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(':').map(Number);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  } catch {
    /* ignore */
  }
  return '12:00';
}

function persistChimeDailyTime(hhmm) {
  try {
    if (typeof hhmm === 'string' && /^\d{1,2}:\d{2}$/.test(hhmm)) {
      const [h, m] = hhmm.split(':').map(Number);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        const s = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        localStorage.setItem(CLOCK_CHIME_DAILY_KEY, s);
      }
    }
  } catch {
    /* ignore */
  }
}

function formatDigitalTime(d, hour12) {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  });
}

function speakHourlyTime(d, hour12) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const timeStr = formatDigitalTime(d, hour12);
  const u = new SpeechSynthesisUtterance(`The time is ${timeStr}.`);
  if (typeof navigator !== 'undefined' && navigator.language) u.lang = navigator.language;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/** Isolated clock so the 1 Hz tick does not re-render the full Task Manager page. */
export default function TaskManagerClock() {
  const [now, setNow] = useState(() => new Date());
  const [clockHour12, setClockHour12] = useState(readClockHour12);
  const [chimeEnabled, setChimeEnabled] = useState(readChimeEnabled);
  const [chimeMode, setChimeMode] = useState(readChimeMode);
  const [chimeMinute, setChimeMinute] = useState(readChimeMinute);
  const [chimeDailyTime, setChimeDailyTime] = useState(readChimeDailyTime);
  const [clockSettingsOpen, setClockSettingsOpen] = useState(false);
  const clockMenuRef = useRef(null);
  const lastChimeKeyRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Date();
      if (chimeEnabled) {
        const s = next.getSeconds();
        if (s === 0) {
          if (chimeMode === 'eachHour') {
            if (next.getMinutes() === chimeMinute) {
              const key = `h-${next.getFullYear()}-${next.getMonth()}-${next.getDate()}-${next.getHours()}`;
              if (lastChimeKeyRef.current !== key) {
                lastChimeKeyRef.current = key;
                speakHourlyTime(next, clockHour12);
              }
            }
          } else {
            const parts = chimeDailyTime.split(':');
            const dh = parseInt(parts[0], 10);
            const dm = parseInt(parts[1], 10);
            if (!Number.isNaN(dh) && !Number.isNaN(dm) && next.getHours() === dh && next.getMinutes() === dm) {
              const key = `d-${next.getFullYear()}-${next.getMonth()}-${next.getDate()}`;
              if (lastChimeKeyRef.current !== key) {
                lastChimeKeyRef.current = key;
                speakHourlyTime(next, clockHour12);
              }
            }
          }
        }
      }
      setNow(next);
    }, 1000);
    return () => clearInterval(id);
  }, [clockHour12, chimeEnabled, chimeMode, chimeMinute, chimeDailyTime]);

  useEffect(() => {
    if (!clockSettingsOpen) return;
    function onPointerDown(e) {
      if (clockMenuRef.current && !clockMenuRef.current.contains(e.target)) {
        setClockSettingsOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setClockSettingsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [clockSettingsOpen]);

  return (
    <div className="relative" ref={clockMenuRef}>
      <div className="flex items-stretch rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <time
          dateTime={now.toISOString()}
          className="inline-flex items-center text-lg sm:text-xl font-mono font-semibold tabular-nums tracking-wide text-slate-800 pl-3 pr-2 sm:pl-4 sm:pr-3 py-2"
        >
          {formatDigitalTime(now, clockHour12)}
        </time>
        <button
          type="button"
          onClick={() => setClockSettingsOpen((o) => !o)}
          className="flex items-center justify-center border-l border-slate-200 px-2.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-colors"
          aria-label="Clock and voice settings"
          aria-expanded={clockSettingsOpen}
          aria-haspopup="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.65.87.3.17.64.25.99.18l1.3-.3c.54-.12 1.01.2 1.19.7l.9 1.8c.18.5.05 1.07-.4 1.4l-1.02.7c-.28.2-.45.5-.45.8v.9c0 .3.17.6.45.8l1.02.7c.45.3.58.9.4 1.4l-.9 1.8c-.18.5-.64.82-1.19.7l-1.3-.3a1.2 1.2 0 01-1.02.18c-.32-.1-.6-.3-.7-.6l-.3-1.2c-.1-.3-.3-.5-.5-.6-.3-.1-.6-.1-.9 0l-1.2.3c-.3.1-.6 0-.8-.2l-1-1.7c-.2-.2-.2-.5-.1-.8l.5-1.1c.1-.3 0-.6-.1-.8l-1-1.7c-.2-.2-.1-.5.1-.7l.9-1.5c.2-.2.4-.3.7-.2l1.2.2c.3.1.6 0 .9-.1.3-.2.4-.4.4-.7l.1-1.3z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      {clockSettingsOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <p className="px-3 pt-2 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Display</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={clockHour12}
            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
              clockHour12 ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => {
              setClockHour12(true);
              persistClockHour12(true);
            }}
          >
            12 hour
            {clockHour12 && <span className="text-emerald-600">✓</span>}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!clockHour12}
            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
              !clockHour12 ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => {
              setClockHour12(false);
              persistClockHour12(false);
            }}
          >
            24 hour
            {!clockHour12 && <span className="text-emerald-600">✓</span>}
          </button>

          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 pt-1 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Voice call</p>
          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={chimeEnabled}
              onChange={(e) => {
                const v = e.target.checked;
                setChimeEnabled(v);
                persistChimeEnabled(v);
              }}
            />
            Enable spoken time
          </label>
          <div className="px-3 py-1.5 text-xs text-slate-500">When to announce</div>
          <div className="flex gap-1 px-2 pb-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium ${
                chimeMode === 'eachHour'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => {
                setChimeMode('eachHour');
                persistChimeMode('eachHour');
              }}
            >
              Every hour
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium ${
                chimeMode === 'daily'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => {
                setChimeMode('daily');
                persistChimeMode('daily');
              }}
            >
              Once a day
            </button>
          </div>
          {chimeMode === 'eachHour' ? (
            <div className="px-3 pb-3">
              <label className="mb-1 block text-xs text-slate-600" htmlFor="chime-minute">
                At minute past each hour (0–59)
              </label>
              <input
                id="chime-minute"
                type="number"
                min={0}
                max={59}
                value={chimeMinute}
                onChange={(e) => {
                  const v = clampChimeMinute(e.target.value);
                  setChimeMinute(v);
                  persistChimeMinute(v);
                }}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              />
            </div>
          ) : (
            <div className="px-3 pb-3">
              <label className="mb-1 block text-xs text-slate-600" htmlFor="chime-daily">
                Local time
              </label>
              <input
                id="chime-daily"
                type="time"
                step={60}
                value={chimeDailyTime}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    setChimeDailyTime(v);
                    persistChimeDailyTime(v);
                  }
                }}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
