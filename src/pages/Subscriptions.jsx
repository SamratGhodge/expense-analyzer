import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeText, validateAmount } from '../utils/security';

const CATEGORIES = ['Entertainment', 'Bills', 'Shopping', 'Food', 'Transport', 'Other'];
const PAYMENT_MODES = ['UPI', 'Card', 'Cash'];

const DEFAULT_SUBSCRIPTIONS = [
  { id: 'sub-1', name: 'Netflix Premium', category: 'Entertainment', amount: 649, dueDay: 15, payment_mode: 'Card', active: true },
  { id: 'sub-2', name: 'Spotify Student', category: 'Entertainment', amount: 59, dueDay: 28, payment_mode: 'UPI', active: true },
  { id: 'sub-3', name: 'WiFi Broadband', category: 'Bills', amount: 825, dueDay: 5, payment_mode: 'UPI', active: true },
  { id: 'sub-4', name: 'Mobile Recharge (Jio)', category: 'Bills', amount: 299, dueDay: 12, payment_mode: 'UPI', active: true },
];

function Subscriptions() {
  const { user } = useAuth();
  const storageKey = `ea_subscriptions_${user?.id || 'guest'}`;

  const [subscriptions, setSubscriptions] = useState([]);
  const [form, setForm] = useState({
    name: '',
    category: 'Entertainment',
    amount: '',
    dueDay: '1',
    payment_mode: 'UPI',
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load subscriptions
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSubscriptions(JSON.parse(saved));
      } else {
        setSubscriptions(DEFAULT_SUBSCRIPTIONS);
      }
    } catch (e) {
      setSubscriptions(DEFAULT_SUBSCRIPTIONS);
    }
  }, [storageKey]);

  const saveSubscriptions = (newList) => {
    setSubscriptions(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.error('Storage error', e);
    }
  };

  const handleAddSubscription = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanName = sanitizeText(form.name);
    if (!cleanName) {
      setError('Please provide a subscription / service name.');
      return;
    }

    const valCheck = validateAmount(form.amount);
    if (!valCheck.valid) {
      setError(valCheck.message);
      return;
    }

    const dayNum = parseInt(form.dueDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setError('Renewal day must be between 1 and 31.');
      return;
    }

    const newSub = {
      id: `sub-${Date.now()}`,
      name: cleanName,
      category: form.category,
      amount: valCheck.value,
      dueDay: dayNum,
      payment_mode: form.payment_mode,
      active: true,
    };

    const updated = [newSub, ...subscriptions];
    saveSubscriptions(updated);
    setSuccessMsg(`Added "${cleanName}" to subscriptions tracker.`);
    setForm({
      name: '',
      category: 'Entertainment',
      amount: '',
      dueDay: '1',
      payment_mode: 'UPI',
    });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this subscription?')) return;
    const updated = subscriptions.filter((s) => s.id !== id);
    saveSubscriptions(updated);
    setSuccessMsg('Subscription removed.');
  };

  const handleToggleActive = (id) => {
    const updated = subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    saveSubscriptions(updated);
  };

  // Calculations for renewal alerts
  const today = new Date();
  const currentDay = today.getDate();

  const activeSubs = subscriptions.filter((s) => s.active);
  const totalMonthlyCommitment = activeSubs.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // Subscriptions due in next 7 days
  const upcomingCount = activeSubs.filter((s) => {
    const diff = s.dueDay - currentDay;
    return (diff >= 0 && diff <= 7) || (diff < 0 && 30 + diff <= 7);
  }).length;

  return (
    <div>
      <h1 className="page-title">Subscriptions &amp; Recurring Bills</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Summary Stats */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Monthly Fixed Commitments</div>
          <div className="value" style={{ color: '#2e6db4' }}>
            ₹{Math.round(totalMonthlyCommitment).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Active Subscriptions</div>
          <div className="value">{activeSubs.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Due in Next 7 Days</div>
          <div className="value" style={{ color: upcomingCount > 0 ? '#e67e22' : '#27ae60' }}>
            {upcomingCount}
          </div>
        </div>
      </div>

      {/* Add Subscription Form */}
      <div className="txn-form-box">
        <h2 className="section-title">Add Recurring Expense</h2>
        <form onSubmit={handleAddSubscription} className="txn-form-grid">
          <div className="form-group">
            <label htmlFor="sub-name">Service / Bill Name</label>
            <input
              id="sub-name"
              type="text"
              placeholder="e.g. Netflix, Gym, Room Rent"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sub-category">Category</label>
            <select
              id="sub-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sub-amount">Monthly Amount (₹)</label>
            <input
              id="sub-amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              min="1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sub-due">Renewal Day of Month</label>
            <input
              id="sub-due"
              type="number"
              min="1"
              max="31"
              placeholder="1–31"
              value={form.dueDay}
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
            <button type="submit" className="btn-primary">
              Add Subscription
            </button>
          </div>
        </form>
      </div>

      <hr className="section-divider" />

      {/* Subscriptions Table */}
      <h2 className="section-title">Tracked Commitments</h2>

      {subscriptions.length === 0 ? (
        <div className="insight-box">
          <p style={{ color: '#777777', fontSize: '13px' }}>
            No subscriptions tracked yet. Add your fixed monthly bills above.
          </p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Category</th>
                <th>Monthly Cost</th>
                <th>Renewal Day</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const diff = sub.dueDay - currentDay;
                const isDueSoon = sub.active && ((diff >= 0 && diff <= 7) || (diff < 0 && 30 + diff <= 7));

                return (
                  <tr key={sub.id} style={{ opacity: sub.active ? 1 : 0.6 }}>
                    <td>
                      <strong>{sub.name}</strong>
                      {isDueSoon && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#e67e22', fontWeight: 600 }}>
                          ⚡ Renews in {diff >= 0 ? diff : 30 + diff} day(s)
                        </span>
                      )}
                    </td>
                    <td><span className="category-tag">{sub.category}</span></td>
                    <td style={{ fontWeight: 600, color: '#333' }}>₹{Number(sub.amount).toLocaleString()}</td>
                    <td>{sub.dueDay}th of month</td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '2px',
                          backgroundColor: sub.active ? '#eef9f2' : '#f5f5f5',
                          color: sub.active ? '#27ae60' : '#888',
                          fontWeight: 600,
                        }}
                      >
                        {sub.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => handleToggleActive(sub.id)}
                      >
                        {sub.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(sub.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Subscriptions;
