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

  const fetchTransactions = async () => {
    setTableLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        // Normalize date from either txn_date or date column
        const normalized = (data || []).map((t) => ({
          ...t,
          date: t.txn_date || t.date || t.created_at?.split('T')[0] || '',
        }));

        // Sort descending by date
        normalized.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(normalized);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions.');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.amount || !form.date) {
      setError('Amount and Date are required.');
      return;
    }

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        // Try updating with txn_date first, fallback to date
        let updatePayload = {
          category: form.category,
          amount: amountNum,
          payment_mode: form.payment_mode,
          txn_date: form.date,
          date: form.date,
          description: form.description.trim(),
        };

        let { error: updateError } = await supabase
          .from('transactions')
          .update({
            category: form.category,
            amount: amountNum,
            payment_mode: form.payment_mode,
            txn_date: form.date,
            description: form.description.trim(),
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (updateError && updateError.message.includes('column "txn_date" does not exist')) {
          const res = await supabase
            .from('transactions')
            .update({
              category: form.category,
              amount: amountNum,
              payment_mode: form.payment_mode,
              date: form.date,
              description: form.description.trim(),
            })
            .eq('id', editingId)
            .eq('user_id', user.id);
          updateError = res.error;
        }

        if (updateError) {
          setError(updateError.message);
        } else {
          setSuccessMsg('Transaction updated successfully.');
          setEditingId(null);
          setForm({ ...emptyForm });
          await fetchTransactions();
        }
      } else {
        // Insert with txn_date, fallback to date if txn_date doesn't exist
        let { error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            category: form.category,
            amount: amountNum,
            payment_mode: form.payment_mode,
            txn_date: form.date,
            description: form.description.trim(),
          });

        if (insertError && insertError.message.includes('column "txn_date" does not exist')) {
          const res = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              category: form.category,
              amount: amountNum,
              payment_mode: form.payment_mode,
              date: form.date,
              description: form.description.trim(),
            });
          insertError = res.error;
        }

        if (insertError) {
          setError(insertError.message);
        } else {
          setSuccessMsg('Transaction added successfully.');
          setForm({ ...emptyForm });
          await fetchTransactions();
        }
      }
    } catch (err) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    setError('');
    setSuccessMsg('');
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        setError(deleteError.message);
      } else {
        setSuccessMsg('Transaction deleted.');
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setForm({ ...emptyForm });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to delete transaction.');
    }
  };

  const handleEdit = (txn) => {
    setEditingId(txn.id);
    setForm({
      category: txn.category,
      amount: String(txn.amount),
      payment_mode: txn.payment_mode,
      date: txn.date || txn.txn_date || '',
      description: txn.description || '',
    });
    setError('');
    setSuccessMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccessMsg('');
  };

  return (
    <div>
      <h1 className="page-title">Transactions</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Add / Edit form */}
      <div className="txn-form-box">
        <h2 className="section-title">
          {editingId ? 'Edit Transaction' : 'Add New Transaction'}
        </h2>

        <form onSubmit={handleSubmit} className="txn-form-grid">
          <div className="form-group">
            <label htmlFor="txn-category">Category</label>
            <select
              id="txn-category"
              name="category"
              value={form.category}
              onChange={handleChange}
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="txn-amount">Amount (₹)</label>
            <input
              id="txn-amount"
              type="number"
              name="amount"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              min="0.01"
              step="any"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="txn-payment-mode">Payment Mode</label>
            <select
              id="txn-payment-mode"
              name="payment_mode"
              value={form.payment_mode}
              onChange={handleChange}
              disabled={loading}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="txn-date">Date</label>
            <input
              id="txn-date"
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="txn-description">Description (optional)</label>
            <input
              id="txn-description"
              type="text"
              name="description"
              placeholder="e.g. Lunch with friends, Semester textbook"
              value={form.description}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update Transaction' : 'Save Transaction'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginLeft: '10px' }}
                onClick={handleCancelEdit}
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <hr className="section-divider" />

      {/* Transactions list */}
      <h2 className="section-title">All Transactions</h2>

      {tableLoading ? (
        <div className="loading-state">Loading transactions list...</div>
      ) : transactions.length === 0 ? (
        <div className="insight-box">
          <p style={{ color: '#777777', fontSize: '13px' }}>
            No transactions found. Use the form above to add your first expense.
          </p>
        </div>
      ) : (
        <>
          <div className="data-table-container">
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
                {transactions.map((t, idx) => (
                  <tr key={t.id}>
                    <td>{idx + 1}</td>
                    <td>{t.date}</td>
                    <td>{t.description || '—'}</td>
                    <td><span className="category-tag">{t.category}</span></td>
                    <td>{t.payment_mode}</td>
                    <td className="amount-expense">₹{Number(t.amount).toLocaleString()}</td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => handleEdit(t)}
                        title="Edit transaction"
                      >
                        Edit
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(t.id)}
                        title="Delete transaction"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '12px', color: '#888888' }}>
            Showing {transactions.length} recorded transaction{transactions.length !== 1 ? 's' : ''}.
          </p>
        </>
      )}
    </div>
  );
}

export default Transactions;
