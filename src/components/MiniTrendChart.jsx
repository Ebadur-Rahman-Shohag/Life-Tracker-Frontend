import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function MiniTrendChart({ data, type = 'bar', height = 100, color = '#059669' }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-slate-400">
        No data
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: '12px', padding: '4px 8px' }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: '12px', padding: '4px 8px' }} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
