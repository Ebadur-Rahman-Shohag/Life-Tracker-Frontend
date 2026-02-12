import { PRAYER_CATEGORIES } from '../lib/categories';

/**
 * PrayerChecklist - Displays the 5 daily prayers with toggle buttons.
 * Accepts either:
 * - prayers: { fajr: bool, zuhr: bool, asr: bool, maghrib: bool, isha: bool } (from prayers API)
 * - activities: legacy format from activities API (for backward compatibility)
 *
 * embedded: when true, renders without outer card/title (for use inside PrayerTracker)
 */
export default function PrayerChecklist({ prayers, activities = [], onToggle, disabled = false, embedded = false }) {
  const byPrayer =
    prayers !== undefined
      ? prayers
      : Object.fromEntries(
          (activities || [])
            .filter((a) => ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].includes(a.category))
            .map((a) => [a.category, Number(a.value) === 1])
        );

  const prayedCount = PRAYER_CATEGORIES.filter((c) => byPrayer[c.id]).length;

  const content = (
    <>
      {!embedded && <h2 className="text-lg font-semibold text-slate-800 mb-3">Today&apos;s prayers</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {PRAYER_CATEGORIES.map(({ id, label }) => {
          const prayed = !!byPrayer[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => !disabled && onToggle?.(id, !prayed)}
              disabled={disabled}
              className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                prayed
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="block truncate">{label.split(' ')[0]}</span>
              <span className="text-xs opacity-80">{prayed ? '✓ Prayed' : '—'}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 mt-2">{prayedCount}/5 prayed</p>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      {content}
    </div>
  );
}
