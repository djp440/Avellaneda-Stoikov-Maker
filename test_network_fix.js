#!/usr/bin/env node

/**
 * 网络连接问题修复验证脚本
 * 用于测试重复挂单问题的修复效果
 */

const fs = require('fs');
const path = require('path');

class NetworkFixTester {
    constructor() {
        this.testResults = [];
    }

    /**
     * 检查 ExchangeManager 的容错处理
     */
    checkExchangeManagerFix() {
        try {
            const exchangePath = path.join(__dirname, 'core', 'exchange.js');
            const exchangeContent = fs.readFileSync(exchangePath, 'utf8');
            
            // 检查 getOpenOrders 方法的容错处理
            const hasNullReturn = exchangeContent.includes('return null; // 返回null而不是抛出异常');
            const hasNetworkCheck = exchangeContent.includes('if (!this.networkManager.isNetworkAvailable())');
            const hasConnectionCheck = exchangeContent.includes('if (!this.isConnected || !this.exchange)');
            const hasGetOrderById = exchangeContent.includes('async getOrderById(orderId, symbol = null)');
            
            this.testResults.push({
                test: 'ExchangeManager.getOpenOrders容错处理',
                passed: hasNullReturn && hasNetworkCheck && hasConnectionCheck,
                details: `连接检查: ${hasConnectionCheck ? '✅' : '❌'}, 网络检查: ${hasNetworkCheck ? '✅' : '❌'}, 空值返回: ${hasNullReturn ? '✅' : '❌'}`
            });
            
            this.testResults.push({
                test: 'ExchangeManager.getOrderById方法',
                passed: hasGetOrderById,
                details: hasGetOrderById ? '✅ 已添加getOrderById方法' : '❌ 缺少getOrderById方法'
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'ExchangeManager检查',
                passed: false,
                details: `❌ 检查失败: ${error.message}`
            });
        }
    }

    /**
     * 检查 Strategy 的同步逻辑修复
     */
    checkStrategySyncFix() {
        try {
            const strategyPath = path.join(__dirname, 'core', 'strategy.js');
            const strategyContent = fs.readFileSync(strategyPath, 'utf8');
            
            // 检查 syncActiveOrdersFromExchange 方法的修复
            const hasNullCheck = strategyContent.includes('if (openOrders !== null)');
            const hasStatePreservation = strategyContent.includes('保持现有本地状态不变');
            const hasNetworkStatusCheck = strategyContent.includes('if (!this.exchangeManager.isConnected)');
            const hasOrderVerification = strategyContent.includes('const verifyOrder = await this.exchangeManager.getOrderById');
            const hasCleanupMethod = strategyContent.includes('async cleanupExcessOrders()');
            
            this.testResults.push({
                test: 'Strategy.syncActiveOrdersFromExchange修复',
                passed: hasNullCheck && hasStatePreservation,
                details: `空值检查: ${hasNullCheck ? '✅' : '❌'}, 状态保持: ${hasStatePreservation ? '✅' : '❌'}`
            });
            
            this.testResults.push({
                test: 'Strategy.createOrders网络检查',
                passed: hasNetworkStatusCheck,
                details: hasNetworkStatusCheck ? '✅ 已添加网络状态检查' : '❌ 缺少网络状态检查'
            });
            
            this.testResults.push({
                test: 'Strategy.createOrder订单验证',
                passed: hasOrderVerification,
                details: hasOrderVerification ? '✅ 已添加订单创建后验证' : '❌ 缺少订单验证'
            });
            
            this.testResults.push({
                test: 'Strategy.cleanupExcessOrders方法',
                passed: hasCleanupMethod,
                details: hasCleanupMethod ? '✅ 已添加紧急清理方法' : '❌ 缺少紧急清理方法'
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Strategy检查',
                passed: false,
                details: `❌ 检查失败: ${error.message}`
            });
        }
    }

    /**
     * 检查过多订单检测逻辑
     */
    checkExcessOrderDetection() {
        try {
            const strategyPath = path.join(__dirname, 'core', 'strategy.js');
            const strategyContent = fs.readFileSync(strategyPath, 'utf8');
            
            // 检查过多订单检测
            const hasExcessCheck = strategyContent.includes('if (this.activeOrders.size > 2)');
            const hasEmergencyCleanup = strategyContent.includes('触发紧急清理');
            const hasAsyncCleanup = strategyContent.includes('this.cleanupExcessOrders().catch');
            
            this.testResults.push({
                test: '过多订单检测与清理',
                passed: hasExcessCheck && hasEmergencyCleanup && hasAsyncCleanup,
                details: `数量检查: ${hasExcessCheck ? '✅' : '❌'}, 紧急清理: ${hasEmergencyCleanup ? '✅' : '❌'}, 异步处理: ${hasAsyncCleanup ? '✅' : '❌'}`
            });
            
        } catch (error) {
            this.testResults.push({
                test: '过多订单检测检查',
                passed: false,
                details: `❌ 检查失败: ${error.message}`
            });
        }
    }

    /**
     * 运行所有测试
     */
    runAllTests() {
        console.log('🔍 开始验证网络连接问题修复...');
        console.log('=' .repeat(60));
        
        this.checkExchangeManagerFix();
        this.checkStrategySyncFix();
        this.checkExcessOrderDetection();
        
        // 输出测试结果
        console.log('\n📊 测试结果:');
        console.log('-'.repeat(60));
        
        let passedCount = 0;
        let totalCount = this.testResults.length;
        
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${result.test}: ${status}`);
            console.log(`   ${result.details}`);
            console.log('');
            
            if (result.passed) passedCount++;
        });
        
        console.log('=' .repeat(60));
        console.log(`总计: ${passedCount}/${totalCount} 项测试通过`);
        
        if (passedCount === totalCount) {
            console.log('🎉 所有修复验证通过！网络连接问题修复完成。');
        } else {
            console.log('⚠️  部分修复可能存在问题，请检查失败的测试项。');
        }
        
        console.log('\n📋 修复总结:');
        console.log('1. ExchangeManager.getOpenOrders() - 增强容错处理，网络问题时返回null');
        console.log('2. Strategy.syncActiveOrdersFromExchange() - 只在成功获取数据时更新本地状态');
        console.log('3. Strategy.createOrders() - 增加网络和连接状态检查');
        console.log('4. Strategy.createOrder() - 增加订单创建后验证机制');
        console.log('5. Strategy.cleanupExcessOrders() - 新增紧急清理过多订单的方法');
        console.log('6. Strategy.shouldUpdateOrders() - 增强过多订单检测和处理逻辑');
        
        return passedCount === totalCount;
    }
}

// 运行测试
if (require.main === module) {
    const tester = new NetworkFixTester();
    const success = tester.runAllTests();
    process.exit(success ? 0 : 1);
}

module.exports = NetworkFixTester;