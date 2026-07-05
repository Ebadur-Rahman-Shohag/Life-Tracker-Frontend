import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { budget as budgetApi } from '../api/client';
import { toISODateString, getTodayDate } from '../lib/dateUtils';
import Loader from '../components/Loader';
import TransactionForm from '../components/TransactionForm';
import CategoryCard from '../components/CategoryCard';
import CategoryForm from '../components/CategoryForm';
import TransactionList from '../components/TransactionList';
import ConfirmModal from '../components/ConfirmModal';

// Lazy load chart component
const BudgetChart = lazy(() => import('../components/BudgetChart'));

export default function BudgetTracker() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('month');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionType, setTransactionType] = useState('expense');
  const [preselectedCategoryId, setPreselectedCategoryId] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormType, setCategoryFormType] = useState('expense');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [chartType, setChartType] = useState('pie');
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const readyRef = useRef(false);
  const [chartReady, setChartReady] = useState(false);

  // Get date range based on period
  const getDateRange = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate, endDate;

    switch (period) {
      case 'week':
        const dayOfWeek = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }, [period]);

  // Load categories (server seeds defaults when none exist)
  const loadCategories = useCallback(async () => {
    try {
      const response = await budgetApi.getCategories({ activeOnly: 'true' });
      setCategories(response.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, []);

  // Load summary
  const loadSummary = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const response = await budgetApi.getSummary({
        period: period === 'custom' ? 'custom' : period,
        from: toISODateString(startDate),
        to: toISODateString(endDate),
      });
      setSummary(response.data);
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }, [period, getDateRange]);

  // Load recent transactions for quick-add (non-blocking)
  const loadRecentTransactions = useCallback(async () => {
    try {
      const response = await budgetApi.getTransactions({ limit: 10 });
      setTransactions(response.data);
    } catch (err) {
      console.error('Error loading recent transactions:', err);
    }
  }, []);

  // Load full transaction list for the selected period
  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const response = await budgetApi.getTransactions({
        from: toISODateString(startDate),
        to: toISODateString(endDate),
        limit: 100,
      });
      setTransactions(response.data);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [getDateRange]);

  const refreshTransactionData = useCallback(async () => {
    if (showTransactions) {
      await loadTransactions();
    } else {
      await loadRecentTransactions();
    }
  }, [showTransactions, loadTransactions, loadRecentTransactions]);

  useEffect(() => {
    if (loading) {
      setChartReady(false);
      return undefined;
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setChartReady(true));
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setChartReady(true), 0);
    return () => clearTimeout(t);
  }, [loading]);

  // Initial load: categories + summary in parallel (don't block on transactions)
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await Promise.all([loadCategories(), loadSummary()]);
      setLoading(false);
      readyRef.current = true;
      loadRecentTransactions();
    };
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload summary when period changes
  useEffect(() => {
    if (!readyRef.current) return;
    loadSummary();
  }, [period, loadSummary]);

  // Load full transactions only when the list is expanded
  useEffect(() => {
    if (!readyRef.current || !showTransactions) return;
    loadTransactions();
  }, [period, showTransactions, loadTransactions]);

  const handleTransactionSubmit = async (data) => {
    try {
      if (editingTransaction) {
        await budgetApi.updateTransaction(editingTransaction._id, data);
      } else {
        await budgetApi.createTransaction(data);
      }
      setShowTransactionForm(false);
      setEditingTransaction(null);
      await Promise.all([loadSummary(), refreshTransactionData()]);
    } catch (err) {
      console.error('Error saving transaction:', err);
      setError('Error saving transaction. Please try again.');
    }
  };

  const handleDeleteTransaction = (id) => {
    const transaction = transactions.find((t) => t._id === id);
    setConfirmModal({
      open: true,
      title: 'Delete Transaction',
      message: `Are you sure you want to delete this transaction? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await budgetApi.deleteTransaction(id);
          await Promise.all([loadSummary(), refreshTransactionData()]);
          setConfirmModal(null);
        } catch (err) {
          console.error('Error deleting transaction:', err);
          setError('Error deleting transaction. Please try again.');
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setShowTransactionForm(true);
  };

  const handleCategorySubmit = async (categoryData) => {
    try {
      let response;
      if (editingCategory) {
        response = await budgetApi.updateCategory(editingCategory._id, categoryData);
      } else {
        response = await budgetApi.createCategory(categoryData);
      }
      setShowCategoryForm(false);
      setEditingCategory(null);
      await loadCategories();
      return response.data;
    } catch (err) {
      console.error('Error saving category:', err);
      const errorMessage = err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Error saving category. Please try again.';
      setError(errorMessage);
      throw err;
    }
  };

  const handleDeleteCategory = (id) => {
    const category = categories.find((c) => c._id === id);
    setConfirmModal({
      open: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category?.name || 'this category'}"? This will not delete transactions, but you won't be able to use this category for new transactions.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await budgetApi.deleteCategory(id);
          await loadCategories();
          setConfirmModal(null);
        } catch (err) {
          console.error('Error deleting category:', err);
          setError('Error deleting category. Please try again.');
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (transactions.length === 0) {
      setError('No transactions to export');
      return;
    }
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = transactions.map(t => {
      const category = categories.find(c => c._id === (t.categoryId?._id || t.categoryId));
      return [
        new Date(t.date).toLocaleDateString(),
        t.type,
        category?.name || 'Unknown',
        t.description || '',
        t.amount.toFixed(2)
      ];
    });
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only trigger if not typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setTransactionType('expense');
        setEditingTransaction(null);
        setPreselectedCategoryId(null);
        setShowTransactionForm(true);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setTransactionType('income');
        setEditingTransaction(null);
        setPreselectedCategoryId(null);
        setShowTransactionForm(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const recentExpenseCategories = useMemo(() => {
    const recentTransactions = transactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    const categoryIds = new Set(
      recentTransactions.map((t) => String(t.categoryId?._id || t.categoryId))
    );
    return categories.filter((c) => categoryIds.has(String(c._id)));
  }, [transactions, categories]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader message="Loading budget data..." />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-medium">
            ×
          </button>
        </div>
      )}
      {!loading && (
        <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Budget & Finance</h1>
        <p className="text-sm text-slate-600 mt-1">Track your income and expenses</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {['week', 'month', 'year'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium ${period === p
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Total Income</div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalIncome)}</div>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalExpenses)}</div>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Net Balance</div>
            <div className={`text-2xl font-bold ${summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(summary.net)}
            </div>
          </div>
        </div>
      )}

      {/* Budget Alerts */}
      {summary && summary.byCategory && summary.byCategory.filter(cat => cat.percentage >= 80).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Budget Warnings</h3>
          {summary.byCategory
            .filter(cat => cat.percentage >= 80)
            .map(cat => {
              const category = categories.find(c => c._id === cat.categoryId);
              if (!category) return null;
              return (
                <div
                  key={cat.categoryId}
                  className={`p-3 rounded-lg border-2 ${cat.percentage >= 100
                    ? 'bg-red-50 border-red-300'
                    : 'bg-yellow-50 border-yellow-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <span className={`font-bold ${cat.percentage >= 100 ? 'text-red-700' : 'text-yellow-700'}`}>
                      {cat.percentage >= 100 ? '⚠️ Over Budget!' : `⚠️ ${cat.percentage}% used`}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Quick Transaction Entry */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Quick Add</h3>
          <span className="text-xs text-slate-500">Press E for expense, I for income</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setTransactionType('expense');
              setEditingTransaction(null);
              setPreselectedCategoryId(null);
              setShowTransactionForm(true);
            }}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
          >
            + Expense
          </button>
          <button
            onClick={() => {
              setTransactionType('income');
              setEditingTransaction(null);
              setPreselectedCategoryId(null);
              setShowTransactionForm(true);
            }}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium transition-colors"
          >
            + Income
          </button>
          {recentExpenseCategories.length > 0 && (
            <>
              <span className="text-xs text-slate-400 self-center">Recent:</span>
              {recentExpenseCategories.map(cat => (
                <button
                  key={cat._id}
                  onClick={() => {
                    setTransactionType('expense');
                    setEditingTransaction(null);
                    setPreselectedCategoryId(cat._id);
                    setShowTransactionForm(true);
                  }}
                  className="px-3 py-1 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 text-xs transition-colors"
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Monthly Budget Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Monthly Budget</h2>
          <button
            onClick={() => {
              setCategoryFormType('expense');
              setEditingCategory(null);
              setShowCategoryForm(true);
            }}
            className="text-sm text-slate-600 hover:text-slate-800 font-medium"
          >
            + Add Category
          </button>
        </div>
        {expenseCategories.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
            No expense categories found.{' '}
            <button
              onClick={() => {
                setCategoryFormType('expense');
                setEditingCategory(null);
                setShowCategoryForm(true);
              }}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Create one to get started.
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {expenseCategories.map((category) => {
              const categoryData = summary?.byCategory?.find(c => c.categoryId === category._id) || {
                total: 0,
                percentage: 0,
              };
              const hasBudget = category.budgetLimit && category.budgetLimit > 0;
              const percentage = categoryData.percentage || 0;

              const getProgressColor = () => {
                if (percentage >= 100) return 'bg-red-500';
                if (percentage >= 80) return 'bg-yellow-500';
                return 'bg-emerald-500';
              };

              return (
                <div
                  key={category._id}
                  className="bg-white p-4 rounded-lg border-2 hover:shadow-md transition-shadow"
                  style={{ borderColor: category.color || '#e2e8f0' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl">{category.icon || '📦'}</div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{category.name}</div>
                      {hasBudget ? (
                        <div className="text-sm text-slate-600">
                          {formatCurrency(categoryData.total)} / {formatCurrency(category.budgetLimit)}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 italic">No budget set</div>
                      )}
                    </div>
                  </div>

                  {hasBudget ? (
                    <>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>{percentage}% used</span>
                          <span>{formatCurrency(Math.max(0, category.budgetLimit - categoryData.total))} remaining</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${getProgressColor()}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryFormType('expense');
                          setShowCategoryForm(true);
                        }}
                        className="w-full px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium transition-colors"
                      >
                        Edit Budget
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryFormType('expense');
                        setShowCategoryForm(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors"
                    >
                      Set Budget
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incomes Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Incomes</h2>
          <button
            onClick={() => {
              setCategoryFormType('income');
              setEditingCategory(null);
              setShowCategoryForm(true);
            }}
            className="text-sm text-slate-600 hover:text-slate-800 font-medium"
          >
            + Add Category
          </button>
        </div>
        {incomeCategories.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center">
            <p className="text-slate-500 mb-2">No income categories found.</p>
            <p className="text-sm text-slate-400 mb-4">Create your first category to start tracking income!</p>
            <button
              onClick={() => {
                setCategoryFormType('income');
                setEditingCategory(null);
                setShowCategoryForm(true);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              + Create Income Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {incomeCategories.map((category) => {
              const categoryData = summary?.byCategoryIncome?.find(c => c.categoryId === category._id) || {
                total: 0,
              };
              return (
                <div
                  key={category._id}
                  className="bg-white p-4 rounded-lg border-2 hover:shadow-md transition-shadow relative group"
                  style={{ borderColor: category.color || '#e2e8f0' }}
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryFormType(category.type);
                        setShowCategoryForm(true);
                      }}
                      className="p-1 bg-white rounded shadow-sm text-slate-600 hover:text-slate-800 text-xs"
                      title="Edit category"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category._id)}
                      className="p-1 bg-white rounded shadow-sm text-red-600 hover:text-red-800 text-xs"
                      title="Delete category"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl">{category.icon || '💰'}</div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{category.name}</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {formatCurrency(categoryData.total)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setTransactionType('income');
                      setEditingTransaction(null);
                      setPreselectedCategoryId(category._id);
                      setShowTransactionForm(true);
                    }}
                    className="w-full px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium transition-colors"
                  >
                    + Add Income
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expenses Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Expenses</h2>
          <button
            onClick={() => {
              setCategoryFormType('expense');
              setEditingCategory(null);
              setShowCategoryForm(true);
            }}
            className="text-sm text-slate-600 hover:text-slate-800 font-medium"
          >
            + Add Category
          </button>
        </div>
        {expenseCategories.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center">
            <p className="text-slate-500 mb-2">No expense categories found.</p>
            <p className="text-sm text-slate-400 mb-4">Create your first category to start tracking expenses!</p>
            <button
              onClick={() => {
                setCategoryFormType('expense');
                setEditingCategory(null);
                setShowCategoryForm(true);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              + Create Expense Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {expenseCategories.map((category) => {
              const categoryData = summary?.byCategory?.find(c => c.categoryId === category._id) || {
                total: 0,
                percentage: 0,
              };
              return (
                <div key={category._id} className="relative group">
                  <CategoryCard
                    category={category}
                    total={categoryData.total}
                    onAddClick={(categoryId) => {
                      setTransactionType('expense');
                      setEditingTransaction(null);
                      setPreselectedCategoryId(categoryId);
                      setShowTransactionForm(true);
                    }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryFormType(category.type);
                        setShowCategoryForm(true);
                      }}
                      className="p-1 bg-white rounded shadow-sm text-slate-600 hover:text-slate-800 text-xs"
                      title="Edit category"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category._id)}
                      className="p-1 bg-white rounded shadow-sm text-red-600 hover:text-red-800 text-xs"
                      title="Delete category"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Section */}
      {summary && summary.byCategory && summary.byCategory.filter(cat => cat.total > 0).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">Analytics</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded text-sm transition-colors ${chartType === 'pie'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                Pie Chart
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded text-sm transition-colors ${chartType === 'bar'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                Bar Chart
              </button>
            </div>
          </div>
          {chartReady ? (
            <Suspense fallback={<div className="h-[300px] bg-slate-50 animate-pulse rounded flex items-center justify-center"><span className="text-slate-400">Loading chart...</span></div>}>
              <BudgetChart summary={summary} type={chartType} />
            </Suspense>
          ) : (
            <div className="h-[300px] bg-slate-50 animate-pulse rounded" />
          )}
        </div>
      )}

      {/* Transactions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Transactions</h2>
          <div className="flex gap-2">
            {transactions.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
              >
                Export CSV
              </button>
            )}
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium transition-colors"
            >
              {showTransactions ? 'Hide' : 'Show'} Transactions
            </button>
          </div>
        </div>

        {showTransactions && (
          <div className="space-y-4">
            {transactionsLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader message="Loading transactions..." />
              </div>
            )}
            {/* Search and Filter Controls */}
            {!transactionsLoading && transactions.length > 0 && (
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transactions..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All Types</option>
                      <option value="expense">Expenses</option>
                      <option value="income">Incomes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="date">Date (Newest)</option>
                      <option value="amount">Amount (High to Low)</option>
                      <option value="amountAsc">Amount (Low to High)</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {!transactionsLoading && (
              <TransactionList
                transactions={transactions}
                categories={categories}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                searchQuery={searchQuery}
                filterCategory={filterCategory}
                filterType={filterType}
                sortBy={sortBy}
              />
            )}
          </div>
        )}
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <TransactionForm
          categories={categories.filter(c => c.type === transactionType)}
          type={transactionType}
          transaction={editingTransaction}
          preselectedCategoryId={preselectedCategoryId}
          onClose={() => {
            setShowTransactionForm(false);
            setEditingTransaction(null);
            setPreselectedCategoryId(null);
          }}
          onSubmit={handleTransactionSubmit}
          onCategoryCreated={handleCategorySubmit}
        />
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryForm
          category={editingCategory}
          type={categoryFormType}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
          onSubmit={handleCategorySubmit}
          onDelete={async (id) => {
            await handleDeleteCategory(id);
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
          confirmLoading={confirmModal.confirmLoading}
        />
      )}
        </>
      )}
    </div>
  );
}
