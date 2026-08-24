/**
 * exportReport.js
 * ---------------
 * Utilities to export transactions to formatted CSV and trigger printable financial reports.
 */

import { sanitizeForCSV } from './security';

/**
 * Exports an array of transaction objects to a downloadable CSV file.
 * @param {Array} transactions - transaction records
 * @param {string} filename - output filename
 */
export function exportTransactionsToCSV(transactions, filename = 'expense_report.csv') {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to export.');
    return;
  }

  const headers = ['Date', 'Description', 'Category', 'Payment Mode', 'Amount (INR)'];
  const rows = transactions.map((t) => [
    t.date || t.txn_date || '',
    `"${sanitizeForCSV((t.description || '—').replace(/"/g, '""'))}"`,
    t.category || 'Other',
    t.payment_mode || 'Cash',
    Number(t.amount || 0).toFixed(2),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers browser print dialog with a cleanly styled financial report window
 * @param {Array} transactions - transaction records
 * @param {string} userEmail - account email
 * @param {string} dateRangeLabel - date range description
 */
export function printExpenseReport(transactions, userEmail = 'Student', dateRangeLabel = 'All Time') {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to print.');
    return;
  }

  const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Category breakdown
  const categoryTotals = {};
  for (const t of transactions) {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
  }

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to generate the printable report.');
    return;
  }

  const categoryRowsHTML = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd;">${cat}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 600;">₹${Math.round(amt).toLocaleString()}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; text-align: right;">${((amt / totalAmount) * 100).toFixed(1)}%</td>
      </tr>
    `)
    .join('');

  const transactionRowsHTML = transactions
    .map((t, idx) => `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${idx + 1}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${t.date || t.txn_date || ''}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${t.description || '—'}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${t.category}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${t.payment_mode || 'Cash'}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">₹${Number(t.amount).toLocaleString()}</td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Expense Summary Report — ${dateRangeLabel}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #222; font-size: 13px; line-height: 1.5; }
          h1 { font-size: 20px; color: #2e6db4; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          .summary-card { background: #f8f9fa; border: 1px solid #ddd; padding: 14px 18px; margin-bottom: 20px; border-radius: 4px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f2f2f2; text-align: left; padding: 8px 10px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #ccc; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
          <div>
            <h1>Expense Analyzer — Financial Report</h1>
            <div class="meta">Account: ${userEmail} | Filter Range: ${dateRangeLabel} | Generated: ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
          <button onclick="window.print()" style="background: #2e6db4; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; font-size: 13px;">Print / Save PDF</button>
        </div>

        <div class="summary-card">
          <div><strong>Total Expenses:</strong> ₹${Math.round(totalAmount).toLocaleString()}</div>
          <div><strong>Total Transactions:</strong> ${transactions.length}</div>
          <div><strong>Categories Active:</strong> ${Object.keys(categoryTotals).length}</div>
        </div>

        <h3 style="font-size: 14px; margin-bottom: 8px; color: #333;">Category Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
              <th style="text-align: right;">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRowsHTML}
          </tbody>
        </table>

        <h3 style="font-size: 14px; margin-bottom: 8px; color: #333;">Transaction Details</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Payment</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRowsHTML}
          </tbody>
        </table>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
