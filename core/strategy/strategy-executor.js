/**
 * 策略执行模块
 * 负责策略的主循环和执行逻辑
 */

class StrategyExecutor {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.exchangeManager = strategy.exchangeManager;
        this.calculator = strategy.calculator;
        this.indicators = strategy.indicators;
        this.riskManager = strategy.riskManager;
        this.marketDataManager = strategy.marketDataManager;
        this.orderManager = strategy.orderManager;
        this.config = strategy.config;
        
        // 策略状态
        this.strategyState = {
            optimalBid: 0,
            optimalAsk: 0,
            currentInventory: 0,
            targetInventory: 0,
            totalInventoryValue: 0,
            reserveAmount: 0,
            lastUpdateTime: 0
        };
        
        // 主循环控制
        this.mainLoopInterval = null;
        this.mainLoopRunning = false;
        this.mainLoopTimeout = this.config.get('mainLoopTimeout') || 30000; // 默认30秒
        this.mainLoopDelay = this.config.get('mainLoopDelay') || 1000; // 默认1秒
        
        // 价格变化阈值
        this.priceChangeThreshold = this.config.get('priceChangeThreshold') || 0.005; // 默认0.5%
    }
    
    /**
     * 获取策略状态
     * @returns {Object} 策略状态对象
     */
    getStrategyState() {
        return { ...this.strategyState };
    }
    
    /**
     * 启动主循环
     */
    startMainLoop() {
        if (this.mainLoopRunning) {
            this.logger.warn('主循环已在运行中');
            return;
        }
        
        this.mainLoopRunning = true;
        this.logger.info('启动策略主循环', {
            mainLoopDelay: this.mainLoopDelay,
            mainLoopTimeout: this.mainLoopTimeout
        });
        
        // 立即执行一次
        this.executeMainLoop();
        
        // 设置定时执行
        this.mainLoopInterval = setInterval(() => {
            this.executeMainLoop();
        }, this.mainLoopDelay);
    }
    
    /**
     * 停止主循环
     */
    stopMainLoop() {
        if (!this.mainLoopRunning) {
            return;
        }
        
        if (this.mainLoopInterval) {
            clearInterval(this.mainLoopInterval);
            this.mainLoopInterval = null;
        }
        
        this.mainLoopRunning = false;
        this.logger.info('策略主循环已停止');
    }
    
    /**
     * 执行主循环
     */
    async executeMainLoop() {
        if (!this.strategy.isRunning) {
            this.stopMainLoop();
            return;
        }
        
        try {
            // 记录循环开始时间
            const loopStartTime = Date.now();
            
            // 检查循环超时
            if (this.lastLoopStartTime && (loopStartTime - this.lastLoopStartTime) > this.mainLoopTimeout) {
                this.logger.warn('主循环超时', {
                    lastLoopStartTime: this.lastLoopStartTime,
                    currentTime: loopStartTime,
                    timeout: this.mainLoopTimeout
                });
            }
            
            this.lastLoopStartTime = loopStartTime;
            
            // 检查风险状态
            const riskStatus = this.riskManager.getRiskStatus();
            if (riskStatus.status !== 'normal') {
                this.logger.warn('风险状态异常，跳过策略执行', riskStatus);
                return;
            }
            
            // 更新市场数据
            await this.updateMarketData();
            
            // 更新账户余额
            await this.updateBalances();
            
            // 更新技术指标
            this.updateIndicators();
            
            // 执行策略
            await this.executeStrategy();
            
            // 记录循环结束时间
            const loopEndTime = Date.now();
            const loopDuration = loopEndTime - loopStartTime;
            
            this.logger.debug('主循环执行完成', {
                duration: loopDuration,
                timestamp: new Date(loopEndTime).toISOString()
            });
            
        } catch (error) {
            this.logger.error('主循环执行出错', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * 更新市场数据
     */
    async updateMarketData() {
        try {
            // 从交易所获取最新市场数据
            const success = await this.marketDataManager.fetchMarketDataFromExchange();
            
            if (!success) {
                this.logger.warn('无法获取最新市场数据');
                return false;
            }
            
            // 获取当前市场数据
            const marketData = this.marketDataManager.getMarketData();
            
            // 检查数据有效性
            if (!marketData.midPrice || !marketData.orderBook) {
                this.logger.warn('市场数据不完整', marketData);
                return false;
            }
            
            return true;
            
        } catch (error) {
            this.logger.error('更新市场数据失败', error);
            return false;
        }
    }
    
    /**
     * 更新账户余额
     */
    async updateBalances() {
        try {
            // 获取最新余额
            const balances = await this.exchangeManager.fetchBalances();
            
            if (!balances) {
                this.logger.warn('无法获取最新余额');
                return false;
            }
            
            // 更新市场数据管理器中的余额
            this.marketDataManager.updateBalances({
                baseAmount: balances.base.free,
                quoteAmount: balances.quote.free,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            this.logger.error('更新账户余额失败', error);
            return false;
        }
    }
    
    /**
     * 更新技术指标
     */
    updateIndicators() {
        try {
            const marketData = this.marketDataManager.getMarketData();
            
            // 更新价格指标
            if (marketData.midPrice) {
                this.indicators.updatePrice(marketData.midPrice, Date.now());
            }
            
            // 更新订单簿指标
            if (marketData.orderBook && marketData.orderBook.bids && marketData.orderBook.asks) {
                this.indicators.updateOrderBook(
                    marketData.orderBook.bids,
                    marketData.orderBook.asks,
                    Date.now()
                );
            }
            
            // 检查指标是否就绪
            if (!this.indicators.isReady()) {
                this.logger.info('技术指标尚未就绪，等待更多数据');
                return false;
            }
            
            return true;
            
        } catch (error) {
            this.logger.error('更新技术指标失败', error);
            return false;
        }
    }
    
    /**
     * 执行策略
     */
    async executeStrategy() {
        try {
            // 定期同步订单状态
            const syncInterval = this.config.get('orderSyncInterval') || 60000; // 默认1分钟
            const now = Date.now();
            
            if (!this.lastOrderSyncTime || (now - this.lastOrderSyncTime) > syncInterval) {
                await this.orderManager.syncActiveOrdersFromExchange();
                this.lastOrderSyncTime = now;
            }
            
            // 获取市场数据
            const marketData = this.marketDataManager.getMarketData();
            
            // 检查市场数据有效性
            if (!this.marketDataManager.isMarketDataValid()) {
                this.logger.warn('市场数据无效或过期，跳过策略执行');
                return;
            }
            
            // 获取当前余额
            const balances = marketData.balances;
            
            // 计算当前库存
            const currentInventory = balances.baseAmount;
            const targetInventory = this.config.get('targetInventory') || 0;
            
            // 计算库存价值
            const totalInventoryValue = currentInventory * marketData.midPrice;
            
            // 更新计算器参数
            this.calculator.updateParameters({
                midPrice: marketData.midPrice,
                volatility: this.indicators.getVolatility(),
                intensity: this.indicators.getIntensity(),
                currentInventory: currentInventory,
                targetInventory: targetInventory
            });
            
            // 计算最优买卖价格
            const { bid: optimalBid, ask: optimalAsk } = this.calculator.calculateOptimalPrices();
            
            // 更新策略状态
            this.strategyState = {
                optimalBid,
                optimalAsk,
                currentInventory,
                targetInventory,
                totalInventoryValue,
                reserveAmount: balances.quoteAmount,
                lastUpdateTime: now
            };
            
            // 更新风险管理器
            this.riskManager.updatePosition(currentInventory, marketData.midPrice);
            this.riskManager.updateAccountValue(balances.baseAmount * marketData.midPrice + balances.quoteAmount);
            
            // 打印策略状态
            this.printStrategyStatus();
            
            // 判断是否需要更新订单
            if (this.shouldUpdateOrders()) {
                await this.updateOrders();
            }
            
        } catch (error) {
            this.logger.error('执行策略失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * 打印策略状态
     */
    printStrategyStatus() {
        const marketData = this.marketDataManager.getMarketData();
        const balances = marketData.balances;
        
        // 计算库存偏差
        const inventorySkew = ((this.strategyState.currentInventory - this.strategyState.targetInventory) / 
                               (this.strategyState.currentInventory || 1)) * 100;
        
        // 获取指标值
        const volatility = this.indicators.getVolatility();
        const intensity = this.indicators.getIntensity();
        
        console.log(`\n📊 策略状态 ${'-'.repeat(50)}`);
        console.log(`🕒 时间: ${new Date().toLocaleString()}`);
        console.log(`💰 中间价: ${marketData.midPrice.toFixed(8)}`);
        console.log(`📈 最优买入价: ${this.strategyState.optimalBid.toFixed(8)}`);
        console.log(`📉 最优卖出价: ${this.strategyState.optimalAsk.toFixed(8)}`);
        console.log(`🔄 价差: ${(this.strategyState.optimalAsk - this.strategyState.optimalBid).toFixed(8)} (${((this.strategyState.optimalAsk / this.strategyState.optimalBid - 1) * 100).toFixed(4)}%)`);
        console.log(`📊 波动率: ${(volatility * 100).toFixed(4)}%`);
        console.log(`⚡ 强度: ${intensity.toFixed(6)}`);
        console.log(`\n📦 库存状态 ${'-'.repeat(50)}`);
        console.log(`🏦 当前库存: ${this.strategyState.currentInventory.toFixed(8)}`);
        console.log(`🎯 目标库存: ${this.strategyState.targetInventory.toFixed(8)}`);
        console.log(`↔️ 库存偏差: ${inventorySkew.toFixed(2)}%`);
        console.log(`💵 库存价值: ${this.strategyState.totalInventoryValue.toFixed(8)}`);
        console.log(`💰 保证金: ${this.strategyState.reserveAmount.toFixed(8)}`);
        console.log(`${'-'.repeat(70)}\n`);
    }
    
    /**
     * 判断是否需要更新订单
     */
    shouldUpdateOrders() {
        // 获取当前活跃订单
        const activeOrders = this.orderManager.getActiveOrders();
        
        // 如果没有活跃订单，需要创建新订单
        if (activeOrders.length === 0) {
            this.logger.info('没有活跃订单，需要创建新订单');
            return true;
        }
        
        // 检查最后一次订单更新时间
        const orderUpdateInterval = this.config.get('orderUpdateInterval') || 60000; // 默认1分钟
        const now = Date.now();
        
        if (this.lastOrderUpdateTime && (now - this.lastOrderUpdateTime) < orderUpdateInterval) {
            // 未到更新时间，检查价格变化是否超过阈值
            const marketData = this.marketDataManager.getMarketData();
            const lastMidPrice = this.lastMidPrice || marketData.midPrice;
            const priceChange = Math.abs(marketData.midPrice / lastMidPrice - 1);
            
            if (priceChange < this.priceChangeThreshold) {
                // 价格变化未超过阈值，不需要更新订单
                return false;
            }
            
            this.logger.info('价格变化超过阈值，需要更新订单', {
                lastMidPrice,
                currentMidPrice: marketData.midPrice,
                priceChange: priceChange * 100 + '%',
                threshold: this.priceChangeThreshold * 100 + '%'
            });
        }
        
        // 检查当前订单价格是否与最优价格相差过大
        const bidOrder = activeOrders.find(order => order.side === 'buy');
        const askOrder = activeOrders.find(order => order.side === 'sell');
        
        if (bidOrder) {
            const bidPriceDiff = Math.abs(bidOrder.price / this.strategyState.optimalBid - 1);
            if (bidPriceDiff > this.priceChangeThreshold) {
                this.logger.info('买单价格偏差过大，需要更新订单', {
                    currentBidPrice: bidOrder.price,
                    optimalBidPrice: this.strategyState.optimalBid,
                    priceDiff: bidPriceDiff * 100 + '%',
                    threshold: this.priceChangeThreshold * 100 + '%'
                });
                return true;
            }
        }
        
        if (askOrder) {
            const askPriceDiff = Math.abs(askOrder.price / this.strategyState.optimalAsk - 1);
            if (askPriceDiff > this.priceChangeThreshold) {
                this.logger.info('卖单价格偏差过大，需要更新订单', {
                    currentAskPrice: askOrder.price,
                    optimalAskPrice: this.strategyState.optimalAsk,
                    priceDiff: askPriceDiff * 100 + '%',
                    threshold: this.priceChangeThreshold * 100 + '%'
                });
                return true;
            }
        }
        
        // 更新最后价格记录
        this.lastMidPrice = this.marketDataManager.getMarketData().midPrice;
        
        return false;
    }
    
    /**
     * 更新订单
     */
    async updateOrders() {
        try {
            // 获取当前活跃订单
            const activeOrders = this.orderManager.getActiveOrders();
            
            // 取消所有活跃订单
            if (activeOrders.length > 0) {
                this.logger.info('取消所有活跃订单', { count: activeOrders.length });
                await this.orderManager.cancelAllActiveOrders();
            }
            
            // 获取市场数据
            const marketData = this.marketDataManager.getMarketData();
            const balances = marketData.balances;
            
            // 计算订单数量
            const orderSizeConfig = this.config.get('orderSize') || {};
            const baseSizePercent = orderSizeConfig.basePercent || 0.1; // 默认10%
            const quoteSizePercent = orderSizeConfig.quotePercent || 0.1; // 默认10%
            
            // 计算买单数量 (基于报价货币余额)
            const maxQuoteAmount = balances.quoteAmount * quoteSizePercent;
            const bidSize = maxQuoteAmount / this.strategyState.optimalBid;
            
            // 计算卖单数量 (基于基础货币余额)
            const maxBaseAmount = balances.baseAmount * baseSizePercent;
            const askSize = maxBaseAmount;
            
            // 检查是否有足够的余额下单
            const minOrderSize = this.config.get('minOrderSize') || 0.001; // 默认最小下单量
            
            // 创建买单
            if (bidSize >= minOrderSize) {
                const bidOrder = {
                    symbol: this.config.get('symbol'),
                    side: 'buy',
                    type: 'limit',
                    price: this.strategyState.optimalBid,
                    amount: bidSize,
                    params: {}
                };
                
                this.logger.info('创建买单', bidOrder);
                await this.orderManager.createOrder(bidOrder);
            } else {
                this.logger.warn('买单数量不足，跳过创建买单', {
                    availableQuote: balances.quoteAmount,
                    calculatedSize: bidSize,
                    minOrderSize
                });
            }
            
            // 创建卖单
            if (askSize >= minOrderSize) {
                const askOrder = {
                    symbol: this.config.get('symbol'),
                    side: 'sell',
                    type: 'limit',
                    price: this.strategyState.optimalAsk,
                    amount: askSize,
                    params: {}
                };
                
                this.logger.info('创建卖单', askOrder);
                await this.orderManager.createOrder(askOrder);
            } else {
                this.logger.warn('卖单数量不足，跳过创建卖单', {
                    availableBase: balances.baseAmount,
                    calculatedSize: askSize,
                    minOrderSize
                });
            }
            
            // 更新最后订单更新时间
            this.lastOrderUpdateTime = Date.now();
            
            return true;
            
        } catch (error) {
            this.logger.error('更新订单失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            return false;
        }
    }
}

module.exports = StrategyExecutor;