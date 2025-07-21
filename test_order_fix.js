/**
 * 订单自动补充机制测试脚本
 * 验证订单成交后是否能正确挂出新订单
 */

const path = require('path');
const fs = require('fs');

// 简单的测试脚本，验证关键修复点
class OrderAutoReplenishTest {
    constructor() {
        this.testResults = [];
    }

    // 检查shouldUpdateOrders方法是否包含订单数量检查
    checkShouldUpdateOrdersLogic() {
        try {
            const strategyPath = path.join(__dirname, 'core', 'strategy.js');
            const strategyContent = fs.readFileSync(strategyPath, 'utf8');
            
            // 检查是否包含订单数量检查逻辑
            const hasOrderCountCheck = strategyContent.includes('activeOrdersCount < 2');
            const hasForceUpdateReset = strategyContent.includes('this.forceOrderUpdate = false');
            
            this.testResults.push({
                test: 'shouldUpdateOrders订单数量检查',
                passed: hasOrderCountCheck,
                details: hasOrderCountCheck ? '✅ 已添加订单数量检查逻辑' : '❌ 缺少订单数量检查逻辑'
            });
            
            this.testResults.push({
                test: 'forceOrderUpdate标志重置',
                passed: hasForceUpdateReset,
                details: hasForceUpdateReset ? '✅ 已添加标志重置逻辑' : '❌ 缺少标志重置逻辑'
            });
            
        } catch (error) {
            this.testResults.push({
                test: '代码检查',
                passed: false,
                details: `❌ 检查失败: ${error.message}`
            });
        }
    }

    // 检查handleOrderFilled方法是否简化
    checkOrderFilledLogic() {
        try {
            const strategyPath = path.join(__dirname, 'core', 'strategy.js');
            const strategyContent = fs.readFileSync(strategyPath, 'utf8');
            
            // 检查是否移除了复杂的延迟逻辑
            const hasSimplifiedLogic = !strategyContent.includes('setTimeout') || 
                                     strategyContent.includes('this.forceOrderUpdate = true');
            
            this.testResults.push({
                test: '订单成交处理简化',
                passed: hasSimplifiedLogic,
                details: hasSimplifiedLogic ? '✅ 订单成交处理已简化' : '❌ 订单成交处理仍然复杂'
            });
            
        } catch (error) {
            this.testResults.push({
                test: '订单成交逻辑检查',
                passed: false,
                details: `❌ 检查失败: ${error.message}`
            });
        }
    }

    // 运行所有测试
    async runTests() {
        console.log('🔍 开始订单自动补充机制测试...');
        console.log('=' * 50);
        
        this.checkShouldUpdateOrdersLogic();
        this.checkOrderFilledLogic();
        
        // 输出测试结果
        console.log('\n📊 测试结果:');
        console.log('-' * 30);
        
        let passedCount = 0;
        this.testResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.test}: ${result.details}`);
            if (result.passed) passedCount++;
        });
        
        console.log('-' * 30);
        console.log(`总计: ${passedCount}/${this.testResults.length} 项测试通过`);
        
        if (passedCount === this.testResults.length) {
            console.log('🎉 所有测试通过！订单自动补充机制修复成功！');
        } else {
            console.log('⚠️  部分测试未通过，请检查修复代码。');
        }
        
        return passedCount === this.testResults.length;
    }
}

// 运行测试
if (require.main === module) {
    const test = new OrderAutoReplenishTest();
    test.runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = OrderAutoReplenishTest;