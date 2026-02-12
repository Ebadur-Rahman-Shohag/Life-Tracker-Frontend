import { useMemo } from 'react';

export default function TransactionList({ transactions, categories, onEdit, onDelete, searchQuery, filterCategory, filterType, sortBy }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const category = categories.find(c => c._id === (t.categoryId?._id || t.categoryId));
        const categoryName = category?.name || '';
        const description = t.description || '';
        return categoryName.toLowerCase().includes(query) || description.toLowerCase().includes(query);
      });
    }

    if (filterCategory) {
      filtered = filtered.filter(t => {
        const catId = t.categoryId?._id || t.categoryId;
        return catId === filterCategory;
      });
    }

    if (filterType) {
      filtered = filtered.filter(t => t.type === filterType);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.amount - a.amount;
        case 'amountAsc':
          return a.amount - b.amount;
        case 'category':
          const catA = categories.find(c => c._id === (a.categoryId?._id || a.categoryId))?.name || '';
          const catB = categories.find(c => c._id === (b.categoryId?._id || b.categoryId))?.name || '';
          return catA.localeCompare(catB);
        case 'date':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return filtered;
  }, [transactions, categories, searchQuery, filterCategory, filterType, sortBy]);

  if (filteredAndSortedTransactions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
        {transactions.length === 0 
          ? (
            <div>
              <p className="mb-2 text-lg font-medium">No transactions yet</p>
              <p className="text-sm mb-4">Start tracking your finances by adding your first transaction!</p>
              <p className="text-xs text-slate-400">💡 Tip: Click on any category card to quickly add an expense or income</p>
            </div>
          )
          : (
            <div>
              <p className="mb-2">No transactions match your filters</p>
              <p className="text-sm text-slate-400">Try adjusting your search criteria</p>
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAndSortedTransactions.map((transaction) => {
              const category = categories.find(c => c._id === (transaction.categoryId?._id || transaction.categoryId));
              const isExpense = transaction.type === 'expense';
              
              return (
                <tr key={transaction._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(transaction.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category?.icon || '📦'}</span>
                      <span className="text-sm text-slate-700">{category?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{transaction.description || '—'}</td>
                  <td className={`px-4 py-3 text-sm font-medium text-right ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="text-slate-600 hover:text-slate-800 text-sm px-2 py-1 hover:bg-slate-100 rounded transition-colors"
                        title="Edit transaction"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(transaction._id)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1 hover:bg-red-50 rounded transition-colors"
                        title="Delete transaction"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
