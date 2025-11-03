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
    if (cash_flows.length === 0 || cash_flows[0] >= 0) {
        const sumOfFutureFlows = cash_flows.slice(1).reduce((a, b) => a + b, 0);
        return (cash_flows[0] < 0 || sumOfFutureFlows > 0) ? Infinity : null;
    }

    let rate_low = -0.99; 
    let rate_high = 5.0;   
    let rate_mid;
    let npv;

    const npv_at_zero = calculateCashFlowNPV(cash_flows, 0);
    const npv_at_high = calculateCashFlowNPV(cash_flows, rate_high);

    if (npv_at_zero < 0) {
         if (npv_at_high < npv_at_zero) {
              rate_high = 0.0; 
         } 
    } else if (npv_at_high > 0) {
        rate_low = rate_high;  
        rate_high = 20.0;      
        
        const npv_at_very_high = calculateCashFlowNPV(cash_flows, rate_high);
        if (npv_at_very_high > 0) {
            return Infinity;
        }
    }

    for (let i = 0; i < max_iterations; i++) {
        rate_mid = (rate_low + rate_high) / 2;
        npv = calculateCashFlowNPV(cash_flows, rate_mid);

        if (Math.abs(npv) < tolerance) {
            return rate_mid; 
        } else if (npv > 0) {
            rate_low = rate_mid;
        } else {
            rate_high = rate_mid;
        }
    }
    return null;
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
    if (initialInvestment <= 0) return 0; 

    let cumulative_savings = 0;
    for (let i = 1; i <= years; i++) {
        if (i >= cash_flows.length) break; 

        const discounted_saving = cash_flows[i] / Math.pow(1 + rate, i);
        if (discounted_saving <= 0 && cumulative_savings < initialInvestment) {
            continue; 
        }

        if (cumulative_savings < initialInvestment) {
            const prev_cumulative = cumulative_savings;
            cumulative_savings += discounted_saving;

            if (cumulative_savings >= initialInvestment) {
                const needed = initialInvestment - prev_cumulative;
                if (discounted_saving === 0) {
                     if (needed === 0) return (i - 1); 
                     else continue; 
                }
                return (i - 1) + (needed / discounted_saving);
            }
        }
    }
    return null;
}


// --- 格式化工具 ---

export const fWan = (n) => (n / 10000).toFixed(2);
export const fTon = (n) => (n / 1000).toFixed(2);
export const fCop = (n) => (n).toFixed(2);
export const fPercent = (n, p = 1) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(p)} %`;
export const fYears = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)} 年`;
export const fNum = (n, p = 1) => (n === null || !isFinite(n) || n === 0) ? 'N/A' : n.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});
export const fInt = (n) => (n).toLocaleString(undefined, {maximumFractionDigits: 0});
export const fYuan = (n) => (n).toLocaleString(undefined, {maximumFractionDigits: 0});