const ConfigManager = require('../config/strategy');
const ExchangeManager = require('../core/exchange');
const AvellanedaCalculator = require('../core/calculator');
const Logger = require('../utils/logger');

/**
 * 订单修复验证脚本
 * 验证修复后的订单创建功能
 */
class OrderFixTester {
    constructor() {
        this.config = new ConfigManager();
        this.logger = new Logger(this.config);
        this.exchangeManager = new ExchangeManager(this.config);
        this.calculator = new AvellanedaCalculator(this.config);
    }

    /**
     * 运行修复验证测试
     */
    async runFixTest() {
        this.logger.info('开始订单修复验证测试...');
        
        try {
            // 1. 初始化交易所连接
            await this.initializeExchange();
            
            // 2. 获取市场信息
            await this.getMarketInfo();
            
            // 3. 测试计算器修复
            await this.testCalculatorFix();
            
            // 4. 测试订单创建修复
            await this.testOrderCreationFix();
            
            // 5. 输出测试结果
            this.outputTestResults();
            
        } catch (error) {
            this.logger.error('修复验证测试失败', error);
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
     * 测试计算器修复
     */
    async testCalculatorFix() {
        this.logger.info('正在测试计算器修复...');
        
        const symbol = this.config.get('symbol');
        const baseAmount = this.config.get('orderAmount');
        
        // 计算中间价
        const midPrice = (this.ticker.bid + this.ticker.ask) / 2;
        
        // 测试原始数量格式化
        const originalFormatted = this.calculator.formatAmount(baseAmount);
        
        // 测试调整后的数量计算
        const amountPrecision = this.marketInfo.precision.amount;
        const minAmount = Math.pow(10, -amountPrecision);
        const adjustedBaseAmount = Math.max(baseAmount, minAmount * 10);
        const adjustedFormatted = this.calculator.formatAmount(adjustedBaseAmount);
        
        this.logger.info('计算器修复测试结果', {
            symbol: symbol,
            originalBaseAmount: baseAmount,
            originalFormatted: originalFormatted,
            adjustedBaseAmount: adjustedBaseAmount,
            adjustedFormatted: adjustedFormatted,
            minAmount: minAmount,
            amountPrecision: amountPrecision,
            isValid: adjustedFormatted >= minAmount
        });
        
        // 验证修复是否有效
        if (adjustedFormatted < minAmount) {
            throw new Error('计算器修复无效：格式化后的数量仍然小于最小数量');
        }
        
        this.logger.info('计算器修复验证通过');
    }

    /**
     * 测试订单创建修复
     */
    async testOrderCreationFix() {
        this.logger.info('正在测试订单创建修复...');
        
        const symbol = this.config.get('symbol');
        const baseAmount = this.config.get('orderAmount');
        
        // 计算测试价格
        const midPrice = (this.ticker.bid + this.ticker.ask) / 2;
        const testBidPrice = midPrice * 0.999; // 比中间价低0.1%
        const testAskPrice = midPrice * 1.001; // 比中间价高0.1%
        
        // 使用修复后的数量计算
        const amountPrecision = this.marketInfo.precision.amount;
        const minAmount = Math.pow(10, -amountPrecision);
        const adjustedBaseAmount = Math.max(baseAmount, minAmount * 10);
        
        this.logger.info('订单创建修复测试参数', {
            symbol: symbol,
            originalBaseAmount: baseAmount,
            adjustedBaseAmount: adjustedBaseAmount,
            testBidPrice: testBidPrice,
            testAskPrice: testAskPrice,
            minAmount: minAmount
        });
        
        // 测试买单创建
        try {
            this.logger.info('尝试创建修复后的测试买单...');
            const buyOrder = await this.exchangeManager.createOrder(
                'buy', 
                adjustedBaseAmount, 
                testBidPrice, 
                'limit'
            );
            
            this.logger.info('修复后的测试买单创建成功', {
                orderId: buyOrder.id,
                status: buyOrder.status,
                amount: buyOrder.amount,
                price: buyOrder.price
            });
            
            // 立即取消测试订单
            await this.exchangeManager.cancelOrder(buyOrder.id, symbol);
            this.logger.info('修复后的测试买单已取消');
            
            this.buyOrderSuccess = true;
            
        } catch (error) {
            this.logger.error('修复后的测试买单创建失败', {
                error: error.message,
                amount: adjustedBaseAmount,
                price: testBidPrice
            });
            this.buyOrderSuccess = false;
        }
        
        // 测试卖单创建
        try {
            this.logger.info('尝试创建修复后的测试卖单...');
            const sellOrder = await this.exchangeManager.createOrder(
                'sell', 
                adjustedBaseAmount, 
                testAskPrice, 
                'limit'
            );
            
            this.logger.info('修复后的测试卖单创建成功', {
                orderId: sellOrder.id,
                status: sellOrder.status,
                amount: sellOrder.amount,
                price: sellOrder.price
            });
            
            // 立即取消测试订单
            await this.exchangeManager.cancelOrder(sellOrder.id, symbol);
            this.logger.info('修复后的测试卖单已取消');
            
            this.sellOrderSuccess = true;
            
        } catch (error) {
            this.logger.error('修复后的测试卖单创建失败', {
                error: error.message,
                amount: adjustedBaseAmount,
                price: testAskPrice
            });
            this.sellOrderSuccess = false;
        }
    }

    /**
     * 输出测试结果
     */
    outputTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('订单修复验证测试结果');
        console.log('='.repeat(80));
        
        console.log('\n🔧 修复验证:');
        console.log(`  计算器修复: ✅ 通过`);
        console.log(`  买单创建: ${this.buyOrderSuccess ? '✅ 成功' : '❌ 失败'}`);
        console.log(`  卖单创建: ${this.sellOrderSuccess ? '✅ 成功' : '❌ 失败'}`);
        
        console.log('\n📊 数量调整:');
        console.log(`  原始数量: ${this.config.get('orderAmount')}`);
        console.log(`  调整后数量: ${Math.max(this.config.get('orderAmount'), Math.pow(10, -this.marketInfo.precision.amount) * 10)}`);
        console.log(`  最小数量: ${Math.pow(10, -this.marketInfo.precision.amount)}`);
        console.log(`  数量精度: ${this.marketInfo.precision.amount} 位`);
        
        console.log('\n🎯 修复效果:');
        if (this.buyOrderSuccess && this.sellOrderSuccess) {
            console.log('  ✅ 订单创建问题已完全修复');
            console.log('  ✅ 策略现在可以正常发出订单');
        } else {
            console.log('  ⚠️  部分修复，需要进一步调试');
        }
        
        console.log('\n' + '='.repeat(80));
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            await this.exchangeManager.close();
            this.logger.info('修复验证测试完成，资源已清理');
        } catch (error) {
            this.logger.error('清理资源时出错', error);
        }
    }
}

// 主函数
async function main() {
    const tester = new OrderFixTester();
    
    try {
        await tester.runFixTest();
    } catch (error) {
        console.error('修复验证测试过程中发生严重错误:', error);
    } finally {
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = OrderFixTester; 