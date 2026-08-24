function Insights() {
  const categoryData = [
    { name: 'Food', amount: 1980, percent: 32 },
    { name: 'Transport', amount: 820, percent: 13 },
    { name: 'Entertainment', amount: 1099, percent: 18 },
    { name: 'Utilities', amount: 1699, percent: 27 },
    { name: 'Education', amount: 950, percent: 15 },
  ];

  const monthlyData = [
    { month: 'May', expense: 6200, income: 12000 },
    { month: 'Jun', expense: 7800, income: 15000 },
    { month: 'Jul', expense: 5400, income: 10000 },
    { month: 'Aug', expense: 4850, income: 13000 },
  ];

  const maxExpense = Math.max(...categoryData.map((c) => c.amount));
  const maxMonthly = Math.max(...monthlyData.map((m) => Math.max(m.expense, m.income)));

  return (
    <div>
      <h1 className="page-title">Insights</h1>

      <div className="insight-grid">
        {/* Category breakdown */}
        <div className="insight-box">
          <h3>Expenses by Category</h3>
          {categoryData.map((cat) => (
            <div className="bar-chart-row" key={cat.name}>
              <span className="bar-label">{cat.name}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(cat.amount / maxExpense) * 100}%` }}
                ></div>
              </div>
              <span className="bar-value">₹{cat.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Monthly income vs expense */}
        <div className="insight-box">
          <h3>Monthly Income vs Expense</h3>
          {monthlyData.map((m) => (
            <div key={m.month} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#444' }}>{m.month} 2026</div>
              <div className="bar-chart-row">
                <span className="bar-label" style={{ width: '60px', fontSize: '12px', color: '#27ae60' }}>Income</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(m.income / maxMonthly) * 100}%`, backgroundColor: '#27ae60' }}
                  ></div>
                </div>
                <span className="bar-value">₹{m.income.toLocaleString()}</span>
              </div>
              <div className="bar-chart-row">
                <span className="bar-label" style={{ width: '60px', fontSize: '12px', color: '#c0392b' }}>Expense</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(m.expense / maxMonthly) * 100}%`, backgroundColor: '#c0392b' }}
                  ></div>
                </div>
                <span className="bar-value">₹{m.expense.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Top spending */}
        <div className="insight-box">
          <h3>Top 5 Expenses This Month</h3>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <tbody>
              {[
                { desc: 'Electricity Bill', amount: 1400 },
                { desc: 'Grocery Store', amount: 1200 },
                { desc: 'Textbook Purchase', amount: 950 },
                { desc: 'Restaurant Dinner', amount: 780 },
                { desc: 'Netflix Subscription', amount: 649 },
              ].map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 0', color: '#555' }}>{i + 1}. {item.desc}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#c0392b' }}>
                    ₹{item.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary stats */}
        <div className="insight-box">
          <h3>Quick Stats</h3>
          <div style={{ fontSize: '14px', lineHeight: '2' }}>
            <div>Average daily expense: <strong>₹802</strong></div>
            <div>Highest spending day: <strong>Aug 16 (₹1,400)</strong></div>
            <div>Most frequent category: <strong>Food</strong></div>
            <div>Savings rate: <strong>29%</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Insights;
