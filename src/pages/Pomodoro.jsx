import { useState, useMemo } from 'react';
import { usePomodoroTimer } from '../hooks/usePomodoroTimer';
import { getDayLog, getTodayIso, removeLogEntry } from '../lib/promodoroSettings';

const btnPrimary = 'bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50';
const btnSecondary = 'bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50';
const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none';
const tabBase = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';
const tabOff = 'text-slate-600 hover:bg-slate-100';
const tabOn = 'bg-emerald-50 text-emerald-800';

function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const PHASE_INFO = {
  focus: { label: 'Focus', ring: 'text-emerald-500', sub: 'text-emerald-700' },
  shortBreak: { label: 'Short break', ring: 'text-sky-400', sub: 'text-sky-800' },
  longBreak: { label: 'Long break', ring: 'text-violet-500', sub: 'text-violet-800' },
};

function RingTimer({ total, remaining, kind }) {
  const radius = 120;
  const stroke = 8;
  const norm = radius - stroke / 2;
  const c = 2 * Math.PI * norm;
  const p = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const offset = c - (p / 100) * c;
  const info = PHASE_INFO[kind] || PHASE_INFO.focus;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={radius * 2} height={radius * 2} className="transform -rotate-90" aria-hidden>
        <circle
          stroke="currentColor"
          className="text-slate-200"
          fill="transparent"
          strokeWidth={stroke}
          r={norm}
          cx={radius}
          cy={radius}
        />
        <circle
          className={info.ring}
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={norm}
          cx={radius}
          cy={radius}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-bold tabular-nums text-slate-800 tracking-tight">
          {formatClock(remaining)}
        </span>
        <span className={`mt-1 text-sm font-medium ${info.sub}`}>{info.label}</span>
        {total > 0 && (
          <span className="text-xs text-slate-500 mt-1 tabular-nums">of {formatClock(total)}</span>
        )}
      </div>
    </div>
  );
}

function SettingsForm({ values, onClose, onSave, limitsText }) {
  const [w, setW] = useState(String(values.workMinutes));
  const [s, setS] = useState(String(values.shortBreakMinutes));
  const [l, setL] = useState(String(values.longBreakMinutes));
  const [n, setN] = useState(String(values.pomodorosBeforeLong));

  return (
    <>
      <h2 id="pomodoro-settings-title" className="text-lg font-semibold text-slate-800 mb-4">
        Timer settings
      </h2>
      <p className="text-xs text-slate-500 mb-4">{limitsText}</p>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-slate-600 block mb-1">Focus (minutes)</label>
          <input type="number" className={inputClass} value={w} onChange={(e) => setW(e.target.value)} min={1} max={60} />
        </div>
        <div>
          <label className="text-sm text-slate-600 block mb-1">Short break (minutes)</label>
          <input type="number" className={inputClass} value={s} onChange={(e) => setS(e.target.value)} min={1} max={30} />
        </div>
        <div>
          <label className="text-sm text-slate-600 block mb-1">Long break (minutes)</label>
          <input type="number" className={inputClass} value={l} onChange={(e) => setL(e.target.value)} min={1} max={45} />
        </div>
        <div>
          <label className="text-sm text-slate-600 block mb-1">Pomodoros before long break</label>
          <input type="number" className={inputClass} value={n} onChange={(e) => setN(e.target.value)} min={2} max={8} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            onSave({
              workMinutes: Number(w),
              shortBreakMinutes: Number(s),
              longBreakMinutes: Number(l),
              pomodorosBeforeLong: Number(n),
            });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </>
  );
}

function SettingsModal({ open, onClose, values, onSave, limitsText }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pomodoro-settings-title"
      >
        <SettingsForm
          key={JSON.stringify(values)}
          values={values}
          onClose={onClose}
          onSave={onSave}
          limitsText={limitsText}
        />
      </div>
    </div>
  );
}

function formatEntryTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function Pomodoro() {
  const {
    settings,
    phase,
    secondsRemaining,
    totalSeconds,
    focusesSinceLong,
    taskLabel,
    isRunning,
    start,
    pause,
    resetPhase,
    skipPhase,
    updateSettings,
    setLabel,
    goToMode,
    onFocusLogEntryRemoved,
    Ph,
  } = usePomodoroTimer();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listRev, setListRev] = useState(0);
  const todayLog = getDayLog(getTodayIso());

  const phaseKind =
    phase === Ph.FOCUS ? 'focus' : phase === Ph.SHORT ? 'shortBreak' : 'longBreak';

  const blockHint = useMemo(() => {
    const n = settings.pomodorosBeforeLong;
    const f = focusesSinceLong % n;
    const until = n - f;
    if (until === 1) {
      return 'The next break after you finish this focus is a long break.';
    }
    return `Long break after you complete ${until} more focus block${until === 1 ? '' : 's'}.`;
  }, [settings.pomodorosBeforeLong, focusesSinceLong]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pomodoro</h1>
        <button
          type="button"
          className={btnSecondary + ' text-sm self-start'}
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </button>
      </div>

      <p className="text-sm text-slate-600 mb-4">
        When a break ends, the next focus only starts when you press Start. Breaks start automatically
        when a focus or break phase completes. Switching the tab pauses the timer.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <button
            type="button"
            className={`${tabBase} ${phaseKind === 'focus' ? tabOn : tabOff}`}
            onClick={() => goToMode('focus')}
            disabled={isRunning}
          >
            Focus
          </button>
          <button
            type="button"
            className={`${tabBase} ${phaseKind === 'shortBreak' ? tabOn : tabOff}`}
            onClick={() => goToMode('short')}
            disabled={isRunning}
          >
            Short
          </button>
          <button
            type="button"
            className={`${tabBase} ${phaseKind === 'longBreak' ? tabOn : tabOff}`}
            onClick={() => goToMode('long')}
            disabled={isRunning}
          >
            Long
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <RingTimer total={totalSeconds} remaining={secondsRemaining} kind={phaseKind} />
        </div>

        <p className="text-center text-xs text-slate-500 mb-4 max-w-sm mx-auto">{blockHint}</p>

        <div className="max-w-md mx-auto mb-6">
          <label className="text-sm text-slate-600 block mb-1">What are you working on? (optional)</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Task name for this run…"
            value={taskLabel}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isRunning ? (
            <button type="button" className={btnPrimary} onClick={pause}>
              Pause
            </button>
          ) : (
            <button type="button" className={btnPrimary} onClick={start}>
              Start
            </button>
          )}
          <button type="button" className={btnSecondary} onClick={resetPhase} disabled={isRunning && secondsRemaining === totalSeconds}>
            Reset phase
          </button>
          <button type="button" className={btnSecondary} onClick={skipPhase}>
            Skip
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Today</h2>
        <p className="text-sm text-slate-500 mb-3">
          Completed focus blocks: {todayLog.entries.length} · {settings.workMinutes} min each by default
        </p>
        {todayLog.entries.length === 0 ? (
          <p className="text-center text-slate-500 py-6">No completed sessions today yet.</p>
        ) : (
          <ul key={`day-log-${listRev}`} className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {todayLog.entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-2 flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="text-slate-500 tabular-nums">{formatEntryTime(e.at)}</span>
                  {e.label && <span className="text-slate-800 ml-2">{e.label}</span>}
                  {!e.label && <span className="text-slate-400 ml-2">(no label)</span>}
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-600 shrink-0"
                    onClick={() => {
                    removeLogEntry(getTodayIso(), i);
                    onFocusLogEntryRemoved();
                    setListRev((v) => v + 1);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        values={settings}
        limitsText="Focus 1–60 min · Short 1–30 · Long 1–45 · Block size 2–8 pomodoros"
        onSave={(v) => updateSettings(v)}
      />
    </div>
  );
}
