/**
 * 事件处理模块
 * 负责处理交易所和风险管理器的事件
 */

class EventHandler {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.exchangeManager = strategy.exchangeManager;
        this.riskManager = strategy.riskManager;
        
        // 设置事件监听
        this.setupExchangeEventListeners();
        this.setupRiskManagerEventListeners();
    }

    /**
     * 设置交易所事件监听
     */
    setupExchangeEventListeners() {
        // 监听订单簿更新
        this.exchangeManager.on('orderBookUpdate', (data) => {
            this.handleOrderBookUpdate(data);
        });

        // 监听价格更新
        this.exchangeManager.on('tickerUpdate', (data) => {
            this.handleTickerUpdate(data);
        });

        // 监听余额更新
        this.exchangeManager.on('balanceUpdate', (data) => {
            this.handleBalanceUpdate(data);
        });

        // 监听订单更新
        this.exchangeManager.on('orderUpdate', (data) => {
            this.handleOrderUpdate(data);
        });

        // 监听连接状态变化
        this.exchangeManager.on('connectionLost', () => {
            this.handleConnectionLost();
        });

        this.exchangeManager.on('connectionRestored', () => {
            this.handleConnectionRestored();
        });
    }

    /**
     * 设置风险管理器事件监听
     */
    setupRiskManagerEventListeners() {
        // 监听紧急停止事件
        this.riskManager.on('emergencyStop', (data) => {
            this.handleEmergencyStop(data);
        });

        // 监听策略停止事件
        this.riskManager.on('stopStrategy', (data) => {
            this.handleStrategyStop(data);
        });
    }

    /**
     * 处理订单簿更新
     */
    handleOrderBookUpdate(data) {
        try {
            const marketData = {
                midPrice: data.midPrice,
                bestBid: data.bids[0][0],
                bestAsk: data.asks[0][0],
                orderBook: {
                    bids: data.bids,
                    asks: data.asks
                },
                timestamp: data.timestamp
            };

            // 更新市场数据
            this.strategy.marketDataManager.updateMarketData(marketData);

            // 更新技术指标
            this.strategy.indicators.updatePrice(marketData.midPrice, marketData.timestamp);
            if (marketData.orderBook && marketData.orderBook.bids && marketData.orderBook.asks) {
                this.strategy.indicators.updateOrderBook(
                    marketData.orderBook.bids, 
                    marketData.orderBook.asks, 
                    marketData.timestamp
                );
            }
            
        } catch (error) {
            this.logger.error('处理订单簿更新时出错', error);
        }
    }

    /**
     * 处理价格更新
     */
    handleTickerUpdate(data) {
        try {
            // 更新最新价格
            this.strategy.marketDataManager.updateLastPrice(data.last, data.timestamp);
            
        } catch (error) {
            this.logger.error('处理价格更新时出错', error);
        }
    }

    /**
     * 处理余额更新
     */
    handleBalanceUpdate(data) {
        try {
            const balances = {
                baseAmount: data.base.free,
                quoteAmount: data.quote.free,
                timestamp: data.timestamp
            };
            
            this.strategy.marketDataManager.updateBalances(balances);
            
        } catch (error) {
            this.logger.error('处理余额更新时出错', error);
        }
    }

    /**
     * 处理订单更新
     */
    handleOrderUpdate(data) {
        try {
            this.strategy.orderManager.handleOrderUpdate(data);
        } catch (error) {
            this.logger.error('处理订单更新时出错', error);
        }
    }

    /**
     * 处理连接丢失
     */
    handleConnectionLost() {
        this.logger.warn('交易所连接丢失，暂停策略执行');
        // 可以在这里添加连接丢失时的处理逻辑
    }

    /**
     * 处理连接恢复
     */
    handleConnectionRestored() {
        this.logger.info('交易所连接恢复，继续策略执行');
        // 连接恢复时同步挂单
        this.strategy.orderManager.syncActiveOrdersFromExchange();
        // 可以在这里添加连接恢复时的其他处理逻辑
    }

    /**
     * 处理紧急停止事件
     */
    handleEmergencyStop(data) {
        this.logger.error('收到紧急停止信号', data);
        console.error(`策略: 收到紧急停止信号 - ${data.reason}`);
        
        // 立即停止策略
        this.strategy.isRunning = false;
        
        // 发射事件通知主程序
        this.strategy.emit('emergencyStop', data);
    }

    /**
     * 处理策略停止事件
     */
    handleStrategyStop(data) {
        this.logger.warn('收到策略停止信号', data);
        console.warn(`策略: 收到策略停止信号 - ${data.reason}`);
        
        // 停止策略运行
        this.strategy.isRunning = false;
        
        // 发射事件通知主程序
        this.strategy.emit('strategyStop', data);
    }
}

module.exports = EventHandler;