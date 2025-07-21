const RiskManager = require('../core/risk-manager');
const { AvellanedaStrategy } = require('../core/strategy');
const config = require('../config/trading');

/**
 * 完整紧急停止系统测试
 * 测试从回撤计算到紧急停止触发的完整流程
 */
class CompleteEmergencySystemTest {
    constructor() {
        this.testsPassed = 0;
        this.totalTests = 0;
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toLocaleTimeString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        console.log(`${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    async runAllTests() {
        this.info('开始测试完整紧急停止系统');
        
        try {
            await this.testRiskManagerDrawdownCalculation();
            await this.testEmergencyStopTrigger();
            await this.testStrategyEventHandling();
            await this.testCompleteWorkflow();
            
            this.info(`测试完成: ${this.testsPassed}/${this.totalTests} 通过`);
            
            if (this.testsPassed === this.totalTests) {
                this.info('✅ 完整紧急停止系统测试通过！');
                return true;
            } else {
                this.error('❌ 部分测试失败，系统需要进一步修复');
                return false;
            }
        } catch (error) {
            this.error('测试过程中发生错误:', { message: error.message, stack: error.stack });
            console.error('完整错误信息:', error);
            return false;
        }
    }

    // 创建简单的配置对象用于测试
    createTestConfig() {
        return {
            get(key) {
                const data = {
                    logLevel: 'info',
                    logFile: 'logs/test.log',
                    maxPositionSizePercent: 10.0,
                    maxPositionValuePercent: 50.0,
                    targetInventory: 0,
                    stopLossPercent: 2.0,
                    stopLossAmountPercent: 1.0,
                    trailingStopLoss: false,
                    emergencyStopThreshold: 10.0,
                    dailyLossLimit: 5.0,
                    maxDrawdownPercent: 15.0
                };
                return data[key];
            },
            isDevelopment() {
                return false;
            }
        };
    }

    async testRiskManagerDrawdownCalculation() {
        this.totalTests++;
        this.info('测试1: 风险管理器回撤计算');
        
        const testConfig = this.createTestConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 模拟账户价值下降
        riskManager.updateAccountValue(8500); // 15%回撤
        
        const drawdown = riskManager.calculateDrawdown();
        const expectedDrawdown = 15; // (10000-8500)/10000 * 100 = 15%
        
        if (Math.abs(drawdown - expectedDrawdown) < 0.01) {
            this.testsPassed++;
            this.info(`✅ 测试1通过: 回撤计算正确 ${drawdown.toFixed(2)}%`);
        } else {
            this.error(`❌ 测试1失败: 期望回撤${expectedDrawdown}%，实际${drawdown.toFixed(2)}%`);
        }
        
        await riskManager.cleanup();
    }

    async testEmergencyStopTrigger() {
        this.totalTests++;
        this.info('测试2: 紧急停止触发机制');
        
        const testConfig = this.createTestConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        let emergencyStopTriggered = false;
        
        // 监听紧急停止事件
        riskManager.on('emergencyStop', () => {
            emergencyStopTriggered = true;
        });
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 模拟账户价值下降到触发紧急停止
        riskManager.updateAccountValue(8500); // 15%回撤，超过10%阈值
        
        // 执行风险检查
        await riskManager.performRiskCheck();
        
        if (emergencyStopTriggered && riskManager.riskState.isEmergencyStop) {
            this.testsPassed++;
            this.info('✅ 测试2通过: 紧急停止正确触发');
        } else {
            this.error(`❌ 测试2失败: 紧急停止未触发，事件=${emergencyStopTriggered}，状态=${riskManager.riskState.isEmergencyStop}`);
        }
        
        await riskManager.cleanup();
    }

    async testStrategyEventHandling() {
        this.totalTests++;
        this.info('测试3: 策略事件处理');
        
        const testConfig = this.createTestConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 创建策略实例（模拟）
        const mockStrategy = {
            isRunning: true,
            emergencyStopCalled: false,
            handleEmergencyStop() {
                this.emergencyStopCalled = true;
                this.isRunning = false;
            }
        };
        
        // 监听风险管理器的紧急停止事件
        riskManager.on('emergencyStop', () => {
            mockStrategy.handleEmergencyStop();
        });
        
        // 触发紧急停止
        riskManager.updateAccountValue(10000);
        riskManager.updateAccountValue(8500); // 15%回撤
        await riskManager.performRiskCheck();
        
        if (mockStrategy.emergencyStopCalled && !mockStrategy.isRunning) {
            this.testsPassed++;
            this.info('✅ 测试3通过: 策略正确响应紧急停止事件');
        } else {
            this.error(`❌ 测试3失败: 策略未正确响应，emergencyStopCalled=${mockStrategy.emergencyStopCalled}，isRunning=${mockStrategy.isRunning}`);
        }
        
        await riskManager.cleanup();
    }

    async testCompleteWorkflow() {
        this.totalTests++;
        this.info('测试4: 完整工作流程');
        
        const testConfig = this.createTestConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        let workflowSteps = {
            accountValueUpdated: false,
            drawdownCalculated: false,
            emergencyStopTriggered: false,
            riskCheckCompleted: false
        };
        
        // 监听事件
        riskManager.on('emergencyStop', () => {
            workflowSteps.emergencyStopTriggered = true;
        });
        
        // 执行完整工作流程
        try {
            // 1. 更新账户价值
            riskManager.updateAccountValue(10000);
            workflowSteps.accountValueUpdated = true;
            
            // 2. 模拟价值下降
            riskManager.updateAccountValue(8000); // 20%回撤
            
            // 3. 计算回撤
            const drawdown = riskManager.calculateDrawdown();
            if (drawdown > 0) {
                workflowSteps.drawdownCalculated = true;
            }
            
            // 4. 执行风险检查
            await riskManager.performRiskCheck();
            workflowSteps.riskCheckCompleted = true;
            
            // 验证所有步骤都完成
            const allStepsCompleted = Object.values(workflowSteps).every(step => step === true);
            
            if (allStepsCompleted && riskManager.riskState.isEmergencyStop) {
                this.testsPassed++;
                this.info('✅ 测试4通过: 完整工作流程正确执行');
                this.info(`   - 账户价值更新: ${workflowSteps.accountValueUpdated}`);
                this.info(`   - 回撤计算: ${workflowSteps.drawdownCalculated}`);
                this.info(`   - 紧急停止触发: ${workflowSteps.emergencyStopTriggered}`);
                this.info(`   - 风险检查完成: ${workflowSteps.riskCheckCompleted}`);
            } else {
                this.error('❌ 测试4失败: 工作流程未完整执行');
                this.error(`   工作流程状态: ${JSON.stringify(workflowSteps)}`);
                this.error(`   紧急停止状态: ${riskManager.riskState.isEmergencyStop}`);
            }
        } catch (error) {
            this.error('❌ 测试4失败: 工作流程执行出错', { error: error.message });
        }
        
        await riskManager.cleanup();
    }
}

// 运行测试
if (require.main === module) {
    const test = new CompleteEmergencySystemTest();
    test.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = CompleteEmergencySystemTest;