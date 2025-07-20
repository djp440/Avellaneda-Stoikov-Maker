const ConfigManager = require('../config/strategy');
const ExchangeManager = require('../core/exchange');
const Logger = require('../utils/logger');

/**
 * 详细订单调试脚本
 * 查看具体的订单创建错误
 */
class DetailedOrderTester {
    constructor() {
        this.config = new ConfigManager();
        this.logger = new Logger(this.config);
        this.exchangeManager = new ExchangeManager(this.config);
    }

    /**
     * 运行详细测试
     */
    async runDetailedTest() {
        this.logger.info('开始详细订单调试...');
        
        try {
            // 1. 初始化交易所连接
            await this.initializeExchange();
            
            // 2. 获取市场信息
            await this.getMarketInfo();
            
            // 3. 详细测试订单创建
            await this.detailedOrderTest();
            
        } catch (error) {
            this.logger.error('详细测试失败', error);
        } finally {
            await this.cleanup();
        }
    }

    /**
     * 初始化交易所连接
     */
    async initializeExchange() {
        this.logger.info('正在初始化交易所连接...');
        
        const initialized = await this.exchangeManager.initialize();
        if (!initialized) {
            throw new Error('交易所连接初始化失败');
        }
        
        this.logger.info('交易所连接初始化成功');
    }

    /**
     * 获取市场信息
     */
    async getMarketInfo() {
        this.logger.info('正在获取市场信息...');
        
        // 获取订单簿
        const orderBook = this.exchangeManager.getOrderBook();
        if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
            throw new Error('无法获取有效的订单簿数据');
        }
        
        // 获取价格信息
        const ticker = this.exchangeManager.getTicker();
        if (!ticker || !ticker.last) {
            throw new Error('无法获取有效的价格数据');
        }
        
        // 获取市场信息
        const marketInfo = this.exchangeManager.getMarketInfo();
        if (!marketInfo || !marketInfo.precision) {
            throw new Error('无法获取市场精度信息');
        }
        
        this.logger.info('市场信息获取成功', {
            bestBid: orderBook.bids[0][0],
            bestAsk: orderBook.asks[0][0],
            lastPrice: ticker.last,
            pricePrecision: marketInfo.precision.price,
            amountPrecision: marketInfo.precision.amount
        });
        
        // 保存市场信息供后续使用
        this.marketInfo = marketInfo;
        this.orderBook = orderBook;
        this.ticker = ticker;
    }

    /**
     * 详细测试订单创建
     */
    async detailedOrderTest() {
        this.logger.info('正在详细测试订单创建...');
        
        const symbol = this.config.get('symbol');
        const baseAmount = this.config.get('orderAmount');
        
        // 计算测试价格
        const midPrice = (this.ticker.bid + this.ticker.ask) / 2;
        const testBidPrice = midPrice * 0.999; // 比中间价低0.1%
        const testAskPrice = midPrice * 1.001; // 比中间价高0.1%
        
        // 获取市场精度
        const amountPrecision = this.marketInfo.precision.amount;
        const minAmount = Math.pow(10, -amountPrecision);
        
        this.logger.info('详细测试参数', {
            symbol: symbol,
            baseAmount: baseAmount,
            minAmount: minAmount,
            amountPrecision: amountPrecision,
            testBidPrice: testBidPrice,
            testAskPrice: testAskPrice
        });
        
        // 测试不同的数量
        const testAmounts = [
            minAmount * 100,  // 100倍最小数量
            minAmount * 50,   // 50倍最小数量
            minAmount * 20,   // 20倍最小数量
            minAmount * 10,   // 10倍最小数量
            minAmount * 5,    // 5倍最小数量
            minAmount * 2,    // 2倍最小数量
            minAmount,        // 最小数量
            0.001,            // 固定数量0.001
            0.01,             // 固定数量0.01
            0.1               // 固定数量0.1
        ];
        
        console.log('\n' + '='.repeat(80));
        console.log('详细订单创建测试');
        console.log('='.repeat(80));
        
        for (const amount of testAmounts) {
            console.log(`\n测试数量: ${amount}`);
            
            // 测试买单
            try {
                const buyOrder = await this.exchangeManager.createOrder(
                    'buy', 
                    amount, 
                    testBidPrice, 
                    'limit'
                );
                
                console.log(`  ✅ 买单成功 - 订单ID: ${buyOrder.id}`);
                
                // 立即取消测试订单
                await this.exchangeManager.cancelOrder(buyOrder.id, symbol);
                console.log(`  ✅ 买单已取消`);
                
                // 如果成功，也测试卖单
                try {
                    const sellOrder = await this.exchangeManager.createOrder(
                        'sell', 
                        amount, 
                        testAskPrice, 
                        'limit'
                    );
                    
                    console.log(`  ✅ 卖单成功 - 订单ID: ${sellOrder.id}`);
                    
                    // 立即取消测试订单
                    await this.exchangeManager.cancelOrder(sellOrder.id, symbol);
                    console.log(`  ✅ 卖单已取消`);
                    
                    console.log(`\n🎉 找到有效数量: ${amount}`);
                    console.log(`   最小数量: ${minAmount}`);
                    console.log(`   数量精度: ${amountPrecision} 位`);
                    
                    // 建议更新配置
                    console.log(`\n💡 建议更新 .env 文件中的 ORDER_AMOUNT 为: ${amount}`);
                    
                    return;
                    
                } catch (sellError) {
                    console.log(`  ❌ 卖单失败: ${sellError.message}`);
                }
                
            } catch (buyError) {
                console.log(`  ❌ 买单失败: ${buyError.message}`);
            }
        }
        
        console.log(`\n❌ 所有数量都失败，无法创建订单`);
        console.log(`   请检查账户余额和API权限`);
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            await this.exchangeManager.close();
            this.logger.info('详细测试完成，资源已清理');
        } catch (error) {
            this.logger.error('清理资源时出错', error);
        }
    }
}

// 主函数
async function main() {
    const tester = new DetailedOrderTester();
    
    try {
        await tester.runDetailedTest();
    } catch (error) {
        console.error('详细测试过程中发生严重错误:', error);
    } finally {
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = DetailedOrderTester; 