import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { validateAmount } from '../utils/security';

const DEFAULT_BUDGETS = {
  Food: 6000,
  Transport: 2500,
  Bills: 4000,
  Shopping: 5000,
  Entertainment: 2000,
  Other: 2000,
};

function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState({ ...DEFAULT_BUDGETS });
  const [currentSpend, setCurrentSpend] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempLimit, setTempLimit] = useState('');

  const storageKey = `ea_budgets_${user?.id || 'guest'}`;

  // Load budgets from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setBudgets(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load local budgets', e);
    }
  }, [storageKey]);

  // Fetch current month's transactions
  useEffect(() => {
    async function fetchMonthSpend() {
      if (!user?.id) return;
      setLoading(true);
      setError('');

      try {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id);

        if (fetchError) {
          setError(fetchError.message);
        } else {
          const spending = {};
          for (const t of data || []) {
            const dateStr = t.txn_date || t.date || t.created_at || '';
            if (dateStr.startsWith(currentMonthKey)) {
              const cat = t.category || 'Other';
              spending[cat] = (spending[cat] || 0) + Number(t.amount || 0);
            }
          }
          setCurrentSpend(spending);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch spending data.');
      } finally {
        setLoading(false);
      }
    }

    fetchMonthSpend();
  }, [user?.id]);

  const handleStartEdit = (category, currentLimit) => {
    setEditingCategory(category);
    setTempLimit(String(currentLimit));
    setError('');
    setSuccessMsg('');
  };

  const handleSaveBudget = (category) => {
    const valCheck = validateAmount(tempLimit);
    if (!valCheck.valid) {
      setError(valCheck.message);
      return;
    }

    const updated = {
      ...budgets,
      [category]: valCheck.value,
    };

    setBudgets(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setSuccessMsg(`Budget for ${category} updated to ₹${valCheck.value.toLocaleString()}.`);
    } catch (e) {
      console.error('Storage error', e);
    }
    setEditingCategory(null);
    setTempLimit('');
  };

  const categories = Object.keys(DEFAULT_BUDGETS);

  // Overall totals
  const totalBudget = Object.values(budgets).reduce((sum, b) => sum + Number(b || 0), 0);
  const totalSpent = Object.values(currentSpend).reduce((sum, s) => sum + Number(s || 0), 0);
  const overallPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div>
      <h1 className="page-title">Monthly Budgets &amp; Limits</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Overall Budget Overview Card */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Total Monthly Budget</div>
          <div className="value">₹{totalBudget.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Spent This Month</div>
          <div className="value" style={{ color: totalSpent > totalBudget ? '#c0392b' : '#27ae60' }}>
            ₹{Math.round(totalSpent).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Remaining Balance</div>
          <div className="value" style={{ color: totalBudget - totalSpent < 0 ? '#c0392b' : '#2e6db4' }}>
            ₹{Math.round(totalBudget - totalSpent).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Budget Utilized</div>
          <div className="value">{overallPercent}%</div>
        </div>
      </div>

      {/* Category Budget Cards */}
      <h2 className="section-title">Category-wise Budget Status</h2>

      {loading ? (
        <div className="loading-state">Calculating budget utilization...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {categories.map((cat) => {
            const spent = Math.round(currentSpend[cat] || 0);
            const limit = Number(budgets[cat] || DEFAULT_BUDGETS[cat]);
            const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

            let barColor = '#2e6db4'; // Normal
            let statusBadge = <span style={{ fontSize: '11px', color: '#27ae60', fontWeight: 600 }}>Within Budget</span>;

            if (percent > 100) {
              barColor = '#c0392b'; // Overbudget
              statusBadge = <span style={{ fontSize: '11px', color: '#c0392b', fontWeight: 600 }}>⚠️ Over Budget ({percent}%)</span>;
            } else if (percent >= 80) {
              barColor = '#e67e22'; // Warning
              statusBadge = <span style={{ fontSize: '11px', color: '#e67e22', fontWeight: 600 }}>⚡ Near Limit ({percent}%)</span>;
            }

            const isEditing = editingCategory === cat;

            return (
              <div key={cat} className="insight-box" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{cat}</div>
                  {statusBadge}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#555', marginBottom: '8px' }}>
                  <span>Spent: <strong>₹{spent.toLocaleString()}</strong></span>
                  <span>Limit: <strong>₹{limit.toLocaleString()}</strong></span>
                </div>

                {/* Progress bar */}
                <div style={{ height: '10px', background: '#eeeeee', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: barColor,
                      transition: 'width 0.3s ease',
                    }}
                  ></div>
                </div>

                {/* Edit inline form */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={tempLimit}
                      onChange={(e) => setTempLimit(e.target.value)}
                      placeholder="New limit"
                      style={{ padding: '4px 8px', fontSize: '12px', width: '110px' }}
                      min="1"
                    />
                    <button
                      className="btn-primary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => handleSaveBudget(cat)}
                    >
                      Save
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => setEditingCategory(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {limit - spent >= 0 ? `₹${(limit - spent).toLocaleString()} left` : `₹${Math.abs(limit - spent).toLocaleString()} exceeded`}
                    </span>
                    <button
                      className="action-btn"
                      style={{ fontSize: '12px', padding: '3px 8px' }}
                      onClick={() => handleStartEdit(cat, limit)}
                    >
                      Edit Limit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Practical Tips */}
      <hr className="section-divider" />
      <div className="insight-box" style={{ maxWidth: '640px' }}>
        <h3 style={{ fontSize: '13px', color: '#555555' }}>💡 Budgeting Best Practices</h3>
        <p style={{ fontSize: '12px', color: '#666666', lineHeight: '1.6', margin: 0 }}>
          The standard <strong>50/30/20 Rule</strong> suggests allocating 50% of income to essential needs (Bills &amp; Groceries), 30% to wants (Entertainment &amp; Shopping), and 20% to savings. Adjust category limits monthly to maintain positive cash flow.
        </p>
      </div>
    </div>
  );
}

export default Budgets;
