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
    const inputs = readAllInputs(uiRenderer.showPriceTierError);
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
    
    // 7. 激活暂存按钮
    uiRenderer.setSaveButtonState('enabled');
}

/**
 * 绑定 "详情"、"风险"、"打印" 和 "暂存" 按钮
 * @param {object} results - 完整的计算结果
 */
function bindPostCalculationButtons(results) {
    const { inputs, comparisons, isHybridMode } = results;
    const hpSystemDetails = isHybridMode ? results.hybridSystem : results.hp;

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
        if (isVisible) uiRenderer.populateRiskAnalysisDetails(); // 只在第一次展开时填充
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
        
        if (hpSystemDetails && comparisons.length > 0) {
            // 寻找一个基准进行对比，优先使用天然气
            const baselineComparison = comparisons.find(c => c.key === 'gas') || comparisons[0];
            saveHpScenario(projectName, hpSystemDetails, hpCop, baselineComparison);
            uiRenderer.setSaveButtonState('saved');
        } else if (hpSystemDetails && comparisons.length === 0) {
             // V11.1 BUG修复: 移除 alert()
             uiRenderer.setSaveButtonState('disabled', '无法暂存 (无对比方案)');
             setTimeout(() => {
                 if (resultsAreStale) {
                    uiRenderer.setSaveButtonState('disabled', '暂存当前工业热泵方案 (请先计算)');
                 } else {
                    uiRenderer.setSaveButtonState('enabled');
                 }
             }, 2500);
        } else {
             // V11.1 BUG修复: 移除 alert()
             console.error("Save failed: hpSystemDetails is missing.");
             uiRenderer.setSaveButtonState('disabled', '无法暂存 (计算数据丢失)');
        }
    });
}


// --- 应用程序入口 ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化所有输入控件的监听器
    initializeInputSetup(markResultsAsStale);
    
    // 2. 初始化 "多方案对比" 功能模块
    initializeScenarioControls();

    // 3. 绑定主计算按钮
    document.getElementById('calculateBtn').addEventListener('click', onCalculateClick);
});

