// ui-setup.js
import { fuelData, converters, MJ_PER_KCAL } from './config.js';

// --- 模块内部状态 ---
let spfStandardValue = "3.0"; // 模式一 (标准) 的SPF默认值
let spfHybridValue = "4.0";   // 模式二 (混合) 的SPF默认值

// --- 私有辅助函数 ---

/**
 * 设置单位换算下拉框的监听
 */
function setupUnitConverters() {
// ... existing code ...
    converters.forEach(c => {
        const select = document.getElementById(c.selectId);
// ... existing code ...
// ... existing code ...
    // 初始化生物质热值为 3900 kcal/kg
    const biomassCalorificSelect = document.getElementById('biomassCalorificUnit');
// ... existing code ...
}

/**
 * 设置 "方案 B (对比基准)" 的勾选框切换逻辑
 */
function setupComparisonToggles() {
// ... existing code ...
    const toggles = document.querySelectorAll('.comparison-toggle');
    
    toggles.forEach(toggle => {
// ... existing code ...
        const applyToggleState = (isChecked) => {
            if (capexInput) capexInput.disabled = !isChecked;
// ... existing code ...
        };

        toggle.addEventListener('change', () => {
// ... existing code ...
        });

        applyToggleState(toggle.checked);
    });
}

/**
 * V10.0: 设置模式一 (标准) / 模式二 (混合) 的切换逻辑
 * 并独立记忆两种模式下的SPF值
 */
function setupModeSelector(markResultsAsStale) {
// ... existing code ...
    const modeStandard = document.getElementById('modeStandard');
    const modeHybrid = document.getElementById('modeHybrid');
// ... existing code ...
    if (!modeStandard || !modeHybrid || !hybridConfigInputs || !hpCopLabel || !hpCopInput) {
        console.warn('V10.0 (模式选择) UI 元素未在 HTML 中完全找到。');
// ... existing code ...
    }

    const applyModeState = (isEnteringHybrid) => {
// ... existing code ...
        hybridConfigInputs.classList.toggle('hidden', !isEnteringHybrid);
        
        if (isEnteringHybrid) {
// ... existing code ...
        } else {
            hpCopLabel.textContent = '全年综合性能系数 (SPF)';
// ... existing code ...
        }
        
        const defaultValue = isEnteringHybrid ? "4.0" : "3.0";
// ... existing code ...
        
        markResultsAsStale();
    };

    modeStandard.addEventListener('change', () => {
// ... existing code ...
            spfHybridValue = hpCopInput.value;
            applyModeState(false);
        }
    });

    modeHybrid.addEventListener('change', () => {
// ... existing code ...
            spfStandardValue = hpCopInput.value;
            applyModeState(true);
        }
    });
// ... existing code ...
    hpCopInput.value = spfStandardValue; 
    applyModeState(modeHybrid.checked); 
}


/**
 * 添加一个新的电价时段UI
 */
function addNewPriceTier(name = "", price = "", dist = "", markResultsAsStale) {
// ... existing code ...
    const container = document.getElementById('priceTiersContainer');
    const tierId = `tier-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
// ... existing code ...
    newTier.className = 'price-tier-entry grid grid-cols-1 md:grid-cols-10 gap-2 items-center';
    newTier.id = tierId;

    newTier.innerHTML = `
// ... existing code ...
            <input type="text" id="${tierId}-name" value="${name}" placeholder="例如: 峰时" class="tier-name w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
// ... existing code ...
            <input type="number" id="${tierId}-price" value="${price}" placeholder="例如: 1.2" class="tier-price w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
// ... existing code ...
            <input type="number" id="${tierId}-dist" value="${dist}" placeholder="例如: 40" class="tier-dist w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-1 flex items-end h-full">
// ... existing code ...
                删除
            </button>
        </div>
    `;

    container.appendChild(newTier);

    // 自动为输入框添加 stale 标记
// ... existing code ...
    newTier.querySelectorAll('input.track-change').forEach(input => {
        input.dataset.defaultValue = input.value;
// ... existing code ...
            const currentInput = event.target;
            const currentDefaultValue = currentInput.dataset.defaultValue;
// ... existing code ...
                currentInput.classList.toggle('default-param', currentInput.value === currentDefaultValue);
            }
            if (currentInput.classList.contains('track-change')) {
// ... existing code ...
            }
        });
    });

    // 为删除按钮添加事件
// ... existing code ...
    newTier.querySelector('.removePriceTierBtn').addEventListener('click', () => {
        if (document.querySelectorAll('.price-tier-entry').length > 1) {
// ... existing code ...
            markResultsAsStale(); 
        } else {
// ... existing code ...
        }
    });
}

/**
 * 设置电价时段的 "添加" 按钮
 */
function setupPriceTierControls(markResultsAsStale) {
// ... existing code ...
    document.getElementById('addPriceTierBtn').addEventListener('click', () => {
        addNewPriceTier("", "", "", markResultsAsStale);
// ... existing code ...
    });

    addNewPriceTier("平均电价", "0.7", "100", markResultsAsStale);
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
// ... existing code ...
        tierEl.querySelectorAll('input').forEach(input => {
            if (input.value) {
// ... existing code ...
            }
        });
    });
}

/**
 * 设置 "使用绿电" 勾选框逻辑
 */
function setupGreenElectricityToggle() {
// ... existing code ...
    const toggle = document.getElementById('greenElectricityToggle');
    const gridFactorInput = document.getElementById('gridFactor');
// ... existing code ...

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
// ... existing code ...
            gridFactorInput.dataset.baseValue = '0'; 
            gridFactorInput.disabled = true;
// ... existing code ...
            gridFactorInput.classList.remove('default-param');
        } else {
            const baseValue = gridFactorInput.getAttribute('data-base-value');
// ... existing code ...
            gridFactorInput.dataset.baseValue = baseValue; 
            gridFactorUnit.value = 'kgCO2/kWh';
// ... existing code ...

            gridFactorInput.disabled = false;
// ... existing code ...
            gridFactorInput.classList.add('default-param');
        }
    });
}

/**
 * 设置 "燃油种类" 下拉框逻辑
 */
function setupFuelTypeSelector() {
// ... existing code ...
    const fuelTypeSelect = document.getElementById('fuelType');
    const priceInput = document.getElementById('fuelPrice');
// ... existing code ...
    const factorUnitSelect = document.getElementById('fuelFactorUnit');

    fuelTypeSelect.addEventListener('change', (e) => {
// ... existing code ...
        const selectedFuel = e.target.value;
        const data = fuelData[selectedFuel];
// ... existing code ...

        priceInput.dataset.baseValue = data.price;
// ... existing code ...
        factorInput.dataset.baseValue = data.factor;

        priceInput.value = data.price;
// ... existing code ...
        priceInput.classList.add('default-param');

        priceTooltip.innerHTML = data.priceTooltip;
// ... existing code ...
        factorTooltip.innerHTML = data.factorTooltip;

        calorificUnitSelect.value = 'MJ/kg'; 
// ... existing code ...
        calorificInput.dataset.defaultValue = calorificInput.value;
        calorificInput.classList.add('default-param');

        factorUnitSelect.value = 'kgCO2/t'; 
// ... existing code ...
        factorInput.dataset.defaultValue = factorInput.value;
        factorInput.classList.add('default-param');
    });
}


// --- 公共导出函数 ---

/**
 * 初始化所有UI输入控件的事件监听
 * @param {function} markResultsAsStale - 从 main.js 传入的回调函数，用于标记结果为陈旧
 */
export function initializeInputSetup(markResultsAsStale) {
// ... existing code ...
    setupUnitConverters();
    setupComparisonToggles();
// ... existing code ...
    setupPriceTierControls(markResultsAsStale); 
    setupModeSelector(markResultsAsStale);

    // 设置所有输入的 "track-change" 监听器
// ... existing code ...
    const allInputs = document.querySelectorAll('input[type="number"], input[type="checkbox"], select, input[type="text"]');
    allInputs.forEach(input => {
// ... existing code ...

        input.addEventListener('input', (event) => {
            const currentInput = event.target;
// ... existing code ...

            if (currentInput.classList.contains('default-param') || currentDefaultValue !== undefined) {
// ... existing code ...
            }

            const container = currentInput.closest('.tooltip-container');
// ... existing code ...
            const unitSelect = Array.from(unitSelects).find(sel => sel.id.endsWith('Unit'));

            // 动态更新 data-base-value
// ... existing code ...
            if (unitSelect && unitSelect.id.includes('Unit')) {
                const currentVal = parseFloat(currentInput.value);
// ... existing code ...
                     const originalBaseValue = currentInput.getAttribute('data-base-value');
                     currentInput.dataset.baseValue = originalBaseValue;
// ... existing code ...
                         markResultsAsStale();
                     }
                     return;
                }

                const currentUnit = unitSelect.value;
// ... existing code ...
                if (!converter) return;

                const allConversions = converter.dynamicConversions ? converter.dynamicConversions() : converter.conversions;
// ... existing code ...

                if (currentVal === 0) {
// ... existing code ...
                } else if (conversionFactor && conversionFactor !== 0) {
                    const newBaseValue = currentVal / conversionFactor;
// ... existing code ...
                }
            }
            
            // 触发陈旧标记
// ... existing code ...
                 markResultsAsStale();
            }
        });

        if (input.tagName === 'SELECT' || input.type === 'checkbox') {
// ... existing code ...
                  if (event.target.classList.contains('track-change')) {
                     markResultsAsStale();
// ... existing code ...
             });
        }
    });
}


/**
 * 从DOM中读取所有输入值，并进行验证
 * @param {function} showErrorCallback - (来自 ui-renderer) 用于显示错误的函数
 * @returns {object|null} 包含所有输入的 inputs 对象，如果验证失败则返回 null
 */
export function readAllInputs(showErrorCallback) {
// ... existing code ...
    let totalDist = 0;
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
// ... existing code ...
        const price = parseFloat(tierEl.querySelector('.tier-price').value) || 0;
        const dist = parseFloat(tierEl.querySelector('.tier-dist').value) || 0;
// ... existing code ...
        priceTiers.push({ name, price, dist });
    });

    // 电价验证
// ... existing code ...
    if (Math.abs(totalDist - 100) > 0.1) {
        showErrorCallback(`电价时段总比例必须为 100%，当前为 ${totalDist.toFixed(1)}%！`);
// ... existing code ...
    }
    if (priceTiers.some(t => t.price <= 0 || t.dist <= 0)) {
// ... existing code ...
        return null;
    }
    
    showErrorCallback(null); // 清除错误

    // 读取所有输入值
    const inputs = {
        // 模式
// ... existing code ...
        isHybridMode: document.getElementById('modeHybrid') ? document.getElementById('modeHybrid').checked : false,
        // LCC
        lccYears: parseInt(document.getElementById('lccYears').value) || 15,
        discountRate: (parseFloat(document.getElementById('discountRate').value) || 8) / 100,
        energyInflationRate: (parseFloat(document.getElementById('energyInflationRate').value) || 3) / 100,
        opexInflationRate: (parseFloat(document.getElementById('opexInflationRate').value) || 5) / 100,
        // V11.0: 新增税收和折旧
        taxRate: (parseFloat(document.getElementById('taxRate').value) || 25) / 100,
        depreciationYears: parseInt(document.getElementById('depreciationYears').value) || 10,
        // 电价
        isGreenElectricity: document.getElementById('greenElectricityToggle').checked,
// ... existing code ...
        // 基本信息
        projectName: document.getElementById('projectName').value, 
// ... existing code ...
        operatingHours: parseFloat(document.getElementById('operatingHours').value) || 0,
        // Capex (方案A)
// ... existing code ...
        hpStorageCapex: parseFloat(document.getElementById('storageCapex').value) * 10000 || 0,
        hpSalvageRate: (parseFloat(document.getElementById('hpSalvageRate').value) || 0) / 100,
        // Capex (方案B, 对比)
// ... existing code ...
        gasSalvageRate: (parseFloat(document.getElementById('gasSalvageRate').value) || 0) / 100,
        fuelBoilerCapex: parseFloat(document.getElementById('fuelBoilerCapex').value) * 10000 || 0,
// ... existing code ...
        coalBoilerCapex: parseFloat(document.getElementById('coalBoilerCapex').value) * 10000 || 0,
        coalSalvageRate: (parseFloat(document.getElementById('coalSalvageRate').value) || 0) / 100,
// ... existing code ...
        biomassSalvageRate: (parseFloat(document.getElementById('biomassSalvageRate').value) || 0) / 100,
        electricBoilerCapex: parseFloat(document.getElementById('electricBoilerCapex').value) * 10000 || 0,
// ... existing code ...
        steamCapex: parseFloat(document.getElementById('steamCapex').value) * 10000 || 0,
        steamSalvageRate: (parseFloat(document.getElementById('steamSalvageRate').value) || 0) / 100,
        // 运行参数
// ... existing code ...
        gasBoilerEfficiency: parseFloat(document.getElementById('gasBoilerEfficiency').value) / 100 || 0,
        fuelBoilerEfficiency: parseFloat(document.getElementById('fuelBoilerEfficiency').value) / 100 || 0,
// ... existing code ...
        biomassBoilerEfficiency: parseFloat(document.getElementById('biomassBoilerEfficiency').value) / 100 || 0,
        electricBoilerEfficiency: parseFloat(document.getElementById('electricBoilerEfficiency').value) / 100 || 0,
// ... existing code ...
        // 价格
        gasPrice: parseFloat(document.getElementById('gasPrice').value) || 0,
// ... existing code ...
        coalPrice: parseFloat(document.getElementById('coalPrice').value) || 0,
        biomassPrice: parseFloat(document.getElementById('biomassPrice').value) || 0,
// ... existing code ...
        // 排放因子 (base values)
        gridFactor: (document.getElementById('greenElectricityToggle').checked) ? 0 : (parseFloat(document.getElementById('gridFactor').dataset.baseValue) || 0),
// ... existing code ...
        fuelFactor: parseFloat(document.getElementById('fuelFactor').dataset.baseValue) || 0,
        coalFactor: parseFloat(document.getElementById('coalFactor').dataset.baseValue) || 0,
// ... existing code ...
        steamFactor: parseFloat(document.getElementById('steamFactor').dataset.baseValue) || 0,
        // 热值 (base values)
// ... existing code ...
        fuelCalorific: parseFloat(document.getElementById('fuelCalorific').dataset.baseValue) || 0,
        coalCalorific: parseFloat(document.getElementById('coalCalorific').dataset.baseValue) || 0,
// ... existing code ...
        steamCalorific: parseFloat(document.getElementById('steamCalorific').dataset.baseValue) || 0,
        // 运维成本 (convert 万元 to 元)
// ... existing code ...
        gasOpexCost: (parseFloat(document.getElementById('gasOpexCost').value) || 0) * 10000,
        fuelOpexCost: (parseFloat(document.getElementById('fuelOpexCost').value) || 0) * 10000,
// ... existing code ...
        biomassOpexCost: (parseFloat(document.getElementById('biomassOpexCost').value) || 0) * 10000,
        electricOpexCost: (parseFloat(document.getElementById('electricOpexCost').value) || 0) * 10000,
// ... existing code ...
        // 混合模式 (V9.0)
        hybridLoadShare: (parseFloat(document.getElementById('hybridLoadShare').value) || 0) / 100,
// ... existing code ...
        hybridAuxHeaterCapex: (parseFloat(document.getElementById('hybridAuxHeaterCapex').value) || 0) * 10000,
        hybridAuxHeaterOpex: (parseFloat(document.getElementById('hybridAuxHeaterOpex').value) || 0) * 10000,
        // 对比勾选 (V10.0)
// ... existing code ...
            gas: document.getElementById('compare_gas').checked,
            fuel: document.getElementById('compare_fuel').checked,
// ... existing code ...
            biomass: document.getElementById('compare_biomass').checked,
            electric: document.getElementById('compare_electric').checked,
// ... existing code ...
        }
    };

    if (!inputs.heatingLoad || !inputs.operatingHours || !inputs.hpCop) {
// ... existing code ...
        return null;
    }

    return inputs;
}
