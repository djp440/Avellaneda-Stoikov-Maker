/**
 * 测试订单成交后的更新逻辑
 * 验证订单成交后是否能正确触发订单更新
 */

const AvellanedaStrategy = require('../core/strategy');
const config = require('../config/trading');

// 模拟配置对象，添加get方法
class TestConfig {
    constructor() {
        // 合并基础配置
        Object.assign(this, config);
        
        // 覆盖测试特定的配置
        this.orderTimeout = 30000; // 30秒订单超时
        this.filledOrderDelay = 1; // 1秒延迟
        this.priceChangeThreshold = 0.001; // 0.1%价格变化阈值
        this.updateInterval = 5000; // 5秒更新间隔
        this.symbol = 'BTC/USDT';
        this.exchange = 'bitget';
    }
    
    get(key) {
        return this[key];
    }
    
    isDevelopment() {
        return this.nodeEnv === 'development';
    }
}

const testConfig = new TestConfig();

/**
 * 测试订单成交后的强制更新逻辑
 */
async function testOrderFilledUpdate() {
    console.log('🧪 开始测试订单成交后的更新逻辑...');
    
    try {
        // 创建策略实例
        const strategy = new AvellanedaStrategy(testConfig);
        
        // 模拟初始状态
        strategy.isRunning = true;
        strategy.lastUpdateTime = Date.now() - 10000; // 10秒前
        strategy.forceOrderUpdate = false;
        
        // 模拟策略状态
        strategy.strategyState = {
            optimalBid: 118500,
            optimalAsk: 118600
        };
        
        strategy.lastOrderPrices = {
            bid: 118400,
            ask: 118500,
            timestamp: Date.now() - 10000
        };
        
        // 模拟活跃订单
        strategy.activeOrders.set('test_order_1', {
            id: 'test_order_1',
            side: 'sell',
            amount: 0.001,
            price: 118500
        });
        
        console.log('📊 初始状态:');
        console.log(`   - forceOrderUpdate: ${strategy.forceOrderUpdate}`);
        console.log(`   - lastUpdateTime: ${new Date(strategy.lastUpdateTime).toLocaleTimeString()}`);
        console.log(`   - 活跃订单数量: ${strategy.activeOrders.size}`);
        
        // 测试1: 正常情况下是否需要更新
        console.log('\n🔍 测试1: 检查正常情况下的更新条件');
        const shouldUpdateBefore = strategy.shouldUpdateOrders();
        console.log(`   - shouldUpdateOrders(): ${shouldUpdateBefore}`);
        
        // 测试2: 模拟订单成交
        console.log('\n🔍 测试2: 模拟订单成交');
        const mockFilledOrder = {
            id: 'test_order_1',
            side: 'sell',
            amount: 0.001,
            price: 118500,
            cost: 118.5,
            filled: 0.001,
            remaining: 0,
            clientOrderId: 'test_client_1'
        };
        
        // 调用订单成交处理
        strategy.handleOrderFilled(mockFilledOrder);
        
        console.log(`   - 订单成交后 forceOrderUpdate: ${strategy.forceOrderUpdate}`);
        console.log(`   - 活跃订单数量: ${strategy.activeOrders.size}`);
        
        // 测试3: 检查成交后是否需要更新
        console.log('\n🔍 测试3: 检查成交后的更新条件');
        const shouldUpdateAfter = strategy.shouldUpdateOrders();
        console.log(`   - shouldUpdateOrders(): ${shouldUpdateAfter}`);
        
        // 测试4: 测试时间显示逻辑
        console.log('\n🔍 测试4: 测试时间显示逻辑');
        strategy.printOrderUpdateStatus();
        
        // 测试5: 模拟延迟后的更新
        console.log('\n🔍 测试5: 等待延迟更新...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // 等待1.5秒
        
        console.log(`   - 延迟后 forceOrderUpdate: ${strategy.forceOrderUpdate}`);
        console.log(`   - 延迟后 lastUpdateTime: ${strategy.lastUpdateTime}`);
        
        // 测试6: 测试负数时间修复
        console.log('\n🔍 测试6: 测试负数时间修复');
        strategy.lastUpdateTime = 0; // 重置为0
        strategy.printOrderUpdateStatus();
        
        console.log('\n✅ 订单成交更新逻辑测试完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

/**
 * 测试时间计算逻辑
 */
function testTimeCalculation() {
    console.log('\n🧪 开始测试时间计算逻辑...');
    
    const strategy = new AvellanedaStrategy(testConfig);
    
    // 测试场景1: 正常时间
    console.log('\n📊 场景1: 正常时间计算');
    strategy.lastUpdateTime = Date.now() - 10000; // 10秒前
    strategy.forceOrderUpdate = false;
    strategy.printOrderUpdateStatus();
    
    // 测试场景2: 超时情况
    console.log('\n📊 场景2: 超时情况');
    strategy.lastUpdateTime = Date.now() - 40000; // 40秒前
    strategy.forceOrderUpdate = false;
    strategy.printOrderUpdateStatus();
    
    // 测试场景3: 强制更新
    console.log('\n📊 场景3: 强制更新状态');
    strategy.lastUpdateTime = Date.now() - 10000;
    strategy.forceOrderUpdate = true;
    strategy.printOrderUpdateStatus();
    
    // 测试场景4: lastUpdateTime为0
    console.log('\n📊 场景4: lastUpdateTime为0');
    strategy.lastUpdateTime = 0;
    strategy.forceOrderUpdate = false;
    strategy.printOrderUpdateStatus();
    
    console.log('\n✅ 时间计算逻辑测试完成');
}

// 运行测试
if (require.main === module) {
    (async () => {
        await testOrderFilledUpdate();
        testTimeCalculation();
    })();
}

module.exports = {
    testOrderFilledUpdate,
    testTimeCalculation
};