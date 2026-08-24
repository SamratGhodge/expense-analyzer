/**
 * statementParser.js
 * ------------------
 * Parses bank statements (CSV/TSV/Text) from Indian and international banks:
 *  - Multi-format date parser & normalizer to ISO (YYYY-MM-DD)
 *  - Automatic Debit / Withdrawal detection (filtering out credits/deposits)
 *  - Smart keyword-based expense categorization
 *  - Automatic payment mode detection (UPI, Card, NetBanking, ATM/Cash)
 */

// Keyword dictionaries for auto-categorization
const CATEGORY_KEYWORDS = {
  Food: [
    'swiggy', 'zomato', 'restaurant', 'cafe', 'mcdonald', 'kfc', 'starbucks',
    'domino', 'pizza', 'burger', 'food', 'bakery', 'tea', 'chai', 'coffee',
    'hotel', 'dhaba', 'zepto', 'blinkit', 'instamart', 'bigbasket', 'grocery',
    'supermarket', 'd-mart', 'dmart', 'reliance retail', 'fresh'
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'irctc', 'railway', 'metro', 'makemytrip',
    'yatra', 'redbus', 'bus', 'fuel', 'petrol', 'diesel', 'hpcl', 'bpcl',
    'iocl', 'indian oil', 'toll', 'fastag', 'parking', 'flight', 'indigo', 'air india'
  ],
  Bills: [
    'bescom', 'electricity', 'power', 'water', 'gas', 'indane', 'hp gas',
    'airtel', 'jio', 'vi ', 'vodafone', 'bsnl', 'broadband', 'act fibernet',
    'tatasky', 'dth', 'recharge', 'bill', 'insurance', 'lic', 'maintenance',
    'rent', 'wifi'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'zara', 'h&m',
    'clothing', 'apparel', 'retail', 'croma', 'reliance digital', 'store',
    'electronics', 'footwear', 'decathlon', 'shopee'
  ],
  Entertainment: [
    'netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'bookmyshow',
    'pvr', 'inox', 'cinema', 'theatre', 'movie', 'gaming', 'playstation',
    'steam', 'apple.com/bill', 'youtube'
  ]
};

/**
 * Infers category based on transaction description/narration
 * @param {string} text - Narration text
 * @returns {string} Inferred category (Food, Transport, Bills, Shopping, Entertainment, or Other)
 */
export function inferCategory(text) {
  if (!text) return 'Other';
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }
  return 'Other';
}

/**
 * Detects payment mode from narration
 * @param {string} text - Narration text
 * @returns {'UPI'|'Card'|'Cash'}
 */
export function inferPaymentMode(text) {
  if (!text) return 'Cash';
  const lower = text.toLowerCase();

  if (lower.includes('upi') || lower.includes('@') || lower.includes('vpa') || lower.includes('paytm') || lower.includes('gpay') || lower.includes('phonepe')) {
    return 'UPI';
  }
  if (lower.includes('pos') || lower.includes('e-com') || lower.includes('card') || lower.includes('visa') || lower.includes('mastercard') || lower.includes('debit card')) {
    return 'Card';
  }
  return 'Cash';
}

const MONTH_NAMES = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * Parses diverse bank date representations into ISO YYYY-MM-DD format
 * Supports:
 *   - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 *   - YYYY-MM-DD, YYYY/MM/DD
 *   - DD-Mon-YYYY, DD Mon YYYY, DD/Mon/YYYY (e.g. 15-Aug-2026, 04 Jan 2026)
 * @param {string} rawDate
 * @returns {string|null} ISO date string or null if unparseable
 */
export function parseBankDate(rawDate) {
  if (!rawDate) return null;
  const str = String(rawDate).trim();

  // Pattern 1: ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Pattern 2: DD-Mon-YYYY or DD Mon YYYY (e.g., 22-Aug-2026, 05/Sep/2026)
  const textMonthMatch = str.match(/^(\d{1,2})[-/.\s]+([a-zA-Z]{3,9})[-/.\s]+(\d{2,4})$/);
  if (textMonthMatch) {
    let [, d, monthStr, y] = textMonthMatch;
    const m = MONTH_NAMES[monthStr.toLowerCase().slice(0, 3)];
    if (m) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // Pattern 3: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) y = `20${y}`;
    // If month > 12, check if it's MM/DD format
    if (parseInt(m, 10) > 12 && parseInt(d, 10) <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parses raw CSV/TSV text into an array of rows and column headers
 * @param {string} text - Raw CSV content
 * @returns {Array<Array<string>>}
 */
export function parseCSVRows(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const rows = [];

  for (const line of lines) {
    // Determine separator: comma, tab, or semicolon
    let delimiter = ',';
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes(';') && !line.includes(',')) delimiter = ';';

    const row = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentCell.trim().replace(/^"|"$/g, ''));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim().replace(/^"|"$/g, ''));
    rows.push(row);
  }

  return rows;
}

/**
 * Main parser: takes a CSV/text file content and returns parsed transactions with metadata
 * @param {string} content - Raw statement file content
 * @returns {{ transactions: Array, totalDebit: number, dateRange: { from: string, to: string }, errors: Array }}
 */
export function parseBankStatement(content) {
  const rows = parseCSVRows(content);
  if (rows.length < 2) {
    throw new Error('File does not contain enough data or valid rows.');
  }

  // Find header row (look for keywords: date, txn, narration, particulars, debit, withdrawal, amount)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowStr = rows[i].map((c) => c.toLowerCase()).join(' ');
    if (
      (rowStr.includes('date') || rowStr.includes('txn')) &&
      (rowStr.includes('debit') || rowStr.includes('withdrawal') || rowStr.includes('amount') || rowStr.includes('particular') || rowStr.includes('description'))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0; // fallback to first row
  }

  const headers = rows[headerIndex].map((h) => h.toLowerCase().trim());

  // Identify column indices
  let dateCol = headers.findIndex((h) => h.includes('date') || h.includes('txn date') || h.includes('value date'));
  let descCol = headers.findIndex((h) => h.includes('narration') || h.includes('particular') || h.includes('description') || h.includes('details') || h.includes('remarks'));
  let debitCol = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('dr'));
  let creditCol = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || h.includes('cr'));
  let amountCol = headers.findIndex((h) => h.includes('amount') || h.includes('txn amount'));

  // Fallbacks if not explicitly identified
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1 < headers.length ? 1 : 0;
  if (debitCol === -1 && amountCol !== -1) debitCol = amountCol;

  const parsedTransactions = [];
  const errors = [];
  let totalDebit = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

    const rawDate = row[dateCol];
    const rawDesc = row[descCol] || 'Bank Transaction';

    let rawAmount = '';
    // Priority: Debit column first, or Amount column
    if (debitCol !== -1 && row[debitCol]) {
      rawAmount = row[debitCol];
    } else if (amountCol !== -1 && row[amountCol]) {
      rawAmount = row[amountCol];
    }

    // Skip if it's explicitly a Credit/Deposit row without a Debit
    if (creditCol !== -1 && row[creditCol] && !row[debitCol]) {
      continue; // Skip deposits/credits as we analyze expenses
    }

    // Clean numerical string (remove currency symbols, commas, Dr/Cr suffixes)
    const cleanedAmountStr = String(rawAmount)
      .replace(/[₹$,\s]/g, '')
      .replace(/dr|cr/gi, '')
      .trim();

    const amount = Math.abs(parseFloat(cleanedAmountStr));
    if (isNaN(amount) || amount <= 0) {
      continue; // Skip invalid or zero amounts
    }

    const isoDate = parseBankDate(rawDate);
    if (!isoDate) {
      errors.push(`Row ${i + 1}: Unrecognized date format "${rawDate}"`);
      continue;
    }

    const category = inferCategory(rawDesc);
    const paymentMode = inferPaymentMode(rawDesc);

    totalDebit += amount;
    parsedTransactions.push({
      id: `stmt-${i}-${Date.now()}`,
      date: isoDate,
      description: rawDesc.replace(/\s+/g, ' ').trim(),
      amount: Math.round(amount * 100) / 100,
      category,
      payment_mode: paymentMode,
      selected: true,
    });
  }

  // Calculate date boundaries
  let fromDate = '';
  let toDate = '';
  if (parsedTransactions.length > 0) {
    const dates = parsedTransactions.map((t) => t.date).sort();
    fromDate = dates[0];
    toDate = dates[dates.length - 1];
  }

  return {
    transactions: parsedTransactions,
    totalDebit: Math.round(totalDebit * 100) / 100,
    dateRange: { from: fromDate, to: toDate },
    errors,
  };
}
