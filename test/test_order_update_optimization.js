/**
 * 测试订单更新优化功能
 * 验证价格变化阈值是否能有效避免无意义的订单更新
 */

const AvellanedaStrategy = require('../core/strategy');
const Config = require('../config/trading');

// 模拟配置
class MockConfig {
    constructor(config) {
        this.config = config;
    }
    
    get(key) {
        return this.config[key];
    }
    
    isDevelopment() {
        return this.config.nodeEnv === 'development';
    }
}

// 模拟交易所管理器
class MockExchangeManager {
    constructor() {
        this.balances = {
            BTC: { free: 0.1, used: 0, total: 0.1 },
            USDT: { free: 10000, used: 0, total: 10000 }
        };
    }
    
    getBalances() {
        return this.balances;
    }
    
    getMarketInfo() {
        return {
            precision: {
                amount: 0.00000001,
                price: 0.01
            }
        };
    }
    
    on() {}
    
    async fetchOrderBook() {
        return {
            bids: [[50000, 1]],
            asks: [[50100, 1]]
        };
    }
    
    async fetchTicker() {
        return {
            last: 50050
        };
    }
}

// 模拟计算器
class MockCalculator {
    updateState() {
        return {
            optimalBid: 50000,
            optimalAsk: 50100,
            optimalSpread: 100,
            inventorySkew: 0,
            targetInventory: 0,
            inventoryValue: {
                baseValue: 5000,
                totalValue: 15000
            }
        };
    }
}

// 模拟指标管理器
class MockIndicators {
    constructor() {
        this.changed = true;
    }
    
    hasChanged() {
        return this.changed;
    }
    
    setChanged(value) {
        this.changed = value;
    }
    
    isReady() {
        return true;
    }
    
    getCurrentValues() {
        return {
            volatility: 0.02,
            tradingIntensity: 0.5
        };
    }
    
    getStatus() {
        return { ready: true };
    }
    
    on() {}
}

// 模拟风险管理器
class MockRiskManager {
    constructor() {
        this.state = {
            isEmergencyStop: false,
            unrealizedPnL: 0
        };
    }
    
    getRiskStatus() {
        return { state: this.state };
    }
    
    updatePosition() {}
    
    updateAccountValue() {}
    
    validateOrder() {
        return { valid: true };
    }
    
    on() {}
}

async function testOrderUpdateOptimization() {
    console.log('🧪 开始测试订单更新优化功能');
    console.log('=' .repeat(60));
    
    // 创建模拟策略对象（只包含必要的属性和方法）
    const strategy = {
        priceChangeThreshold: 0.001, // 0.1%的价格变化阈值
        orderRefreshTime: 30, // 30秒
        lastUpdateTime: 0,
        lastOrderPrices: {
            bid: 0,
            ask: 0,
            timestamp: 0
        },
        strategyState: {
            optimalBid: 0,
            optimalAsk: 0
        },
        indicators: new MockIndicators(),
        activeOrders: new Map(),
        
        // 复制shouldUpdateOrders方法
        shouldUpdateOrders() {
            const now = Date.now();
            const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
            
            // 检查订单刷新时间
            if (timeSinceLastUpdate < this.orderRefreshTime) {
                return false;
            }
            
            // 检查指标是否有变化
            if (!this.indicators.hasChanged()) {
                return false;
            }
            
            // 检查价格是否有显著变化（避免无意义的订单更新）
            const { optimalBid, optimalAsk } = this.strategyState;
            const { bid: lastBid, ask: lastAsk } = this.lastOrderPrices;
            
            // 如果是第一次创建订单，直接返回true
            if (lastBid === 0 || lastAsk === 0) {
                return true;
            }
            
            // 计算价格变化百分比
            const bidChangePercent = Math.abs((optimalBid - lastBid) / lastBid);
            const askChangePercent = Math.abs((optimalAsk - lastAsk) / lastAsk);
            
            // 只有当买价或卖价变化超过阈值时才更新订单
            const shouldUpdate = bidChangePercent >= this.priceChangeThreshold || 
                               askChangePercent >= this.priceChangeThreshold;
            
            if (!shouldUpdate) {
                console.log(`价格变化未达到阈值，跳过订单更新: 买价变化${(bidChangePercent * 100).toFixed(4)}%, 卖价变化${(askChangePercent * 100).toFixed(4)}%, 阈值${(this.priceChangeThreshold * 100).toFixed(1)}%`);
            }
            
            return shouldUpdate;
        },
        
        // 复制printOrderUpdateStatus方法
        printOrderUpdateStatus() {
            const now = Date.now();
            const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
            const timeUntilNextUpdate = this.orderRefreshTime - timeSinceLastUpdate;
            
            // 计算价格变化
            const { optimalBid, optimalAsk } = this.strategyState;
            const { bid: lastBid, ask: lastAsk } = this.lastOrderPrices;
            let priceChangeInfo = '';
            
            if (lastBid > 0 && lastAsk > 0) {
                const bidChangePercent = Math.abs((optimalBid - lastBid) / lastBid);
                const askChangePercent = Math.abs((optimalAsk - lastAsk) / lastAsk);
                const maxChange = Math.max(bidChangePercent, askChangePercent);
                const thresholdMet = maxChange >= this.priceChangeThreshold;
                
                priceChangeInfo = `价格变化 ${(maxChange * 100).toFixed(3)}%/${(this.priceChangeThreshold * 100).toFixed(1)}% ${thresholdMet ? '✅' : '❌'}`;
            } else {
                priceChangeInfo = '价格变化 首次 ✅';
            }
            
            console.log(`⏰ 更新: 上次 ${timeSinceLastUpdate.toFixed(1)}s | 下次 ${timeUntilNextUpdate.toFixed(1)}s | 指标变化 ${this.indicators.hasChanged() ? '✅' : '❌'} | ${priceChangeInfo} | 活跃订单 ${this.activeOrders.size}个`);
        }
    };
    
    // 初始化市场数据
    strategy.strategyState.optimalBid = 49900;
    strategy.strategyState.optimalAsk = 50100;
    
    // 测试场景1：首次订单更新（应该更新）
    console.log('\n📋 测试场景1：首次订单更新');
    strategy.strategyState = {
        optimalBid: 50000,
        optimalAsk: 50100,
        optimalSpread: 100,
        inventorySkew: 0,
        targetInventory: 0,
        currentInventory: 0.1,
        totalInventoryValue: 15000
    };
    
    strategy.lastUpdateTime = Date.now() - 31000; // 超过30秒
    const shouldUpdate1 = strategy.shouldUpdateOrders();
    console.log(`结果：${shouldUpdate1 ? '✅ 应该更新' : '❌ 不应该更新'}`);
    
    // 模拟首次订单创建
    strategy.lastOrderPrices = {
        bid: 50000,
        ask: 50100,
        timestamp: Date.now()
    };
    
    // 测试场景2：价格变化很小（不应该更新）
    console.log('\n📋 测试场景2：价格变化很小（0.05%）');
    strategy.strategyState.optimalBid = 50025; // 变化0.05%
    strategy.strategyState.optimalAsk = 50125; // 变化约0.05%
    strategy.lastUpdateTime = Date.now() - 31000; // 超过30秒
    
    const shouldUpdate2 = strategy.shouldUpdateOrders();
    console.log(`当前买价：${strategy.strategyState.optimalBid}，上次买价：${strategy.lastOrderPrices.bid}`);
    console.log(`当前卖价：${strategy.strategyState.optimalAsk}，上次卖价：${strategy.lastOrderPrices.ask}`);
    console.log(`买价变化：${(Math.abs((strategy.strategyState.optimalBid - strategy.lastOrderPrices.bid) / strategy.lastOrderPrices.bid) * 100).toFixed(4)}%`);
    console.log(`卖价变化：${(Math.abs((strategy.strategyState.optimalAsk - strategy.lastOrderPrices.ask) / strategy.lastOrderPrices.ask) * 100).toFixed(4)}%`);
    console.log(`阈值：${(strategy.priceChangeThreshold * 100).toFixed(1)}%`);
    console.log(`结果：${shouldUpdate2 ? '✅ 应该更新' : '❌ 不应该更新（符合预期）'}`);
    
    // 测试场景3：价格变化较大（应该更新）
    console.log('\n📋 测试场景3：价格变化较大（0.2%）');
    strategy.strategyState.optimalBid = 50100; // 变化0.2%
    strategy.strategyState.optimalAsk = 50200; // 变化约0.15%
    strategy.lastUpdateTime = Date.now() - 31000; // 超过30秒
    
    const shouldUpdate3 = strategy.shouldUpdateOrders();
    console.log(`当前买价：${strategy.strategyState.optimalBid}，上次买价：${strategy.lastOrderPrices.bid}`);
    console.log(`当前卖价：${strategy.strategyState.optimalAsk}，上次卖价：${strategy.lastOrderPrices.ask}`);
    console.log(`买价变化：${(Math.abs((strategy.strategyState.optimalBid - strategy.lastOrderPrices.bid) / strategy.lastOrderPrices.bid) * 100).toFixed(4)}%`);
    console.log(`卖价变化：${(Math.abs((strategy.strategyState.optimalAsk - strategy.lastOrderPrices.ask) / strategy.lastOrderPrices.ask) * 100).toFixed(4)}%`);
    console.log(`阈值：${(strategy.priceChangeThreshold * 100).toFixed(1)}%`);
    console.log(`结果：${shouldUpdate3 ? '✅ 应该更新（符合预期）' : '❌ 不应该更新'}`);
    
    // 测试场景4：时间未到（不应该更新）
    console.log('\n📋 测试场景4：时间未到（即使价格变化大）');
    strategy.strategyState.optimalBid = 50500; // 变化1%
    strategy.strategyState.optimalAsk = 50600;
    strategy.lastUpdateTime = Date.now() - 10000; // 只过了10秒
    
    const shouldUpdate4 = strategy.shouldUpdateOrders();
    console.log(`距离上次更新：${((Date.now() - strategy.lastUpdateTime) / 1000).toFixed(1)}秒`);
    console.log(`订单刷新时间：${strategy.orderRefreshTime}秒`);
    console.log(`结果：${shouldUpdate4 ? '✅ 应该更新' : '❌ 不应该更新（符合预期）'}`);
    
    // 测试场景5：指标未变化（不应该更新）
    console.log('\n📋 测试场景5：指标未变化（即使价格变化大且时间到了）');
    strategy.indicators.setChanged(false);
    strategy.strategyState.optimalBid = 51000; // 变化2%
    strategy.strategyState.optimalAsk = 51100;
    strategy.lastUpdateTime = Date.now() - 31000; // 超过30秒
    
    const shouldUpdate5 = strategy.shouldUpdateOrders();
    console.log(`指标是否变化：${strategy.indicators.hasChanged()}`);
    console.log(`结果：${shouldUpdate5 ? '✅ 应该更新' : '❌ 不应该更新（符合预期）'}`);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 订单更新优化功能测试完成');
    
    // 测试printOrderUpdateStatus方法
    console.log('\n📊 测试订单更新状态显示：');
    strategy.indicators.setChanged(true);
    strategy.lastUpdateTime = Date.now() - 25000; // 25秒前
    strategy.activeOrders = new Map();
    strategy.activeOrders.set('order1', {});
    strategy.activeOrders.set('order2', {});
    
    strategy.printOrderUpdateStatus();
}

// 运行测试
testOrderUpdateOptimization().catch(console.error);