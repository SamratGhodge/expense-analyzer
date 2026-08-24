import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { sanitizeText, validateAmount, isValidDate } from '../utils/security';
import { exportTransactionsToCSV, printExpenseReport } from '../utils/exportReport';

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

  // Selection State for multi-select functionality
  // selectedIds stores array of selected transaction ids (filtered or otherwise)
  const [selectedIds, setSelectedIds] = useState([]);
  // Bulk edit state
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkCategory, setBulkCategory] = useState(''); // empty means 'no change'
  const [bulkPaymentMode, setBulkPaymentMode] = useState(''); // empty means 'no change'

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPaymentMode, setFilterPaymentMode] = useState('All');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Sorting
  // Options: 'newest' | 'oldest' | 'highest' | 'lowest'
  const [sortOption, setSortOption] = useState('newest');

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
        const normalized = (data || []).map((t) => ({
          ...t,
          date: t.txn_date || t.date || t.created_at?.split('T')[0] || '',
        }));

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

    if (!isValidDate(form.date)) {
      setError('Please select a valid date between year 2000 and 2100.');
      return;
    }

    const amountCheck = validateAmount(form.amount);
    if (!amountCheck.valid) {
      setError(amountCheck.message);
      return;
    }

    const amountNum = amountCheck.value;
    const cleanDescription = sanitizeText(form.description);

    setLoading(true);

    try {
      if (editingId) {
        let { error: updateError } = await supabase
          .from('transactions')
          .update({
            category: form.category,
            amount: amountNum,
            payment_mode: form.payment_mode,
            txn_date: form.date,
            description: cleanDescription,
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
              description: cleanDescription,
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
        let { error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            category: form.category,
            amount: amountNum,
            payment_mode: form.payment_mode,
            txn_date: form.date,
            description: cleanDescription,
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
              description: cleanDescription,
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
        // ensure selection state is updated if this id was selected
        setSelectedIds((prev) => prev.filter((x) => x !== id));
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

  // Duplicate a transaction into the Add form (does not save immediately)
  const handleDuplicate = (txn) => {
    const today = new Date().toISOString().split('T')[0];
    setEditingId(null); // ensure we're in Add mode
    setForm({
      category: txn.category || emptyForm.category,
      amount: String(txn.amount || ''),
      payment_mode: txn.payment_mode || emptyForm.payment_mode,
      date: today,
      description: txn.description || '',
    });
    setError('');
    setSuccessMsg('Transaction copied to form. You can edit and save it.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccessMsg('');
  };

  // Filter application
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysStr = ninetyDaysAgo.toISOString().split('T')[0];

  const filteredTransactions = transactions.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    // Search query filter
    if (q && !desc.includes(q) && !cat.includes(q)) {
      return false;
    }

    // Category filter
    if (filterCategory !== 'All' && t.category !== filterCategory) {
      return false;
    }

    // Payment Mode filter
    if (filterPaymentMode !== 'All' && t.payment_mode !== filterPaymentMode) {
      return false;
    }

    // Date Presets filter
    const txnDate = t.date;
    if (datePreset === 'this_month' && !txnDate.startsWith(currentMonthKey)) {
      return false;
    }
    if (datePreset === 'last_month' && !txnDate.startsWith(lastMonthKey)) {
      return false;
    }
    if (datePreset === 'last_90' && txnDate < ninetyDaysStr) {
      return false;
    }
    if (datePreset === 'custom') {
      if (customFromDate && txnDate < customFromDate) return false;
      if (customToDate && txnDate > customToDate) return false;
    }

    return true;
  });

  // Apply sorting on the filtered results to produce the visible list
  const sortedTransactions = (() => {
    const list = [...filteredTransactions];
    switch (sortOption) {
      case 'oldest':
        list.sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0;
          const tb = b.date ? new Date(b.date).getTime() : 0;
          return ta - tb;
        });
        break;
      case 'highest':
        list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
        break;
      case 'lowest':
        list.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
        break;
      case 'newest':
      default:
        list.sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0;
          const tb = b.date ? new Date(b.date).getTime() : 0;
          return tb - ta;
        });
    }
    return list;
  })();

  const totalFilteredAmount = filteredTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('All');
    setFilterPaymentMode('All');
    setDatePreset('all');
    setCustomFromDate('');
    setCustomToDate('');
  };

  // Selection helpers
  const isSelected = (id) => selectedIds.includes(id);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  // Selects only the currently filtered transactions (or clears them)
  const toggleSelectAll = () => {
    const filteredIds = sortedTransactions.map((t) => t.id);
    // If all filtered are already selected, unselect them; otherwise select them (union)
    const allSelected = filteredIds.every((id) => selectedIds.includes(id)) && filteredIds.length > 0;
    if (allSelected) {
      // remove filteredIds from selection
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // add missing filtered ids
      setSelectedIds((prev) => {
        const s = new Set(prev);
        filteredIds.forEach((id) => s.add(id));
        return Array.from(s);
      });
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected transaction${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`)) return;

    setError('');
    setSuccessMsg('');
    try {
      // Supabase supports .in for bulk deletes; restrict by user_id as well
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .in('id', selectedIds)
        .eq('user_id', user.id);

      if (deleteError) {
        setError(deleteError.message);
      } else {
        setSuccessMsg(`${selectedIds.length} transaction${selectedIds.length > 1 ? 's' : ''} deleted.`);
        // remove deleted from local state
        setTransactions((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
        setSelectedIds([]);
        if (editingId && selectedIds.includes(editingId)) {
          setEditingId(null);
          setForm({ ...emptyForm });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to delete selected transactions.');
    }
  };

  // Bulk edit handlers
  const handleStartBulkEdit = () => {
    if (selectedIds.length === 0) return;
    setBulkCategory('');
    setBulkPaymentMode('');
    setBulkEditing(true);
  };

  const handleCancelBulkEdit = () => {
    setBulkEditing(false);
    setBulkCategory('');
    setBulkPaymentMode('');
  };

  const handleApplyBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    // Build update object only with provided fields
    const updates = {};
    if (bulkCategory) updates.category = bulkCategory;
    if (bulkPaymentMode) updates.payment_mode = bulkPaymentMode;

    if (Object.keys(updates).length === 0) {
      setError('Please select at least one field to update (or cancel).');
      return;
    }

    if (!window.confirm(`Apply changes to ${selectedIds.length} selected transaction${selectedIds.length > 1 ? 's' : ''}?`)) return;

    setError('');
    setSuccessMsg('');
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .in('id', selectedIds)
        .eq('user_id', user.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        // Update local state
        setTransactions((prev) => prev.map((t) => (
          selectedIds.includes(t.id) ? { ...t, ...updates } : t
        )));

        setSuccessMsg(`${selectedIds.length} transaction${selectedIds.length > 1 ? 's' : ''} updated.`);
        setBulkEditing(false);
        setBulkCategory('');
        setBulkPaymentMode('');
      }
    } catch (err) {
      setError(err.message || 'Failed to update selected transactions.');
    }
  };

  return (
    <div>
      <h1 className="page-title">Transactions Management</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Add / Edit form */}
      <div className="txn-form-box">
        <h2 className="section-title">
          {editingId ? 'Edit Transaction' : 'Add New Expense'}
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
              placeholder="e.g. Lunch at canteen, Metro Smartcard recharge"
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

      {/* Advanced Filter, Search & Export Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Transaction Records</h2>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Selection summary & actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#333' }}>{selectedIds.length} selected</span>

            {/* Bulk Edit button - shown when at least one selected */}
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              onClick={handleStartBulkEdit}
              disabled={selectedIds.length === 0}
              title="Bulk edit selected transactions"
            >
              ✏️ Bulk Edit
            </button>

            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              title="Delete selected transactions"
            >
              🗑️ Delete Selected
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              title="Clear selection"
            >
              ✖️ Clear Selection
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* When bulkEditing is active, show small inline form for category/payment_mode */}
            {bulkEditing ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  style={{ padding: '6px', fontSize: '13px' }}
                >
                  <option value="">— No change (Category) —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={bulkPaymentMode}
                  onChange={(e) => setBulkPaymentMode(e.target.value)}
                  style={{ padding: '6px', fontSize: '13px' }}
                >
                  <option value="">— No change (Payment Mode) —</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <button
                  className="btn-primary"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
                  onClick={handleApplyBulkEdit}
                >
                  Apply
                </button>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
                  onClick={handleCancelBulkEdit}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="sort-select" style={{ fontSize: '13px', color: '#333', marginRight: '4px' }}>Sort</label>
                <select
                  id="sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  style={{ padding: '6px', fontSize: '13px' }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>
              </div>

              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => exportTransactionsToCSV(sortedTransactions, 'filtered_expenses.csv')}
              >
                📥 Export CSV
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => printExpenseReport(sortedTransactions, user?.email, datePreset === 'custom' ? `${customFromDate} to ${customToDate}` : datePreset)}
              >
                🖨️ Print / PDF Report
              </button>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Filter controls box */}
      <div className="txn-form-box" style={{ padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="search-input">Search Merchant/Note</label>
            <input
              id="search-input"
              type="text"
              placeholder="e.g. Swiggy, Uber"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="filter-cat">Category</label>
            <select
              id="filter-cat"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="filter-pay">Payment Mode</label>
            <select
              id="filter-pay"
              value={filterPaymentMode}
              onChange={(e) => setFilterPaymentMode(e.target.value)}
            >
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="filter-date">Date Period</label>
            <select
              id="filter-date"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90">Last 90 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="from-date">From</label>
                <input
                  id="from-date"
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="to-date">To</label>
                <input
                  id="to-date"
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '7px 12px', fontSize: '13px', width: '100%' }}
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Transactions list */}
      {tableLoading ? (
        <div className="loading-state">Loading transactions list...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="insight-box">
          <p style={{ color: '#777777', fontSize: '13px' }}>
            No transactions match the selected filters. Try adjusting your search query or date range.
          </p>
        </div>
      ) : (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={sortedTransactions.length > 0 && sortedTransactions.every((tt) => selectedIds.includes(tt.id))}
                      title="Select all filtered transactions"
                    />
                  </th>
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
                {sortedTransactions.map((t, idx) => (
                  <tr key={t.id} style={isSelected(t.id) ? { backgroundColor: '#f5fbff' } : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        aria-label={`Select transaction ${idx + 1}`}
                      />
                    </td>
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
                        className="action-btn"
                        onClick={() => handleDuplicate(t)}
                        title="Duplicate transaction to form"
                      >
                        Duplicate
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

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#555555', marginTop: '6px' }}>
            <span>
              Showing {filteredTransactions.length} of {transactions.length} total transaction{transactions.length !== 1 ? 's' : ''}.
            </span>
            <span>
              Filtered Total: <strong>₹{Math.round(totalFilteredAmount).toLocaleString()}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default Transactions;
