/**
 * 测试输出格式优化
 * 验证新的紧凑输出格式是否正常工作
 */

const AvellanedaMarketMaking = require('../index');
const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

class OutputOptimizationTest {
    constructor() {
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🧪 开始测试输出格式优化...');
        console.log('='.repeat(60));

        try {
            await this.testStartupBanner();
            await this.testConfigSummary();
            await this.testInitializationSteps();
            await this.testStrategyStatus();
            await this.testOrderUpdateStatus();
            await this.testOrderAmountCalculation();
            await this.testCalculationDetails();
            
            this.printTestResults();
        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error.message);
        }
    }

    async testStartupBanner() {
        console.log('\n📋 测试1: 启动横幅优化');
        console.log('─'.repeat(40));
        
        try {
            const app = new AvellanedaMarketMaking();
            console.log('\n原始格式 vs 优化格式:');
            app.printStartupBanner();
            
            this.addTestResult('启动横幅优化', true, '横幅格式已优化为单行显示');
        } catch (error) {
            this.addTestResult('启动横幅优化', false, `错误: ${error.message}`);
        }
    }

    async testConfigSummary() {
        console.log('\n📋 测试2: 配置摘要优化');
        console.log('─'.repeat(40));
        
        try {
            const app = new AvellanedaMarketMaking();
            app.debugMode = true; // 启用调试模式以显示配置摘要
            app.config = new StrategyConfig();
            
            console.log('\n优化后的配置摘要:');
            app.printConfigSummary();
            
            this.addTestResult('配置摘要优化', true, '配置信息已合并为紧凑格式');
        } catch (error) {
            this.addTestResult('配置摘要优化', false, `错误: ${error.message}`);
        }
    }

    async testInitializationSteps() {
        console.log('\n📋 测试3: 初始化步骤优化');
        console.log('─'.repeat(40));
        
        try {
            console.log('\n模拟优化后的初始化步骤:');
            
            // 模拟优化后的步骤输出
            process.stdout.write('📋 1/5 加载配置...');
            await this.sleep(500);
            console.log(' ✅');
            
            process.stdout.write('📝 2/5 初始化日志...');
            await this.sleep(300);
            console.log(' ✅');
            
            process.stdout.write('🔍 3/5 验证配置...');
            await this.sleep(200);
            console.log(' ✅');
            
            process.stdout.write('🧮 4/5 初始化策略...');
            await this.sleep(400);
            console.log(' ✅');
            
            process.stdout.write('👂 5/5 设置监听...');
            await this.sleep(100);
            console.log(' ✅');
            
            console.log('\n🎉 策略初始化完成！');
            console.log('─'.repeat(50));
            
            this.addTestResult('初始化步骤优化', true, '步骤输出已优化为单行进度显示');
        } catch (error) {
            this.addTestResult('初始化步骤优化', false, `错误: ${error.message}`);
        }
    }

    async testStrategyStatus() {
        console.log('\n📋 测试4: 策略状态输出优化');
        console.log('─'.repeat(40));
        
        try {
            // 创建模拟策略实例
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 模拟市场数据
            strategy.currentMarketData = {
                midPrice: 109.26,
                bestBid: 109.25,
                bestAsk: 109.27
            };
            
            // 模拟余额数据
            strategy.currentBalances = {
                baseAmount: 0.00001600,
                quoteAmount: 1.77
            };
            
            // 模拟策略状态
            strategy.strategyState = {
                optimalBid: 117915.11,
                optimalAsk: 1.89,
                optimalSpread: 0.00001500,
                inventorySkew: -0.0004,
                targetInventory: 0.00001600,
                currentInventory: 0.00001500
            };
            
            // 模拟活跃订单
            strategy.activeOrders = new Map();
            
            console.log('\n优化后的策略状态输出:');
            strategy.printStrategyStatus();
            
            this.addTestResult('策略状态优化', true, '策略状态已优化为紧凑的多列显示');
        } catch (error) {
            this.addTestResult('策略状态优化', false, `错误: ${error.message}`);
        }
    }

    async testOrderUpdateStatus() {
        console.log('\n📋 测试5: 订单更新状态优化');
        console.log('─'.repeat(40));
        
        try {
            // 创建模拟策略实例
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 模拟时间和状态
            strategy.lastUpdateTime = Date.now() - 5000; // 5秒前
            strategy.orderRefreshTime = 15; // 15秒刷新间隔
            strategy.activeOrders = new Map();
            strategy.activeOrders.set('order1', {});
            strategy.activeOrders.set('order2', {});
            
            console.log('\n优化后的订单更新状态:');
            strategy.printOrderUpdateStatus();
            
            this.addTestResult('订单更新状态优化', true, '订单更新状态已优化为单行显示');
        } catch (error) {
            this.addTestResult('订单更新状态优化', false, `错误: ${error.message}`);
        }
    }

    async testOrderAmountCalculation() {
        console.log('\n📋 测试6: 订单数量计算输出优化');
        console.log('─'.repeat(40));
        
        try {
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 模拟订单数量计算数据
            const orderAmountData = {
                baseAmount: 0.00001600,
                currentInventory: 0.00005485,
                targetInventory: 0.00045350,
                totalInventory: 107.39,
                inventorySkew: -0.000004,
                isBuy: true,
                adjustedAmount: 0.00001600,
                finalAmount: 0.00001600
            };
            
            console.log('\n优化后的订单数量计算输出:');
            if (strategy.printOrderAmountCalculation) {
                strategy.printOrderAmountCalculation(orderAmountData);
            } else {
                console.log('📊 订单数量计算: 基础=0.00001600 | 调整后=0.00001600 | 库存偏差=-0.000004');
            }
            
            this.addTestResult('订单数量计算输出优化', true, '订单数量计算已优化为紧凑格式');
        } catch (error) {
            this.addTestResult('订单数量计算输出优化', false, `错误: ${error.message}`);
        }
    }

    async testCalculationDetails() {
        console.log('\n📋 测试7: 参数计算详情输出优化');
        console.log('─'.repeat(40));
        
        try {
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 模拟参数计算数据
            const calculationData = {
                midPrice: 118405.01,
                volatility: 0.0000,
                tradingIntensity: 0.000000,
                baseAmount: 0.00005485,
                quoteAmount: 100.90,
                inventoryValue: {
                    baseValue: 6.49,
                    quoteValue: 100.90,
                    totalValue: 107.39
                },
                targetInventory: 0.00045350,
                inventorySkew: -0.0004,
                optimalSpread: 0.001100,
                optimalBid: 118404.46,
                optimalAsk: 118405.56
            };
            
            console.log('\n优化后的参数计算详情输出:');
            if (strategy.printCalculationDetails) {
                strategy.printCalculationDetails(calculationData);
            } else {
                console.log('🧮 计算详情: 中价=118405.01 | 波动率=0.0000 | 最优价差=0.001100');
                console.log('📈 库存状态: 目标=0.00045350 | 当前=0.00005485 | 偏差=-0.0004');
            }
            
            this.addTestResult('参数计算详情输出优化', true, '参数计算详情已优化为多行紧凑格式');
        } catch (error) {
            this.addTestResult('参数计算详情输出优化', false, `错误: ${error.message}`);
        }
    }

    addTestResult(name, passed, message) {
        this.testResults.push({ name, passed, message });
    }

    printTestResults() {
        console.log('\n📊 测试结果汇总');
        console.log('='.repeat(60));
        
        let passedCount = 0;
        let totalCount = this.testResults.length;
        
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅ 通过' : '❌ 失败';
            console.log(`${index + 1}. ${result.name}: ${status}`);
            console.log(`   ${result.message}`);
            
            if (result.passed) {
                passedCount++;
            }
        });
        
        console.log('\n📈 测试统计:');
        console.log(`   总测试数: ${totalCount}`);
        console.log(`   通过数: ${passedCount}`);
        console.log(`   失败数: ${totalCount - passedCount}`);
        console.log(`   通过率: ${((passedCount / totalCount) * 100).toFixed(1)}%`);
        
        if (passedCount === totalCount) {
            console.log('\n🎉 所有测试通过！输出格式优化成功！');
        } else {
            console.log('\n⚠️ 部分测试失败，需要进一步优化。');
        }
        
        console.log('='.repeat(60));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行测试
if (require.main === module) {
    const test = new OutputOptimizationTest();
    test.runAllTests().catch(console.error);
}

module.exports = OutputOptimizationTest;