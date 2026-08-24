import { useState } from 'react';

const SAMPLE_DATA = [
  { id: 1, date: '2026-08-22', description: 'Grocery Store', category: 'Food', type: 'expense', amount: 1200 },
  { id: 2, date: '2026-08-21', description: 'Freelance Payment', category: 'Income', type: 'income', amount: 5000 },
  { id: 3, date: '2026-08-20', description: 'Bus Pass Renewal', category: 'Transport', type: 'expense', amount: 500 },
  { id: 4, date: '2026-08-19', description: 'Netflix Subscription', category: 'Entertainment', type: 'expense', amount: 649 },
  { id: 5, date: '2026-08-18', description: 'Textbook Purchase', category: 'Education', type: 'expense', amount: 950 },
  { id: 6, date: '2026-08-17', description: 'Part-time Salary', category: 'Income', type: 'income', amount: 8000 },
  { id: 7, date: '2026-08-16', description: 'Electricity Bill', category: 'Utilities', type: 'expense', amount: 1400 },
  { id: 8, date: '2026-08-15', description: 'Restaurant Dinner', category: 'Food', type: 'expense', amount: 780 },
  { id: 9, date: '2026-08-14', description: 'Uber Ride', category: 'Transport', type: 'expense', amount: 320 },
  { id: 10, date: '2026-08-13', description: 'Stipend', category: 'Income', type: 'income', amount: 12000 },
  { id: 11, date: '2026-08-12', description: 'Mobile Recharge', category: 'Utilities', type: 'expense', amount: 299 },
  { id: 12, date: '2026-08-10', description: 'Movie Tickets', category: 'Entertainment', type: 'expense', amount: 450 },
];

function Transactions() {
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('All');

  const categories = ['All', ...new Set(SAMPLE_DATA.map((t) => t.category))];

  const filtered = SAMPLE_DATA.filter((t) => {
    if (filterCategory !== 'All' && t.category !== filterCategory) return false;
    if (filterType !== 'All' && t.type !== filterType) return false;
    return true;
  });

  return (
    <div>
      <h1 className="page-title">Transactions</h1>

      <div className="filters-bar">
        <div className="form-group">
          <label>Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="All">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <button
          className="btn-secondary"
          style={{ marginBottom: '0', height: '35px', fontSize: '13px' }}
          onClick={() => { setFilterCategory('All'); setFilterType('All'); }}
        >
          Reset
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: '#999', padding: '24px' }}>No transactions found</td>
            </tr>
          ) : (
            filtered.map((t, idx) => (
              <tr key={t.id}>
                <td>{idx + 1}</td>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td><span className="category-tag">{t.category}</span></td>
                <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                <td className={t.type === 'expense' ? 'amount-expense' : 'amount-income'}>
                  {t.type === 'expense' ? `-₹${t.amount.toLocaleString()}` : `+₹${t.amount.toLocaleString()}`}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p style={{ fontSize: '13px', color: '#999' }}>Showing {filtered.length} of {SAMPLE_DATA.length} transactions</p>
    </div>
  );
}

export default Transactions;
