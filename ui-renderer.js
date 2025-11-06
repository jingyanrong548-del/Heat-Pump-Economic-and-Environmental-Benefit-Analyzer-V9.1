// ui-renderer.js
import { fWan, fTon, fCop, fPercent, fYears, fNum, fInt, fYuan, fInvest } from './utils.js'; // V11.0: 新增 fInvest

// --- V11.0: 全局通知 (替代 Alert) ---

let notifierTimeout = null;

/**
 * V11.0: 显示全局通知
 * @param {string} message 消息内容
 * @param {'info' | 'success' | 'error'} type 消息类型
 * @param {number} [duration=3000] 显示时长 (ms)
 */
export function showGlobalNotification(message, type = 'info', duration = 3000) {
    const notifier = document.getElementById('global-notifier');
    const notifierText = document.getElementById('global-notifier-text');
    const iconSuccess = document.getElementById('global-notifier-icon-success');
    const iconError = document.getElementById('global-notifier-icon-error');
    
    if (!notifier || !notifierText || !iconSuccess || !iconError) return;

    // 清除上一个计时器
    if (notifierTimeout) {
        clearTimeout(notifierTimeout);
    }

    // 设置内容和样式
    notifierText.textContent = message;
    notifier.classList.remove('notifier-success', 'notifier-error', 'hidden');
    
    if (type === 'success') {
        notifier.classList.add('notifier-success');
        iconSuccess.classList.remove('hidden');
        iconError.classList.add('hidden');
    } else if (type === 'error') {
        notifier.classList.add('notifier-error');
        iconSuccess.classList.add('hidden');
        iconError.classList.remove('hidden');
    } else {
        // 'info' (默认蓝色)
        notifier.classList.remove('notifier-success', 'notifier-error');
        iconSuccess.classList.remove('hidden'); // V11.0: info 也使用 success 图标
        iconError.classList.add('hidden');
    }

    // 触发动画显示
    requestAnimationFrame(() => {
        notifier.classList.remove('opacity-0', 'translate-x-[100%]');
    });

    // 设置自动隐藏
    notifierTimeout = setTimeout(() => {
        notifier.classList.add('opacity-0', 'translate-x-[100%]');
        // 动画结束后再隐藏
        setTimeout(() => notifier.classList.add('hidden'), 300); 
    }, duration);
}


// --- V11.0: 确认模态框 (替代 Confirm) ---

let modalResolve = null;

/**
 * V11.0: 显示确认模态框
 * @param {string} title 模态框标题
 * @param {string} message 模态框正文
 * @returns {Promise<boolean>} 用户点击 "确认" 时 resolve(true)，点击 "取消" 时 resolve(false)
 */
export function showConfirmModal(title, body) {
    const modal = document.getElementById('confirm-modal');
    const modalTitle = document.getElementById('confirm-modal-title');
    const modalMessage = document.getElementById('confirm-modal-message');

    if (!modal || !modalTitle || !modalMessage) {
        console.error('确认模态框的 DOM 元素未找到！');
        return Promise.resolve(false); // 自动拒绝
    }

    modalTitle.textContent = title;
    modalMessage.textContent = body;
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        // 将 resolve 函数存储在模块作用域，以便按钮点击时调用
        modalResolve = resolve;
    });
}

// V11.0: 在 DOM 加载后立即为模态框按钮绑定 *一次* 监听器
// V11.0 BUGFIX: 修复了函数命名
export function initializeModalControls() {
    const modal = document.getElementById('confirm-modal');
    const confirmBtn = document.getElementById('confirm-modal-ok-btn'); // V11.0: 修正了 ID
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn'); // V11.0: 修正了 ID

    if (!modal || !confirmBtn || !cancelBtn) return;

    const closeModal = (resolution) => {
        modal.classList.add('hidden');
        if (modalResolve) {
            modalResolve(resolution);
            modalResolve = null; // 清除
        }
    };

    confirmBtn.addEventListener('click', () => closeModal(true));
    cancelBtn.addEventListener('click', () => closeModal(false));
}


// --- 状态显示函数 (V10.0) ---

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
 * V11.0: 渲染主结果 (路由)
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function renderResults(results) {
    const { analysisMode } = results;

    // V11.0: 路由到
    if (analysisMode === 'bot') {
        renderBotResults(results); // 渲染 BOT 财务分析
    } else {
        renderCostComparisonResults(results); // 渲染 V10.0 成本对比
    }
    
    // 激活卡片动画
    setTimeout(() => {
        document.querySelectorAll('.result-card').forEach(card => card.classList.add('visible'));
    }, 10);
}

/**
 * V11.0: (新增) 渲染 BOT 模式的结果卡片
 * @param {object} results 
 */
function renderBotResults(results) {
    const { lccParams, botAnalysis, inputs } = results;
    const lccYears = lccParams.lccYears; // 项目周期
    const discountRate = lccParams.discountRate;

    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '';
    document.getElementById('results-title').textContent = `BOT 模式财务分析 (${lccYears}年)`;

    const { investment, irr, pbp, npv, equityIRR, equityPBP, equityNPV } = botAnalysis.summary;
    const irrColor = (irr > discountRate) ? 'text-green-600' : 'text-red-600';
    const npvColor = (npv > 0) ? 'text-green-600' : 'text-red-600';
    const pbpColor = (pbp !== null && pbp > 0) ? 'text-blue-600' : 'text-red-600';
    
    const equityIrrColor = (equityIRR > discountRate) ? 'text-green-600' : 'text-red-600';
    const equityNpvColor = (equityNPV > 0) ? 'text-green-600' : 'text-red-600';
    const equityPbpColor = (equityPBP !== null && equityPBP > 0) ? 'text-blue-600' : 'text-red-600';

    // **** 修复开始：此处为您添加了带备注的工具提示 (Tooltip) ****
    const botCardsHTML = `
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg result-card">
            <h3 class="font-bold text-lg text-blue-800">项目总投资 (万元)</h3>
            <p class="text-2xl font-bold text-blue-600">${fInvest(investment)}</p>
        </div>
        
        <div class="bg-gray-100 p-4 rounded-lg space-y-3 result-card" style="transition-delay: 50ms;">
            <h4 class="font-bold text-lg text-gray-800 border-b pb-2">项目全投资 (TIRR) 分析 <span class="text-sm font-normal text-gray-500">(看项目本身)</span></h4>
            <div class="space-y-1">

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        内部收益率 (IRR)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“这个项目本身好不好？”</b><br><br>TIRR (全投资IRR) 是把项目当成一个独立的生意来看的“年化收益率”，不管钱是借的还是自己的。<br><br><b>TIRR > 折现率(“及格线”)</b>，说明这个生意本身是赚钱的。</span>
                    </span>
                    <span class="font-bold ${irrColor}">${fPercent(irr)}</span>
                </div>

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        净现值 (NPV)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“项目最终是赚是赔？”</b><br><br>把项目${lccYears}年内赚的所有钱，折算成今天的钱，再减去总投资。<br><br><b>NPV > 0</b>，项目就可行 (即已超过及格线)。</span>
                    </span>
                    <span class="font-bold ${npvColor}">${fInvest(npv)} 万元</span>
                </div>

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        动态回收期 (PBP)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“多少年能收回总投资？”</b><br><br>考虑了利息和通胀后，“真正”需要多少年才能收回全部投资成本。</span>
                    </span>
                    <span class="font-bold ${pbpColor}">${fYears(pbp)}</span>
                </div>

            </div>
        </div>
        
        <div class="bg-gray-100 p-4 rounded-lg space-y-3 result-card" style="transition-delay: 100ms;">
            <h4 class="font-bold text-lg text-gray-800 border-b pb-2">项目资本金 (EIRR) 分析 <span class="text-sm font-normal text-gray-500">(看我们自己投的钱)</span></h4>
            <div class="space-y-1">

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        资本金内部收益率 (EIRR)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“我们自己能赚多少？”</b><br><br>EIRR 是<b>我们(投资者)自己掏的“本钱”</b>(那${fPercent(inputs.botEquityRatio, 0)})，能获得的“年化收益率”。<br><br><b>提示:</b> 因为加了银行贷款(杠杆)，这个值通常会高于项目的IRR，是我们最关心的指标。</span>
                    </span>
                    <span class="font-bold ${equityIrrColor}">${fPercent(equityIRR)}</span>
                </div>

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        资本金净现值 (ENPV)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“我们自己的钱能额外赚多少？”</b><br><br>我们自己掏的“本钱”，在${lccYears}年后，折算成今天，能“额外”赚多少钱。<br><br><b>ENPV > 0</b> 意味着我们自己的钱也达到了及格线。</span>
                    </span>
                    <span class="font-bold ${equityNpvColor}">${fInvest(equityNPV)} 万元</span>
                </div>

                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">
                        资本金动态回收期 (EPBP)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“多少年能收回本钱？”</b><br><br>我们自己掏的“本钱”，需要多少年才能收回。</span>
                    </span>
                    <span class="font-bold ${equityPbpColor}">${fYears(equityPBP)}</span>
                </div>

            </div>
        </div>
    `;
    // **** 修复结束 ****
    resultsContent.innerHTML = botCardsHTML;

    // --- Conclusion ---
    let conclusionHTML = `<div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg space-y-2 result-card" style="transition-delay: 150ms;">
        <h4 class="font-bold text-lg text-indigo-800 border-b pb-2">综合结论 (基于 ${lccYears} 年分析)</h4>`;

    if (irr > discountRate && npv > 0) {
        conclusionHTML += `<p class="text-sm text-gray-700"><b>项目全投资:</b> <b>可行。</b>项目TIRR (<b>${fPercent(irr)}</b>) 高于基准收益率 (${fPercent(discountRate)})，NPV 为正 (<b>${fInvest(npv)} 万元</b>)。</p>`;
    } else {
        conclusionHTML += `<p class="text-sm text-red-700"><b>项目全投资:</b> <b>不可行。</b>项目TIRR (<b>${fPercent(irr)}</b>) 低于基准收益率 (${fPercent(discountRate)})，NPV 为负 (<b>${fInvest(npv)} 万元</b>)。</p>`;
    }
    
    if (equityIRR > discountRate && equityNPV > 0) {
        conclusionHTML += `<p class="text-sm text-gray-700"><b>项目资本金:</b> <b>可行。</b>项目EIRR (<b>${fPercent(equityIRR)}</b>) 高于基准收益率 (${fPercent(discountRate)})，资本金动态回收期 <b>${fYears(equityPBP)}</b>。</p>`;
    } else {
         conclusionHTML += `<p class="text-sm text-red-700"><b>项目资本金:</b> <b>不可行。</b>项目EIRR (<b>${fPercent(equityIRR)}</b>) 低于基准收益率 (${fPercent(discountRate)})。</p>`;
    }
    conclusionHTML += '</div>';

    // --- Buttons ---
    conclusionHTML += `<button id="toggle-details-btn" class="w-full mt-4 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示详细财务报表 (年均)</button>`;
    conclusionHTML += `<button id="toggle-risk-btn" class="w-full mt-2 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示投资风险及对策分析</button>`;
    conclusionHTML += `<button id="printReportBtn" class="w-full mt-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-300 text-sm">打印本页报告 (A4)</button>`;
    conclusionHTML += `<div id="calculation-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;
    conclusionHTML += `<div id="risk-analysis-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;

    resultsContent.innerHTML += conclusionHTML;
}


/**
 * V11.0: (原 V10.0 renderResults) 渲染成本对比模式 (标准/混合)
 * @param {object} results 
 */
function renderCostComparisonResults(results) {
    const { lccParams, comparisons } = results;
    const hpSystemDetails = results.isHybridMode ? results.hybridSystem : results.hp;
    const lccYears = lccParams.lccYears;
    const discountRate = lccParams.discountRate;

    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '';
    document.getElementById('results-title').textContent = `静态、ROI 与 LCC (${lccYears}年) 对比分析结果`;

    const isHybrid = hpSystemDetails.isHybrid || false;
    // V11.0: 修正 V10 错别字
    const hpCardTitleStatic = isHybrid ? '混合系统年运行成本 (第1年)' : '工业热泵系统年运行成本 (第1年)';
    const hpCardTitleLCC = isHybrid ? `混合系统 LCC (${lccYears}年)` : `工业热泵系统 LCC (${lccYears}年)`;

    const hpCardStatic = `<div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg result-card"><h3 class="font-bold text-lg text-blue-800">${hpCardTitleStatic}</h3><p class="text-2xl font-bold text-blue-600">${fWan(hpSystemDetails.opex)} 万元</p></div>`;
    
    // **** 修复开始：为 LCC 卡片添加工具提示 ****
    const hpCardLCC = `
    <div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-lg result-card" style="transition-delay: 50ms;">
        <h3 class="font-bold text-lg text-blue-900 tooltip-container">
            ${hpCardTitleLCC}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“总的真实成本”</b>。<br><br>LCC = 初始投资 + (未来${lccYears}年所有运营成本 - ${lccYears}年后残值)<br><br>只看“初始投资”是短视的。LCC 低的方案，才是真正“划算”的方案。</span>
        </h3>
        <p class="text-2xl font-bold text-blue-700">${fWan(hpSystemDetails.lcc.total)} 万元</p>
    </div>`;
    // **** 修复结束 ****

    resultsContent.innerHTML += hpCardStatic + hpCardLCC;

    // --- Comparison Cards (Loop) ---
    comparisons.forEach((boiler, index) => {
        const npvColor = boiler.npv > 0 ? 'text-green-600' : 'text-red-600';
        const irrColor = boiler.irr > discountRate ? 'text-green-600' : (boiler.irr === null || !isFinite(boiler.irr) ? 'text-gray-500' : 'text-red-600');
        const paybackColor = boiler.dynamicPBP !== null ? 'text-blue-600' : 'text-red-600';
        const staticSavingColor = boiler.opexSaving > 0 ? 'text-green-600' : 'text-red-600';
        const energySavingColor = boiler.energyCostSaving > 0 ? 'text-green-600' : 'text-red-600'; 
        const simpleRoiColor = boiler.simpleROI !== null ? 'text-green-600' : 'text-gray-500';

        // **** 修复开始：为 LCC 标题行添加工具提示 ****
        const resultCard = `
        <div class="bg-gray-100 p-4 rounded-lg space-y-3 result-card" style="transition-delay: ${100 * (index + 1)}ms;">
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
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“项目最终是赚是赔？”</b><br><br>把未来${lccYears}年所有省的钱，折算成今天的钱，再减去今天多花的投资。<br><br><b>NPV > 0</b>，说明赚的钱超过了“及格线”（${fPercent(discountRate, 0)}）。</span>
                    </span>
                    <span class="font-bold ${npvColor}">${fWan(boiler.npv)} 万元</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-700 tooltip-container">内部收益率 (IRR)
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“这项投资的年化收益率”</b><br><br>对比锅炉，我们多花了钱（额外投资），每年也多省了钱。IRR 就是这笔“额外投资”带来的“年化回报”。<br><br><b>IRR > 折现率(${fPercent(discountRate, 0)})</b>，这笔投资就值。</span>
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
                        <span class="tooltip-text" style="width: 320px; margin-left: -160px;"><b>“工业热泵产热有多便宜？”</b><br><br>EPR = (锅炉产1度热的成本) / (工业热泵产1度热的成本)<br><br><b>EPR = 2.0</b> 意味着工业热泵的产热成本<b>只有</b>锅炉的 50%。<b>EPR 越高越好</b>。</span>
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
                    <span class="text-gray-600">基准年能源消耗:</span>
                    <span class="font-semibold text-gray-700 text-right">${fNum(boiler.consumption, 2)} ${boiler.consumptionUnit}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">年碳减排量:</span>
                    <span class="font-semibold text-green-600 text-right">${fTon(boiler.co2Reduction)} 吨 CO₂</span>
                    </div>
            </div>
            <div class="space-y-1 pt-2 border-t">
                <h5 class="font-semibold text-gray-700 text-md tooltip-container">视角: 全生命周期成本 (LCC)
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span class="tooltip-text" style="width: 300px; margin-left: -150px;"><b>“总的真实成本”</b>。<br><br>LCC = 初始投资 + (未来${lccYears}年所有运营成本 - ${lccYears}年后残值)<br><br>只看“初始投资”是短视的。LCC 低的方案，才是真正“划算”的方案。</span>
                </h5>
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
        // **** 修复结束 ****
        resultsContent.innerHTML += resultCard;
    });

    // --- Conclusion ---
    let conclusionHTML = `<div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg space-y-2 result-card" style="transition-delay: ${100 * (comparisons.length + 1)}ms;"><h4 class="font-bold text-lg text-indigo-800 border-b pb-2">综合结论 (基于 ${lccYears} 年分析)</h4>`;

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
        
        // **** BUG 修复开始 ****
        // 旧代码: ${bestEnviro.co2Reduction.toFixed(2)}
        conclusionHTML += `<p class="text-sm text-gray-700"><b>环境效益 (年)：</b>替代 <b>${bestEnviro.name}</b> 的环境效益最为显著，年碳减排量可达 <b>${fTon(bestEnviro.co2Reduction)}</b> 吨CO₂，相当于植树约 <b>${fInt(bestEnviro.treesPlanted)}</b> 棵。</p>`;
        // **** BUG 修复结束 ****

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
}


/**
 * V11.0: 填充 "详细计算过程" (路由)
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function populateCalculationDetails(results) {
    if (results.analysisMode === 'bot') {
        populateBotCalculationDetails(results);
    } else {
        populateCostComparisonCalculationDetails(results); // Renamed V10.0
    }
}

/**
 * V11.0: (新增) 填充 BOT 模式的详细计算过程
 * @param {object} results 
 */
function populateBotCalculationDetails(results) {
    const { botAnalysis, lccParams, inputs } = results;
    const { summary, annualAvg } = botAnalysis;
    const { investment, equity, loan, energyCost, opexCost, depreciation, interest, surtax, totalCost, profitBeforeTax, incomeTax, netProfit, revenue } = annualAvg;

    let detailsHTML = `
        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">A. 核心财务指标 (全周期, ${lccParams.lccYears} 年)</h3>
        <table class="print-report-table w-full mb-6">
            <thead><tr><th>指标</th><th class="align-right">全投资 (TIRR)</th><th class="align-right">资本金 (EIRR)</th></tr></thead>
            <tbody>
                <tr><td>内部收益率 (IRR)</td><td class="align-right">${fPercent(summary.irr)}</td><td class="align-right">${fPercent(summary.equityIRR)}</td></tr>
                <tr><td>净现值 (NPV) (万元)</td><td class="align-right">${fInvest(summary.npv)}</td><td class="align-right">${fInvest(summary.equityNPV)}</td></tr>
                <tr><td>动态回收期 (PBP) (年)</td><td class="align-right">${fYears(summary.pbp)}</td><td class="align-right">${fYears(summary.equityPBP)}</td></tr>
            </tbody>
        </table>

        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">B. 投资估算表 (万元)</h3>
        <table class="print-report-table w-full mb-6">
            <thead><tr><th>项目</th><th class="align-right">金额 (万元)</th><th>备注</th></tr></thead>
            <tbody>
                <tr><td>工业热泵主机投资</td><td class="align-right">${fInvest(inputs.hpHostCapex / 10000)}</td><td></td></tr>
                <tr><td>储能系统投资</td><td class="align-right">${fInvest(inputs.hpStorageCapex / 10000)}</td><td></td></tr>
                <tr class="font-bold"><td>A. 项目总投资</td><td class="align-right">${fInvest(summary.investment)}</td><td></td></tr>
                <tr><td>B. 资本金 (自有)</td><td class="align-right">${fInvest(summary.equity)}</td><td>总投资 * ${fPercent(inputs.botEquityRatio, 0)}</td></tr>
                <tr><td>C. 银行贷款 (负债)</td><td class="align-right">${fInvest(summary.loan)}</td><td>总投资 * ${fPercent(1 - inputs.botEquityRatio, 0)}</td></tr>
            </tbody>
        </table>

        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">C. 利润与利润分配表 (${lccParams.lccYears} 年均值, 万元)</h3>
        <table class="print-report-table w-full mb-6">
            <tbody>
                <tr><td><b>A. 年销售收入</b></td><td class="align-right"><b>${fInvest(revenue)}</b></td><td></td></tr>
                <tr><td class="pl-6">减: 增值税 (销项)</td><td class="align-right">${fInvest(annualAvg.vat)}</td><td>(总收入 / (1 + ${fPercent(inputs.botVatRate, 0)})) * ${fPercent(inputs.botVatRate, 0)}</td></tr>
                <tr><td><b>B. 营业收入 (不含税)</b></td><td class="align-right"><b>${fInvest(annualAvg.revenueNetVat)}</b></td><td></td></tr>
                <tr><td><b>C. 总成本费用</b></td><td class="align-right"><b>${fInvest(totalCost)}</b></td><td></td></tr>
                <tr><td class="pl-6">1. 能源成本 (电费)</td><td class="align-right">${fInvest(energyCost)}</td><td></td></tr>
                <tr><td class="pl-6">2. 运维成本 (O&M)</td><td class="align-right">${fInvest(opexCost)}</td><td></td></tr>
                <tr><td class="pl-6">3. 折旧费用</td><td class="align-right">${fInvest(depreciation)}</td><td>总投资 / ${inputs.botDepreciationYears} 年</td></tr>
                <tr><td class="pl-6">4. 利息支出</td><td class="align-right">${fInvest(interest)}</td><td>基于贷款余额计算</td></tr>
                <tr><td class="pl-6">5. 税金及附加</td><td class="align-right">${fInvest(surtax)}</td><td>增值税 * ${fPercent(inputs.botSurtaxRate)}</td></tr>
                <tr><td><b>D. 利润总额 (EBIT)</b></td><td class="align-right"><b>${fInvest(profitBeforeTax)}</b></td><td>B - C</td></tr>
                <tr><td class="pl-6">减: 企业所得税</td><td class="align-right">${fInvest(incomeTax)}</td><td>利润总额 * ${fPercent(inputs.botIncomeTaxRate)}</td></tr>
                <tr class="font-bold"><td>E. 净利润</td><td class="align-right font-bold">${fInvest(netProfit)}</td><td>D - 所得税</td></tr>
            </tbody>
        </table>
    `;
    
    document.getElementById('calculation-details').innerHTML = detailsHTML;
}


/**
 * V11.0: (原 V10.0 populateCalculationDetails) 填充成本对比模式的计算过程
 * @param {object} results 
 */
function populateCostComparisonCalculationDetails(results) {
    // V11.0 BUGFIX: 此处解构时遗漏了 hybridInputs
    const { isHybridMode, lccParams, hp, gas, fuel, coal, biomass, electric, steam, annualHeatingDemandKWh, hybridSystem, hybrid_aux, inputs, hybridInputs } = results;
    
    // V11.0: 修正了 gridFactor 的获取方式
    const gridFactorBase = inputs.gridFactor; // V11.0: 直接从 inputs 读取 baseValue
    const gridFactorToDisplay = inputs.isGreenElectricity ? 0 : gridFactorBase;
    const gridFactorLabel = inputs.isGreenElectricity ? '绿电因子' : '电网因子';

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
        // V11.0 BUGFIX: `hybridInputs` 现在已从 results 中解构
        const hpLoadSharePercent = (hybridInputs.hybridLoadShare * 100).toFixed(1);
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
            <p><b>工业热泵制热量:</b> ${fNum(annualHeatingDemandKWh * hybridInputs.hybridLoadShare, 0)} kWh</p>
            <p><b>年总电耗:</b> ${fNum(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0), 0)} kWh</p>
            ${hp.energyCostDetails.tiers.map(t => `<p class="pl-4">↳ <b>${t.name}:</b> ${fNum(t.elec, 0)} kWh * ${t.price} 元/kWh = ${fYuan(t.cost)} 元</p>`).join('')}
            <p><b>年能源成本 (工业热泵):</b> ${fYuan(hp.energyCost)} 元</p>
            <p><b>年运维(O&M)成本 (工业热泵):</b> ${fYuan(hp.opexCost)} 元</p>
            <p><b>年碳排放量 (工业热泵):</b> ${fNum(hp.co2, 0)} kg</p>
            <h4 class="font-bold text-md text-gray-800" style="color: #7f1d1d;">2b. 混合系统 - 辅助热源 (${hybrid_aux.name}, 承担 ${auxLoadSharePercent}% 负荷)</h4>
            <p><b>辅助热源制热量:</b> ${fNum(annualHeatingDemandKWh * (1.0 - hybridInputs.hybridLoadShare), 0)} kWh</p>
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
                    <p class="pl-4"><b>EPR (电热价格比):</b> ${boiler.cost_per_kwh_heat.toFixed(4)} / ${hybridSystem.cost_per_kwh_heat.toFixed(4)} = <b>${c.electricalPriceRatio ? c.electricalPriceRatio.toFixed(2) : 'N/A'}</b></p>
                    <p class="pl-4"><b>年碳减排量:</b> (${fNum(boiler.co2, 0)} - ${fNum(hybridSystem.co2, 0)}) kg = <b>${fNum(c.co2Reduction, 0)} kg</b></p>
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
 * 填充 "投资风险分析" (V10.0, 暂未修改)
 * V11.0: 增加 analysisMode 参数
 */
// **** 修复开始 ****
// export function populateRiskAnalysisDetails() { // <-- 这是错误的代码
export function populateRiskAnalysisDetails(analysisMode) { // <-- 这是修正后的代码，增加了 analysisMode 参数
// **** 修复结束 ****
    let riskHTML = '';
    
    if (analysisMode === 'bot') {
        // --- BOT 模式专属风险 ---
        riskHTML = `
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">BOT 模式投资风险及对策分析</h3>
            <h4>1. 财务与市场风险</h4>
            <ul class="list-disc list-inside text-sm space-y-1">
                <li><b>风险 (收入不及预期):</b> 客户用热量未达标，或能源销售单价（热价）低于预期，导致年销售收入（${fWan(document.getElementById('botAnnualRevenue').value)} 万）无法实现。</li>
                <li><b>对策:</b> <b>(1) 签订“照付不议”合同:</b> 与客户约定最低用热量，未达到也需按约定付费。<b>(2) 价格联动:</b> 合同中应包含能源价格（电价）与销售热价的联动条款，当电价上涨时，热价也随之上涨。</li>
                <li><b>风险 (成本失控):</b> 电价（尤其是峰谷电价）涨幅超过预期，或 SPF 未达标导致电耗过高，压缩利润空间。</li>
                <li><b>对策:</b> <b>(1) 精确测算 SPF:</b> 必须使用全年综合性能系数(SPF)而非名义COP来估算电费成本。<b>(2) 敏感性分析:</b> 测算电价上涨 10%、20% 时对项目TIRR和EIRR的影响。</li>
            </ul>
            <h4>2. 融资与现金流风险</h4>
            <ul class="list-disc list-inside text-sm space-y-1">
                <li><b>风险 (利率风险):</b> 贷款利率（${fPercent(document.getElementById('botLoanInterestRate').value / 100)}）在运营期内上浮，导致利息支出增加，侵蚀净利润。</li>
                <li><b>对策:</b> <b>(1) 锁定利率:</b> 尽量争取固定利率贷款合同。<b>(2) 压力测试:</b> 测算利率上浮 1%、2% 时的财务数据。</li>
                <li><b>风险 (回收期过长):</b> 项目动态回收期（PBP）过长，导致资本金占用时间久，现金流压力大。</li>
                <li><b>对策:</b> <b>(1) 优化资本结构:</b> 适当提高财务杠杆（贷款比例），在EIRR高于贷款利率时，可显著提高资本金收益率(EIRR)。<b>(2) 加速折旧:</b> 在政策允许下，采用双倍余额递减法等加速折旧方式，前期多抵扣所得税，改善现金流。</li>
            </ul>
        `;
        
    } else {
        // --- 成本对比模式 (V10.0 风险) ---
        riskHTML = `
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">工业热泵投资风险及对策分析 (成本对比)</h3>
            <h4>1. 政策与市场风险</h4>
            <ul class="list-disc list-inside text-sm space-y-1">
                <li><b>风险 (电价波动):</b> "峰谷尖"电价政策调整，尤其是谷电价格上涨或峰电涨幅不及预期，可能导致工业热泵（特别是带储能的）运行成本高于预期，拉长投资回收期。</li>
                <li><b>对策:</b> <b>(1) 精确评估:</b> 在LCC计算时，应采用（加权平均电价）或（分时电价模型）进行精确测算。<b>(2) 敏感性分析:</b> 测算电价上涨 10%、20% 时对IRR和PBP的影响。<b>(3) 绿电合约:</b> 探索与发电企业签订长期购电协议 (PPA)，锁定未来电价成本。</li>
            </ul>
            <h4>2. 技术与运行风险</h4>
            <ul class="list-disc list-inside text-sm space-y-1">
                <li><b>风险 (性能衰减/SPF不达标):</b> 工业热泵在极端天气下制热能力下降，或全年综合能效系数(SPF)低于设计值，导致实际运行电耗过高。</li>
                <li><b>对策:</b> <b>(1) 选型匹配:</b> 必须基于项目地最冷月平均工况进行主机选型。<b>(2) 耦合设计 (模式二):</b> 采用“工业热泵 + 辅助热源”的耦合方案，保障极端工况。<b>(3) 明确SPF:</b> 投标和设计阶段应明确SPF的计算边界（是否包含水泵、辅热等）。</li>
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
    }
    document.getElementById('risk-analysis-details').innerHTML = riskHTML;
}

/**
 * V11.0: 构建并填充 "打印报告" (路由)
 * @param {object} results - 来自 core-calculator 的完整计算结果
 */
export function buildPrintReport(results) {
    if (results.analysisMode === 'bot') {
        buildBotPrintReport(results);
    } else {
        buildCostComparisonPrintReport(results); // Renamed V10.0
    }
}

/**
 * V11.0: (新增) 构建 BOT 模式的打印报告
 * @param {object} results 
 */
function buildBotPrintReport(results) {
    const { inputs, lccParams, botAnalysis } = results;
    const { summary, annualAvg } = botAnalysis;

    const projectName = inputs.projectName || "未命名项目";
    const reportDate = new Date().toLocaleString('zh-CN');
    let reportHTML = `
        <div class="print-report-header">
            <h2>${projectName} 项目</h2>
            <h1>BOT 模式财务分析报告</h1>
            <p>报告日期: ${reportDate}</p>
        </div>
        
        <div class="print-report-section">
            <h3>1. 核心输入参数</h3>
            <table class="print-report-table">
                <tr><td class="col-param">项目名称</td><td>${projectName}</td></tr>
                <tr><td class="col-param">经济分析年限 (年)</td><td class="align-right">${lccParams.lccYears}</td></tr>
                <tr><td class="col-param">折现率 (基准收益率)</td><td class="align-right">${fPercent(lccParams.discountRate, 1)}</td></tr>
                <tr><td class="col-param">项目总投资 (万元)</td><td class="align-right">${fInvest(summary.investment)}</td></tr>
                <tr><td class="col-param">资本金比例</td><td class="align-right">${fPercent(inputs.botEquityRatio, 1)}</td></tr>
                <tr><td class="col-param">贷款利率</td><td class="align-right">${fPercent(inputs.botLoanInterestRate, 1)}</td></tr>
                <tr><td class="col-param">年销售收入 (万元)</td><td class="align-right">${fInvest(inputs.botAnnualRevenue / 10000)}</td></tr>
            </table>
        </div>

        <div class="print-report-section">
            <h3>2. 核心财务指标 (全周期)</h3>
            <table class="print-report-table">
                <thead><tr><th>指标</th><th class="align-right">全投资 (TIRR)</th><th class="align-right">资本金 (EIRR)</th></tr></thead>
                <tbody>
                    <tr><td>内部收益率 (IRR)</td><td class="align-right">${fPercent(summary.irr)}</td><td class="align-right">${fPercent(summary.equityIRR)}</td></tr>
                    <tr><td>净现值 (NPV) (万元)</td><td class="align-right">${fInvest(summary.npv)}</td><td class="align-right">${fInvest(summary.equityNPV)}</td></tr>
                    <tr><td>动态回收期 (PBP) (年)</td><td class="align-right">${fYears(summary.pbp)}</td><td class="align-right">${fYears(summary.equityPBP)}</td></tr>
                </tbody>
            </table>
        </div>

        <div class="print-report-section">
            <h3>3. 利润与利润分配表 (${lccParams.lccYears} 年均值, 万元)</h3>
            <table class="print-report-table">
                <tbody>
                    <tr><td class="col-param"><b>A. 年销售收入</b></td><td class="align-right"><b>${fInvest(annualAvg.revenue)}</b></td></tr>
                    <tr><td class="col-param pl-6">减: 增值税 (销项)</td><td class="align-right">${fInvest(annualAvg.vat)}</td></tr>
                    <tr><td class="col-param"><b>B. 营业收入 (不含税)</b></td><td class="align-right"><b>${fInvest(annualAvg.revenueNetVat)}</b></td></tr>
                    <tr><td class="col-param"><b>C. 总成本费用</b></td><td class="align-right"><b>${fInvest(annualAvg.totalCost)}</b></td></tr>
                    <tr><td class="col-param pl-6">1. 能源成本 (电费)</td><td class="align-right">${fInvest(annualAvg.energyCost)}</td></tr>
                    <tr><td class="col-param pl-6">2. 运维成本 (O&M)</td><td class="align-right">${fInvest(annualAvg.opexCost)}</td></tr>
                    <tr><td class="col-param pl-6">3. 折旧费用</td><td class="align-right">${fInvest(annualAvg.depreciation)}</td></tr>
                    <tr><td class="col-param pl-6">4. 利息支出</td><td class="align-right">${fInvest(annualAvg.interest)}</td></tr>
                    <tr><td class="col-param pl-6">5. 税金及附加</td><td class="align-right">${fInvest(annualAvg.surtax)}</td></tr>
                    <tr><td class="col-param"><b>D. 利润总额 (EBIT)</b></td><td class="align-right"><b>${fInvest(annualAvg.profitBeforeTax)}</b></td></tr>
                    <tr><td class="col-param pl-6">减: 企业所得税</td><td class="align-right">${fInvest(annualAvg.incomeTax)}</td></tr>
                    <tr class="font-bold"><td class="col-param"><b>E. 净利润</b></td><td class="align-right"><b>${fInvest(annualAvg.netProfit)}</b></td></tr>
                </tbody>
            </table>
        </div>
        
        <div class="print-report-footer">
            <p>注：全寿命周期成本(LCC)与ROI计算基于净现值(NPV)法，符合《建设项目经济评价方法与参数》相关规定。</p>
            <p>本程序已尽力确保正确，但不承担相关法律责任，App bug 请联系荆炎荣 15280122625。</p>
        </div>
    `;
    
    document.getElementById('print-report-container').innerHTML = reportHTML;
}


/**
 * V11.0: (原 V10.0 buildPrintReport) 构建成本对比模式的打印报告
 * @param {object} results 
 */
function buildCostComparisonPrintReport(results) {
    // V11.0 BUGFIX: 此处也遗漏了 hybridInputs
    const { isHybridMode, lccParams, hp, comparisons, inputs, hybridSystem, hybridInputs } = results;

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
        // V11.0 BUGFIX: 此处原为 results.hybridInputs
        // const { hybridInputs } = results; 
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
                            <td><strong>方案A: ${hybridSystem.name}</strong><br><small>(工业热泵 ${fPercent(hybridInputs.hybridLoadShare, 0)} + ${results.hybrid_aux.name} ${fPercent(1-hybridInputs.hybridLoadShare, 0)})</small></td>
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
                            <th class="align-right">基准年能耗</th>
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
                    <td class="align-right">${fNum(c.consumption, 2)} ${c.consumptionUnit}</td>
                    <td class="align-right">${fTon(c.co2Reduction)}</td>
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
                            <th class="align-right">基准年能耗</th>
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
                    <td class="align-right">${fNum(c.consumption, 2)} ${c.consumptionUnit}</td>
                    <td class="align-right">${fTon(c.co2Reduction)}</td>
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