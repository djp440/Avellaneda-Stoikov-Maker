/**
 * 实际紧急停止测试脚本
 * 用于在真实环境中验证紧急停止修复效果
 */

const AvellanedaMarketMaker = require('../index');

class RealEmergencyStopTest {
    constructor() {
        this.marketMaker = null;
        this.testStartTime = null;
    }

    async runTest() {
        console.log('🚀 开始实际紧急停止测试');
        console.log('='.repeat(60));
        
        try {
            // 创建市场做市商实例
            this.marketMaker = new AvellanedaMarketMaker();
            this.testStartTime = Date.now();
            
            // 设置测试监听器
            this.setupTestListeners();
            
            console.log('📋 测试场景: 模拟触发紧急停止阈值');
            console.log('   - 将在策略运行5秒后人为触发紧急停止');
            console.log('   - 验证程序是否能正确终止而不卡死');
            console.log('');
            
            // 启动策略
            console.log('🎯 启动Avellaneda做市策略...');
            await this.marketMaker.start();
            
            // 等待5秒后触发紧急停止测试
            setTimeout(() => {
                this.triggerEmergencyStopTest();
            }, 5000);
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error.message);
            process.exit(1);
        }
    }

    setupTestListeners() {
        // 监听进程退出事件
        process.on('SIGINT', () => {
            console.log('\n🛑 收到SIGINT信号，测试程序正在退出...');
            this.cleanup();
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 收到SIGTERM信号，测试程序正在退出...');
            this.cleanup();
        });
        
        // 监听未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('\n💥 未捕获的异常:', error.message);
            this.cleanup();
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('\n💥 未处理的Promise拒绝:', reason);
            this.cleanup();
        });
    }

    async triggerEmergencyStopTest() {
        console.log('\n⚠️ 开始触发紧急停止测试...');
        
        try {
            if (!this.marketMaker || !this.marketMaker.strategy) {
                console.error('❌ 策略实例不存在，无法进行测试');
                return;
            }
            
            const riskManager = this.marketMaker.strategy.riskManager;
            
            if (!riskManager) {
                console.error('❌ 风险管理器不存在，无法进行测试');
                return;
            }
            
            console.log('🎯 人为设置紧急停止状态...');
            
            // 人为设置紧急停止状态
            riskManager.riskState.isEmergencyStop = true;
            
            // 创建紧急停止事件
            const emergencyEvent = {
                type: 'EMERGENCY_STOP_TEST',
                triggered: true,
                severity: 'CRITICAL',
                message: '测试触发紧急停止 - 验证修复效果',
                data: {
                    testReason: '人为触发测试',
                    timestamp: new Date().toISOString()
                }
            };
            
            console.log('🚨 触发紧急停止事件...');
            await riskManager.handleRiskEvent(emergencyEvent);
            
            // 设置超时检查
            setTimeout(() => {
                this.checkTestResult();
            }, 3000);
            
        } catch (error) {
            console.error('❌ 触发紧急停止测试失败:', error.message);
        }
    }

    checkTestResult() {
        const runTime = Date.now() - this.testStartTime;
        
        console.log('\n📊 测试结果检查');
        console.log('─'.repeat(40));
        console.log(`运行时间: ${(runTime / 1000).toFixed(1)}秒`);
        
        if (this.marketMaker && this.marketMaker.strategy) {
            const isRunning = this.marketMaker.strategy.isRunning;
            const riskState = this.marketMaker.strategy.riskManager.getRiskStatus();
            
            console.log(`策略运行状态: ${isRunning ? '仍在运行 ❌' : '已停止 ✅'}`);
            console.log(`紧急停止状态: ${riskState.state.isEmergencyStop ? '已激活 ✅' : '未激活 ❌'}`);
            
            if (!isRunning && riskState.state.isEmergencyStop) {
                console.log('\n🎉 测试成功！紧急停止机制工作正常');
                console.log('✅ 策略正确响应紧急停止并终止运行');
                console.log('✅ 程序没有卡死，能够正常退出');
            } else {
                console.log('\n❌ 测试失败！紧急停止机制仍有问题');
                if (isRunning) {
                    console.log('❌ 策略在紧急停止后仍在运行');
                }
            }
        } else {
            console.log('❌ 无法获取策略状态');
        }
        
        // 强制退出测试
        console.log('\n🏁 测试完成，程序即将退出...');
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    cleanup() {
        try {
            if (this.marketMaker) {
                console.log('🧹 清理测试环境...');
                this.marketMaker.gracefulShutdown('TEST_CLEANUP');
            }
        } catch (error) {
            console.error('清理时出错:', error.message);
        }
    }
}

// 运行测试
if (require.main === module) {
    const test = new RealEmergencyStopTest();
    test.runTest().catch(error => {
        console.error('测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = RealEmergencyStopTest;