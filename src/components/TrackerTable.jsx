import { toISODateString, formatDateFull } from '../lib/dateUtils';

/**
 * TrackerTable - Shared calendar table component for trackers
 * 
 * @param {Object} props
 * @param {Array} props.dates - Array of dates to display
 * @param {Array} props.dailyStats - Array of daily stats objects
 * @param {Date} props.today - Today's date for comparison
 * @param {Array} props.columns - Array of column items (habits or prayers)
 * @param {Function} props.getStatus - Function to get status for a column item: (dayStats, columnId) => boolean
 * @param {Function} props.onToggle - Function to handle toggle: (columnId, dateStr, currentStatus?) => void
 * @param {Object} props.progressThresholds - Progress thresholds for color coding: { emerald: number, amber: number }
 * @param {Function} props.renderColumnHeader - Function to render column header: (column, index) => ReactNode
 * @param {string} props.view - Current view ('week' | 'month')
 * @param {string} props.title - Table title
 */
export default function TrackerTable({
  dates,
  dailyStats,
  today,
  columns,
  getStatus,
  onToggle,
  progressThresholds,
  renderColumnHeader,
  view,
  title,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-2 text-slate-600 font-medium">Date</th>
            <th className="text-left py-2 px-2 text-slate-600 font-medium min-w-[100px]">Progress</th>
            {columns.map((column, index) => (
              <th key={column.id || column._id} className="py-2 px-2 text-center">
                {renderColumnHeader(column, index)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => {
            const dateStr = toISODateString(date);
            const dayStats = dailyStats.find((d) => toISODateString(d.date) === dateStr);
            const isFuture = date > today;
            const isToday = dateStr === toISODateString(today);
            const percent = dayStats?.percentage || 0;

            return (
              <tr
                key={dateStr}
                className={`border-b border-slate-100 transition-colors ${
                  isToday ? 'bg-emerald-50' : ''
                } ${isFuture ? 'opacity-50' : ''}`}
              >
                <td className="py-2 px-2 text-slate-700 whitespace-nowrap">
                  {formatDateFull(date)}
                  {isToday && (
                    <span className="ml-2 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= progressThresholds.emerald
                            ? 'bg-emerald-500'
                            : percent >= progressThresholds.amber
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-slate-600 text-xs w-8">{percent}%</span>
                  </div>
                </td>
                {columns.map((column) => {
                  const columnId = column.id || column._id;
                  const isCompleted = getStatus(dayStats, columnId);
                  return (
                    <td key={columnId} className="py-2 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isFuture) {
                            onToggle(columnId, dateStr, isCompleted);
                          }
                        }}
                        disabled={isFuture}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 hover:border-emerald-400'
                        } ${isFuture ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isCompleted && <span className="text-xs">✓</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
