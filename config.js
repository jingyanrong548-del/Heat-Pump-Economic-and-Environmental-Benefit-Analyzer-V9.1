// config.js

/**
 * 燃料油（柴油、重油、渣油）的默认数据
 * 包含价格、热值、排放因子及对应的工具提示
 */
export const fuelData = {
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

/**
 * 1 大卡 (kcal) 对应的兆焦耳 (MJ)
 * 1 kcal = 4184 J = 0.004184 MJ
 */
export const MJ_PER_KCAL = 0.004184;

/**
 * 单位换算器配置
 * 定义了所有输入框 (input) 和下拉框 (select) 之间的换算关系
 * 'dynamicConversions' 用于依赖其他输入值（如热值）的动态换算
 */
export const converters = [
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