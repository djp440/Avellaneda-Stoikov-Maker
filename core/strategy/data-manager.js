/**
 * 数据管理器 - 负责市场数据、余额和技术指标的更新管理
 */
class DataManager {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.config = strategy.config;
        
        // 数据状态
        this.lastMarketDataUpdate = 0;
        this.lastBalanceUpdate = 0;
        this.lastIndicatorUpdate = 0;
        
        // 数据更新间隔配置
        this.marketDataUpdateInterval = this.config.get('marketDataUpdateInterval') || 1000; // 1秒
        this.balanceUpdateInterval = this.config.get('balanceUpdateInterval') || 5000; // 5秒
        this.indicatorUpdateInterval = this.config.get('indicatorUpdateInterval') || 2000; // 2秒
    }

    /**
     * 更新市场数据
     */
    async updateMarketData() {
        try {
            const now = Date.now();
            
            // 检查更新间隔
            if (now - this.lastMarketDataUpdate < this.marketDataUpdateInterval) {
                return;
            }
            
            this.logger.debug('开始更新市场数据');
            
            // 获取订单簿数据
            const orderbook = await this.strategy.exchangeManager.getOrderbook();
            if (!orderbook || !orderbook.bids || !orderbook.asks || 
                orderbook.bids.length === 0 || orderbook.asks.length === 0) {
                this.logger.warn('获取到的订单簿数据无效或为空', {
                    orderbook: orderbook,
                    bidsLength: orderbook?.bids?.length || 0,
                    asksLength: orderbook?.asks?.length || 0
                });
                return;
            }
            
            // 获取最新价格
            const ticker = await this.strategy.exchangeManager.getTicker();
            if (!ticker || !ticker.last) {
                this.logger.warn('获取到的价格数据无效', { ticker });
                return;
            }
            
            // 更新当前市场数据
            this.strategy.currentMarketData = {
                bestBid: orderbook.bids[0][0],
                bestAsk: orderbook.asks[0][0],
                bidVolume: orderbook.bids[0][1],
                askVolume: orderbook.asks[0][1],
                lastPrice: ticker.last,
                timestamp: now,
                orderbook: orderbook,
                ticker: ticker
            };
            
            // 计算中间价
            const midPrice = (this.strategy.currentMarketData.bestBid + this.strategy.currentMarketData.bestAsk) / 2;
            this.strategy.currentMarketData.midPrice = midPrice;
            
            // 更新策略状态中的当前价格
            this.strategy.strategyState.currentPrice = midPrice;
            
            this.lastMarketDataUpdate = now;
            
            this.logger.debug('市场数据更新完成', {
                bestBid: this.strategy.currentMarketData.bestBid,
                bestAsk: this.strategy.currentMarketData.bestAsk,
                midPrice: midPrice.toFixed(2),
                lastPrice: ticker.last,
                spread: (this.strategy.currentMarketData.bestAsk - this.strategy.currentMarketData.bestBid).toFixed(2)
            });
            
        } catch (error) {
            this.logger.error('更新市场数据失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 更新余额信息
     */
    async updateBalances() {
        try {
            const now = Date.now();
            
            // 检查更新间隔
            if (now - this.lastBalanceUpdate < this.balanceUpdateInterval) {
                return;
            }
            
            this.logger.debug('开始更新余额信息');
            
            // 获取账户余额
            const balances = await this.strategy.exchangeManager.getBalances();
            if (!balances) {
                this.logger.warn('获取余额失败');
                return;
            }
            
            // 获取交易对信息
            const symbol = this.config.get('symbol');
            const [baseAsset, quoteAsset] = symbol.split('/');
            
            // 更新余额信息
            const baseBalance = balances[baseAsset] || { free: 0, used: 0, total: 0 };
            const quoteBalance = balances[quoteAsset] || { free: 0, used: 0, total: 0 };
            
            this.strategy.currentBalances = {
                [baseAsset]: baseBalance,
                [quoteAsset]: quoteBalance,
                timestamp: now
            };
            
            // 计算当前库存
            const currentPrice = this.strategy.currentMarketData?.midPrice || 0;
            if (currentPrice > 0) {
                // 计算总库存价值（以报价货币计算）
                const baseValue = baseBalance.total * currentPrice;
                const quoteValue = quoteBalance.total;
                const totalValue = baseValue + quoteValue;
                
                // 更新策略状态中的库存信息
                this.strategy.strategyState.currentInventory = baseBalance.total;
                this.strategy.strategyState.totalInventoryValue = totalValue;
                
                // 计算目标库存（通常是总价值的一半转换为基础资产）
                this.strategy.strategyState.targetInventory = (totalValue / 2) / currentPrice;
                
                this.logger.debug('余额和库存信息更新完成', {
                    baseAsset: baseAsset,
                    quoteAsset: quoteAsset,
                    baseBalance: baseBalance.total.toFixed(6),
                    quoteBalance: quoteBalance.total.toFixed(2),
                    currentInventory: this.strategy.strategyState.currentInventory.toFixed(6),
                    targetInventory: this.strategy.strategyState.targetInventory.toFixed(6),
                    totalValue: totalValue.toFixed(2),
                    currentPrice: currentPrice.toFixed(2)
                });
            }
            
            this.lastBalanceUpdate = now;
            
        } catch (error) {
            this.logger.error('更新余额失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 更新技术指标
     */
    async updateIndicators() {
        try {
            const now = Date.now();
            
            // 检查更新间隔
            if (now - this.lastIndicatorUpdate < this.indicatorUpdateInterval) {
                return;
            }
            
            // 检查是否有有效的市场数据
            if (!this.strategy.currentMarketData || !this.strategy.currentMarketData.midPrice) {
                this.logger.debug('跳过技术指标更新：缺少有效的市场数据');
                return;
            }
            
            this.logger.debug('开始更新技术指标');
            
            // 更新技术指标
            await this.strategy.indicators.update({
                price: this.strategy.currentMarketData.midPrice,
                volume: this.strategy.currentMarketData.bidVolume + this.strategy.currentMarketData.askVolume,
                timestamp: now,
                orderbook: this.strategy.currentMarketData.orderbook
            });
            
            // 获取更新后的指标值
            const indicatorValues = this.strategy.indicators.getValues();
            
            // 更新策略状态中的波动率
            if (indicatorValues.volatility !== undefined) {
                this.strategy.strategyState.volatility = indicatorValues.volatility;
            }
            
            this.lastIndicatorUpdate = now;
            
            this.logger.debug('技术指标更新完成', {
                volatility: this.strategy.strategyState.volatility?.toFixed(6),
                indicatorCount: Object.keys(indicatorValues).length,
                midPrice: this.strategy.currentMarketData.midPrice.toFixed(2)
            });
            
        } catch (error) {
            this.logger.error('更新技术指标失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 检查数据是否需要更新
     */
    needsUpdate() {
        const now = Date.now();
        
        const needsMarketData = (now - this.lastMarketDataUpdate) >= this.marketDataUpdateInterval;
        const needsBalance = (now - this.lastBalanceUpdate) >= this.balanceUpdateInterval;
        const needsIndicators = (now - this.lastIndicatorUpdate) >= this.indicatorUpdateInterval;
        
        return {
            marketData: needsMarketData,
            balance: needsBalance,
            indicators: needsIndicators,
            any: needsMarketData || needsBalance || needsIndicators
        };
    }

    /**
     * 强制更新所有数据
     */
    async forceUpdateAll() {
        this.logger.info('强制更新所有数据');
        
        // 重置时间戳以强制更新
        this.lastMarketDataUpdate = 0;
        this.lastBalanceUpdate = 0;
        this.lastIndicatorUpdate = 0;
        
        // 依次更新所有数据
        await this.updateMarketData();
        await this.updateBalances();
        await this.updateIndicators();
        
        this.logger.info('所有数据强制更新完成');
    }

    /**
     * 获取数据更新状态
     */
    getUpdateStatus() {
        const now = Date.now();
        
        return {
            marketData: {
                lastUpdate: this.lastMarketDataUpdate,
                timeSinceUpdate: now - this.lastMarketDataUpdate,
                interval: this.marketDataUpdateInterval,
                needsUpdate: (now - this.lastMarketDataUpdate) >= this.marketDataUpdateInterval
            },
            balance: {
                lastUpdate: this.lastBalanceUpdate,
                timeSinceUpdate: now - this.lastBalanceUpdate,
                interval: this.balanceUpdateInterval,
                needsUpdate: (now - this.lastBalanceUpdate) >= this.balanceUpdateInterval
            },
            indicators: {
                lastUpdate: this.lastIndicatorUpdate,
                timeSinceUpdate: now - this.lastIndicatorUpdate,
                interval: this.indicatorUpdateInterval,
                needsUpdate: (now - this.lastIndicatorUpdate) >= this.indicatorUpdateInterval
            }
        };
    }

    /**
     * 重置数据管理器状态
     */
    reset() {
        this.lastMarketDataUpdate = 0;
        this.lastBalanceUpdate = 0;
        this.lastIndicatorUpdate = 0;
        
        this.logger.info('数据管理器状态已重置');
    }

    /**
     * 获取当前市场数据摘要
     */
    getMarketDataSummary() {
        if (!this.strategy.currentMarketData) {
            return null;
        }
        
        const data = this.strategy.currentMarketData;
        return {
            bestBid: data.bestBid,
            bestAsk: data.bestAsk,
            midPrice: data.midPrice,
            lastPrice: data.lastPrice,
            spread: data.bestAsk - data.bestBid,
            spreadPercent: ((data.bestAsk - data.bestBid) / data.midPrice * 100).toFixed(4),
            timestamp: data.timestamp,
            age: Date.now() - data.timestamp
        };
    }

    /**
     * 获取当前余额摘要
     */
    getBalanceSummary() {
        if (!this.strategy.currentBalances) {
            return null;
        }
        
        const symbol = this.config.get('symbol');
        const [baseAsset, quoteAsset] = symbol.split('/');
        
        const baseBalance = this.strategy.currentBalances[baseAsset];
        const quoteBalance = this.strategy.currentBalances[quoteAsset];
        
        return {
            [baseAsset]: {
                free: baseBalance?.free || 0,
                used: baseBalance?.used || 0,
                total: baseBalance?.total || 0
            },
            [quoteAsset]: {
                free: quoteBalance?.free || 0,
                used: quoteBalance?.used || 0,
                total: quoteBalance?.total || 0
            },
            currentInventory: this.strategy.strategyState?.currentInventory || 0,
            targetInventory: this.strategy.strategyState?.targetInventory || 0,
            totalValue: this.strategy.strategyState?.totalInventoryValue || 0,
            timestamp: this.strategy.currentBalances.timestamp,
            age: Date.now() - this.strategy.currentBalances.timestamp
        };
    }
}

module.exports = DataManager;