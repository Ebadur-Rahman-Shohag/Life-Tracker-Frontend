import { useState, useEffect } from 'react';
import { activities as activitiesApi } from '../api/client';
import { ALL_CATEGORIES, CATEGORY_UNITS } from '../lib/categories';

const PRAYER_IDS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];

function getTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function LogActivity() {
  const [date, setDate] = useState(getTodayISO());
  const [category, setCategory] = useState('sleep');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isPrayer = PRAYER_IDS.includes(category);
  const defaultUnit = CATEGORY_UNITS[category] || '';

  useEffect(() => {
    setUnit(CATEGORY_UNITS[category] || '');
    if (isPrayer) setValue('1');
    else setValue('');
  }, [category, isPrayer]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        date: new Date(date).toISOString(),
        category,
        value: isPrayer ? Number(value) : (value === '' ? 0 : (Number(value) || value)),
        unit: unit || defaultUnit,
        notes: notes.trim(),
      };
      await activitiesApi.create(payload);
      setMessage('Saved.');
      if (!isPrayer) setValue('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Log activity</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
          >
            <optgroup label="Daily prayers">
              {ALL_CATEGORIES.filter((c) => PRAYER_IDS.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Life">
              {ALL_CATEGORIES.filter((c) => !PRAYER_IDS.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {isPrayer ? 'Prayed (1=yes, 0=no)' : 'Value'}
          </label>
          <input
            type={isPrayer ? 'number' : 'text'}
            min={isPrayer ? 0 : undefined}
            max={isPrayer ? 1 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            required
            placeholder={isPrayer ? '1' : 'e.g. 7 or 30'}
          />
        </div>
        {!isPrayer && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit (optional)</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
              placeholder={defaultUnit || 'min, hr, glasses…'}
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            placeholder="e.g. Groceries"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
