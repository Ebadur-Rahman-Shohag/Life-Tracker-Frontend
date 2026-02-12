import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

export default function BudgetChart({ summary, type = 'pie' }) {
  if (!summary || !summary.byCategory || summary.byCategory.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
        <p className="mb-2">No spending data available</p>
        <p className="text-sm">Add some expenses to see visualizations</p>
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#ef4444', '#6366f1'];

  if (type === 'pie') {
    const pieData = summary.byCategory
      .filter(cat => cat.total > 0)
      .map(cat => ({
        name: cat.categoryName,
        value: cat.total,
        color: cat.categoryColor || COLORS[0],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (pieData.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
          No spending data to display
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Spending by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const barData = summary.byCategory
    .filter(cat => cat.total > 0)
    .map(cat => ({
      name: cat.categoryName.length > 10 ? cat.categoryName.substring(0, 10) + '...' : cat.categoryName,
      fullName: cat.categoryName,
      amount: cat.total,
      color: cat.categoryColor || COLORS[0],
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  if (barData.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
        No spending data to display
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Spending Categories</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={barData}>
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toFixed(2)}`} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} />
          <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
