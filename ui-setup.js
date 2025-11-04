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
            if (c.inputId.includes('Factor')) precision = 4;
            
            input.value = (baseValue * conversionFactor).toFixed(precision);
            input.dataset.defaultValue = input.value; // 更新默认值
            input.classList.add('default-param');
        });
    });
    
    // 初始化生物质热值为 3900 kcal/kg
    const biomassCalorificSelect = document.getElementById('biomassCalorificUnit');
    if (biomassCalorificSelect) {
        biomassCalorificSelect.value = 'kcal/kg';
        // 触发一个 change 事件来自动换算
        biomassCalorificSelect.dispatchEvent(new Event('change'));
    }
}

/**
 * 设置 "方案 B (对比基准)" 的勾选框切换逻辑
 */
function setupComparisonToggles() {
    const toggles = document.querySelectorAll('.comparison-toggle');
    
    toggles.forEach(toggle => {
        const targetClass = toggle.dataset.target;

        // --- 修复 BUG 1: "管网蒸汽" 的 ID 不一致 ---
        // 修正： 'steam' 的 ID 是 'steamCapex'，其他是 '...BoilerCapex'
        const capexInputId = (targetClass === 'steam') ? 'steamCapex' : `${targetClass}BoilerCapex`;
        const capexInput = document.getElementById(capexInputId);
        // --- 修复结束 ---

        const relatedFields = document.querySelectorAll(`.${targetClass}-related`);

        // 目标容器是 capexInput 的父 div
        const containerBlock = capexInput ? capexInput.parentElement : null;

        const applyToggleState = (isChecked) => {
            // 1. 切换整个块 (第2节) 的样式
            if (containerBlock) {
                containerBlock.classList.toggle('comparison-disabled', !isChecked);
            }

            // 2. 禁用/启用投资额输入框
            if (capexInput) {
                capexInput.disabled = !isChecked;
            }

            // 3. 切换所有其他相关字段 (第3, 4, 5, 6节) 的状态
            relatedFields.forEach(field => {
                if (field.tagName === 'INPUT' || field.tagName === 'SELECT') {
                    field.disabled = !isChecked;
                }
                
                // 切换 tooltip 容器的样式 (适用于第 3-6 节)
                const parentContainer = field.closest('.tooltip-container');
                if (parentContainer) { 
                    parentContainer.classList.toggle('comparison-disabled', !isChecked);
                }
            });
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
        // 切换 "方案A" 下方的 "混合系统配置"
        hybridConfigInputs.classList.toggle('hidden', !isEnteringHybrid);
        
        if (isEnteringHybrid) {
            hpCopLabel.textContent = '工业热泵性能系数 (COP)';
        } else {
            hpCopLabel.textContent = '全年综合性能系数 (SPF)';
        }
        
        // 切换第3节 (运行参数) 和 第6节 (O&M) 的标题和可见性
        const section3 = hpCopInput.closest('.bg-white');
        const section6 = document.getElementById('hpOpexCost').closest('.bg-white');
        
        const defaultValue = isEnteringHybrid ? "4.0" : "3.0";
        const storedValue = isEnteringHybrid ? spfHybridValue : spfStandardValue;
        
        if (storedValue) {
            hpCopInput.value = storedValue;
        } else {
            hpCopInput.value = defaultValue;
            hpCopInput.dataset.defaultValue = defaultValue;
            hpCopInput.classList.add('default-param');
        }
        
        markResultsAsStale();
    };

    modeStandard.addEventListener('change', () => {
        if (modeStandard.checked) {
            // 离开混合模式时，保存其值
            spfHybridValue = hpCopInput.value;
            applyModeState(false);
        }
    });

    modeHybrid.addEventListener('change', () => {
        if (modeHybrid.checked) {
            // 离开标准模式时，保存其值
            spfStandardValue = hpCopInput.value;
            applyModeState(true);
        }
    });

    // 初始加载时
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
            <label for="${tierId}-name" class="block text-xs font-medium text-gray-600">时段名称 (可选)</label>
            <input type="text" id="${tierId}-name" value="${name}" placeholder="例如: 峰时" class="tier-name w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
            <label for="${tierId}-price" class="block text-xs font-medium text-gray-600">电价 (元/kWh)</label>
            <input type="number" id="${tierId}-price" value="${price}" placeholder="例如: 1.2" class="tier-price w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-3">
            <label for="${tierId}-dist" class="block text-xs font-medium text-gray-600">运行比例 (%)</label>
            <input type="number" id="${tierId}-dist" value="${dist}" placeholder="例如: 40" class="tier-dist w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm track-change storage-mode-field">
        </div>
        <div class="md:col-span-1 flex items-end h-full">
            <button type="button" class="removePriceTierBtn w-full text-sm bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-300 mt-4 md:mt-0">
                删除
            </button>
        </div>
    `;

    container.appendChild(newTier);

    // 自动为输入框添加 stale 标记
    // 自动为输入框添加 stale 标记
    newTier.querySelectorAll('input.track-change').forEach(input => {
        input.dataset.defaultValue = input.value;
        input.addEventListener('input', (event) => {
            const currentInput = event.target;
            const currentDefaultValue = currentInput.dataset.defaultValue;
            if (currentDefaultValue !== undefined) {
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
            container.removeChild(newTier);
            markResultsAsStale(); 
        } else {
            // (V11.1) 移除 alert()
            // alert('至少需要保留一个电价时段。');
        }
    });
}

/**
 * 设置电价时段的 "添加" 按钮
 */
function setupPriceTierControls(markResultsAsStale) {
    document.getElementById('addPriceTierBtn').addEventListener('click', () => {
        addNewPriceTier("", "", "", markResultsAsStale);
        markResultsAsStale(); // 添加新行也标记为陈旧
    });

    // 默认添加一个
    addNewPriceTier("平均电价", "0.7", "100", markResultsAsStale);
    
    // 初始化时，将默认值标记为 "default-param"
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        tierEl.querySelectorAll('input').forEach(input => {
            if (input.value) {
                input.dataset.defaultValue = input.value;
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
            gridFactorInput.dataset.defaultValue = '0'; // V10.0
            gridFactorInput.classList.remove('default-param');
        } else {
            const baseValue = gridFactorInput.getAttribute('data-base-value');
            gridFactorInput.value = baseValue; 
            gridFactorInput.dataset.baseValue = baseValue; 
            gridFactorUnit.value = 'kgCO2/kWh';
            gridFactorInput.dataset.defaultValue = baseValue; // V10.0

            gridFactorInput.disabled = false;
            // 触发一次 change 来应用换算 (如果单位不是 kgCO2/kWh)
            gridFactorUnit.dispatchEvent(new Event('change'));
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
        calorificInput.value = data.calorific;
        factorInput.value = data.factor;
        
        priceInput.dataset.defaultValue = priceInput.value;
        priceInput.classList.add('default-param');

        priceTooltip.innerHTML = data.priceTooltip;
        calorificTooltip.innerHTML = data.calorificTooltip;
        factorTooltip.innerHTML = data.factorTooltip;

        calorificUnitSelect.value = 'MJ/kg'; 
        calorificInput.dataset.defaultValue = calorificInput.value;
        calorificInput.classList.add('default-param');

        factorUnitSelect.value = 'kgCO2/t'; 
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
        const defaultValue = (input.type === 'checkbox') ? input.checked.toString() : input.value;
        input.dataset.defaultValue = defaultValue;
        if (input.type === 'number' && input.value && !input.classList.contains('default-param')) {
             // 对于非默认参数，如果已有值，也标记
             input.classList.toggle('default-param', input.value === defaultValue);
        }

        // --- 修复 BUG 2: "Stale" 标记逻辑 ---
        input.addEventListener('input', (event) => {
            const currentInput = event.target;
            const currentDefaultValue = currentInput.dataset.defaultValue;

            // 1. 切换 default-param 样式
            if (currentInput.classList.contains('default-param') || currentDefaultValue !== undefined) {
                 currentInput.classList.toggle('default-param', currentInput.value === currentDefaultValue);
            }

            // 2. 仅在需要时执行单位换算逻辑
            const container = currentInput.closest('.tooltip-container');
            if (container) { 
                const unitSelects = container.querySelectorAll('select');
                const unitSelect = Array.from(unitSelects).find(sel => sel.id.endsWith('Unit'));

                // 动态更新 data-base-value
                if (unitSelect && unitSelect.id.includes('Unit')) {
                    const currentVal = parseFloat(currentInput.value);
                    if (isNaN(currentVal)) {
                         const originalBaseValue = currentInput.getAttribute('data-base-value');
                         currentInput.dataset.baseValue = originalBaseValue;
                         // (Stale 标记在下面统一处理)
                         
                    } else {
                        const currentUnit = unitSelect.value;
                        const converter = converters.find(c => c.selectId === unitSelect.id);
                        
                        if (converter) { // 增加健壮性检查
                            const allConversions = converter.dynamicConversions ? converter.dynamicConversions() : converter.conversions;
                            const conversionFactor = allConversions[currentUnit];

                            if (currentVal === 0) {
                                currentInput.dataset.baseValue = 0;
                            } else if (conversionFactor && conversionFactor !== 0) {
                                const newBaseValue = currentVal / conversionFactor;
                                currentInput.dataset.baseValue = newBaseValue.toFixed(6);
                            }
                        }
                    }
                }
            }
            
            // 3. 触发陈旧标记 (移出 container 检查)
            if (currentInput.classList.contains('track-change')) {
                 markResultsAsStale();
            }
        });
        // --- 修复结束 ---


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
 * 从DOM中读取所有输入值 (V11.5: 不再验证)
 * @returns {object} 包含所有输入的 inputs 对象
 */
export function readAllInputs() { // V11.5: 移除了 showErrorCallback
    let totalDist = 0;
    const priceTiers = []; // V6.3
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        const name = tierEl.querySelector('.tier-name').value || '时段';
        const price = parseFloat(tierEl.querySelector('.tier-price').value) || 0;
        const dist = parseFloat(tierEl.querySelector('.tier-dist').value) || 0;
        totalDist += dist;
        priceTiers.push({ name, price, dist });
    });

    // --- V11.5: 移除所有电价验证 ---
    // (已移动到 main.js)

    // 读取所有输入值
    const inputs = {
        // 模式
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
        priceTiers: priceTiers, // V6.3
        totalPriceTierDistribution: totalDist, // V11.5: 新增，传递给 main.js 验证
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
        // (维持 'steamCapex' ID 不变, 以匹配 HTML)
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
        biomassFactor: parseFloat(document.getElementById('biomassFactor').dataset.baseValue) || 0,
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
            steam: document.getElementById('compare_steam').checked
        }
    };

    // V11.4: 移除此处的通用验证，它被移到了 main.js

    return inputs;
}