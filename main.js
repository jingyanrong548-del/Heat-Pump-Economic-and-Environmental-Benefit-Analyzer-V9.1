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
 * (V11.4 新增) 在按钮上方显示/隐藏通用错误
 * @param {string | null} message 
 */
function showGlobalError(message) {
    const errorDiv = document.getElementById('stale-results-notice');
    if (!errorDiv) return;
    if (message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    } else {
        errorDiv.classList.add('hidden');
    }
}


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
    // 1. 清除所有错误状态
    uiRenderer.setStaleDisplay(false);
    showGlobalError(null); // (V11.4) 清除通用错误
    uiRenderer.showPriceTierError(null); // V11.5: 明确清除内部电价错误

    // 2. 从DOM读取所有输入 (V11.5: 此处不再验证)
    const inputs = readAllInputs();

    // 3. (V11.5) 在此处进行 *所有* 验证
    
    // 3a. 验证通用参数
    if (!inputs.heatingLoad || !inputs.operatingHours || !inputs.hpCop) {
        showGlobalError('关键参数（制热负荷、运行小时、SPF/COP）必须大于 0！');
        return; // 验证失败 (通用参数)
    }

    // 3b. 验证电价时段 (逻辑从 ui-setup.js 移至此处)
    if (inputs.priceTiers.length === 0) {
        showGlobalError('错误：必须至少有一个电价时段！'); // V11.5: 使用 showGlobalError
        return;
    }
    if (Math.abs(inputs.totalPriceTierDistribution - 100) > 0.1) {
        // V11.5: 使用 showGlobalError
        showGlobalError(`电价时段总比例必须为 100%，当前为 ${inputs.totalPriceTierDistribution.toFixed(1)}%！`);
        return;
    }
    if (inputs.priceTiers.some(t => t.price <= 0 || t.dist <= 0)) {
        showGlobalError('电价时段的电价和比例必须大于 0！'); // V11.5: 使用 showGlobalError
        return;
    }

    // 4. 运行核心计算 (纯函数)
    const results = runAnalysis(inputs);
    
    // 5. 存储状态
    detailedCalculations = results;
    resultsAreShown = true;
    resultsAreStale = false;

    // 6. 渲染结果
    uiRenderer.showResults(true);
    uiRenderer.renderResults(results);

    // 7. 绑定计算后才出现的按钮
    bindPostCalculationButtons(results);
    
    // 8. 激活暂存按钮
    uiRenderer.setSaveButtonState('enabled');
}

/**
 * 绑定 "详情"、"风险"、"打印" 和 "暂存" 按钮
 * @param {object} results - 完整的计算结果
 */
function bindPostCalculationButtons(results) {
// ... existing code ...
    document.getElementById('toggle-details-btn').addEventListener('click', (e) => {
// ... existing code ...
    });

    // 风险
// ... existing code ...
    document.getElementById('toggle-risk-btn').addEventListener('click', (e) => {
// ... existing code ...
    });

    // 打印
// ... existing code ...
    document.getElementById('printReportBtn').addEventListener('click', () => {
// ... existing code ...
    });

// ... (文件其余部分与您上传的 V11.4 main.js 相同) ...
// ... existing code ...
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
// ... existing code ...
        const hpCop = inputs.hpCop;
        
        if (hpSystemDetails && comparisons.length > 0) {
// ... existing code ...
            saveHpScenario(projectName, hpSystemDetails, hpCop, baselineComparison);
            uiRenderer.setSaveButtonState('saved');
        } else if (hpSystemDetails && comparisons.length === 0) {
// ... existing code ...
             uiRenderer.setSaveButtonState('disabled', '无法暂存 (无对比方案)');
             setTimeout(() => {
// ... existing code ...
                 if (resultsAreStale) {
// ... existing code ...
                 } else {
                    uiRenderer.setSaveButtonState('enabled');
                 }
             }, 2500);
        } else {
// ... existing code ...
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