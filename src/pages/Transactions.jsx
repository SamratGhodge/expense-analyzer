import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card'];

const emptyForm = {
  category: 'Food',
  amount: '',
  payment_mode: 'Cash',
  date: new Date().toISOString().split('T')[0],
  description: '',
};

function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setTableLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Fetch error:', error.message);
    } else {
      setTransactions(data || []);
    }
    setTableLoading(false);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.amount || !form.date) {
      setError('Amount and date are required');
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid positive amount');
      return;
    }

    setLoading(true);

    if (editingId) {
      // Update existing
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          category: form.category,
          amount,
          payment_mode: form.payment_mode,
          date: form.date,
          description: form.description,
        })
        .eq('id', editingId)
        .eq('user_id', user.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccessMsg('Transaction updated');
        setEditingId(null);
        setForm({ ...emptyForm });
        await fetchTransactions();
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          category: form.category,
          amount,
          payment_mode: form.payment_mode,
          date: form.date,
          description: form.description,
        });

      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccessMsg('Transaction added');
        setForm({ ...emptyForm });
        await fetchTransactions();
      }
    }

    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this transaction?')) return;

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setTransactions(transactions.filter((t) => t.id !== id));
      // If we were editing this row, cancel
      if (editingId === id) {
        setEditingId(null);
        setForm({ ...emptyForm });
      }
    }
  }

  function handleEdit(txn) {
    setEditingId(txn.id);
    setForm({
      category: txn.category,
      amount: String(txn.amount),
      payment_mode: txn.payment_mode,
      date: txn.date,
      description: txn.description || '',
    });
    setError('');
    setSuccessMsg('');
    // Scroll to form
    window.scrollTo({ top: 0 });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccessMsg('');
  }

  return (
    <div>
      <h1 className="page-title">Transactions</h1>

      {/* Add / Edit form */}
      <div className="txn-form-box">
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: '#333' }}>
          {editingId ? 'Edit Transaction' : 'Add Transaction'}
        </h3>

        {error && <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
        {successMsg && <p style={{ color: '#27ae60', fontSize: '13px', marginBottom: '10px' }}>{successMsg}</p>}

        <form onSubmit={handleSubmit} className="txn-form-grid">
          <div className="form-group">
            <label>Category</label>
            <select name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              name="amount"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label>Payment Mode</label>
            <select name="payment_mode" value={form.payment_mode} onChange={handleChange}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description (optional)</label>
            <input
              type="text"
              name="description"
              placeholder="e.g. Grocery shopping"
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Transaction'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginLeft: '10px' }}
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <hr className="section-divider" />

      {/* Transactions table */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: '#333' }}>
        Your Transactions
      </h3>

      {tableLoading ? (
        <p style={{ color: '#888', fontSize: '14px' }}>Loading transactions...</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#999', padding: '24px' }}>
                    No transactions yet. Add one above.
                  </td>
                </tr>
              ) : (
                transactions.map((t, idx) => (
                  <tr key={t.id}>
                    <td>{idx + 1}</td>
                    <td>{t.date}</td>
                    <td>{t.description || '—'}</td>
                    <td><span className="category-tag">{t.category}</span></td>
                    <td>{t.payment_mode}</td>
                    <td className="amount-expense">₹{Number(t.amount).toLocaleString()}</td>
                    <td>
                      <button className="action-btn edit-btn" onClick={() => handleEdit(t)}>
                        Edit
                      </button>
                      <button className="action-btn delete-btn" onClick={() => handleDelete(t.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p style={{ fontSize: '13px', color: '#999', marginTop: '10px' }}>
            Total: {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

export default Transactions;
