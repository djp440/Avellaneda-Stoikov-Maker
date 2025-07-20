const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

async function debugPrecision() {
    console.log('🔍 开始调试市场精度问题...\n');
    
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
        
        // 3. 获取市场信息
        console.log('📊 步骤3: 获取市场信息...');
        const marketInfo = strategy.exchangeManager.getMarketInfo();
        console.log('   市场信息:');
        console.log(`     ${JSON.stringify(marketInfo, null, 2)}`);
        console.log();
        
        if (marketInfo && marketInfo.precision) {
            console.log('   精度信息:');
            console.log(`     数量精度: ${marketInfo.precision.amount}`);
            console.log(`     价格精度: ${marketInfo.precision.price}`);
            console.log();
            
            // 4. 测试精度计算
            console.log('🔧 步骤4: 测试精度计算...');
            const amountPrecision = marketInfo.precision.amount;
            const minAmount = Math.pow(10, -amountPrecision);
            const adjustedBaseAmount = Math.max(orderAmount, minAmount * 10);
            
            console.log('   精度计算:');
            console.log(`     数量精度: ${amountPrecision}位小数`);
            console.log(`     最小数量: ${minAmount}`);
            console.log(`     最小数量×10: ${minAmount * 10}`);
            console.log(`     原始数量: ${orderAmount}`);
            console.log(`     调整后数量: ${adjustedBaseAmount}`);
            console.log(`     是否被调整: ${adjustedBaseAmount !== orderAmount ? '是' : '否'}`);
            console.log();
            
            // 5. 检查是否有其他问题
            console.log('🔍 步骤5: 检查其他可能的问题...');
            
            // 检查是否有其他地方修改了数量
            console.log('   检查策略中的数量计算逻辑...');
            
            // 模拟策略中的计算过程
            const baseAmount = orderAmount;
            const amountPrecision2 = marketInfo.precision.amount;
            const minAmount2 = Math.pow(10, -amountPrecision2);
            const adjustedBaseAmount2 = Math.max(baseAmount, minAmount2 * 10);
            
            console.log('   策略中的计算:');
            console.log(`     原始数量: ${baseAmount}`);
            console.log(`     调整数量: ${adjustedBaseAmount2}`);
            console.log(`     最小数量: ${minAmount2}`);
            console.log(`     数量精度: ${amountPrecision2}位小数`);
            console.log();
            
            // 6. 检查计算器中的处理
            console.log('🧮 步骤6: 检查计算器处理...');
            const calculator = strategy.calculator;
            
            // 模拟计算器中的计算
            const testAmount = adjustedBaseAmount2;
            console.log(`   传入计算器的数量: ${testAmount}`);
            
            // 检查formatAmount方法
            if (calculator.formatAmount) {
                const formattedAmount = calculator.formatAmount(testAmount);
                console.log(`   格式化后数量: ${formattedAmount}`);
                console.log(`   格式化是否改变数量: ${formattedAmount !== testAmount ? '是' : '否'}`);
            }
            console.log();
            
        } else {
            console.log('   ❌ 无法获取市场精度信息');
        }
        
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
    debugPrecision();
}

module.exports = debugPrecision; 