// utils.js

/**
 * Calculates the Net Present Value (NPV) of a series of future costs.
 * @param {number} initialCost - The cost in Year 1.
 * @param {number} years - The number of years in the analysis period.
 * @param {number} discountRate - The discount rate (e.g., 0.08 for 8%).
 * @param {number} inflationRate - The annual inflation rate for this cost (e.g., 0.03 for 3%).
 * @returns {number} The total Net Present Value of the cost stream.
 */
export function calculateNPV(initialCost, years, discountRate, inflationRate) {
    let npv = 0;
     for (let n = 1; n <= years; n++) {
        const futureCost = initialCost * Math.pow(1 + inflationRate, n - 1);
        const presentValue = futureCost / Math.pow(1 + discountRate, n);
        npv += presentValue;
    }
    return npv;
}

/**
 * (ROI FUNCTION) Calculates the Net Present Value (NPV) of a cash flow stream.
 * @param {number[]} cash_flows - Array of cash flows [CF0, CF1, ..., CFN].
 * @param {number} rate - The discount rate.
 * @returns {number} The NPV of the cash flow.
 */
export function calculateCashFlowNPV(cash_flows, rate) {
    let npv = 0;
    for (let i = 0; i < cash_flows.length; i++) {
        npv += cash_flows[i] / Math.pow(1 + rate, i);
    }
    return npv;
}

/**
 * (ROI FUNCTION) Finds the Internal Rate of Return (IRR) using iteration.
 * @param {number[]} cash_flows - Array of cash flows [CF0, CF1, ..., CFN].
 * @param {number} [max_iterations=100] - Max iterations.
 * @param {number} [tolerance=1e-6] - Solution tolerance.
 * @returns {number|null} The IRR, or null if not found.
 */
export function findIRR(cash_flows, max_iterations = 100, tolerance = 1e-6) {
    // V10.0: Handle edge cases for IRR
    if (cash_flows.length === 0 || cash_flows[0] >= 0) {
        // If no investment, or investment is non-negative
        const sumOfFutureFlows = cash_flows.slice(1).reduce((a, b) => a + b, 0);
        // If all future flows are negative, IRR is -Infinity (null). If all are positive, Infinity.
        return (cash_flows[0] < 0 || sumOfFutureFlows > 0) ? Infinity : null;
    }

    let rate_low = -0.99; // Cannot be -100% or less
    let rate_high = 5.0;   // Start with a high guess (500%)
    let rate_mid;
    let npv;

    // Check if a solution is likely
    const npv_at_zero = calculateCashFlowNPV(cash_flows, 0);
    const npv_at_high = calculateCashFlowNPV(cash_flows, rate_high);

    if (npv_at_zero < 0) {
         // If NPV at 0% is already negative, IRR must be negative
         if (npv_at_high < npv_at_zero) {
              // And if it gets even more negative at 500%, the function is weird.
              // Let's check between -99% and 0%
              rate_high = 0.0; 
         } 
         // else: npv_at_high > npv_at_zero. This is normal. Solution is between 0 and 5.0 (but npv_at_zero is neg?)
         // This implies a non-standard cash flow. But we search between -0.99 and 5.0
    } else if (npv_at_high > 0) {
        // If NPV is still positive at 500%, try a much higher rate
        rate_low = rate_high;  // 5.0
        rate_high = 20.0;      // 2000%
        
        const npv_at_very_high = calculateCashFlowNPV(cash_flows, rate_high);
        if (npv_at_very_high > 0) {
            // Even at 2000%, it's positive. Likely infinite IRR.
            return Infinity;
        }
        // Now we have a bracket between 5.0 and 20.0
    }
    // Standard case: npv_at_zero > 0 and npv_at_high < 0. Bracket is [0, 5.0] or [-0.99, 5.0]

    for (let i = 0; i < max_iterations; i++) {
        rate_mid = (rate_low + rate_high) / 2;
        npv = calculateCashFlowNPV(cash_flows, rate_mid);

        if (Math.abs(npv) < tolerance) {
            return rate_mid; // Found solution
        } else if (npv > 0) {
            rate_low = rate_mid;
        } else {
            rate_high = rate_mid;
        }
    }
    return null; // No solution found
}

/**
 * (ROI FUNCTION) Calculates the Dynamic Payback Period (PBP).
 * @param {number[]} cash_flows - Array of cash flows [CF0, CF1, ..., CFN].
 * @param {number} rate - The discount rate.
 * @param {number} years - The project lifecycle length.
 * @returns {number|null} The Dynamic PBP in years, or null if not recovered.
 */
export function calculateDynamicPBP(cash_flows, rate, years) {
    const initialInvestment = -cash_flows[0];
    if (initialInvestment <= 0) return 0; // No investment, payback is 0

    let cumulative_savings = 0;
    for (let i = 1; i <= years; i++) {
        if (i >= cash_flows.length) break; // Reached end of cash flows

        const discounted_saving = cash_flows[i] / Math.pow(1 + rate, i);
        if (discounted_saving <= 0 && cumulative_savings < initialInvestment) {
            continue; // Ignore negative saving years if not yet paid back
        }

        if (cumulative_savings < initialInvestment) {
            const prev_cumulative = cumulative_savings;
            cumulative_savings += discounted_saving;

            if (cumulative_savings >= initialInvestment) {
                // Payback occurred this year (i)
                const needed = initialInvestment - prev_cumulative;
                if (discounted_saving === 0) {
                     // This should be rare, but if payback happens *exactly* on year (i-1)
                     if (needed === 0) return (i - 1); 
                     else continue; // Should not happen if needed > 0
                }
                return (i - 1) + (needed / discounted_saving);
            }
        }
    }
    return null; // Not paid back within the analysis period
}


// --- 格式化工具 ---

/** (万元) V10.0: (n / 10000).toFixed(2) */
export const fWan = (n) => (n / 10000).toFixed(2);

/** (万元) V11.0: (n).toLocaleString(..., 2) - 用于BOT模式的大额投资 (n 已经是万元) */
export const fInvest = (n, p = 2) => (n === null || !isFinite(n)) ? '0.00' : n.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});

/** (吨) */
export const fTon = (n) => (n / 1000).toFixed(2);

/** (COP) */
export const fCop = (n) => (n).toFixed(2);

/** (%) */
export const fPercent = (n, p = 1) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(p)} %`;

/** (年) */
export const fYears = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)} 年`;

/** (通用数字) */
export const fNum = (n, p = 1) => (n === null || !isFinite(n) || n === 0) ? 'N/A' : n.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});

/** (整数) */
export const fInt = (n) => (n).toLocaleString(undefined, {maximumFractionDigits: 0});

/** (元) */
export const fYuan = (n) => (n).toLocaleString(undefined, {maximumFractionDigits: 0});

