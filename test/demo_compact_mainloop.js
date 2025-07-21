/**
 * 演示优化后的主循环紧凑输出效果
 * 展示每次循环为一组的紧凑显示格式
 */

const path = require('path');
const fs = require('fs');

// 模拟策略类的核心方法
class MockAvellanedaStrategy {
    constructor() {
        this.isRunning = true;
        this.activeOrders = new Map();
        this.config = {
            get: (key) => {
                const configs = {
                    'updateInterval': 2000,
                    'baseCurrency': 'BTC',
                    'quoteCurrency': 'USDT'
                };
                return configs[key];
            }
        };
        
        // 模拟数据
        this.currentMarketData = {
            midPrice: 45230.50,
            bestBid: 45225.00,
            bestAsk: 45236.00,
            timestamp: Date.now()
        };
        
        this.strategyState = {
            optimalBid: 45220.00,
            optimalAsk: 45241.00,
            optimalSpread: 21.00,
            inventorySkew: 0.15,
            targetInventory: 0.5,
            currentInventory: 0.575
        };
        
        this.currentBalances = {
            baseAmount: 0.575,
            quoteAmount: 12450.30
        };
        
        this.indicators = {
            isReady: () => true,
            hasChanged: () => Math.random() > 0.3,
            getCurrentValues: () => ({
                volatility: 0.0234,
                tradingIntensity: 1.2345
            })
        };
        
        this.riskManager = {
            getRiskStatus: () => ({
                state: {
                    currentPosition: 0.575,
                    currentPositionValue: 26007.54,
                    totalAccountValue: 38457.84,
                    unrealizedPnL: 125.67,
                    dailyPnL: 89.23,
                    isEmergencyStop: false
                }
            })
        };
        
        this.lastUpdateTime = Date.now() - 5000;
        this.orderRefreshTime = 10;
        
        // 添加一些活跃订单
        this.activeOrders.set('order1', { side: 'buy', price: 45220.00 });
        this.activeOrders.set('order2', { side: 'sell', price: 45241.00 });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    printStrategyStatus() {
        const { optimalBid, optimalAsk, optimalSpread, inventorySkew, targetInventory, currentInventory } = this.strategyState;
        const { midPrice, bestBid, bestAsk } = this.currentMarketData;
        const indicators = this.indicators.getCurrentValues();
        const riskStatus = this.riskManager.getRiskStatus();
        
        // 超紧凑的单行状态显示
        console.log(`📊 市场 ${midPrice.toFixed(2)} (${bestBid.toFixed(2)}/${bestAsk.toFixed(2)}) | 策略 ${optimalBid.toFixed(2)}/${optimalAsk.toFixed(2)} | 库存 ${currentInventory.toFixed(4)}/${targetInventory.toFixed(4)} (${(inventorySkew * 100).toFixed(1)}%) | 波动率 ${(indicators.volatility * 100).toFixed(2)}% | 订单 ${this.activeOrders.size}个 | 盈亏 ${riskStatus.state.unrealizedPnL.toFixed(2)}`);
    }
    
    printOrderUpdateStatus() {
        const now = Date.now();
        const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
        const timeUntilNextUpdate = this.orderRefreshTime - timeSinceLastUpdate;
        
        console.log(`⏰ 更新: 上次 ${timeSinceLastUpdate.toFixed(1)}s | 下次 ${timeUntilNextUpdate.toFixed(1)}s | 指标变化 ${this.indicators.hasChanged() ? '✅' : '❌'} | 活跃订单 ${this.activeOrders.size}个`);
    }
    
    shouldUpdateOrders() {
        const now = Date.now();
        const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
        
        if (timeSinceLastUpdate < this.orderRefreshTime) {
            return false;
        }
        
        if (!this.indicators.hasChanged()) {
            return false;
        }
        
        return true;
    }
    
    async updateOrders() {
        // 模拟订单更新过程
        await this.sleep(100);
        this.lastUpdateTime = Date.now();
        console.log('✅ 订单更新完成');
    }
    
    async executeStrategy() {
        try {
            // 检查市场数据有效性
            if (!this.currentMarketData) {
                console.log('⚠️ 市场数据不可用，跳过策略执行');
                return;
            }
            
            // 打印策略状态信息
            this.printStrategyStatus();
            
            // 检查是否需要更新订单
            if (this.shouldUpdateOrders()) {
                console.log('🔄 更新订单中...');
                await this.updateOrders();
            } else {
                this.printOrderUpdateStatus();
            }
            
        } catch (error) {
            console.log(`❌ 策略执行出错: ${error.message}`);
        }
    }
    
    async mainLoop() {
        console.log('🚀 Avellaneda策略主循环启动');
        const loopTimeout = 30000;
        let lastLoopTime = Date.now();
        let loopCount = 0;
        
        // 只运行5次循环作为演示
        const maxLoops = 5;
        
        while (this.isRunning && loopCount < maxLoops) {
            try {
                loopCount++;
                const loopStartTime = Date.now();
                const timeSinceLastLoop = (loopStartTime - lastLoopTime) / 1000;
                
                console.log(`\n🔄 [循环 #${loopCount}] 开始 | 间隔 ${timeSinceLastLoop.toFixed(1)}s | 时间 ${new Date().toLocaleTimeString()}`);
                
                const loopPromise = (async () => {
                    // 检查指标是否准备就绪并执行策略
                    if (this.indicators.isReady()) {
                        await this.executeStrategy();
                    } else {
                        console.log('⏳ 技术指标尚未准备就绪，跳过策略执行');
                    }
                    
                    lastLoopTime = Date.now();
                    const loopDuration = (lastLoopTime - loopStartTime) / 1000;
                    console.log(`✅ [循环 #${loopCount}] 完成 | 耗时 ${loopDuration.toFixed(2)}s`);
                })();
                
                await loopPromise;
                
                const updateInterval = this.config.get('updateInterval') || 1000;
                await this.sleep(updateInterval);
                
                // 模拟数据变化
                this.currentMarketData.midPrice += (Math.random() - 0.5) * 10;
                this.currentMarketData.bestBid = this.currentMarketData.midPrice - 2.5;
                this.currentMarketData.bestAsk = this.currentMarketData.midPrice + 2.5;
                this.strategyState.currentInventory += (Math.random() - 0.5) * 0.01;
                
            } catch (error) {
                console.log(`❌ [循环 #${loopCount}] 执行出错: ${error.message}`);
                await this.sleep(5000);
            }
        }
        
        console.log('🛑 Avellaneda策略主循环停止');
    }
}

// 运行演示
async function runDemo() {
    console.log('='.repeat(80));
    console.log('📋 主循环紧凑输出格式演示');
    console.log('='.repeat(80));
    console.log('🎯 优化效果:');
    console.log('   • 每次循环为一组，清晰分隔');
    console.log('   • 单行显示核心状态信息');
    console.log('   • 减少冗余输出，提高信息密度');
    console.log('   • 保持关键信息的可读性');
    console.log('='.repeat(80));
    
    const strategy = new MockAvellanedaStrategy();
    await strategy.mainLoop();
    
    console.log('\n='.repeat(80));
    console.log('✅ 演示完成！主循环输出已优化为紧凑格式');
    console.log('='.repeat(80));
}

// 如果直接运行此文件
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = { MockAvellanedaStrategy, runDemo };