/**
 * 紧急停止触发原因诊断脚本
 * 用于分析为什么策略状态良好却触发紧急停止
 */

const StrategyConfig = require('../config/strategy');
const RiskManager = require('../core/risk-manager');
const Logger = require('../utils/logger');

class EmergencyTriggerDiagnosis {
    constructor() {
        this.config = null;
        this.riskManager = null;
        this.logger = null;
    }

    async initialize() {
        try {
            console.log('🔍 初始化紧急停止触发诊断...');
            
            // 初始化配置
            this.config = new StrategyConfig();
            this.config.loadConfig();
            
            // 初始化日志
            this.logger = new Logger(this.config);
            
            // 初始化风险管理器
            this.riskManager = new RiskManager(this.config);
            await this.riskManager.initialize();
            
            console.log('✅ 诊断环境初始化完成');
            return true;
            
        } catch (error) {
            console.error('❌ 诊断环境初始化失败:', error.message);
            return false;
        }
    }

    /**
     * 诊断1: 检查配置参数
     */
    diagnoseConfiguration() {
        console.log('\n📋 诊断1: 检查风险管理配置');
        console.log('─'.repeat(50));
        
        const riskConfig = this.riskManager.riskConfig;
        
        console.log('🔧 当前风险管理配置:');
        console.log(`   紧急停止阈值: ${riskConfig.emergencyStopThreshold}%`);
        console.log(`   最大回撤阈值: ${riskConfig.maxDrawdown}%`);
        console.log(`   最大日亏损: ${riskConfig.maxDailyLossPercent}%`);
        console.log(`   风险检查间隔: ${riskConfig.riskCheckInterval}ms`);
        
        // 分析配置合理性
        const issues = [];
        
        if (riskConfig.emergencyStopThreshold <= 5) {
            issues.push('⚠️ 紧急停止阈值过低，可能导致频繁触发');
        }
        
        if (riskConfig.emergencyStopThreshold <= riskConfig.maxDrawdown) {
            issues.push('⚠️ 紧急停止阈值应该大于最大回撤阈值');
        }
        
        if (riskConfig.riskCheckInterval < 1000) {
            issues.push('⚠️ 风险检查间隔过短，可能导致过度敏感');
        }
        
        if (issues.length > 0) {
            console.log('\n🚨 发现配置问题:');
            issues.forEach(issue => console.log(`   ${issue}`));
        } else {
            console.log('\n✅ 配置参数看起来合理');
        }
        
        return issues.length === 0;
    }

    /**
     * 诊断2: 分析回撤计算逻辑
     */
    diagnoseDrawdownCalculation() {
        console.log('\n📋 诊断2: 分析回撤计算逻辑');
        console.log('─'.repeat(50));
        
        const riskState = this.riskManager.riskState;
        
        console.log('📊 当前风险状态:');
        console.log(`   最大未实现盈亏: ${riskState.maxUnrealizedPnL}`);
        console.log(`   当前未实现盈亏: ${riskState.unrealizedPnL}`);
        console.log(`   已实现盈亏: ${riskState.realizedPnL}`);
        console.log(`   总盈亏: ${riskState.totalPnL}`);
        console.log(`   账户总价值: ${riskState.totalAccountValue}`);
        
        // 模拟不同场景的回撤计算
        console.log('\n🧮 回撤计算分析:');
        
        const scenarios = [
            { name: '初始状态', maxPnL: 0, currentPnL: 0 },
            { name: '盈利后回撤', maxPnL: 1000, currentPnL: 800 },
            { name: '从盈利到亏损', maxPnL: 1000, currentPnL: -200 },
            { name: '持续亏损', maxPnL: 0, currentPnL: -500 },
            { name: '小额盈利', maxPnL: 10, currentPnL: 5 }
        ];
        
        scenarios.forEach(scenario => {
            const drawdown = this.calculateDrawdownForScenario(scenario.maxPnL, scenario.currentPnL);
            console.log(`   ${scenario.name}: 峰值=${scenario.maxPnL}, 当前=${scenario.currentPnL}, 回撤=${drawdown.toFixed(2)}%`);
            
            if (drawdown > this.riskManager.riskConfig.emergencyStopThreshold) {
                console.log(`     🚨 会触发紧急停止! (${drawdown.toFixed(2)}% > ${this.riskManager.riskConfig.emergencyStopThreshold}%)`);
            }
        });
        
        // 检查当前实际回撤
        const currentDrawdown = this.riskManager.calculateDrawdown();
        console.log(`\n📈 当前实际回撤: ${currentDrawdown.toFixed(2)}%`);
        
        if (currentDrawdown > this.riskManager.riskConfig.emergencyStopThreshold) {
            console.log('🚨 当前回撤已超过紧急停止阈值!');
            return false;
        }
        
        return true;
    }

    /**
     * 诊断3: 检查数据更新逻辑
     */
    diagnoseDataUpdateLogic() {
        console.log('\n📋 诊断3: 检查数据更新逻辑');
        console.log('─'.repeat(50));
        
        console.log('🔄 模拟数据更新过程:');
        
        // 保存原始状态
        const originalState = { ...this.riskManager.riskState };
        
        // 模拟正常交易场景
        console.log('\n场景1: 正常盈利交易');
        this.simulateTradeUpdate(0.001, 60000, 100); // 0.001 BTC, 60000 USDT价格, 100 USDT盈利
        this.logCurrentState();
        
        console.log('\n场景2: 价格下跌导致未实现亏损');
        this.simulateTradeUpdate(0.001, 55000, 100); // 价格下跌到55000
        this.logCurrentState();
        
        console.log('\n场景3: 继续下跌');
        this.simulateTradeUpdate(0.001, 50000, 100); // 价格继续下跌到50000
        this.logCurrentState();
        
        // 恢复原始状态
        this.riskManager.riskState = originalState;
        
        return true;
    }

    /**
     * 诊断4: 检查可能的bug
     */
    diagnosePotentialBugs() {
        console.log('\n📋 诊断4: 检查可能的bug');
        console.log('─'.repeat(50));
        
        const issues = [];
        
        // 检查1: maxUnrealizedPnL初始化问题
        if (this.riskManager.riskState.maxUnrealizedPnL === 0) {
            issues.push('🐛 maxUnrealizedPnL为0，可能导致除零错误或错误的回撤计算');
        }
        
        // 检查2: 负数处理
        const testDrawdown = this.calculateDrawdownForScenario(-100, -200);
        if (testDrawdown < 0) {
            issues.push('🐛 回撤计算可能产生负值');
        }
        
        // 检查3: 数据类型问题
        const riskState = this.riskManager.riskState;
        if (typeof riskState.maxUnrealizedPnL !== 'number' || 
            typeof riskState.unrealizedPnL !== 'number') {
            issues.push('🐛 PnL数据类型不正确');
        }
        
        // 检查4: 配置加载问题
        if (!this.riskManager.riskConfig.emergencyStopThreshold) {
            issues.push('🐛 紧急停止阈值未正确加载');
        }
        
        if (issues.length > 0) {
            console.log('🚨 发现潜在bug:');
            issues.forEach(issue => console.log(`   ${issue}`));
        } else {
            console.log('✅ 未发现明显的bug');
        }
        
        return issues.length === 0;
    }

    /**
     * 诊断5: 提供修复建议
     */
    provideFixSuggestions() {
        console.log('\n📋 诊断5: 修复建议');
        console.log('─'.repeat(50));
        
        console.log('💡 可能的解决方案:');
        
        console.log('\n1. 🔧 调整配置参数:');
        console.log('   - 增加紧急停止阈值 (当前10% -> 建议15-20%)');
        console.log('   - 增加风险检查间隔 (减少过度敏感)');
        console.log('   - 检查最大回撤设置是否合理');
        
        console.log('\n2. 🐛 修复回撤计算逻辑:');
        console.log('   - 确保maxUnrealizedPnL正确初始化');
        console.log('   - 使用账户总价值而非PnL计算回撤');
        console.log('   - 添加边界条件检查');
        
        console.log('\n3. 📊 改进数据更新:');
        console.log('   - 确保持仓和账户价值正确更新');
        console.log('   - 添加数据验证和异常处理');
        console.log('   - 记录详细的状态变化日志');
        
        console.log('\n4. 🔍 增强监控:');
        console.log('   - 添加回撤计算的详细日志');
        console.log('   - 实时监控风险状态变化');
        console.log('   - 设置预警机制');
    }

    // 辅助方法
    calculateDrawdownForScenario(maxPnL, currentPnL) {
        if (maxPnL <= 0) return 0;
        return Math.max(0, ((maxPnL - currentPnL) / maxPnL) * 100);
    }

    simulateTradeUpdate(position, midPrice, realizedPnL) {
        const positionValue = position * midPrice;
        this.riskManager.updatePosition(position, positionValue, midPrice);
        this.riskManager.updateRealizedPnL(realizedPnL);
        this.riskManager.updateAccountValue(positionValue + realizedPnL + 10000); // 假设有10000基础资金
    }

    logCurrentState() {
        const state = this.riskManager.riskState;
        const drawdown = this.riskManager.calculateDrawdown();
        
        console.log(`   状态: 最大PnL=${state.maxUnrealizedPnL.toFixed(2)}, 当前PnL=${state.unrealizedPnL.toFixed(2)}, 回撤=${drawdown.toFixed(2)}%`);
        
        if (drawdown > this.riskManager.riskConfig.emergencyStopThreshold) {
            console.log(`   🚨 触发紧急停止! (${drawdown.toFixed(2)}% > ${this.riskManager.riskConfig.emergencyStopThreshold}%)`);
        }
    }

    /**
     * 运行完整诊断
     */
    async runFullDiagnosis() {
        console.log('🚀 开始紧急停止触发原因诊断');
        console.log('='.repeat(60));
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ 诊断初始化失败，退出诊断');
            return;
        }
        
        const results = [];
        
        // 运行所有诊断
        results.push(this.diagnoseConfiguration());
        results.push(this.diagnoseDrawdownCalculation());
        results.push(this.diagnoseDataUpdateLogic());
        results.push(this.diagnosePotentialBugs());
        
        // 提供修复建议
        this.provideFixSuggestions();
        
        // 汇总结果
        console.log('\n📊 诊断结果汇总');
        console.log('='.repeat(60));
        
        const passedDiagnoses = results.filter(r => r === true).length;
        const totalDiagnoses = results.length;
        
        console.log(`通过诊断: ${passedDiagnoses}/${totalDiagnoses}`);
        
        if (passedDiagnoses === totalDiagnoses) {
            console.log('\n✅ 所有诊断通过，系统运行正常');
            console.log('💭 可能的原因:');
            console.log('   - 市场波动导致的正常回撤');
            console.log('   - 配置参数过于敏感');
            console.log('   - 短期价格波动触发阈值');
        } else {
            console.log('\n❌ 发现问题，需要进一步检查和修复');
        }
        
        // 清理
        this.cleanup();
    }

    cleanup() {
        try {
            if (this.riskManager) {
                this.riskManager.cleanup();
            }
            console.log('\n🧹 诊断环境已清理');
        } catch (error) {
            console.error('清理诊断环境时出错:', error.message);
        }
    }
}

// 运行诊断
if (require.main === module) {
    const diagnosis = new EmergencyTriggerDiagnosis();
    diagnosis.runFullDiagnosis().catch(error => {
        console.error('诊断执行失败:', error);
        process.exit(1);
    });
}

module.exports = EmergencyTriggerDiagnosis;