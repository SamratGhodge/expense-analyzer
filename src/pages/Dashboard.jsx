import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const PIE_COLORS = ['#2e6db4', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#7f8c8d'];

function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const storageKey = `ea_budgets_${user?.id || 'guest'}`;
  const [totalBudgetLimit, setTotalBudgetLimit] = useState(25500);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const total = Object.values(parsed).reduce((s, v) => s + Number(v || 0), 0);
        if (total > 0) setTotalBudgetLimit(total);
      }
    } catch (e) {
      console.warn('Storage read error', e);
    }
  }, [storageKey]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const normalized = (data || []).map((t) => ({
          ...t,
          date: t.txn_date || t.date || t.created_at?.split('T')[0] || '',
        }));
        normalized.sort((a, b) => new Date(a.date) - new Date(b.date));
        setTransactions(normalized);
      }
    } catch (err) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id]);

  // Compute stats
  const totalExpenses = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const txnCount = transactions.length;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTxns = transactions.filter(
    (t) => t.date && t.date.startsWith(currentMonth)
  );

  const currentMonthTotal = currentMonthTxns.reduce((s, t) => s + Number(t.amount || 0), 0);

  // Daily average for current month
  const dayOfMonth = Math.max(now.getDate(), 1);
  const dailyAverage = Math.round(currentMonthTotal / dayOfMonth);

  // Pie chart data: spending by category for current month
  const categoryTotals = {};
  for (const t of currentMonthTxns) {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
  }
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  // Line chart data: total spending per month for last 6 months
  const monthlyTotals = {};
  for (const t of transactions) {
    if (!t.date) continue;
    const m = t.date.slice(0, 7);
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(t.amount || 0);
  }

  const last6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short' });
    last6.push({ month: label, total: Math.round(monthlyTotals[key] || 0) });
  }

  // Payment mode distribution
  const paymentModeTotals = { UPI: 0, Card: 0, Cash: 0 };
  for (const t of currentMonthTxns) {
    const mode = t.payment_mode || 'Cash';
    if (paymentModeTotals[mode] !== undefined) {
      paymentModeTotals[mode] += Number(t.amount || 0);
    } else {
      paymentModeTotals.Cash += Number(t.amount || 0);
    }
  }

  const totalPaymentMode = Object.values(paymentModeTotals).reduce((s, v) => s + v, 0);

  // Recent transactions (latest 5)
  const recent = [...transactions].reverse().slice(0, 5);

  const budgetUsedPercent = totalBudgetLimit > 0 ? Math.round((currentMonthTotal / totalBudgetLimit) * 100) : 0;

  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>

      {error && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Error loading data: {error}</span>
          <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: '12px' }} onClick={fetchTransactions}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading dashboard analytics...</div>
      ) : (
        <>
          {/* Top Key Performance Stats */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="label">This Month's Spending</div>
              <div className="value" style={{ color: currentMonthTotal > totalBudgetLimit ? '#c0392b' : '#2e6db4' }}>
                ₹{Math.round(currentMonthTotal).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Avg Daily Spend (This Month)</div>
              <div className="value">
                ₹{dailyAverage.toLocaleString()}<span style={{ fontSize: '12px', fontWeight: 'normal', color: '#888' }}>/day</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Monthly Budget Status</div>
              <div className="value" style={{ color: budgetUsedPercent > 100 ? '#c0392b' : budgetUsedPercent >= 80 ? '#e67e22' : '#27ae60' }}>
                {budgetUsedPercent}%
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '6px' }}>
                  (₹{Math.round(totalBudgetLimit - currentMonthTotal).toLocaleString()} left)
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Total Recorded Expenses</div>
              <div className="value">
                ₹{Math.round(totalExpenses).toLocaleString()}
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#888', marginLeft: '6px' }}>
                  ({txnCount} txns)
                </span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="insight-grid">
            {/* Category Pie Chart */}
            <div className="insight-box">
              <h3>Spending by Category (This Month)</h3>
              {pieData.length === 0 ? (
                <p style={{ color: '#777777', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
                  No transactions recorded for this month.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 6 Months Trend Line Chart */}
            <div className="insight-box">
              <h3>Monthly Spending Trend (Last 6 Months)</h3>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={last6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2e6db4"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#2e6db4' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Modes & Budget Widget Row */}
          <div className="insight-grid" style={{ marginBottom: '20px' }}>
            {/* Payment Mode Distribution */}
            <div className="insight-box">
              <h3>Payment Mode Distribution (This Month)</h3>
              {totalPaymentMode === 0 ? (
                <p style={{ color: '#777', fontSize: '13px' }}>No transactions recorded this month.</p>
              ) : (
                <div style={{ marginTop: '8px' }}>
                  {Object.entries(paymentModeTotals).map(([mode, amt]) => {
                    const pct = totalPaymentMode > 0 ? Math.round((amt / totalPaymentMode) * 100) : 0;
                    return (
                      <div className="bar-chart-row" key={mode}>
                        <span className="bar-label">{mode}</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: mode === 'UPI' ? '#2e6db4' : mode === 'Card' ? '#8e44ad' : '#27ae60',
                            }}
                          ></div>
                        </div>
                        <span className="bar-value">₹{Math.round(amt).toLocaleString()} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions & Budget Health */}
            <div className="insight-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Budget Health &amp; Shortcuts</h3>
                <Link to="/budgets" style={{ fontSize: '12px', color: '#2e6db4', fontWeight: 600 }}>Manage Budgets &rarr;</Link>
              </div>

              <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: '1.6' }}>
                You have allocated a monthly limit of <strong>₹{totalBudgetLimit.toLocaleString()}</strong>.
                {budgetUsedPercent > 100 ? (
                  <span style={{ color: '#c0392b', fontWeight: 600, display: 'block' }}>
                    ⚠️ You have exceeded your monthly budget by ₹{Math.round(currentMonthTotal - totalBudgetLimit).toLocaleString()}.
                  </span>
                ) : (
                  <span style={{ color: '#27ae60', fontWeight: 600, display: 'block' }}>
                    ✓ You have ₹{Math.round(totalBudgetLimit - currentMonthTotal).toLocaleString()} remaining this month.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link to="/transactions" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                  + Add Expense
                </Link>
                <Link to="/import-statement" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                  📄 Import Statement
                </Link>
                <Link to="/subscriptions" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                  🔔 Subscriptions
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Transactions Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Recent Transactions</h2>
            <Link to="/transactions" style={{ fontSize: '12px', color: '#2e6db4', fontWeight: 600 }}>View All &rarr;</Link>
          </div>

          {recent.length === 0 ? (
            <div className="insight-box">
              <p style={{ color: '#777777', fontSize: '13px' }}>
                No transactions found. Go to the Transactions page to record your first expense.
              </p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Payment Mode</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.description || '—'}</td>
                      <td><span className="category-tag">{t.category}</span></td>
                      <td>{t.payment_mode || 'Cash'}</td>
                      <td className="amount-expense">₹{Number(t.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
