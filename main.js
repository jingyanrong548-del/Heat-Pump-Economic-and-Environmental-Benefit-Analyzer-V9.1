// main.js
import { initializeInputSetup, readAllInputs } from './ui-setup.js';
import { initializeScenarioControls, saveHpScenario } from './ui-scenario.js';
import * as uiRenderer from './ui-renderer.js';
import { runAnalysis } from './core-calculator.js';

// --- 核心状态 ---
let detailedCalculations = {}; // 存储上一次的计算结果
let resultsAreShown = false;
let resultsAreStale = false;


/**
 * 标记结果为陈旧
 * (此函数将作为回调传递给 ui-setup)
 */
function markResultsAsStale() {
    if (resultsAreShown) {
        resultsAreStale = true;
        uiRenderer.setStaleDisplay(true);
        uiRenderer.setSaveButtonState('disabled', '暂存当前工业热泵方案 (请先计算)');
    }
}

/**
 * 主计算按钮的点击事件
 */
function onCalculateClick() {
    // 1. 清除陈旧状态
    uiRenderer.setStaleDisplay(false);

    // 2. 从DOM读取所有输入并验证
    // V11.0 更新：传入 showGlobalNotification 替换 readAllInputs 内部的 alert
    const inputs = readAllInputs(
        uiRenderer.showPriceTierError, 
        uiRenderer.showGlobalNotification
    );
    if (!inputs) {
        return; // 验证失败
    }

    // 3. 运行核心计算 (纯函数)
    const results = runAnalysis(inputs);
    
    // 4. 存储状态
    detailedCalculations = results;
    resultsAreShown = true;
    resultsAreStale = false;

    // 5. 渲染结果
    uiRenderer.showResults(true);
    uiRenderer.renderResults(results);

    // 6. 绑定计算后才出现的按钮
    bindPostCalculationButtons(results);
    
    // 7. 激活暂存按钮 (如果不是 BOT 模式)
    if (results.analysisMode !== 'bot') {
        uiRenderer.setSaveButtonState('enabled');
    } else {
        uiRenderer.setSaveButtonState('disabled', 'BOT 模式不支持暂存');
    }
}

/**
 * 绑定 "详情"、"风险"、"打印" 和 "暂存" 按钮
 * @param {object} results - 完整的计算结果
 */
function bindPostCalculationButtons(results) {
    // V11.0: 增加 analysisMode
    const { inputs, comparisons, isHybridMode, analysisMode } = results; 
    
    // V11.0: 检查 analysisMode，如果是 BOT，则 hpSystemDetails 为 hp 本身 (尽管暂存已禁用，但保证逻辑完整)
    const hpSystemDetails = (analysisMode === 'bot') ? results.hp : (isHybridMode ? results.hybridSystem : results.hp);

    // 详情
    document.getElementById('toggle-details-btn').addEventListener('click', (e) => {
        const details = document.getElementById('calculation-details');
        const isVisible = details.classList.toggle('visible');
        e.target.textContent = isVisible ? '隐藏详细计算过程 (含公式)' : '显示详细计算过程 (含公式)';
        if (isVisible) uiRenderer.populateCalculationDetails(detailedCalculations);
    });

    // 风险
    document.getElementById('toggle-risk-btn').addEventListener('click', (e) => {
        const details = document.getElementById('risk-analysis-details');
        const isVisible = details.classList.toggle('visible');
        e.target.textContent = isVisible ? '隐藏投资风险及对策分析' : '显示投资风险及对策分析';
        if (isVisible) uiRenderer.populateRiskAnalysisDetails(analysisMode); // V11.0: 传入模式
    });

    // 打印
    document.getElementById('printReportBtn').addEventListener('click', () => {
        uiRenderer.buildPrintReport(detailedCalculations);
        window.print();
    });

    // 暂存 (需要克隆按钮以移除旧监听器)
    const saveBtn = document.getElementById('saveScenarioBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
        const projectName = inputs.projectName || '未命名方案';
        const hpCop = inputs.hpCop;
        
        // V11.0 更新：BOT 模式暂存逻辑待定，目前只处理成本对比模式
        if (analysisMode === 'bot') {
            uiRenderer.showGlobalNotification('BOT 模式的方案暂存功能正在开发中', 'info');
            return;
        }

        if (hpSystemDetails && comparisons && comparisons.length > 0) {
            // 寻找一个基准进行对比，优先使用天然气
            const baselineComparison = comparisons.find(c => c.key === 'gas') || comparisons[0];
            saveHpScenario(projectName, hpSystemDetails, hpCop, baselineComparison);
            uiRenderer.setSaveButtonState('saved');
        } else if (hpSystemDetails && (!comparisons || comparisons.length === 0)) {
             // V11.0 更新：替换 alert
             uiRenderer.showGlobalNotification('无法暂存，因为没有勾选任何对比方案。', 'error');
        } else {
            // V11.0 更新：替换 alert
            uiRenderer.showGlobalNotification('无法暂存，计算数据不存在。', 'error');
        }
    });
}


// --- 应用程序入口 ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化所有输入控件的监听器
    // V11.0: 传入 showGlobalNotification 以替换 price tier 内部的 alert
    initializeInputSetup(
        markResultsAsStale,
        uiRenderer.showGlobalNotification 
    );
    
    // 2. 初始化 "多方案对比" 功能模块
    // V11.0 更新：传入模态框和通知栏句柄，以替换 confirm 和 alert
    initializeScenarioControls(
        uiRenderer.showConfirmModal,
        uiRenderer.showGlobalNotification
    );

    // 3. 绑定主计算按钮
    document.getElementById('calculateBtn').addEventListener('click', onCalculateClick);
    
    // V11.0: 为模态框按钮绑定全局监听器 (在 ui-renderer 中)
    uiRenderer.initializeModalControls();
});

