import { Link } from 'react-router-dom';

export default function SummaryCard({ title, value, subtitle, icon, color = 'emerald', link, children, onClick }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
  };

  const content = (
    <div className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow ${onClick || link ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
        {link && (
          <Link
            to={link}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View →
          </Link>
        )}
      </div>
      {value !== undefined && (
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${colorClasses[color] || colorClasses.emerald}`}>
          {value}
        </div>
      )}
      {subtitle && (
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return content;
}
