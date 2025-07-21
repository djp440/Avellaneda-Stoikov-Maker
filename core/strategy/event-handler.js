const EventEmitter = require('events');

/**
 * 事件处理器 - 负责处理交易所和风险管理器的各种事件
 */
class EventHandler extends EventEmitter {
    constructor(strategy) {
        super();
        this.strategy = strategy;
        this.logger = strategy.logger;
    }

    /**
     * 设置交易所事件监听
     */
    setupExchangeEventListeners() {
        const { exchangeManager } = this.strategy;

        // 监听订单簿更新
        exchangeManager.on('orderBookUpdate', (data) => {
            this.handleOrderBookUpdate(data);
        });

        // 监听价格更新
        exchangeManager.on('tickerUpdate', (data) => {
            this.handleTickerUpdate(data);
        });

        // 监听余额更新
        exchangeManager.on('balanceUpdate', (data) => {
            this.handleBalanceUpdate(data);
        });

        // 监听订单更新
        exchangeManager.on('orderUpdate', (data) => {
            this.handleOrderUpdate(data);
        });

        // 监听连接状态变化
        exchangeManager.on('connectionLost', () => {
            this.handleConnectionLost();
        });

        exchangeManager.on('connectionRestored', () => {
            this.handleConnectionRestored();
        });
    }

    /**
     * 设置风险管理器事件监听
     */
    setupRiskManagerEventListeners() {
        const { riskManager } = this.strategy;

        // 监听紧急停止信号
        riskManager.on('emergencyStop', (data) => {
            this.handleEmergencyStop(data);
        });

        // 监听策略停止信号
        riskManager.on('strategyStop', (data) => {
            this.handleStrategyStop(data);
        });
    }

    /**
     * 设置所有事件监听器
     */
    setupEventListeners() {
        this.setupExchangeEventListeners();
        this.setupRiskManagerEventListeners();
        this.logger.info('事件监听器设置完成');
    }

    /**
     * 处理订单簿更新
     */
    handleOrderBookUpdate(data) {
        try {
            this.strategy.currentMarketData = {
                midPrice: data.midPrice,
                bestBid: data.bids[0][0],
                bestAsk: data.asks[0][0],
                orderBook: {
                    bids: data.bids,
                    asks: data.asks
                },
                timestamp: data.timestamp
            };

            // 更新技术指标
            this.strategy.dataManager.updateIndicators();
            
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
            this.strategy.currentMarketData.lastPrice = data.last;
            this.strategy.currentMarketData.timestamp = data.timestamp;
            
        } catch (error) {
            this.logger.error('处理价格更新时出错', error);
        }
    }

    /**
     * 处理余额更新
     */
    handleBalanceUpdate(data) {
        try {
            this.strategy.currentBalances = {
                baseAmount: data.base.free,
                quoteAmount: data.quote.free,
                timestamp: data.timestamp
            };
            
        } catch (error) {
            this.logger.error('处理余额更新时出错', error);
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

    /**
     * 处理订单更新
     */
    handleOrderUpdate(order) {
        // 委托给订单管理器处理
        this.strategy.orderManager.handleOrderUpdate(order);
    }
}

module.exports = EventHandler;