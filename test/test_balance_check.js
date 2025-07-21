const AvellanedaStrategy = require('../core/strategy');
const StrategyConfig = require('../config/strategy');
const Logger = require('../utils/logger');

/**
 * 余额检查功能测试脚本
 * 测试策略在余额不足时是否能正确阻止订单创建
 */
class BalanceCheckTest {
    constructor() {
        this.config = new StrategyConfig();
        this.logger = new Logger(this.config);
        this.strategy = null;
    }

    async runTest() {
        console.log('🧪 开始余额检查功能测试');
        console.log('=' .repeat(60));

        try {
            // 初始化策略
            await this.initializeStrategy();

            // 测试1: 正常余额情况
            await this.testSufficientBalance();

            // 测试2: BTC余额不足的卖单
            await this.testInsufficientBTCBalance();

            // 测试3: USDT余额不足的买单
            await this.testInsufficientUSDTBalance();

            // 测试4: 边界情况测试
            await this.testBoundaryConditions();

            console.log('\n✅ 所有余额检查测试完成');
            console.log('=' .repeat(60));

        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error.message);
            this.logger.error('余额检查测试失败', error);
        } finally {
            if (this.strategy) {
                await this.strategy.stop();
            }
        }
    }

    async initializeStrategy() {
        console.log('\n📋 初始化策略...');
        this.strategy = new AvellanedaStrategy(this.config);
        
        // 模拟初始化但不启动实际交易
        console.log('✅ 策略初始化完成');
    }

    async testSufficientBalance() {
        console.log('\n🟢 测试1: 充足余额情况');
        console.log('-' .repeat(40));

        // 模拟充足的余额
        const sufficientBalances = {
            BTC: { free: 1.0, used: 0, total: 1.0 },
            USDT: { free: 50000, used: 0, total: 50000 }
        };

        // 测试买单验证
        const buyValidation = this.strategy.riskManager.validateOrder(
            'buy', 0.001, 45000, sufficientBalances
        );
        console.log('买单验证结果:', buyValidation.valid ? '✅ 通过' : '❌ 失败');
        if (!buyValidation.valid) {
            console.log('失败原因:', buyValidation.reason);
        }

        // 测试卖单验证
        const sellValidation = this.strategy.riskManager.validateOrder(
            'sell', 0.001, 45000, sufficientBalances
        );
        console.log('卖单验证结果:', sellValidation.valid ? '✅ 通过' : '❌ 失败');
        if (!sellValidation.valid) {
            console.log('失败原因:', sellValidation.reason);
        }
    }

    async testInsufficientBTCBalance() {
        console.log('\n🔴 测试2: BTC余额不足的卖单');
        console.log('-' .repeat(40));

        // 模拟BTC余额不足
        const insufficientBTCBalances = {
            BTC: { free: 0.0001, used: 0, total: 0.0001 }, // 只有很少的BTC
            USDT: { free: 50000, used: 0, total: 50000 }
        };

        // 尝试创建需要更多BTC的卖单
        const sellValidation = this.strategy.riskManager.validateOrder(
            'sell', 0.001, 45000, insufficientBTCBalances // 需要0.001 BTC，但只有0.0001
        );
        
        console.log('卖单验证结果:', sellValidation.valid ? '❌ 意外通过' : '✅ 正确拒绝');
        if (!sellValidation.valid) {
            console.log('拒绝原因:', sellValidation.reason);
            console.log('验证类型:', sellValidation.type);
            console.log('需要数量:', sellValidation.required);
            console.log('可用数量:', sellValidation.available);
        }
    }

    async testInsufficientUSDTBalance() {
        console.log('\n🔴 测试3: USDT余额不足的买单');
        console.log('-' .repeat(40));

        // 模拟USDT余额不足
        const insufficientUSDTBalances = {
            BTC: { free: 1.0, used: 0, total: 1.0 },
            USDT: { free: 10, used: 0, total: 10 } // 只有10 USDT
        };

        // 尝试创建需要更多USDT的买单
        const buyValidation = this.strategy.riskManager.validateOrder(
            'buy', 0.001, 45000, insufficientUSDTBalances // 需要45 USDT，但只有10
        );
        
        console.log('买单验证结果:', buyValidation.valid ? '❌ 意外通过' : '✅ 正确拒绝');
        if (!buyValidation.valid) {
            console.log('拒绝原因:', buyValidation.reason);
            console.log('验证类型:', buyValidation.type);
            console.log('需要数量:', buyValidation.required);
            console.log('可用数量:', buyValidation.available);
        }
    }

    async testBoundaryConditions() {
        console.log('\n🟡 测试4: 边界情况测试');
        console.log('-' .repeat(40));

        // 测试恰好足够的余额
        const exactBalances = {
            BTC: { free: 0.001, used: 0, total: 0.001 },
            USDT: { free: 45, used: 0, total: 45 }
        };

        // 测试恰好足够的BTC卖单
        const exactSellValidation = this.strategy.riskManager.validateOrder(
            'sell', 0.001, 45000, exactBalances
        );
        console.log('恰好足够BTC的卖单:', exactSellValidation.valid ? '✅ 通过' : '❌ 失败');

        // 测试恰好足够的USDT买单
        const exactBuyValidation = this.strategy.riskManager.validateOrder(
            'buy', 0.001, 45000, exactBalances
        );
        console.log('恰好足够USDT的买单:', exactBuyValidation.valid ? '✅ 通过' : '❌ 失败');

        // 测试空余额
        const emptyBalances = {
            BTC: { free: 0, used: 0, total: 0 },
            USDT: { free: 0, used: 0, total: 0 }
        };

        const emptyBTCValidation = this.strategy.riskManager.validateOrder(
            'sell', 0.001, 45000, emptyBalances
        );
        console.log('空BTC余额的卖单:', emptyBTCValidation.valid ? '❌ 意外通过' : '✅ 正确拒绝');

        const emptyUSDTValidation = this.strategy.riskManager.validateOrder(
            'buy', 0.001, 45000, emptyBalances
        );
        console.log('空USDT余额的买单:', emptyUSDTValidation.valid ? '❌ 意外通过' : '✅ 正确拒绝');

        // 测试无余额信息的情况（向后兼容）
        const noBalanceValidation = this.strategy.riskManager.validateOrder(
            'buy', 0.001, 45000, null
        );
        console.log('无余额信息的订单:', noBalanceValidation.valid ? '✅ 通过（向后兼容）' : '❌ 失败');
    }
}

// 运行测试
if (require.main === module) {
    const test = new BalanceCheckTest();
    test.runTest().catch(console.error);
}

module.exports = BalanceCheckTest;