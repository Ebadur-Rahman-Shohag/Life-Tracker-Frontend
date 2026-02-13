import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { prayers as prayersApi } from '../api/client';
import PrayerChecklist from '../components/PrayerChecklist';
import SummaryCard from '../components/SummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { PRAYER_CATEGORIES } from '../lib/categories';
import { toISODateString } from '../lib/dateUtils';
import { TOTAL_DAILY_PRAYERS } from '../lib/trackerConstants';
import Loader from '../components/Loader';

// Lazy load chart component to reduce initial bundle
import { lazy, Suspense } from 'react';
const MiniTrendChart = lazy(() => import('../components/MiniTrendChart'));

function getDayStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDayEnd(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}

export default function Dashboard() {
  const {
    loading,
    error,
    tasksData,
    habitsData,
    prayersData,
    budgetData,
    notesData,
    refetch,
  } = useDashboardData();

  const today = getDayStart();
  const todayStr = toISODateString(today);
  const [todayPrayers, setTodayPrayers] = useState({});

  // Update today's prayers from dashboard data
  useEffect(() => {
    if (prayersData.todayPrayers) {
      setTodayPrayers(
        PRAYER_CATEGORIES.reduce((acc, { id }) => {
          acc[id] = !!prayersData.todayPrayers[id];
          return acc;
        }, {})
      );
    }
  }, [prayersData.todayPrayers]);

  async function handlePrayerToggle(category, prayed) {
    try {
      await prayersApi.toggle(category, todayStr);
      setTodayPrayers((prev) => ({ ...prev, [category]: prayed }));
      // Refresh dashboard data after toggle
      setTimeout(() => refetch(), 500);
    } catch (err) {
      console.error(err);
    }
  }

  // Calculate metrics
  const prayersCount = Object.values(todayPrayers).filter(Boolean).length;
  const prayersPercent = Math.round((prayersCount / TOTAL_DAILY_PRAYERS) * 100);

  const tasksPercent = tasksData.todayTotal > 0
    ? Math.round((tasksData.todayCompleted / tasksData.todayTotal) * 100)
    : 0;

  const habitsPercent = habitsData.todayStats?.percentage || 0;
  const habitsCount = habitsData.habits.length;

  const budgetNet = budgetData.summary?.net || 0;
  const budgetIncome = budgetData.summary?.totalIncome || 0;
  const budgetExpenses = budgetData.summary?.totalExpenses || 0;

  const notesTotal = notesData.stats?.totalActive || 0;
  const notesFavorites = notesData.stats?.favorites || 0;

  // Prepare trend data for charts
  const prayerTrendData = prayersData.weekStats
    .slice(-7)
    .map((stat) => {
      const date = new Date(stat.date);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: stat.percentage || 0,
      };
    });

  const habitTrendData = habitsData.weekStats
    .slice(-7)
    .map((stat) => {
      const date = new Date(stat.date);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: stat.percentage || 0,
      };
    });

  // Task trend data (simplified - could be enhanced with week data)
  const taskTrendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      value: i === 6 ? tasksPercent : 0, // Only show today's data for now
    };
  });

  if (loading) {
    return <Loader message="Loading dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <button
          onClick={refetch}
          className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          title="Refresh data"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <SummaryCard
          title="Prayers"
          value={`${prayersCount}/5`}
          subtitle={`${prayersPercent}% complete`}
          icon="🕌"
          color={prayersCount === 5 ? 'emerald' : prayersCount > 0 ? 'amber' : 'slate'}
          link="/prayers"
        >
          <div className="mt-2">
            {prayersData.streakStats?.currentStreak > 0 && (
              <span className="text-xs text-slate-600">
                🔥 {prayersData.streakStats.currentStreak} day streak
              </span>
            )}
          </div>
        </SummaryCard>

        <SummaryCard
          title="Habits"
          value={`${habitsPercent}%`}
          subtitle={`${habitsCount} active habits`}
          icon="✓"
          color={habitsPercent >= 75 ? 'emerald' : habitsPercent > 0 ? 'amber' : 'slate'}
          link="/habits"
        >
          <div className="mt-2">
            {habitsData.streakStats?.currentStreak > 0 && (
              <span className="text-xs text-slate-600">
                🔥 {habitsData.streakStats.currentStreak} day streak
              </span>
            )}
          </div>
        </SummaryCard>

        <SummaryCard
          title="Tasks"
          value={`${tasksData.todayCompleted}/${tasksData.todayTotal}`}
          subtitle={`${tasksPercent}% complete`}
          icon="📋"
          color={tasksPercent === 100 && tasksData.todayTotal > 0 ? 'emerald' : tasksPercent > 0 ? 'amber' : 'slate'}
          link="/tasks"
        >
          <div className="mt-2">
            {tasksData.projectsCount > 0 && (
              <span className="text-xs text-slate-600">
                {tasksData.projectsCount} project{tasksData.projectsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </SummaryCard>

        <SummaryCard
          title="Budget"
          value={formatCurrency(budgetNet)}
          subtitle={`${formatCurrency(budgetIncome)} income, ${formatCurrency(budgetExpenses)} expenses`}
          icon="💰"
          color={budgetNet >= 0 ? 'emerald' : 'red'}
          link="/budget"
        />

        <SummaryCard
          title="Notes"
          value={notesTotal}
          subtitle={`${notesFavorites} favorites`}
          icon="📝"
          color="blue"
          link="/notes"
        />
      </div>

      {/* Today's Prayer Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Prayers</h2>
          <Link
            to="/prayers"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View Prayer Tracker →
          </Link>
        </div>
        <PrayerChecklist
          prayers={todayPrayers}
          onToggle={handlePrayerToggle}
        />
      </div>

      {/* Trend Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Prayer Consistency</h3>
            <Link
              to="/prayers"
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              View →
            </Link>
          </div>
          <Suspense fallback={<div className="h-[120px] bg-slate-50 animate-pulse rounded" />}>
            <MiniTrendChart
              data={prayerTrendData}
              type="bar"
              height={120}
              color="#059669"
            />
          </Suspense>
          <div className="mt-2 text-xs text-slate-500 text-center">
            Last 7 days completion %
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Habit Progress</h3>
            <Link
              to="/habits"
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              View →
            </Link>
          </div>
          <Suspense fallback={<div className="h-[120px] bg-slate-50 animate-pulse rounded" />}>
            <MiniTrendChart
              data={habitTrendData}
              type="line"
              height={120}
              color="#3b82f6"
            />
          </Suspense>
          <div className="mt-2 text-xs text-slate-500 text-center">
            Last 7 days completion %
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Task Completion</h3>
            <Link
              to="/tasks"
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              View →
            </Link>
          </div>
          <Suspense fallback={<div className="h-[120px] bg-slate-50 animate-pulse rounded" />}>
            <MiniTrendChart
              data={taskTrendData}
              type="bar"
              height={120}
              color="#f59e0b"
            />
          </Suspense>
          <div className="mt-2 text-xs text-slate-500 text-center">
            Today&apos;s completion
          </div>
        </div>
      </div>

      {/* Detailed Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks Module Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h3 className="text-lg font-semibold text-slate-800">Task Manager</h3>
            </div>
            <Link
              to="/tasks"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Today&apos;s Progress</span>
                <span className="font-medium text-slate-800">{tasksPercent}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tasksPercent === 100 ? 'bg-emerald-500' : tasksPercent > 0 ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  style={{ width: `${tasksPercent}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Completed Tasks</span>
              <span className="font-medium text-emerald-600">{tasksData.todayCompleted}/{tasksData.todayTotal}</span>
            </div>
            {tasksData.projectsCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Active Projects</span>
                <span className="font-medium text-slate-800">{tasksData.projectsCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Budget Module Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <h3 className="text-lg font-semibold text-slate-800">Budget & Finance</h3>
            </div>
            <Link
              to="/budget"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: budgetNet >= 0 ? '#059669' : '#ef4444' }}>
                {formatCurrency(budgetNet)}
              </div>
              <div className="text-xs text-slate-500">Net Balance (This Month)</div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <div className="text-sm text-slate-600">Income</div>
                <div className="text-lg font-semibold text-emerald-600">{formatCurrency(budgetIncome)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">Expenses</div>
                <div className="text-lg font-semibold text-red-600">{formatCurrency(budgetExpenses)}</div>
              </div>
            </div>
            {budgetData.summary?.byCategory?.some(cat => cat.percentage >= 80) && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-amber-600 font-medium">
                  ⚠️ {budgetData.summary.byCategory.filter(cat => cat.percentage >= 80).length} category(ies) over 80% budget
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Habits Module Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">✓</span>
              <h3 className="text-lg font-semibold text-slate-800">Habit Tracker</h3>
            </div>
            <Link
              to="/habits"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Today&apos;s Completion</span>
                <span className="font-medium text-slate-800">{habitsPercent}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${habitsPercent >= 75 ? 'bg-emerald-500' : habitsPercent > 0 ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  style={{ width: `${habitsPercent}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Active Habits</span>
              <span className="font-medium text-slate-800">{habitsCount}</span>
            </div>
            {habitsData.streakStats && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Current Streak</span>
                <span className="font-medium text-emerald-600">
                  🔥 {habitsData.streakStats.currentStreak || 0} days
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes Module Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📝</span>
              <h3 className="text-lg font-semibold text-slate-800">Notes</h3>
            </div>
            <Link
              to="/notes"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-slate-800 mb-1">{notesTotal}</div>
              <div className="text-xs text-slate-500">Total Active Notes</div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <div className="text-sm text-slate-600">Favorites</div>
                <div className="text-lg font-semibold text-amber-600">{notesFavorites}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">Archived</div>
                <div className="text-lg font-semibold text-slate-600">{notesData.stats?.archived || 0}</div>
              </div>
            </div>
            {notesData.stats?.categories && notesData.stats.categories.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  {notesData.stats.categories.length} categor{notesData.stats.categories.length !== 1 ? 'ies' : 'y'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
