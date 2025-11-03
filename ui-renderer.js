// ui-renderer.js
import { fWan, fTon, fCop, fPercent, fYears, fNum, fInt, fYuan } from './utils.js';

// --- 状态显示函数 ---

/**
 * 显示/隐藏 "参数已更改" 的提示
 * @param {boolean} show 
 */
export function setStaleDisplay(show) {
    document.getElementById('stale-results-notice').classList.toggle('hidden', !show);
    document.getElementById('results-container').classList.toggle('stale', show);
}

/**
 * 显示/隐藏 占位符 和 结果内容
 * @param {boolean} show 
 */
export function showResults(show) {
     document.getElementById('results-placeholder').classList.toggle('hidden', show);
     document.getElementById('results-content').classList.toggle('hidden', !show);
}

/**
 * 设置 "暂存方案" 按钮的状态
 * @param {'enabled' | 'disabled' | 'saved'} state 
 * @param {string} [text] 
 */
export function setSaveButtonState(state, text = '暂存当前工业热泵方案 (请先计算)') {
    const saveBtn = document.getElementById('saveScenarioBtn');
    const scenarioToggle = document.getElementById('enableScenarioComparison');
    if (!scenarioToggle.checked) {
        saveBtn.classList.add('hidden');
        return;
    }
    
    saveBtn.classList.remove('hidden');

    if (state === 'disabled') {
        saveBtn.disabled = true;
        saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        saveBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        saveBtn.textContent = text;
    } else if (state === 'enabled') {
        saveBtn.disabled = false;
        saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        saveBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        saveBtn.textContent = '暂存当前方案';
    } else if (state === 'saved') {
        saveBtn.textContent = '方案已暂存!';
        setTimeout(() => { setSaveButtonState('enabled'); }, 2000);
    }
}

/**
 * 显示或清除电价时段错误
 * @param {string | null} message 
 */
export function showPriceTierError(message) {
    const priceTierErrorDiv = document.getElementById('priceTierError');
    if (message) {
        priceTierErrorDiv.textContent = message;
        priceTierErrorDiv.classList.remove('hidden');
    } else {
        priceTierErrorDiv.classList.add('hidden');
    }
}


// --- 核心渲染函数 ---

/**
 * 渲染主结果卡片
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function renderResults(results) {
    const { lccParams, comparisons } = results;
    const hpSystemDetails = results.isHybridMode ? results.hybridSystem : results.hp;
    const lccYears = lccParams.lccYears;
    const discountRate = lccParams.discountRate;

    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '';
    document.getElementById('results-title').textContent = `静态、ROI 与 LCC (${lccYears}年) 对比分析结果`;

    const isHybrid = hpSystemDetails.isHybrid || false;
    const hpCardTitleStatic = isHybrid ? '混合系统年运行成本 (第1年)' : '工业热泵系统年运行成本 (第1V10)';
    const hpCardTitleLCC = isHybrid ? `混合系统 LCC (${lccYears}年)` : `工业热泵系统 LCC (${lccYears}年)`;

    const hpCardStatic = `<div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg result-card"><h3 class="font-bold text-lg text-blue-800">${hpCardTitleStatic}</h3><p class="text-2xl font-bold text-blue-600">${fWan(hpSystemDetails.opex)} 万元</p></div>`;
    const hpCardLCC = `<div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-lg result-card" style="transition-delay: 50ms;"><h3 class="font-bold text-lg text-blue-900">${hpCardTitleLCC}</h3><p class="text-2xl font-bold text-blue-700">${fWan(hpSystemDetails.lcc.total)} 万元</p></div>`;
    resultsContent.innerHTML += hpCardStatic + hpCardLCC;

    // --- Comparison Cards (Loop) ---
    comparisons.forEach((boiler, index) => {
        const npvColor = boiler.npv > 0 ? 'text-green-600' : 'text-red-600';
        const irrColor = boiler.irr > discountRate ? 'text-green-600' : (boiler.irr === null || !isFinite(boiler.irr) ? 'text-gray-500' : 'text-red-600');
        const paybackColor = boiler.dynamicPBP !== null ? 'text-blue-600' : 'text-red-600';
        const staticSavingColor = boiler.opexSaving > 0 ? 'text-green-600' : 'text-red-600';
        const energySavingColor = boiler.energyCostSaving > 0 ? 'text-green-600' : 'text-red-600'; 
        const simpleRoiColor = boiler.simpleROI !== null ? 'text-green-600' : 'text-gray-500';

        const resultCard = `
        <div class="bg-gray-100 p-4 rounded-lg space-y-3 result-card" style="transition-delay: ${150 * (index + 1)}ms;">
            <h4 class="font-bold text-lg text-gray-800 border-b pb-2">与 <span class="text-blue-600">${boiler.name}</span> 对比</h4>
            <div class="space-y-1">
                <h5 class="font-semibold text-blue-700 text-md">视角: 投资回报率 (ROI)</h5>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">简单投资回报率 (ROI)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 320px; margin-left: -160px;"><b>通俗解释:</b> 这是一个简化的、非财务人员常用的参考指标 (公式: 第1年节省成本 / 额外投资)。<br><strong class="text-yellow-300">特别注意:</strong> 此指标未考虑资金的时间价值和未来通胀，仅供初步参考。<b>内部收益率 (IRR) 是更精确的指标。</b></span>
                    </span>
                    <span class="font-bold ${simpleRoiColor}">${fPercent(boiler.simpleROI)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">净现值 (NPV)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>通俗解释:</b> 把未来所有省/赚的钱折算成今天, 再减去初始投资, 看是正还是负。<b>NPV > 0 代表项目可行</b>, 不仅达到最低回报要求 (折现率), 还额外多赚了。</span>
                    </span>
                    <span class="font-bold ${npvColor}">${fWan(boiler.npv)} 万元</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">内部收益率 (IRR)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>通俗解释:</b> 这个项目本身的“年化收益率”。<b>IRR > 折现率 (基准收益率) 代表项目优秀</b>, 回报高于你的最低要求。</span>
                    </span>
                    <span class="font-bold ${irrColor}">${fPercent(boiler.irr)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">动态回收期 (PBP)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>通俗解释:</b> 考虑了利息和通胀后, <b>“真正”需要多少年才能收回初始投资</b>。这个值比“静态回收期”更真实、更可靠。</span>
                    </span>
                    <span class="font-bold ${paybackColor}">${fYears(boiler.dynamicPBP)} 年</span>
                </div>
            </div>
            <div class="space-y-1 pt-2 border-t">
                <h5 class="font-semibold text-gray-700 text-md">视角: 静态 (第1年) 与 环境</h5>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">电热价格比 (EPR)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 320px; margin-left: -160px;"><b>IEA/欧洲常用指标 (EPR):</b> (锅炉产热成本) / (工业热泵产热成本)。<br><b>EPR > 1.0</b> 时，工业热泵运行成本更低。<br><b>EPR = 2.0</b> 意味着工业热泵成本是锅炉的50%。</span>
                    </span>
                    <span class="font-bold ${(boiler.electricalPriceRatio > 1.0 || (boiler.electricalPriceRatio === null && boiler.key === 'electric')) ? 'text-green-600' : 'text-red-600'}">
                        ${boiler.electricalPriceRatio ? boiler.electricalPriceRatio.toFixed(2) : (boiler.key === 'electric' ? 'N/A' : '0.00')}
                    </span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">年节省能源费:</span>
                    <span class="font-semibold ${energySavingColor}">${fWan(boiler.energyCostSaving)} 万元</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">能源费节能率:</span>
                    <span class="font-semibold ${energySavingColor}">${fPercent(boiler.energyCostSavingRate)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">年节省总成本 (含运维):</span>
                    <span class="font-semibold ${staticSavingColor}">${fWan(boiler.opexSaving)} 万元</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">静态回报期 (总成本):</span>
                    <span class="font-semibold text-right">${boiler.paybackPeriod}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">年碳减排量:</span>
                    <span class="font-semibold text-green-600 text-right">${boiler.co2Reduction.toFixed(2)} 吨 CO₂</span>
                </div>
            </div>
            <div class="space-y-1 pt-2 border-t">
                <h5 class="font-semibold text-gray-700 text-md">视角: 全生命周期成本 (LCC)</h5>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">${isHybrid ? '混合系统' : '工业热泵'} LCC:</span>
                    <span class="font-semibold text-blue-700 text-right">${fWan(hpSystemDetails.lcc.total)} 万元</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">${boiler.name} LCC:</span>
                    <span class="font-semibold text-gray-700 text-right">${fWan(boiler.lcc)} 万元</span>
                </div>
            </div>
        </div>`;
        resultsContent.innerHTML += resultCard;
    });

    // --- Conclusion ---
    let conclusionHTML = `<div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg space-y-2 result-card" style="transition-delay: ${150 * (comparisons.length + 1)}ms;"><h4 class="font-bold text-lg text-indigo-800 border-b pb-2">综合结论 (基于 ${lccYears} 年分析)</h4>`;

    const profitableROI = comparisons.filter(c => c.irr > discountRate && isFinite(c.irr)); 
    if (profitableROI.length > 0) {
        const bestIRR = profitableROI.reduce((p, c) => (p.irr > c.irr) ? p : c);
        conclusionHTML += `<p class="text-sm text-gray-700"><b>投资回报 (ROI) 结论：</b>项目可行。相较于 <b>${profitableROI.map(p => p.name).join('、')}</b>，IRR 高于基准收益率(${fPercent(discountRate)})。回报最佳的是替代 <b>${bestIRR.name}</b>，IRR 高达 <b>${fPercent(bestIRR.irr)}</b>，动态回收期 <b>${fYears(bestIRR.dynamicPBP)}年</b>。</p>`;
    } else {
         const bestNPV = comparisons.length > 0 ? comparisons.reduce((p, c) => (p.npv > c.npv) ? p : c) : null;
         if (bestNPV && bestNPV.npv > 0) {
             conclusionHTML += `<p class="text-sm text-gray-700"><b>投资回报 (ROI) 结论：</b>项目勉强可行。相较于 <b>${bestNPV.name}</b>，项目净现值(NPV)为正 (<b>${fWan(bestNPV.npv)} 万元</b>)，但所有方案 IRR 均未超过基准收益率(${fPercent(discountRate)})。</p>`;
         } else {
             conclusionHTML += `<p class="text-sm text-red-700"><b>投资回报 (ROI) 结论：</b>项目不可行。相较于所有对比方案，项目的 IRR 均低于基准收益率(${fPercent(discountRate)})，且 NPV 均为负。</p>`;
         }
    }

    const positiveCO2Reducers = comparisons.filter(c => c.co2Reduction > 0);
    if (positiveCO2Reducers.length > 0) {
        const bestEnviro = positiveCO2Reducers.reduce((p, c) => (p.co2Reduction > c.co2Reduction) ? p : c);
        conclusionHTML += `<p class="text-sm text-gray-700"><b>环境效益 (年)：</b>替代 <b>${bestEnviro.name}</b> 的环境效益最为显著，年碳减排量可达 <b>${bestEnviro.co2Reduction.toFixed(2)}</b> 吨CO₂，相当于植树约 <b>${fInt(bestEnviro.treesPlanted)}</b> 棵。</p>`;
    } else if (comparisons.length > 0) {
         conclusionHTML += `<p class="text-sm text-gray-700"><b>环境效益 (年)：</b>根据当前参数，${isHybrid ? '混合' : '工业热泵'}方案相较于所选对比方案均无碳减排优势。</p>`;
    }
     conclusionHTML += '</div>';

    conclusionHTML += `<button id="toggle-details-btn" class="w-full mt-4 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示详细计算过程 (含公式)</button>`;
    conclusionHTML += `<button id="toggle-risk-btn" class="w-full mt-2 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示投资风险及对策分析</button>`;
    conclusionHTML += `<button id="printReportBtn" class="w-full mt-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-300 text-sm">打印本页报告 (A4)</button>`;
    conclusionHTML += `<div id="calculation-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;
    conclusionHTML += `<div id="risk-analysis-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;

    resultsContent.innerHTML += conclusionHTML;

    // 激活卡片动画
    setTimeout(() => {
        document.querySelectorAll('.result-card').forEach(card => card.classList.add('visible'));
    }, 10);
}

/**
 * 填充 "详细计算过程"
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function populateCalculationDetails(results) {
    const { isHybridMode, lccParams, hp, gas, fuel, coal, biomass, electric, steam, annualHeatingDemandKWh, hybridSystem, hybrid_aux, inputs } = results;
    
    const gridFactorBase = document.getElementById('gridFactor').dataset.baseValue;
    const gridFactorToDisplay = document.getElementById('greenElectricityToggle').checked ? 0 : gridFactorBase;
    const gridFactorLabel = document.getElementById('greenElectricityToggle').checked ? '绿电因子' : '电网因子';

    let detailsHTML = `
        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">A. 核心经济指标计算方法与依据</h3>
        <h4>1. 全寿命周期成本 (LCC)</h4>
        <p class="authority">LCC (Life Cycle Cost) 是指产品在整个生命周期内（从投资到报废）的总成本，经过折现率调整后的现值。</p>
        <div class="formula-block">LCC = CAPEX + NPV(Energy) + NPV(O&M) - NPV(Salvage)</div>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li><b>CAPEX:</b> 初始投资 (第0年成本)。</li>
            <li><b>NPV(Energy):</b> 全周期能源成本的净现值。</li>
            <li><b>NPV(O&M):</b> 全周期运维成本的净现值。</li>
            <li><b>NPV(Salvage):</b> 设备残值的净现值 (作为收益扣除)。</li>
        </ul>
        <h4>2. 净现值 (NPV)</h4>
        <p class="authority">NPV (Net Present Value) 是项目全周期内产生的净现金流（节省的成本 - 额外投资）按折现率折算到今天的总和。<b>NPV > 0 代表项目可行。</b></p>
        <div class="formula-block">NPV = (LCC_基准 - LCC_工业热泵) = (节省的LCC)</div>
        <h4>3. 内部收益率 (IRR)</h4>
        <p class="authority">IRR (Internal Rate of Return) 是使项目净现值(NPV)等于零时的折现率。<b>IRR > 基准折现率，代表项目优秀。</b></p>
        <div class="formula-block">NPV(CashFlow, IRR) = 0<br>其中: CashFlow = [ -ΔInvest, Save_Y1, Save_Y2, ... ]</div>
        <h4>4. 动态投资回收期 (PBP)</h4>
        <p class="authority">PBP (Payback Period) 是指考虑了资金时间价值（折现率）后，项目累计节省的净现金流（折现后）等于初始额外投资所需的时间。</p>
    `;
    
    if (isHybridMode) {
        const hpLoadSharePercent = (results.hybridInputs.hpLoadShare * 100).toFixed(1);
        const auxLoadSharePercent = (100 - parseFloat(hpLoadSharePercent)).toFixed(1);
        
        detailsHTML += `
            <hr class="my-6">
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">B. 本次项目详细计算过程 (混合模式)</h3>
            <h4 class="font-bold text-md text-gray-800">1. 基础数据</h4>
            <p><b>LCC/ROI 参数:</b> ${lccParams.lccYears} 年, 折现率 ${ (lccParams.discountRate * 100).toFixed(1)}%, 能源涨幅 ${ (lccParams.energyInflationRate * 100).toFixed(1)}%, 运维涨幅 ${ (lccParams.opexInflationRate * 100).toFixed(1)}%</p>
            <p><b>年总制热量:</b> ${fNum(annualHeatingDemandKWh, 0)} kWh</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800">2. 方案A: 混合系统 (总计)</h4>
            <p><b>年总运行成本 (第1年):</b> ${fWan(hybridSystem.opex)} 万元 (能源 ${fWan(hybridSystem.energyCost)} 万 + 运维 ${fWan(hybridSystem.opexCost)} 万)</p>
            <p><b>年总碳排放量:</b> ${fTon(hybridSystem.co2)} 吨 CO₂</p>
            <p><b>混合系统 LCC:</b> ${fWan(hybridSystem.lcc.total)} 万元 (投资 ${fWan(hybridSystem.lcc.capex)} + 能源NPV ${fWan(hybridSystem.lcc.energyNPV)} + 运维NPV ${fWan(hybridSystem.lcc.opexNPV)} - 残值NPV ${fWan(hybridSystem.lcc.salvageNPV)})</p>
            <p class="font-semibold"><b>混合系统产热成本:</b> ${hybridSystem.cost_per_kwh_heat.toFixed(4)} 元/kWh_热</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800" style="color: #1d4ed8;">2a. 混合系统 - 工业热泵部分 (承担 ${hpLoadSharePercent}% 负荷)</h4>
            <p><b>工业热泵制热量:</b> ${fNum(annualHeatingDemandKWh * results.hybridInputs.hpLoadShare, 0)} kWh</p>
            <p><b>年总电耗:</b> ${fNum(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0), 0)} kWh</p>
            ${hp.energyCostDetails.tiers.map(t => `<p class="pl-4">↳ <b>${t.name}:</b> ${fNum(t.elec, 0)} kWh * ${t.price} 元/kWh = ${fYuan(t.cost)} 元</p>`).join('')}
            <p><b>年能源成本 (工业热泵):</b> ${fYuan(hp.energyCost)} 元</p>
            <p><b>年运维(O&M)成本 (工业热泵):</b> ${fYuan(hp.opexCost)} 元</p>
            <p><b>年碳排放量 (工业热泵):</b> ${fNum(hp.co2, 0)} kg</p>
            <h4 class="font-bold text-md text-gray-800" style="color: #7f1d1d;">2b. 混合系统 - 辅助热源 (${hybrid_aux.name}, 承担 ${auxLoadSharePercent}% 负荷)</h4>
            <p><b>辅助热源制热量:</b> ${fNum(annualHeatingDemandKWh * (1.0 - results.hybridInputs.hpLoadShare), 0)} kWh</p>
            <p><b>年能源消耗:</b> ${fNum(hybrid_aux.consumption)} ${hybrid_aux.key === 'gas' ? 'm³' : (hybrid_aux.key === 'electric' ? 'kWh' : '吨')}</p>
            <p><b>年能源成本 (辅助):</b> ${fYuan(hybrid_aux.energyCost)} 元</p>
            <p><b>年运维(O&M)成本 (辅助):</b> ${fYuan(hybrid_aux.opexCost)} 元</p>
            <p><b>年碳排放量 (辅助):</b> ${fNum(hybrid_aux.co2, 0)} kg</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800">3. 方案B: 对比基准 (100% 传统热源)</h4>
            `;
        
        const boilers = [gas, fuel, coal, biomass, electric, steam].filter(Boolean);
        boilers.forEach(b => {
             detailsHTML += `
                <div class="pt-2 border-t mt-2">
                    <p><b>${b.name} (100% 负荷):</b></p>
                    <p class="pl-4">↳ <b>年能源消耗:</b> ${fNum(b.consumption)} ${b.key === 'gas' ? 'm³' : (b.key === 'electric' ? 'kWh' : '吨')}</p>
                    <p class="pl-4">↳ <b>年总运行成本 (第1年):</b> ${fWan(b.opex)} 万元 (能源 ${fWan(b.energyCost)} + 运维 ${fWan(b.opexCost)})</p>
                    <p class="pl-4">↳ <b>年碳排放量 (基准):</b> ${fNum(b.co2, 0)} kg</p>
                    <p class="pl-4 font-semibold">↳ <b>基准产热成本:</b> ${b.cost_per_kwh_heat.toFixed(4)} 元/kWh_热</p>
                    <p class="pl-4">↳ <b>基准 LCC:</b> ${fWan(b.lcc.total)} 万元</p>
                </div>
            `;
        });

        detailsHTML += `
            <hr class="my-6">
            <h4 class="font-bold text-md text-gray-800">4. LCC 与 ROI 对比 (混合 vs 基准)</h4>
        `;
        
        results.comparisons.forEach(c => {
            const boiler = results[c.key];
            detailsHTML += `
                 <div class="pt-2 border-t mt-2">
                    <p><b>对比: ${hybridSystem.name} vs ${c.name}</b></p>
                    <p class="pl-4"><b>EPR (电热价格比):</b> ${boiler.cost_per_kwh_heat.toFixed(4)} / ${hybridSystem.cost_per_kwh_heat.toFixed(4)} = <b>${c.electricalPriceRatio.toFixed(2)}</b></p>
                    <p class="pl-4"><b>年碳减排量:</b> (${fNum(boiler.co2, 0)} - ${fNum(hybridSystem.co2, 0)}) kg = <b>${fNum(c.co2Reduction * 1000, 0)} kg</b></p>
                    <p class="pl-4"><b>额外投资 (ΔInvest):</b> ${fWan(hybridSystem.lcc.capex)} - ${fWan(boiler.lcc.capex)} = <b>${fWan(c.investmentDiff)} 万元</b></p>
                    <p class="pl-4"><b>年节省总成本 (Save_Y1):</b> ${fWan(boiler.opex)} - ${fWan(hybridSystem.opex)} = <b>${fWan(c.opexSaving)} 万元</b></p>
                    <p class="pl-4 text-blue-700 font-bold">↳ LCC 节省 (NPV): ${fWan(boiler.lcc.total)} - ${fWan(hybridSystem.lcc.total)} = <b>${fWan(c.npv)} 万元</b></p>
                    <p class="pl-4 text-blue-700 font-bold">↳ 内部收益率 (IRR): <b>${(c.irr === null || !isFinite(c.irr)) ? 'N/A' : (c.irr * 100).toFixed(1) + ' %'}</b></p>
                 </div>
            `;
        });

    } else {
        // --- V8.0 标准模式的计算过程 ---
        let hpEnergyCostDetailsHTML = '';
        if (hp.energyCostDetails.tiers && hp.energyCostDetails.tiers.length > 0) {
            hp.energyCostDetails.tiers.forEach(tier => {
                hpEnergyCostDetailsHTML += `<p class="pl-4">↳ <b>${tier.name}:</b> ${fNum(tier.elec, 0)} kWh * ${tier.price} 元/kWh = ${fYuan(tier.cost)} 元</p>`;
            });
            hpEnergyCostDetailsHTML += `<p><b>年能源成本 (各时段合计):</b> ${fYuan(hp.energyCost)} 元</p>`;
        }

        detailsHTML += `
            <hr class="my-6">
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">B. 本次项目详细计算过程 (标准模式)</h3>
            <h4 class="font-bold text-md text-gray-800">1. 基础数据</h4>
            <p><b>LCC/ROI 参数:</b> ${lccParams.lccYears} 年, 折现率 ${ (lccParams.discountRate * 100).toFixed(1)}%, 能源涨幅 ${ (lccParams.energyInflationRate * 100).toFixed(1)}%, 运维涨幅 ${ (lccParams.opexInflationRate * 100).toFixed(1)}%</p>
            <p><b>年总制热量:</b> ${fNum(annualHeatingDemandKWh, 0)} kWh = ${fNum(annualHeatingDemandKWh * 3.6, 0)} MJ</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800">2. 工业热泵系统计算 (第1年)</h4>
            <p><b>年总电耗:</b> ${fNum(annualHeatingDemandKWh, 0)} kWh (年总制热量) / ${inputs.hpCop} (SPF) = ${fNum(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0), 0)} kWh</p>
            ${hpEnergyCostDetailsHTML}
            <p><b>年运维(O&M)成本:</b> ${fYuan(hp.opexCost)} 元</p>
            <p><b>年总运行成本 (第1年):</b> ${fYuan(hp.energyCost)} + ${fYuan(hp.opexCost)} = ${fYuan(hp.opex)} 元 ≈ <b>${fWan(hp.opex)} 万元</b></p>
            <p><b>加权平均电价:</b> ${results.weightedAvgElecPrice.toFixed(4)} 元/kWh</p>
            <p class="font-semibold"><b>工业热泵产热成本:</b> ${results.weightedAvgElecPrice.toFixed(4)} 元/kWh / ${inputs.hpCop} SPF = <b>${hp.cost_per_kwh_heat.toFixed(4)} 元/kWh_热</b></p>
            <p><b>年碳排放量 (使用${gridFactorLabel}):</b> ${fNum(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0), 0)} kWh * ${gridFactorToDisplay} kg/kWh = ${fNum(hp.co2, 0)} kg</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800">3. 对比方案计算 (第1年)</h4>
        `;

        const boilers = [gas, fuel, coal, biomass, electric, steam].filter(Boolean);
        boilers.forEach(b => {
            const co2ReductionKg = b.co2 - hp.co2;
            const epr = results.comparisons.find(c => c.key === b.key)?.electricalPriceRatio || 0;
            
            detailsHTML += `
                <div class="pt-2 border-t mt-2">
                    <p><b>${b.name}:</b> 年消耗量 ${fNum(b.consumption)} ${b.key === 'gas' ? 'm³' : (b.key === 'electric' ? 'kWh' : '吨')}</p>
                    <p class="pl-4">↳ <b>年能源成本:</b> ${fYuan(b.energyCost)} 元</p>
                    <p class="pl-4 font-semibold">↳ <b>${b.name}产热成本:</b> ${b.cost_per_kwh_heat.toFixed(4)} 元/kWh_热</p>
                    <p class="pl-4 text-blue-700 font-semibold">↳ <b>电热价格比 (EPR):</b> ${b.cost_per_kwh_heat.toFixed(4)} / ${hp.cost_per_kwh_heat.toFixed(4)} = <b>${epr ? epr.toFixed(2) : 'N/A'}</b></p>
                    <p class="pl-4">↳ <b>年运维(O&M)成本:</b> ${fYuan(b.opexCost)} 元</p>
                    <p class="pl-4">↳ <b>年总运行成本 (第1年):</b> ${fYuan(b.opex)} 元 ≈ <b>${fWan(b.opex)} 万元</b></p>
                    <p class="pl-4">↳ <b>年碳排放量:</b> ${fNum(b.co2, 0)} kg</p>
                    <p class="pl-4 text-green-700">↳ <b>年碳减排量:</b> ${fNum(co2ReductionKg, 0)} kg ≈ <b>${fTon(co2ReductionKg)} 吨</b></p>
                </div>
            `;
        });
        
        detailsHTML += `
            <hr class="my-6">
            <h4 class="font-bold text-md text-gray-800">4. 全寿命周期成本 (LCC) 与 ROI 分析 (基于NPV)</h4>
        `;
        
        results.comparisons.forEach(c => {
            const boiler = results[c.key];
            detailsHTML += `
                 <div class="pt-2 border-t mt-2">
                    <p><b>对比: ${hp.isHybrid ? '混合系统' : '工业热泵'} vs ${c.name}</b></p>
                    <p class="pl-4"><b>工业热泵 LCC:</b> ${fWan(hp.lcc.total)} 万元</p>
                    <p class="pl-4"><b>${c.name} LCC:</b> ${fWan(boiler.lcc.total)} 万元</p>
                    <p class="pl-4"><b>额外投资 (ΔInvest):</b> ${fWan(hp.lcc.capex)} - ${fWan(boiler.lcc.capex)} = <b>${fWan(c.investmentDiff)} 万元</b></p>
                    <p class="pl-4"><b>年节省总成本 (Save_Y1):</b> ${fWan(boiler.opex)} - ${fWan(hp.opex)} = <b>${fWan(c.opexSaving)} 万元</b></p>
                    <p class="pl-4 text-blue-700 font-bold">↳ LCC 节省 (NPV): ${fWan(boiler.lcc.total)} - ${fWan(hp.lcc.total)} = <b>${fWan(c.npv)} 万元</b></p>
                    <p class="pl-4 text-blue-700 font-bold">↳ 内部收益率 (IRR): <b>${(c.irr === null || !isFinite(c.irr)) ? 'N/A' : (c.irr * 100).toFixed(1) + ' %'}</b></p>
                 </div>
            `;
        });
    }

    document.getElementById('calculation-details').innerHTML = detailsHTML;
}

/**
 * 填充 "投资风险分析"
 */
export function populateRiskAnalysisDetails() {
    const riskHTML = `
        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">工业热泵投资风险及对策分析</h3>
        <h4>1. 政策与市场风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li><b>风险 (电价波动):</b> "峰谷尖"电价政策调整，尤其是谷电价格上涨或峰电涨幅不及预期，可能导致工业热泵（特别是带储能的）运行成本高于预期，拉长投资回收期。</li>
            <li><b>对策:</b> <b>(1) 精确评估:</b> 在LCC计算时，应采用（加权平均电价）或（分时电价模型）进行精确测算。<b>(2) 敏感性分析:</b> 测算电价上涨 10%、20% 时对IRR和PBP的影响。<b>(3) 绿电合约:</b> 探索与发电企业签订长期购电协议 (PPA)，锁定未来电价成本。</li>
        </ul>
        <h4>2. 技术与运行风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li><b>风险 (性能衰减/SPF不达标):</b> 工业热泵在极端天气下制热能力下降，或全年综合能效系数(SPF)低于设计值，导致实际运行电耗过高。</li>
            <li><b>对策:</b> <b>(1) 选型匹配:</b> 必须基于项目地最冷月平均工况进行主机选型。<b>(2) 耦合设计 (V9.0):</b> 采用“工业热泵 + 辅助热源”的耦合方案，保障极端工况。<b>(3) 明确SPF:</b> 投标和设计阶段应明确SPF的计算边界（是否包含水泵、辅热等）。</li>
            <li><b>风险 (负荷匹配度低):</b> 生产线实际用热负荷（如间歇性用热）与工业热泵额定负荷不匹配，导致工业热泵频繁启停。</li>
            <li><b>对策:</b> <b>(1) 储能缓冲:</b> 对于负荷波动大的工况，必须配备适当容量的储热水箱（储能系统）。<b>(2) 变频调节:</b> 优先采用变频工业热泵机组。</li>
        </ul>
        <h4>3. 财务与LCC风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li><b>风险 (LCC估算偏差):</b> 仅对比“第1年运行成本”，忽略了初始投资(CAPEX)和未来成本（通胀、运维）的差异。</li>
            <li><b>对策:</b> <b>(1) 采用LCC:</b> 坚持使用 LCC (全寿命周期成本) 作为决策依据。<b>(2) 考虑通胀:</b> 必须设置合理的“能源价格涨幅”（如3%）和“运维成本涨幅”（如5%）。</li>
            <li><b>风险 (IRR/PBP误判):</b> 采用“静态回收期”替代“动态回收期(PBP)”，忽略资金的时间价值（利息/折现率）。</li>
            <li><b>对策:</b> <b>(1) 明确折现率:</b> 必须与业主商定一个合理的“基准折现率/收益率”（如8%）。<b>(2) 核心指标:</b> 必须使用 <b>IRR</b> 和 <b>动态PBP</b> 作为核心财务指标。</li>
        </ul>
    `;
    document.getElementById('risk-analysis-details').innerHTML = riskHTML;
}

/**
 * 构建并填充 "打印报告"
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function buildPrintReport(results) {
    const { isHybridMode, lccParams, hp, comparisons, inputs, hybridSystem } = results;

    const projectName = inputs.projectName || "未命名项目";
    const reportDate = new Date().toLocaleString('zh-CN');
    let reportHTML = `
        <div class="print-report-header">
            <h2>${projectName} 项目</h2>
            <h1>工业热泵经济与环境效益分析报告</h1>
            <p>报告日期: ${reportDate}</p>
        </div>
        <div class="print-report-section">
            <h3>1. 核心输入参数</h3>
            <table class="print-report-table">
                <tr><td class="col-param">项目名称</td><td>${projectName}</td></tr>
                <tr><td class="col-param">制热负荷 (kW)</td><td class="align-right">${fNum(inputs.heatingLoad, 1)}</td></tr>
                <tr><td class="col-param">年运行小时 (h)</td><td class="align-right">${fInt(inputs.operatingHours)}</td></tr>
                <tr><td class="col-param">经济分析年限 (年)</td><td class="align-right">${lccParams.lccYears}</td></tr>
                <tr><td class="col-param">折现率 (基准收益率)</td><td class="align-right">${fPercent(lccParams.discountRate, 1)}</td></tr>
            </table>
        </div>
    `;

    if (isHybridMode) {
        const { hybridInputs } = results;
        reportHTML += `
            <div class="print-report-section">
                <h3>2. 方案静态对比 (第1年)</h3>
                <table class="print-report-table">
                    <thead>
                        <tr>
                            <th>方案名称</th>
                            <th class="align-right">总投资(万)</th>
                            <th class="align-right">年能源费(万)</th>
                            <th class="align-right">年运维费(万)</th>
                            <th class="align-right">年总运行成本(万)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>方案A: ${hybridSystem.name}</strong><br><small>(工业热泵 ${fPercent(hybridInputs.hpLoadShare, 0)} + ${results.hybrid_aux.name} ${fPercent(1-hybridInputs.hpLoadShare, 0)})</small></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.lcc.capex)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.energyCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.opexCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.opex)}</strong></td>
                        </tr>
        `;
        comparisons.forEach(c => {
            const boilerData = results[c.key];
            reportHTML += `
                <tr>
                    <td>方案B: 100% ${c.name}</td>
                    <td class="align-right">${fWan(boilerData.lcc.capex)}</td>
                    <td class="align-right">${fWan(boilerData.energyCost)}</td>
                    <td class="align-right">${fWan(boilerData.opexCost)}</td>
                    <td class="align-right">${fWan(boilerData.opex)}</td>
                </tr>
            `;
        });
        reportHTML += `
                    </tbody>
                </table>
            </div>
            <div class="print-report-section">
                <h3>3. 核心输出：经济与环境效益 (方案A vs 方案B)</h3>
                <table class="print-report-table">
                    <thead>
                        <tr>
                            <th>对比项</th>
                            <th class="align-right">LCC节省(万)</th>
                            <th class="align-right">IRR (%)</th>
                            <th class="align-right">动态 PBP (年)</th>
                            <th class="align-right">年节省总成本 (万)</th>
                            <th class="align-right">EPR</th>
                            <th class="align-right">年碳减排 (tCO₂)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        comparisons.forEach(c => {
             reportHTML += `
                <tr>
                    <td>vs. 100% ${c.name}</td>
                    <td class="align-right">${fWan(c.lccSaving)}</td>
                    <td class="align-right">${fPercent(c.irr)}</td>
                    <td class="align-right">${fYears(c.dynamicPBP)}</td>
                    <td class="align-right">${fWan(c.opexSaving)}</td>
                    <td class="align-right">${fNum(c.electricalPriceRatio, 2)}</td>
                    <td class="align-right">${fTon(c.co2Reduction / 1000)}</td>
                </tr>
            `;
        });
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
    } else {
        // --- V8.0 打印报告 ---
        reportHTML += `
            <div class="print-report-section">
                <h3>2. 方案静态对比 (第1年)</h3>
                <table class="print-report-table">
                    <thead>
                        <tr>
                            <th>方案名称</th>
                            <th class="align-right">总投资(万)</th>
                            <th class="align-right">年能源费(万)</th>
                            <th class="align-right">年运维费(万)</th>
                            <th class="align-right">年总运行成本(万)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>工业热泵方案 (SPF: ${inputs.hpCop.toFixed(2)})</strong></td>
                            <td class="align-right"><strong>${fWan(hp.lcc.capex)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.energyCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.opexCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.opex)}</strong></td>
                        </tr>
        `;
        comparisons.forEach(c => {
            const boilerData = results[c.key];
            reportHTML += `
                <tr>
                    <td>${c.name}</td>
                    <td class="align-right">${fWan(boilerData.lcc.capex)}</td>
                    <td class="align-right">${fWan(boilerData.energyCost)}</td>
                    <td class="align-right">${fWan(boilerData.opexCost)}</td>
                    <td class="align-right">${fWan(boilerData.opex)}</td>
                </tr>
            `;
        });
        reportHTML += `
                    </tbody>
                </table>
            </div>
            <div class="print-report-section">
                <h3>3. 核心输出：经济与环境效益 (对比工业热泵方案)</h3>
                <table class="print-report-table">
                    <thead>
                        <tr>
                            <th>对比项</th>
                            <th class="align-right">LCC节省(万)</th>
                            <th class="align-right">IRR (%)</th>
                            <th class="align-right">动态 PBP (年)</th>
                            <th class="align-right">EPR</th>
                            <th class="align-right">年碳减排 (tCO₂)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        comparisons.forEach(c => {
            reportHTML += `
                <tr>
                    <td>vs. ${c.name}</td>
                    <td class="align-right">${fWan(c.lccSaving)}</td>
                    <td class="align-right">${fPercent(c.irr)}</td>
                    <td class="align-right">${fYears(c.dynamicPBP)}</td>
                    <td class="align-right">${fNum(c.electricalPriceRatio, 2)}</td>
                    <td class="align-right">${fTon(c.co2Reduction / 1000)}</td>
                </tr>
            `;
        });
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }

    reportHTML += `
        <div class="print-report-footer">
            <p>注：全寿命周期成本(LCC)与ROI计算基于净现值(NPV)法，符合《建设项目经济评价方法与参数》相关规定。</p>
            <p>本程序已尽力确保正确，但不承担相关法律责任，App bug 请联系荆炎荣 15280122625。</p>
        </div>
    `;

    document.getElementById('print-report-container').innerHTML = reportHTML;
}