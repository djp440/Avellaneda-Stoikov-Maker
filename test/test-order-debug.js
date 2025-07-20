const ConfigManager = require('../config/strategy');
const ExchangeManager = require('../core/exchange');
const Logger = require('../utils/logger');

/**
 * 订单调试脚本
 * 用于诊断订单无法发出的问题
 */
class OrderDebugger {
    constructor() {
        this.config = new ConfigManager();
        this.logger = new Logger(this.config);
        this.exchangeManager = new ExchangeManager(this.config);
        this.debugResults = {
            connection: {},
            marketData: {},
            accountData: {},
            orderCreation: {},
            errors: []
        };
    }

    /**
     * 运行完整调试
     */
    async runFullDebug() {
        this.logger.info('开始订单调试诊断...');
        
        try {
            // 1. 检查配置
            await this.debugConfiguration();
            
            // 2. 检查网络连接
            await this.debugNetworkConnection();
            
            // 3. 检查交易所连接
            await this.debugExchangeConnection();
            
            // 4. 检查市场数据
            await this.debugMarketData();
            
            // 5. 检查账户数据
            await this.debugAccountData();
            
            // 6. 检查订单创建
            await this.debugOrderCreation();
            
            // 7. 输出调试结果
            this.outputDebugResults();
            
        } catch (error) {
            this.logger.error('调试过程中发生错误', error);
            this.debugResults.errors.push({
                step: 'main',
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 调试配置
     */
    async debugConfiguration() {
        this.logger.info('=== 调试配置信息 ===');
        
        try {
            const exchangeConfig = this.config.get('exchange');
            const symbol = this.config.get('symbol');
            const orderAmount = this.config.get('orderAmount');
            
            this.debugResults.config = {
                exchange: exchangeConfig,
                symbol: symbol,
                orderAmount: orderAmount,
                hasApiKey: !!exchangeConfig.apiKey,
                hasSecret: !!exchangeConfig.secret,
                hasPassphrase: !!exchangeConfig.passphrase
            };
            
            this.logger.info('配置信息', this.debugResults.config);
            
            // 检查必要的配置
            if (!exchangeConfig.apiKey || !exchangeConfig.secret) {
                throw new Error('缺少API密钥配置');
            }
            
            if (!symbol) {
                throw new Error('缺少交易对配置');
            }
            
            if (!orderAmount || orderAmount <= 0) {
                throw new Error('订单数量配置无效');
            }
            
        } catch (error) {
            this.logger.error('配置调试失败', error);
            this.debugResults.errors.push({
                step: 'configuration',
                error: error.message
            });
        }
    }

    /**
     * 调试网络连接
     */
    async debugNetworkConnection() {
        this.logger.info('=== 调试网络连接 ===');
        
        try {
            const networkManager = this.exchangeManager.networkManager;
            const isAvailable = networkManager.isNetworkAvailable();
            
            this.debugResults.connection.networkAvailable = isAvailable;
            
            this.logger.info('网络连接状态', {
                available: isAvailable,
                lastCheck: networkManager.lastCheckTime
            });
            
            if (!isAvailable) {
                throw new Error('网络连接不可用');
            }
            
        } catch (error) {
            this.logger.error('网络连接调试失败', error);
            this.debugResults.errors.push({
                step: 'network',
                error: error.message
            });
        }
    }

    /**
     * 调试交易所连接
     */
    async debugExchangeConnection() {
        this.logger.info('=== 调试交易所连接 ===');
        
        try {
            // 初始化交易所连接
            const initialized = await this.exchangeManager.initialize();
            
            this.debugResults.connection.exchangeInitialized = initialized;
            this.debugResults.connection.isConnected = this.exchangeManager.isConnected;
            this.debugResults.connection.exchangeName = this.exchangeManager.exchangeName;
            
            this.logger.info('交易所连接状态', {
                initialized: initialized,
                connected: this.exchangeManager.isConnected,
                exchange: this.exchangeManager.exchangeName
            });
            
            if (!initialized) {
                throw new Error('交易所连接初始化失败');
            }
            
            // 测试连接
            await this.exchangeManager.testConnection();
            this.logger.info('交易所连接测试成功');
            
        } catch (error) {
            this.logger.error('交易所连接调试失败', error);
            this.debugResults.errors.push({
                step: 'exchange_connection',
                error: error.message
            });
        }
    }

    /**
     * 调试市场数据
     */
    async debugMarketData() {
        this.logger.info('=== 调试市场数据 ===');
        
        try {
            // 获取订单簿数据
            const orderBook = this.exchangeManager.getOrderBook();
            this.debugResults.marketData.orderBook = {
                hasData: !!orderBook,
                bidsCount: orderBook ? orderBook.bids.length : 0,
                asksCount: orderBook ? orderBook.asks.length : 0,
                bestBid: orderBook && orderBook.bids.length > 0 ? orderBook.bids[0][0] : null,
                bestAsk: orderBook && orderBook.asks.length > 0 ? orderBook.asks[0][0] : null
            };
            
            // 获取价格数据
            const ticker = this.exchangeManager.getTicker();
            this.debugResults.marketData.ticker = {
                hasData: !!ticker,
                last: ticker ? ticker.last : null,
                bid: ticker ? ticker.bid : null,
                ask: ticker ? ticker.ask : null
            };
            
            // 获取市场信息
            const marketInfo = this.exchangeManager.getMarketInfo();
            this.debugResults.marketData.marketInfo = {
                hasData: !!marketInfo,
                precision: marketInfo ? marketInfo.precision : null,
                limits: marketInfo ? marketInfo.limits : null
            };
            
            this.logger.info('市场数据状态', {
                orderBook: this.debugResults.marketData.orderBook,
                ticker: this.debugResults.marketData.ticker,
                marketInfo: this.debugResults.marketData.marketInfo
            });
            
            // 检查数据有效性
            if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
                throw new Error('订单簿数据无效');
            }
            
            if (!ticker || !ticker.last) {
                throw new Error('价格数据无效');
            }
            
            if (!marketInfo || !marketInfo.precision) {
                throw new Error('市场信息无效');
            }
            
        } catch (error) {
            this.logger.error('市场数据调试失败', error);
            this.debugResults.errors.push({
                step: 'market_data',
                error: error.message
            });
        }
    }

    /**
     * 调试账户数据
     */
    async debugAccountData() {
        this.logger.info('=== 调试账户数据 ===');
        
        try {
            // 获取余额数据
            const balances = this.exchangeManager.getBalances();
            const symbol = this.config.get('symbol');
            const [baseCurrency, quoteCurrency] = symbol.split('/');
            
            this.debugResults.accountData.balances = {
                hasData: !!balances,
                baseCurrency: baseCurrency,
                quoteCurrency: quoteCurrency,
                baseBalance: balances && balances[baseCurrency] ? balances[baseCurrency].free : 0,
                quoteBalance: balances && balances[quoteCurrency] ? balances[quoteCurrency].free : 0
            };
            
            this.logger.info('账户数据状态', this.debugResults.accountData.balances);
            
            // 检查余额
            const baseBalance = this.debugResults.accountData.balances.baseBalance;
            const quoteBalance = this.debugResults.accountData.balances.quoteBalance;
            
            if (baseBalance <= 0 && quoteBalance <= 0) {
                throw new Error('账户余额不足');
            }
            
        } catch (error) {
            this.logger.error('账户数据调试失败', error);
            this.debugResults.errors.push({
                step: 'account_data',
                error: error.message
            });
        }
    }

    /**
     * 调试订单创建
     */
    async debugOrderCreation() {
        this.logger.info('=== 调试订单创建 ===');
        
        try {
            const symbol = this.config.get('symbol');
            const orderAmount = this.config.get('orderAmount');
            
            // 获取当前市场价格
            const ticker = this.exchangeManager.getTicker();
            const orderBook = this.exchangeManager.getOrderBook();
            
            if (!ticker || !orderBook) {
                throw new Error('无法获取市场价格数据');
            }
            
            // 计算测试订单价格
            const midPrice = (ticker.bid + ticker.ask) / 2;
            const testBidPrice = midPrice * 0.999; // 比中间价低0.1%
            const testAskPrice = midPrice * 1.001; // 比中间价高0.1%
            
            this.debugResults.orderCreation.testPrices = {
                midPrice: midPrice,
                testBidPrice: testBidPrice,
                testAskPrice: testAskPrice,
                orderAmount: orderAmount
            };
            
            this.logger.info('测试订单价格', this.debugResults.orderCreation.testPrices);
            
            // 测试创建买单
            try {
                this.logger.info('尝试创建测试买单...');
                const buyOrder = await this.exchangeManager.createOrder(
                    'buy', 
                    orderAmount, 
                    testBidPrice, 
                    'limit'
                );
                
                this.debugResults.orderCreation.buyOrder = {
                    success: true,
                    orderId: buyOrder.id,
                    status: buyOrder.status
                };
                
                this.logger.info('测试买单创建成功', {
                    orderId: buyOrder.id,
                    status: buyOrder.status
                });
                
                // 立即取消测试订单
                await this.exchangeManager.cancelOrder(buyOrder.id, symbol);
                this.logger.info('测试买单已取消');
                
            } catch (error) {
                this.debugResults.orderCreation.buyOrder = {
                    success: false,
                    error: error.message
                };
                
                this.logger.error('测试买单创建失败', error);
            }
            
            // 测试创建卖单
            try {
                this.logger.info('尝试创建测试卖单...');
                const sellOrder = await this.exchangeManager.createOrder(
                    'sell', 
                    orderAmount, 
                    testAskPrice, 
                    'limit'
                );
                
                this.debugResults.orderCreation.sellOrder = {
                    success: true,
                    orderId: sellOrder.id,
                    status: sellOrder.status
                };
                
                this.logger.info('测试卖单创建成功', {
                    orderId: sellOrder.id,
                    status: sellOrder.status
                });
                
                // 立即取消测试订单
                await this.exchangeManager.cancelOrder(sellOrder.id, symbol);
                this.logger.info('测试卖单已取消');
                
            } catch (error) {
                this.debugResults.orderCreation.sellOrder = {
                    success: false,
                    error: error.message
                };
                
                this.logger.error('测试卖单创建失败', error);
            }
            
        } catch (error) {
            this.logger.error('订单创建调试失败', error);
            this.debugResults.errors.push({
                step: 'order_creation',
                error: error.message
            });
        }
    }

    /**
     * 输出调试结果
     */
    outputDebugResults() {
        this.logger.info('=== 调试结果汇总 ===');
        
        console.log('\n' + '='.repeat(80));
        console.log('订单调试诊断结果');
        console.log('='.repeat(80));
        
        // 配置检查
        console.log('\n📋 配置检查:');
        console.log(`  交易所: ${this.debugResults.config?.exchange?.name || 'N/A'}`);
        console.log(`  交易对: ${this.debugResults.config?.symbol || 'N/A'}`);
        console.log(`  API密钥: ${this.debugResults.config?.hasApiKey ? '✅' : '❌'}`);
        console.log(`  密钥: ${this.debugResults.config?.hasSecret ? '✅' : '❌'}`);
        console.log(`  密码: ${this.debugResults.config?.hasPassphrase ? '✅' : '❌'}`);
        
        // 连接检查
        console.log('\n🌐 连接检查:');
        console.log(`  网络连接: ${this.debugResults.connection?.networkAvailable ? '✅' : '❌'}`);
        console.log(`  交易所连接: ${this.debugResults.connection?.exchangeInitialized ? '✅' : '❌'}`);
        console.log(`  连接状态: ${this.debugResults.connection?.isConnected ? '✅' : '❌'}`);
        
        // 市场数据检查
        console.log('\n📊 市场数据检查:');
        console.log(`  订单簿数据: ${this.debugResults.marketData?.orderBook?.hasData ? '✅' : '❌'}`);
        console.log(`  价格数据: ${this.debugResults.marketData?.ticker?.hasData ? '✅' : '❌'}`);
        console.log(`  市场信息: ${this.debugResults.marketData?.marketInfo?.hasData ? '✅' : '❌'}`);
        
        if (this.debugResults.marketData?.orderBook?.hasData) {
            console.log(`  最佳买价: ${this.debugResults.marketData.orderBook.bestBid}`);
            console.log(`  最佳卖价: ${this.debugResults.marketData.orderBook.bestAsk}`);
        }
        
        // 账户数据检查
        console.log('\n💰 账户数据检查:');
        console.log(`  余额数据: ${this.debugResults.accountData?.balances?.hasData ? '✅' : '❌'}`);
        if (this.debugResults.accountData?.balances?.hasData) {
            console.log(`  ${this.debugResults.accountData.balances.baseCurrency}: ${this.debugResults.accountData.balances.baseBalance}`);
            console.log(`  ${this.debugResults.accountData.balances.quoteCurrency}: ${this.debugResults.accountData.balances.quoteBalance}`);
        }
        
        // 订单创建检查
        console.log('\n📝 订单创建检查:');
        console.log(`  买单测试: ${this.debugResults.orderCreation?.buyOrder?.success ? '✅' : '❌'}`);
        console.log(`  卖单测试: ${this.debugResults.orderCreation?.sellOrder?.success ? '✅' : '❌'}`);
        
        if (!this.debugResults.orderCreation?.buyOrder?.success) {
            console.log(`  买单错误: ${this.debugResults.orderCreation?.buyOrder?.error}`);
        }
        
        if (!this.debugResults.orderCreation?.sellOrder?.success) {
            console.log(`  卖单错误: ${this.debugResults.orderCreation?.sellOrder?.error}`);
        }
        
        // 错误汇总
        if (this.debugResults.errors.length > 0) {
            console.log('\n❌ 错误汇总:');
            this.debugResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. [${error.step}] ${error.error}`);
            });
        }
        
        // 问题诊断
        console.log('\n🔍 问题诊断:');
        this.diagnoseProblems();
        
        console.log('\n' + '='.repeat(80));
    }

    /**
     * 诊断问题
     */
    diagnoseProblems() {
        const problems = [];
        
        // 检查配置问题
        if (!this.debugResults.config?.hasApiKey || !this.debugResults.config?.hasSecret) {
            problems.push('API密钥配置不完整');
        }
        
        // 检查连接问题
        if (!this.debugResults.connection?.networkAvailable) {
            problems.push('网络连接不可用');
        }
        
        if (!this.debugResults.connection?.exchangeInitialized) {
            problems.push('交易所连接初始化失败');
        }
        
        // 检查市场数据问题
        if (!this.debugResults.marketData?.orderBook?.hasData) {
            problems.push('无法获取订单簿数据');
        }
        
        if (!this.debugResults.marketData?.ticker?.hasData) {
            problems.push('无法获取价格数据');
        }
        
        // 检查账户问题
        if (!this.debugResults.accountData?.balances?.hasData) {
            problems.push('无法获取账户余额');
        }
        
        if (this.debugResults.accountData?.balances?.baseBalance <= 0 && 
            this.debugResults.accountData?.balances?.quoteBalance <= 0) {
            problems.push('账户余额不足');
        }
        
        // 检查订单创建问题
        if (!this.debugResults.orderCreation?.buyOrder?.success) {
            problems.push('买单创建失败');
        }
        
        if (!this.debugResults.orderCreation?.sellOrder?.success) {
            problems.push('卖单创建失败');
        }
        
        if (problems.length === 0) {
            console.log('  ✅ 未发现明显问题，订单创建功能正常');
        } else {
            problems.forEach((problem, index) => {
                console.log(`  ${index + 1}. ${problem}`);
            });
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            await this.exchangeManager.close();
            this.logger.info('调试器资源已清理');
        } catch (error) {
            this.logger.error('清理资源时出错', error);
        }
    }
}

// 主函数
async function main() {
    const orderDebugger = new OrderDebugger();
    
    try {
        await orderDebugger.runFullDebug();
    } catch (error) {
        console.error('调试过程中发生严重错误:', error);
    } finally {
        await orderDebugger.cleanup();
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = OrderDebugger; 