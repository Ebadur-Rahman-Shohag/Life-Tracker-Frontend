import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { activities as activitiesApi } from '../api/client';
import { PRAYER_CATEGORIES } from '../lib/categories';

const PRAYER_IDS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];

function getDayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDayEnd(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function Reports() {
  const [range, setRange] = useState('week');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => getDayStart(new Date()), []);
  const { from, to, days } = useMemo(() => {
    if (range === 'day') {
      return { from: today, to: getDayEnd(today), days: 1 };
    }
    if (range === 'month') {
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 29);
      return { from: fromDate, to: getDayEnd(today), days: 30 };
    }
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 6);
    return { from: fromDate, to: getDayEnd(today), days: 7 };
  }, [range, today]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    activitiesApi
      .list({ from: from.toISOString(), to: to.toISOString() })
      .then(({ data }) => {
        if (!cancelled) setActivities(data);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [range, from, to]);

  const prayerByDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = getDayStart(d);
    const dayEnd = getDayEnd(d);
    const dayActivities = activities.filter(
      (a) => PRAYER_IDS.includes(a.category) && new Date(a.date) >= dayStart && new Date(a.date) <= dayEnd
    );
    const prayed = dayActivities.filter((a) => Number(a.value) === 1).length;
    prayerByDay.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      prayers: prayed,
      full: d.toISOString().slice(0, 10),
    });
  }

  const sleepByDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = getDayStart(d);
    const dayEnd = getDayEnd(d);
    const dayActivities = activities.filter(
      (a) => a.category === 'sleep' && new Date(a.date) >= dayStart && new Date(a.date) <= dayEnd
    );
    const sleep = dayActivities[0] ? Number(dayActivities[0].value) : null;
    sleepByDay.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sleep: sleep ?? 0,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reports</h1>

      <div className="flex gap-2">
        {['day', 'week', 'month'].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-lg font-medium capitalize ${
              range === r ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Prayers (per day)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prayerByDay}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="prayers" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Sleep (hours)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepByDay}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="sleep" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {range === 'day' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Daily breakdown</h2>
          <ul className="space-y-2 text-sm">
            {PRAYER_CATEGORIES.map(({ id, label }) => {
              const a = activities.find((x) => x.category === id && new Date(x.date).toDateString() === today.toDateString());
              const prayed = a && Number(a.value) === 1;
              return (
                <li key={id} className="flex justify-between text-slate-700">
                  <span>{label}</span>
                  <span className={prayed ? 'text-emerald-600 font-medium' : 'text-slate-400'}>{prayed ? 'Prayed' : '—'}</span>
                </li>
              );
            })}
            {activities.filter((a) => !PRAYER_IDS.includes(a.category)).map((a) => (
              <li key={a._id} className="flex justify-between text-slate-700">
                <span className="capitalize">{a.category}</span>
                <span>{typeof a.value === 'number' ? `${a.value} ${a.unit || ''}`.trim() : a.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
