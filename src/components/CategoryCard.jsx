export default function CategoryCard({ category, total, onAddClick }) {
  const handleAddClick = () => {
    onAddClick(category._id);
  };
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  return (
    <div 
      className="bg-white p-4 rounded-lg border-2 hover:shadow-md transition-shadow"
      style={{ borderColor: category.color || '#e2e8f0' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="text-2xl p-2 rounded-lg"
          style={{ backgroundColor: `${category.color || '#10b981'}20` }}
        >
          {category.icon || '📦'}
        </div>
        <div className="flex-1">
          <div className="font-medium text-slate-800">{category.name}</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(total)}</div>
        </div>
      </div>

      <button
        onClick={handleAddClick}
        className="w-full px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
      >
        + Add Expense
      </button>
    </div>
  );
}
