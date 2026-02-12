import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Task Manager' },
  { to: '/habits', label: 'Habit Tracker' },
  { to: '/prayers', label: 'Prayer Tracker' },
  { to: '/budget', label: 'Budget & Finance' },
  { to: '/notes', label: 'Notes' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <Link to="/dashboard" className="text-lg font-semibold text-slate-800">
            Life Tracker
          </Link>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map(({ to, label }) => {
            const isActive =
              location.pathname === to ||
              location.pathname.startsWith(`${to}/`) ||
              (to === '/tasks' && location.pathname.startsWith('/tasks'));
            return (
              <Link
                key={to}
                to={to}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <p className="text-sm text-slate-600 truncate px-2" title={user?.email}>{user?.name}</p>
          <button
            onClick={handleLogout}
            className="mt-1 text-sm text-slate-500 hover:text-red-600 w-full text-left px-2"
          >
            Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
