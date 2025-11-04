// ui-scenario.js
import { fWan, fTon, fCop, fPercent, fYears } from './utils.js';

// --- 模块内部状态 ---
let savedScenarios = [];
let lastSavedScenarios = []; // 用于恢复

// --- 私有辅助函数 ---

/**
 * 将暂存的方案渲染到UI表格中
 */
function renderScenarioTable() {
    const container = document.getElementById('scenario-comparison-container');
    const tableWrapper = document.getElementById('scenario-table-wrapper'); 
    const tableBody = document.getElementById('scenario-comparison-table').querySelector('tbody');
    const summaryContainer = document.getElementById('scenario-summary');
    const scenarioToggle = document.getElementById('enableScenarioComparison');
    const clearBtn = document.getElementById('clearScenariosBtn');
    const undoBtn = document.getElementById('undoClearBtn');

    if (!scenarioToggle.checked) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden'); 

    if (savedScenarios.length === 0) {
        tableWrapper.classList.add('hidden'); 
        summaryContainer.classList.add('hidden');
        
        if (lastSavedScenarios.length > 0) {
            clearBtn.classList.add('hidden');
            undoBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden'); 
            undoBtn.classList.add('hidden');
        }
        return; 
    }

    tableWrapper.classList.remove('hidden'); 
    summaryContainer.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
    undoBtn.classList.add('hidden');

    tableBody.innerHTML = '';
    summaryContainer.innerHTML = '';

    const minLCC = Math.min(...savedScenarios.map(s => s.lcc));

    savedScenarios.forEach((s, index) => {
        const isBestLCC = s.lcc === minLCC;
        const row = document.createElement('tr');
        row.className = isBestLCC ? 'bg-green-50' : '';
        
        row.innerHTML = `
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium ${isBestLCC ? 'text-green-900' : 'text-gray-900'}">${s.name}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.totalCapex)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.hpCapex)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.storageCapex)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fCop(s.hpCop)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.opex)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm ${isBestLCC ? 'font-bold text-green-700' : 'text-gray-700'}">${fWan(s.lcc)} ${isBestLCC ? ' (LCC最优)' : ''}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${s.baselineName}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-700">${fYears(s.dynamicPBP)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-700">${fPercent(s.irr)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-green-700">${fTon(s.co2)}</td>
        `;
        tableBody.appendChild(row);
    });

    if (savedScenarios.length > 0) {
        let summaryHTML = '<h4 class="text-lg font-semibold text-indigo-900 mb-2">对比总结</h4>';
        
        const bestLCC = savedScenarios.reduce((p, c) => (p.lcc < c.lcc) ? p : c);
        summaryHTML += `<p>• <b>LCC (全寿命周期成本) 最优:</b> 方案 "<b>${bestLCC.name}</b>"，总成本为 <b>${fWan(bestLCC.lcc)} 万元</b>。</p>`;

        const validIRRs = savedScenarios.filter(s => s.irr !== null && isFinite(s.irr));
        if (validIRRs.length > 0) {
            const bestIRR = validIRRs.reduce((p, c) => (p.irr > c.irr) ? p : c);
            summaryHTML += `<p>• <b>IRR (内部收益率) 最高:</b> 方案 "<b>${bestIRR.name}</b>"，IRR 高达 <b>${fPercent(bestIRR.irr)}</b> (对比${bestIRR.baselineName})。</p>`;
        } else {
            summaryHTML += `<p>• <b>IRR (内部收益率):</b> 无有效IRR数据可供对比 (可能均无额外投资或无法回收)。</p>`;
        }

        const validPBPs = savedScenarios.filter(s => s.dynamicPBP !== null && isFinite(s.dynamicPBP));
        if (validPBPs.length > 0) {
            const bestPBP = validPBPs.reduce((p, c) => (p.dynamicPBP < c.dynamicPBP) ? p : c);
            summaryHTML += `<p>• <b>PBP (动态回收期) 最短:</b> 方案 "<b>${bestPBP.name}</b>"，回收期仅 <b>${fYears(bestPBP.dynamicPBP)}</b> (对比${bestPBP.baselineName})。</p>`;
        } else {
            summaryHTML += `<p>• <b>PBP (动态回收期):</b> 无有效PBP数据可供对比 (可能均无法回收)。</p>`;
        }

        const bestCO2 = savedScenarios.reduce((p, c) => (p.co2 < c.co2) ? p : c);
        summaryHTML += `<p>• <b>碳排放最低:</b> 方案 "<b>${bestCO2.name}</b>"，年排放仅 <b>${fTon(bestCO2.co2)} 吨CO₂</b>。</p>`;

        summaryContainer.innerHTML = summaryHTML;
    }
}

/**
 * 设置 "启用多方案对比" 勾选框
 */
function setupScenarioToggle() {
    const toggle = document.getElementById('enableScenarioComparison');
    const saveBtn = document.getElementById('saveScenarioBtn');
    const tableContainer = document.getElementById('scenario-comparison-container');

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            saveBtn.classList.remove('hidden');
            renderScenarioTable();
        } else {
            saveBtn.classList.add('hidden');
            tableContainer.classList.add('hidden');
        }
    });
}

// --- 公共导出函数 ---

/**
 * 暂存一个方案
 * @param {string} name - 方案名称
 * @param {object} hpDetails - 工业热泵 (或混合系统) 的计算详情
 * @param {number} hpCop - 工业热泵的COP
 * @param {object} baselineComparison - (可选) 用于显示PBP/IRR的对比基准
 */
export function saveHpScenario(name, hpDetails, hpCop, baselineComparison) {
    const isHybrid = hpDetails.isHybrid || false;
    let finalName = name;
    
    if (isHybrid && !finalName.includes('(混合)')) {
        finalName += ' (混合)';
    }

    let counter = 1;
    while (savedScenarios.some(s => s.name === finalName)) {
        finalName = `${name} ${isHybrid ? '(混合)' : ''} (${counter++})`;
    }

    const scenario = { 
        name: finalName, 
        lcc: hpDetails.lcc.total, 
        opex: hpDetails.opex, 
        co2: hpDetails.co2,
        hpCapex: hpDetails.lcc.capex_host,
        storageCapex: hpDetails.lcc.capex_storage,
        totalCapex: hpDetails.lcc.capex,
        hpCop: hpCop, 
        baselineName: baselineComparison ? baselineComparison.name : '无对比',
        dynamicPBP: baselineComparison ? baselineComparison.dynamicPBP : null,
        irr: baselineComparison ? baselineComparison.irr : null
    };
    savedScenarios.push(scenario);
    renderScenarioTable();

    lastSavedScenarios = [];
}

/**
 * 初始化 "清空"、"恢复" 和 "启用" 按钮
 * V11.0: 签名更新，接收模态框句柄
 * @param {function} showConfirmModal
 * @param {function} showGlobalNotification
 */
export function initializeScenarioControls(showConfirmModal, showGlobalNotification) {
    const clearBtn = document.getElementById('clearScenariosBtn');
    const undoBtn = document.getElementById('undoClearBtn');

    // V11.0: 设为 async 并使用 await showConfirmModal
    clearBtn.addEventListener('click', async () => {
        if (savedScenarios.length === 0) {
            // V11.0: 替换 alert
            if (showGlobalNotification) {
                showGlobalNotification('方案列表已经为空。', 'info');
            }
            return; 
        }

        // V11.0: 替换 confirm
        const confirmed = await showConfirmModal(
            '确认清空列表',
            '确定要清空所有已暂存的方案吗？您可以通过 "恢复列表" 按钮撤销此操作。'
        );

        if (confirmed) {
            lastSavedScenarios = [...savedScenarios];
            savedScenarios = [];
            renderScenarioTable();
            // V11.0: 替换 alert
            if (showGlobalNotification) {
                 showGlobalNotification('方案列表已清空。', 'success');
            }
        }
    });

    undoBtn.addEventListener('click', () => {
        if (lastSavedScenarios.length === 0) return; 

        savedScenarios = [...lastSavedScenarios];
        lastSavedScenarios = [];
        renderScenarioTable();
        // V11.0: 替换 alert
        if (showGlobalNotification) {
             showGlobalNotification('已恢复上次清空的列表。', 'success');
        }
    });

    setupScenarioToggle();
}

