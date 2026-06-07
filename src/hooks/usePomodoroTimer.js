import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
  loadSettings,
  saveSettings,
  loadTimerSnapshot,
  saveTimerSnapshot,
  getSecondsForPhase,
  getTodayIso,
  addCompletedPomodoro,
} from '../lib/promodoroSettings';

const BASE_TITLE = 'Life Tracker';
const Ph = { FOCUS: 'focus', SHORT: 'shortBreak', LONG: 'longBreak' };

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {
    /* ignore */
  }
}

function formatTitle(seconds, phase) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const label =
    phase === Ph.FOCUS ? 'Focus' : phase === Ph.SHORT ? 'Short break' : 'Long break';
  return `${m}:${s} · ${label} | ${BASE_TITLE}`;
}

/**
 * Persisted timer snapshot; `endsAt` is set only while `isRunning` for wall-clock restore.
 */
function buildSnapshot(partial) {
  const sec = Math.max(0, Math.round(Number(partial.secondsRemaining) || 0));
  const isRunning = partial.isRunning === true;
  return {
    phase: partial.phase,
    secondsRemaining: sec,
    focusesSinceLong: Math.max(0, Math.round(Number(partial.focusesSinceLong) || 0)),
    taskLabel: partial.taskLabel ?? '',
    isRunning,
    endsAt: isRunning ? Date.now() + sec * 1000 : null,
  };
}

function readInitial() {
  const settings = loadSettings();
  const snap = loadTimerSnapshot();
  if (snap && (snap.phase === Ph.FOCUS || snap.phase === Ph.SHORT || snap.phase === Ph.LONG)) {
    const cap = getSecondsForPhase(snap.phase, settings);
    let wasRunning = snap.isRunning === true;
    let rem;
    if (wasRunning && typeof snap.endsAt === 'number' && snap.endsAt > 0) {
      rem = Math.max(0, Math.round((snap.endsAt - Date.now()) / 1000));
    } else {
      rem = Math.min(cap, Math.max(0, Math.round(Number(snap.secondsRemaining) || cap)));
    }
    rem = Math.min(cap, rem);
    if (wasRunning && rem === 0) {
      wasRunning = false;
    }
    return {
      settings,
      phase: snap.phase,
      secondsRemaining: rem,
      focusesSinceLong: Math.max(0, Math.round(Number(snap.focusesSinceLong) || 0)),
      taskLabel: typeof snap.taskLabel === 'string' ? snap.taskLabel : '',
      isRunning: wasRunning,
    };
  }
  return {
    settings,
    phase: Ph.FOCUS,
    secondsRemaining: getSecondsForPhase(Ph.FOCUS, settings),
    focusesSinceLong: 0,
    taskLabel: '',
    isRunning: false,
  };
}

export function usePomodoroTimer() {
  const initData = useMemo(() => readInitial(), []);
  const [settings, setSettings] = useState(initData.settings);
  const [phase, setPhase] = useState(initData.phase);
  const [secondsRemaining, setSecondsRemaining] = useState(initData.secondsRemaining);
  const [focusesSinceLong, setFocusesSinceLong] = useState(initData.focusesSinceLong);
  const [taskLabel, setTaskLabel] = useState(initData.taskLabel);
  const [isRunning, setIsRunning] = useState(() => initData.isRunning);

  /** Deduplicate focus complete (e.g. React 18+ Strict dev double-calling the state updater). */
  const focusLogDedupeRef = useRef(false);

  const latestTimerRef = useRef({
    phase: initData.phase,
    secondsRemaining: initData.secondsRemaining,
    isRunning: initData.isRunning,
    focusesSinceLong: initData.focusesSinceLong,
    taskLabel: initData.taskLabel,
  });

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { phase, settings, focusesSinceLong, taskLabel };
  }, [phase, settings, focusesSinceLong, taskLabel]);

  useLayoutEffect(() => {
    latestTimerRef.current = {
      phase,
      secondsRemaining,
      isRunning,
      focusesSinceLong,
      taskLabel,
    };
  }, [phase, secondsRemaining, isRunning, focusesSinceLong, taskLabel]);

  const writeSnap = useCallback(
    (overrides) => {
      const isRun = overrides?.isRunning !== undefined ? overrides.isRunning : isRunning;
      const cur = {
        phase: overrides?.phase ?? phase,
        secondsRemaining: overrides?.secondsRemaining ?? secondsRemaining,
        focusesSinceLong: overrides?.focusesSinceLong ?? focusesSinceLong,
        taskLabel: overrides?.taskLabel ?? taskLabel,
        isRunning: isRun,
      };
      saveTimerSnapshot(buildSnapshot(cur));
    },
    [phase, secondsRemaining, focusesSinceLong, taskLabel, isRunning]
  );

  const transitionTo = useCallback(
    (nextPhase, { autoStart = true, nextFocuses } = {}) => {
      const s = stateRef.current.settings;
      const label = stateRef.current.taskLabel;
      const fCur = stateRef.current.focusesSinceLong;
      const sec = getSecondsForPhase(nextPhase, s);
      const fNext = nextFocuses !== undefined ? nextFocuses : fCur;
      setPhase(nextPhase);
      setSecondsRemaining(sec);
      if (nextFocuses !== undefined) setFocusesSinceLong(nextFocuses);
      if (nextPhase === Ph.FOCUS) {
        setIsRunning(false);
        saveTimerSnapshot(
          buildSnapshot({
            phase: nextPhase,
            secondsRemaining: sec,
            focusesSinceLong: fNext,
            taskLabel: label,
            isRunning: false,
          })
        );
      } else {
        setIsRunning(autoStart);
        saveTimerSnapshot(
          buildSnapshot({
            phase: nextPhase,
            secondsRemaining: sec,
            focusesSinceLong: fNext,
            taskLabel: label,
            isRunning: autoStart,
          })
        );
      }
    },
    []
  );

  const afterFocusEnd = useCallback(
    (didComplete) => {
      if (didComplete) {
        if (focusLogDedupeRef.current) {
          return;
        }
        focusLogDedupeRef.current = true;
        setTimeout(() => {
          focusLogDedupeRef.current = false;
        }, 500);
      }

      const s = stateRef.current.settings;
      const N = s.pomodorosBeforeLong;
      const f = stateRef.current.focusesSinceLong;
      const label = stateRef.current.taskLabel;

      if (didComplete) {
        const iso = getTodayIso();
        addCompletedPomodoro(iso, label);
        const nf = f + 1;
        playChime();
        if (nf % N === 0) {
          transitionTo(Ph.LONG, { autoStart: true, nextFocuses: 0 });
        } else {
          transitionTo(Ph.SHORT, { autoStart: true, nextFocuses: nf });
        }
        return;
      }
      // Skip: no log, same break choice as if this block ended here
      playChime();
      if ((f + 1) % N === 0) {
        transitionTo(Ph.LONG, { autoStart: true, nextFocuses: 0 });
      } else {
        transitionTo(Ph.SHORT, { autoStart: true, nextFocuses: f });
      }
    },
    [transitionTo]
  );

  const afterBreakEnd = useCallback(() => {
    playChime();
    transitionTo(Ph.FOCUS, { autoStart: false, nextFocuses: undefined });
  }, [transitionTo]);

  useEffect(() => {
    if (!isRunning) {
      document.title = BASE_TITLE;
      return;
    }
    document.title = formatTitle(secondsRemaining, phase);
  }, [isRunning, secondsRemaining, phase]);

  useEffect(() => {
    const syncFromWallClock = () => {
      const timer = latestTimerRef.current;
      if (!timer.isRunning) return;

      const snap = loadTimerSnapshot();
      if (!snap?.isRunning || typeof snap.endsAt !== 'number' || snap.endsAt <= 0) return;

      const cap = getSecondsForPhase(timer.phase, stateRef.current.settings);
      let rem = Math.max(0, Math.round((snap.endsAt - Date.now()) / 1000));
      rem = Math.min(cap, rem);
      setSecondsRemaining(rem);

      if (rem === 0) {
        const phaseAtEnd = timer.phase;
        setTimeout(() => {
          if (phaseAtEnd === Ph.FOCUS) {
            afterFocusEnd(true);
          } else if (phaseAtEnd === Ph.SHORT || phaseAtEnd === Ph.LONG) {
            afterBreakEnd();
          }
        }, 0);
      }
    };

    const onVis = () => {
      if (!document.hidden) syncFromWallClock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [afterFocusEnd, afterBreakEnd]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsRemaining((prev) => {
        // Stuck at 0: do not re-run phase end (avoids double log / double counter tick).
        if (prev <= 0) return 0;
        // Only the 1 -> 0 transition should complete a phase, not 0 on the next second.
        if (prev === 1) {
          // Capture phase in this render path so a second scheduled callback (e.g. Strict
          // Mode double state updater) does not read a ref already advanced to the next phase.
          const phaseAtEnd = stateRef.current.phase;
          setTimeout(() => {
            if (phaseAtEnd === Ph.FOCUS) {
              afterFocusEnd(true);
            } else if (phaseAtEnd === Ph.SHORT || phaseAtEnd === Ph.LONG) {
              afterBreakEnd();
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, afterFocusEnd, afterBreakEnd]);

  useEffect(() => {
    writeSnap();
  }, [isRunning, writeSnap, phase, secondsRemaining, focusesSinceLong, taskLabel]);

  useEffect(
    () => () => {
      const o = latestTimerRef.current;
      if (o) {
        saveTimerSnapshot(
          buildSnapshot({
            ...o,
            isRunning: o.isRunning,
          })
        );
      }
    },
    []
  );

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);

  const resetPhase = useCallback(() => {
    const s = stateRef.current.settings;
    setSecondsRemaining(getSecondsForPhase(phase, s));
    setIsRunning(false);
  }, [phase]);

  const skipPhase = useCallback(() => {
    setIsRunning(false);
    if (stateRef.current.phase === Ph.FOCUS) {
      afterFocusEnd(false);
    } else {
      const f = stateRef.current.focusesSinceLong;
      transitionTo(Ph.FOCUS, { autoStart: false, nextFocuses: f });
    }
  }, [afterFocusEnd, transitionTo]);

  const updateSettings = useCallback((next) => {
    const merged = { ...stateRef.current.settings, ...next };
    const c = saveSettings(merged);
    setSettings(c);
    setSecondsRemaining((prev) => {
      const p = stateRef.current.phase;
      const oldMax = getSecondsForPhase(p, stateRef.current.settings);
      const max = getSecondsForPhase(p, c);
      if (prev >= oldMax) return max;
      return Math.min(max, Math.max(0, prev));
    });
  }, []);

  /** When the user removes a row from "Today", keep the long-break block counter in sync. */
  const onFocusLogEntryRemoved = useCallback(() => {
    setFocusesSinceLong((f) => Math.max(0, f - 1));
  }, []);

  const goToMode = useCallback(
    (mode) => {
      setIsRunning(false);
      if (mode === 'focus') {
        const c = stateRef.current.settings;
        setPhase(Ph.FOCUS);
        setSecondsRemaining(getSecondsForPhase(Ph.FOCUS, c));
        writeSnap({
          phase: Ph.FOCUS,
          secondsRemaining: getSecondsForPhase(Ph.FOCUS, c),
          isRunning: false,
        });
      } else if (mode === 'short') {
        const c = stateRef.current.settings;
        setPhase(Ph.SHORT);
        setSecondsRemaining(getSecondsForPhase(Ph.SHORT, c));
        writeSnap({
          phase: Ph.SHORT,
          secondsRemaining: getSecondsForPhase(Ph.SHORT, c),
          isRunning: false,
        });
      } else {
        const c = stateRef.current.settings;
        setPhase(Ph.LONG);
        setSecondsRemaining(getSecondsForPhase(Ph.LONG, c));
        writeSnap({
          phase: Ph.LONG,
          secondsRemaining: getSecondsForPhase(Ph.LONG, c),
          isRunning: false,
        });
      }
    },
    [writeSnap]
  );

  return {
    settings,
    phase,
    secondsRemaining,
    totalSeconds: getSecondsForPhase(phase, settings),
    focusesSinceLong,
    taskLabel,
    isRunning,
    start,
    pause,
    resetPhase,
    skipPhase,
    updateSettings,
    setLabel: setTaskLabel,
    goToMode,
    onFocusLogEntryRemoved,
    Ph,
  };
}
