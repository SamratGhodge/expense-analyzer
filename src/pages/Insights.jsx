import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { generateRecommendations } from '../utils/recommendations';

function Insights() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (!error && data) {
        setTransactions(data);
      }
      setLoading(false);
    }
    fetchAll();
  }, [user.id]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ---- Build monthly totals ----
  const monthlyTotals = {};
  for (const t of transactions) {
    if (!t.date) continue;
    const m = t.date.slice(0, 7);
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(t.amount);
  }

  // ---- Category breakdown for current month ----
  const currentMonthTxns = transactions.filter(
    (t) => t.date && t.date.startsWith(currentMonthKey)
  );
  const categoryTotals = {};
  for (const t of currentMonthTxns) {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  }
  const categoryData = Object.entries(categoryTotals)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const maxCatAmount = categoryData.length > 0 ? categoryData[0].amount : 1;

  // ---- Top 5 expenses this month ----
  const topExpenses = [...currentMonthTxns]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  // ---- Monthly data for bar comparison (last 6 months) ----
  const monthlyBarData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short' });
    monthlyBarData.push({ month: label, key, total: Math.round(monthlyTotals[key] || 0) });
  }
  const maxMonthlyBar = Math.max(...monthlyBarData.map((m) => m.total), 1);

  // ===============================================================
  // PREDICTION: Weighted Moving Average (WMA) over last 3–6 months
  // ===============================================================
  //
  // Formula explanation (for viva):
  //
  //   Weighted Moving Average assigns higher weights to more recent
  //   months so the prediction reflects recent spending trends more
  //   than older ones.
  //
  //   Given the last N months with totals [M1, M2, ..., MN] where
  //   MN is the most recent month, the weights are [1, 2, 3, ..., N].
  //
  //   WMA = (1*M1 + 2*M2 + 3*M3 + ... + N*MN) / (1 + 2 + 3 + ... + N)
  //
  //   The denominator is the triangular number N*(N+1)/2.
  //
  //   Example with 3 months [5000, 6000, 7000]:
  //     WMA = (1*5000 + 2*6000 + 3*7000) / (1+2+3)
  //         = (5000 + 12000 + 21000) / 6
  //         = 38000 / 6
  //         = ₹6,333
  //
  //   This gives more importance to the most recent month (weight 3)
  //   compared to the oldest month (weight 1), making the prediction
  //   responsive to recent changes in spending behavior.
  //
  // Why WMA over SMA (Simple Moving Average)?
  //   SMA treats all months equally. If a student's spending has been
  //   increasing recently, SMA would underestimate the prediction.
  //   WMA captures the trend direction better.
  // ===============================================================

  // Collect month totals for the last 3-6 months (excluding current month)
  const predictionMonths = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyTotals[key] !== undefined) {
      predictionMonths.push(monthlyTotals[key]);
    }
  }

  let predictedAmount = null;
  let trendText = '';

  if (predictionMonths.length >= 2) {
    // Apply weighted moving average
    // Weights: oldest gets 1, newest gets N
    const n = predictionMonths.length;
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < n; i++) {
      const weight = i + 1; // 1 for oldest, N for newest
      weightedSum += weight * predictionMonths[i];
      weightTotal += weight;
    }
    predictedAmount = Math.round(weightedSum / weightTotal);

    // Determine trend by comparing the average of the first half vs second half
    const mid = Math.floor(n / 2);
    const firstHalfAvg =
      predictionMonths.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const secondHalfAvg =
      predictionMonths.slice(mid).reduce((s, v) => s + v, 0) / (n - mid);

    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    if (changePercent > 10) {
      trendText = 'Your spending has been increasing — the prediction is weighted towards recent higher months.';
    } else if (changePercent < -10) {
      trendText = 'Your spending has been decreasing — the prediction reflects your recent lower spending.';
    } else {
      trendText = 'Your spending has been relatively stable over the past few months.';
    }
  }

  // ---- Recommendations ----
  const recommendations = generateRecommendations(transactions, currentMonthKey);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Insights</h1>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Insights</h1>

      {transactions.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>
          No transaction data yet. Add transactions to see insights.
        </p>
      ) : (
        <>
          <div className="insight-grid">
            {/* Category breakdown */}
            <div className="insight-box">
              <h3>Expenses by Category (This Month)</h3>
              {categoryData.length === 0 ? (
                <p style={{ color: '#999', fontSize: '13px' }}>No data this month</p>
              ) : (
                categoryData.map((cat) => (
                  <div className="bar-chart-row" key={cat.name}>
                    <span className="bar-label">{cat.name}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(cat.amount / maxCatAmount) * 100}%` }}
                      ></div>
                    </div>
                    <span className="bar-value">₹{cat.amount.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            {/* Monthly totals bar chart */}
            <div className="insight-box">
              <h3>Monthly Spending (Last 6 Months)</h3>
              {monthlyBarData.map((m) => (
                <div className="bar-chart-row" key={m.key}>
                  <span className="bar-label">{m.month}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(m.total / maxMonthlyBar) * 100}%` }}
                    ></div>
                  </div>
                  <span className="bar-value">₹{m.total.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Top expenses */}
            <div className="insight-box">
              <h3>Top 5 Expenses This Month</h3>
              {topExpenses.length === 0 ? (
                <p style={{ color: '#999', fontSize: '13px' }}>No expenses this month</p>
              ) : (
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <tbody>
                    {topExpenses.map((item, i) => (
                      <tr key={item.id}>
                        <td style={{ padding: '6px 0', color: '#555' }}>
                          {i + 1}. {item.description || item.category}
                        </td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#c0392b' }}>
                          ₹{Number(item.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Prediction */}
            <div className="insight-box">
              <h3>Next Month Prediction (WMA)</h3>
              {predictedAmount !== null ? (
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#2e6db4', marginBottom: '8px' }}>
                    ₹{predictedAmount.toLocaleString()}
                  </div>
                  <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                    {trendText}
                  </p>
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                    Based on weighted moving average of last {predictionMonths.length} month(s).
                  </p>
                </div>
              ) : (
                <p style={{ color: '#999', fontSize: '13px' }}>
                  Need at least 2 months of data to predict next month's spending.
                </p>
              )}
            </div>
          </div>

          {/* Recommendations section */}
          <hr className="section-divider" />
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px', color: '#333' }}>
            Recommendations
          </h2>

          {recommendations.length === 0 ? (
            <div className="insight-box" style={{ maxWidth: '600px' }}>
              <p style={{ fontSize: '14px', color: '#555' }}>
                ✓ Your spending looks normal across all categories this month. No alerts.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: '600px' }}>
              {recommendations.map((rec) => (
                <div
                  key={rec.category}
                  className="recommendation-item"
                >
                  <strong>{rec.category}</strong> — You've spent ₹{rec.currentSpend.toLocaleString()} this
                  month, which is {rec.percentAbove}% above your monthly average of
                  ₹{rec.avgSpend.toLocaleString()}. Consider reviewing your {rec.category.toLowerCase()} expenses.
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Insights;
