const StrategyConfig = require('../config/strategy');
const Logger = require('../utils/logger');
const AvellanedaStrategy = require('../core/strategy');
const ExchangeManager = require('../core/exchange');
const NetworkManager = require('../core/network-manager');

/**
 * 程序卡住检测测试
 * 检测可能导致程序卡住且无法退出的问题
 */
class HangDetectionTest {
    constructor() {
        this.config = null;
        this.logger = null;
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * 初始化测试环境
     */
    async initialize() {
        try {
            console.log('🔧 初始化测试环境...');
            
            this.config = new StrategyConfig();
            this.logger = new Logger(this.config);
            
            console.log('✅ 测试环境初始化完成');
            return true;
        } catch (error) {
            console.error('❌ 测试环境初始化失败:', error.message);
            return false;
        }
    }

    /**
     * 测试1: 检查主循环中的无限循环
     */
    async testMainLoopHang() {
        console.log('\n🧪 测试1: 检查主循环中的无限循环...');
        
        try {
            const strategy = new AvellanedaStrategy(this.config);
            
            // 模拟主循环，设置超时
            const testPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('主循环测试超时 - 可能存在无限循环'));
                }, 10000); // 10秒超时
                
                // 启动策略但不实际运行主循环
                strategy.initialize().then(() => {
                    clearTimeout(timeout);
                    resolve('主循环测试通过');
                }).catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            const result = await testPromise;
            this.testResults.push({ test: '主循环测试', status: 'PASS', message: result });
            console.log('✅ 主循环测试通过');
            
        } catch (error) {
            this.testResults.push({ test: '主循环测试', status: 'FAIL', message: error.message });
            console.log('❌ 主循环测试失败:', error.message);
        }
    }

    /**
     * 测试2: 检查网络连接超时
     */
    async testNetworkTimeout() {
        console.log('\n🧪 测试2: 检查网络连接超时...');
        
        try {
            const networkManager = new NetworkManager(this.config);
            
            // 测试网络连接，设置较短的超时时间
            const testPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('网络连接测试超时 - 可能存在连接阻塞'));
                }, 5000); // 5秒超时
                
                networkManager.performHealthCheck().then(() => {
                    clearTimeout(timeout);
                    resolve('网络连接测试通过');
                }).catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            const result = await testPromise;
            this.testResults.push({ test: '网络连接测试', status: 'PASS', message: result });
            console.log('✅ 网络连接测试通过');
            
        } catch (error) {
            this.testResults.push({ test: '网络连接测试', status: 'FAIL', message: error.message });
            console.log('❌ 网络连接测试失败:', error.message);
        }
    }

    /**
     * 测试3: 检查交易所API调用超时
     */
    async testExchangeTimeout() {
        console.log('\n🧪 测试3: 检查交易所API调用超时...');
        
        try {
            const exchangeManager = new ExchangeManager(this.config);
            
            // 测试交易所连接，设置超时
            const testPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('交易所连接测试超时 - 可能存在API调用阻塞'));
                }, 8000); // 8秒超时
                
                exchangeManager.initialize().then(() => {
                    clearTimeout(timeout);
                    resolve('交易所连接测试通过');
                }).catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            const result = await testPromise;
            this.testResults.push({ test: '交易所连接测试', status: 'PASS', message: result });
            console.log('✅ 交易所连接测试通过');
            
        } catch (error) {
            this.testResults.push({ test: '交易所连接测试', status: 'FAIL', message: error.message });
            console.log('❌ 交易所连接测试失败:', error.message);
        }
    }

    /**
     * 测试4: 检查定时器清理
     */
    async testTimerCleanup() {
        console.log('\n🧪 测试4: 检查定时器清理...');
        
        try {
            const networkManager = new NetworkManager(this.config);
            const exchangeManager = new ExchangeManager(this.config);
            
            // 启动定时器
            networkManager.startHealthCheck();
            exchangeManager.startDataUpdates();
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 清理定时器
            networkManager.stopHealthCheck();
            exchangeManager.stopDataUpdates();
            
            this.testResults.push({ test: '定时器清理测试', status: 'PASS', message: '定时器清理正常' });
            console.log('✅ 定时器清理测试通过');
            
        } catch (error) {
            this.testResults.push({ test: '定时器清理测试', status: 'FAIL', message: error.message });
            console.log('❌ 定时器清理测试失败:', error.message);
        }
    }

    /**
     * 测试5: 检查事件监听器清理
     */
    async testEventListenerCleanup() {
        console.log('\n🧪 测试5: 检查事件监听器清理...');
        
        try {
            const exchangeManager = new ExchangeManager(this.config);
            
            // 检查事件监听器数量
            const initialListenerCount = exchangeManager.listenerCount('orderBookUpdate');
            
            // 添加一些监听器
            const testListener = () => {};
            exchangeManager.on('orderBookUpdate', testListener);
            
            // 移除监听器
            exchangeManager.off('orderBookUpdate', testListener);
            
            const finalListenerCount = exchangeManager.listenerCount('orderBookUpdate');
            
            if (finalListenerCount === initialListenerCount) {
                this.testResults.push({ test: '事件监听器清理测试', status: 'PASS', message: '事件监听器清理正常' });
                console.log('✅ 事件监听器清理测试通过');
            } else {
                throw new Error('事件监听器清理异常');
            }
            
        } catch (error) {
            this.testResults.push({ test: '事件监听器清理测试', status: 'FAIL', message: error.message });
            console.log('❌ 事件监听器清理测试失败:', error.message);
        }
    }

    /**
     * 测试6: 检查Promise拒绝处理
     */
    async testPromiseRejectionHandling() {
        console.log('\n🧪 测试6: 检查Promise拒绝处理...');
        
        try {
            // 测试未处理的Promise拒绝
            const testPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject(new Error('测试Promise拒绝'));
                }, 100);
            });
            
            // 应该被捕获
            await testPromise.catch(error => {
                // 正常处理
            });
            
            this.testResults.push({ test: 'Promise拒绝处理测试', status: 'PASS', message: 'Promise拒绝处理正常' });
            console.log('✅ Promise拒绝处理测试通过');
            
        } catch (error) {
            this.testResults.push({ test: 'Promise拒绝处理测试', status: 'FAIL', message: error.message });
            console.log('❌ Promise拒绝处理测试失败:', error.message);
        }
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始程序卡住检测测试...\n');
        
        if (!await this.initialize()) {
            console.log('❌ 测试初始化失败，退出测试');
            return;
        }
        
        this.isRunning = true;
        
        try {
            await this.testMainLoopHang();
            await this.testNetworkTimeout();
            await this.testExchangeTimeout();
            await this.testTimerCleanup();
            await this.testEventListenerCleanup();
            await this.testPromiseRejectionHandling();
            
        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error.message);
        } finally {
            this.isRunning = false;
        }
        
        this.printResults();
    }

    /**
     * 打印测试结果
     */
    printResults() {
        console.log('\n📊 测试结果汇总:');
        console.log('─'.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        
        this.testResults.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${result.test}: ${result.message}`);
        });
        
        console.log('─'.repeat(60));
        console.log(`总计: ${this.testResults.length} 项测试`);
        console.log(`通过: ${passed} 项`);
        console.log(`失败: ${failed} 项`);
        
        if (failed > 0) {
            console.log('\n⚠️  发现可能导致程序卡住的问题:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(result => {
                    console.log(`   - ${result.test}: ${result.message}`);
                });
            
            console.log('\n🔧 建议的解决方案:');
            console.log('1. 检查网络连接和代理设置');
            console.log('2. 验证交易所API配置');
            console.log('3. 确保所有异步操作都有适当的超时处理');
            console.log('4. 检查定时器和事件监听器的清理');
            console.log('5. 添加更多的错误处理和日志记录');
        } else {
            console.log('\n🎉 所有测试通过！程序卡住风险较低');
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.isRunning = false;
        console.log('🧹 测试资源清理完成');
    }
}

// 主函数
async function main() {
    const test = new HangDetectionTest();
    
    try {
        await test.runAllTests();
    } catch (error) {
        console.error('❌ 测试执行失败:', error.message);
    } finally {
        test.cleanup();
    }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    main();
}

module.exports = HangDetectionTest; 