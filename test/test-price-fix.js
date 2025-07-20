const StrategyConfig = require('../config/strategy');
const AvellanedaCalculator = require('../core/calculator');
const ExchangeManager = require('../core/exchange');
const Helpers = require('../utils/helpers');

/**
 * 价格精度修复验证测试脚本
 * 验证修复后的价格计算是否正确处理精度限制
 */
async function testPriceFix() {
    console.log('🔧 价格精度修复验证测试开始...\n');
    
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
        console.log('\n📊 市场信息:');
        console.log(`   交易对: ${marketInfo.symbol}`);
        console.log(`   价格精度: ${marketInfo.precision.price}`);
        console.log(`   价格步长: ${marketInfo.precision.price}`);
        console.log(`   计算精度位数: ${Math.abs(Math.floor(Math.log10(marketInfo.precision.price)))}`);
        
        // 获取当前订单簿
        const orderBook = exchangeManager.getOrderBook();
        if (!orderBook || !orderBook.bids || !orderBook.asks) {
            throw new Error('无法获取订单簿数据');
        }
        
        const bestBid = orderBook.bids[0][0];
        const bestAsk = orderBook.asks[0][0];
        const midPrice = Helpers.calculateMidPrice(bestBid, bestAsk);
        
        console.log('\n📈 当前市场数据:');
        console.log(`   最优买价: ${bestBid.toFixed(8)} USDT`);
        console.log(`   最优卖价: ${bestAsk.toFixed(8)} USDT`);
        console.log(`   中间价: ${midPrice.toFixed(8)} USDT`);
        console.log(`   当前价差: ${((bestAsk - bestBid) / midPrice * 100).toFixed(4)}%`);
        
        // 初始化计算器（传入交易所管理器）
        const calculator = new AvellanedaCalculator(config, exchangeManager);
        console.log('\n✅ 计算器初始化成功（包含交易所管理器）');
        
        // 测试修复后的价格计算
        const testSpreads = [0.0005, 0.001, 0.002, 0.005, 0.01];
        
        console.log('\n🧮 修复后的价格计算测试:');
        console.log('─'.repeat(80));
        
        for (const spread of testSpreads) {
            console.log(`\n📊 测试价差: ${(spread * 100).toFixed(2)}% (${spread})`);
            
            // 计算最优价格
            const prices = calculator.calculateOptimalPrices(midPrice, spread);
            
            console.log(`   计算买价: ${prices.optimalBid.toFixed(8)} USDT`);
            console.log(`   计算卖价: ${prices.optimalAsk.toFixed(8)} USDT`);
            
            // 检查价差是否满足最小要求
            const actualSpread = (prices.optimalAsk - prices.optimalBid) / ((prices.optimalBid + prices.optimalAsk) / 2);
            const minSpread = config.get('minSpread');
            
            console.log(`   实际价差: ${(actualSpread * 100).toFixed(4)}%`);
            console.log(`   最小价差: ${(minSpread * 100).toFixed(4)}%`);
            
            if (actualSpread >= minSpread) {
                console.log(`   ✅ 价差满足要求`);
            } else {
                console.log(`   ❌ 价差不满足要求 (${(actualSpread * 100).toFixed(4)}% < ${(minSpread * 100).toFixed(4)}%)`);
            }
            
            // 检查价格是否相同
            if (prices.optimalBid === prices.optimalAsk) {
                console.log(`   ⚠️  警告: 买卖价格相同!`);
            } else {
                console.log(`   ✅ 买卖价格不同`);
            }
            
            // 检查价格是否符合精度要求
            const priceStep = marketInfo.precision.price; // 直接使用价格步长
            const bidRemainder = prices.optimalBid % priceStep;
            const askRemainder = prices.optimalAsk % priceStep;
            
            if (Math.abs(bidRemainder) < 1e-10 && Math.abs(askRemainder) < 1e-10) {
                console.log(`   ✅ 价格符合精度要求`);
            } else {
                console.log(`   ❌ 价格不符合精度要求`);
                console.log(`      买价余数: ${bidRemainder.toFixed(10)}`);
                console.log(`      卖价余数: ${askRemainder.toFixed(10)}`);
            }
        }
        
        // 测试边界情况
        console.log('\n🔬 边界情况测试:');
        console.log('─'.repeat(80));
        
        // 测试非常小的价差
        const tinySpread = 0.0001; // 0.01%
        console.log(`\n📊 极小价差测试: ${(tinySpread * 100).toFixed(2)}%`);
        
        const tinyPrices = calculator.calculateOptimalPrices(midPrice, tinySpread);
        const tinyActualSpread = (tinyPrices.optimalAsk - tinyPrices.optimalBid) / ((tinyPrices.optimalBid + tinyPrices.optimalAsk) / 2);
        
        console.log(`   计算买价: ${tinyPrices.optimalBid.toFixed(8)} USDT`);
        console.log(`   计算卖价: ${tinyPrices.optimalAsk.toFixed(8)} USDT`);
        console.log(`   实际价差: ${(tinyActualSpread * 100).toFixed(4)}%`);
        console.log(`   最小价差: ${(config.get('minSpread') * 100).toFixed(4)}%`);
        
        if (tinyActualSpread >= config.get('minSpread')) {
            console.log(`   ✅ 极小价差也能满足最小要求`);
        } else {
            console.log(`   ❌ 极小价差不满足最小要求`);
        }
        
        // 测试价格调整逻辑
        console.log('\n🔧 价格调整逻辑测试:');
        console.log('─'.repeat(80));
        
        const testMidPrice = 117825.99;
        const testSpread = 0.0005;
        
        console.log(`\n📊 测试参数:`);
        console.log(`   中间价: ${testMidPrice.toFixed(8)} USDT`);
        console.log(`   价差: ${(testSpread * 100).toFixed(2)}%`);
        console.log(`   价格步长: ${Math.pow(10, -marketInfo.precision.price)}`);
        
        const testPrices = calculator.calculateOptimalPrices(testMidPrice, testSpread);
        const testActualSpread = (testPrices.optimalAsk - testPrices.optimalBid) / ((testPrices.optimalBid + testPrices.optimalAsk) / 2);
        
        console.log(`\n📊 计算结果:`);
        console.log(`   买价: ${testPrices.optimalBid.toFixed(8)} USDT`);
        console.log(`   卖价: ${testPrices.optimalAsk.toFixed(8)} USDT`);
        console.log(`   实际价差: ${(testActualSpread * 100).toFixed(4)}%`);
        console.log(`   价格差异: ${(testPrices.optimalAsk - testPrices.optimalBid).toFixed(8)} USDT`);
        
        // 总结
        console.log('\n📋 修复验证总结:');
        console.log('─'.repeat(80));
        
        let allTestsPassed = true;
        const summaryTests = [
            { spread: 0.0005, name: '0.05%价差' },
            { spread: 0.001, name: '0.1%价差' },
            { spread: 0.002, name: '0.2%价差' },
            { spread: 0.005, name: '0.5%价差' },
            { spread: 0.01, name: '1%价差' }
        ];
        
        for (const test of summaryTests) {
            const prices = calculator.calculateOptimalPrices(midPrice, test.spread);
            const spread = (prices.optimalAsk - prices.optimalBid) / ((prices.optimalBid + prices.optimalAsk) / 2);
            const isValid = spread >= config.get('minSpread') && prices.optimalBid !== prices.optimalAsk;
            
            console.log(`   ${test.name}: ${isValid ? '✅ 通过' : '❌ 失败'}`);
            if (!isValid) allTestsPassed = false;
        }
        
        if (allTestsPassed) {
            console.log('\n🎉 所有测试通过！价格精度问题已修复');
        } else {
            console.log('\n⚠️  部分测试失败，需要进一步调整');
        }
        
        // 关闭连接
        await exchangeManager.close();
        console.log('\n✅ 测试完成，连接已关闭');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        if (error.stack) {
            console.error('错误详情:', error.stack);
        }
    }
}

// 运行测试
if (require.main === module) {
    testPriceFix().then(() => {
        console.log('\n🎯 价格精度修复验证测试结束');
        process.exit(0);
    }).catch((error) => {
        console.error('\n💥 测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testPriceFix }; 