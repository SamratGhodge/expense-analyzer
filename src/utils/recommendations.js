/**
 * recommendations.js
 * ------------------
 * Generates spending recommendations by comparing the current month's
 * category-wise spending against the user's historical average for
 * each category.
 *
 * Logic (for viva explanation):
 *   1. Group all transactions by category.
 *   2. For each category, compute the average monthly spend across all
 *      months that have data (total spend / number of distinct months).
 *   3. Compare the current month's spend to that average.
 *   4. If this month's spend exceeds the average by more than 20%,
 *      flag it with a recommendation tip.
 *
 * Threshold: 20% above historical average  →  "review this category"
 */

/**
 * Takes an array of transaction objects and the current year-month string
 * (e.g. "2026-08"), and returns an array of recommendation objects.
 *
 * Each recommendation: { category, currentSpend, avgSpend, percentAbove }
 *
 * @param {Array} transactions - all user transactions (each has .category, .amount, .date)
 * @param {string} currentMonth - "YYYY-MM" string for the month to evaluate
 * @returns {Array} recommendations for categories that are >20% above average
 */
export function generateRecommendations(transactions, currentMonth) {
  if (!transactions || transactions.length === 0) return [];

  // Step 1: Group spending by category and by month
  // Structure: { "Food": { "2026-05": 1200, "2026-06": 800, ... }, ... }
  const categoryMonthMap = {};

  for (const txn of transactions) {
    const cat = txn.category;
    const month = txn.date.slice(0, 7); // "YYYY-MM"
    const amount = Number(txn.amount);

    if (!categoryMonthMap[cat]) {
      categoryMonthMap[cat] = {};
    }
    if (!categoryMonthMap[cat][month]) {
      categoryMonthMap[cat][month] = 0;
    }
    categoryMonthMap[cat][month] += amount;
  }

  const recommendations = [];

  // Step 2: For each category, calculate historical monthly average
  // and compare with current month
  for (const category of Object.keys(categoryMonthMap)) {
    const monthlyTotals = categoryMonthMap[category];
    const currentSpend = monthlyTotals[currentMonth] || 0;

    // Get all months EXCEPT the current month for historical average
    const historicalMonths = Object.keys(monthlyTotals).filter(
      (m) => m !== currentMonth
    );

    // Need at least 1 month of history to compare against
    if (historicalMonths.length === 0) continue;

    // Step 3: Average = total historical spend / number of historical months
    const historicalTotal = historicalMonths.reduce(
      (sum, m) => sum + monthlyTotals[m],
      0
    );
    const avgSpend = historicalTotal / historicalMonths.length;

    // Avoid division by zero for categories with 0 historical average
    if (avgSpend === 0) continue;

    // Step 4: Check if current month exceeds average by >20%
    const percentAbove = ((currentSpend - avgSpend) / avgSpend) * 100;

    if (percentAbove > 20) {
      recommendations.push({
        category,
        currentSpend: Math.round(currentSpend),
        avgSpend: Math.round(avgSpend),
        percentAbove: Math.round(percentAbove),
      });
    }
  }

  // Sort by highest overspend first
  recommendations.sort((a, b) => b.percentAbove - a.percentAbove);

  return recommendations;
}
