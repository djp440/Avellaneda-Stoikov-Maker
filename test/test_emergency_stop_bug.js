/**
 * 紧急停止bug测试脚本
 * 用于复现和验证紧急停止机制的问题
 */

const StrategyConfig = require('../config/strategy');
const RiskManager = require('../core/risk-manager');
const AvellanedaStrategy = require('../core/strategy');
const Logger = require('../utils/logger');

class EmergencyStopBugTest {
    constructor() {
        this.config = null;
        this.riskManager = null;
        this.strategy = null;
        this.logger = null;
    }

    async initialize() {
        try {
            console.log('🔍 初始化紧急停止bug测试...');
            
            // 初始化配置
            this.config = new StrategyConfig();
            this.config.loadConfig();
            
            // 初始化日志
            this.logger = new Logger(this.config);
            
            // 初始化风险管理器
            this.riskManager = new RiskManager(this.config);
            await this.riskManager.initialize();
            
            // 初始化策略（模拟）
            this.strategy = new AvellanedaStrategy(this.config);
            
            console.log('✅ 测试环境初始化完成');
            return true;
            
        } catch (error) {
            console.error('❌ 测试环境初始化失败:', error.message);
            return false;
        }
    }

    /**
     * 测试1: 验证紧急停止触发条件
     */
    async testEmergencyStopTrigger() {
        console.log('\n📋 测试1: 验证紧急停止触发条件');
        console.log('─'.repeat(50));
        
        try {
            // 模拟账户数据，触发紧急停止
            this.riskManager.updateAccountValue(1000); // 总价值1000 USDT
            this.riskManager.updateRealizedPnL(-250); // 亏损250 USDT，回撤25%
            
            // 执行风险检查
            const emergencyStopResult = await this.riskManager.checkEmergencyStop();
            
            console.log('风险检查结果:', emergencyStopResult);
            
            if (emergencyStopResult.triggered) {
                console.log('✅ 紧急停止条件正确触发');
                console.log(`   触发原因: ${emergencyStopResult.message}`);
                return true;
            } else {
                console.log('❌ 紧急停止条件未触发（预期应该触发）');
                return false;
            }
            
        } catch (error) {
            console.error('❌ 测试1执行失败:', error.message);
            return false;
        }
    }

    /**
     * 测试2: 验证紧急停止处理流程
     */
    async testEmergencyStopHandling() {
        console.log('\n📋 测试2: 验证紧急停止处理流程');
        console.log('─'.repeat(50));
        
        try {
            // 模拟触发紧急停止事件
            const emergencyEvent = {
                type: 'EMERGENCY_STOP_THRESHOLD',
                triggered: true,
                severity: 'CRITICAL',
                message: 'Emergency stop threshold exceeded: 25.00% > 10%',
                data: {
                    drawdown: 25.0,
                    threshold: 10.0
                }
            };
            
            console.log('模拟紧急停止事件:', emergencyEvent);
            
            // 处理风险事件
            await this.riskManager.handleRiskEvent(emergencyEvent);
            
            // 检查紧急停止状态
            const riskStatus = this.riskManager.getRiskStatus();
            console.log('风险状态:', {
                isEmergencyStop: riskStatus.state.isEmergencyStop,
                riskAlerts: riskStatus.state.riskAlerts.length
            });
            
            if (riskStatus.state.isEmergencyStop) {
                console.log('✅ 紧急停止状态已设置');
                return true;
            } else {
                console.log('❌ 紧急停止状态未设置');
                return false;
            }
            
        } catch (error) {
            console.error('❌ 测试2执行失败:', error.message);
            return false;
        }
    }

    /**
     * 测试3: 验证策略主循环响应
     */
    async testStrategyLoopResponse() {
        console.log('\n📋 测试3: 验证策略主循环响应');
        console.log('─'.repeat(50));
        
        try {
            // 设置紧急停止状态
            this.riskManager.riskState.isEmergencyStop = true;
            
            // 检查策略是否正确响应紧急停止
            const riskStatus = this.riskManager.getRiskStatus();
            
            console.log('当前风险状态:', {
                isEmergencyStop: riskStatus.state.isEmergencyStop
            });
            
            // 模拟策略主循环的检查逻辑
            if (riskStatus.state.isEmergencyStop) {
                console.log('⚠️ 策略检测到紧急停止状态');
                console.log('❌ 问题: 策略只是暂停10秒，然后继续循环');
                console.log('❌ 问题: 没有真正停止策略运行');
                console.log('❌ 问题: 缺少从风险管理器到主程序的停止信号');
                return false;
            }
            
        } catch (error) {
            console.error('❌ 测试3执行失败:', error.message);
            return false;
        }
    }

    /**
     * 测试4: 验证程序终止机制
     */
    async testProgramTermination() {
        console.log('\n📋 测试4: 验证程序终止机制');
        console.log('─'.repeat(50));
        
        console.log('❌ 当前问题分析:');
        console.log('   1. 风险管理器触发紧急停止后，只设置了isEmergencyStop=true');
        console.log('   2. 策略主循环检测到紧急停止后，只是sleep(10000)然后继续');
        console.log('   3. 没有机制通知主程序(index.js)停止运行');
        console.log('   4. 程序会一直卡在主循环中，无法正常退出');
        
        console.log('\n🔧 需要修复的问题:');
        console.log('   1. 风险管理器需要提供停止策略的方法');
        console.log('   2. 策略主循环需要在紧急停止时退出循环');
        console.log('   3. 主程序需要监听紧急停止事件并执行gracefulShutdown');
        
        return false;
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始紧急停止bug测试');
        console.log('='.repeat(60));
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ 测试初始化失败，退出测试');
            return;
        }
        
        const results = [];
        
        // 运行所有测试
        results.push(await this.testEmergencyStopTrigger());
        results.push(await this.testEmergencyStopHandling());
        results.push(await this.testStrategyLoopResponse());
        results.push(await this.testProgramTermination());
        
        // 汇总结果
        console.log('\n📊 测试结果汇总');
        console.log('='.repeat(60));
        
        const passedTests = results.filter(r => r === true).length;
        const totalTests = results.length;
        
        console.log(`通过测试: ${passedTests}/${totalTests}`);
        
        if (passedTests < totalTests) {
            console.log('\n❌ 发现紧急停止机制存在严重bug!');
            console.log('需要立即修复以防止程序卡死问题。');
        } else {
            console.log('\n✅ 所有测试通过');
        }
        
        // 清理
        this.cleanup();
    }

    cleanup() {
        try {
            if (this.riskManager) {
                this.riskManager.cleanup();
            }
            console.log('\n🧹 测试环境已清理');
        } catch (error) {
            console.error('清理测试环境时出错:', error.message);
        }
    }
}

// 运行测试
if (require.main === module) {
    const test = new EmergencyStopBugTest();
    test.runAllTests().catch(error => {
        console.error('测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = EmergencyStopBugTest;