const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

async function testOrderCreation() {
    console.log('🔍 测试订单创建功能...\n');
    
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
        if (!marketInfo) {
            console.log('   ❌ 无法获取市场信息，尝试重新加载...');
            await strategy.exchangeManager.loadMarketInfo();
            const reloadedMarketInfo = strategy.exchangeManager.getMarketInfo();
            if (!reloadedMarketInfo) {
                throw new Error('无法获取市场信息，请检查交易所连接');
            }
            console.log('   ✅ 市场信息重新加载成功');
        }
        
        console.log('   市场信息:');
        console.log(`     数量精度: ${marketInfo.precision.amount}`);
        console.log(`     价格精度: ${marketInfo.precision.price}`);
        console.log();
        
        // 4. 测试数量格式化
        console.log('🔧 步骤4: 测试数量格式化...');
        const testAmount = 0.00002;
        const formattedAmount = strategy.exchangeManager.formatAmount(testAmount);
        console.log(`   原始数量: ${testAmount}`);
        console.log(`   格式化后: ${formattedAmount}`);
        console.log(`   是否改变: ${formattedAmount !== testAmount ? '是' : '否'}`);
        console.log();
        
        // 5. 测试价格格式化
        console.log('💰 步骤5: 测试价格格式化...');
        const testPrice = 117924.01;
        const formattedPrice = strategy.exchangeManager.formatPrice(testPrice);
        console.log(`   原始价格: ${testPrice}`);
        console.log(`   格式化后: ${formattedPrice}`);
        console.log(`   是否改变: ${formattedPrice !== testPrice ? '是' : '否'}`);
        console.log();
        
        // 6. 测试订单创建
        console.log('🔄 步骤6: 测试订单创建...');
        
        // 获取当前市场价格
        const ticker = strategy.exchangeManager.getTicker();
        if (!ticker) {
            console.log('   ❌ 无法获取市场价格，跳过订单创建测试');
            return;
        }
        
        const currentPrice = ticker.last || ticker.bid || 117924.01;
        const testOrderAmount = 0.00002;
        const testOrderPrice = currentPrice * 0.999; // 稍微低于市价
        
        console.log(`   当前价格: ${currentPrice} USDT`);
        console.log(`   测试价格: ${testOrderPrice} USDT`);
        console.log(`   测试数量: ${testOrderAmount} BTC`);
        console.log();
        
        // 尝试创建买单
        console.log('🟢 测试买单创建:');
        try {
            const buyOrder = await strategy.exchangeManager.createOrder('buy', testOrderAmount, testOrderPrice, 'limit');
            if (buyOrder) {
                console.log(`   ✅ 买单创建成功 - ID: ${buyOrder.id}`);
                console.log(`      状态: ${buyOrder.status}`);
                console.log(`      数量: ${buyOrder.amount} BTC`);
                console.log(`      价格: ${buyOrder.price} USDT`);
                
                // 尝试取消订单
                console.log('   🔄 尝试取消订单...');
                try {
                    await strategy.exchangeManager.cancelOrder(buyOrder.id);
                    console.log('   ✅ 订单取消成功');
                } catch (cancelError) {
                    console.log(`   ❌ 订单取消失败: ${cancelError.message}`);
                }
            } else {
                console.log('   ❌ 买单创建失败 - 返回null');
            }
        } catch (error) {
            console.log(`   ❌ 买单创建失败: ${error.message}`);
            if (error.stack) {
                console.log(`   📚 错误详情: ${error.stack.split('\n')[1]?.trim()}`);
            }
        }
        console.log();
        
        // 尝试创建卖单
        console.log('🔴 测试卖单创建:');
        const testSellPrice = currentPrice * 1.001; // 稍微高于市价
        console.log(`   测试价格: ${testSellPrice} USDT`);
        
        try {
            const sellOrder = await strategy.exchangeManager.createOrder('sell', testOrderAmount, testSellPrice, 'limit');
            if (sellOrder) {
                console.log(`   ✅ 卖单创建成功 - ID: ${sellOrder.id}`);
                console.log(`      状态: ${sellOrder.status}`);
                console.log(`      数量: ${sellOrder.amount} BTC`);
                console.log(`      价格: ${sellOrder.price} USDT`);
                
                // 尝试取消订单
                console.log('   🔄 尝试取消订单...');
                try {
                    await strategy.exchangeManager.cancelOrder(sellOrder.id);
                    console.log('   ✅ 订单取消成功');
                } catch (cancelError) {
                    console.log(`   ❌ 订单取消失败: ${cancelError.message}`);
                }
            } else {
                console.log('   ❌ 卖单创建失败 - 返回null');
            }
        } catch (error) {
            console.log(`   ❌ 卖单创建失败: ${error.message}`);
            if (error.stack) {
                console.log(`   📚 错误详情: ${error.stack.split('\n')[1]?.trim()}`);
            }
        }
        console.log();
        
        // 7. 检查账户余额
        console.log('💰 步骤7: 检查账户余额...');
        const balances = strategy.exchangeManager.getBalances();
        if (balances) {
            const baseCurrency = config.get('baseCurrency');
            const quoteCurrency = config.get('quoteCurrency');
            
            const baseBalance = balances[baseCurrency] || { free: 0, used: 0, total: 0 };
            const quoteBalance = balances[quoteCurrency] || { free: 0, used: 0, total: 0 };
            
            console.log(`   ${baseCurrency}余额:`);
            console.log(`     可用: ${baseBalance.free}`);
            console.log(`     冻结: ${baseBalance.used}`);
            console.log(`     总计: ${baseBalance.total}`);
            console.log();
            
            console.log(`   ${quoteCurrency}余额:`);
            console.log(`     可用: ${quoteBalance.free}`);
            console.log(`     冻结: ${quoteBalance.used}`);
            console.log(`     总计: ${quoteBalance.total}`);
            console.log();
            
            // 检查余额是否足够
            const orderValue = testOrderAmount * currentPrice;
            if (quoteBalance.free < orderValue) {
                console.log(`   ⚠️ 警告: ${quoteCurrency}余额不足`);
                console.log(`      需要: ${orderValue.toFixed(2)} ${quoteCurrency}`);
                console.log(`      可用: ${quoteBalance.free} ${quoteCurrency}`);
            } else {
                console.log(`   ✅ ${quoteCurrency}余额充足`);
            }
        } else {
            console.log('   ❌ 无法获取账户余额');
        }
        console.log();
        
        console.log('✅ 订单创建测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中出现错误:');
        console.error(`   错误类型: ${error.constructor.name}`);
        console.error(`   错误信息: ${error.message}`);
        
        if (error.stack) {
            console.error('\n📚 错误堆栈:');
            console.error(error.stack);
        }
    }
}

// 运行测试
if (require.main === module) {
    testOrderCreation();
}

module.exports = testOrderCreation; 