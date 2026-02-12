import { useState, useEffect } from 'react';

const CATEGORY_ICONS = [
  '🛒', '🏠', '🍽️', '🚗', '🛍️', '💡', '🔄', '🎯', '🏥', '📚', '💅', '📦',
  '💰', '💼', '📈', '↩️', '🎁', '🍕', '☕', '🎬', '🏋️', '✈️', '🎓', '💊'
];

const CATEGORY_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316',
  '#06b6d4', '#84cc16', '#ef4444', '#6366f1', '#14b8a6', '#6b7280'
];

export default function CategoryForm({ category, type, onClose, onSubmit, onDelete }) {
  // Use category's type if editing, otherwise use prop type
  const categoryType = category?.type || type;

  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    color: '#10b981',
    budgetLimit: '',
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        icon: category.icon || '📦',
        color: category.color || '#10b981',
        budgetLimit: category.budgetLimit ? category.budgetLimit.toString() : '',
      });
    }
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a category name.');
      return;
    }

    // Only include budgetLimit for expense categories and if it has a value
    const submitData = {
      name: formData.name.trim(),
      type: categoryType,
      icon: formData.icon,
      color: formData.color,
    };

    if (categoryType === 'expense' && formData.budgetLimit && formData.budgetLimit.trim()) {
      const budgetLimitValue = parseFloat(formData.budgetLimit);
      if (!isNaN(budgetLimitValue) && budgetLimitValue > 0) {
        submitData.budgetLimit = budgetLimitValue;
      }
    }

    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              {category ? 'Edit' : 'New'} {categoryType === 'expense' ? 'Expense' : 'Income'} Category
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Category name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
              <div className="grid grid-cols-8 gap-2 mb-2">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`p-2 text-2xl rounded-lg border-2 transition-colors ${
                      formData.icon === icon
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Or enter custom emoji"
                maxLength="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="grid grid-cols-6 gap-2 mb-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      formData.color === color
                        ? 'border-slate-800 scale-110'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
              />
            </div>

            {categoryType === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monthly Budget Limit (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.budgetLimit}
                    onChange={(e) => setFormData({ ...formData, budgetLimit: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {category && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this category? This will not delete transactions, but you won\'t be able to use this category for new transactions.')) {
                      onDelete(category._id);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium ${category && onDelete ? 'flex-1' : 'flex-1'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  categoryType === 'expense'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {category ? 'Update' : 'Create'} Category
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
