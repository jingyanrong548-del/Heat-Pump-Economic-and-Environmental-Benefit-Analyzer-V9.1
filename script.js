// Store calculation details
let detailedCalculations = {};
// *** 新增：暂存方案数组 ***
let savedScenarios = [];
let lastSavedScenarios = []; // *** 新增：用于恢复 ***

// ================= 变更点 (新增) =================
// 记忆两种模式下独立的SPF值
let spfStandardValue = "3.0"; // 模式一 (标准) 的SPF默认值
let spfHybridValue = "4.0";   // 模式二 (混合) 的SPF默认值 (通常工况更优)
// ================= 变更结束 =================

// Track if results are shown and if they are stale
let resultsAreShown = false;
let resultsAreStale = false;

const fuelData = {
    diesel: {
        price: 8900,
        calorific: 42.6,
        factor: 3090,
        priceTooltip: '<b>默认值: 8900 元/吨</b><br>参考国内0号柴油市场价格及密度（约0.84kg/L）折算。',
        calorificTooltip: '<b>默认值: 42.6 MJ/kg</b><br>国标中0号柴油的典型低位发热量参考值。',
        factorTooltip: '<b>默认值: 3090 kgCO₂/吨</b><br>参考《省级温室气体清单编制指南》中柴油的排放因子。'
    },
    heavy_oil: {
        price: 6500,
        calorific: 41.8,
        factor: 3170,
        priceTooltip: '<b>默认值: 6500 元/吨</b><br>参考国内燃料油（重油）市场平均价格。',
        calorificTooltip: '<b>默认值: 41.8 MJ/kg</b><br>国标中燃料油（5-7号）的典型低位发热量参考值。',
        factorTooltip: '<b>默认值: 3170 kgCO₂/吨</b><br>参考《省级温室气体清单编制指南》中燃料油的排放因子。'
    },
    residual_oil: {
        price: 5500,
        calorific: 40.2,
        factor: 3250,
        priceTooltip: '<b>默认值: 5500 元/吨</b><br>参考国内渣油市场平均价格。',
        calorificTooltip: '<b>默认值: 40.2 MJ/kg</b><br>国标中渣油的典型低位发热量参考值。',
        factorTooltip: '<b>默认值: 3250 kgCO₂/吨</b><br>参考《省级温室气体清单编制指南》中渣油的排放因子。'
    }
};

// 1 kcal = 4184 J = 0.004184 MJ
const MJ_PER_KCAL = 0.004184;

// --- 全局 converters 定义 ---
const converters = [
    {
        selectId: 'gridFactorUnit', inputId: 'gridFactor',
        conversions: { 'kgCO2/kWh': 1, 'tCO2/MWh': 1 }
    },
    {
        selectId: 'steamFactorUnit', inputId: 'steamFactor',
        conversions: { 'kgCO2/kWh': 1, 'tCO2/MWh': 1, 'kgCO2/GJ': 1 / (3.6 / 1000) }
    },
    {
        selectId: 'gasFactorUnit', inputId: 'gasFactor',
        dynamicConversions: () => {
            const gasCalorific = parseFloat(document.getElementById('gasCalorific').dataset.baseValue) || 35.57; // MJ/m3
            return { 'kgCO2/m3': 1, 'kgCO2/GJ': 1 / (gasCalorific / 1000) };
        }
    },
     {
        selectId: 'fuelFactorUnit', inputId: 'fuelFactor',
        dynamicConversions: () => {
            const fuelCalorific = parseFloat(document.getElementById('fuelCalorific').dataset.baseValue) || 42.6; // MJ/kg
            return { 'kgCO2/t': 1, 'kgCO2/kg': 1 / 1000, 'kgCO2/GJ': 1000 / fuelCalorific };
        }
    },
    {
        selectId: 'coalFactorUnit', inputId: 'coalFactor',
        dynamicConversions: () => {
            const coalCalorific = parseFloat(document.getElementById('coalCalorific').dataset.baseValue) || 29.3; // MJ/kg
            return { 'kgCO2/t': 1, 'kgCO2/kg': 1 / 1000, 'kgCO2/GJ': 1000 / coalCalorific };
        }
    },
    {
        selectId: 'biomassFactorUnit', inputId: 'biomassFactor',
        dynamicConversions: () => {
            const biomassCalorific = parseFloat(document.getElementById('biomassCalorific').dataset.baseValue) || 16.32; // MJ/kg
            return { 'kgCO2/t': 1, 'kgCO2/kg': 1 / 1000, 'kgCO2/GJ': 1000 / biomassCalorific };
        }
    },
    {
        selectId: 'gasCalorificUnit', inputId: 'gasCalorific',
        conversions: { 'MJ/m3': 1, 'kWh/m3': 1 / 3.6, 'GJ/m3': 1 / 1000 }
    },
     {
        selectId: 'fuelCalorificUnit', inputId: 'fuelCalorific',
        conversions: { 'MJ/kg': 1, 'GJ/t': 1, 'kWh/kg': 1 / 3.6 }
    },
    {
        selectId: 'coalCalorificUnit', inputId: 'coalCalorific',
        conversions: { 'MJ/kg': 1, 'GJ/t': 1, 'kWh/kg': 1 / 3.6 }
    },
    {
        selectId: 'biomassCalorificUnit', inputId: 'biomassCalorific',
        conversions: { 'MJ/kg': 1, 'kcal/kg': 1 / MJ_PER_KCAL, 'GJ/t': 1, 'kWh/kg': 1 / 3.6 }
    },
    {
        selectId: 'steamCalorificUnit', inputId: 'steamCalorific',
        conversions: { 'kWh/t': 1, 'GJ/t': 3.6 / 1 }
    }
];

/**
 * Calculates the Net Present Value (NPV) of a series of future costs.
 * @param {number} initialCost - The cost in Year 1.
 * @param {number} years - The number of years in the analysis period.
 * @param {number} discountRate - The discount rate (e.g., 0.08 for 8%).
 * @param {number} inflationRate - The annual inflation rate for this cost (e.g., 0.03 for 3%).
 * @returns {number} The total Net Present Value of the cost stream.
 */
function calculateNPV(initialCost, years, discountRate, inflationRate) {
    let npv = 0;
    // Use simple loop method for clarity and correctness across edge cases
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
function calculateCashFlowNPV(cash_flows, rate) {
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
function findIRR(cash_flows, max_iterations = 100, tolerance = 1e-6) {
    if (cash_flows.length === 0 || cash_flows[0] >= 0) {
        // If no initial investment or initial flow is positive, IRR is meaningless or infinite
        const sumOfFutureFlows = cash_flows.slice(1).reduce((a, b) => a + b, 0);
        return (cash_flows[0] < 0 || sumOfFutureFlows > 0) ? Infinity : null;
    }

    let rate_low = -0.99; // IRR cannot be lower than -100%
    let rate_high = 5.0;   // Assume IRR won't be > 500%
    let rate_mid;
    let npv;

    // Check if a solution might exist
    const npv_at_zero = calculateCashFlowNPV(cash_flows, 0);
    const npv_at_high = calculateCashFlowNPV(cash_flows, rate_high);

    // If NPV at 0 is negative, it's a bad investment (unless CF0 is 0, handled above)
    if (npv_at_zero < 0) {
         // Try finding a negative IRR if NPV at high rate is even more negative
         if (npv_at_high < npv_at_zero) {
              rate_high = 0.0; // Search in negative range
         } 
         // *** 之前的修改：删除了 'else { return null; }' ***
    
    // *** 新增的 BUG 修复：处理 IRR > 500% 的情况 ***
    } else if (npv_at_high > 0) {
        // NPV at 500% is *still* positive, meaning IRR is > 500%.
        // Expand the search range dramatically.
        rate_low = rate_high;  // New low is 5.0
        rate_high = 20.0;      // New high is 2000%
        
        // We must check if 2000% is high enough.
        const npv_at_very_high = calculateCashFlowNPV(cash_flows, rate_high);
        if (npv_at_very_high > 0) {
            // If NPV is *still* positive at 2000%, the return is astronomical.
            // Stop searching and return Infinity.
            return Infinity;
        }
    }
    // *** 修复结束 ***

    for (let i = 0; i < max_iterations; i++) {
        rate_mid = (rate_low + rate_high) / 2;
        npv = calculateCashFlowNPV(cash_flows, rate_mid);

        if (Math.abs(npv) < tolerance) {
            return rate_mid; // Solution found
        } else if (npv > 0) {
            rate_low = rate_mid;
        } else {
            rate_high = rate_mid;
        }
    }
    // No solution found within iterations
    return null;
}

/**
 * (ROI FUNCTION) Calculates the Dynamic Payback Period (PBP).
 * @param {number[]} cash_flows - Array of cash flows [CF0, CF1, ..., CFN].
 * @param {number} rate - The discount rate.
 * @param {number} years - The project lifecycle length.
 * @returns {number|null} The Dynamic PBP in years, or null if not recovered.
 */
function calculateDynamicPBP(cash_flows, rate, years) {
    const initialInvestment = -cash_flows[0];
    if (initialInvestment <= 0) return 0; // No investment to pay back

    let cumulative_savings = 0;
    for (let i = 1; i <= years; i++) {
        if (i >= cash_flows.length) break; // Should not happen if CF array is correct

        const discounted_saving = cash_flows[i] / Math.pow(1 + rate, i);
        if (discounted_saving <= 0 && cumulative_savings < initialInvestment) {
            continue; // Skip years with no savings if not yet paid back
        }

        if (cumulative_savings < initialInvestment) {
            const prev_cumulative = cumulative_savings;
            cumulative_savings += discounted_saving;

            if (cumulative_savings >= initialInvestment) {
                // Payback happens in this year (i)
                const needed = initialInvestment - prev_cumulative;
                // Avoid division by zero if discounted_saving is exactly 0
                if (discounted_saving === 0) {
                     if (needed === 0) return (i - 1); // Exact payback at the end of the previous year
                     else continue; // Cannot pay back in this year
                }
                return (i - 1) + (needed / discounted_saving);
            }
        }
    }
    // If loop finishes without returning, payback was not achieved
    return null;
}


// Unit Conversion Logic
function setupUnitConverters() {
    converters.forEach(c => {
        const select = document.getElementById(c.selectId);
        const input = document.getElementById(c.inputId);

        select.addEventListener('change', () => {
            const conversions = c.dynamicConversions ? c.dynamicConversions() : c.conversions;
            const baseValue = parseFloat(input.dataset.baseValue);
            const targetUnit = select.value;

            if (baseValue === 0) {
                input.value = 0;
                return;
            }

            const conversionFactor = conversions[targetUnit];
             if (conversionFactor === undefined || conversionFactor === null) {
                 console.error("Missing conversion factor for", c.inputId, "to unit", targetUnit);
                 return; // Avoid errors if conversion is missing
             }

            let precision = 3;
            if (targetUnit.includes('/t') && (c.inputId.includes('Calorific'))) precision = 1;
            if (targetUnit.includes('/kg') && (c.inputId.includes('Calorific'))) precision = 3;
            if (targetUnit.includes('GJ/')) precision = 5;
            if (targetUnit.includes('kcal/kg')) precision = 0;

            input.value = (baseValue * conversionFactor).toFixed(precision);
        });
    });

     // 初始化生物质热值为 3900 kcal/kg
    const biomassCalorificSelect = document.getElementById('biomassCalorificUnit');
    if(biomassCalorificSelect) { // Add check
        biomassCalorificSelect.value = 'kcal/kg';
        biomassCalorificSelect.dispatchEvent(new Event('change'));
    }
}

// 修正：替换整个 setupComparisonToggles 函数
function setupComparisonToggles() {
    const toggles = document.querySelectorAll('.comparison-toggle');
    
    toggles.forEach(toggle => {
        const target = toggle.dataset.target;
        
        // 1. 查找此对比项在“初始投资”板块中的所有相关元素
        const capexInput = document.getElementById(target === 'steam' ? 'steamCapex' : `${target}BoilerCapex`);
        const salvageInput = document.getElementById(`${target}SalvageRate`);
        const salvageLabel = document.querySelector(`label[for="${target}SalvageRate"]`);
        // 查找父级 <div> (grid item)
        const parentGridDiv = toggle.closest('.input-group > div'); 

        // 2. 查找此对比项在 *其他* 板块中的所有相关元素
        const otherRelatedFields = document.querySelectorAll(`.${target}-related`);
        const relatedOpexField = document.querySelector(`.${target}-opex-related`);

        // --- 定义一个函数来应用选中/未选中状态 ---
        const applyToggleState = (isChecked) => {
            // --- A. 处理“初始投资”板块 ---
            if (capexInput) capexInput.disabled = !isChecked;
            if (salvageInput) salvageInput.disabled = !isChecked;

            // 切换残值率标签的可见性
            if (salvageLabel) salvageLabel.classList.toggle('hidden', !isChecked);

            // 切换整个 grid item div 的透明度
            if (parentGridDiv) parentGridDiv.classList.toggle('comparison-disabled', !isChecked);
            
            // --- B. 处理 *其他* 板块中的字段 (隐藏/显示) ---
            otherRelatedFields.forEach(el => {
                // 确保我们不会重复隐藏已在上面处理过的残值率标签
                if (el !== salvageLabel && el !== salvageInput) {
                    el.classList.toggle('hidden', !isChecked);
                }
            });
            
            if (relatedOpexField) {
                relatedOpexField.classList.toggle('hidden', !isChecked);
            }
        };

        // --- C. 附加事件监听器 ---
        toggle.addEventListener('change', () => {
            applyToggleState(toggle.checked);
        });

        // --- D. 页面加载时立即执行一次 ---
        applyToggleState(toggle.checked);
    });
}

// ================= 变更点： V9.1 重写此函数 =================
// *** V9.1 优化：解耦模式一和模式二的SPF/COP值 ***
function setupModeSelector() {
    const modeStandard = document.getElementById('modeStandard');
    const modeHybrid = document.getElementById('modeHybrid');
    
    // V9.0 (混合模式) の UI 容器
    const hybridConfigInputs = document.getElementById('hybridConfigInputs'); // V9.0 辅助热源配置 (在第 2 节内)

    // 需要动态修改的标签和输入框
    const hpCopLabel = document.getElementById('hpCopLabel');
    const hpCopInput = document.getElementById('hpCop'); // *** 新增：获取输入框本身 ***

    if (!modeStandard || !modeHybrid || !hybridConfigInputs || !hpCopLabel || !hpCopInput) {
        console.warn('V9.1 (模式选择) UI 元素未在 HTML 中完全找到。新版模式切换可能失效。');
        return;
    }

    // --- 核心切换逻辑 ---
    const applyModeState = (isEnteringHybrid) => {
        // --- 1. 切换模块的可见性 (仅第 2 节内部) ---
        hybridConfigInputs.classList.toggle('hidden', !isEnteringHybrid);
        
        // --- 2. 更改动态标签并加载对应的SPF值 (核心修改) ---
        if (isEnteringHybrid) {
            // 进入混合模式
            hpCopLabel.textContent = '热泵在此工况下的 SPF';
            hpCopInput.value = spfHybridValue; // 加载混合模式的SPF
        } else {
            // 进入标准模式
            hpCopLabel.textContent = '全年综合性能系数 (SPF)';
            hpCopInput.value = spfStandardValue; // 加载标准模式的SPF
        }
        
        // 确保输入框样式正确 (如果加载的是默认值)
        const defaultValue = isEnteringHybrid ? "4.0" : "3.0";
        hpCopInput.classList.toggle('default-param', hpCopInput.value === defaultValue);
        
        markResultsAsStale();
    };

    // --- 附加事件监听器 ---
    modeStandard.addEventListener('change', () => {
        if (modeStandard.checked) {
            // 正在切换到 "标准模式"
            // 1. 保存我们刚刚离开的 "混合模式" 的值
            spfHybridValue = hpCopInput.value;
            // 2. 应用 "标准模式" 的状态
            applyModeState(false);
        }
    });

    modeHybrid.addEventListener('change', () => {
        if (modeHybrid.checked) {
            // 正在切换到 "混合模式"
            // 1. 保存我们刚刚离开的 "标准模式" 的值
            spfStandardValue = hpCopInput.value;
            // 2. 应用 "混合模式" 的状态
            applyModeState(true);
        }
    });

    // --- 页面加载时立即执行一次 ---
    // (假设 modeStandard 默认选中)
    hpCopInput.value = spfStandardValue; // 确保初始值为标准模式的SPF
    applyModeState(modeHybrid.checked); // 根据当前选中的模式，设置正确的标签和值
}
// *** V9.1 优化结束 ***
// ================= 变更结束 =================


// *** 动态电价时段 ***
function addNewPriceTier(name = "", price = "", dist = "") {
    const container = document.getElementById('priceTiersContainer');
    const tierId = `tier-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTier = document.createElement('div');
    newTier.className = 'price-tier-entry grid grid-cols-1 md:grid-cols-10 gap-2 items-center';
    newTier.id = tierId;

    newTier.innerHTML = `
        <div class="md:col-span-3">
            <label for="${tierId}-name" class="block text-xs font-medium text-gray-600 mb-1">时段名称 (可选)</label>
            <input type="text" id="${tierId}-name" value="${name}" placeholder="例如: 峰时" class="tier-name w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
            <label for="${tierId}-price" class="block text-xs font-medium text-gray-600 mb-1">电价 (元/kWh)</label>
            <input type="number" id="${tierId}-price" value="${price}" placeholder="例如: 1.2" class="tier-price w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
            <label for="${tierId}-dist" class="block text-xs font-medium text-gray-600 mb-1">运行比例 (%)</label>
            <input type="number" id="${tierId}-dist" value="${dist}" placeholder="例如: 40" class="tier-dist w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-1 flex items-end h-full">
            <button class="removePriceTierBtn w-full text-sm bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-300" style="margin-top: 22px;">
                删除
            </button>
        </div>
    `;

    container.appendChild(newTier);

    // 自动为输入框添加 stale 标记
    newTier.querySelectorAll('input.track-change').forEach(input => {
        input.dataset.defaultValue = input.value;
        input.addEventListener('input', (event) => {
            const currentInput = event.target;
            const currentDefaultValue = currentInput.dataset.defaultValue;
            if (currentInput.classList.contains('default-param') || currentDefaultValue !== undefined) {
                currentInput.classList.toggle('default-param', currentInput.value === currentDefaultValue);
            }
            if (currentInput.classList.contains('track-change')) {
                markResultsAsStale();
            }
        });
    });

    // 为删除按钮添加事件
    newTier.querySelector('.removePriceTierBtn').addEventListener('click', () => {
        // 确保至少保留一个
        if (document.querySelectorAll('.price-tier-entry').length > 1) {
            newTier.remove();
            markResultsAsStale(); // 删除时段也应标记为陈旧
        } else {
            alert('必须至少保留一个电价时段。');
        }
    });
}

function setupPriceTierControls() {
    document.getElementById('addPriceTierBtn').addEventListener('click', () => {
        addNewPriceTier("", "", "");
        markResultsAsStale();
    });

    // 加载默认时段 (替代旧的 "标准模式")
    addNewPriceTier("平均电价", "0.7", "100");
    
    // 将默认时段的输入框标记为 default-param
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        tierEl.querySelectorAll('input').forEach(input => {
            if (input.value) {
                input.classList.add('default-param');
            }
        });
    });
}

function setupGreenElectricityToggle() {
    const toggle = document.getElementById('greenElectricityToggle');
    const gridFactorInput = document.getElementById('gridFactor');
    const gridFactorUnit = document.getElementById('gridFactorUnit');

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            gridFactorInput.value = '0';
            gridFactorInput.dataset.baseValue = '0'; // Set base value to 0 as well
            gridFactorInput.disabled = true;
            gridFactorUnit.disabled = true;
            gridFactorInput.classList.remove('default-param');
        } else {
            // Restore from *attribute* (original default)
            const baseValue = gridFactorInput.getAttribute('data-base-value');
            gridFactorInput.value = baseValue;
            gridFactorInput.dataset.baseValue = baseValue; // Reset dataset
            gridFactorUnit.value = 'kgCO2/kWh';
            gridFactorUnit.dispatchEvent(new Event('change'));

            gridFactorInput.disabled = false;
            gridFactorUnit.disabled = false;
            gridFactorInput.classList.add('default-param');
        }
    });
}

function setupFuelTypeSelector() {
    const fuelTypeSelect = document.getElementById('fuelType');

    const priceInput = document.getElementById('fuelPrice');
    const calorificInput = document.getElementById('fuelCalorific');
    const factorInput = document.getElementById('fuelFactor');

    const priceTooltip = document.getElementById('fuelPriceTooltip');
    const calorificTooltip = document.getElementById('fuelCalorificTooltip');
    const factorTooltip = document.getElementById('fuelFactorTooltip');

    const calorificUnitSelect = document.getElementById('fuelCalorificUnit');
    const factorUnitSelect = document.getElementById('fuelFactorUnit');

    fuelTypeSelect.addEventListener('change', (e) => {
        const selectedFuel = e.target.value;
        const data = fuelData[selectedFuel];

        if (!data) return;

        // Update base values
        priceInput.dataset.baseValue = data.price;
        calorificInput.dataset.baseValue = data.calorific;
        factorInput.dataset.baseValue = data.factor;

        // Update input values (and their default value for styling)
        priceInput.value = data.price;
        priceInput.dataset.defaultValue = data.price;
        priceInput.classList.add('default-param');

        // Update tooltips
        priceTooltip.innerHTML = data.priceTooltip;
        calorificTooltip.innerHTML = data.calorificTooltip;
        factorTooltip.innerHTML = data.factorTooltip;

        // Trigger change events on unit selects to update display values
        calorificUnitSelect.value = 'MJ/kg'; // Reset to base unit
        calorificUnitSelect.dispatchEvent(new Event('change'));
        calorificInput.dataset.defaultValue = calorificInput.value;
        calorificInput.classList.add('default-param');

        factorUnitSelect.value = 'kgCO2/t'; // Reset to base unit
        factorUnitSelect.dispatchEvent(new Event('change'));
        factorInput.dataset.defaultValue = factorInput.value;
        factorInput.classList.add('default-param');
    });
}

// Function to mark results as stale
function markResultsAsStale() {
    if (resultsAreShown) {
        resultsAreStale = true;
        document.getElementById('stale-results-notice').classList.remove('hidden');
        document.getElementById('results-container').classList.add('stale');

        // *** 新增：禁用暂存按钮 ***
        const saveBtn = document.getElementById('saveScenarioBtn');
        saveBtn.disabled = true;
        saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        saveBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        saveBtn.textContent = '暂存当前热泵方案 (请先计算)';
        
    }
}

// *** 暂存方案相关函数 ***
function saveHpScenario(name, hpDetails, hpCop, baselineComparison) {
    // V9.0: 检查是否为混合模式
    const isHybrid = detailedCalculations.isHybridMode || false;
    let finalName = name;
    
    // 如果是混合模式，自动添加后缀
    if (isHybrid && !finalName.includes('(混合)')) {
        finalName += ' (混合)';
    }

    let counter = 1;
    while (savedScenarios.some(s => s.name === finalName)) {
        finalName = `${name} ${isHybrid ? '(混合)' : ''} (${counter++})`;
    }

    const scenario = { 
        name: finalName, 
        // V9.0: hpDetails 可能是 100%HP，也可能是 HybridSystem
        lcc: hpDetails.lcc.total, 
        opex: hpDetails.opex, 
        co2: hpDetails.co2,
        // V9.0: 区分主机和储能
        hpCapex: isHybrid ? hpDetails.lcc.capex_host : hpDetails.lcc.capex_host, // V9.0: 假设 hybridSystem 对象也有 capex_host
        storageCapex: isHybrid ? hpDetails.lcc.capex_storage : hpDetails.lcc.capex_storage, // V9.0: 假设 hybridSystem 对象也有 capex_storage
        totalCapex: hpDetails.lcc.capex,
        hpCop: hpCop, // 存入的是100%HP的COP或混合模式下HP部分的COP
        baselineName: baselineComparison ? baselineComparison.name : '无对比',
        dynamicPBP: baselineComparison ? baselineComparison.dynamicPBP : null,
        irr: baselineComparison ? baselineComparison.irr : null
    };
    savedScenarios.push(scenario);
    renderScenarioTable();

    lastSavedScenarios = [];
}

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

    const fWan = (n) => (n / 10000).toFixed(2);
    const fTon = (n) => (n / 1000).toFixed(2);
    const fCop = (n) => (n).toFixed(2);
    const fPercent = (n) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(1)} %`;
    const fYears = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)} 年`;

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

function setupScenarioControls() {
    const clearBtn = document.getElementById('clearScenariosBtn');
    const undoBtn = document.getElementById('undoClearBtn');

    clearBtn.addEventListener('click', () => {
        if (savedScenarios.length === 0) return; 

        if (confirm('确定要清空所有已暂存的方案吗？')) {
            lastSavedScenarios = [...savedScenarios];
            savedScenarios = [];
            renderScenarioTable();
        }
    });

    undoBtn.addEventListener('click', () => {
        if (lastSavedScenarios.length === 0) return; 

        savedScenarios = [...lastSavedScenarios];
        lastSavedScenarios = [];
        renderScenarioTable();
    });
}

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

// ==================
// 页面加载主函数
// ==================
document.addEventListener('DOMContentLoaded', () => {
    setupUnitConverters();
    setupComparisonToggles(); // V8.0 标准模式下的切换
    setupGreenElectricityToggle();
    setupFuelTypeSelector();
    setupPriceTierControls(); 
    setupScenarioControls(); 
    setupScenarioToggle(); 
    setupModeSelector(); // V9.1 修改：调用新函数

    const allInputs = document.querySelectorAll('input[type="number"], input[type="checkbox"], select, input[type="text"]');
    allInputs.forEach(input => {
        input.dataset.defaultValue = input.value;

        input.addEventListener('input', (event) => {
            const currentInput = event.target;
            const currentDefaultValue = currentInput.dataset.defaultValue;

            if (currentInput.classList.contains('default-param') || currentDefaultValue !== undefined) {
                currentInput.classList.toggle('default-param', currentInput.value === currentDefaultValue);
            }

            const container = currentInput.closest('.tooltip-container');
            const unitSelects = container ? container.querySelectorAll('select') : [];
            const unitSelect = Array.from(unitSelects).find(sel => sel.id.endsWith('Unit'));

            if (unitSelect && unitSelect.id.includes('Unit')) {
                const currentVal = parseFloat(currentInput.value);
                if (isNaN(currentVal)) {
                     const originalBaseValue = currentInput.getAttribute('data-base-value');
                     currentInput.dataset.baseValue = originalBaseValue;
                     if (currentInput.classList.contains('track-change')) {
                         markResultsAsStale();
                     }
                     return;
                }

                const currentUnit = unitSelect.value;
                const converter = converters.find(c => c.inputId === currentInput.id);
                if (!converter) return;

                const allConversions = converter.dynamicConversions ? converter.dynamicConversions() : converter.conversions;
                const conversionFactor = allConversions[currentUnit];

                if (currentVal === 0) {
                     currentInput.dataset.baseValue = 0;
                } else if (conversionFactor && conversionFactor !== 0) {
                    const newBaseValue = currentVal / conversionFactor;
                    currentInput.dataset.baseValue = newBaseValue;
                } else {
                     console.warn("Invalid conversion factor for", currentInput.id, currentUnit, conversionFactor);
                }
            }

            if (currentInput.classList.contains('track-change')) {
                 markResultsAsStale();
            }
        });

        if (input.tagName === 'SELECT' || input.type === 'checkbox') {
             input.addEventListener('change', (event) => {
                  if (event.target.classList.contains('track-change')) {
                     markResultsAsStale();
                  }
             });
        }
    });
    

    // ==================
    // V9.0 重构：
    // 将 V8.0 重复的锅炉计算逻辑提取到辅助函数中
    // ==================
    function calculateBoilerDetails(boilerKey, heatingDemandKWh, capex, opexCost, lccParams, inputs, gridFactor) {
        const { lccYears, discountRate, energyInflationRate, opexInflationRate } = lccParams;
        const annualHeatingDemandMJ = heatingDemandKWh * 3.6;
        
        let energyCost = 0, co2 = 0, consumption = 0; // 'consumption' can be volume or weight
        let lcc = 0, energyNPV = 0, opexNPV = 0, salvageNPV = 0;
        let opex_Year1 = 0;
        let salvageRate = 0;
        let name = "未知";
        let cost_per_kwh_heat = 0; // 产热成本

        switch (boilerKey) {
            case 'gas':
                name = "天然气锅炉";
                salvageRate = (parseFloat(document.getElementById('gasSalvageRate').value) || 0) / 100;
                if (inputs.gasBoilerEfficiency > 0 && inputs.gasCalorific > 0) {
                    const gasRequiredMJ = annualHeatingDemandMJ / inputs.gasBoilerEfficiency;
                    consumption = gasRequiredMJ / inputs.gasCalorific; // m³
                    energyCost = consumption * inputs.gasPrice;
                    co2 = consumption * inputs.gasFactor;
                    // 产热成本 (元/kWh_热) = (元/m³) / ( (MJ/m³ / 3.6) * % )
                    let calorific_kwh = inputs.gasCalorific / 3.6;
                    cost_per_kwh_heat = inputs.gasPrice / (calorific_kwh * inputs.gasBoilerEfficiency);
                }
                break;
            case 'fuel':
                name = "燃油锅炉";
                salvageRate = (parseFloat(document.getElementById('fuelSalvageRate').value) || 0) / 100;
                if (inputs.fuelBoilerEfficiency > 0 && inputs.fuelCalorific > 0) {
                    const fuelRequiredMJ = annualHeatingDemandMJ / inputs.fuelBoilerEfficiency;
                    const fuelWeightKg = fuelRequiredMJ / inputs.fuelCalorific;
                    consumption = fuelWeightKg / 1000; // 吨
                    energyCost = consumption * inputs.fuelPrice;
                    co2 = consumption * inputs.fuelFactor;
                    // 产热成本 (元/kWh_热) = (元/吨 / 1000) / ( (MJ/kg / 3.6) * % )
                    let calorific_kwh = inputs.fuelCalorific / 3.6;
                    cost_per_kwh_heat = (inputs.fuelPrice / 1000) / (calorific_kwh * inputs.fuelBoilerEfficiency);
                }
                break;
            case 'coal':
                name = "燃煤锅炉";
                salvageRate = (parseFloat(document.getElementById('coalSalvageRate').value) || 0) / 100;
                if (inputs.coalBoilerEfficiency > 0 && inputs.coalCalorific > 0) {
                    const coalRequiredMJ = annualHeatingDemandMJ / inputs.coalBoilerEfficiency;
                    const coalWeightKg = coalRequiredMJ / inputs.coalCalorific;
                    consumption = coalWeightKg / 1000; // 吨
                    energyCost = consumption * inputs.coalPrice;
                    co2 = consumption * inputs.coalFactor;
                    // 产热成本
                    let calorific_kwh = inputs.coalCalorific / 3.6;
                    cost_per_kwh_heat = (inputs.coalPrice / 1000) / (calorific_kwh * inputs.coalBoilerEfficiency);
                }
                break;
            case 'biomass':
                name = "生物质锅炉";
                salvageRate = (parseFloat(document.getElementById('biomassSalvageRate').value) || 0) / 100;
                if (inputs.biomassBoilerEfficiency > 0 && inputs.biomassCalorific > 0) {
                    const biomassRequiredMJ = annualHeatingDemandMJ / inputs.biomassBoilerEfficiency;
                    const biomassWeightKg = biomassRequiredMJ / inputs.biomassCalorific;
                    consumption = biomassWeightKg / 1000; // 吨
                    energyCost = consumption * inputs.biomassPrice;
                    co2 = consumption * inputs.biomassFactor;
                    // 产热成本
                    let calorific_kwh = inputs.biomassCalorific / 3.6;
                    cost_per_kwh_heat = (inputs.biomassPrice / 1000) / (calorific_kwh * inputs.biomassBoilerEfficiency);
                }
                break;
            case 'electric':
                name = "电锅炉";
                salvageRate = (parseFloat(document.getElementById('electricSalvageRate').value) || 0) / 100;
                if (inputs.electricBoilerEfficiency > 0) {
                      consumption = heatingDemandKWh / inputs.electricBoilerEfficiency; // kWh
                     // 使用V8.0中已计算好的加权平均电价
                     const weightedAvgElecPrice = detailedCalculations.weightedAvgElecPrice || 0;
                     energyCost = consumption * weightedAvgElecPrice;
                     co2 = consumption * gridFactor;
                     // 产热成本
                     cost_per_kwh_heat = weightedAvgElecPrice / inputs.electricBoilerEfficiency;
                }
                break;
            case 'steam':
                name = "管网蒸汽";
                salvageRate = (parseFloat(document.getElementById('steamSalvageRate').value) || 0) / 100;
                if (inputs.steamEfficiency > 0 && inputs.steamCalorific > 0) {
                    const steamRequiredKwh = heatingDemandKWh / inputs.steamEfficiency;
                    consumption = steamRequiredKwh / inputs.steamCalorific; // 吨
                    energyCost = consumption * inputs.steamPrice;
                    co2 = steamRequiredKwh * inputs.steamFactor;
                    // 产热成本
                    cost_per_kwh_heat = inputs.steamPrice / (inputs.steamCalorific * inputs.steamEfficiency);
                }
                break;
        }

        opex_Year1 = energyCost + opexCost;
        energyNPV = calculateNPV(energyCost, lccYears, discountRate, energyInflationRate);
        opexNPV = calculateNPV(opexCost, lccYears, discountRate, opexInflationRate);
        
        // --- 修复点 1: 计算并存储 undiscounted salvage value ---
        const salvageValue = capex * salvageRate;
        salvageNPV = salvageValue / Math.pow(1 + discountRate, lccYears);
        // --- 修复结束 ---
        
        lcc = capex + energyNPV + opexNPV - salvageNPV;

        return {
            key: boilerKey,
            name: name,
            energyCost: energyCost,
            opexCost: opexCost,
            opex: opex_Year1,
            co2: co2,
            consumption: consumption,
            cost_per_kwh_heat: cost_per_kwh_heat,
            lcc: {
                capex: capex,
                energyNPV: energyNPV,
                opexNPV: opexNPV,
                salvageRate: salvageRate,
                salvageNPV: salvageNPV,
                salvageValue: salvageValue, // <-- 修复点 1: 在此返回
                total: lcc
            }
        };
    }
    
    // ==================
    // V9.0 重构：
    // 将 V8.0 的结果显示逻辑提取到此函数
    // ==================
    function renderResults(hpSystemDetails, comparisons, lccYears, discountRate) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = '';
        document.getElementById('results-title').textContent = `静态、ROI 与 LCC (${lccYears}年) 对比分析结果`;

        // V9.0: 检查 hpSystemDetails 是 100%HP 还是 混合系统
        const isHybrid = hpSystemDetails.isHybrid || false;
        const hpCardTitleStatic = isHybrid ? '混合系统年运行成本 (第1年)' : '热泵系统年运行成本 (第1年)';
        const hpCardTitleLCC = isHybrid ? `混合系统 LCC (${lccYears}年)` : `热泵系统 LCC (${lccYears}年)`;

        // --- HP / Hybrid System Result Cards ---
        const hpCardStatic = `<div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg result-card"><h3 class="font-bold text-lg text-blue-800">${hpCardTitleStatic}</h3><p class="text-2xl font-bold text-blue-600">${(hpSystemDetails.opex / 10000).toFixed(2)} 万元</p></div>`;
        const hpCardLCC = `<div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-lg result-card" style="transition-delay: 50ms;"><h3 class="font-bold text-lg text-blue-900">${hpCardTitleLCC}</h3><p class="text-2xl font-bold text-blue-700">${(hpSystemDetails.lcc.total / 10000).toFixed(2)} 万元</p></div>`;
        resultsContent.innerHTML += hpCardStatic + hpCardLCC;

        // --- Comparison Cards (Loop) ---
        comparisons.forEach((boiler, index) => {
            const npvColor = boiler.npv > 0 ? 'text-green-600' : 'text-red-600';
            const irrColor = boiler.irr > discountRate ? 'text-green-600' : (boiler.irr === null || !isFinite(boiler.irr) ? 'text-gray-500' : 'text-red-600');
            const paybackColor = boiler.dynamicPBP !== null ? 'text-blue-600' : 'text-red-600';
            const staticSavingColor = boiler.opexSaving > 0 ? 'text-green-600' : 'text-red-600';
            const energySavingColor = boiler.energyCostSaving > 0 ? 'text-green-600' : 'text-red-600'; 
            const simpleRoiColor = boiler.simpleROI !== null ? 'text-green-600' : 'text-gray-500';

            const formatPercent = (n) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(1)} %`;
            const formatYears = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)} 年`;

            const resultCard = `
            <div class="bg-gray-100 p-4 rounded-lg space-y-3 result-card" style="transition-delay: ${150 * (index + 1)}ms;">
                <h4 class="font-bold text-lg text-gray-800 border-b pb-2">与 <span class="text-blue-600">${boiler.name}</span> 对比</h4>

                <div class="space-y-1">
                    <h5 class="font-semibold text-blue-700 text-md">视角: 投资回报率 (ROI)</h5>
                    
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 tooltip-container">
                            简单投资回报率 (ROI)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span class="tooltip-text" style="width: 320px; margin-left: -160px;">
                                <b>通俗解释:</b> 这是一个简化的、非财务人员常用的参考指标 (公式: 第1年节省成本 / 额外投资)。<br>
                                <strong class="text-yellow-300">特别注意:</strong> 此指标未考虑资金的时间价值和未来通胀，仅供初步参考。<b>内部收益率 (IRR) 是更精确的指标。</b>
                            </span>
                        </span>
                        <span class="font-bold ${simpleRoiColor}">${formatPercent(boiler.simpleROI)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 tooltip-container">
                            净现值 (NPV)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span class="tooltip-text" style="width: 300px; margin-left: -150px;">
                                <b>通俗解释:</b> 把未来所有省/赚的钱折算成今天, 再减去初始投资, 看是正还是负。<b>NPV > 0 代表项目可行</b>, 不仅达到最低回报要求 (折现率), 还额外多赚了。
                            </span>
                        </span>
                        <span class="font-bold ${npvColor}">${(boiler.npv / 10000).toFixed(2)} 万元</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 tooltip-container">
                            内部收益率 (IRR)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span class="tooltip-text" style="width: 300px; margin-left: -150px;">
                                <b>通俗解释:</b> 这个项目本身的“年化收益率”。<b>IRR > 折现率 (基准收益率) 代表项目优秀</b>, 回报高于你的最低要求。
                            </span>
                        </span>
                        <span class="font-bold ${irrColor}">${formatPercent(boiler.irr)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 tooltip-container">
                            动态回收期 (PBP)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span class="tooltip-text" style="width: 300px; margin-left: -150px;">
                                <b>通俗解释:</b> 考虑了利息和通胀后, <b>“真正”需要多少年才能收回初始投资</b>。这个值比“静态回收期”更真实、更可靠。
                            </span>
                        </span>
                        <span class="font-bold ${paybackColor}">${formatYears(boiler.dynamicPBP)}</span>
                    </div>
                </div>

                <div class="space-y-1 pt-2 border-t">
                    <h5 class="font-semibold text-gray-700 text-md">视角: 静态 (第1年) 与 环境</h5>

                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 tooltip-container">
                            电热价格比 (EPR)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block align-text-bottom ml-1 info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span class="tooltip-text" style="width: 320px; margin-left: -160px;">
                                <b>IEA/欧洲常用指标 (EPR):</b> 
                                (锅炉产热成本) / (热泵产热成本)。<br>
                                <b>EPR > 1.0</b> 时，热泵运行成本更低。<br>
                                <b>EPR = 2.0</b> 意味着热泵成本是锅炉的50%。
                            </span>
                        </span>
                        <span class="font-bold ${(boiler.electricalPriceRatio > 1.0 || (boiler.electricalPriceRatio === null && boiler.key === 'electric')) ? 'text-green-600' : 'text-red-600'}">
                            ${boiler.electricalPriceRatio ? boiler.electricalPriceRatio.toFixed(2) : (boiler.key === 'electric' ? 'N/A' : '0.00')}
                        </span>
                    </div>
                    
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">年节省能源费:</span>
                        <span class="font-semibold ${energySavingColor}">${(boiler.energyCostSaving / 10000).toFixed(2)} 万元</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">能源费节能率:</span>
                        <span class="font-semibold ${energySavingColor}">${formatPercent(boiler.energyCostSavingRate)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">年节省总成本 (含运维):</span>
                        <span class="font-semibold ${staticSavingColor}">${(boiler.opexSaving / 10000).toFixed(2)} 万元</span>
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
                        <span class="text-gray-600">${isHybrid ? '混合系统' : '热泵'} LCC:</span>
                        <span class="font-semibold text-blue-700 text-right">${(hpSystemDetails.lcc.total / 10000).toFixed(2)} 万元</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">${boiler.name} LCC:</span>
                        <span class="font-semibold text-gray-700 text-right">${(boiler.lcc / 10000).toFixed(2)} 万元</span>
                    </div>
                </div>
            </div>`;
            resultsContent.innerHTML += resultCard;
        });

        // --- Conclusion ---
        let conclusionHTML = `<div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg space-y-2 result-card" style="transition-delay: ${150 * (comparisons.length + 1)}ms;"><h4 class="font-bold text-lg text-indigo-800 border-b pb-2">综合结论 (基于 ${lccYears} 年分析)</h4>`;

         // Helper for conclusion formatting
        const formatPercentConc = (n) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(1)}%`;
        const formatYearsConc = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)}年`;

        // ROI Conclusion
        const profitableROI = comparisons.filter(c => c.irr > discountRate && isFinite(c.irr)); // Filter out null/Infinity IRR
        if (profitableROI.length > 0) {
            const bestIRR = profitableROI.reduce((p, c) => (p.irr > c.irr) ? p : c);
            conclusionHTML += `<p class="text-sm text-gray-700"><b>投资回报 (ROI) 结论：</b>项目可行。相较于 <b>${profitableROI.map(p => p.name).join('、')}</b>，IRR 高于基准收益率(${formatPercentConc(discountRate)})。回报最佳的是替代 <b>${bestIRR.name}</b>，IRR 高达 <b>${formatPercentConc(bestIRR.irr)}</b>，动态回收期 <b>${formatYearsConc(bestIRR.dynamicPBP)}</b>。</p>`;
        } else {
             const bestNPV = comparisons.length > 0 ? comparisons.reduce((p, c) => (p.npv > c.npv) ? p : c) : null;
             if (bestNPV && bestNPV.npv > 0) {
                 conclusionHTML += `<p class="text-sm text-gray-700"><b>投资回报 (ROI) 结论：</b>项目勉强可行。相较于 <b>${bestNPV.name}</b>，项目净现值(NPV)为正 (<b>${(bestNPV.npv / 10000).toFixed(2)} 万元</b>)，但所有方案 IRR 均未超过基准收益率(${formatPercentConc(discountRate)})。</p>`;
             } else {
                 conclusionHTML += `<p class="text-sm text-red-700"><b>投资回报 (ROI) 结论：</b>项目不可行。相较于所有对比方案，项目的 IRR 均低于基准收益率(${formatPercentConc(discountRate)})，且 NPV 均为负。</p>`;
             }
        }

        // Environmental Conclusion
        const positiveCO2Reducers = comparisons.filter(c => c.co2Reduction > 0);
        if (positiveCO2Reducers.length > 0) {
            const bestEnviro = positiveCO2Reducers.reduce((p, c) => (p.co2Reduction > c.co2Reduction) ? p : c);
            conclusionHTML += `<p class="text-sm text-gray-700"><b>环境效益 (年)：</b>替代 <b>${bestEnviro.name}</b> 的环境效益最为显著，年碳减排量可达 <b>${bestEnviro.co2Reduction.toFixed(2)}</b> 吨CO₂，相当于植树约 <b>${bestEnviro.treesPlanted.toLocaleString(undefined, {maximumFractionDigits: 0})}</b> 棵。</p>`;
        } else if (comparisons.length > 0) {
             conclusionHTML += `<p class="text-sm text-gray-700"><b>环境效益 (年)：</b>根据当前参数，${isHybrid ? '混合' : '热泵'}方案相较于所选对比方案均无碳减排优势。</p>`;
        }
         conclusionHTML += '</div>';

        conclusionHTML += `<button id="toggle-details-btn" class="w-full mt-4 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示详细计算过程 (含公式)</button>`;
        conclusionHTML += `<button id="toggle-risk-btn" class="w-full mt-2 bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-300 text-sm">显示投资风险及对策分析</button>`;
        conclusionHTML += `<button id="printReportBtn" class="w-full mt-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-300 text-sm">打印本页报告 (A4)</button>`;
        conclusionHTML += `<div id="calculation-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;
        conclusionHTML += `<div id="risk-analysis-details" class="bg-gray-50 rounded-lg border text-sm space-y-4 details-section"></div>`;

        resultsContent.innerHTML += conclusionHTML;
    }


    // ==================
    // 核心计算按钮
    // ==================
    document.getElementById('calculateBtn').addEventListener('click', () => {
        // --- 1. 重置状态 & 读取LCC参数 ---
        resultsAreStale = false;
        document.getElementById('stale-results-notice').classList.add('hidden');
        document.getElementById('results-container').classList.remove('stale');
        detailedCalculations = {}; // 清空

        const lccYears = parseInt(document.getElementById('lccYears').value) || 15;
        const discountRate = (parseFloat(document.getElementById('discountRate').value) || 8) / 100;
        const energyInflationRate = (parseFloat(document.getElementById('energyInflationRate').value) || 3) / 100;
        const opexInflationRate = (parseFloat(document.getElementById('opexInflationRate').value) || 5) / 100;
        const lccParams = { lccYears, discountRate, energyInflationRate, opexInflationRate };
        detailedCalculations.lccParams = lccParams;

        // --- 2. 读取电价 & 排放因子 ---
        const isGreenElectricity = document.getElementById('greenElectricityToggle').checked;
        const gridFactorBaseValue = document.getElementById('gridFactor').dataset.baseValue;
        const gridFactor = isGreenElectricity ? 0 : (parseFloat(gridFactorBaseValue) || 0);

        // --- 3. 读取所有 V8.0 标准输入 (无论在哪种模式下都可能被用到) ---
        const inputs = {
            projectName: document.getElementById('projectName').value, 
            heatingLoad: parseFloat(document.getElementById('heatingLoad').value) || 0,
            operatingHours: parseFloat(document.getElementById('operatingHours').value) || 0,
            // Capex
            hpHostCapex: parseFloat(document.getElementById('hpCapex').value) * 10000 || 0,
            hpStorageCapex: parseFloat(document.getElementById('storageCapex').value) * 10000 || 0,
            hpCapex: (parseFloat(document.getElementById('hpCapex').value) * 10000 || 0) + (parseFloat(document.getElementById('storageCapex').value) * 10000 || 0),
            gasBoilerCapex: parseFloat(document.getElementById('gasBoilerCapex').value) * 10000 || 0,
            fuelBoilerCapex: parseFloat(document.getElementById('fuelBoilerCapex').value) * 10000 || 0,
            coalBoilerCapex: parseFloat(document.getElementById('coalBoilerCapex').value) * 10000 || 0,
            biomassBoilerCapex: parseFloat(document.getElementById('biomassBoilerCapex').value) * 10000 || 0,
            electricBoilerCapex: parseFloat(document.getElementById('electricBoilerCapex').value) * 10000 || 0,
            steamCapex: parseFloat(document.getElementById('steamCapex').value) * 10000 || 0,
            // Operation Params
            hpCop: parseFloat(document.getElementById('hpCop').value) || 0,
            gasBoilerEfficiency: parseFloat(document.getElementById('gasBoilerEfficiency').value) / 100 || 0,
            fuelBoilerEfficiency: parseFloat(document.getElementById('fuelBoilerEfficiency').value) / 100 || 0,
            coalBoilerEfficiency: parseFloat(document.getElementById('coalBoilerEfficiency').value) / 100 || 0,
            biomassBoilerEfficiency: parseFloat(document.getElementById('biomassBoilerEfficiency').value) / 100 || 0,
            electricBoilerEfficiency: parseFloat(document.getElementById('electricBoilerEfficiency').value) / 100 || 0,
            steamEfficiency: parseFloat(document.getElementById('steamEfficiency').value) / 100 || 0,
            // Prices
            gasPrice: parseFloat(document.getElementById('gasPrice').value) || 0,
            fuelPrice: parseFloat(document.getElementById('fuelPrice').value) || 0,
            coalPrice: parseFloat(document.getElementById('coalPrice').value) || 0,
            biomassPrice: parseFloat(document.getElementById('biomassPrice').value) || 0,
            steamPrice: parseFloat(document.getElementById('steamPrice').value) || 0,
             // Emission Factors (base values)
            gridFactor: gridFactor, // 已在上方计算
            gasFactor: parseFloat(document.getElementById('gasFactor').dataset.baseValue) || 0,
            fuelFactor: parseFloat(document.getElementById('fuelFactor').dataset.baseValue) || 0,
            coalFactor: parseFloat(document.getElementById('coalFactor').dataset.baseValue) || 0,
            biomassFactor: parseFloat(document.getElementById('biomassFactor').dataset.baseValue), 
            steamFactor: parseFloat(document.getElementById('steamFactor').dataset.baseValue) || 0,
             // Calorific Values (base values)
            gasCalorific: parseFloat(document.getElementById('gasCalorific').dataset.baseValue) || 0,
            fuelCalorific: parseFloat(document.getElementById('fuelCalorific').dataset.baseValue) || 0,
            coalCalorific: parseFloat(document.getElementById('coalCalorific').dataset.baseValue) || 0,
            biomassCalorific: parseFloat(document.getElementById('biomassCalorific').dataset.baseValue) || 0,
            steamCalorific: parseFloat(document.getElementById('steamCalorific').dataset.baseValue) || 0,
             // O&M Costs (convert 万元 to 元)
            hpOpexCost: (parseFloat(document.getElementById('hpOpexCost').value) || 0) * 10000,
            gasOpexCost: (parseFloat(document.getElementById('gasOpexCost').value) || 0) * 10000,
            fuelOpexCost: (parseFloat(document.getElementById('fuelOpexCost').value) || 0) * 10000,
            coalOpexCost: (parseFloat(document.getElementById('coalOpexCost').value) || 0) * 10000,
            biomassOpexCost: (parseFloat(document.getElementById('biomassOpexCost').value) || 0) * 10000,
            electricOpexCost: (parseFloat(document.getElementById('electricOpexCost').value) || 0) * 10000,
            steamOpexCost: (parseFloat(document.getElementById('steamOpexCost').value) || 0) * 10000,
        };
        detailedCalculations.inputs = inputs;
        
        // --- 4. 计算总需求 (所有模式通用) ---
        const annualHeatingDemandKWh = inputs.heatingLoad * inputs.operatingHours;
        detailedCalculations.annualHeatingDemandKWh = annualHeatingDemandKWh;

        if (!inputs.heatingLoad || !inputs.operatingHours || !inputs.hpCop) {
            alert('请填写有效的制热负荷、年运行小时和热泵SPF。');
            return;
        }

        // --- 5. 计算电价 (所有模式通用) ---
        // (V9.0 备注: 假设辅助电加热器也使用相同的电价时段分布)
        const priceTiers = [];
        let totalDist = 0;
        const priceTierErrorDiv = document.getElementById('priceTierError');
        priceTierErrorDiv.classList.add('hidden'); 
        
        document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
            const name = tierEl.querySelector('.tier-name').value.trim() || '时段';
            const price = parseFloat(tierEl.querySelector('.tier-price').value) || 0;
            const dist = parseFloat(tierEl.querySelector('.tier-dist').value) || 0;
            totalDist += dist;
            priceTiers.push({ name, price, dist });
        });

        // 电价验证
        if (Math.abs(totalDist - 100) > 0.1) {
            priceTierErrorDiv.textContent = `电价时段总比例必须为 100%，当前为 ${totalDist.toFixed(1)}%！`;
            priceTierErrorDiv.classList.remove('hidden');
            return;
        }
        if (priceTiers.some(t => t.price <= 0 || t.dist <= 0)) {
            priceTierErrorDiv.textContent = '电价或运行比例必须大于 0！';
            priceTierErrorDiv.classList.remove('hidden');
            return;
        }

        // --- 6. V9.1 模式切换：检查 "方案 A" 是哪种计算模式 ---
        const isHybridMode = document.getElementById('modeHybrid') ? document.getElementById('modeHybrid').checked : false;
        detailedCalculations.isHybridMode = isHybridMode;

        // --- 7. 计算热泵耗电 & 加权平均电价 (V9.0: 此处计算的是 100% 负荷下的情况，供电锅炉和V8模式使用) ---
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
            // Fallback for COP=0 or no load, calculate avg price from inputs
            let totalWeight = 0;
            priceTiers.forEach(t => { weightedAvgElecPrice += t.price * t.dist; totalWeight += t.dist; });
            if (totalWeight > 0) weightedAvgElecPrice = weightedAvgElecPrice / totalWeight;
            else if (priceTiers.length === 1) weightedAvgElecPrice = priceTiers[0].price; // Single tier, 0 dist
        }
        detailedCalculations.weightedAvgElecPrice = weightedAvgElecPrice; // ** 存入全局，供 'electric' 锅炉计算使用 **


        // =========================================================
        //
        //               V9.1 逻辑分支开始
        //
        // =========================================================

        let hpSystemDetails; // V9.1: 统一的 "方案 A" 实体

        if (isHybridMode) {
            
            // --- H-1. 读取 V9.0 专用输入 ---
            const hpLoadShare = (parseFloat(document.getElementById('hybridLoadShare').value) || 0) / 100;
            const auxHeaterType = document.getElementById('hybridAuxHeaterType').value;
            const auxHeaterCapex = (parseFloat(document.getElementById('hybridAuxHeaterCapex').value) || 0) * 10000;
            const auxHeaterOpex = (parseFloat(document.getElementById('hybridAuxHeaterOpex').value) || 0) * 10000; // V9.0 新增
            
            // V9.1: 不再读取 baselineType, 因为 "方案 B" 来自多选框
            detailedCalculations.hybridInputs = { hpLoadShare, auxHeaterType, auxHeaterCapex, auxHeaterOpex };
            
            // --- H-2. 拆分热负荷 ---
            const hpHeatingDemandKWh = annualHeatingDemandKWh * hpLoadShare;
            const auxHeatingDemandKWh = annualHeatingDemandKWh * (1.0 - hpLoadShare);

            // --- H-3. 计算方案 A (混合系统) ---
            
            // H-3a: 计算热泵部分
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
            
            // --- 修复点 2: 计算并存储 undiscounted salvage value ---
            const hpSalvageRate = (parseFloat(document.getElementById('hpSalvageRate').value) || 0) / 100;
            const hpSalvageValue_Undiscounted = inputs.hpCapex * hpSalvageRate;
            const hpSalvageNPV_Hybrid = hpSalvageValue_Undiscounted / Math.pow(1 + discountRate, lccYears);
            // --- 修复结束 ---
            
            const hpLCC_Hybrid = inputs.hpCapex + hpEnergyNPV_Hybrid + hpOpexNPV_Hybrid - hpSalvageNPV_Hybrid;

            // V9.0 BUG 修复：将热泵部分存入 detailedCalculations.hp
            const hpDetails = {
                isHybridPart: true,
                energyCost: hpEnergyCost_Hybrid, energyCostDetails: hpEnergyCostDetails_Hybrid,
                opexCost: inputs.hpOpexCost, opex: hpOpex_Year1_Hybrid, co2: hpCo2_Hybrid,
                lcc: {
                    capex: inputs.hpCapex, capex_host: inputs.hpHostCapex, capex_storage: inputs.hpStorageCapex,
                    energyNPV: hpEnergyNPV_Hybrid, opexNPV: hpOpexNPV_Hybrid,
                    salvageRate: hpSalvageRate, 
                    salvageNPV: hpSalvageNPV_Hybrid,
                    salvageValue: hpSalvageValue_Undiscounted, // <-- 修复点 2: 在此存储
                    total: hpLCC_Hybrid
                }
            };
            detailedCalculations.hp = hpDetails;
            // V9.0 BUG 修复结束
            
            // H-3b: 计算辅助热源部分
            // 使用新辅助函数: calculateBoilerDetails(key, demand_kWh, capex, opex, lccParams, inputs, gridFactor)
            const auxDetails = calculateBoilerDetails(
                auxHeaterType, 
                auxHeatingDemandKWh, 
                auxHeaterCapex, 
                auxHeaterOpex, // 使用专用的辅助热源运维成本
                lccParams, 
                inputs, 
                gridFactor
            );
            detailedCalculations.hybrid_aux = auxDetails; // 存入详细计算

            // H-3c: 汇总混合系统 (方案 A)
            const hybridSystem = {
                isHybrid: true,
                name: "混合系统 (热泵 + " + auxDetails.name + ")",
                energyCost: hpDetails.energyCost + auxDetails.energyCost,
                opexCost: hpDetails.opexCost + auxDetails.opexCost,
                opex: hpDetails.opex + auxDetails.opex, // 年总运行成本
                co2: hpDetails.co2 + auxDetails.co2,
                // V9.0 BUG 修复：确保 annualHeatingDemandKWh 不为0
                cost_per_kwh_heat: annualHeatingDemandKWh > 0 ? ((hpDetails.energyCost + auxDetails.energyCost) / annualHeatingDemandKWh) : 0, // 混合产热成本
                lcc: {
                    capex: hpDetails.lcc.capex + auxDetails.lcc.capex,
                    capex_host: hpDetails.lcc.capex_host, // 仅热泵
                    capex_storage: hpDetails.lcc.capex_storage, // 仅热泵
                    capex_aux: auxDetails.lcc.capex, // 辅助热源
                    energyNPV: hpDetails.lcc.energyNPV + auxDetails.lcc.energyNPV,
                    opexNPV: hpDetails.lcc.opexNPV + auxDetails.lcc.opexNPV,
                    salvageNPV: hpDetails.lcc.salvageNPV + auxDetails.lcc.salvageNPV,
                    salvageValue: hpDetails.lcc.salvageValue + auxDetails.lcc.salvageValue, // <-- 修复点 3: 汇总
                    total: hpDetails.lcc.total + auxDetails.lcc.total
                }
            };
            detailedCalculations.hybridSystem = hybridSystem; // 存入详细计算
            
            // --- H-4. V9.1: 将混合系统赋给统一的 "方案 A" 实体 ---
            hpSystemDetails = hybridSystem;

            // --- V9.1: 删除了 V9.0 的 H-4, H-5, H-6 (计算单一基准和渲染) ---


        } else {
            // =========================================================
            //
            //               V8.0 (标准模式) 逻辑开始
            //
            // =========================================================

            // --- S-1. 计算 100% 热泵方案 (方案A) ---
            // (V9.0 备注: 此处使用 V8.0 的 _FullLoad 变量)
            const hpOpex_Year1 = hpEnergyCost_FullLoad + inputs.hpOpexCost;
            const hpCo2 = totalHpElec_FullLoad * gridFactor;
            
            const hpEnergyNPV = calculateNPV(hpEnergyCost_FullLoad, lccYears, discountRate, energyInflationRate);
            const hpOpexNPV = calculateNPV(inputs.hpOpexCost, lccYears, discountRate, opexInflationRate);
            
            // --- 修复点 4: 计算并存储 undiscounted salvage value ---
            const hpSalvageRate = (parseFloat(document.getElementById('hpSalvageRate').value) || 0) / 100;
            const hpSalvageValue_Undiscounted = inputs.hpCapex * hpSalvageRate;
            const hpSalvageNPV = hpSalvageValue_Undiscounted / Math.pow(1 + discountRate, lccYears);
            // --- 修复结束 ---
            
            const hpLCC = inputs.hpCapex + hpEnergyNPV + hpOpexNPV - hpSalvageNPV;

            detailedCalculations.hp = {
                isHybrid: false,
                energyCost: hpEnergyCost_FullLoad, energyCostDetails: hpEnergyCostDetails_FullLoad,
                opexCost: inputs.hpOpexCost, opex: hpOpex_Year1, co2: hpCo2,
                cost_per_kwh_heat: (inputs.hpCop > 0) ? (weightedAvgElecPrice / inputs.hpCop) : 0, // V8.0 产热成本
                lcc: {
                    capex: inputs.hpCapex, capex_host: inputs.hpHostCapex, capex_storage: inputs.hpStorageCapex,
                    energyNPV: hpEnergyNPV, opexNPV: hpOpexNPV,
                    salvageRate: hpSalvageRate, 
                    salvageNPV: hpSalvageNPV,
                    salvageValue: hpSalvageValue_Undiscounted, // <-- 修复点 4: 在此存储
                    total: hpLCC
                }
            };
            
            // --- S-1b. V9.1: 将 100% 热泵赋给统一的 "方案 A" 实体 ---
            hpSystemDetails = detailedCalculations.hp; 

            // --- V9.1: 删除了 V8.0 的 S-2, S-3, S-4 (计算对比和渲染) ---
            // (这些逻辑被移到了 if/else 块的外部)
        }

        // =========================================================
        //
        //       V9.1 统一对比与渲染 (合并 V8.0 和 V9.0)
        //
        // =========================================================

        // --- S-2. (V9.1) 循环计算所有 "方案 B" (对比基准) ---
        // (此逻辑来自 V8.0 S-2)
        const results = [];
        
        if (document.getElementById('compare_gas').checked) {
            const gasDetails = calculateBoilerDetails('gas', annualHeatingDemandKWh, inputs.gasBoilerCapex, inputs.gasOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.gas = gasDetails;
            results.push(gasDetails);
        }
        if (document.getElementById('compare_fuel').checked) {
            const fuelDetails = calculateBoilerDetails('fuel', annualHeatingDemandKWh, inputs.fuelBoilerCapex, inputs.fuelOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.fuel = fuelDetails;
            results.push(fuelDetails);
        }
        if (document.getElementById('compare_coal').checked) {
            const coalDetails = calculateBoilerDetails('coal', annualHeatingDemandKWh, inputs.coalBoilerCapex, inputs.coalOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.coal = coalDetails;
            results.push(coalDetails);
        }
        if (document.getElementById('compare_biomass').checked) {
            const biomassDetails = calculateBoilerDetails('biomass', annualHeatingDemandKWh, inputs.biomassBoilerCapex, inputs.biomassOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.biomass = biomassDetails;
            results.push(biomassDetails);
        }
        if (document.getElementById('compare_electric').checked) {
            const electricDetails = calculateBoilerDetails('electric', annualHeatingDemandKWh, inputs.electricBoilerCapex, inputs.electricOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.electric = electricDetails;
            results.push(electricDetails);
        }
        if (document.getElementById('compare_steam').checked) {
            const steamDetails = calculateBoilerDetails('steam', annualHeatingDemandKWh, inputs.steamCapex, inputs.steamOpexCost, lccParams, inputs, gridFactor);
            detailedCalculations.steam = steamDetails;
            results.push(steamDetails);
        }

        // --- S-3. (V9.1) 计算 ROI (方案A vs 方案B, C, D...) ---
        // (此逻辑来自 V8.0 S-3, 但 "hpDetails" 已被替换为 "hpSystemDetails")
        const comparisons = results.map(boiler => {
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
            
            const co2Reduction = (boiler.co2 - hpSystemDetails.co2) / 1000;
            const treesPlanted = co2Reduction > 0 ? (co2Reduction * 1000 / 18.3) : 0;
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
            
            // --- 修复点 5: 使用 .salvageValue 替换 .salvageRate 逻辑 ---
            const hpSalvageValue = hpSystemDetails.lcc.salvageValue;
            const boilerSalvageValue = boiler.lcc.salvageValue;
            // --- 修复结束 ---
            
            const deltaSalvage = hpSalvageValue - boilerSalvageValue;
            cash_flows[lccYears] += deltaSalvage;
            
            const irr = findIRR(cash_flows);
            const dynamicPBP = calculateDynamicPBP(cash_flows, discountRate, lccYears);

            return {
                key: boiler.key, name: boiler.name,
                opex: boiler.opex, opexSaving,
                investmentDiff, paybackPeriod,
                co2Reduction, treesPlanted,
                lcc: boiler.lcc.total, lccSaving,
                npv, irr, dynamicPBP,
                simpleROI, electricalPriceRatio,
                energyCostSaving, energyCostSavingRate
            };
        });
        detailedCalculations.comparisons = comparisons;

        // --- S-4. (V9.1) 统一渲染 ---
        renderResults(hpSystemDetails, comparisons, lccYears, discountRate);


        // =========================================================
        //
        //               V9.1 逻辑分支结束
        //
        // =========================================================

        // --- 7. (通用) 激活按钮和监听器 ---
        resultsAreShown = true;
        
        // 激活暂存按钮
        const saveBtn = document.getElementById('saveScenarioBtn');
        const scenarioToggle = document.getElementById('enableScenarioComparison');
        if (scenarioToggle.checked) {
            saveBtn.classList.remove('hidden');
            saveBtn.disabled = false;
            saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            saveBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            saveBtn.textContent = '暂存当前方案';
        } else {
            saveBtn.classList.add('hidden');
        }

        // 重新绑定暂存按钮监听器
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', () => {
            const projectName = document.getElementById('projectName').value.trim() || '未命名方案';
            const hpCop = parseFloat(document.getElementById('hpCop').value) || 0;
            const comparisons = detailedCalculations.comparisons || [];
            
            // V9.1: 此处逻辑不变，isHybridMode (全局) 和 detailedCalculations (全局) 是正确的
            const systemToSave = isHybridMode ? detailedCalculations.hybridSystem : detailedCalculations.hp;
            
            if (systemToSave && comparisons.length > 0) {
                // 寻找一个基准进行对比，优先使用天然气 (V8.0) 或唯一的基准 (V9.0)
                const baselineComparison = comparisons.find(c => c.key === 'gas') || comparisons[0];
                saveHpScenario(projectName, systemToSave, hpCop, baselineComparison);
                
                newSaveBtn.textContent = '方案已暂存!';
                setTimeout(() => { newSaveBtn.textContent = '暂存当前方案'; }, 2000);

            } else if (systemToSave && comparisons.length === 0) {
                 alert('无法暂存，因为没有勾选任何对比方案。');
            } else {
                alert('无法暂存，计算数据不存在。');
            }
        });

        // 绑定详情、风险和打印按钮
        document.getElementById('toggle-details-btn').addEventListener('click', (e) => {
            const details = document.getElementById('calculation-details');
            e.target.textContent = details.classList.toggle('visible') ? '隐藏详细计算过程 (含公式)' : '显示详细计算过程 (含公式)';
            if (details.classList.contains('visible')) populateCalculationDetails();
        });

        document.getElementById('toggle-risk-btn').addEventListener('click', (e) => {
            const details = document.getElementById('risk-analysis-details');
            const isVisible = details.classList.toggle('visible');
            e.target.textContent = isVisible ? '隐藏投资风险及对策分析' : '显示投资风险及对策分析';
            if (isVisible && details.innerHTML === '') { 
                populateRiskAnalysisDetails();
            }
        });

        document.getElementById('printReportBtn').addEventListener('click', () => {
            if (!detailedCalculations.comparisons) {
                alert('请先计算，再生成打印报告。');
                return;
            }
            buildPrintReport();
            window.print();
        });

        document.getElementById('results-placeholder').classList.add('hidden');
        document.getElementById('results-content').classList.remove('hidden');

        setTimeout(() => {
            document.querySelectorAll('.result-card').forEach(card => card.classList.add('visible'));
        }, 10);
    });

// ==================
// 结束 DOMContentLoaded
// ==================
}); 

function populateCalculationDetails() {
    // V9.0: 此函数现在依赖 isHybridMode 标志
    const { isHybridMode, lccParams, hp, gas, fuel, coal, biomass, electric, steam, annualHeatingDemandKWh, hybridSystem, hybrid_aux, baselineSystem, inputs } = detailedCalculations;
    const f = (n, p = 2) => n ? n.toLocaleString(undefined, {maximumFractionDigits: p}) : '0';
    const fYuan = (n) => f(n, 0);
    const fWan = (n) => f(n / 10000);

    const gridFactorBase = document.getElementById('gridFactor').dataset.baseValue;
    const gridFactorToDisplay = document.getElementById('greenElectricityToggle').checked ? 0 : gridFactorBase;
    const gridFactorLabel = document.getElementById('greenElectricityToggle').checked ? '绿电因子' : '电网因子';

    
    let detailsHTML = `
        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">A. 核心经济指标计算方法与依据</h3>
        
        <h4>1. 全寿命周期成本 (LCC)</h4>
        <p class="authority">LCC (Life Cycle Cost) 是指产品在整个生命周期内（从投资到报废）的总成本，经过折现率调整后的现值。</p>
        <div class="formula-block">
LCC = CAPEX + NPV(Energy) + NPV(O&M) - NPV(Salvage)
</div>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li><b>CAPEX:</b> 初始投资 (第0年成本)。</li>
            <li><b>NPV(Energy):</b> 全周期能源成本的净现值。</li>
            <li><b>NPV(O&M):</b> 全周期运维成本的净现值。</li>
            <li><b>NPV(Salvage):</b> 设备残值的净现值 (作为收益扣除)。</li>
        </ul>

        <h4>2. 净现值 (NPV)</h4>
        <p class="authority">NPV (Net Present Value) 是项目全周期内产生的净现金流（节省的成本 - 额外投资）按折现率折算到今天的总和。<b>NPV > 0 代表项目可行。</b></p>
        <div class="formula-block">
NPV = (LCC_基准 - LCC_热泵) = (节省的LCC)
</div>

        <h4>3. 内部收益率 (IRR)</h4>
        <p class="authority">IRR (Internal Rate of Return) 是使项目净现值(NPV)等于零时的折现率。<b>IRR > 基准折现率，代表项目优秀。</b></p>
        <div class="formula-block">
NPV(CashFlow, IRR) = 0
其中: CashFlow = [ -ΔInvest, Save_Y1, Save_Y2, ... ]
</div>

        <h4>4. 动态投资回收期 (PBP)</h4>
        <p class="authority">PBP (Payback Period) 是指考虑了资金时间价值（折现率）后，项目累计节省的净现金流（折现后）等于初始额外投资所需的时间。</p>
    `;
    
    // V9.0: 动态插入 V8.0 和 V9.0 不同的计算过程
    
    if (isHybridMode) {
        // --- V9.0 混合模式的计算过程 ---
        
        const hpLoadSharePercent = (detailedCalculations.hybridInputs.hpLoadShare * 100).toFixed(1);
        const auxLoadSharePercent = (100 - parseFloat(hpLoadSharePercent)).toFixed(1);
        
        detailsHTML += `
            <hr class="my-6">
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">B. 本次项目详细计算过程 (混合模式)</h3>
            
            <h4 class="font-bold text-md text-gray-800">1. 基础数据</h4>
            <p><b>LCC/ROI 参数:</b> ${lccParams.lccYears} 年, 折现率 ${ (lccParams.discountRate * 100).toFixed(1)}%, 能源涨幅 ${ (lccParams.energyInflationRate * 100).toFixed(1)}%, 运维涨幅 ${ (lccParams.opexInflationRate * 100).toFixed(1)}%</p>
            <p><b>年总制热量:</b> ${f(annualHeatingDemandKWh)} kWh</p>
            <hr>
            
            <h4 class="font-bold text-md text-gray-800">2. 方案A: 混合系统 (总计)</h4>
            <p><b>年总运行成本 (第1年):</b> ${fWan(hybridSystem.opex)} 万元 (能源 ${fWan(hybridSystem.energyCost)} 万 + 运维 ${fWan(hybridSystem.opexCost)} 万)</p>
            <p><b>年总碳排放量:</b> ${f(hybridSystem.co2 / 1000, 2)} 吨 CO₂</p>
            <p><b>混合系统 LCC:</b> ${fWan(hybridSystem.lcc.total)} 万元 (投资 ${fWan(hybridSystem.lcc.capex)} + 能源NPV ${fWan(hybridSystem.lcc.energyNPV)} + 运维NPV ${fWan(hybridSystem.lcc.opexNPV)} - 残值NPV ${fWan(hybridSystem.lcc.salvageNPV)})</p>
            <p class="font-semibold"><b>混合系统产热成本:</b> ${f(hybridSystem.cost_per_kwh_heat, 4)} 元/kWh_热</p>
            <hr>

            <h4 class="font-bold text-md text-gray-800" style="color: #1d4ed8;">2a. 混合系统 - 热泵部分 (承担 ${hpLoadSharePercent}% 负荷)</h4>
            <p><b>热泵制热量:</b> ${f(annualHeatingDemandKWh)} * ${hpLoadSharePercent}% = ${f(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0) * inputs.hpCop)} kWh</p>
            <p><b>年总电耗:</b> ${f(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0))} kWh</p>
            ${hp.energyCostDetails.tiers.map(t => `<p class="pl-4">↳ <b>${t.name}:</b> ${f(t.elec)} kWh * ${t.price} 元/kWh = ${fYuan(t.cost)} 元</p>`).join('')}
            <p><b>年能源成本 (热泵):</b> ${fYuan(hp.energyCost)} 元</p>
            <p><b>年运维(O&M)成本 (热泵):</b> ${fYuan(hp.opexCost)} 元</p>
            <p><b>年碳排放量 (热泵):</b> ${f(hp.co2)} kg</p>
            
            <h4 class="font-bold text-md text-gray-800" style="color: #7f1d1d;">2b. 混合系统 - 辅助热源 (${hybrid_aux.name}, 承担 ${auxLoadSharePercent}% 负荷)</h4>
            <p><b>辅助热源制热量:</b> ${f(annualHeatingDemandKWh * (1.0 - detailedCalculations.hybridInputs.hpLoadShare))} kWh</p>
            <p><b>年能源消耗:</b> ${f(hybrid_aux.consumption)} ${hybrid_aux.key === 'gas' ? 'm³' : (hybrid_aux.key === 'electric' ? 'kWh' : '吨')}</p>
            <p><b>年能源成本 (辅助):</b> ${fYuan(hybrid_aux.energyCost)} 元</p>
            <p><b>年运维(O&M)成本 (辅助):</b> ${fYuan(hybrid_aux.opexCost)} 元</p>
            <p><b>年碳排放量 (辅助):</b> ${f(hybrid_aux.co2)} kg</p>
            <hr>

            <h4 class="font-bold text-md text-gray-800">3. 方案B: 对比基准 (100% 传统热源)</h4>
            `;
        
        // V9.1: 循环显示所有对比基准 (方案 B)
        const boilers = [gas, fuel, coal, biomass, electric, steam].filter(Boolean); // 过滤掉未计算的
        boilers.forEach(b => {
             detailsHTML += `
                <div class="pt-2 border-t mt-2">
                    <p><b>${b.name} (100% 负荷):</b></p>
                    <p class="pl-4">↳ <b>年能源消耗:</b> ${f(b.consumption)} ${b.key === 'gas' ? 'm³' : (b.key === 'electric' ? 'kWh' : '吨')}</p>
                    <p class="pl-4">↳ <b>年总运行成本 (第1年):</b> ${fWan(b.opex)} 万元 (能源 ${fWan(b.energyCost)} + 运维 ${fWan(b.opexCost)})</p>
                    <p class="pl-4">↳ <b>年碳排放量 (基准):</b> ${f(b.co2)} kg</p>
                    <p class="pl-4 font-semibold">↳ <b>基准产热成本:</b> ${f(b.cost_per_kwh_heat, 4)} 元/kWh_热</p>
                    <p class="pl-4">↳ <b>基准 LCC:</b> ${fWan(b.lcc.total)} 万元</p>
                </div>
            `;
        });


        detailsHTML += `
            <hr class="my-6">
            <h4 class="font-bold text-md text-gray-800">4. LCC 与 ROI 对比 (混合 vs 基准)</h4>
        `;
        
        // V9.1: 循环显示所有对比结果
        detailedCalculations.comparisons.forEach(c => {
            const boiler = detailedCalculations[c.key];
            detailsHTML += `
                 <div class="pt-2 border-t mt-2">
                    <p><b>对比: ${hybridSystem.name} vs ${c.name}</b></p>
                    <p class="pl-4"><b>EPR (电热价格比):</b> ${f(boiler.cost_per_kwh_heat, 4)} / ${f(hybridSystem.cost_per_kwh_heat, 4)} = <b>${f(c.electricalPriceRatio, 2)}</b></p>
                    <p class="pl-4"><b>年碳减排量:</b> (${f(boiler.co2)} - ${f(hybridSystem.co2)}) kg = <b>${f(c.co2Reduction * 1000)} kg</b></p>
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
                hpEnergyCostDetailsHTML += `<p class="pl-4">↳ <b>${tier.name}:</b> ${f(tier.elec)} kWh * ${tier.price} 元/kWh = ${fYuan(tier.cost)} 元</p>`;
            });
            hpEnergyCostDetailsHTML += `<p><b>年能源成本 (各时段合计):</b> ${fYuan(hp.energyCost)} 元</p>`;
        }

        detailsHTML += `
            <hr class="my-6">
            <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">B. 本次项目详细计算过程 (标准模式)</h3>
            
            <h4 class="font-bold text-md text-gray-800">1. 基础数据</h4>
            <p><b>LCC/ROI 参数:</b> ${lccParams.lccYears} 年, 折现率 ${ (lccParams.discountRate * 100).toFixed(1)}%, 能源涨幅 ${ (lccParams.energyInflationRate * 100).toFixed(1)}%, 运维涨幅 ${ (lccParams.opexInflationRate * 100).toFixed(1)}%</p>
            <p><b>年总制热量:</b> ${f(annualHeatingDemandKWh)} kWh = ${f(annualHeatingDemandKWh * 3.6)} MJ</p>
            <hr>
            
            <h4 class="font-bold text-md text-gray-800">2. 热泵系统计算 (第1年)</h4>
            <p><b>年总电耗:</b> ${f(annualHeatingDemandKWh)} kWh (年总制热量) / ${document.getElementById('hpCop').value} (SPF) = ${f(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0))} kWh</p>
            ${hpEnergyCostDetailsHTML}
            <p><b>年运维(O&M)成本:</b> ${fYuan(hp.opexCost)} 元</p>
            <p><b>年总运行成本 (第1年):</b> ${fYuan(hp.energyCost)} + ${fYuan(hp.opexCost)} = ${fYuan(hp.opex)} 元 ≈ <b>${fWan(hp.opex)} 万元</b></p>
            <p><b>加权平均电价:</b> ${f(detailedCalculations.weightedAvgElecPrice, 4)} 元/kWh</p>
            <p class="font-semibold"><b>热泵产热成本:</b> ${f(detailedCalculations.weightedAvgElecPrice, 4)} 元/kWh / ${document.getElementById('hpCop').value} SPF = <b>${f(hp.cost_per_kwh_heat, 4)} 元/kWh_热</b></p>
            <p><b>年碳排放量 (使用${gridFactorLabel}):</b> ${f(hp.energyCostDetails.tiers.reduce((acc, t) => acc + t.elec, 0))} kWh * ${gridFactorToDisplay} kg/kWh = ${f(hp.co2)} kg</p>
            <hr>
            <h4 class="font-bold text-md text-gray-800">3. 对比方案计算 (第1年)</h4>
        `;

        const boilers = [];
        if (gas) boilers.push(gas);
        if (fuel) boilers.push(fuel);
        if (coal) boilers.push(coal);
        if (biomass) boilers.push(biomass);
        if (electric) boilers.push(electric);
        if (steam) boilers.push(steam);

        boilers.forEach(b => {
            const co2ReductionKg = b.co2 - hp.co2;
            const trees = co2ReductionKg > 0 ? (co2ReductionKg / 18.3) : 0;
            const epr = detailedCalculations.comparisons.find(c => c.key === b.key)?.electricalPriceRatio || 0;
            
            detailsHTML += `
                <div class="pt-2 border-t mt-2">
                    <p><b>${b.name}:</b> 年消耗量 ${f(b.consumption)} ${b.key === 'gas' ? 'm³' : (b.key === 'electric' ? 'kWh' : '吨')}</p>
                    <p class="pl-4">↳ <b>年能源成本:</b> ${fYuan(b.energyCost)} 元</p>
                    <p class="pl-4 font-semibold">↳ <b>${b.name}产热成本:</b> ${f(b.cost_per_kwh_heat, 4)} 元/kWh_热</p>
                    <p class="pl-4 text-blue-700 font-semibold">↳ <b>电热价格比 (EPR):</b> ${f(b.cost_per_kwh_heat, 4)} / ${f(hp.cost_per_kwh_heat, 4)} = <b>${epr ? epr.toFixed(2) : 'N/A'}</b></p>
                    <p class="pl-4">↳ <b>年运维(O&M)成本:</b> ${fYuan(b.opexCost)} 元</p>
                    <p class="pl-4">↳ <b>年总运行成本 (第1年):</b> ${fYuan(b.opex)} 元 ≈ <b>${fWan(b.opex)} 万元</b></p>
                    <p class="pl-4">↳ <b>年碳排放量:</b> ${f(b.co2)} kg</p>
                    <p class="pl-4 text-green-700">↳ <b>年碳减排量:</b> ${f(co2ReductionKg)} kg ≈ <b>${f(co2ReductionKg/1000)} 吨</b></p>
                </div>
            `;
        });
        
        detailsHTML += `
            <hr class="my-6">
            <h4 class="font-bold text-md text-gray-800">4. 全寿命周期成本 (LCC) 与 ROI 分析 (基于NPV)</h4>
        `;
        
        detailedCalculations.comparisons.forEach(c => {
            const boiler = detailedCalculations[c.key];
            detailsHTML += `
                 <div class="pt-2 border-t mt-2">
                    <p><b>对比: ${hp.isHybrid ? '混合系统' : '热泵'} vs ${c.name}</b></p>
                    <p class="pl-4"><b>热泵 LCC:</b> ${fWan(hp.lcc.total)} 万元</p>
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

/* --- V9.0: 风险分析函数 (内容不变) --- */
function populateRiskAnalysisDetails() {
    const riskHTML = `
        <h3 class="font-bold text-lg text-gray-900 border-b pb-2 mb-4">工业热泵投资风险及对策分析</h3>
        
        <h4>1. 政策与市场风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li>
                <b>风险 (电价波动):</b> "峰谷尖"电价政策调整，尤其是谷电价格上涨或峰电涨幅不及预期，可能导致热泵（特别是带储能的）运行成本高于预期，拉长投资回收期。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 精确评估:</b> 在LCC计算时，应采用（加权平均电价）或（分时电价模型）进行精确测算，避免使用单一电价估算。
                <b>(2) 敏感性分析:</b> 测算电价上涨 10%、20% 时对IRR和PBP的影响，评估项目抗风险能力。
                <b>(3) 绿电合约:</b> 探索与发电企业签订长期购电协议 (PPA)，锁定未来5-10年的电价成本。
            </li>
            <li>
                <b>风险 (补贴退坡):</b> 依赖政府节能改造补贴的项目，可能因补贴政策到期或标准提高而导致初始投资回收困难。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 明确基准:</b> 财务测算应以“无补贴”为基准情景，将补贴视为“额外收益”而非“必要条件”。
                <b>(2) 碳资产:</b> 评估项目（尤其是替代燃煤锅炉）产生CCER（国家核证自愿减排量）的潜力，将其作为未来的潜在收益来源。
            </li>
        </ul>

        <h4>2. 技术与运行风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li>
                <b>风险 (性能衰减/SPF不达标):</b> 热泵在极端天气（严寒）下制热能力下降，或全年综合能效系数(SPF)低于设计值(3.0)，导致实际运行电耗过高。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 选型匹配:</b> 必须基于项目地最冷月平均工况（而非年平均）进行主机选型和制热量核算。
                <b>(2) 耦合设计 (V9.0):</b> 采用“热泵 + 辅助热源”（如燃气或电加热）的耦合方案，热泵承担中低温柔区（高效区），辅助热源承担高温区，保障极端工况下的供热，并优化全系统LCC。
                <b>(3) 明确SPF:</b> 投标和设计阶段应明确SPF的计算边界（是否包含水泵、辅热等），并将其作为验收核心指标。
            </li>
            <li>
                <b>风险 (负荷匹配度低):</b> 生产线实际用热负荷（如间歇性用热）与热泵额定负荷不匹配，导致热泵频繁启停或低效运行。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 储能缓冲:</b> 对于负荷波动大的工况（如电镀、清洗线），必须配备适当容量的储热水箱（储能系统），实现“削峰填谷”，允许热泵在谷电时段稳定运行，在峰时段供热。
                <b>(2) 变频调节:</b> 优先采用变频热泵机组，使其在 30% ~ 100% 负荷下均能高效运行。
            </li>
        </ul>

        <h4>3. 财务与LCC风险</h4>
        <ul class="list-disc list-inside text-sm space-y-1">
            <li>
                <b>风险 (LCC估算偏差):</b> 仅对比“第1年运行成本”，忽略了初始投资(CAPEX)和未来成本（通胀、运维）的差异。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 采用LCC:</b> 坚持使用 LCC (全寿命周期成本) 作为决策依据。
                <b>(2) 考虑通胀:</b> 必须设置合理的“能源价格涨幅”（如3%）和“运维成本涨幅”（如5%），因为化石能源（天然气）的涨幅预期通常高于电价。
            </li>
            <li>
                <b>风险 (IRR/PBP误判):</b> 采用“静态回收期”替代“动态回收期(PBP)”，忽略资金的时间价值（利息/折现率），导致对项目收益过于乐观。
            </li>
            <li>
                <b>对策:</b> 
                <b>(1) 明确折现率:</b> 必须与业主商定一个合理的“基准折现率/收益率”（如8%）。
                <b>(2) 核心指标:</b> 必须使用 <b>IRR</b> 和 <b>动态PBP</b> 作为核心财务指标。IRR > 折现率，项目才具备财务可行性。
            </li>
        </ul>
    `;
    document.getElementById('risk-analysis-details').innerHTML = riskHTML;
}

/* --- V9.0: A4打印函数 (已更新) --- */
function buildPrintReport() {
    const { isHybridMode, lccParams, hp, comparisons, inputs, hybridSystem, baselineSystem } = detailedCalculations;

    const fWan = (n) => (n / 10000).toFixed(2);
    const fPercent = (n, p = 1) => (n === null || !isFinite(n)) ? 'N/A' : `${(n * 100).toFixed(p)} %`;
    const fYears = (n) => (n === null || !isFinite(n)) ? '无法回收' : `${n.toFixed(2)}`;
    const fTon = (n) => (n).toFixed(2);
    const fNum = (n, p = 1) => (n === null || !isFinite(n) || n === 0) ? 'N/A' : n.toFixed(p);
    const fInt = (n) => (n).toLocaleString(undefined, {maximumFractionDigits: 0});

    const projectName = inputs.projectName || document.getElementById('projectName').value;
    const reportDate = new Date().toLocaleDateString('zh-CN');
    let reportHTML = `
        <div class="print-report-header">
            <h2>${projectName} 项目</h2>
            <h1>热泵经济与环境效益分析报告</h1>
            <p>报告日期: ${reportDate}</p>
        </div>
        <div class="print-report-section">
            <h3>1. 核心输入参数</h3>
            <table class="print-report-table">
                <tr><td class="col-param">项目名称</td><td>${projectName}</td></tr>
                <tr><td class="col-param">制热负荷 (kW)</td><td class="align-right">${fInt(inputs.heatingLoad)}</td></tr>
                <tr><td class="col-param">年运行小时 (h)</td><td class="align-right">${fInt(inputs.operatingHours)}</td></tr>
                <tr><td class="col-param">经济分析年限 (年)</td><td class="align-right">${lccParams.lccYears}</td></tr>
                <tr><td class="col-param">折现率 (基准收益率)</td><td class="align-right">${fPercent(lccParams.discountRate, 1)}</td></tr>
            </table>
        </div>
    `;

    if (isHybridMode) {
        // --- V9.0 打印报告 ---
        const { hybridInputs } = detailedCalculations;
        
        // V9.1: 打印报告现在需要处理多个对比基准
        
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
                            <td><strong>方案A: ${hybridSystem.name}</strong><br><small>(热泵 ${fPercent(hybridInputs.hpLoadShare, 0)}% + ${detailedCalculations.hybrid_aux.name} ${fPercent(1-hybridInputs.hpLoadShare, 0)}%)</small></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.lcc.capex)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.energyCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.opexCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hybridSystem.opex)}</strong></td>
                        </tr>
        `;
        
        // V9.1: 循环添加对比方案 (方案 B)
        comparisons.forEach(c => {
            const boilerData = detailedCalculations[c.key];
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
        
        // V9.1: 循环添加对比结果
        comparisons.forEach(c => {
             reportHTML += `
                <tr>
                    <td>vs. 100% ${c.name}</td>
                    <td class="align-right">${fWan(c.lccSaving)}</td>
                    <td class="align-right">${fPercent(c.irr)}</td>
                    <td class="align-right">${fYears(c.dynamicPBP)}</td>
                    <td class="align-right">${fWan(c.opexSaving)}</td>
                    <td class="align-right">${fNum(c.electricalPriceRatio, 2)}</td>
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
        // --- V8.0 打印报告 (逻辑不变) ---
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
                            <td><strong>热泵方案 (SPF: ${inputs.hpCop.toFixed(2)})</strong></td>
                            <td class="align-right"><strong>${fWan(hp.lcc.capex)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.energyCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.opexCost)}</strong></td>
                            <td class="align-right"><strong>${fWan(hp.opex)}</strong></td>
                        </tr>
        `;
        // 循环添加对比方案
        comparisons.forEach(c => {
            const boilerData = detailedCalculations[c.key];
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
                <h3>3. 核心输出：经济与环境效益 (对比热泵方案)</h3>
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
                    <td class.align-right">${fWan(c.lccSaving)}</td>
                    <td class="align-right">${fPercent(c.irr)}</td>
                    <td class="align-right">${fYears(c.dynamicPBP)}</td>
                    <td class="align-right">${fNum(c.electricalPriceRatio, 2)}</td>
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

    // --- 通用页脚 ---
    reportHTML += `
        <div class="print-report-footer">
            <p>注：全寿命周期成本(LCC)与ROI计算基于净现值(NPV)法，符合《建设项目经济评价方法与参数》相关规定。</p>
            <p>本程序已尽力确保正确，但不承担相关法律责任，App bug 请联系荆炎荣 15280122625。</p>
        </div>
    `;

    document.getElementById('print-report-container').innerHTML = reportHTML;
}