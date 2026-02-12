import { useState, useEffect } from 'react';
import { toISODateString, getTodayDate } from '../lib/dateUtils';
import CategoryForm from './CategoryForm';

export default function TransactionForm({ categories, type, transaction, preselectedCategoryId, onClose, onSubmit, onCategoryCreated }) {
  const getInitialCategoryId = () => {
    if (preselectedCategoryId) return preselectedCategoryId;
    if (categories.length > 0) return categories[0]._id;
    return '';
  };

  const initialCategoryId = preselectedCategoryId || (categories.length > 0 ? categories[0]._id : '');

  const [formData, setFormData] = useState({
    date: toISODateString(getTodayDate()),
    categoryId: initialCategoryId,
    amount: '',
    description: '',
    notes: '',
  });
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  useEffect(() => {
    if (transaction) {
      const categoryId = transaction.categoryId?._id || transaction.categoryId || '';
      setFormData({
        date: toISODateString(new Date(transaction.date)),
        categoryId,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        notes: transaction.notes || '',
      });
    } else {
      // Reset form when not editing
      setFormData({
        date: toISODateString(getTodayDate()),
        categoryId: getInitialCategoryId(),
        amount: '',
        description: '',
        notes: '',
      });
    }
  }, [transaction, preselectedCategoryId, categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please fill in all required fields with valid values.');
      return;
    }

    onSubmit({
      date: formData.date,
      type,
      categoryId: formData.categoryId,
      amount: parseFloat(formData.amount),
      description: formData.description.trim(),
      notes: formData.notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              {transaction ? 'Edit' : 'New'} {type === 'expense' ? 'Expense' : 'Income'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <div className="flex gap-2 mt-2">
                {['Today', 'Yesterday'].map(label => {
                  const date = label === 'Today' ? getTodayDate() : new Date(getTodayDate().getTime() - 86400000);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setFormData({ ...formData, date: toISODateString(date) })}
                      className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Category</label>
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  + Create New
                </button>
              </div>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.icon || '📦'} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Brief description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows="3"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  type === 'expense'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {transaction ? 'Update' : 'Add'} {type === 'expense' ? 'Expense' : 'Income'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryForm
          type={type}
          onClose={() => setShowCategoryForm(false)}
          onSubmit={async (categoryData) => {
            try {
              const response = await onCategoryCreated(categoryData);
              // Select the newly created category
              setFormData({ ...formData, categoryId: response._id });
              setShowCategoryForm(false);
            } catch (err) {
              console.error('Error creating category:', err);
              alert(err.response?.data?.message || 'Error creating category. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}
