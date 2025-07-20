const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

async function verifyFix() {
    console.log('🔍 验证订单数量计算修复...\n');
    
    try {
        // 1. 加载配置
        console.log('📋 步骤1: 加载配置...');
        const config = new StrategyConfig();
        const orderAmount = config.get('orderAmount');
        console.log(`   配置中的ORDER_AMOUNT: ${orderAmount}`);
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
        console.log(`     数量精度: ${marketInfo.precision.amount}`);
        console.log(`     价格精度: ${marketInfo.precision.price}`);
        console.log();
        
        // 4. 模拟策略中的计算逻辑（修复后的版本）
        console.log('🔧 步骤4: 模拟修复后的计算逻辑...');
        
        // 这是修复后的逻辑
        const baseAmount = orderAmount;
        const minAmount = marketInfo.precision.amount; // CCXT返回的是最小数量，不是精度位数
        const adjustedBaseAmount = Math.max(baseAmount, minAmount * 10); // 至少10倍最小数量
        
        console.log('   修复后的计算:');
        console.log(`     原始数量: ${baseAmount}`);
        console.log(`     最小数量: ${minAmount}`);
        console.log(`     最小数量×10: ${minAmount * 10}`);
        console.log(`     调整后数量: ${adjustedBaseAmount}`);
        console.log(`     是否被调整: ${adjustedBaseAmount !== baseAmount ? '是' : '否'}`);
        console.log();
        
        // 5. 检查是否还有其他问题
        console.log('🔍 步骤5: 检查计算器处理...');
        const calculator = strategy.calculator;
        
        // 模拟计算器中的计算
        const testAmount = adjustedBaseAmount;
        console.log(`   传入计算器的数量: ${testAmount}`);
        
        // 检查formatAmount方法
        if (calculator.formatAmount) {
            const formattedAmount = calculator.formatAmount(testAmount);
            console.log(`   格式化后数量: ${formattedAmount}`);
            console.log(`   格式化是否改变数量: ${formattedAmount !== testAmount ? '是' : '否'}`);
        }
        console.log();
        
        // 6. 测试完整的订单数量计算
        console.log('🧮 步骤6: 测试完整订单数量计算...');
        
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
        
        // 计算总库存价值
        const totalInventoryValue = inventoryData.baseBalance * marketData.midPrice + inventoryData.quoteBalance;
        
        console.log('   测试数据:');
        console.log(`     中间价: ${marketData.midPrice} USDT`);
        console.log(`     当前库存: ${inventoryData.currentInventory} BTC`);
        console.log(`     目标库存: ${inventoryData.targetInventory} BTC`);
        console.log(`     总库存价值: ${totalInventoryValue.toFixed(2)} USDT`);
        console.log();
        
        // 调用计算器的订单数量计算方法
        const buyAmount = calculator.calculateOrderAmount(
            adjustedBaseAmount, 
            inventoryData.currentInventory, 
            inventoryData.targetInventory, 
            totalInventoryValue, 
            true
        );
        
        const sellAmount = calculator.calculateOrderAmount(
            adjustedBaseAmount, 
            inventoryData.currentInventory, 
            inventoryData.targetInventory, 
            totalInventoryValue, 
            false
        );
        
        console.log('   计算结果:');
        console.log(`     买单数量: ${buyAmount.toFixed(8)} BTC`);
        console.log(`     卖单数量: ${sellAmount.toFixed(8)} BTC`);
        console.log(`     与原始数量比值: ${(buyAmount / baseAmount).toFixed(2)}`);
        console.log();
        
        // 7. 验证结果
        console.log('✅ 步骤7: 验证结果...');
        const expectedRatio = 1.0; // 期望的比值应该是1.0左右
        const actualRatio = buyAmount / baseAmount;
        const tolerance = 0.1; // 允许10%的误差
        
        if (Math.abs(actualRatio - expectedRatio) <= tolerance) {
            console.log('   ✅ 修复成功！订单数量计算正常');
            console.log(`      实际比值: ${actualRatio.toFixed(4)}`);
            console.log(`      期望比值: ${expectedRatio.toFixed(4)}`);
        } else {
            console.log('   ❌ 修复失败！订单数量仍然异常');
            console.log(`      实际比值: ${actualRatio.toFixed(4)}`);
            console.log(`      期望比值: ${expectedRatio.toFixed(4)}`);
            console.log(`      误差: ${Math.abs(actualRatio - expectedRatio).toFixed(4)}`);
        }
        console.log();
        
        console.log('✅ 验证完成！');
        
    } catch (error) {
        console.error('❌ 验证过程中出现错误:');
        console.error(`   错误类型: ${error.constructor.name}`);
        console.error(`   错误信息: ${error.message}`);
        
        if (error.stack) {
            console.error('\n📚 错误堆栈:');
            console.error(error.stack);
        }
    }
}

// 运行验证
if (require.main === module) {
    verifyFix();
}

module.exports = verifyFix; 