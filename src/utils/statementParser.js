/**
 * statementParser.js
 * ------------------
 * Advanced, resilient parser for bank statements (CSV/TSV/Text)
 * Supporting SBI, HDFC, ICICI, Axis, Kotak, PayTM, generic formats:
 *  - Robust multi-format date extraction (ignores attached timestamps)
 *  - Handles Debit/Credit columns, Single Amount with Dr/Cr, or Type columns
 *  - Skips non-transaction metadata header banners
 *  - Smart keyword-based expense categorization
 *  - Automatic payment mode detection (UPI, Card, NetBanking, ATM/Cash)
 */

// Keyword dictionaries for auto-categorization
const CATEGORY_KEYWORDS = {
  Food: [
    'swiggy', 'zomato', 'restaurant', 'cafe', 'mcdonald', 'kfc', 'starbucks',
    'domino', 'pizza', 'burger', 'food', 'bakery', 'tea', 'chai', 'coffee',
    'hotel', 'dhaba', 'zepto', 'blinkit', 'instamart', 'bigbasket', 'grocery',
    'supermarket', 'd-mart', 'dmart', 'reliance retail', 'fresh', 'subway',
    'eats', 'barbeque', 'bakery', 'sweets', 'baker'
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'irctc', 'railway', 'metro', 'makemytrip',
    'yatra', 'redbus', 'bus', 'fuel', 'petrol', 'diesel', 'hpcl', 'bpcl',
    'iocl', 'indian oil', 'toll', 'fastag', 'parking', 'flight', 'indigo',
    'air india', 'spicejet', 'auto', 'cab', 'transport', 'train'
  ],
  Bills: [
    'bescom', 'electricity', 'power', 'water', 'gas', 'indane', 'hp gas',
    'airtel', 'jio', 'vi ', 'vodafone', 'bsnl', 'broadband', 'act fibernet',
    'tatasky', 'dth', 'recharge', 'bill', 'insurance', 'lic', 'maintenance',
    'rent', 'wifi', 'utility', 'utilities', 'postpaid', 'tneb', 'cesc'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'zara', 'h&m',
    'clothing', 'apparel', 'retail', 'croma', 'reliance digital', 'store',
    'electronics', 'footwear', 'decathlon', 'shopee', 'nykaa', 'trends',
    'max fashion', 'lifestyle', 'shop', 'mart', 'mall'
  ],
  Entertainment: [
    'netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'bookmyshow',
    'pvr', 'inox', 'cinema', 'theatre', 'movie', 'gaming', 'playstation',
    'steam', 'apple.com/bill', 'youtube', 'movies', 'gaana', 'wynk'
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

  if (
    lower.includes('upi') || lower.includes('@') || lower.includes('vpa') ||
    lower.includes('paytm') || lower.includes('gpay') || lower.includes('phonepe') ||
    lower.includes('googlepay') || lower.includes('bharatpe')
  ) {
    return 'UPI';
  }
  if (
    lower.includes('pos') || lower.includes('e-com') || lower.includes('card') ||
    lower.includes('visa') || lower.includes('mastercard') || lower.includes('debit card') ||
    lower.includes('credit card') || lower.includes('atm wdl') || lower.includes('rupay')
  ) {
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
 * Gracefully ignores timestamps, timezones, and various delimiter formats.
 * @param {string} rawDate
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null if unparseable
 */
export function parseBankDate(rawDate) {
  if (!rawDate) return null;
  // Clean string and strip any trailing timestamp (e.g. "24/08/2026 14:30:00" -> "24/08/2026")
  let str = String(rawDate).trim();
  str = str.replace(/T\d{2}:\d{2}:\d{2}.*$/i, '').trim(); // Remove ISO time
  str = str.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i, '').trim(); // Remove standard time
  str = str.replace(/^['"]|['"]$/g, '').trim();

  // Pattern 1: ISO format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (parseInt(m, 10) <= 12 && parseInt(d, 10) <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Pattern 2: DD-Mon-YYYY or DD Mon YYYY (e.g. 24-Aug-2026, 24 Aug 26, 05/Sep/2026)
  const textMonthMatch = str.match(/^(\d{1,2})[-/.\s]+([a-zA-Z]{3,9})[-/.\s]+(\d{2,4})/);
  if (textMonthMatch) {
    let [, d, monthStr, y] = textMonthMatch;
    const m = MONTH_NAMES[monthStr.toLowerCase().slice(0, 3)];
    if (m) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // Pattern 2b: Mon DD, YYYY or Month DD, YYYY (e.g. Aug 24, 2026)
  const monthFirstTextMatch = str.match(/^([a-zA-Z]{3,9})[-/.\s]+(\d{1,2})[,\s]+(\d{2,4})/);
  if (monthFirstTextMatch) {
    let [, monthStr, d, y] = monthFirstTextMatch;
    const m = MONTH_NAMES[monthStr.toLowerCase().slice(0, 3)];
    if (m) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // Pattern 3: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or MM/DD/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    let [, p1, p2, y] = dmyMatch;
    if (y.length === 2) y = `20${y}`;

    let d = p1;
    let m = p2;

    // Check if month > 12 -> then p1 was month and p2 was date
    if (parseInt(p2, 10) > 12 && parseInt(p1, 10) <= 12) {
      m = p1;
      d = p2;
    }

    if (parseInt(m, 10) <= 12 && parseInt(d, 10) <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Parses raw CSV/TSV text into an array of rows and column cells
 * @param {string} text - Raw CSV content
 * @returns {Array<Array<string>>}
 */
export function parseCSVRows(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const rows = [];

  for (const line of lines) {
    // Determine delimiter: comma, tab, or semicolon
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
 * Extracts a numeric debit amount from an amount cell or handles CR/DR indicators
 * @param {string} rawAmount
 * @param {string} rawType
 * @returns {{ isDebit: boolean, amount: number }}
 */
function extractAmount(rawAmount, rawType = '') {
  if (!rawAmount) return { isDebit: false, amount: 0 };

  const str = String(rawAmount).trim().toLowerCase();
  const typeStr = String(rawType).trim().toLowerCase();

  // Explicit check if type is Credit/Deposit
  if (typeStr.includes('cr') || typeStr.includes('credit') || typeStr.includes('deposit')) {
    return { isDebit: false, amount: 0 };
  }

  // Explicit check if amount has (Cr) or ends with Cr
  if (str.includes('cr') || str.includes('credit')) {
    return { isDebit: false, amount: 0 };
  }

  // Check if explicitly marked as Debit/Dr or negative number
  const isExplicitDr = str.includes('dr') || str.includes('debit') || str.includes('-') || str.includes('(') || typeStr.includes('dr') || typeStr.includes('debit');

  const cleaned = str
    .replace(/[₹$,\s()]/g, '')
    .replace(/dr|cr/gi, '')
    .trim();

  const num = Math.abs(parseFloat(cleaned));
  if (isNaN(num) || num <= 0) {
    return { isDebit: false, amount: 0 };
  }

  return { isDebit: true, amount: num, isExplicitDr };
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

  // Scan up to the first 50 rows to locate the header row
  let headerIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i].map((c) => c.toLowerCase().trim());
    const rowStr = row.join(' ');

    let score = 0;
    if (rowStr.includes('date') || rowStr.includes('txn') || rowStr.includes('value dt') || rowStr.includes('trans')) score += 3;
    if (rowStr.includes('narration') || rowStr.includes('particular') || rowStr.includes('description') || rowStr.includes('remark') || rowStr.includes('detail')) score += 3;
    if (rowStr.includes('debit') || rowStr.includes('withdrawal') || rowStr.includes('dr') || rowStr.includes('paid out')) score += 3;
    if (rowStr.includes('credit') || rowStr.includes('deposit') || rowStr.includes('cr') || rowStr.includes('paid in')) score += 2;
    if (rowStr.includes('amount') || rowStr.includes('balance') || rowStr.includes('sum')) score += 2;

    if (score > bestScore && score >= 5) {
      bestScore = score;
      headerIndex = i;
    }
  }

  // Fallback to row 0 if no score >= 5
  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const headers = rows[headerIndex].map((h) => h.toLowerCase().trim());

  // Identify column indices based on header names
  let dateCol = headers.findIndex((h) =>
    h === 'date' || h.includes('txn date') || h.includes('transaction date') || h.includes('value date') || h.includes('posting date') || h.includes('trans date') || h.includes('date')
  );

  let descCol = headers.findIndex((h) =>
    h.includes('narration') || h.includes('particular') || h.includes('description') || h.includes('details') || h.includes('remarks') || h.includes('payee') || h.includes('memo')
  );

  let debitCol = headers.findIndex((h) =>
    h.includes('debit') || h.includes('withdrawal') || h.includes('dr.') || h === 'dr' || h.includes('dr amount') || h.includes('paid out') || h.includes('withdrawal amt')
  );

  let creditCol = headers.findIndex((h) =>
    h.includes('credit') || h.includes('deposit') || h.includes('cr.') || h === 'cr' || h.includes('cr amount') || h.includes('paid in') || h.includes('deposit amt')
  );

  let typeCol = headers.findIndex((h) =>
    h === 'type' || h.includes('txn type') || h.includes('dr/cr') || h.includes('cr/dr') || h.includes('entry type')
  );

  let amountCol = headers.findIndex((h) =>
    h === 'amount' || h.includes('txn amount') || h.includes('transaction amount') || h.includes('amount (inr)') || h.includes('net amount')
  );

  // Fallback column positions if not explicitly named
  if (dateCol === -1) {
    // Look for first column in data rows that contains dates
    for (let c = 0; c < (rows[headerIndex + 1]?.length || 0); c++) {
      if (parseBankDate(rows[headerIndex + 1]?.[c])) {
        dateCol = c;
        break;
      }
    }
    if (dateCol === -1) dateCol = 0;
  }

  if (descCol === -1) {
    descCol = dateCol === 0 ? 1 : 0;
  }

  if (debitCol === -1 && amountCol !== -1) {
    debitCol = amountCol;
  }

  const parsedTransactions = [];
  const errors = [];
  let totalDebit = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c || !c.trim())) continue;

    // Try finding date in expected column, or scan across the row
    let rawDate = row[dateCol];
    let isoDate = parseBankDate(rawDate);

    if (!isoDate) {
      // Secondary check across other columns in this row
      for (let c = 0; c < row.length; c++) {
        const candidate = parseBankDate(row[c]);
        if (candidate) {
          isoDate = candidate;
          break;
        }
      }
    }

    if (!isoDate) {
      continue; // Skip summary rows, bank address lines, empty entries
    }

    const rawDesc = row[descCol] || 'Bank Expense';
    const rawType = typeCol !== -1 ? row[typeCol] : '';

    let debitAmount = 0;

    if (debitCol !== -1 && row[debitCol]) {
      const debitRes = extractAmount(row[debitCol], rawType);
      if (debitRes.isDebit) {
        debitAmount = debitRes.amount;
      }
    } else if (amountCol !== -1 && row[amountCol]) {
      const amtRes = extractAmount(row[amountCol], rawType);
      if (amtRes.isDebit) {
        debitAmount = amtRes.amount;
      }
    } else {
      // Search columns for any numeric value that isn't the date or balance
      for (let c = 0; c < row.length; c++) {
        if (c === dateCol || c === descCol || c === creditCol) continue;
        const testRes = extractAmount(row[c], rawType);
        if (testRes.isDebit && testRes.amount > 0) {
          debitAmount = testRes.amount;
          break;
        }
      }
    }

    // Skip if no valid debit expense was found
    if (debitAmount <= 0) {
      continue;
    }

    const category = inferCategory(rawDesc);
    const paymentMode = inferPaymentMode(rawDesc);

    totalDebit += debitAmount;
    parsedTransactions.push({
      id: `stmt-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: isoDate,
      description: rawDesc.replace(/\s+/g, ' ').trim(),
      amount: Math.round(debitAmount * 100) / 100,
      category,
      payment_mode: paymentMode,
      selected: true,
    });
  }

  // Sort chronologically by date
  parsedTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Determine date boundaries
  let fromDate = '';
  let toDate = '';
  if (parsedTransactions.length > 0) {
    fromDate = parsedTransactions[0].date;
    toDate = parsedTransactions[parsedTransactions.length - 1].date;
  }

  return {
    transactions: parsedTransactions,
    totalDebit: Math.round(totalDebit * 100) / 100,
    dateRange: { from: fromDate, to: toDate },
    errors,
  };
}
