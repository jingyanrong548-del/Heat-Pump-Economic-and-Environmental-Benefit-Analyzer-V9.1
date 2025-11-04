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
    converters.forEach(c => {
        const select = document.getElementById(c.selectId);
        const input = document.getElementById(c.inputId);
        if (!select || !input) return;

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
                 return;
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
    if(biomassCalorificSelect) { 
        biomassCalorificSelect.value = 'kcal/kg';
        biomassCalorificSelect.dispatchEvent(new Event('change'));
    }
}

/**
 * 设置 "方案 B (对比基准)" 的勾选框切换逻辑
 */
function setupComparisonToggles() {
    const toggles = document.querySelectorAll('.comparison-toggle');
    
    toggles.forEach(toggle => {
        const target = toggle.dataset.target;
        
        const capexInput = document.getElementById(target === 'steam' ? 'steamCapex' : `${target}BoilerCapex`);
        const salvageInput = document.getElementById(`${target}SalvageRate`);
        const salvageLabel = document.querySelector(`label[for="${target}SalvageRate"]`);
        const parentGridDiv = toggle.closest('.input-group > div'); 

        const otherRelatedFields = document.querySelectorAll(`.${target}-related`);
        const relatedOpexField = document.querySelector(`.${target}-opex-related`);

        const applyToggleState = (isChecked) => {
            if (capexInput) capexInput.disabled = !isChecked;
            if (salvageInput) salvageInput.disabled = !isChecked;
            if (salvageLabel) salvageLabel.classList.toggle('hidden', !isChecked);
            if (parentGridDiv) parentGridDiv.classList.toggle('comparison-disabled', !isChecked);
            
            otherRelatedFields.forEach(el => {
                if (el !== salvageLabel && el !== salvageInput) {
                    el.classList.toggle('hidden', !isChecked);
                }
            });
            
            if (relatedOpexField) {
                relatedOpexField.classList.toggle('hidden', !isChecked);
            }
        };

        toggle.addEventListener('change', () => {
            applyToggleState(toggle.checked);
        });

        applyToggleState(toggle.checked);
    });
}

/**
 * V10.0: 设置模式一 (标准) / 模式二 (混合) 的切换逻辑
 * 并独立记忆两种模式下的SPF值
 */
function setupModeSelector(markResultsAsStale) {
    const modeStandard = document.getElementById('modeStandard');
    const modeHybrid = document.getElementById('modeHybrid');
    const hybridConfigInputs = document.getElementById('hybridConfigInputs'); 
    const hpCopLabel = document.getElementById('hpCopLabel');
    const hpCopInput = document.getElementById('hpCop'); 

    if (!modeStandard || !modeHybrid || !hybridConfigInputs || !hpCopLabel || !hpCopInput) {
        console.warn('V10.0 (模式选择) UI 元素未在 HTML 中完全找到。');
        return;
    }

    const applyModeState = (isEnteringHybrid) => {
        hybridConfigInputs.classList.toggle('hidden', !isEnteringHybrid);
        
        if (isEnteringHybrid) {
            hpCopLabel.textContent = '工业热泵在此工况下的 SPF';
            hpCopInput.value = spfHybridValue; 
        } else {
            hpCopLabel.textContent = '全年综合性能系数 (SPF)';
            hpCopInput.value = spfStandardValue; 
        }
        
        const defaultValue = isEnteringHybrid ? "4.0" : "3.0";
        hpCopInput.classList.toggle('default-param', hpCopInput.value === defaultValue);
        
        markResultsAsStale();
    };

    modeStandard.addEventListener('change', () => {
        if (modeStandard.checked) {
            spfHybridValue = hpCopInput.value;
            applyModeState(false);
        }
    });

    modeHybrid.addEventListener('change', () => {
        if (modeHybrid.checked) {
            spfStandardValue = hpCopInput.value;
            applyModeState(true);
        }
    });

    hpCopInput.value = spfStandardValue; 
    applyModeState(modeHybrid.checked); 
}


/**
 * 添加一个新的电价时段UI
 */
function addNewPriceTier(name = "", price = "", dist = "", markResultsAsStale) {
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
        if (document.querySelectorAll('.price-tier-entry').length > 1) {
            newTier.remove();
            markResultsAsStale(); 
        } else {
            alert('必须至少保留一个电价时段。');
        }
    });
}

/**
 * 设置电价时段的 "添加" 按钮
 */
function setupPriceTierControls(markResultsAsStale) {
    document.getElementById('addPriceTierBtn').addEventListener('click', () => {
        addNewPriceTier("", "", "", markResultsAsStale);
        markResultsAsStale();
    });

    addNewPriceTier("平均电价", "0.7", "100", markResultsAsStale);
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        tierEl.querySelectorAll('input').forEach(input => {
            if (input.value) {
                input.classList.add('default-param');
            }
        });
    });
}

/**
 * 设置 "使用绿电" 勾选框逻辑
 */
function setupGreenElectricityToggle() {
    const toggle = document.getElementById('greenElectricityToggle');
    const gridFactorInput = document.getElementById('gridFactor');
    const gridFactorUnit = document.getElementById('gridFactorUnit');

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            gridFactorInput.value = '0';
            gridFactorInput.dataset.baseValue = '0'; 
            gridFactorInput.disabled = true;
            gridFactorUnit.disabled = true;
            gridFactorInput.classList.remove('default-param');
        } else {
            const baseValue = gridFactorInput.getAttribute('data-base-value');
            gridFactorInput.value = baseValue;
            gridFactorInput.dataset.baseValue = baseValue; 
            gridFactorUnit.value = 'kgCO2/kWh';
            gridFactorUnit.dispatchEvent(new Event('change'));

            gridFactorInput.disabled = false;
            gridFactorUnit.disabled = false;
            gridFactorInput.classList.add('default-param');
        }
    });
}

/**
 * 设置 "燃油种类" 下拉框逻辑
 */
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

        priceInput.dataset.baseValue = data.price;
        calorificInput.dataset.baseValue = data.calorific;
        factorInput.dataset.baseValue = data.factor;

        priceInput.value = data.price;
        priceInput.dataset.defaultValue = data.price;
        priceInput.classList.add('default-param');

        priceTooltip.innerHTML = data.priceTooltip;
        calorificTooltip.innerHTML = data.calorificTooltip;
        factorTooltip.innerHTML = data.factorTooltip;

        calorificUnitSelect.value = 'MJ/kg'; 
        calorificUnitSelect.dispatchEvent(new Event('change'));
        calorificInput.dataset.defaultValue = calorificInput.value;
        calorificInput.classList.add('default-param');

        factorUnitSelect.value = 'kgCO2/t'; 
        factorUnitSelect.dispatchEvent(new Event('change'));
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
    setupUnitConverters();
    setupComparisonToggles();
    setupGreenElectricityToggle();
    setupFuelTypeSelector();
    setupPriceTierControls(markResultsAsStale); 
    setupModeSelector(markResultsAsStale);

    // 设置所有输入的 "track-change" 监听器
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

            // 动态更新 data-base-value
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
                }
            }
            
            // 触发陈旧标记
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
}


/**
 * 从DOM中读取所有输入值，并进行验证
 * @param {function} showErrorCallback - (来自 ui-renderer) 用于显示错误的函数
 * @returns {object|null} 包含所有输入的 inputs 对象，如果验证失败则返回 null
 */
export function readAllInputs(showErrorCallback) {
    const priceTiers = [];
    let totalDist = 0;
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        const name = tierEl.querySelector('.tier-name').value.trim() || '时段';
        const price = parseFloat(tierEl.querySelector('.tier-price').value) || 0;
        const dist = parseFloat(tierEl.querySelector('.tier-dist').value) || 0;
        totalDist += dist;
        priceTiers.push({ name, price, dist });
    });

    // 电价验证
    if (Math.abs(totalDist - 100) > 0.1) {
        showErrorCallback(`电价时段总比例必须为 100%，当前为 ${totalDist.toFixed(1)}%！`);
        return null;
    }
    if (priceTiers.some(t => t.price <= 0 || t.dist <= 0)) {
        showErrorCallback('电价或运行比例必须大于 0！');
        return null;
    }
    
    showErrorCallback(null); // 清除错误

    // 读取所有输入值
    const inputs = {
        // 模式
        isHybridMode: document.getElementById('modeHybrid') ? document.getElementById('modeHybrid').checked : false,
        // LCC
        lccYears: parseInt(document.getElementById('lccYears').value) || 15,
        discountRate: (parseFloat(document.getElementById('discountRate').value) || 8) / 100,
        energyInflationRate: (parseFloat(document.getElementById('energyInflationRate').value) || 3) / 100,
        opexInflationRate: (parseFloat(document.getElementById('opexInflationRate').value) || 5) / 100,
        // 电价
        isGreenElectricity: document.getElementById('greenElectricityToggle').checked,
        priceTiers: priceTiers,
        // 基本信息
        projectName: document.getElementById('projectName').value, 
        heatingLoad: parseFloat(document.getElementById('heatingLoad').value) || 0,
        operatingHours: parseFloat(document.getElementById('operatingHours').value) || 0,
        // Capex (方案A)
        hpHostCapex: parseFloat(document.getElementById('hpCapex').value) * 10000 || 0,
        hpStorageCapex: parseFloat(document.getElementById('storageCapex').value) * 10000 || 0,
        hpSalvageRate: (parseFloat(document.getElementById('hpSalvageRate').value) || 0) / 100,
        // Capex (方案B, 对比)
        gasBoilerCapex: parseFloat(document.getElementById('gasBoilerCapex').value) * 10000 || 0,
        gasSalvageRate: (parseFloat(document.getElementById('gasSalvageRate').value) || 0) / 100,
        fuelBoilerCapex: parseFloat(document.getElementById('fuelBoilerCapex').value) * 10000 || 0,
        fuelSalvageRate: (parseFloat(document.getElementById('fuelSalvageRate').value) || 0) / 100,
        coalBoilerCapex: parseFloat(document.getElementById('coalBoilerCapex').value) * 10000 || 0,
        coalSalvageRate: (parseFloat(document.getElementById('coalSalvageRate').value) || 0) / 100,
        biomassBoilerCapex: parseFloat(document.getElementById('biomassBoilerCapex').value) * 10000 || 0,
        biomassSalvageRate: (parseFloat(document.getElementById('biomassSalvageRate').value) || 0) / 100,
        electricBoilerCapex: parseFloat(document.getElementById('electricBoilerCapex').value) * 10000 || 0,
        electricSalvageRate: (parseFloat(document.getElementById('electricSalvageRate').value) || 0) / 100,
        steamCapex: parseFloat(document.getElementById('steamCapex').value) * 10000 || 0,
        steamSalvageRate: (parseFloat(document.getElementById('steamSalvageRate').value) || 0) / 100,
        // 运行参数
        hpCop: parseFloat(document.getElementById('hpCop').value) || 0,
        gasBoilerEfficiency: parseFloat(document.getElementById('gasBoilerEfficiency').value) / 100 || 0,
        fuelBoilerEfficiency: parseFloat(document.getElementById('fuelBoilerEfficiency').value) / 100 || 0,
        coalBoilerEfficiency: parseFloat(document.getElementById('coalBoilerEfficiency').value) / 100 || 0,
        biomassBoilerEfficiency: parseFloat(document.getElementById('biomassBoilerEfficiency').value) / 100 || 0,
        electricBoilerEfficiency: parseFloat(document.getElementById('electricBoilerEfficiency').value) / 100 || 0,
        steamEfficiency: parseFloat(document.getElementById('steamEfficiency').value) / 100 || 0,
        // 价格
        gasPrice: parseFloat(document.getElementById('gasPrice').value) || 0,
        fuelPrice: parseFloat(document.getElementById('fuelPrice').value) || 0,
        coalPrice: parseFloat(document.getElementById('coalPrice').value) || 0,
        biomassPrice: parseFloat(document.getElementById('biomassPrice').value) || 0,
        steamPrice: parseFloat(document.getElementById('steamPrice').value) || 0,
        // 排放因子 (base values)
        gridFactor: (document.getElementById('greenElectricityToggle').checked) ? 0 : (parseFloat(document.getElementById('gridFactor').dataset.baseValue) || 0),
        gasFactor: parseFloat(document.getElementById('gasFactor').dataset.baseValue) || 0,
        fuelFactor: parseFloat(document.getElementById('fuelFactor').dataset.baseValue) || 0,
        coalFactor: parseFloat(document.getElementById('coalFactor').dataset.baseValue) || 0,
        biomassFactor: parseFloat(document.getElementById('biomassFactor').dataset.baseValue), 
        steamFactor: parseFloat(document.getElementById('steamFactor').dataset.baseValue) || 0,
        // 热值 (base values)
        gasCalorific: parseFloat(document.getElementById('gasCalorific').dataset.baseValue) || 0,
        fuelCalorific: parseFloat(document.getElementById('fuelCalorific').dataset.baseValue) || 0,
        coalCalorific: parseFloat(document.getElementById('coalCalorific').dataset.baseValue) || 0,
        biomassCalorific: parseFloat(document.getElementById('biomassCalorific').dataset.baseValue) || 0,
        steamCalorific: parseFloat(document.getElementById('steamCalorific').dataset.baseValue) || 0,
        // 运维成本 (convert 万元 to 元)
        hpOpexCost: (parseFloat(document.getElementById('hpOpexCost').value) || 0) * 10000,
        gasOpexCost: (parseFloat(document.getElementById('gasOpexCost').value) || 0) * 10000,
        fuelOpexCost: (parseFloat(document.getElementById('fuelOpexCost').value) || 0) * 10000,
        coalOpexCost: (parseFloat(document.getElementById('coalOpexCost').value) || 0) * 10000,
        biomassOpexCost: (parseFloat(document.getElementById('biomassOpexCost').value) || 0) * 10000,
        electricOpexCost: (parseFloat(document.getElementById('electricOpexCost').value) || 0) * 10000,
        steamOpexCost: (parseFloat(document.getElementById('steamOpexCost').value) || 0) * 10000,
        // 混合模式 (V9.0)
        hybridLoadShare: (parseFloat(document.getElementById('hybridLoadShare').value) || 0) / 100,
        hybridAuxHeaterType: document.getElementById('hybridAuxHeaterType').value,
        hybridAuxHeaterCapex: (parseFloat(document.getElementById('hybridAuxHeaterCapex').value) || 0) * 10000,
        hybridAuxHeaterOpex: (parseFloat(document.getElementById('hybridAuxHeaterOpex').value) || 0) * 10000,
        // 对比勾选 (V10.0)
        compare: {
            gas: document.getElementById('compare_gas').checked,
            fuel: document.getElementById('compare_fuel').checked,
            coal: document.getElementById('compare_coal').checked,
            biomass: document.getElementById('compare_biomass').checked,
            electric: document.getElementById('compare_electric').checked,
            steam: document.getElementById('compare_steam').checked,
        }
    };

    if (!inputs.heatingLoad || !inputs.operatingHours || !inputs.hpCop) {
        alert('请填写有效的制热负荷、年运行小时和工业热泵SPF。');
        return null;
    }

    return inputs;
}