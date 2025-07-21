/**
 * 市场数据管理模块
 * 负责处理和维护所有市场相关的数据
 */

class MarketDataManager {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.exchangeManager = strategy.exchangeManager;
        this.config = strategy.config;
        
        // 市场数据
        this.orderBook = null;
        this.midPrice = null;
        this.lastPrice = null;
        this.balances = {
            baseAmount: 0,
            quoteAmount: 0,
            timestamp: 0
        };
        
        // 数据时间戳
        this.orderBookTimestamp = 0;
        this.lastPriceTimestamp = 0;
        this.balancesTimestamp = 0;
        
        // 数据过期时间（毫秒）
        this.dataExpiryTime = this.config.dataExpiryTime || 60000; // 默认1分钟
    }

    /**
     * 更新市场数据
     * @param {Object} data 市场数据对象
     */
    updateMarketData(data) {
        if (!data) return;
        
        // 更新订单簿
        if (data.orderBook) {
            this.orderBook = data.orderBook;
            this.orderBookTimestamp = data.timestamp || Date.now();
        }
        
        // 更新中间价
        if (data.midPrice) {
            this.midPrice = data.midPrice;
        } else if (data.bestBid && data.bestAsk) {
            // 如果没有提供中间价，但有最佳买卖价，则计算中间价
            this.midPrice = this.calculateMidPrice(data.bestBid, data.bestAsk);
        }
    }

    /**
     * 更新最新价格
     * @param {number} price 最新价格
     * @param {number} timestamp 时间戳
     */
    updateLastPrice(price, timestamp = Date.now()) {
        if (!price) return;
        
        this.lastPrice = price;
        this.lastPriceTimestamp = timestamp;
    }

    /**
     * 更新账户余额
     * @param {Object} balances 余额对象
     */
    updateBalances(balances) {
        if (!balances) return;
        
        this.balances = {
            baseAmount: parseFloat(balances.baseAmount) || 0,
            quoteAmount: parseFloat(balances.quoteAmount) || 0,
            timestamp: balances.timestamp || Date.now()
        };
        
        this.balancesTimestamp = this.balances.timestamp;
    }

    /**
     * 计算中间价
     * @param {number} bestBid 最佳买价
     * @param {number} bestAsk 最佳卖价
     * @returns {number} 中间价
     */
    calculateMidPrice(bestBid, bestAsk) {
        if (!bestBid || !bestAsk) return null;
        return (bestBid + bestAsk) / 2;
    }

    /**
     * 获取当前市场数据
     * @returns {Object} 市场数据对象
     */
    getMarketData() {
        return {
            orderBook: this.orderBook,
            midPrice: this.midPrice,
            lastPrice: this.lastPrice,
            balances: this.balances,
            orderBookTimestamp: this.orderBookTimestamp,
            lastPriceTimestamp: this.lastPriceTimestamp,
            balancesTimestamp: this.balancesTimestamp
        };
    }

    /**
     * 检查市场数据是否有效
     * @returns {boolean} 数据是否有效
     */
    isMarketDataValid() {
        const now = Date.now();
        
        // 检查订单簿数据是否过期
        const isOrderBookValid = this.orderBook && 
                               this.orderBookTimestamp && 
                               (now - this.orderBookTimestamp) < this.dataExpiryTime;
        
        // 检查最新价格是否过期
        const isLastPriceValid = this.lastPrice && 
                               this.lastPriceTimestamp && 
                               (now - this.lastPriceTimestamp) < this.dataExpiryTime;
        
        // 检查余额数据是否过期
        const isBalancesValid = this.balances && 
                              this.balancesTimestamp && 
                              (now - this.balancesTimestamp) < this.dataExpiryTime;
        
        return isOrderBookValid && isLastPriceValid && isBalancesValid;
    }

    /**
     * 从交易所获取最新市场数据
     * @returns {Promise<boolean>} 是否成功获取数据
     */
    async fetchMarketDataFromExchange() {
        try {
            // 获取订单簿
            const orderBook = await this.exchangeManager.fetchOrderBook();
            if (orderBook && orderBook.bids && orderBook.asks) {
                const bestBid = orderBook.bids[0][0];
                const bestAsk = orderBook.asks[0][0];
                const midPrice = this.calculateMidPrice(bestBid, bestAsk);
                
                this.updateMarketData({
                    orderBook: orderBook,
                    midPrice: midPrice,
                    bestBid: bestBid,
                    bestAsk: bestAsk,
                    timestamp: Date.now()
                });
            }
            
            // 获取最新价格
            const ticker = await this.exchangeManager.fetchTicker();
            if (ticker && ticker.last) {
                this.updateLastPrice(ticker.last, Date.now());
            }
            
            // 获取账户余额
            const balances = await this.exchangeManager.fetchBalances();
            if (balances) {
                this.updateBalances({
                    baseAmount: balances.base.free,
                    quoteAmount: balances.quote.free,
                    timestamp: Date.now()
                });
            }
            
            return this.isMarketDataValid();
            
        } catch (error) {
            this.logger.error('从交易所获取市场数据失败', error);
            return false;
        }
    }
}

module.exports = MarketDataManager;