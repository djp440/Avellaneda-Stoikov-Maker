const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');

/**
 * 瞬时波动率指标计算器
 */
class InstantVolatilityIndicator {
    constructor(bufferSize = 100, alpha = 0.94, config = null) {
        this.bufferSize = bufferSize;
        this.alpha = alpha;
        this.priceBuffer = [];
        this.volatilityBuffer = [];
        this.currentValue = 0;
        this.isSamplingBufferFull = false;
        this.isSamplingBufferChanged = false;
        
        this.logger = config ? new Logger(config) : console;
        if (this.logger.info) {
            this.logger.info('瞬时波动率指标已初始化', {
                bufferSize,
                alpha
            });
        }
    }

    /**
     * 添加价格数据
     * @param {number} price - 价格
     * @param {number} timestamp - 时间戳
     */
    addPrice(price, timestamp) {
        try {
            if (!price || price <= 0) {
                return;
            }

            const priceData = { price, timestamp };
            this.priceBuffer.push(priceData);
            
            // 保持缓冲区大小
            if (this.priceBuffer.length > this.bufferSize) {
                this.priceBuffer.shift();
            }
            
            // 检查缓冲区是否已满
            this.isSamplingBufferFull = this.priceBuffer.length >= this.bufferSize;
            
            // 计算波动率
            if (this.priceBuffer.length >= 2) {
                this.calculateVolatility();
            }
            
            this.isSamplingBufferChanged = true;
            
            if (this.logger.debug) {
                this.logger.debug('Price added to volatility indicator', {
                    price,
                    timestamp,
                    bufferSize: this.priceBuffer.length,
                    isFull: this.isSamplingBufferFull
                });
            }
        } catch (error) {
            if (this.logger.error) {
                this.logger.error('向波动率指标添加价格数据时出错', error);
            }
        }
    }

    /**
     * 计算瞬时波动率
     */
    calculateVolatility() {
        try {
            if (this.priceBuffer.length < 2) {
                return;
            }

            // 计算价格变化率
            const returns = [];
            for (let i = 1; i < this.priceBuffer.length; i++) {
                const prevPrice = this.priceBuffer[i - 1].price;
                const currPrice = this.priceBuffer[i].price;
                const returnRate = Math.log(currPrice / prevPrice);
                returns.push(returnRate);
            }

            // 计算EWMA波动率
            let volatility = 0;
            if (returns.length > 0) {
                // 初始化为简单平均
                const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
                const squaredReturns = returns.map(ret => Math.pow(ret - meanReturn, 2));
                
                // 应用EWMA
                volatility = Helpers.calculateEMA(squaredReturns, this.alpha);
                volatility = Math.sqrt(volatility);
            }

            // 年化波动率 (假设1分钟数据)
            const annualizedVolatility = volatility * Math.sqrt(365 * 24 * 60);
            
            this.currentValue = annualizedVolatility;
            this.volatilityBuffer.push(annualizedVolatility);
            
            // 保持波动率缓冲区大小
            if (this.volatilityBuffer.length > this.bufferSize) {
                this.volatilityBuffer.shift();
            }
            
            if (this.logger.debug) {
                this.logger.debug('Volatility calculated', {
                    returnsCount: returns.length,
                    volatility,
                    annualizedVolatility,
                    currentValue: this.currentValue
                });
            }
        } catch (error) {
            if (this.logger.error) {
                this.logger.error('计算波动率时出错', error);
            }
        }
    }

    /**
     * 获取当前波动率值
     * @returns {number} 当前波动率
     */
    getValue() {
        return this.currentValue;
    }

    /**
     * 重置指标
     */
    reset() {
        this.priceBuffer = [];
        this.volatilityBuffer = [];
        this.currentValue = 0;
        this.isSamplingBufferFull = false;
        this.isSamplingBufferChanged = false;
        
        if (this.logger.info) {
            this.logger.info('瞬时波动率指标已重置');
        }
    }
}

/**
 * 交易强度指标计算器
 */
class TradingIntensityIndicator {
    constructor(bufferSize = 100, depth = 10, config = null) {
        this.bufferSize = bufferSize;
        this.depth = depth;
        this.intensityBuffer = [];
        this.currentValue = 0;
        this.isSamplingBufferFull = false;
        this.isSamplingBufferChanged = false;
        
        this.logger = config ? new Logger(config) : console;
        if (this.logger.info) {
            this.logger.info('交易强度指标已初始化', {
                bufferSize,
                depth
            });
        }
    }

    /**
     * 添加订单簿数据
     * @param {Array} bids - 买单数组 [{price, amount}, ...]
     * @param {Array} asks - 卖单数组 [{price, amount}, ...]
     * @param {number} timestamp - 时间戳
     */
    addOrderBook(bids, asks, timestamp) {
        try {
            if (!bids || !asks || bids.length === 0 || asks.length === 0) {
                return;
            }

            const intensity = this.calculateTradingIntensity(bids, asks);
            const intensityData = { intensity, timestamp };
            
            this.intensityBuffer.push(intensityData);
            
            // 保持缓冲区大小
            if (this.intensityBuffer.length > this.bufferSize) {
                this.intensityBuffer.shift();
            }
            
            // 检查缓冲区是否已满
            this.isSamplingBufferFull = this.intensityBuffer.length >= this.bufferSize;
            
            // 更新当前值
            if (this.intensityBuffer.length > 0) {
                this.currentValue = this.intensityBuffer[this.intensityBuffer.length - 1].intensity;
            }
            
            this.isSamplingBufferChanged = true;
            
            if (this.logger.debug) {
                this.logger.debug('Order book added to trading intensity indicator', {
                    bidsCount: bids.length,
                    asksCount: asks.length,
                    intensity,
                    bufferSize: this.intensityBuffer.length,
                    isFull: this.isSamplingBufferFull
                });
            }
        } catch (error) {
            if (this.logger.error) {
                this.logger.error('向交易强度指标添加订单簿数据时出错', error);
            }
        }
    }

    /**
     * 计算交易强度
     * @param {Array} bids - 买单数组
     * @param {Array} asks - 卖单数组
     * @returns {number} 交易强度值
     */
    calculateTradingIntensity(bids, asks) {
        try {
            if (!bids || !asks || bids.length === 0 || asks.length === 0) {
                return 0;
            }

            // 计算中间价
            const bestBid = bids[0].price;
            const bestAsk = asks[0].price;
            const midPrice = (bestBid + bestAsk) / 2;
            
            // 计算指定深度的流动性
            let bidLiquidity = 0;
            let askLiquidity = 0;
            
            // 买单流动性 (价格从高到低)
            for (let i = 0; i < Math.min(this.depth, bids.length); i++) {
                const bid = bids[i];
                const priceDistance = (midPrice - bid.price) / midPrice;
                bidLiquidity += bid.amount / (1 + priceDistance);
            }
            
            // 卖单流动性 (价格从低到高)
            for (let i = 0; i < Math.min(this.depth, asks.length); i++) {
                const ask = asks[i];
                const priceDistance = (ask.price - midPrice) / midPrice;
                askLiquidity += ask.amount / (1 + priceDistance);
            }
            
            // 计算交易强度 (流动性加权平均)
            const totalLiquidity = bidLiquidity + askLiquidity;
            const tradingIntensity = totalLiquidity > 0 ? totalLiquidity / (2 * this.depth) : 0;
            
            if (this.logger.debug) {
                this.logger.debug('Trading intensity calculated', {
                    bestBid,
                    bestAsk,
                    midPrice,
                    bidLiquidity,
                    askLiquidity,
                    totalLiquidity,
                    tradingIntensity
                });
            }
            
            return tradingIntensity;
        } catch (error) {
            if (this.logger.error) {
                this.logger.error('计算交易强度时出错', error);
            }
            return 0;
        }
    }

    /**
     * 获取当前交易强度值
     * @returns {number} 当前交易强度
     */
    getValue() {
        return this.currentValue;
    }

    /**
     * 重置指标
     */
    reset() {
        this.intensityBuffer = [];
        this.currentValue = 0;
        this.isSamplingBufferFull = false;
        this.isSamplingBufferChanged = false;
        
        if (this.logger.info) {
            this.logger.info('交易强度指标已重置');
        }
    }
}

/**
 * 技术指标管理器
 */
class IndicatorsManager {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(config);
        
        // 初始化指标
        this.volatilityIndicator = new InstantVolatilityIndicator(
            config.get ? (config.get('volatilityBufferSize') || 100) : 100,
            config.get ? (config.get('volatilityAlpha') || 0.94) : 0.94,
            config
        );
        
        this.tradingIntensityIndicator = new TradingIntensityIndicator(
            config.get ? (config.get('tradingIntensityBufferSize') || 100) : 100,
            config.get ? (config.get('orderBookDepth') || 10) : 10,
            config
        );
        
        if (this.logger.info) {
            this.logger.info('技术指标管理器已初始化', {
                volatilityBufferSize: config.get ? (config.get('volatilityBufferSize') || 100) : 100,
                tradingIntensityBufferSize: config.get ? (config.get('tradingIntensityBufferSize') || 100) : 100,
                orderBookDepth: config.get ? (config.get('orderBookDepth') || 10) : 10
            });
        }
    }

    /**
     * 更新价格数据
     * @param {number} price - 价格
     * @param {number} timestamp - 时间戳
     */
    updatePrice(price, timestamp) {
        this.volatilityIndicator.addPrice(price, timestamp);
    }

    /**
     * 更新订单簿数据
     * @param {Array} bids - 买单数组
     * @param {Array} asks - 卖单数组
     * @param {number} timestamp - 时间戳
     */
    updateOrderBook(bids, asks, timestamp) {
        this.tradingIntensityIndicator.addOrderBook(bids, asks, timestamp);
    }

    /**
     * 获取当前指标值
     * @returns {Object} {volatility, tradingIntensity}
     */
    getCurrentValues() {
        return {
            volatility: this.volatilityIndicator.getValue(),
            tradingIntensity: this.tradingIntensityIndicator.getValue()
        };
    }

    /**
     * 检查指标是否准备就绪
     * @returns {boolean} 是否准备就绪
     */
    isReady() {
        return this.volatilityIndicator.isSamplingBufferFull && 
               this.tradingIntensityIndicator.isSamplingBufferFull;
    }

    /**
     * 检查指标是否有变化
     * @returns {boolean} 是否有变化
     */
    hasChanged() {
        return this.volatilityIndicator.isSamplingBufferChanged || 
               this.tradingIntensityIndicator.isSamplingBufferChanged;
    }

    /**
     * 重置所有指标
     */
    reset() {
        this.volatilityIndicator.reset();
        this.tradingIntensityIndicator.reset();
        
        if (this.logger.info) {
            this.logger.info('所有指标已重置');
        }
    }

    /**
     * 获取指标状态
     * @returns {Object} 指标状态
     */
    getStatus() {
        return {
            volatility: {
                currentValue: this.volatilityIndicator.currentValue,
                isReady: this.volatilityIndicator.isSamplingBufferFull,
                bufferSize: this.volatilityIndicator.priceBuffer.length,
                maxBufferSize: this.volatilityIndicator.bufferSize
            },
            tradingIntensity: {
                currentValue: this.tradingIntensityIndicator.currentValue,
                isReady: this.tradingIntensityIndicator.isSamplingBufferFull,
                bufferSize: this.tradingIntensityIndicator.intensityBuffer.length,
                maxBufferSize: this.tradingIntensityIndicator.bufferSize
            },
            overall: {
                isReady: this.isReady(),
                hasChanged: this.hasChanged()
            }
        };
    }
}

module.exports = {
    InstantVolatilityIndicator,
    TradingIntensityIndicator,
    IndicatorsManager
}; 