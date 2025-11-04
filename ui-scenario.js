// ui-scenario.js
import { fWan, fTon, fCop, fPercent, fYears } from './utils.js';

// --- 模块内部状态 ---
// ... existing code ...
let lastSavedScenarios = []; // 用于恢复

// --- 私有辅助函数 ---

/**
 * 将暂存的方案渲染到UI表格中
 */
function renderScenarioTable() {
// ... existing code ...
    const tableBody = document.getElementById('scenario-comparison-table').querySelector('tbody');
    const summaryContainer = document.getElementById('scenario-summary');
// ... existing code ...
    const clearBtn = document.getElementById('clearScenariosBtn');
    const undoBtn = document.getElementById('undoClearBtn');

    if (!scenarioToggle.checked) {
// ... existing code ...
        return;
    }
    container.classList.remove('hidden'); 

    if (savedScenarios.length === 0) {
// ... existing code ...
        
        if (lastSavedScenarios.length > 0) {
            clearBtn.classList.add('hidden');
// ... existing code ...
        } else {
            clearBtn.classList.add('hidden'); 
// ... existing code ...
        }
        return; 
    }

    tableWrapper.classList.remove('hidden'); 
// ... existing code ...
    clearBtn.classList.remove('hidden');
    undoBtn.classList.add('hidden');

    tableBody.innerHTML = '';
// ... existing code ...

    const minLCC = Math.min(...savedScenarios.map(s => s.lcc));

    savedScenarios.forEach((s, index) => {
// ... existing code ...
        row.className = isBestLCC ? 'bg-green-50' : '';
        
        row.innerHTML = `
// ... existing code ...
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium ${isBestLCC ? 'text-green-900' : 'text-gray-900'}">${s.name}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.totalCapex)}</td>
// ... existing code ...
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fWan(s.storageCapex)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${fCop(s.hpCop)}</td>
// ... existing code ...
            <td class="px-4 py-4 whitespace-nowrap text-sm ${isBestLCC ? 'font-bold text-green-700' : 'text-gray-700'}">${fWan(s.lcc)} ${isBestLCC ? ' (LCC最优)' : ''}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${s.baselineName}</td>
// ... existing code ...
            <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-700">${fPercent(s.irr)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-green-700">${fTon(s.co2)}</td>
// ... existing code ...
        tableBody.appendChild(row);
    });

    if (savedScenarios.length > 0) {
// ... existing code ...
        
        const bestLCC = savedScenarios.reduce((p, c) => (p.lcc < c.lcc) ? p : c);
        summaryHTML += `<p>• <b>LCC (全寿命周期成本) 最优:</b> 方案 "<b>${bestLCC.name}</b>"，总成本为 <b>${fWan(bestLCC.lcc)} 万元</b>。</p>`;

        const validIRRs = savedScenarios.filter(s => s.irr !== null && isFinite(s.irr));
// ... existing code ...
            const bestIRR = validIRRs.reduce((p, c) => (p.irr > c.irr) ? p : c);
            // V11.0: 更新总结文本
            summaryHTML += `<p>• <b>IRR (内部收益率, 税后) 最高:</b> 方案 "<b>${bestIRR.name}</b>"，IRR 高达 <b>${fPercent(bestIRR.irr)}</b> (对比${bestIRR.baselineName})。</p>`;
        } else {
            summaryHTML += `<p>• <b>IRR (内部收益率, 税后):</b> 无有效IRR数据可供对比 (可能均无额外投资或无法回收)。</p>`;
        }

        const validPBPs = savedScenarios.filter(s => s.dynamicPBP !== null && isFinite(s.dynamicPBP));
// ... existing code ...
            const bestPBP = validPBPs.reduce((p, c) => (p.dynamicPBP < c.dynamicPBP) ? p : c);
            // V11.0: 更新总结文本
            summaryHTML += `<p>• <b>PBP (动态回收期, 税后) 最短:</b> 方案 "<b>${bestPBP.name}</b>"，回收期仅 <b>${fYears(bestPBP.dynamicPBP)}</b> (对比${bestPBP.baselineName})。</p>`;
        } else {
            summaryHTML += `<p>• <b>PBP (动态回收期, 税后):</b> 无有效PBP数据可供对比 (可能均无法回收)。</p>`;
        }

        const bestCO2 = savedScenarios.reduce((p, c) => (p.co2 < c.co2) ? p : c);
// ... existing code ...

        summaryContainer.innerHTML = summaryHTML;
    }
}

/**
 * 设置 "启用多方案对比" 勾选框
 */
function setupScenarioToggle() {
// ... existing code ...
    const saveBtn = document.getElementById('saveScenarioBtn');
    const tableContainer = document.getElementById('scenario-comparison-container');

    toggle.addEventListener('change', () => {
// ... existing code ...
            saveBtn.classList.remove('hidden');
            renderScenarioTable();
// ... existing code ...
            saveBtn.classList.add('hidden');
            tableContainer.classList.add('hidden');
// ... existing code ...
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
// ... existing code ...
    
    if (isHybrid && !finalName.includes('(混合)')) {
// ... existing code ...
    }

    let counter = 1;
// ... existing code ...
        finalName = `${name} ${isHybrid ? '(混合)' : ''} (${counter++})`;
    }

    const scenario = { 
// ... existing code ...
        lcc: hpDetails.lcc.total, 
        opex: hpDetails.opex, 
// ... existing code ...
        hpCapex: hpDetails.lcc.capex_host,
        storageCapex: hpDetails.lcc.capex_storage,
// ... existing code ...
        hpCop: hpCop, 
        baselineName: baselineComparison ? baselineComparison.name : '无对比',
// ... existing code ...
        irr: baselineComparison ? baselineComparison.irr : null
    };
    savedScenarios.push(scenario);
// ... existing code ...

    lastSavedScenarios = [];
}

/**
 * 初始化 "清空"、"恢复" 和 "启用" 按钮
 */
export function initializeScenarioControls() {
// ... existing code ...
    const undoBtn = document.getElementById('undoClearBtn');

    clearBtn.addEventListener('click', () => {
// ... existing code ...

        if (confirm('确定要清空所有已暂存的方案吗？')) {
            lastSavedScenarios = [...savedScenarios];
// ... existing code ...
            renderScenarioTable();
        }
    });

    undoBtn.addEventListener('click', () => {
// ... existing code ...

        savedScenarios = [...lastSavedScenarios];
// ... existing code ...
        renderScenarioTable();
    });

    setupScenarioToggle();
}
