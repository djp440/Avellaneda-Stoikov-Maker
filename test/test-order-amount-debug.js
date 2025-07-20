const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

async function debugOrderAmount() {
    console.log('🔍 开始调试订单数量计算问题...\n');
    
    try {
        // 1. 加载配置
        console.log('📋 步骤1: 加载配置...');
        const config = new StrategyConfig();
        const orderAmount = config.get('orderAmount');
        console.log(`   配置中的ORDER_AMOUNT: ${orderAmount}`);
        console.log(`   类型: ${typeof orderAmount}`);
        console.log(`   数值: ${Number(orderAmount)}`);
        console.log(`   科学计数法: ${Number(orderAmount).toExponential()}`);
        console.log();
        
        // 2. 创建策略实例
        console.log('🧮 步骤2: 创建策略实例...');
        const strategy = new AvellanedaStrategy(config);
        await strategy.initialize();
        console.log('   策略初始化完成');
        console.log();
        
        // 3. 获取计算器实例
        console.log('🔧 步骤3: 获取计算器实例...');
        const calculator = strategy.calculator;
        console.log(`   计算器类型: ${calculator.constructor.name}`);
        console.log();
        
        // 4. 测试订单数量计算
        console.log('📊 步骤4: 测试订单数量计算...');
        
        // 模拟市场数据
        const marketData = {
            midPrice: 117968.01,
            bestBid: 117968.00,
            bestAsk: 117968.01,
            spread: 0.0000
        };
        
        // 模拟库存数据
        const inventoryData = {
            currentInventory: 0.00154171,
            targetInventory: 0.00423150,
            baseBalance: 0.00154171,
            quoteBalance: 816.49
        };
        
        console.log('   市场数据:');
        console.log(`     中间价: ${marketData.midPrice} USDT`);
        console.log(`     最佳买价: ${marketData.bestBid} USDT`);
        console.log(`     最佳卖价: ${marketData.bestAsk} USDT`);
        console.log();
        
        console.log('   库存数据:');
        console.log(`     当前库存: ${inventoryData.currentInventory} BTC`);
        console.log(`     目标库存: ${inventoryData.targetInventory} BTC`);
        console.log(`     基础余额: ${inventoryData.baseBalance} BTC`);
        console.log(`     计价余额: ${inventoryData.quoteBalance} USDT`);
        console.log();
        
        // 5. 逐步测试计算过程
        console.log('🔍 步骤5: 逐步测试计算过程...');
        
        // 测试基础数量计算
        console.log('   5.1 基础数量计算:');
        const baseAmount = orderAmount;
        console.log(`     原始数量: ${baseAmount}`);
        console.log(`     数值转换: ${Number(baseAmount)}`);
        console.log(`     精度检查: ${Number(baseAmount).toFixed(8)}`);
        console.log();
        
        // 测试数量调整
        console.log('   5.2 数量调整测试:');
        const adjustedAmount = calculator.calculateOrderAmount ? 
            calculator.calculateOrderAmount(baseAmount, marketData, inventoryData) : 
            baseAmount;
        console.log(`     调整后数量: ${adjustedAmount}`);
        console.log(`     调整倍数: ${adjustedAmount / baseAmount}`);
        console.log();
        
        // 测试最小数量限制
        console.log('   5.3 最小数量限制测试:');
        const minAmount = calculator.getMinOrderAmount ? 
            calculator.getMinOrderAmount() : 
            0.000001;
        console.log(`     最小订单数量: ${minAmount}`);
        console.log(`     是否小于最小数量: ${baseAmount < minAmount}`);
        console.log();
        
        // 6. 检查计算器方法
        console.log('🔧 步骤6: 检查计算器方法...');
        console.log(`   计算器方法列表:`);
        Object.getOwnPropertyNames(Object.getPrototypeOf(calculator)).forEach(method => {
            if (typeof calculator[method] === 'function' && method !== 'constructor') {
                console.log(`     - ${method}`);
            }
        });
        console.log();
        
        // 7. 测试具体的计算逻辑
        console.log('🧮 步骤7: 测试具体计算逻辑...');
        
        // 如果有calculateBuyOrderAmount方法
        if (calculator.calculateBuyOrderAmount) {
            console.log('   7.1 买单数量计算:');
            try {
                const buyAmount = calculator.calculateBuyOrderAmount(marketData, inventoryData);
                console.log(`     计算结果: ${buyAmount}`);
                console.log(`     与原始数量比值: ${buyAmount / baseAmount}`);
            } catch (error) {
                console.log(`     计算失败: ${error.message}`);
            }
            console.log();
        }
        
        // 如果有calculateSellOrderAmount方法
        if (calculator.calculateSellOrderAmount) {
            console.log('   7.2 卖单数量计算:');
            try {
                const sellAmount = calculator.calculateSellOrderAmount(marketData, inventoryData);
                console.log(`     计算结果: ${sellAmount}`);
                console.log(`     与原始数量比值: ${sellAmount / baseAmount}`);
            } catch (error) {
                console.log(`     计算失败: ${error.message}`);
            }
            console.log();
        }
        
        // 8. 检查配置中的其他相关参数
        console.log('📋 步骤8: 检查相关配置参数...');
        const relevantConfigs = [
            'orderAmount',
            'minOrderAmount', 
            'maxOrderAmount',
            'riskFactor',
            'shapeFactor',
            'inventoryTarget'
        ];
        
        relevantConfigs.forEach(key => {
            try {
                const value = config.get(key);
                console.log(`   ${key}: ${value}`);
            } catch (error) {
                console.log(`   ${key}: 未配置`);
            }
        });
        console.log();
        
        console.log('✅ 调试完成！');
        
    } catch (error) {
        console.error('❌ 调试过程中出现错误:');
        console.error(`   错误类型: ${error.constructor.name}`);
        console.error(`   错误信息: ${error.message}`);
        
        if (error.stack) {
            console.error('\n📚 错误堆栈:');
            console.error(error.stack);
        }
    }
}

// 运行调试
if (require.main === module) {
    debugOrderAmount();
}

module.exports = debugOrderAmount; 