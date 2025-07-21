/**
 * 测试重连机制修复
 * 验证网络恢复后重试计数器是否正确重置
 */

const ExchangeManager = require('../core/exchange');
const Config = require('../config/config');
const Logger = require('../utils/logger');

class ReconnectTestSuite {
    constructor() {
        this.config = new Config();
        this.logger = new Logger('ReconnectTest');
        this.testResults = [];
    }

    /**
     * 测试网络恢复后重试计数器重置
     */
    async testRetryCounterReset() {
        console.log('\n🧪 测试: 网络恢复后重试计数器重置');
        
        try {
            // 创建交易所管理器实例
            const exchangeManager = new ExchangeManager(this.config);
            
            // 模拟连接失败，增加重试计数
            exchangeManager.connectionRetryCount = 3;
            console.log(`初始重试计数: ${exchangeManager.connectionRetryCount}`);
            
            // 模拟网络连接恢复
            await exchangeManager.handleNetworkConnectionRestored();
            
            // 检查重试计数器是否被重置
            const resetCount = exchangeManager.connectionRetryCount;
            console.log(`网络恢复后重试计数: ${resetCount}`);
            
            if (resetCount === 0) {
                console.log('✅ 测试通过: 重试计数器已正确重置');
                this.testResults.push({
                    test: 'RetryCounterReset',
                    status: 'PASS',
                    message: '重试计数器已正确重置为0'
                });
            } else {
                console.log('❌ 测试失败: 重试计数器未重置');
                this.testResults.push({
                    test: 'RetryCounterReset',
                    status: 'FAIL',
                    message: `重试计数器应为0，实际为${resetCount}`
                });
            }
            
        } catch (error) {
            console.error('❌ 测试异常:', error.message);
            this.testResults.push({
                test: 'RetryCounterReset',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 测试重连机制的完整流程
     */
    async testReconnectFlow() {
        console.log('\n🧪 测试: 重连机制完整流程');
        
        try {
            const exchangeManager = new ExchangeManager(this.config);
            
            // 模拟多次连接失败
            exchangeManager.connectionRetryCount = 2;
            console.log(`模拟连接失败，重试计数: ${exchangeManager.connectionRetryCount}`);
            
            // 模拟网络恢复
            await exchangeManager.handleNetworkConnectionRestored();
            
            // 验证重置后的状态
            if (exchangeManager.connectionRetryCount === 0) {
                console.log('✅ 重连流程测试通过');
                this.testResults.push({
                    test: 'ReconnectFlow',
                    status: 'PASS',
                    message: '重连流程正常，计数器已重置'
                });
            } else {
                console.log('❌ 重连流程测试失败');
                this.testResults.push({
                    test: 'ReconnectFlow',
                    status: 'FAIL',
                    message: '重连流程异常'
                });
            }
            
        } catch (error) {
            console.error('❌ 重连流程测试异常:', error.message);
            this.testResults.push({
                test: 'ReconnectFlow',
                status: 'ERROR',
                message: error.message
            });
        }
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始运行重连机制修复测试套件\n');
        
        await this.testRetryCounterReset();
        await this.testReconnectFlow();
        
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
            console.log('\n🎉 所有测试通过！重连机制修复验证成功。');
        } else {
            console.log('\n⚠️ 存在测试失败或错误，请检查修复实现。');
        }
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    const testSuite = new ReconnectTestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('测试套件运行失败:', error);
        process.exit(1);
    });
}

module.exports = ReconnectTestSuite;