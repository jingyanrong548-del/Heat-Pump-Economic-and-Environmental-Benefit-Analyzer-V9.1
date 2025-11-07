// core-calculator.js
import { calculateNPV, calculateCashFlowNPV, findIRR, calculateDynamicPBP } from './utils.js';

// --- V11.0: 主计算路由 ---

/**
 * 运行核心分析 (V11.0 路由)
 * @param {object} inputs - 从 ui-setup.js 读取的完整输入对象
 * @returns {object} 包含所有计算结果的 results 对象
 */
export function runAnalysis(inputs) {
    const { analysisMode } = inputs;
    
    // 1. (所有模式通用) 计算基础数据
    const lccParams = { 
        lccYears: inputs.lccYears, 
        discountRate: inputs.discountRate, 
        energyInflationRate: inputs.energyInflationRate, 
        opexInflationRate: inputs.opexInflationRate 
    };
    
    // **** 修改 (需求 3): 不再此处计算热量，而是直接从 inputs 对象获取 (由 ui-setup.js 负责计算) ****
    // const annualHeatingDemandKWh = inputs.heatingLoad * inputs.operatingHours; // <-- 旧代码
    const { annualHeatingDemandKWh } = inputs; // <-- 新代码
    // **** 修复结束 ****

    // 2. (V11.0 优化: 电价计算逻辑已移至成本对比模式)
    
    // 3. 根据模式路由到不同的分析函数
    if (analysisMode === 'bot') {
        // --- V11.0: BOT 盈利模式分析 ---
        // V11.0 优化：直接使用BOT专属的手动输入成本，不再依赖模式一的计算
        return runBotFinancialAnalysis(
            inputs, 
            lccParams, 
            inputs.botAnnualEnergyCost, 
            inputs.botAnnualOpexCost
        );
    } else {
        // --- V10.0: 成本对比模式分析 ---
        
        // V11.0 优化：将电费计算逻辑移至此处，仅在成本对比模式下执行
        const totalHpElec_FullLoad = (inputs.hpCop > 0) ? (annualHeatingDemandKWh / inputs.hpCop) : 0;
        let hpEnergyCost_FullLoad = 0;
        const hpEnergyCostDetails_FullLoad = { tiers: [] };
        
        inputs.priceTiers.forEach(tier => {
            const dist_f = tier.dist / 100;
            const elec_n = totalHpElec_FullLoad * dist_f;
            const cost_n = elec_n * tier.price;
            hpEnergyCost_FullLoad += cost_n;
            hpEnergyCostDetails_FullLoad.tiers.push({ name: tier.name, elec: elec_n, price: tier.price, cost: cost_n });
        });
        
        let weightedAvgElecPrice = 0;
        if (totalHpElec_FullLoad > 0) {
            weightedAvgElecPrice = hpEnergyCost_FullLoad / totalHpElec_FullLoad;
        } else if (inputs.priceTiers.length > 0) {
            // 如果没有电耗（例如 SPF 为 0），则按比例计算加权平均价
            let totalWeight = 0;
            inputs.priceTiers.forEach(t => { weightedAvgElecPrice += t.price * t.dist; totalWeight += t.dist; });
            if (totalWeight > 0) weightedAvgElecPrice = weightedAvgElecPrice / totalWeight;
            else if (inputs.priceTiers.length === 1) weightedAvgElecPrice = inputs.priceTiers[0].price;
        }
        
        // V11.0 BUGFIX v2: 必须将 totalHpElec_FullLoad 也传递下去
        return runCostComparisonAnalysis(inputs, lccParams, weightedAvgElecPrice, hpEnergyCost_FullLoad, hpEnergyCostDetails_FullLoad, annualHeatingDemandKWh, analysisMode, totalHpElec_FullLoad);
    }
}


// --- V11.0: 模式三 (BOT 盈利分析) ---

/**
 * V11.0: 运行 BOT 模式财务分析
 * @param {object} inputs 
 * @param {object} lccParams 
 * @param {number} botEnergyCost_Year1 (第1年的能源成本, 来自新输入框)
 * @param {number} botOpexCost_Year1 (第1年的运维成本, 来自新输入框)
 * @returns {object} BOT 分析结果
 */
function runBotFinancialAnalysis(inputs, lccParams, botEnergyCost_Year1, botOpexCost_Year1) {
    const { lccYears, discountRate, energyInflationRate, opexInflationRate } = lccParams;
    
    // 1. 投资估算 (V11.0: 单位为元)
    const totalInvestment = inputs.hpHostCapex + inputs.hpStorageCapex;
    const equity = totalInvestment * inputs.botEquityRatio; // 资本金
    const loan = totalInvestment - equity; // 贷款
    const salvageValue = totalInvestment * inputs.hpSalvageRate; // 残值 (未折现)

    // 2. 构建年度现金流表
    const cashFlows = {
        years: [],
        revenue: [], // 年销售收入 (含税)
        vat: [], // 增值税
        revenueNetVat: [], // 营业收入 (不含税)
        surtax: [], // 附加税
        energyCost: [], // 能源成本
        opexCost: [], // 运维成本
        depreciation: [], // 折旧
        interest: [], // 利息
        totalCost: [], // 总成本
        profitBeforeTax: [], // 利润总额
        incomeTax: [], // 所得税
        netProfit: [], // 净利润
        // -- 用于 IRR 计算 --
        cf_TotalInvestment: [], // 全投资现金流
        cf_Equity: [], // 资本金现金流
    };
    
    const annualPrincipalRepayment = (inputs.botDepreciationYears > 0) ? (loan / inputs.botDepreciationYears) : 0; // V11.0: 假设贷款期 = 折旧期
    
    for (let n = 1; n <= lccYears; n++) {
        cashFlows.years.push(n);
        
        // --- 收入 ---
        const revenue = inputs.botAnnualRevenue; // V11.0: 假设收入不增长
        const revenueNetVat = revenue / (1 + inputs.botVatRate);
        const vat = revenue - revenueNetVat;
        
        // --- 成本 ---
        const surtax = vat * inputs.botSurtaxRate;
        // V11.0: 成本计入通胀
        // **** 代码修改开始 ****
        const energyCost = botEnergyCost_Year1 * Math.pow(1 + energyInflationRate, n - 1); // 使用新的独立输入
        const opexCost = botOpexCost_Year1 * Math.pow(1 + opexInflationRate, n - 1); // 使用新的独立输入
        // **** 代码修改结束 ****
        
        // 折旧 (直线法)
        const depreciation = (n <= inputs.botDepreciationYears) ? ((totalInvestment * (1 - inputs.hpSalvageRate)) / inputs.botDepreciationYears) : 0; // V11.0: 修正为 (总投资-净残值)/年限
        
        // 利息 (等额本金)
        let interest = 0;
        if (n <= inputs.botDepreciationYears) { // 假设贷款期 = 折旧期
            const outstandingLoan = loan - (annualPrincipalRepayment * (n - 1));
            interest = outstandingLoan * inputs.botLoanInterestRate;
        }
        
        const totalCost = energyCost + opexCost + depreciation + interest + surtax;
        
        // --- 利润 ---
        const profitBeforeTax = revenueNetVat - totalCost;
        const incomeTax = Math.max(0, profitBeforeTax) * inputs.botIncomeTaxRate;
        const netProfit = profitBeforeTax - incomeTax;
        
        // --- 存入数组 ---
        cashFlows.revenue.push(revenue);
        cashFlows.vat.push(vat);
        cashFlows.revenueNetVat.push(revenueNetVat);
        cashFlows.surtax.push(surtax);
        cashFlows.energyCost.push(energyCost);
        cashFlows.opexCost.push(opexCost);
        cashFlows.depreciation.push(depreciation);
        cashFlows.interest.push(interest);
        cashFlows.totalCost.push(totalCost);
        cashFlows.profitBeforeTax.push(profitBeforeTax);
        cashFlows.incomeTax.push(incomeTax);
        cashFlows.netProfit.push(netProfit);
        
        // --- 构建IRR现金流 ---
        
        // V11.0 BUGFIX v3: 修正全投资现金流 (FCFF) 计算
        // 旧公式: let cf_total_n = netProfit + depreciation + interest; (错误)
        // 新公式 (FCFF): NOPAT + Depreciation
        // NOPAT = (利润总额 + 利息) * (1 - 所得税率)
        const EBIT = profitBeforeTax + interest; // 息税前利润
        const NOPAT = EBIT * (1 - inputs.botIncomeTaxRate); // 税后净营业利润
        let cf_total_n = NOPAT + depreciation;
        
        // 资本金现金流 (CFE) = 净利润 + 折旧 - 本金偿还
        let principalRepayment_n = (n <= inputs.botDepreciationYears) ? annualPrincipalRepayment : 0;
        let cf_equity_n = netProfit + depreciation - principalRepayment_n;

        if (n === lccYears) {
            cf_total_n += salvageValue; // 回收残值
            cf_equity_n += salvageValue; // 回收残值
        }
        
        cashFlows.cf_TotalInvestment.push(cf_total_n);
        cashFlows.cf_Equity.push(cf_equity_n);
    }
    
    // 3. 汇总计算
    
    // 准备带 Year 0 (投资) 的现金流
    const cf_Total_Stream = [-totalInvestment, ...cashFlows.cf_TotalInvestment];
    const cf_Equity_Stream = [-equity, ...cashFlows.cf_Equity];

    const summary = {
        investment: totalInvestment / 10000, // 万元
        equity: equity / 10000, // 万元
        loan: loan / 10000, // 万元
        irr: findIRR(cf_Total_Stream),
        npv: calculateCashFlowNPV(cf_Total_Stream, discountRate) / 10000, // 万元
        pbp: calculateDynamicPBP(cf_Total_Stream, discountRate, lccYears),
        equityIRR: findIRR(cf_Equity_Stream),
        equityNPV: calculateCashFlowNPV(cf_Equity_Stream, discountRate) / 10000, // 万元
        equityPBP: calculateDynamicPBP(cf_Equity_Stream, discountRate, lccYears),
    };

    // 4. 计算年均值 (用于详情显示)
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => (arr.length > 0) ? (sum(arr) / arr.length / 10000) : 0; // 万元
    
    const annualAvg = {
        revenue: avg(cashFlows.revenue),
        vat: avg(cashFlows.vat),
        revenueNetVat: avg(cashFlows.revenueNetVat),
        surtax: avg(cashFlows.surtax),
        energyCost: avg(cashFlows.energyCost),
        opexCost: avg(cashFlows.opexCost),
        depreciation: avg(cashFlows.depreciation),
        interest: avg(cashFlows.interest),
        totalCost: avg(cashFlows.totalCost),
        profitBeforeTax: avg(cashFlows.profitBeforeTax),
        incomeTax: avg(cashFlows.incomeTax),
        netProfit: avg(cashFlows.netProfit),
    };

    // 5. 返回结果
    return {
        analysisMode: 'bot',
        inputs: inputs, // 保存原始输入
        lccParams: lccParams,
        botAnalysis: {
            summary: summary,
            annualAvg: annualAvg,
            cashFlows: cashFlows // 供未来详细报表使用
        }
    };
}


// --- V11.0: 模式一/二 (成本对比分析, 原 V10.0 逻辑) ---

/**
 * V11.0: (原 V10.0 runAnalysis) 运行成本对比 (标准/混合) 分析
 * @param {object} inputs 
 * @param {object} lccParams 
 * @param {number} weightedAvgElecPrice 
 * @param {number} hpEnergyCost_FullLoad 
 * @param {object} hpEnergyCostDetails_FullLoad 
 * @param {number} annualHeatingDemandKWh 
 * @param {string} analysisMode - V11.0 BUGFIX: 显式传入 analysisMode ('standard' or 'hybrid')
 * @param {number} totalHpElec_FullLoad - V11.0 BUGFIX v2: 传入总电耗
 * @returns {object} 成本对比分析结果
 */
function runCostComparisonAnalysis(inputs, lccParams, weightedAvgElecPrice, hpEnergyCost_FullLoad, hpEnergyCostDetails_FullLoad, annualHeatingDemandKWh, analysisMode, totalHpElec_FullLoad) { // V11.0 BUGFIX v2: 接收 totalHpElec_FullLoad
    
    const results = {}; // 这是将返回的总结果对象
    // V11.0: 从 inputs 中解构 priceTiers, isHybridMode, gridFactor
    const { 
        lccYears, discountRate, energyInflationRate, opexInflationRate, priceTiers, 
        isHybridMode, gridFactor 
    } = inputs;
    
    results.inputs = inputs; // 保存原始输入
    results.lccParams = lccParams;
    results.isHybridMode = isHybridMode;
    results.annualHeatingDemandKWh = annualHeatingDemandKWh;
    results.weightedAvgElecPrice = weightedAvgElecPrice;

    // **** 新增 (需求 2): 定义 1 吨蒸汽折算的热量 (kWh) ****
    const STEAM_KWH_PER_TON = 700;
    
    // --- (V10.0) 逻辑分支: 计算 "方案 A" ---
    let hpSystemDetails; 
    const hpTotalCapex = inputs.hpHostCapex + inputs.hpStorageCapex;

    if (isHybridMode) {
        // --- H-1. 拆分热负荷 ---
        const { hybridLoadShare, hybridAuxHeaterType, hybridAuxHeaterCapex, hybridAuxHeaterOpex } = inputs;
        results.hybridInputs = { hybridLoadShare, hybridAuxHeaterType, hybridAuxHeaterCapex, hybridAuxHeaterOpex };
        
        const hpHeatingDemandKWh = annualHeatingDemandKWh * hybridLoadShare;
        const auxHeatingDemandKWh = annualHeatingDemandKWh * (1.0 - hybridLoadShare);

        // --- H-2: 计算工业热泵部分 ---
        const totalHpElec_Hybrid = (inputs.hpCop > 0) ? (hpHeatingDemandKWh / inputs.hpCop) : 0;
        let hpEnergyCost_Hybrid = 0;
        const hpEnergyCostDetails_Hybrid = { tiers: [] };
        priceTiers.forEach(tier => {
            const dist_f = tier.dist / 100;
            const elec_n = totalHpElec_Hybrid * dist_f;
            const cost_n = elec_n * tier.price;
            hpEnergyCost_Hybrid += cost_n;
            hpEnergyCostDetails_Hybrid.tiers.push({ name: tier.name, elec: elec_n, price: tier.price, cost: cost_n });
        });
        const hpOpex_Year1_Hybrid = hpEnergyCost_Hybrid + inputs.hpOpexCost;
        const hpCo2_Hybrid = totalHpElec_Hybrid * gridFactor;
        
        const hpEnergyNPV_Hybrid = calculateNPV(hpEnergyCost_Hybrid, lccYears, discountRate, energyInflationRate);
        const hpOpexNPV_Hybrid = calculateNPV(inputs.hpOpexCost, lccYears, discountRate, opexInflationRate);
        
        const hpSalvageValue_Undiscounted = hpTotalCapex * inputs.hpSalvageRate;
        const hpSalvageNPV_Hybrid = hpSalvageValue_Undiscounted / Math.pow(1 + discountRate, lccYears);
        const hpLCC_Hybrid = hpTotalCapex + hpEnergyNPV_Hybrid + hpOpexNPV_Hybrid - hpSalvageNPV_Hybrid;

        const hpDetails = {
            isHybridPart: true,
            name: "工业热泵 (混合)", // V11.0: 确保有 name
            energyCost: hpEnergyCost_Hybrid, energyCostDetails: hpEnergyCostDetails_Hybrid,
            opexCost: inputs.hpOpexCost, opex: hpOpex_Year1_Hybrid, co2: hpCo2_Hybrid,
            lcc: {
                capex: hpTotalCapex, capex_host: inputs.hpHostCapex, capex_storage: inputs.hpStorageCapex,
                energyNPV: hpEnergyNPV_Hybrid, opexNPV: hpOpexNPV_Hybrid,
                salvageRate: inputs.hpSalvageRate, salvageNPV: hpSalvageNPV_Hybrid,
                salvageValue: hpSalvageValue_Undiscounted, total: hpLCC_Hybrid
            }
        };
        results.hp = hpDetails;
        
        // --- H-3: 计算辅助热源部分 ---
        const auxDetails = calculateBoilerDetails(
            hybridAuxHeaterType, auxHeatingDemandKWh, hybridAuxHeaterCapex, hybridAuxHeaterOpex, 
            lccParams, inputs, gridFactor, weightedAvgElecPrice
        );
        results.hybrid_aux = auxDetails; 

        // --- H-4: 汇总混合系统 (方案 A) ---
        
        // **** 新增 (需求 2): 折算吨蒸汽 ****
        const total_steam_equivalent_hybrid = (annualHeatingDemandKWh > 0) ? (annualHeatingDemandKWh / STEAM_KWH_PER_TON) : 0;
        
        const hybridSystem = {
            isHybrid: true,
            name: "混合系统 (工业热泵 + " + auxDetails.name + ")",
            energyCost: hpDetails.energyCost + auxDetails.energyCost,
            opexCost: hpDetails.opexCost + auxDetails.opexCost,
            opex: hpDetails.opex + auxDetails.opex, 
            co2: hpDetails.co2 + auxDetails.co2,
            cost_per_kwh_heat: annualHeatingDemandKWh > 0 ? ((hpDetails.energyCost + auxDetails.energyCost) / annualHeatingDemandKWh) : 0,
            
            // **** 新增 (需求 2): 折算吨蒸汽指标 ****
            // (电耗仅计热泵部分，成本计混合总成本)
            electricity_per_steam_ton: (total_steam_equivalent_hybrid > 0) ? totalHpElec_Hybrid / total_steam_equivalent_hybrid : 0,
            cost_per_steam_ton: (total_steam_equivalent_hybrid > 0) ? (hpDetails.energyCost + auxDetails.energyCost) / total_steam_equivalent_hybrid : 0,
            // **** 修复结束 ****

            lcc: {
                capex: hpDetails.lcc.capex + auxDetails.lcc.capex,
                capex_host: hpDetails.lcc.capex_host,
                capex_storage: hpDetails.lcc.capex_storage,
                capex_aux: auxDetails.lcc.capex,
                energyNPV: hpDetails.lcc.energyNPV + auxDetails.lcc.energyNPV,
                opexNPV: hpDetails.lcc.opexNPV + auxDetails.lcc.opexNPV,
                salvageNPV: hpDetails.lcc.salvageNPV + auxDetails.lcc.salvageNPV,
                salvageValue: hpDetails.lcc.salvageValue + auxDetails.lcc.salvageValue,
                total: hpDetails.lcc.total + auxDetails.lcc.total
            }
        };
        results.hybridSystem = hybridSystem;
        hpSystemDetails = hybridSystem; // 赋给统一的 "方案 A" 实体

    } else {
        // --- S-1. 计算 100% 工业热泵方案 (方案A) ---
        const hpOpex_Year1 = hpEnergyCost_FullLoad + inputs.hpOpexCost;
        // V11.0 BUGFIX v2: totalHpElec_FullLoad 现在已定义
        const hpCo2 = totalHpElec_FullLoad * gridFactor; 
        
        const hpEnergyNPV = calculateNPV(hpEnergyCost_FullLoad, lccYears, discountRate, energyInflationRate);
        const hpOpexNPV = calculateNPV(inputs.hpOpexCost, lccYears, discountRate, opexInflationRate);
        
        const hpSalvageValue_Undiscounted = hpTotalCapex * inputs.hpSalvageRate;
        const hpSalvageNPV = hpSalvageValue_Undiscounted / Math.pow(1 + discountRate, lccYears);
        const hpLCC = hpTotalCapex + hpEnergyNPV + hpOpexNPV - hpSalvageNPV;

        // **** 新增 (需求 2): 折算吨蒸汽 ****
        const total_steam_equivalent = (annualHeatingDemandKWh > 0) ? (annualHeatingDemandKWh / STEAM_KWH_PER_TON) : 0;
        
        const hpDetails = {
            isHybrid: false,
            name: "工业热泵系统", // V11.0: 确保有 name
            energyCost: hpEnergyCost_FullLoad, energyCostDetails: hpEnergyCostDetails_FullLoad,
            opexCost: inputs.hpOpexCost, opex: hpOpex_Year1, co2: hpCo2,
            cost_per_kwh_heat: (inputs.hpCop > 0) ? (weightedAvgElecPrice / inputs.hpCop) : 0, 
            
            // **** 新增 (需求 2): 折算吨蒸汽指标 ****
            electricity_per_steam_ton: (total_steam_equivalent > 0) ? totalHpElec_FullLoad / total_steam_equivalent : 0, // 吨蒸汽电耗
            cost_per_steam_ton: (total_steam_equivalent > 0) ? hpEnergyCost_FullLoad / total_steam_equivalent : 0, // 吨蒸汽电费
            // **** 修复结束 ****

            lcc: {
                capex: hpTotalCapex, capex_host: inputs.hpHostCapex, capex_storage: inputs.hpStorageCapex,
                energyNPV: hpEnergyNPV, opexNPV: hpOpexNPV,
                salvageRate: inputs.hpSalvageRate, salvageNPV: hpSalvageNPV,
                salvageValue: hpSalvageValue_Undiscounted, total: hpLCC
            }
        };
        results.hp = hpDetails;
        hpSystemDetails = hpDetails; // 赋给统一的 "方案 A" 实体
    }

    // --- (V10.0) 循环计算所有 "方案 B" (对比基准) ---
    const comparisons = [];
    
    if (inputs.compare.gas) {
        const gasDetails = calculateBoilerDetails('gas', annualHeatingDemandKWh, inputs.gasBoilerCapex, inputs.gasOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.gas = gasDetails;
        comparisons.push(gasDetails);
    }
    if (inputs.compare.fuel) {
        const fuelDetails = calculateBoilerDetails('fuel', annualHeatingDemandKWh, inputs.fuelBoilerCapex, inputs.fuelOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.fuel = fuelDetails;
        comparisons.push(fuelDetails);
    }
    if (inputs.compare.coal) {
        const coalDetails = calculateBoilerDetails('coal', annualHeatingDemandKWh, inputs.coalBoilerCapex, inputs.coalOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.coal = coalDetails;
        comparisons.push(coalDetails);
    }
    if (inputs.compare.biomass) {
        const biomassDetails = calculateBoilerDetails('biomass', annualHeatingDemandKWh, inputs.biomassBoilerCapex, inputs.biomassOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.biomass = biomassDetails;
        comparisons.push(biomassDetails);
    }
    if (inputs.compare.electric) {
        const electricDetails = calculateBoilerDetails('electric', annualHeatingDemandKWh, inputs.electricBoilerCapex, inputs.electricOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.electric = electricDetails;
        comparisons.push(electricDetails);
    }
    if (inputs.compare.steam) {
        const steamDetails = calculateBoilerDetails('steam', annualHeatingDemandKWh, inputs.steamCapex, inputs.steamOpexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice);
        results.steam = steamDetails;
        comparisons.push(steamDetails);
    }

    // --- (V10.0) 计算 ROI (方案A vs 方案B, C, D...) ---
    results.comparisons = comparisons.map(boiler => {
        const energyCostSaving = boiler.energyCost - hpSystemDetails.energyCost;
        let energyCostSavingRate = (boiler.energyCost > 0) ? (energyCostSaving / boiler.energyCost) : (hpSystemDetails.energyCost <= 0 ? 0 : -Infinity);
        
        let electricalPriceRatio = null;
        if (hpSystemDetails.cost_per_kwh_heat > 0 && boiler.cost_per_kwh_heat > 0) {
            electricalPriceRatio = boiler.cost_per_kwh_heat / hpSystemDetails.cost_per_kwh_heat;
        }
        
        const investmentDiff = hpSystemDetails.lcc.capex - boiler.lcc.capex;
        const opexSaving = boiler.opex - hpSystemDetails.opex;
        let paybackPeriod = "无法收回投资";
        if (opexSaving > 0 && investmentDiff > 0) paybackPeriod = (investmentDiff / opexSaving).toFixed(2) + " 年";
        else if (investmentDiff <=0 && opexSaving > 0) paybackPeriod = "无需额外投资";
        else if (investmentDiff <=0 && opexSaving <= 0) paybackPeriod = "无额外投资/无节省";
        
        let simpleROI = (investmentDiff > 0 && opexSaving > 0) ? (opexSaving / investmentDiff) : null;
        
        const co2Reduction = (boiler.co2 - hpSystemDetails.co2); // in kg
        const treesPlanted = co2Reduction > 0 ? (co2Reduction / 18.3) : 0;
        const lccSaving = boiler.lcc.total - hpSystemDetails.lcc.total;
        const npv = lccSaving; 

        // Build Cash Flow
        const cash_flows = [];
        cash_flows.push(-investmentDiff); // Year 0

        for (let n = 1; n <= lccYears; n++) {
            const hpEnergyCost_n = hpSystemDetails.energyCost * Math.pow(1 + energyInflationRate, n - 1);
            const boilerEnergyCost_n = boiler.energyCost * Math.pow(1 + energyInflationRate, n - 1);
            const hpOpexCost_n = hpSystemDetails.opexCost * Math.pow(1 + opexInflationRate, n - 1);
            const boilerOpexCost_n = boiler.opexCost * Math.pow(1 + opexInflationRate, n - 1);
            const annualSaving_n = (boilerEnergyCost_n + boilerOpexCost_n) - (hpEnergyCost_n + hpOpexCost_n);
            cash_flows.push(annualSaving_n);
        }
        
        const hpSalvageValue = hpSystemDetails.lcc.salvageValue;
        const boilerSalvageValue = boiler.lcc.salvageValue;
        const deltaSalvage = hpSalvageValue - boilerSalvageValue;
        cash_flows[lccYears] += deltaSalvage;
        
        const irr = findIRR(cash_flows);
        const dynamicPBP = calculateDynamicPBP(cash_flows, discountRate, lccYears);

        return {
            key: boiler.key, name: boiler.name,
            opex: boiler.opex, opexSaving,
            investmentDiff, paybackPeriod,
            // **** 修改 1 开始 (Bug修复) ****
            // co2Reduction: co2Reduction / 1000, // convert kg to ton (旧代码)
            co2Reduction: co2Reduction, // in kg (新代码)
            // **** 修改 1 结束 ****
            treesPlanted,
            lcc: boiler.lcc.total, lccSaving,
            npv, irr, dynamicPBP,
            simpleROI, electricalPriceRatio,
            energyCostSaving, energyCostSavingRate,
            // **** 修改 2 开始 (功能增加) ****
            consumption: boiler.consumption,
            consumptionUnit: boiler.consumptionUnit
            // **** 修改 2 结束 ****
        };
    });

    // --- (V10.0) 返回总结果 ---
    results.analysisMode = analysisMode; // V11.0 BUGFIX: 确保模式被正确传递
    return results;
}


/**
 * 辅助函数：计算各种锅炉的详细成本
 * (此函数在 core-calculator 模块内部使用)
 * (V11.0: 无改动, 仅由 runCostComparisonAnalysis 调用)
 */
function calculateBoilerDetails(boilerKey, heatingDemandKWh, capex, opexCost, lccParams, inputs, gridFactor, weightedAvgElecPrice) {
    const { lccYears, discountRate, energyInflationRate, opexInflationRate } = lccParams;
    const annualHeatingDemandMJ = heatingDemandKWh * 3.6;
    
    let energyCost = 0, co2 = 0, consumption = 0; 
    let lcc = 0, energyNPV = 0, opexNPV = 0, salvageNPV = 0;
    let opex_Year1 = 0;
    let salvageRate = 0;
    let name = "未知";
    let cost_per_kwh_heat = 0; 
    let salvageValue = 0;
    // **** 修改 2 开始 (功能增加) ****
    let consumptionUnit = ''; // 存储能耗单位
    // **** 修改 2 结束 ****

    switch (boilerKey) {
        case 'gas':
            name = "天然气锅炉";
            salvageRate = inputs.gasSalvageRate;
            consumptionUnit = 'm³'; // (功能增加)
            if (inputs.gasBoilerEfficiency > 0 && inputs.gasCalorific > 0) {
                const gasRequiredMJ = annualHeatingDemandMJ / inputs.gasBoilerEfficiency;
                consumption = gasRequiredMJ / inputs.gasCalorific; // m³
                energyCost = consumption * inputs.gasPrice;
                co2 = consumption * inputs.gasFactor;
                cost_per_kwh_heat = inputs.gasPrice / ((inputs.gasCalorific / 3.6) * inputs.gasBoilerEfficiency);
            }
            break;
        case 'fuel':
            name = "燃油锅炉";
            salvageRate = inputs.fuelSalvageRate;
            consumptionUnit = '吨'; // (功能增加)
            if (inputs.fuelBoilerEfficiency > 0 && inputs.fuelCalorific > 0) {
                const fuelRequiredMJ = annualHeatingDemandMJ / inputs.fuelBoilerEfficiency;
                const fuelWeightKg = fuelRequiredMJ / inputs.fuelCalorific;
                consumption = fuelWeightKg / 1000; // 吨
                energyCost = consumption * inputs.fuelPrice;
                co2 = consumption * inputs.fuelFactor;
                cost_per_kwh_heat = (inputs.fuelPrice / 1000) / ((inputs.fuelCalorific / 3.6) * inputs.fuelBoilerEfficiency);
            }
            break;
        case 'coal':
            name = "燃煤锅炉";
            salvageRate = inputs.coalSalvageRate;
            consumptionUnit = '吨'; // (功能增加)
            if (inputs.coalBoilerEfficiency > 0 && inputs.coalCalorific > 0) {
                const coalRequiredMJ = annualHeatingDemandMJ / inputs.coalBoilerEfficiency;
                const coalWeightKg = coalRequiredMJ / inputs.coalCalorific;
                consumption = coalWeightKg / 1000; // 吨
                energyCost = consumption * inputs.coalPrice;
                co2 = consumption * inputs.coalFactor;
                cost_per_kwh_heat = (inputs.coalPrice / 1000) / ((inputs.coalCalorific / 3.6) * inputs.coalBoilerEfficiency);
            }
            break;
        case 'biomass':
            name = "生物质锅炉";
            salvageRate = inputs.biomassSalvageRate;
            consumptionUnit = '吨'; // (功能增加)
            if (inputs.biomassBoilerEfficiency > 0 && inputs.biomassCalorific > 0) {
                const biomassRequiredMJ = annualHeatingDemandMJ / inputs.biomassBoilerEfficiency;
                const biomassWeightKg = biomassRequiredMJ / inputs.biomassCalorific;
                consumption = biomassWeightKg / 1000; // 吨
                energyCost = consumption * inputs.biomassPrice;
                co2 = consumption * inputs.biomassFactor;
                cost_per_kwh_heat = (inputs.biomassPrice / 1000) / ((inputs.biomassCalorific / 3.6) * inputs.biomassBoilerEfficiency);
            }
            break;
        case 'electric':
            name = "电锅炉";
            salvageRate = inputs.electricSalvageRate;
            consumptionUnit = 'kWh'; // (功能增加)
            if (inputs.electricBoilerEfficiency > 0) {
                  consumption = heatingDemandKWh / inputs.electricBoilerEfficiency; // kWh
                 energyCost = consumption * weightedAvgElecPrice;
                 co2 = consumption * gridFactor;
                 cost_per_kwh_heat = weightedAvgElecPrice / inputs.electricBoilerEfficiency;
            }
            break;
        case 'steam':
            name = "管网蒸汽";
            salvageRate = inputs.steamSalvageRate;
            consumptionUnit = '吨'; // (功能增加)
            if (inputs.steamEfficiency > 0 && inputs.steamCalorific > 0) {
                const steamRequiredKwh = heatingDemandKWh / inputs.steamEfficiency;
                consumption = steamRequiredKwh / inputs.steamCalorific; // 吨
                energyCost = consumption * inputs.steamPrice;
                co2 = steamRequiredKwh * inputs.steamFactor;
                cost_per_kwh_heat = inputs.steamPrice / (inputs.steamCalorific * inputs.steamEfficiency);
            }
            break;
    }

    opex_Year1 = energyCost + opexCost;
    energyNPV = calculateNPV(energyCost, lccYears, discountRate, energyInflationRate);
    opexNPV = calculateNPV(opexCost, lccYears, discountRate, opexInflationRate);
    
    salvageValue = capex * salvageRate;
    salvageNPV = salvageValue / Math.pow(1 + discountRate, lccYears);
    
    lcc = capex + energyNPV + opexNPV - salvageNPV;

    return {
        key: boilerKey, name: name,
        energyCost: energyCost, opexCost: opexCost, opex: opex_Year1,
        // **** 修改 2 开始 (功能增加) ****
        co2: co2, consumption: consumption, consumptionUnit: consumptionUnit, cost_per_kwh_heat: cost_per_kwh_heat,
        // **** 修改 2 结束 ****
        lcc: {
            capex: capex, energyNPV: energyNPV, opexNPV: opexNPV,
            salvageRate: salvageRate, salvageNPV: salvageNPV,
            salvageValue: salvageValue, total: lcc
        }
    };
}