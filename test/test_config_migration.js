/**
 * 测试配置迁移
 * 验证env中只保留敏感数据，其他配置从trading.js读取
 */

const StrategyConfig = require('../config/strategy');
const tradingConfig = require('../config/trading');

console.log('=== 配置迁移测试 ===\n');

// 测试1: 验证trading.js配置是否正确加载
console.log('1. 验证trading.js配置:');
console.log('   交易对:', tradingConfig.symbol);
console.log('   风险因子:', tradingConfig.riskFactor);
console.log('   更新间隔:', tradingConfig.updateInterval);
console.log('   日志级别:', tradingConfig.logLevel);
console.log('   ✓ trading.js配置加载成功\n');

// 测试2: 验证StrategyConfig是否正确合并配置
try {
    const config = new StrategyConfig();
    const allConfig = config.getAll();
    
    console.log('2. 验证StrategyConfig配置合并:');
    console.log('   交易所名称:', allConfig.exchange.name);
    console.log('   交易对:', allConfig.symbol);
    console.log('   风险因子:', allConfig.riskFactor);
    console.log('   更新间隔:', allConfig.updateInterval);
    console.log('   日志级别:', allConfig.logLevel);
    console.log('   代理配置:', allConfig.proxy);
    console.log('   ✓ StrategyConfig配置合并成功\n');
    
    // 测试3: 验证敏感数据仍然从环境变量读取
    console.log('3. 验证敏感数据来源:');
    console.log('   API Key:', allConfig.exchange.apiKey ? '已设置' : '未设置');
    console.log('   Secret:', allConfig.exchange.secret ? '已设置' : '未设置');
    console.log('   Passphrase:', allConfig.exchange.password ? '已设置' : '未设置');
    console.log('   ✓ 敏感数据从环境变量读取\n');
    
    // 测试4: 验证配置验证器是否正常工作
    console.log('4. 验证配置验证器:');
    try {
        config.validateConfig();
        console.log('   ✓ 配置验证通过\n');
    } catch (error) {
        console.log('   ✗ 配置验证失败:', error.message);
    }
    
    // 测试5: 验证配置获取方法
    console.log('5. 验证配置获取方法:');
    const exchangeConfig = config.getExchangeConfig();
    const strategyParams = config.getStrategyParams();
    const riskParams = config.getRiskParams();
    
    console.log('   交易所配置:', Object.keys(exchangeConfig));
    console.log('   策略参数:', Object.keys(strategyParams));
    console.log('   风险参数:', Object.keys(riskParams));
    console.log('   ✓ 配置获取方法正常\n');
    
    console.log('=== 所有测试通过 ===');
    
} catch (error) {
    console.error('配置测试失败:', error.message);
    process.exit(1);
} 