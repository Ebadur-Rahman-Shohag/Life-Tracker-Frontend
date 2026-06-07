import { useState, useEffect, useCallback } from 'react';
import { dashboard as dashboardApi } from '../api/client';

function mapSummaryToState(data) {
  const { tasks, habits, prayers, budget, notes, references } = data;

  return {
    tasksData: {
      todayTasks: [],
      todayCompleted: tasks.todayCompleted,
      todayTotal: tasks.todayTotal,
      projectsCount: tasks.projectsCount,
      weekTasks: [],
    },
    habitsData: {
      habits: Array.from({ length: habits.activeCount }),
      todayStats: { percentage: habits.todayPercentage },
      streakStats: { currentStreak: habits.currentStreak },
      weekStats: habits.weekTrend,
    },
    prayersData: {
      todayStats: null,
      streakStats: { currentStreak: prayers.currentStreak },
      weekStats: prayers.weekTrend,
      todayPrayers: prayers.todayPrayers,
    },
    budgetData: {
      summary: {
        net: budget.net,
        totalIncome: budget.totalIncome,
        totalExpenses: budget.totalExpenses,
        byCategory: Array.from({ length: budget.categoriesOver80Count }, () => ({ percentage: 80 })),
      },
    },
    notesData: {
      stats: {
        totalActive: notes.totalActive,
        favorites: notes.favorites,
        archived: notes.archived,
        categories: Array.from({ length: notes.categoryCount }),
      },
    },
    referencesData: {
      stats: {
        total: references.total,
        favorites: references.favorites,
        withProjects: references.withProjects,
      },
    },
  };
}

const EMPTY_STATE = mapSummaryToState({
  tasks: { todayCompleted: 0, todayTotal: 0, projectsCount: 0 },
  habits: { activeCount: 0, todayPercentage: 0, currentStreak: 0, weekTrend: [] },
  prayers: { todayPrayers: {}, currentStreak: 0, weekTrend: [] },
  budget: { net: 0, totalIncome: 0, totalExpenses: 0, categoriesOver80Count: 0 },
  notes: { totalActive: 0, favorites: 0, archived: 0, categoryCount: 0 },
  references: { total: 0, favorites: 0, withProjects: 0 },
});

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasksData, setTasksData] = useState(EMPTY_STATE.tasksData);
  const [habitsData, setHabitsData] = useState(EMPTY_STATE.habitsData);
  const [prayersData, setPrayersData] = useState(EMPTY_STATE.prayersData);
  const [budgetData, setBudgetData] = useState(EMPTY_STATE.budgetData);
  const [notesData, setNotesData] = useState(EMPTY_STATE.notesData);
  const [referencesData, setReferencesData] = useState(EMPTY_STATE.referencesData);

  const applySummary = useCallback((data) => {
    const mapped = mapSummaryToState(data);
    setTasksData(mapped.tasksData);
    setHabitsData(mapped.habitsData);
    setPrayersData(mapped.prayersData);
    setBudgetData(mapped.budgetData);
    setNotesData(mapped.notesData);
    setReferencesData(mapped.referencesData);
  }, []);

  const fetchAllData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dashboardApi.getSummary();
      applySummary(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applySummary]);

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
    referencesData,
    refetch: fetchAllData,
  };
}
