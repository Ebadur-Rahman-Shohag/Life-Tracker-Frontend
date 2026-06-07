import { useState, useEffect } from 'react';

export default function TaskPositionInput({ position, max, onCommit, disabled = false }) {
  const [value, setValue] = useState(String(position));

  useEffect(() => {
    setValue(String(position));
  }, [position]);

  function commit() {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= max && parsed !== position) {
      onCommit(parsed);
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
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
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
