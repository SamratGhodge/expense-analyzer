import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { parseBankStatement } from '../utils/statementParser';
import { sanitizeText, sanitizeForCSV } from '../utils/security';

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Other'];

function StatementImport() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    setError('');
    setSuccessMsg('');
    setParseResult(null);
    setTransactions([]);

    if (!selectedFile) return;

    // Security Check: File Size (max 2MB)
    if (selectedFile.size > 2 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 2 MB.');
      return;
    }

    // Security Check: File extension
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'txt'].includes(extension)) {
      setError('Invalid file format. Please upload a standard .csv or .txt bank statement export.');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
  };

  const handleParse = () => {
    if (!file) {
      setError('Please select a bank statement file first.');
      return;
    }

    setParsing(true);
    setError('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Failed to read file content.');
        }

        const result = parseBankStatement(text);
        if (!result.transactions || result.transactions.length === 0) {
          setError('No valid debit/expense transactions could be extracted from this statement.');
        } else {
          setParseResult(result);
          setTransactions(result.transactions);
          setSuccessMsg(`Successfully parsed ${result.transactions.length} expense transactions from ${fileName}.`);
        }
      } catch (err) {
        setError(`Parsing error: ${err.message || 'Unable to parse statement format.'}`);
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read the selected file.');
      setParsing(false);
    };

    reader.readAsText(file);
  };

  const handleToggleSelect = (id) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = (selectVal) => {
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: selectVal })));
  };

  const handleCategoryChange = (id, newCategory) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category: newCategory } : t))
    );
  };

  const handleImportToDatabase = async () => {
    const selectedTxns = transactions.filter((t) => t.selected);
    if (selectedTxns.length === 0) {
      setError('No transactions are selected for import.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      // Prepare sanitized payload for Supabase
      const payload = selectedTxns.map((t) => ({
        user_id: user.id,
        category: t.category,
        amount: t.amount,
        payment_mode: t.payment_mode || 'Cash',
        txn_date: t.date,
        date: t.date,
        description: sanitizeText(t.description || 'Bank Statement Import'),
      }));

      // Try inserting with txn_date first
      let { error: insertError } = await supabase
        .from('transactions')
        .insert(
          payload.map((p) => ({
            user_id: p.user_id,
            category: p.category,
            amount: p.amount,
            payment_mode: p.payment_mode,
            txn_date: p.txn_date,
            description: p.description,
          }))
        );

      // Fallback to date column if txn_date does not exist
      if (insertError && insertError.message.includes('column "txn_date" does not exist')) {
        const res = await supabase.from('transactions').insert(
          payload.map((p) => ({
            user_id: p.user_id,
            category: p.category,
            amount: p.amount,
            payment_mode: p.payment_mode,
            date: p.date,
            description: p.description,
          }))
        );
        insertError = res.error;
      }

      if (insertError) {
        setError(`Database error: ${insertError.message}`);
      } else {
        setSuccessMsg(
          `Successfully saved ${selectedTxns.length} transactions to your account! You can now view them on the Dashboard & Transactions pages.`
        );
        // Clear parsed list after successful save
        setTransactions([]);
        setParseResult(null);
        setFile(null);
        setFileName('');
      }
    } catch (err) {
      setError(err.message || 'Failed to import transactions to database.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const selectedTotal = transactions
    .filter((t) => t.selected)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div>
      <h1 className="page-title">Bank Statement Analyzer &amp; Import</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Upload box */}
      <div className="txn-form-box">
        <h2 className="section-title">Upload Bank Statement (CSV / Text)</h2>
        <p style={{ fontSize: '13px', color: '#666666', marginBottom: '14px', lineHeight: '1.5' }}>
          Upload an exported account statement from any bank (SBI, HDFC, ICICI, Axis, etc.).
          The parser will extract transaction dates, filter debits, and automatically assign spending categories based on merchant names.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            disabled={parsing || saving}
            style={{ fontSize: '13px' }}
          />
          <button
            className="btn-primary"
            onClick={handleParse}
            disabled={!file || parsing || saving}
          >
            {parsing ? 'Analyzing Statement...' : 'Parse & Analyze Statement'}
          </button>
        </div>

        {fileName && (
          <p style={{ fontSize: '12px', color: '#555555', marginTop: '8px' }}>
            Selected: <strong>{fileName}</strong>
          </p>
        )}
      </div>

      {/* Statement Analytics Card */}
      {parseResult && (
        <>
          <hr className="section-divider" />
          <h2 className="section-title">Statement Summary &amp; Date Analysis</h2>

          <div className="stat-row">
            <div className="stat-card">
              <div className="label">Date Range Analyzed</div>
              <div className="value" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
                {parseResult.dateRange.from || '—'} to {parseResult.dateRange.to || '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Total Debits Identified</div>
              <div className="value" style={{ color: '#c0392b' }}>
                ₹{parseResult.totalDebit.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Expenses Extracted</div>
              <div className="value">{parseResult.transactions.length}</div>
            </div>
            <div className="stat-card">
              <div className="label">Selected for Import</div>
              <div className="value" style={{ color: '#2e6db4' }}>
                {selectedCount} (₹{Math.round(selectedTotal).toLocaleString()})
              </div>
            </div>
          </div>

          {/* Interactive Preview Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: '#444444' }}>
              Review parsed transactions below. You can change any category before saving.
            </div>
            <div>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
                onClick={() => handleSelectAll(true)}
              >
                Select All
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => handleSelectAll(false)}
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Import</th>
                  <th>Date (Normalized)</th>
                  <th>Narration / Particulars</th>
                  <th>Auto Category</th>
                  <th>Payment Mode</th>
                  <th>Amount (Debit)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={{ opacity: t.selected ? 1 : 0.5 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={() => handleToggleSelect(t.id)}
                        disabled={saving}
                      />
                    </td>
                    <td>{t.date}</td>
                    <td style={{ maxWidth: '280px', wordBreak: 'break-word' }}>
                      {t.description}
                    </td>
                    <td>
                      <select
                        value={t.category}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        style={{ padding: '3px 6px', fontSize: '12px', borderRadius: '2px' }}
                        disabled={saving || !t.selected}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td><span className="category-tag">{t.payment_mode}</span></td>
                    <td className="amount-expense">₹{t.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '14px', marginBottom: '24px' }}>
            <button
              className="btn-primary"
              onClick={handleImportToDatabase}
              disabled={saving || selectedCount === 0}
              style={{ fontSize: '14px', padding: '9px 24px' }}
            >
              {saving ? 'Importing to Account...' : `Save ${selectedCount} Transactions to Database`}
            </button>
          </div>
        </>
      )}

      {/* Security & Viva note */}
      <hr className="section-divider" />
      <div className="insight-box" style={{ maxWidth: '640px' }}>
        <h3 style={{ fontSize: '13px', color: '#555555' }}>🔒 Privacy &amp; Security Measures</h3>
        <ul style={{ fontSize: '12px', color: '#666666', lineHeight: '1.6', paddingLeft: '18px', margin: 0 }}>
          <li>Bank statement files are processed entirely in-browser (client-side) using strict input sanitization.</li>
          <li>Dangerous spreadsheet formula injection characters (=, +, -, @) are automatically stripped before database storage.</li>
          <li>Database inserts are bound strictly to your authenticated session via Supabase Row Level Security (RLS).</li>
        </ul>
      </div>
    </div>
  );
}

export default StatementImport;
