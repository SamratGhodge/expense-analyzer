function Dashboard() {
  // Hardcoded sample data — typical for a college project demo
  const stats = {
    totalExpenses: 24850,
    totalIncome: 35000,
    balance: 10150,
    transactions: 47,
  };

  const recentTransactions = [
    { id: 1, date: '2026-08-22', description: 'Grocery Store', category: 'Food', amount: -1200 },
    { id: 2, date: '2026-08-21', description: 'Freelance Payment', category: 'Income', amount: 5000 },
    { id: 3, date: '2026-08-20', description: 'Bus Pass Renewal', category: 'Transport', amount: -500 },
    { id: 4, date: '2026-08-19', description: 'Netflix Subscription', category: 'Entertainment', amount: -649 },
    { id: 5, date: '2026-08-18', description: 'Textbook Purchase', category: 'Education', amount: -950 },
  ];

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Total Income</div>
          <div className="value" style={{ color: '#27ae60' }}>₹{stats.totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Expenses</div>
          <div className="value" style={{ color: '#c0392b' }}>₹{stats.totalExpenses.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Balance</div>
          <div className="value">₹{stats.balance.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Transactions</div>
          <div className="value">{stats.transactions}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#333' }}>Recent Transactions</h2>

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {recentTransactions.map((t) => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>{t.description}</td>
              <td><span className="category-tag">{t.category}</span></td>
              <td className={t.amount < 0 ? 'amount-expense' : 'amount-income'}>
                {t.amount < 0 ? `-₹${Math.abs(t.amount).toLocaleString()}` : `+₹${t.amount.toLocaleString()}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
