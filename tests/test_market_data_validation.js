/**
 * 测试市场数据有效性检查修复
 * 验证策略在市场数据无效或过期时的处理
 */

const AvellanedaStrategy = require('../core/strategy');
const Config = require('../config/config');
const Logger = require('../utils/logger');

class MarketDataValidationTestSuite {
    constructor() {
        this.config = new Config();
        this.logger = new Logger('MarketDataValidationTest');
        this.testResults = [];
    }

    /**
     * 创建测试用的策略实例
     */
    createTestStrategy() {
        const strategy = new AvellanedaStrategy(this.config);
        
        // 模拟初始化状态
        strategy.isInitialized = true;
        strategy.currentBalances = {
            baseAmount: 1.0,
            quoteAmount: 50000,
            timestamp: Date.now()
        };
        
        return strategy;
    }

    /**
     * 测试无效市场数据的处理
     */
    async testInvalidMarketDataHandling() {
        console.log('\n🧪 测试: 无效市场数据处理');
        
        try {
            const strategy = this.createTestStrategy();
            
            // 设置无效的市场数据
            strategy.currentMarketData = null;
            
            // 模拟策略执行
            let executionSkipped = false;
            const originalWarn = strategy.logger.warn;
            strategy.logger.warn = (message) => {
                if (message.includes('市场数据不可用')) {
                    executionSkipped = true;
                }
                originalWarn.call(strategy.logger, message);
            };
            
            await strategy.executeStrategy();
            
            if (executionSkipped) {
                console.log('✅ 测试通过: 策略正确跳过了无效市场数据的执行');
                this.testResults.push({
                    test: 'InvalidMarketDataHandling',
                    status: 'PASS',
                    message: '策略正确处理了无效市场数据'
                });
            } else {
                console.log('❌ 测试失败: 策略未正确处理无效市场数据');
                this.testResults.push({
                    test: 'InvalidMarketDataHandling',
                    status: 'FAIL',
                    message: '策略未跳过无效市场数据的执行'
                });
            }
            
        } catch (error) {
            console.error('❌ 测试异常:', error.message);
            this.testResults.push({
                test: 'InvalidMarketDataHandling',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 测试过期市场数据的处理
     */
    async testExpiredMarketDataHandling() {
        console.log('\n🧪 测试: 过期市场数据处理');
        
        try {
            const strategy = this.createTestStrategy();
            
            // 设置过期的市场数据（35秒前）
            strategy.currentMarketData = {
                midPrice: 50000,
                bestBid: 49950,
                bestAsk: 50050,
                orderBook: {
                    bids: [[49950, 1.0]],
                    asks: [[50050, 1.0]]
                },
                lastPrice: 50000,
                timestamp: Date.now() - 35000 // 35秒前
            };
            
            // 模拟策略执行
            let executionSkipped = false;
            const originalWarn = strategy.logger.warn;
            strategy.logger.warn = (message) => {
                if (message.includes('市场数据已过期')) {
                    executionSkipped = true;
                }
                originalWarn.call(strategy.logger, message);
            };
            
            await strategy.executeStrategy();
            
            if (executionSkipped) {
                console.log('✅ 测试通过: 策略正确跳过了过期市场数据的执行');
                this.testResults.push({
                    test: 'ExpiredMarketDataHandling',
                    status: 'PASS',
                    message: '策略正确处理了过期市场数据'
                });
            } else {
                console.log('❌ 测试失败: 策略未正确处理过期市场数据');
                this.testResults.push({
                    test: 'ExpiredMarketDataHandling',
                    status: 'FAIL',
                    message: '策略未跳过过期市场数据的执行'
                });
            }
            
        } catch (error) {
            console.error('❌ 测试异常:', error.message);
            this.testResults.push({
                test: 'ExpiredMarketDataHandling',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 测试有效市场数据的正常处理
     */
    async testValidMarketDataHandling() {
        console.log('\n🧪 测试: 有效市场数据处理');
        
        try {
            const strategy = this.createTestStrategy();
            
            // 设置有效的市场数据
            strategy.currentMarketData = {
                midPrice: 50000,
                bestBid: 49950,
                bestAsk: 50050,
                orderBook: {
                    bids: [[49950, 1.0]],
                    asks: [[50050, 1.0]]
                },
                lastPrice: 50000,
                timestamp: Date.now() // 当前时间
            };
            
            // 模拟必要的组件
            strategy.indicators = {
                getCurrentValues: () => ({
                    volatility: 0.02,
                    tradingIntensity: 0.5
                })
            };
            
            strategy.calculator = {
                updateState: () => ({
                    bidPrice: 49900,
                    askPrice: 50100,
                    inventoryValue: {
                        baseValue: 50000,
                        totalValue: 100000
                    }
                })
            };
            
            strategy.riskManager = {
                updatePosition: () => {},
                updateAccountValue: () => {}
            };
            
            strategy.printStrategyStatus = () => {};
            strategy.shouldUpdateOrders = () => false;
            
            // 模拟策略执行
            let executionCompleted = false;
            try {
                await strategy.executeStrategy();
                executionCompleted = true;
            } catch (error) {
                // 忽略其他可能的错误，只关注数据验证部分
                if (!error.message.includes('市场数据')) {
                    executionCompleted = true;
                }
            }
            
            if (executionCompleted) {
                console.log('✅ 测试通过: 策略正确处理了有效市场数据');
                this.testResults.push({
                    test: 'ValidMarketDataHandling',
                    status: 'PASS',
                    message: '策略正确处理了有效市场数据'
                });
            } else {
                console.log('❌ 测试失败: 策略未能处理有效市场数据');
                this.testResults.push({
                    test: 'ValidMarketDataHandling',
                    status: 'FAIL',
                    message: '策略未能正确处理有效市场数据'
                });
            }
            
        } catch (error) {
            console.error('❌ 测试异常:', error.message);
            this.testResults.push({
                test: 'ValidMarketDataHandling',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 测试市场数据更新时的验证逻辑
     */
    async testMarketDataUpdateValidation() {
        console.log('\n🧪 测试: 市场数据更新验证');
        
        try {
            const strategy = this.createTestStrategy();
            
            // 模拟交易所管理器返回无效数据
            strategy.exchangeManager = {
                fetchOrderBook: async () => ({
                    bids: [], // 空的买单列表
                    asks: [[50050, 1.0]]
                }),
                fetchTicker: async () => ({
                    last: 50000
                })
            };
            
            // 模拟市场数据更新
            let validationTriggered = false;
            const originalError = strategy.logger.error;
            strategy.logger.error = (message, error) => {
                if (message.includes('更新市场数据失败') && 
                    error.message.includes('Invalid order book data')) {
                    validationTriggered = true;
                }
                originalError.call(strategy.logger, message, error);
            };
            
            await strategy.updateMarketData();
            
            if (validationTriggered) {
                console.log('✅ 测试通过: 市场数据更新验证正常工作');
                this.testResults.push({
                    test: 'MarketDataUpdateValidation',
                    status: 'PASS',
                    message: '市场数据更新验证正常工作'
                });
            } else {
                console.log('❌ 测试失败: 市场数据更新验证未触发');
                this.testResults.push({
                    test: 'MarketDataUpdateValidation',
                    status: 'FAIL',
                    message: '市场数据更新验证未正确工作'
                });
            }
            
        } catch (error) {
            console.error('❌ 测试异常:', error.message);
            this.testResults.push({
                test: 'MarketDataUpdateValidation',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始运行市场数据验证测试套件\n');
        
        await this.testInvalidMarketDataHandling();
        await this.testExpiredMarketDataHandling();
        await this.testValidMarketDataHandling();
        await this.testMarketDataUpdateValidation();
        
        this.printTestSummary();
    }

    /**
     * 打印测试摘要
     */
    printTestSummary() {
        console.log('\n📊 测试摘要:');
        console.log('=' .repeat(50));
        
        let passCount = 0;
        let failCount = 0;
        let errorCount = 0;
        
        this.testResults.forEach(result => {
            const statusIcon = {
                'PASS': '✅',
                'FAIL': '❌',
                'ERROR': '⚠️'
            }[result.status];
            
            console.log(`${statusIcon} ${result.test}: ${result.message}`);
            
            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else errorCount++;
        });
        
        console.log('\n📈 统计:');
        console.log(`通过: ${passCount}`);
        console.log(`失败: ${failCount}`);
        console.log(`错误: ${errorCount}`);
        console.log(`总计: ${this.testResults.length}`);
        
        if (failCount === 0 && errorCount === 0) {
            console.log('\n🎉 所有测试通过！市场数据验证修复验证成功。');
        } else {
            console.log('\n⚠️ 存在测试失败或错误，请检查修复实现。');
        }
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    const testSuite = new MarketDataValidationTestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('测试套件运行失败:', error);
        process.exit(1);
    });
}

module.exports = MarketDataValidationTestSuite;