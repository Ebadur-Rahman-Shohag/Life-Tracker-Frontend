import { useState, useEffect, useCallback } from 'react';
import { tasks as tasksApi, projects as projectsApi, habits as habitsApi, prayers as prayersApi, budget as budgetApi, notes as notesApi } from '../api/client';
import { toISODateString, getTodayDate } from '../lib/dateUtils';

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

function getWeekStart() {
  const today = getDayStart();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  // Get Monday of current week (0 = Sunday, so we adjust)
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(today.getDate() + diff);
  return weekStart;
}

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tasks data
  const [tasksData, setTasksData] = useState({
    todayTasks: [],
    todayCompleted: 0,
    todayTotal: 0,
    projectsCount: 0,
    weekTasks: [],
  });

  // Habits data
  const [habitsData, setHabitsData] = useState({
    habits: [],
    todayStats: null,
    streakStats: null,
    weekStats: [],
  });

  // Prayers data
  const [prayersData, setPrayersData] = useState({
    todayStats: null,
    streakStats: null,
    weekStats: [],
    todayPrayers: {},
  });

  // Budget data
  const [budgetData, setBudgetData] = useState({
    summary: null,
  });

  // Notes data
  const [notesData, setNotesData] = useState({
    stats: null,
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = getDayStart();
      const todayStr = toISODateString(today);
      const weekStart = getWeekStart();
      const weekEnd = getDayEnd();
      
      // Calculate date range for this month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Fetch all data in parallel
      const [
        tasksRes,
        projectsRes,
        habitsListRes,
        habitsDailyRes,
        habitsStreakRes,
        prayersDailyRes,
        prayersStreakRes,
        budgetSummaryRes,
        notesStatsRes,
      ] = await Promise.allSettled([
        tasksApi.list({ date: todayStr }),
        projectsApi.list({ includeArchived: false, parentId: 'null' }),
        habitsApi.list({ activeOnly: 'true' }),
        habitsApi.getDailyStats(toISODateString(weekStart), toISODateString(weekEnd)),
        habitsApi.getStreakStats(),
        prayersApi.getDailyStats(toISODateString(weekStart), toISODateString(weekEnd)),
        prayersApi.getStreakStats(),
        budgetApi.getSummary({
          period: 'month',
          from: toISODateString(monthStart),
          to: toISODateString(monthEnd),
        }),
        notesApi.stats(),
      ]);

      // Process tasks data
      if (tasksRes.status === 'fulfilled') {
        const todayTasks = tasksRes.value.data || [];
        const completed = todayTasks.filter(t => t.completed).length;
        setTasksData({
          todayTasks,
          todayCompleted: completed,
          todayTotal: todayTasks.length,
          projectsCount: projectsRes.status === 'fulfilled' ? (projectsRes.value.data || []).length : 0,
          weekTasks: [], // Could fetch week tasks if needed
        });
      }

      // Process habits data
      if (habitsListRes.status === 'fulfilled') {
        const habits = habitsListRes.value.data || [];
        // Habits daily stats returns { days: [...], habits: [...] }
        const habitsDailyData = habitsDailyRes.status === 'fulfilled' ? habitsDailyRes.value.data : null;
        const habitsDaysArray = habitsDailyData?.days || [];
        const todayDayStats = habitsDaysArray.find(d => toISODateString(d.date) === todayStr) || null;
        
        setHabitsData({
          habits,
          todayStats: todayDayStats,
          streakStats: habitsStreakRes.status === 'fulfilled' ? habitsStreakRes.value.data : null,
          weekStats: habitsDaysArray,
        });
      }

      // Process prayers data
      if (prayersDailyRes.status === 'fulfilled') {
        // Prayers daily stats returns { days: [...] }
        const prayersDailyData = prayersDailyRes.value.data || {};
        const weekStats = prayersDailyData.days || [];
        const todayDayStats = weekStats.find(d => toISODateString(d.date) === todayStr) || null;
        const todayPrayers = todayDayStats?.prayerStatuses || {};
        
        setPrayersData({
          todayStats: todayDayStats,
          streakStats: prayersStreakRes.status === 'fulfilled' ? prayersStreakRes.value.data : null,
          weekStats,
          todayPrayers,
        });
      }

      // Process budget data
      if (budgetSummaryRes.status === 'fulfilled') {
        setBudgetData({
          summary: budgetSummaryRes.value.data,
        });
      }

      // Process notes data
      if (notesStatsRes.status === 'fulfilled') {
        setNotesData({
          stats: notesStatsRes.value.data,
        });
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    loading,
    error,
    tasksData,
    habitsData,
    prayersData,
    budgetData,
    notesData,
    refetch: fetchAllData,
  };
}
