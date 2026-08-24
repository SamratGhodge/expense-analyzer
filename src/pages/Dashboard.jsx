import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// Simple flat colors for pie chart slices — kept to 6 to cover our categories
const PIE_COLORS = ['#2e6db4', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#7f8c8d'];

function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (!error && data) {
        setTransactions(data);
      }
      setLoading(false);
    }
    fetchTransactions();
  }, [user.id]);

  // ---- Compute stats ----
  const totalExpenses = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const txnCount = transactions.length;

  // ---- Pie chart data: spending by category for current month ----
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTxns = transactions.filter(
    (t) => t.date && t.date.startsWith(currentMonth)
  );

  const categoryTotals = {};
  for (const t of currentMonthTxns) {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  }
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  // ---- Line chart data: total spending per month for last 6 months ----
  const monthlyTotals = {};
  for (const t of transactions) {
    if (!t.date) continue;
    const m = t.date.slice(0, 7);
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(t.amount);
  }

  // Build last 6 months labels
  const last6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    last6.push({ month: label, total: Math.round(monthlyTotals[key] || 0) });
  }

  // ---- Recent transactions (latest 5) ----
  const recent = [...transactions].reverse().slice(0, 5);

  const currentMonthTotal = currentMonthTxns.reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {/* Stat cards */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">This Month</div>
          <div className="value" style={{ color: '#c0392b' }}>₹{Math.round(currentMonthTotal).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">All-Time Spending</div>
          <div className="value">₹{Math.round(totalExpenses).toLocaleString()}</div>
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
            <p style={{ color: '#999', fontSize: '13px' }}>No transactions this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
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
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={last6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
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
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#333', marginTop: '8px' }}>
        Recent Transactions
      </h2>

      {recent.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>No transactions yet. Add some on the Transactions page.</p>
      ) : (
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
      )}
    </div>
  );
}

export default Dashboard;
