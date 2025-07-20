const StrategyConfig = require('../config/strategy');
const AvellanedaCalculator = require('../core/calculator');
const ExchangeManager = require('../core/exchange');
const Helpers = require('../utils/helpers');

/**
 * 价格精度测试脚本
 * 验证计算出的价格是否符合交易所精度要求
 */
async function testPricePrecision() {
    console.log('🔍 价格精度测试开始...\n');
    
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
        console.log(`   数量精度: ${marketInfo.precision.amount}`);
        console.log(`   最小价格: ${marketInfo.limits.price?.min || '未设置'}`);
        console.log(`   最大价格: ${marketInfo.limits.price?.max || '未设置'}`);
        console.log(`   最小数量: ${marketInfo.limits.amount?.min || '未设置'}`);
        console.log(`   最大数量: ${marketInfo.limits.amount?.max || '未设置'}`);
        
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
        
        // 初始化计算器
        const calculator = new AvellanedaCalculator(config);
        console.log('\n✅ 计算器初始化成功');
        
        // 测试不同价差下的价格计算
        const testSpreads = [0.0005, 0.001, 0.002, 0.005, 0.01];
        
        console.log('\n🧮 价格计算测试:');
        console.log('─'.repeat(80));
        
        for (const spread of testSpreads) {
            console.log(`\n📊 测试价差: ${(spread * 100).toFixed(2)}% (${spread})`);
            
            // 计算最优价格
            const prices = calculator.calculateOptimalPrices(midPrice, spread);
            
            console.log(`   原始买价: ${prices.optimalBid.toFixed(8)} USDT`);
            console.log(`   原始卖价: ${prices.optimalAsk.toFixed(8)} USDT`);
            
            // 使用交易所精度格式化价格
            const formattedBid = exchangeManager.formatPrice(prices.optimalBid);
            const formattedAsk = exchangeManager.formatPrice(prices.optimalAsk);
            
            console.log(`   格式化买价: ${formattedBid.toFixed(8)} USDT`);
            console.log(`   格式化卖价: ${formattedAsk.toFixed(8)} USDT`);
            
            // 检查价差是否满足最小要求
            const actualSpread = (formattedAsk - formattedBid) / midPrice;
            const minSpread = config.get('minSpread');
            
            console.log(`   实际价差: ${(actualSpread * 100).toFixed(4)}%`);
            console.log(`   最小价差: ${(minSpread * 100).toFixed(4)}%`);
            
            if (actualSpread >= minSpread) {
                console.log(`   ✅ 价差满足要求`);
            } else {
                console.log(`   ❌ 价差不满足要求 (${(actualSpread * 100).toFixed(4)}% < ${(minSpread * 100).toFixed(4)}%)`);
            }
            
            // 检查价格是否相同
            if (formattedBid === formattedAsk) {
                console.log(`   ⚠️  警告: 买卖价格相同!`);
            }
        }
        
        // 测试价格精度边界情况
        console.log('\n🔬 精度边界测试:');
        console.log('─'.repeat(80));
        
        const testPrices = [
            117825.99475,
            117825.99525,
            117825.99,
            117826.00,
            117825.995,
            117825.996
        ];
        
        for (const price of testPrices) {
            const formatted = exchangeManager.formatPrice(price);
            console.log(`   原始价格: ${price.toFixed(8)} → 格式化后: ${formatted.toFixed(8)}`);
        }
        
        // 分析问题
        console.log('\n🔍 问题分析:');
        console.log('─'.repeat(80));
        
        const problemPrices = calculator.calculateOptimalPrices(midPrice, 0.0005);
        const formattedProblemBid = exchangeManager.formatPrice(problemPrices.optimalBid);
        const formattedProblemAsk = exchangeManager.formatPrice(problemPrices.optimalAsk);
        
        console.log(`   计算价差: 0.05%`);
        console.log(`   原始买价: ${problemPrices.optimalBid.toFixed(8)}`);
        console.log(`   原始卖价: ${problemPrices.optimalAsk.toFixed(8)}`);
        console.log(`   格式化买价: ${formattedProblemBid.toFixed(8)}`);
        console.log(`   格式化卖价: ${formattedProblemAsk.toFixed(8)}`);
        
        if (formattedProblemBid === formattedProblemAsk) {
            console.log(`   ❌ 问题确认: 买卖价格相同，违反最小价差要求`);
            console.log(`   💡 解决方案: 需要增加最小价差或调整价格计算逻辑`);
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
    testPricePrecision().then(() => {
        console.log('\n🎯 价格精度测试结束');
        process.exit(0);
    }).catch((error) => {
        console.error('\n💥 测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testPricePrecision }; 