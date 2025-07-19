const moment = require('moment');
const _ = require('lodash');

class Helpers {
    constructor() {
        // 缓存系统
        this.cache = new Map();
        this.cacheTimeout = new Map();
        this.defaultCacheTimeout = 60000; // 1分钟默认缓存时间
    }

    /**
     * 缓存管理
     */
    setCache(key, value, timeout = this.defaultCacheTimeout) {
        this.cache.set(key, value);
        this.cacheTimeout.set(key, Date.now() + timeout);
    }

    getCache(key) {
        const timeout = this.cacheTimeout.get(key);
        if (timeout && Date.now() > timeout) {
            this.cache.delete(key);
            this.cacheTimeout.delete(key);
            return null;
        }
        return this.cache.get(key);
    }

    clearCache() {
        this.cache.clear();
        this.cacheTimeout.clear();
    }

    /**
     * 格式化价格到指定精度
     * @param {number} price - 价格
     * @param {number} precision - 精度位数
     * @returns {number} 格式化后的价格
     */
    static formatPrice(price, precision = 8) {
        if (!this.isValidPrice(price)) {
            return 0;
        }
        return parseFloat(price.toFixed(precision));
    }

    /**
     * 计算价差百分比
     * @param {number} bid - 买价
     * @param {number} ask - 卖价
     * @returns {number} 价差百分比
     */
    static calculateSpread(bid, ask) {
        if (!this.isValidPrice(bid) || !this.isValidPrice(ask) || bid <= 0 || ask <= 0) {
            return 0;
        }
        return ((ask - bid) / bid) * 100;
    }

    /**
     * 计算中间价
     * @param {number} bid - 买价
     * @param {number} ask - 卖价
     * @returns {number} 中间价
     */
    static calculateMidPrice(bid, ask) {
        if (!this.isValidPrice(bid) || !this.isValidPrice(ask)) {
            return 0;
        }
        return (bid + ask) / 2;
    }

    /**
     * 计算波动率 (优化版本)
     * @param {Array} prices - 价格数组
     * @param {number} window - 窗口大小
     * @returns {number} 波动率
     */
    static calculateVolatility(prices, window = 20) {
        if (!Array.isArray(prices) || prices.length < Math.min(window, 2)) {
            return 0;
        }

        // 使用缓存键
        const cacheKey = `volatility_${prices.length}_${window}_${prices[prices.length - 1]}`;
        const cached = this.getCache(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            const return_rate = Math.log(prices[i] / prices[i - 1]);
            returns.push(return_rate);
        }

        const recentReturns = returns.slice(-window);
        const mean = _.mean(recentReturns);
        const variance = _.mean(recentReturns.map(r => Math.pow(r - mean, 2)));
        const volatility = Math.sqrt(variance * 252); // 年化波动率

        // 缓存结果
        this.setCache(cacheKey, volatility, 30000); // 30秒缓存

        return volatility;
    }

    /**
     * 计算指数移动平均 (优化版本)
     * @param {Array} values - 数值数组
     * @param {number} period - 周期
     * @returns {number} EMA值
     */
    static calculateEMA(values, period) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        if (values.length === 1) return values[0];

        const alpha = 2 / (period + 1);
        let ema = values[0];

        for (let i = 1; i < values.length; i++) {
            ema = alpha * values[i] + (1 - alpha) * ema;
        }

        return ema;
    }

    /**
     * 限制数值在指定范围内
     * @param {number} value - 数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的数值
     */
    static clamp(value, min, max) {
        if (typeof value !== 'number' || isNaN(value)) {
            return min;
        }
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 计算百分比变化
     * @param {number} oldValue - 旧值
     * @param {number} newValue - 新值
     * @returns {number} 百分比变化
     */
    static calculatePercentageChange(oldValue, newValue) {
        if (!this.isValidNumber(oldValue) || !this.isValidNumber(newValue) || oldValue === 0) {
            return 0;
        }
        return ((newValue - oldValue) / oldValue) * 100;
    }

    /**
     * 格式化时间戳
     * @param {number|Date} timestamp - 时间戳
     * @param {string} format - 格式
     * @returns {string} 格式化的时间字符串
     */
    static formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
        try {
            return moment(timestamp).format(format);
        } catch (error) {
            return moment().format(format);
        }
    }

    /**
     * 获取当前时间戳
     * @returns {number} 当前时间戳
     */
    static getCurrentTimestamp() {
        return Date.now();
    }

    /**
     * 延迟执行
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise} Promise对象
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 重试函数 (增强版本)
     * @param {Function} fn - 要重试的函数
     * @param {number} maxRetries - 最大重试次数
     * @param {number} delayMs - 重试间隔毫秒数
     * @param {Function} shouldRetry - 判断是否应该重试的函数
     * @returns {Promise} Promise对象
     */
    static async retry(fn, maxRetries = 3, delayMs = 1000, shouldRetry = null) {
        let lastError;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // 检查是否应该重试
                if (shouldRetry && !shouldRetry(error, i)) {
                    throw error;
                }
                
                if (i < maxRetries) {
                    const backoffDelay = delayMs * Math.pow(2, i); // 指数退避
                    await this.delay(backoffDelay);
                }
            }
        }

        throw lastError;
    }

    /**
     * 深度克隆对象
     * @param {Object} obj - 要克隆的对象
     * @returns {Object} 克隆后的对象
     */
    static deepClone(obj) {
        return _.cloneDeep(obj);
    }

    /**
     * 检查对象是否为空
     * @param {Object} obj - 要检查的对象
     * @returns {boolean} 是否为空
     */
    static isEmpty(obj) {
        return _.isEmpty(obj);
    }

    /**
     * 生成唯一ID (增强版本)
     * @returns {string} 唯一ID
     */
    static generateId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}${random}`;
    }

    /**
     * 格式化数字为可读格式
     * @param {number} num - 数字
     * @param {number} decimals - 小数位数
     * @returns {string} 格式化后的字符串
     */
    static formatNumber(num, decimals = 2) {
        if (!this.isValidNumber(num)) {
            return '0.00';
        }
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * 计算订单簿流动性 (优化版本)
     * @param {Array} orderBook - 订单簿数据
     * @param {number} depth - 深度
     * @returns {Object} 流动性信息
     */
    static calculateLiquidity(orderBook, depth = 10) {
        if (!orderBook || !orderBook.bids || !orderBook.asks) {
            return { bidLiquidity: 0, askLiquidity: 0, totalLiquidity: 0 };
        }

        const bidLiquidity = orderBook.bids
            .slice(0, depth)
            .reduce((sum, [price, amount]) => sum + (this.isValidAmount(amount) ? amount : 0), 0);

        const askLiquidity = orderBook.asks
            .slice(0, depth)
            .reduce((sum, [price, amount]) => sum + (this.isValidAmount(amount) ? amount : 0), 0);

        return {
            bidLiquidity,
            askLiquidity,
            totalLiquidity: bidLiquidity + askLiquidity
        };
    }

    /**
     * 验证价格数据有效性 (增强版本)
     * @param {number} price - 价格
     * @returns {boolean} 是否有效
     */
    static isValidPrice(price) {
        return this.isValidNumber(price) && price > 0;
    }

    /**
     * 验证数量数据有效性 (增强版本)
     * @param {number} amount - 数量
     * @returns {boolean} 是否有效
     */
    static isValidAmount(amount) {
        return this.isValidNumber(amount) && amount >= 0;
    }

    /**
     * 验证数字有效性
     * @param {number} value - 数值
     * @returns {boolean} 是否有效
     */
    static isValidNumber(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               isFinite(value);
    }

    /**
     * 限制数值在指定范围内
     * @param {number} value - 数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的数值
     */
    static limitValue(value, min, max) {
        return this.clamp(value, min, max);
    }

    /**
     * 生成唯一ID (带前缀)
     * @param {string} prefix - 前缀
     * @returns {string} 唯一ID
     */
    static generateUniqueId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * 数据验证器
     */
    static validateOrderData(orderData) {
        const errors = [];
        
        if (!this.isValidPrice(orderData.price)) {
            errors.push('Invalid price');
        }
        if (!this.isValidAmount(orderData.amount)) {
            errors.push('Invalid amount');
        }
        if (!orderData.side || !['buy', 'sell'].includes(orderData.side)) {
            errors.push('Invalid side');
        }
        if (!orderData.symbol) {
            errors.push('Invalid symbol');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 性能监控装饰器
     */
    static performanceMonitor(fn, name) {
        return async function(...args) {
            const startTime = Date.now();
            try {
                const result = await fn.apply(this, args);
                const duration = Date.now() - startTime;
                console.log(`Performance: ${name} took ${duration}ms`);
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`Performance: ${name} failed after ${duration}ms`, error);
                throw error;
            }
        };
    }

    /**
     * 批量处理数组
     * @param {Array} items - 要处理的数组
     * @param {Function} processor - 处理函数
     * @param {number} batchSize - 批次大小
     * @returns {Promise<Array>} 处理结果
     */
    static async processBatch(items, processor, batchSize = 10) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(item => processor(item))
            );
            results.push(...batchResults);
        }
        
        return results;
    }

    /**
     * 防抖函数
     * @param {Function} fn - 要防抖的函数
     * @param {number} delay - 延迟时间
     * @returns {Function} 防抖后的函数
     */
    static debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * 节流函数
     * @param {Function} fn - 要节流的函数
     * @param {number} limit - 限制时间
     * @returns {Function} 节流后的函数
     */
    static throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

module.exports = Helpers; 