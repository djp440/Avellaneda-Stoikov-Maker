const ConfigManager = require('../config/strategy');
const ExchangeManager = require('../core/exchange');
const Logger = require('../utils/logger');

/**
 * 简化订单测试脚本
 * 专门测试订单创建功能
 */
class SimpleOrderTester {
    constructor() {
        this.config = new ConfigManager();
        this.logger = new Logger(this.config);
        this.exchangeManager = new ExchangeManager(this.config);
    }

    /**
     * 运行测试
     */
    async runTest() {
        this.logger.info('开始简化订单测试...');
        
        try {
            // 1. 初始化交易所连接
            await this.initializeExchange();
            
            // 2. 获取市场信息
            await this.getMarketInfo();
            
            // 3. 测试订单创建
            await this.testOrderCreation();
            
        } catch (error) {
            this.logger.error('测试失败', error);
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
     * 测试订单创建
     */
    async testOrderCreation() {
        this.logger.info('正在测试订单创建...');
        
        const symbol = this.config.get('symbol');
        const [baseCurrency, quoteCurrency] = symbol.split('/');
        
        // 计算测试价格
        const midPrice = (this.ticker.bid + this.ticker.ask) / 2;
        const testBidPrice = midPrice * 0.999; // 比中间价低0.1%
        const testAskPrice = midPrice * 1.001; // 比中间价高0.1%
        
        // 计算测试数量 - 使用市场精度
        const amountPrecision = this.marketInfo.precision.amount;
        const minAmount = Math.pow(10, -amountPrecision);
        const testAmount = Math.max(minAmount * 10, 0.001); // 至少10倍最小数量或0.001
        
        this.logger.info('测试参数', {
            symbol: symbol,
            testBidPrice: testBidPrice,
            testAskPrice: testAskPrice,
            testAmount: testAmount,
            minAmount: minAmount,
            amountPrecision: amountPrecision
        });
        
        // 测试买单
        try {
            this.logger.info('尝试创建测试买单...');
            const buyOrder = await this.exchangeManager.createOrder(
                'buy', 
                testAmount, 
                testBidPrice, 
                'limit'
            );
            
            this.logger.info('测试买单创建成功', {
                orderId: buyOrder.id,
                status: buyOrder.status,
                amount: buyOrder.amount,
                price: buyOrder.price
            });
            
            // 立即取消测试订单
            await this.exchangeManager.cancelOrder(buyOrder.id, symbol);
            this.logger.info('测试买单已取消');
            
        } catch (error) {
            this.logger.error('测试买单创建失败', {
                error: error.message,
                amount: testAmount,
                price: testBidPrice
            });
            
            // 尝试更小的数量
            await this.trySmallerAmount('buy', testBidPrice);
        }
        
        // 测试卖单
        try {
            this.logger.info('尝试创建测试卖单...');
            const sellOrder = await this.exchangeManager.createOrder(
                'sell', 
                testAmount, 
                testAskPrice, 
                'limit'
            );
            
            this.logger.info('测试卖单创建成功', {
                orderId: sellOrder.id,
                status: sellOrder.status,
                amount: sellOrder.amount,
                price: sellOrder.price
            });
            
            // 立即取消测试订单
            await this.exchangeManager.cancelOrder(sellOrder.id, symbol);
            this.logger.info('测试卖单已取消');
            
        } catch (error) {
            this.logger.error('测试卖单创建失败', {
                error: error.message,
                amount: testAmount,
                price: testAskPrice
            });
            
            // 尝试更小的数量
            await this.trySmallerAmount('sell', testAskPrice);
        }
    }

    /**
     * 尝试更小的数量
     */
    async trySmallerAmount(side, price) {
        this.logger.info(`尝试使用更小的数量创建${side}单...`);
        
        const symbol = this.config.get('symbol');
        const amountPrecision = this.marketInfo.precision.amount;
        const minAmount = Math.pow(10, -amountPrecision);
        
        // 尝试不同的数量
        const testAmounts = [
            minAmount * 100,  // 100倍最小数量
            minAmount * 50,   // 50倍最小数量
            minAmount * 20,   // 20倍最小数量
            minAmount * 10,   // 10倍最小数量
            minAmount * 5,    // 5倍最小数量
            minAmount * 2,    // 2倍最小数量
            minAmount         // 最小数量
        ];
        
        for (const amount of testAmounts) {
            try {
                this.logger.info(`尝试数量: ${amount}`);
                
                const order = await this.exchangeManager.createOrder(
                    side, 
                    amount, 
                    price, 
                    'limit'
                );
                
                this.logger.info(`${side}单创建成功，使用数量: ${amount}`, {
                    orderId: order.id,
                    status: order.status
                });
                
                // 立即取消测试订单
                await this.exchangeManager.cancelOrder(order.id, symbol);
                this.logger.info(`${side}单已取消`);
                
                return true;
                
            } catch (error) {
                this.logger.warn(`${side}单创建失败，数量: ${amount}`, {
                    error: error.message
                });
            }
        }
        
        this.logger.error(`所有数量都失败，无法创建${side}单`);
        return false;
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            await this.exchangeManager.close();
            this.logger.info('测试完成，资源已清理');
        } catch (error) {
            this.logger.error('清理资源时出错', error);
        }
    }
}

// 主函数
async function main() {
    const tester = new SimpleOrderTester();
    
    try {
        await tester.runTest();
    } catch (error) {
        console.error('测试过程中发生严重错误:', error);
    } finally {
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = SimpleOrderTester; 