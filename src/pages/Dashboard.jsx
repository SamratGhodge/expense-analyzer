import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
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

  // Recent transactions (latest 5)
  const recent = [...transactions].reverse().slice(0, 5);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {error && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Error loading data: {error}</span>
          <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: '12px' }} onClick={fetchTransactions}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading dashboard data...</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="label">This Month</div>
              <div className="value" style={{ color: '#c0392b' }}>
                ₹{Math.round(currentMonthTotal).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">All-Time Spending</div>
              <div className="value">
                ₹{Math.round(totalExpenses).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Total Transactions</div>
              <div className="value">{txnCount}</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="insight-grid">
            {/* Pie chart */}
            <div className="insight-box">
              <h3>Spending by Category (This Month)</h3>
              {pieData.length === 0 ? (
                <p style={{ color: '#777777', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
                  No transactions recorded for this month.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
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

            {/* Line chart */}
            <div className="insight-box">
              <h3>Monthly Spending (Last 6 Months)</h3>
              <ResponsiveContainer width="100%" height={240}>
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

          {/* Recent transactions table */}
          <h2 className="section-title">Recent Transactions</h2>

          {recent.length === 0 ? (
            <div className="insight-box">
              <p style={{ color: '#777777', fontSize: '13px' }}>
                No transactions found. Go to the Transactions page to add your first expense.
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
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.description || '—'}</td>
                      <td><span className="category-tag">{t.category}</span></td>
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
