// ui-setup.js
import { fuelData, converters, MJ_PER_KCAL } from './config.js';

// --- 模块内部状态 ---
let spfStandardValue = "3.0"; // 模式一 (标准) 的SPF默认值
let spfHybridValue = "4.0";   // 模式二 (混合) 的SPF默认值
let spfBotValue = "3.5";      // 模式三 (BOT) 的SPF默认值
let currentMode = 'standard'; // V11.0: 跟踪当前模式

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
            // **** 修改 (需求 4): 确保 data-base-value 存在，如果不存在则从 value 初始化 ****
            if (input.dataset.baseValue === undefined) {
                input.dataset.baseValue = input.value;
            }
            // **** 修复结束 ****
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
            if (targetUnit.includes('kcal/m3')) precision = 0;
            if (targetUnit.includes('kcal/h')) precision = 0;

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
 * V11.0: 重写模式选择器，以支持三种模式 (标准, 混合, BOT)
 * 并独立记忆三种模式下的SPF值
 * V11.1: 增加 showGlobalNotification 参数，并禁用模式三
 */
// **** 修改 1 (函数签名) ****
function setupModeSelector(markResultsAsStale, showGlobalNotification) {
    const modeStandard = document.getElementById('modeStandard');
    const modeHybrid = document.getElementById('modeHybrid');
    const modeBot = document.getElementById('modeBot'); // V11.0 新增
    
    // 要切换的 UI 容器
    const hybridConfigInputs = document.getElementById('hybridConfigInputs'); 
    const botConfigInputs = document.getElementById('botConfigInputs'); // V11.0 新增
    const comparisonTogglesContainer = document.getElementById('comparisonTogglesContainer'); // 方案B
    const standardModeSections = document.getElementById('standardModeSections'); // 包含 3, 4, 5, 6
    const lccParamsContainer = document.getElementById('lccParamsContainer'); // 包含 7
    
    const hpCopLabel = document.getElementById('hpCopLabel');
    const hpCopInput = document.getElementById('hpCop'); 
    
    // V11.0: 获取动态标题
    const section2Title = document.getElementById('section2Title');
    const section7Title = document.getElementById('section7Title');

    // **** 代码修改开始 (需求 3) ****
    // 获取第1节中特定于模式的输入框
    const calcModeAContainer = document.getElementById('calcModeAContainer');
    const calcModeBContainer = document.getElementById('calcModeBContainer');
    const calcModeCContainer = document.getElementById('calcModeCContainer');
    const calcModeRadios = document.querySelectorAll('input[name="calcMode"]');
    // **** 代码修改结束 ****


    if (!modeStandard || !modeHybrid || !modeBot || !hybridConfigInputs || !botConfigInputs || !comparisonTogglesContainer || !standardModeSections || !lccParamsContainer) {
        console.error('V11.0 (模式选择) UI 元素未在 HTML 中完全找到。');
        return;
    }

    const applyModeState = (newMode) => {
        const currentValue = hpCopInput.value;
        
        // 1. 保存离开模式的SPF值
        if (currentMode === 'standard') {
            spfStandardValue = currentValue;
        } else if (currentMode === 'hybrid') {
            spfHybridValue = currentValue;
        } else if (currentMode === 'bot') {
            spfBotValue = currentValue;
        }

        // 2. 根据新模式更新UI
        if (newMode === 'standard' || newMode === 'hybrid') {
            // --- 成本对比模式 (V10.0 逻辑) ---
            hybridConfigInputs.classList.toggle('hidden', newMode === 'standard');
            botConfigInputs.classList.add('hidden');
            comparisonTogglesContainer.classList.remove('hidden');
            standardModeSections.classList.remove('hidden');
            lccParamsContainer.classList.remove('hidden'); // 确保财务参数可见
            
            // **** 代码修改开始 (需求 3) ****
            // 显示第1节中的热量计算输入
            calcModeRadios.forEach(radio => radio.disabled = false);
            // 触发一次热量计算模式的 change 事件，以恢复正确的 A/B/C 显隐状态
            document.querySelector('input[name="calcMode"]:checked').dispatchEvent(new Event('change'));
            // **** 代码修改结束 ****

            if (newMode === 'standard') {
                hpCopLabel.textContent = '全年综合性能系数 (SPF)';
                hpCopInput.value = spfStandardValue;
            } else {
                hpCopLabel.textContent = '工业热泵在此工况下的 SPF';
                hpCopInput.value = spfHybridValue;
            }
            
            // 还原标题
            section2Title.textContent = "2. 方案配置";
            section7Title.textContent = "7. 财务分析参数";
            
        } else if (newMode === 'bot') {
            // --- 投资盈利模式 (V11.0 逻辑) ---
            hybridConfigInputs.classList.add('hidden');
            botConfigInputs.classList.remove('hidden');
            comparisonTogglesContainer.classList.add('hidden'); // BOT模式不进行成本对比
            standardModeSections.classList.add('hidden'); // BOT模式不关心锅炉参数
            lccParamsContainer.classList.remove('hidden'); // 确保财务参数可见

            // **** 代码修改开始 (需求 3) ****
            // 隐藏第1节中的热量计算输入
            if (calcModeAContainer) calcModeAContainer.classList.add('hidden');
            if (calcModeBContainer) calcModeBContainer.classList.add('hidden');
            if (calcModeCContainer) calcModeCContainer.classList.add('hidden');
            calcModeRadios.forEach(radio => radio.disabled = true);
            // **** 代码修改结束 ****

            hpCopLabel.textContent = 'BOT 项目 SPF (用于计算电费成本)';
            hpCopInput.value = spfBotValue;
            
            // 修改标题
            section2Title.textContent = "2. 方案与投资配置";
            section7Title.textContent = "7. BOT 财务分析参数";
        }
        
        // 3. 更新当前模式状态
        currentMode = newMode;
        
        // 4. 检查默认值样式
        const defaultValue = (newMode === 'standard') ? "3.0" : (newMode === 'hybrid' ? "4.0" : "3.5");
        hpCopInput.classList.toggle('default-param', hpCopInput.value === defaultValue);
        
        markResultsAsStale();
    };

    // 绑定监听器
    modeStandard.addEventListener('change', () => {
        if (modeStandard.checked) applyModeState('standard');
    });

    modeHybrid.addEventListener('change', () => {
        if (modeHybrid.checked) applyModeState('hybrid');
    });
    
    // **** 修改 2 (禁用模式三) ****
    modeBot.addEventListener('change', () => {
        if (modeBot.checked) {
            // 1. 显示通知
            if (showGlobalNotification) {
                showGlobalNotification('模式三 (BOT 模式) 正在升级中，暂不开放。', 'info', 4000);
            }

            // 2. 阻止切换，将 radio 按钮重置回上一个模式
            // (currentMode 变量中存储的是切换 *前* 的模式)
            if (currentMode === 'standard') {
                modeStandard.checked = true;
            } else if (currentMode === 'hybrid') {
                modeHybrid.checked = true;
            } else {
                 // 备用，默认退回模式一
                modeStandard.checked = true;
            }
            // 注意：我们*不*调用 applyModeState('bot')
        }
    });

    // 初始化
    hpCopInput.value = spfStandardValue; 
    applyModeState('standard'); // 默认以标准模式启动
}


/**
 * **** 新增 (需求 3): 设置年加热量计算模式的UI切换 ****
 */
function setupCalculationModeToggle(markResultsAsStale) {
    const calcModeRadios = document.querySelectorAll('input[name="calcMode"]');
    const modeAContainer = document.getElementById('calcModeAContainer');
    const modeBContainer = document.getElementById('calcModeBContainer');
    const modeCContainer = document.getElementById('calcModeCContainer');
    
    // 模式C 比较特殊, 它需要模式A中的 "heatingLoad" 但不需要 "operatingHours"
    const operatingHoursContainer = document.getElementById('operatingHours')?.closest('.input-group > div');

    if (!modeAContainer || !modeBContainer || !modeCContainer || !operatingHoursContainer || calcModeRadios.length === 0) {
        console.error("年加热量计算模式的 UI 元素未完全找到。");
        return;
    }

    const applyCalcMode = () => {
        const selectedMode = document.querySelector('input[name="calcMode"]:checked').value;
        
        if (selectedMode === 'annual') {
            // 模式A: 显示 A, 隐藏 B, C
            modeAContainer.classList.remove('hidden');
            modeBContainer.classList.add('hidden');
            modeCContainer.classList.add('hidden');
            // 确保 A 中的 operatingHours 是可见的
            operatingHoursContainer.classList.remove('hidden');
        } else if (selectedMode === 'total') {
            // 模式B: 显示 B, 隐藏 A, C
            modeAContainer.classList.add('hidden');
            modeBContainer.classList.remove('hidden');
            modeCContainer.classList.add('hidden');
        } else if (selectedMode === 'daily') {
            // 模式C: 显示 A (为了 heatingLoad), 显示 C, 隐藏 B
            modeAContainer.classList.remove('hidden');
            modeBContainer.classList.add('hidden');
            modeCContainer.classList.remove('hidden');
            // 关键: 隐藏 A 中的 operatingHours
            operatingHoursContainer.classList.add('hidden');
        }
        markResultsAsStale();
    };

    calcModeRadios.forEach(radio => {
        radio.addEventListener('change', applyCalcMode);
    });

    // 初始化
    applyCalcMode();
}


/**
 * 添加一个新的电价时段UI
 * V11.0: 替换了 'alert' 为 'showGlobalNotification'
 */
function addNewPriceTier(name = "", price = "", dist = "", markResultsAsStale, showGlobalNotification) {
    const container = document.getElementById('priceTiersContainer');
    // V11.0: 修复BUG，确保 container 存在
    if (!container) {
        console.error("priceTiersContainer 未找到!");
        return;
    }
    
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
            // V11.0: 替换 alert
            if(showGlobalNotification) {
                showGlobalNotification('必须至少保留一个电价时段。', 'error');
            } else {
                alert('必须至少保留一个电价时段。'); // Fallback
            }
        }
    });
}

/**
 * 设置电价时段的 "添加" 按钮
 * V11.0: 签名更新
 */
function setupPriceTierControls(markResultsAsStale, showGlobalNotification) {
    const addBtn = document.getElementById('addPriceTierBtn');
    if (!addBtn) return; // 容错
    
    addBtn.addEventListener('click', () => {
        addNewPriceTier("", "", "", markResultsAsStale, showGlobalNotification);
        markResultsAsStale();
    });

    // 启动时至少添加一个默认时段
    addNewPriceTier("平均电价", "0.7", "100", markResultsAsStale, showGlobalNotification);
    
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

    if (!toggle || !gridFactorInput || !gridFactorUnit) return; // 容错

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            gridFactorInput.value = '0';
            gridFactorInput.dataset.baseValue = '0'; 
            gridFactorInput.disabled = true;
            gridFactorUnit.disabled = true;
            gridFactorInput.classList.remove('default-param');
        } else {
            // V11.0: 修复BUG，应从 attribute 读取原始 base value
            const baseValue = gridFactorInput.getAttribute('data-base-value') || "0.57";
            gridFactorInput.dataset.baseValue = baseValue; // 更新动态 base value
            
            gridFactorUnit.value = 'kgCO2/kWh'; // 触发 change 前重置为基础单位
            gridFactorUnit.dispatchEvent(new Event('change')); // 触发换算
            // 换算后，input.value 会被更新，我们把它设为默认值
            
            gridFactorInput.disabled = false;
            gridFactorUnit.disabled = false;
            gridFactorInput.classList.add('default-param');
            // V11.0: 确保 data-default-value 也被更新
            gridFactorInput.dataset.defaultValue = gridFactorInput.value;
        }
    });
}

/**
 * 设置 "燃油种类" 下拉框逻辑
 */
function setupFuelTypeSelector() {
    const fuelTypeSelect = document.getElementById('fuelType');
    if (!fuelTypeSelect) return; // 容错

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

        // 1. 更新 base value (用于计算)
        priceInput.dataset.baseValue = data.price;
        calorificInput.dataset.baseValue = data.calorific;
        factorInput.dataset.baseValue = data.factor;

        // 2. 更新 input value (用于显示)
        priceInput.value = data.price;
        priceInput.dataset.defaultValue = data.price; // 更新默认值
        priceInput.classList.add('default-param');

        // 3. 更新 tooltip
        if (priceTooltip) priceTooltip.innerHTML = data.priceTooltip;
        if (calorificTooltip) calorificTooltip.innerHTML = data.calorificTooltip;
        if (factorTooltip) factorTooltip.innerHTML = data.factorTooltip;

        // 4. 更新热值 (并触发单位换算)
        calorificUnitSelect.value = 'MJ/kg'; 
        calorificUnitSelect.dispatchEvent(new Event('change'));
        calorificInput.dataset.defaultValue = calorificInput.value; // 更新默认值
        calorificInput.classList.add('default-param');

        // 5. 更新排放因子 (并触发单位换算)
        factorUnitSelect.value = 'kgCO2/t'; 
        factorUnitSelect.dispatchEvent(new Event('change'));
        factorInput.dataset.defaultValue = factorInput.value; // 更新默认值
        factorInput.classList.add('default-param');
    });
}


// --- 公共导出函数 ---

/**
 * 初始化所有UI输入控件的事件监听
 * @param {function} markResultsAsStale - 从 main.js 传入的回调函数，用于标记结果为陈旧
 * @param {function} showGlobalNotification - V11.0: 从 main.js 传入的回调函数，用于显示全局通知
 */
export function initializeInputSetup(markResultsAsStale, showGlobalNotification) {
    setupUnitConverters();
    setupComparisonToggles();
    setupGreenElectricityToggle();
    setupFuelTypeSelector();
    // V11.0: 传入 showGlobalNotification 以替换 price tier 内部的 alert
    setupPriceTierControls(markResultsAsStale, showGlobalNotification); 
    
    // **** 修改 (传递通知句柄) ****
    setupModeSelector(markResultsAsStale, showGlobalNotification);
    
    // **** 新增 (需求 3): 初始化热量计算模式的 UI 切换 ****
    setupCalculationModeToggle(markResultsAsStale);
    // **** 修复结束 ****


    // 设置所有输入的 "track-change" 监听器
    const allInputs = document.querySelectorAll('input[type="number"], input[type="checkbox"], select, input[type="text"], input[type="radio"]');
    allInputs.forEach(input => {
        // V11.0: 对 radio button 使用 'value'，对 checkbox 使用 'checked'，其他使用 'value'
        let defaultValue;
        if (input.type === 'checkbox') {
            defaultValue = input.checked;
        } else {
            defaultValue = input.value;
        }
        
        // **** 修改 (需求 4): 对带单位换算的输入框，初始化 data-base-value ****
        if (input.id === 'heatingLoad' || input.id === 'annualHeating' || input.id.endsWith('Calorific') || input.id.endsWith('Factor')) {
             if (input.dataset.baseValue === undefined) {
                // 如果 HTML 没有设置 data-base-value (例如 heatingLoad)，则从 value 初始化
                input.dataset.baseValue = input.value;
             }
        }
        // **** 修复结束 ****

        // 存储初始的默认值
        input.dataset.defaultValue = defaultValue;


        const inputChangeCallback = (event) => {
            const currentInput = event.target;
            
            let currentDefaultValue = currentInput.dataset.defaultValue;
            let currentValue = currentInput.value;
            
            if (currentInput.type === 'checkbox') {
                currentValue = currentInput.checked;
                // 'true' / 'false' 字符串比较
                currentDefaultValue = currentDefaultValue === 'true'; 
            }

            // 切换 .default-param 样式
            if (currentInput.classList.contains('default-param') || currentDefaultValue !== undefined) {
                currentInput.classList.toggle('default-param', currentValue === currentDefaultValue);
            }

            // --- V10.0: 动态更新 data-base-value (用于单位换算) ---
            // **** 修改 (需求 4): 查找同级的 select (HTML 结构已改变) ****
            // const container = currentInput.closest('.tooltip-container'); // <-- 旧逻辑
            const container = currentInput.parentElement; // <-- 新逻辑
            // **** 修复结束 ****
            const unitSelects = container ? container.querySelectorAll('select') : [];
            // **** 修改 (需求 4): 修正 selectId 的匹配逻辑 (e.g., heatingLoad -> heatingLoadUnit) ****
            // const unitSelect = Array.from(unitSelects).find(sel => sel.id.endsWith('Unit')); // <-- 旧逻辑
            const unitSelect = document.getElementById(currentInput.id + 'Unit'); // <-- 新逻辑
            // **** 修复结束 ****

            if (unitSelect && unitSelect.id.includes('Unit')) {
                const currentVal = parseFloat(currentInput.value);
                if (isNaN(currentVal)) {
                     // 如果输入无效 (e.g., "abc")，不要破坏 data-base-value
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
        };

        // 'input' 用于文本和数字框, 'change' 用于 select, checkbox, radio
        if (input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'radio') {
             input.addEventListener('change', inputChangeCallback);
        } else {
             input.addEventListener('input', inputChangeCallback);
        }
    });
}


/**
 * 从DOM中读取所有输入值，并进行验证
 * @param {function} showErrorCallback - (来自 ui-renderer) 用于显示电价错误的函数
 * @param {function} alertNotifier - V11.0: (来自 ui-renderer) 用于显示全局错误的函数
 * @returns {object|null} 包含所有输入的 inputs 对象，如果验证失败则返回 null
 */
export function readAllInputs(showErrorCallback, alertNotifier) {
    const priceTiers = [];
    let totalDist = 0;
    
    document.querySelectorAll('.price-tier-entry').forEach(tierEl => {
        const name = tierEl.querySelector('.tier-name').value.trim() || '时段';
        const price = parseFloat(tierEl.querySelector('.tier-price').value) || 0;
        const dist = parseFloat(tierEl.querySelector('.tier-dist').value) || 0;
        totalDist += dist;
        priceTiers.push({ name, price, dist });
    });

    // V11.0: 获取当前选择的模式
    const analysisMode = document.querySelector('input[name="schemeAMode"]:checked').value || 'standard';

    // V11.0: 仅在非 BOT 模式下验证电价比例
    if (analysisMode !== 'bot') {
        if (Math.abs(totalDist - 100) > 0.1) {
            showErrorCallback(`电价时段总比例必须为 100%，当前为 ${totalDist.toFixed(1)}%！`);
            return null;
        }
        if (priceTiers.some(t => t.price <= 0 || t.dist <= 0)) {
            showErrorCallback('电价或运行比例必须大于 0！');
            return null;
        }
    }
    
    showErrorCallback(null); // 清除错误

    // **** 修改 (需求 3, 4): 读取热量计算模式及新输入 ****
    const calcMode = document.querySelector('input[name="calcMode"]:checked')?.value || 'annual';
    
    // (需求 4) 关键: 必须从 data-base-value 读取带单位换算的值 (kW)
    const heatingLoad = parseFloat(document.getElementById('heatingLoad').dataset.baseValue) || 0;
    const operatingHours = parseFloat(document.getElementById('operatingHours').value) || 0;
    
    // (需求 4) 关键: 必须从 data-base-value 读取带单位换算的值 (kWh)
    const annualHeating = parseFloat(document.getElementById('annualHeating').dataset.baseValue) || 0;
    
    const dailyHours = parseFloat(document.getElementById('dailyHours').value) || 0;
    const annualDays = parseFloat(document.getElementById('annualDays').value) || 0;
    const loadFactor = (parseFloat(document.getElementById('loadFactor').value) || 0) / 100;

    // (需求 3) 计算最终的年总热量
    let annualHeatingDemandKWh = 0;
    if (calcMode === 'annual') {
        annualHeatingDemandKWh = heatingLoad * operatingHours;
    } else if (calcMode === 'total') {
        annualHeatingDemandKWh = annualHeating;
    } else if (calcMode === 'daily') {
        annualHeatingDemandKWh = heatingLoad * dailyHours * annualDays * loadFactor;
    }
    // **** 修复结束 ****


    // 读取所有输入值
    const inputs = {
        // 模式
        analysisMode: analysisMode, // V11.0 新增: 'standard', 'hybrid', 'bot'
        isHybridMode: analysisMode === 'hybrid', // V11.0: 基于 analysisMode 派生
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
        
        // **** 修改 (需求 3, 4): 存储所有热量计算相关值 ****
        heatingLoad: heatingLoad, // (kW)
        operatingHours: operatingHours, // (h/年)
        annualHeating: annualHeating, // (kWh)
        dailyHours: dailyHours, // (h/day)
        annualDays: annualDays, // (days/year)
        loadFactor: loadFactor, // (0-1)
        annualHeatingDemandKWh: annualHeatingDemandKWh, // (kWh) 最终计算值
        // **** 修复结束 ****

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
        // V11.0: BOT 模式参数
        botAnnualRevenue: (parseFloat(document.getElementById('botAnnualRevenue').value) || 0) * 10000,
        botAnnualEnergyCost: (parseFloat(document.getElementById('botAnnualEnergyCost').value) || 0) * 10000, 
        botAnnualOpexCost: (parseFloat(document.getElementById('botAnnualOpexCost').value) || 0) * 10000, 
        botEquityRatio: (parseFloat(document.getElementById('botEquityRatio').value) || 0) / 100,
        botLoanInterestRate: (parseFloat(document.getElementById('botLoanInterestRate').value) || 0) / 100,
        botDepreciationYears: parseInt(document.getElementById('botDepreciationYears').value) || 10,
        botVatRate: (parseFloat(document.getElementById('botVatRate').value) || 0) / 100,
        botSurtaxRate: (parseFloat(document.getElementById('botSurtaxRate').value) || 0) / 100,
        botIncomeTaxRate: (parseFloat(document.getElementById('botIncomeTaxRate').value) || 0) / 100,
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

    // **** 代码修改开始 (需求 3) ****
    if (analysisMode !== 'bot') {
        // 成本对比模式: 必须检查 最终计算热量 和 SPF
        if (annualHeatingDemandKWh <= 0 || !inputs.hpCop) {
            if (alertNotifier) {
                alertNotifier('成本对比模式: 请确保最终的“年总加热量”大于 0，并已填写工业热泵SPF。', 'error');
            } else {
                alert('成本对比模式: 请确保最终的“年总加热量”大于 0，并已填写工业热泵SPF。'); // Fallback
            }
            return null;
        }
    } else {
        // BOT 模式: 仅检查 收入 和 能源成本 (允许运维成本为0)
        // (已移除对 heatingLoad 和 operatingHours 的检查)
         if (inputs.botAnnualRevenue === 0 || inputs.botAnnualEnergyCost === 0) {
            if(alertNotifier) {
                alertNotifier('BOT模式: “年销售收入”和“年能源成本”必须大于0。', 'error');
            } else {
                alert('BOT模式: “年销售收入”和“年能源成本”必须大于0。');
            }
            return null;
         }
    }
    // **** 代码修改结束 ****

    return inputs;
}