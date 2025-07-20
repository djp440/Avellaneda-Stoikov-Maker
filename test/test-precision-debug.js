const StrategyConfig = require('../config/strategy');
const ExchangeManager = require('../core/exchange');

/**
 * 价格精度调试脚本
 * 检查交易所返回的价格精度信息
 */
async function debugPrecision() {
    console.log('🔍 价格精度调试开始...\n');
    
    try {
        // 初始化配置
        const config = new StrategyConfig();
        console.log('✅ 配置加载成功');
        
        // 初始化交易所管理器
        const exchangeManager = new ExchangeManager(config);
        console.log('✅ 交易所管理器初始化成功');
        
        // 连接交易所
        console.log('\n🔗 正在连接交易所...');
        const connected = await exchangeManager.initialize();
        if (!connected) {
            throw new Error('交易所连接失败');
        }
        console.log('✅ 交易所连接成功');
        
        // 获取市场信息
        const marketInfo = exchangeManager.getMarketInfo();
        console.log('\n📊 市场信息详情:');
        console.log(`   交易对: ${marketInfo.symbol}`);
        console.log(`   基础货币: ${marketInfo.base}`);
        console.log(`   计价货币: ${marketInfo.quote}`);
        console.log(`   是否活跃: ${marketInfo.active}`);
        
        console.log('\n🔧 精度信息:');
        console.log(`   价格精度: ${marketInfo.precision.price}`);
        console.log(`   数量精度: ${marketInfo.precision.amount}`);
        console.log(`   价格精度类型: ${typeof marketInfo.precision.price}`);
        console.log(`   数量精度类型: ${typeof marketInfo.precision.amount}`);
        
        console.log('\n📏 限制信息:');
        console.log(`   价格限制:`, marketInfo.limits.price);
        console.log(`   数量限制:`, marketInfo.limits.amount);
        console.log(`   成本限制:`, marketInfo.limits.cost);
        
        // 测试价格步长计算
        console.log('\n🧮 价格步长计算测试:');
        const pricePrecision = marketInfo.precision.price;
        const calculatedStep = Math.pow(10, -pricePrecision);
        console.log(`   价格精度: ${pricePrecision}`);
        console.log(`   计算步长: ${calculatedStep}`);
        console.log(`   步长类型: ${typeof calculatedStep}`);
        
        // 测试价格格式化
        console.log('\n🔧 价格格式化测试:');
        const testPrices = [117825.99475, 117825.99525, 117825.99, 117826.00];
        
        for (const price of testPrices) {
            const formatted = exchangeManager.formatPrice(price);
            console.log(`   原始价格: ${price.toFixed(8)} → 格式化后: ${formatted.toFixed(8)}`);
        }
        
        // 测试价格对齐
        console.log('\n🎯 价格对齐测试:');
        const priceStep = calculatedStep;
        const testPrice = 117825.99475;
        
        const floorAligned = Math.floor(testPrice / priceStep) * priceStep;
        const ceilAligned = Math.ceil(testPrice / priceStep) * priceStep;
        
        console.log(`   测试价格: ${testPrice.toFixed(8)}`);
        console.log(`   价格步长: ${priceStep.toFixed(8)}`);
        console.log(`   向下对齐: ${floorAligned.toFixed(8)}`);
        console.log(`   向上对齐: ${ceilAligned.toFixed(8)}`);
        console.log(`   向下对齐余数: ${(testPrice % priceStep).toFixed(10)}`);
        console.log(`   向上对齐余数: ${(ceilAligned - testPrice).toFixed(10)}`);
        
        // 检查CCXT原始市场信息
        console.log('\n📋 CCXT原始市场信息:');
        try {
            const exchange = exchangeManager.exchange;
            const symbol = config.get('symbol');
            const market = exchange.market(symbol);
            
            console.log(`   市场对象:`, market);
            console.log(`   精度信息:`, market.precision);
            console.log(`   限制信息:`, market.limits);
            
            // 检查是否有其他精度相关字段
            console.log('\n🔍 其他精度相关字段:');
            for (const key in market) {
                if (key.toLowerCase().includes('precision') || key.toLowerCase().includes('step')) {
                    console.log(`   ${key}: ${market[key]}`);
                }
            }
            
        } catch (error) {
            console.log(`   获取CCXT市场信息失败: ${error.message}`);
        }
        
        // 关闭连接
        await exchangeManager.close();
        console.log('\n✅ 调试完成，连接已关闭');
        
    } catch (error) {
        console.error('\n❌ 调试失败:', error.message);
        if (error.stack) {
            console.error('错误详情:', error.stack);
        }
    }
}

// 运行调试
if (require.main === module) {
    debugPrecision().then(() => {
        console.log('\n🎯 价格精度调试结束');
        process.exit(0);
    }).catch((error) => {
        console.error('\n💥 调试异常:', error);
        process.exit(1);
    });
}

module.exports = { debugPrecision }; 