/**
 * 测试停止策略修复
 * 验证停止策略时不再出现 TypeError: this.stopHealthCheck is not a function 错误
 */

const AvellanedaStrategy = require('../core/strategy');
const StrategyConfig = require('../config/strategy');
const Logger = require('../utils/logger');

class StopStrategyFixTest {
    constructor() {
        this.testResults = [];
        this.strategy = null;
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('\n🧪 开始测试停止策略修复');
        console.log('='.repeat(60));
        
        try {
            await this.testStrategyStopMethod();
            await this.testStrategyStopWithoutRunning();
            await this.testStrategyStopMultipleTimes();
            
            this.printTestResults();
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error.message);
            if (error.stack) {
                console.error('错误堆栈:', error.stack);
            }
        } finally {
            await this.cleanup();
        }
    }

    /**
     * 测试1: 验证策略stop方法不再调用stopHealthCheck
     */
    async testStrategyStopMethod() {
        console.log('\n📋 测试1: 验证策略stop方法修复');
        console.log('─'.repeat(50));
        
        try {
            // 创建策略实例
            const config = new StrategyConfig();
            this.strategy = new AvellanedaStrategy(config);
            
            // 模拟策略运行状态
            this.strategy.isRunning = true;
            this.strategy.isShuttingDown = false;
            this.strategy.startTime = Date.now();
            
            console.log('✅ 策略实例创建成功');
            
            // 尝试停止策略
            console.log('🛑 尝试停止策略...');
            await this.strategy.stop();
            
            console.log('✅ 策略停止成功，没有出现TypeError错误');
            this.addTestResult('策略stop方法修复', true, '成功停止策略，没有调用不存在的stopHealthCheck方法');
            
        } catch (error) {
            if (error.message.includes('stopHealthCheck is not a function')) {
                console.error('❌ 仍然存在stopHealthCheck错误');
                this.addTestResult('策略stop方法修复', false, `仍然存在错误: ${error.message}`);
            } else {
                console.log('✅ 没有stopHealthCheck错误，但有其他错误（这是正常的）:', error.message);
                this.addTestResult('策略stop方法修复', true, '没有stopHealthCheck错误');
            }
        }
    }

    /**
     * 测试2: 测试未运行状态下停止策略
     */
    async testStrategyStopWithoutRunning() {
        console.log('\n📋 测试2: 测试未运行状态下停止策略');
        console.log('─'.repeat(50));
        
        try {
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 策略未运行状态
            strategy.isRunning = false;
            strategy.isShuttingDown = false;
            
            console.log('🛑 尝试停止未运行的策略...');
            await strategy.stop();
            
            console.log('✅ 成功处理未运行状态的停止请求');
            this.addTestResult('未运行状态停止', true, '正确处理未运行状态');
            
        } catch (error) {
            if (error.message.includes('stopHealthCheck is not a function')) {
                console.error('❌ 仍然存在stopHealthCheck错误');
                this.addTestResult('未运行状态停止', false, `存在错误: ${error.message}`);
            } else {
                console.log('✅ 没有stopHealthCheck错误');
                this.addTestResult('未运行状态停止', true, '没有stopHealthCheck错误');
            }
        }
    }

    /**
     * 测试3: 测试多次停止策略
     */
    async testStrategyStopMultipleTimes() {
        console.log('\n📋 测试3: 测试多次停止策略');
        console.log('─'.repeat(50));
        
        try {
            const config = new StrategyConfig();
            const strategy = new AvellanedaStrategy(config);
            
            // 模拟策略运行状态
            strategy.isRunning = true;
            strategy.isShuttingDown = false;
            strategy.startTime = Date.now();
            
            console.log('🛑 第一次停止策略...');
            await strategy.stop();
            
            console.log('🛑 第二次停止策略...');
            await strategy.stop();
            
            console.log('✅ 多次停止策略成功，没有出现错误');
            this.addTestResult('多次停止策略', true, '成功处理多次停止请求');
            
        } catch (error) {
            if (error.message.includes('stopHealthCheck is not a function')) {
                console.error('❌ 仍然存在stopHealthCheck错误');
                this.addTestResult('多次停止策略', false, `存在错误: ${error.message}`);
            } else {
                console.log('✅ 没有stopHealthCheck错误');
                this.addTestResult('多次停止策略', true, '没有stopHealthCheck错误');
            }
        }
    }

    /**
     * 添加测试结果
     */
    addTestResult(testName, passed, message) {
        this.testResults.push({
            name: testName,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 打印测试结果
     */
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
        
        console.log('\n' + '─'.repeat(60));
        console.log(`📈 总计: ${passedCount}/${totalCount} 个测试通过`);
        
        if (passedCount === totalCount) {
            console.log('🎉 所有测试通过！stopHealthCheck错误已修复');
        } else {
            console.log('⚠️ 部分测试失败，需要进一步检查');
        }
    }

    /**
     * 清理测试环境
     */
    async cleanup() {
        try {
            if (this.strategy) {
                // 确保策略完全停止
                this.strategy.isRunning = false;
                this.strategy.isShuttingDown = false;
            }
            console.log('\n🧹 测试环境已清理');
        } catch (error) {
            console.error('清理测试环境时出错:', error.message);
        }
    }
}

// 运行测试
async function main() {
    const tester = new StopStrategyFixTest();
    await tester.runAllTests();
}

if (require.main === module) {
    main();
}

module.exports = StopStrategyFixTest;