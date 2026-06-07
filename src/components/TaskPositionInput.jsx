import { useState, useEffect, useRef } from 'react';

export default function TaskPositionInput({ position, max, onCommit, disabled = false }) {
  const [value, setValue] = useState(String(position));
  const [pending, setPending] = useState(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setValue(String(position));
    }
  }, [position]);

  async function commit() {
    if (pending || disabled) return;
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= max && parsed !== position) {
      setPending(true);
      try {
        await Promise.resolve(onCommit(parsed));
      } finally {
        setPending(false);
      }
    } else {
      setValue(String(position));
    }
  }

  return (
    <input
      type="number"
      min={1}
      max={max}
      value={value}
      disabled={disabled || pending}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        void commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      title="Set position"
      className="w-10 shrink-0 rounded border border-slate-300 px-1 py-1 text-center text-sm text-slate-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
    />
  );
}
