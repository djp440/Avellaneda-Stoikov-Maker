const RiskManager = require('../core/risk-manager');
const config = require('../config/trading');

// 创建简单的配置对象用于测试
class SimpleConfig {
    constructor() {
        this.data = {
            logLevel: 'info',
            logFile: 'logs/test.log',
            // 风险管理配置
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
    }
    
    get(key) {
        return this.data[key];
    }
    
    isDevelopment() {
        return false; // 测试环境设为false
    }
}

/**
 * 测试修复后的回撤计算逻辑
 */
class DrawdownFixTest {
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
        this.info('开始测试修复后的回撤计算逻辑');
        
        try {
            await this.testInitialDrawdown();
            await this.testNormalDrawdown();
            await this.testNoDrawdownWhenIncreasing();
            await this.testMaxDrawdownTracking();
            await this.testEmergencyStopTrigger();
            
            this.info(`测试完成: ${this.testsPassed}/${this.totalTests} 通过`);
            
            if (this.testsPassed === this.totalTests) {
                this.info('✅ 所有测试通过！回撤计算bug已修复');
                return true;
            } else {
                this.error('❌ 部分测试失败，需要进一步修复');
                return false;
            }
        } catch (error) {
            this.error('测试过程中发生错误:', { message: error.message, stack: error.stack });
            console.error('完整错误信息:', error);
            return false;
        }
    }

    async testInitialDrawdown() {
        this.totalTests++;
        this.info('测试1: 初始状态回撤计算');
        
        const testConfig = new SimpleConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 初始状态下回撤应该为0
        const initialDrawdown = riskManager.calculateDrawdown();
        
        if (initialDrawdown === 0) {
            this.testsPassed++;
            this.info('✅ 测试1通过: 初始状态回撤为0');
        } else {
            this.error(`❌ 测试1失败: 初始回撤应为0，实际为${initialDrawdown}`);
        }
    }

    async testNormalDrawdown() {
        this.totalTests++;
        this.info('测试2: 正常回撤计算');
        
        const testConfig = new SimpleConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 账户价值下降到8000，回撤应为20%
        riskManager.updateAccountValue(8000);
        const drawdown = riskManager.calculateDrawdown();
        
        const expectedDrawdown = 20; // (10000-8000)/10000 * 100 = 20%
        
        if (Math.abs(drawdown - expectedDrawdown) < 0.01) {
            this.testsPassed++;
            this.info(`✅ 测试2通过: 回撤计算正确 ${drawdown.toFixed(2)}%`);
        } else {
            this.error(`❌ 测试2失败: 期望回撤${expectedDrawdown}%，实际${drawdown.toFixed(2)}%`);
        }
    }

    async testNoDrawdownWhenIncreasing() {
        this.totalTests++;
        this.info('测试3: 账户价值上升时无回撤');
        
        const testConfig = new SimpleConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 账户价值上升到12000，回撤应为0
        riskManager.updateAccountValue(12000);
        const drawdown = riskManager.calculateDrawdown();
        
        if (drawdown === 0) {
            this.testsPassed++;
            this.info('✅ 测试3通过: 账户价值上升时回撤为0');
        } else {
            this.error(`❌ 测试3失败: 账户价值上升时回撤应为0，实际为${drawdown.toFixed(2)}%`);
        }
    }

    async testMaxDrawdownTracking() {
        this.totalTests++;
        this.info('测试4: 最大回撤跟踪');
        
        const testConfig = new SimpleConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 第一次下降到8000 (20%回撤)
        riskManager.updateAccountValue(8000);
        riskManager.calculateDrawdown();
        
        // 回升到9000 (10%回撤)
        riskManager.updateAccountValue(9000);
        riskManager.calculateDrawdown();
        
        // 再次下降到7000 (30%回撤)
        riskManager.updateAccountValue(7000);
        riskManager.calculateDrawdown();
        
        const maxDrawdown = riskManager.riskState.maxDrawdownReached;
        
        if (Math.abs(maxDrawdown - 30) < 0.01) {
            this.testsPassed++;
            this.info(`✅ 测试4通过: 最大回撤跟踪正确 ${maxDrawdown.toFixed(2)}%`);
        } else {
            this.error(`❌ 测试4失败: 期望最大回撤30%，实际${maxDrawdown.toFixed(2)}%`);
        }
    }

    async testEmergencyStopTrigger() {
        this.totalTests++;
        this.info('测试5: 紧急停止触发条件');
        
        const testConfig = new SimpleConfig();
        const riskManager = new RiskManager(testConfig);
        await riskManager.initialize();
        
        // 设置初始账户价值
        riskManager.updateAccountValue(10000);
        
        // 模拟账户价值下降到8500 (15%回撤，超过10%阈值)
        riskManager.updateAccountValue(8500);
        
        // 执行风险检查
        await riskManager.performRiskCheck();
        
        const isEmergencyStop = riskManager.riskState.isEmergencyStop;
        const drawdown = riskManager.calculateDrawdown();
        
        if (isEmergencyStop && drawdown > testConfig.get('emergencyStopThreshold')) {
            this.testsPassed++;
            this.info(`✅ 测试5通过: 回撤${drawdown.toFixed(2)}%超过阈值${testConfig.get('emergencyStopThreshold')}%，正确触发紧急停止`);
        } else {
            this.error(`❌ 测试5失败: 回撤${drawdown.toFixed(2)}%，紧急停止状态${isEmergencyStop}`);
        }
    }
}

// 运行测试
if (require.main === module) {
    const test = new DrawdownFixTest();
    test.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = DrawdownFixTest;