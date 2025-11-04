// core-calculator.js
import { calculateNPV, calculateCashFlowNPV, findIRR, calculateDynamicPBP } from './utils.js';

/**
 * 辅助函数：计算各种锅炉的详细成本
 * (此函数在 core-calculator 模块内部使用)
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

    switch (boilerKey) {
        case 'gas':
            name = "天然气锅炉";
            salvageRate = inputs.gasSalvageRate;
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
        co2: co2, consumption: consumption, cost_per_kwh_heat: cost_per_kwh_heat,
        lcc: {
            capex: capex, energyNPV: energyNPV, opexNPV: opexNPV,
            salvageRate: salvageRate, salvageNPV: salvageNPV,
            salvageValue: salvageValue, total: lcc
        }
    };
}


/**
 * 运行核心分析
 * @param {object} inputs - 从 ui-setup.js 读取的完整输入对象
 * @returns {object} 包含所有计算结果的 results 对象
 */
export function runAnalysis(inputs) {
    // --- 1. 初始化 ---
    const results = {}; // 这是将返回的总结果对象
    const { 
        lccYears, discountRate, energyInflationRate, opexInflationRate, priceTiers, 
        isHybridMode, gridFactor, inputs: inputValues 
    } = inputs;
    
    const lccParams = { lccYears, discountRate, energyInflationRate, opexInflationRate };
    
    results.inputs = inputs; // 保存原始输入
    results.lccParams = lccParams;
    results.isHybridMode = isHybridMode;

    // --- 2. 计算总需求 (所有模式通用) ---
    const annualHeatingDemandKWh = inputs.heatingLoad * inputs.operatingHours;
    results.annualHeatingDemandKWh = annualHeatingDemandKWh;

    // --- 3. 计算加权平均电价 (所有模式通用) ---
    // (V9.0 备注: 假设辅助电加热器也使用相同的电价时段分布)
    const totalHpElec_FullLoad = (inputs.hpCop > 0) ? (annualHeatingDemandKWh / inputs.hpCop) : 0;
    let hpEnergyCost_FullLoad = 0;
    const hpEnergyCostDetails_FullLoad = { tiers: [] };
    
    priceTiers.forEach(tier => {
        const dist_f = tier.dist / 100;
        const elec_n = totalHpElec_FullLoad * dist_f;
        const cost_n = elec_n * tier.price;
        hpEnergyCost_FullLoad += cost_n;
        hpEnergyCostDetails_FullLoad.tiers.push({ name: tier.name, elec: elec_n, price: tier.price, cost: cost_n });
    });
    
    let weightedAvgElecPrice = 0;
    if (totalHpElec_FullLoad > 0) {
        weightedAvgElecPrice = hpEnergyCost_FullLoad / totalHpElec_FullLoad;
    } else if (priceTiers.length > 0) {
        let totalWeight = 0;
        priceTiers.forEach(t => { weightedAvgElecPrice += t.price * t.dist; totalWeight += t.dist; });
        if (totalWeight > 0) weightedAvgElecPrice = weightedAvgElecPrice / totalWeight;
        else if (priceTiers.length === 1) weightedAvgElecPrice = priceTiers[0].price;
    }
    results.weightedAvgElecPrice = weightedAvgElecPrice; // ** 存入
    
    
    // --- 4. V10.0 逻辑分支: 计算 "方案 A" ---
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
        const hybridSystem = {
            isHybrid: true,
            name: "混合系统 (工业热泵 + " + auxDetails.name + ")",
            energyCost: hpDetails.energyCost + auxDetails.energyCost,
            opexCost: hpDetails.opexCost + auxDetails.opexCost,
            opex: hpDetails.opex + auxDetails.opex, 
            co2: hpDetails.co2 + auxDetails.co2,
            cost_per_kwh_heat: annualHeatingDemandKWh > 0 ? ((hpDetails.energyCost + auxDetails.energyCost) / annualHeatingDemandKWh) : 0,
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
        const hpCo2 = totalHpElec_FullLoad * gridFactor;
        
        const hpEnergyNPV = calculateNPV(hpEnergyCost_FullLoad, lccYears, discountRate, energyInflationRate);
        const hpOpexNPV = calculateNPV(inputs.hpOpexCost, lccYears, discountRate, opexInflationRate);
        
        const hpSalvageValue_Undiscounted = hpTotalCapex * inputs.hpSalvageRate;
        const hpSalvageNPV = hpSalvageValue_Undiscounted / Math.pow(1 + discountRate, lccYears);
        const hpLCC = hpTotalCapex + hpEnergyNPV + hpOpexNPV - hpSalvageNPV;

        const hpDetails = {
            isHybrid: false,
            energyCost: hpEnergyCost_FullLoad, energyCostDetails: hpEnergyCostDetails_FullLoad,
            opexCost: inputs.hpOpexCost, opex: hpOpex_Year1, co2: hpCo2,
            cost_per_kwh_heat: (inputs.hpCop > 0) ? (weightedAvgElecPrice / inputs.hpCop) : 0, 
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

    // --- 5. (V10.0) 循环计算所有 "方案 B" (对比基准) ---
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

    // --- 6. (V10.0) 计算 ROI (方案A vs 方案B, C, D...) ---
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

        // --- IRR BUG 修正开始 ---
        // 修正了 Math.pow(inflationRate, ...) 为 Math.pow(1 + inflationRate, ...)
        for (let n = 1; n <= lccYears; n++) {
            const hpEnergyCost_n = hpSystemDetails.energyCost * Math.pow(1 + energyInflationRate, n - 1);
            const boilerEnergyCost_n = boiler.energyCost * Math.pow(1 + energyInflationRate, n - 1);
            const hpOpexCost_n = hpSystemDetails.opexCost * Math.pow(1 + opexInflationRate, n - 1);
            const boilerOpexCost_n = boiler.opexCost * Math.pow(1 + opexInflationRate, n - 1);
            const annualSaving_n = (boilerEnergyCost_n + boilerOpexCost_n) - (hpEnergyCost_n + hpOpexCost_n);
            cash_flows.push(annualSaving_n);
        }
        // --- IRR BUG 修正结束 ---
        
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
            co2Reduction: co2Reduction / 1000, // convert kg to ton
            treesPlanted,
            lcc: boiler.lcc.total, lccSaving,
            npv, irr, dynamicPBP,
            simpleROI, electricalPriceRatio,
            energyCostSaving, energyCostSavingRate
        };
    });

    // --- 7. 返回总结果 ---
    return results;
}
