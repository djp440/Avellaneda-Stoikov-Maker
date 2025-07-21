/**
 * 订单管理模块
 * 负责处理订单的创建、取消和状态管理
 */

class OrderManager {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.exchangeManager = strategy.exchangeManager;
        this.riskManager = strategy.riskManager;
        this.config = strategy.config;
        
        // 活跃订单管理
        this.activeOrders = new Map(); // 订单ID -> 订单对象
        this.orderHistory = new Map(); // 订单ID -> 订单历史状态数组
        
        // 订单监控
        this.orderMonitoringInterval = null;
        this.isOrderMonitoringRunning = false;
        
        // 订单创建锁，防止并发创建订单
        this.isCreatingOrders = false;
        
        // 上次订单价格记录，用于判断价格变化
        this.lastOrderPrices = {
            buy: null,
            sell: null
        };
        
        // 上次订单更新时间
        this.lastOrderUpdateTime = 0;
        
        // 已实现盈亏
        this.realizedPnL = 0;
    }
    
    /**
     * 获取活跃订单
     * @returns {Array} 活跃订单数组
     */
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }
    
    /**
     * 获取订单历史
     * @param {number} limit 限制返回的订单数量
     * @returns {Array} 订单历史数组
     */
    getOrderHistory(limit = 10) {
        // 将Map转换为数组，并按时间戳降序排序
        const historyArray = Array.from(this.orderHistory.entries())
            .map(([orderId, states]) => {
                // 获取最新状态
                const latestState = states[states.length - 1];
                return {
                    orderId,
                    ...latestState
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
        
        // 返回指定数量的订单
        return historyArray.slice(0, limit);
    }

    /**
     * 同步交易所活跃订单
     * @returns {Promise<boolean>} 是否成功同步
     */
    async syncActiveOrdersFromExchange() {
        try {
            this.logger.info('正在从交易所同步活跃订单...');
            
            // 获取交易所活跃订单
            const openOrders = await this.exchangeManager.fetchOpenOrders();
            
            // 清空本地活跃订单记录
            this.activeOrders.clear();
            
            // 更新本地活跃订单记录
            if (openOrders && openOrders.length > 0) {
                for (const order of openOrders) {
                    this.activeOrders.set(order.id, order);
                }
                this.logger.info(`成功同步 ${openOrders.length} 个活跃订单`);
            } else {
                this.logger.info('没有活跃订单需要同步');
            }
            
            return true;
            
        } catch (error) {
            this.logger.error('从交易所同步活跃订单失败', error);
            return false;
        }
    }

    /**
     * 启动订单监控
     */
    startOrderMonitoring() {
        if (this.isOrderMonitoringRunning) return;
        
        this.isOrderMonitoringRunning = true;
        const monitoringInterval = this.config.orderMonitoringInterval || 10000; // 默认10秒
        
        this.logger.info(`启动订单监控，间隔: ${monitoringInterval}ms`);
        
        this.orderMonitoringInterval = setInterval(() => {
            this.monitorOrderStatus();
        }, monitoringInterval);
    }

    /**
     * 停止订单监控
     */
    stopOrderMonitoring() {
        if (!this.isOrderMonitoringRunning) return;
        
        this.logger.info('停止订单监控');
        
        if (this.orderMonitoringInterval) {
            clearInterval(this.orderMonitoringInterval);
            this.orderMonitoringInterval = null;
        }
        
        this.isOrderMonitoringRunning = false;
    }

    /**
     * 监控订单状态
     */
    async monitorOrderStatus() {
        if (!this.strategy.isRunning || this.activeOrders.size === 0) return;
        
        try {
            // 获取交易所活跃订单
            const openOrders = await this.exchangeManager.fetchOpenOrders();
            const exchangeOrderIds = new Set(openOrders.map(order => order.id));
            
            // 检查本地活跃订单是否在交易所存在
            for (const [orderId, order] of this.activeOrders.entries()) {
                if (!exchangeOrderIds.has(orderId)) {
                    // 订单在交易所不存在，可能已经成交或取消
                    const orderDetails = await this.exchangeManager.fetchOrder(orderId);
                    
                    if (orderDetails) {
                        // 更新订单状态
                        this.handleOrderUpdate(orderDetails);
                    } else {
                        // 无法获取订单详情，从本地移除
                        this.logger.warn(`订单 ${orderId} 在交易所不存在且无法获取详情，从本地移除`);
                        this.activeOrders.delete(orderId);
                    }
                }
            }
            
        } catch (error) {
            this.logger.error('监控订单状态时出错', error);
        }
    }

    /**
     * 处理订单更新
     * @param {Object} orderUpdate 订单更新数据
     */
    handleOrderUpdate(orderUpdate) {
        if (!orderUpdate || !orderUpdate.id) return;
        
        const orderId = orderUpdate.id;
        const existingOrder = this.activeOrders.get(orderId);
        
        // 记录订单历史
        if (!this.orderHistory.has(orderId)) {
            this.orderHistory.set(orderId, []);
        }
        this.orderHistory.get(orderId).push({
            ...orderUpdate,
            timestamp: Date.now()
        });
        
        // 判断新状态是否比旧状态更终结
        if (existingOrder && this.isNewOrderStatusMoreFinal(orderUpdate.status, existingOrder.status)) {
            // 处理订单成交
            if (orderUpdate.status === 'closed' || orderUpdate.status === 'filled') {
                this.handleOrderFilled(orderUpdate, existingOrder);
            }
            
            // 处理订单取消
            if (orderUpdate.status === 'canceled' || orderUpdate.status === 'expired' || orderUpdate.status === 'rejected') {
                this.logger.info(`订单 ${orderId} 已${orderUpdate.status === 'canceled' ? '取消' : '过期或拒绝'}`);
                this.activeOrders.delete(orderId);
            }
        } else if (!existingOrder) {
            // 新订单
            this.activeOrders.set(orderId, orderUpdate);
            this.logger.info(`新订单 ${orderId} 已创建: ${orderUpdate.side} ${orderUpdate.amount} @ ${orderUpdate.price}`);
        } else {
            // 更新现有订单
            this.activeOrders.set(orderId, {
                ...existingOrder,
                ...orderUpdate
            });
        }
    }

    /**
     * 判断新订单状态是否比旧状态更终结
     * @param {string} newStatus 新状态
     * @param {string} oldStatus 旧状态
     * @returns {boolean} 是否更终结
     */
    isNewOrderStatusMoreFinal(newStatus, oldStatus) {
        const statusPriority = {
            'open': 0,
            'partial': 1,
            'canceled': 2,
            'expired': 2,
            'rejected': 2,
            'filled': 3,
            'closed': 3
        };
        
        return (statusPriority[newStatus] || 0) > (statusPriority[oldStatus] || 0);
    }

    /**
     * 处理订单成交
     * @param {Object} newOrder 新订单数据
     * @param {Object} oldOrder 旧订单数据
     */
    handleOrderFilled(newOrder, oldOrder) {
        const orderId = newOrder.id;
        
        // 从活跃订单中移除
        this.activeOrders.delete(orderId);
        
        // 计算已实现盈亏
        const pnl = this.calculateRealizedPnL(newOrder);
        this.realizedPnL += pnl;
        
        // 记录成交信息
        this.logger.info(`订单 ${orderId} 已成交: ${newOrder.side} ${newOrder.amount} @ ${newOrder.price}, 已实现盈亏: ${pnl.toFixed(8)}`);
        
        // 设置强制更新标志
        this.strategy.forceOrderUpdate = true;
    }

    /**
     * 计算已实现盈亏
     * @param {Object} order 订单对象
     * @returns {number} 已实现盈亏
     */
    calculateRealizedPnL(order) {
        // 这里可以根据实际需求实现盈亏计算逻辑
        // 简单示例：买单成交减少盈亏，卖单成交增加盈亏
        if (order.side === 'buy') {
            return -order.cost; // 买入花费的金额
        } else {
            return order.cost; // 卖出获得的金额
        }
    }

    /**
     * 取消所有活跃订单
     * @returns {Promise<boolean>} 是否成功取消所有订单
     */
    async cancelAllOrders() {
        if (this.activeOrders.size === 0) return true;
        
        try {
            this.logger.info(`正在取消所有活跃订单 (${this.activeOrders.size} 个)...`);
            
            // 取消交易所所有订单
            await this.exchangeManager.cancelAllOrders();
            
            // 清空本地活跃订单记录
            this.activeOrders.clear();
            
            this.logger.info('所有活跃订单已取消');
            return true;
            
        } catch (error) {
            this.logger.error('取消所有活跃订单失败', error);
            return false;
        }
    }

    /**
     * 取消特定类型的活跃订单
     * @param {string} side 订单类型 ('buy' 或 'sell')
     * @returns {Promise<boolean>} 是否成功取消订单
     */
    async cancelActiveOrders(side) {
        const ordersToCancel = Array.from(this.activeOrders.values())
            .filter(order => !side || order.side === side);
        
        if (ordersToCancel.length === 0) return true;
        
        try {
            this.logger.info(`正在取消${side ? side === 'buy' ? '买' : '卖' : '所有'}单 (${ordersToCancel.length} 个)...`);
            
            // 并发取消订单
            const cancelPromises = ordersToCancel.map(order => 
                this.exchangeManager.cancelOrder(order.id)
                    .then(() => {
                        this.activeOrders.delete(order.id);
                        return true;
                    })
                    .catch(error => {
                        this.logger.error(`取消订单 ${order.id} 失败`, error);
                        return false;
                    })
            );
            
            const results = await Promise.all(cancelPromises);
            const successCount = results.filter(result => result).length;
            
            this.logger.info(`成功取消 ${successCount}/${ordersToCancel.length} 个订单`);
            return successCount === ordersToCancel.length;
            
        } catch (error) {
            this.logger.error(`取消${side ? side === 'buy' ? '买' : '卖' : '所有'}单失败`, error);
            return false;
        }
    }

    /**
     * 清理多余订单
     * @returns {Promise<boolean>} 是否成功清理
     */
    async cleanupExcessOrders() {
        try {
            const buyOrders = Array.from(this.activeOrders.values()).filter(order => order.side === 'buy');
            const sellOrders = Array.from(this.activeOrders.values()).filter(order => order.side === 'sell');
            
            this.logger.info(`清理多余订单: 当前有 ${buyOrders.length} 个买单和 ${sellOrders.length} 个卖单`);
            
            // 如果买单超过1个，保留最新的一个，取消其他
            if (buyOrders.length > 1) {
                // 按时间排序，保留最新的
                buyOrders.sort((a, b) => b.timestamp - a.timestamp);
                const ordersToKeep = buyOrders.slice(0, 1);
                const ordersToCancel = buyOrders.slice(1);
                
                for (const order of ordersToCancel) {
                    await this.exchangeManager.cancelOrder(order.id);
                    this.activeOrders.delete(order.id);
                    this.logger.info(`已取消多余买单: ${order.id}`);
                }
            }
            
            // 如果卖单超过1个，保留最新的一个，取消其他
            if (sellOrders.length > 1) {
                // 按时间排序，保留最新的
                sellOrders.sort((a, b) => b.timestamp - a.timestamp);
                const ordersToKeep = sellOrders.slice(0, 1);
                const ordersToCancel = sellOrders.slice(1);
                
                for (const order of ordersToCancel) {
                    await this.exchangeManager.cancelOrder(order.id);
                    this.activeOrders.delete(order.id);
                    this.logger.info(`已取消多余卖单: ${order.id}`);
                }
            }
            
            return true;
            
        } catch (error) {
            this.logger.error('清理多余订单失败', error);
            return false;
        }
    }

    /**
     * 创建买卖订单
     * @param {Object} params 订单参数
     * @returns {Promise<boolean>} 是否成功创建订单
     */
    async createOrders(params) {
        // 并发保护
        if (this.isCreatingOrders) {
            this.logger.warn('已有订单创建进行中，跳过本次创建');
            return false;
        }
        
        this.isCreatingOrders = true;
        
        try {
            // 检查交易所连接状态
            if (!this.exchangeManager.isConnected()) {
                this.logger.error('交易所未连接，无法创建订单');
                return false;
            }
            
            // 获取市场信息
            const marketData = this.strategy.marketDataManager.getMarketData();
            if (!marketData.midPrice) {
                this.logger.error('缺少市场数据，无法创建订单');
                return false;
            }
            
            // 计算订单数量
            const { buyPrice, sellPrice, buySize, sellSize } = params;
            
            // 验证风险
            const riskCheckResult = await this.riskManager.validateOrderCreation({
                buyPrice,
                sellPrice,
                buySize,
                sellSize,
                midPrice: marketData.midPrice
            });
            
            if (!riskCheckResult.isValid) {
                this.logger.error('风险检查失败，无法创建订单', riskCheckResult.reason);
                return false;
            }
            
            // 并发创建买单和卖单
            const orderPromises = [];
            
            // 创建买单
            if (buyPrice && buySize) {
                orderPromises.push(
                    this.createOrder('buy', buyPrice, buySize)
                        .then(result => {
                            if (result.success) {
                                this.lastOrderPrices.buy = buyPrice;
                                return { side: 'buy', success: true, order: result.order };
                            }
                            return { side: 'buy', success: false, error: result.error };
                        })
                );
            }
            
            // 创建卖单
            if (sellPrice && sellSize) {
                orderPromises.push(
                    this.createOrder('sell', sellPrice, sellSize)
                        .then(result => {
                            if (result.success) {
                                this.lastOrderPrices.sell = sellPrice;
                                return { side: 'sell', success: true, order: result.order };
                            }
                            return { side: 'sell', success: false, error: result.error };
                        })
                );
            }
            
            // 等待所有订单创建完成
            const results = await Promise.all(orderPromises);
            
            // 更新订单更新时间
            this.lastOrderUpdateTime = Date.now();
            
            // 统计成功和失败
            const successResults = results.filter(r => r.success);
            const failedResults = results.filter(r => !r.success);
            
            if (successResults.length > 0) {
                this.logger.info(`成功创建 ${successResults.length} 个订单`);
                for (const result of successResults) {
                    this.logger.info(`- ${result.side === 'buy' ? '买' : '卖'}单: ${result.order.amount} @ ${result.order.price}`);
                }
            }
            
            if (failedResults.length > 0) {
                this.logger.warn(`${failedResults.length} 个订单创建失败`);
                for (const result of failedResults) {
                    this.logger.warn(`- ${result.side === 'buy' ? '买' : '卖'}单失败: ${result.error}`);
                }
            }
            
            return successResults.length > 0;
            
        } catch (error) {
            this.logger.error('创建订单时出错', error);
            return false;
        } finally {
            this.isCreatingOrders = false;
        }
    }

    /**
     * 创建单个订单
     * @param {string} side 订单方向 ('buy' 或 'sell')
     * @param {number} price 价格
     * @param {number} amount 数量
     * @returns {Promise<Object>} 创建结果
     */
    async createOrder(side, price, amount) {
        try {
            this.logger.info(`创建${side === 'buy' ? '买' : '卖'}单: ${amount} @ ${price}`);
            
            // 创建订单
            const order = await this.exchangeManager.createOrder(side, price, amount);
            
            if (!order || !order.id) {
                throw new Error('交易所未返回有效订单ID');
            }
            
            // 添加到活跃订单
            this.activeOrders.set(order.id, order);
            
            // 初始化订单历史记录
            if (!this.orderHistory.has(order.id)) {
                this.orderHistory.set(order.id, []);
            }
            this.orderHistory.get(order.id).push({
                ...order,
                timestamp: Date.now()
            });
            
            // 二次验证订单是否真的创建成功
            setTimeout(async () => {
                try {
                    const orderDetails = await this.exchangeManager.fetchOrder(order.id);
                    if (orderDetails) {
                        this.handleOrderUpdate(orderDetails);
                    }
                } catch (error) {
                    this.logger.warn(`二次验证订单 ${order.id} 失败`, error);
                }
            }, 2000); // 2秒后验证
            
            return { success: true, order };
            
        } catch (error) {
            this.logger.error(`创建${side === 'buy' ? '买' : '卖'}单失败`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 判断是否需要更新订单
     * @param {Object} params 判断参数
     * @returns {boolean} 是否需要更新
     */
    shouldUpdateOrders(params) {
        const {
            forceUpdate,
            midPrice,
            volatility,
            intensity,
            lastVolatility,
            lastIntensity
        } = params;
        
        // 如果强制更新，直接返回true
        if (forceUpdate) {
            return true;
        }
        
        // 智能订单管理：最多1买1卖
        const buyOrders = Array.from(this.activeOrders.values()).filter(order => order.side === 'buy');
        const sellOrders = Array.from(this.activeOrders.values()).filter(order => order.side === 'sell');
        
        // 如果活跃订单数量超过2个，触发紧急清理
        if (buyOrders.length + sellOrders.length > 2) {
            this.logger.warn(`活跃订单数量异常: ${buyOrders.length} 买单, ${sellOrders.length} 卖单，触发清理`);
            return true;
        }
        
        // 如果没有活跃订单，需要创建
        if (buyOrders.length === 0 && sellOrders.length === 0) {
            return true;
        }
        
        // 检查订单刷新时间
        const now = Date.now();
        const orderRefreshInterval = this.config.orderRefreshInterval || 60000; // 默认1分钟
        if (now - this.lastOrderUpdateTime > orderRefreshInterval) {
            return true;
        }
        
        // 检查指标变化
        const volatilityChangeThreshold = this.config.volatilityChangeThreshold || 0.1; // 10%
        const intensityChangeThreshold = this.config.intensityChangeThreshold || 0.1; // 10%
        
        if (lastVolatility && volatility) {
            const volatilityChange = Math.abs(volatility - lastVolatility) / lastVolatility;
            if (volatilityChange > volatilityChangeThreshold) {
                return true;
            }
        }
        
        if (lastIntensity && intensity) {
            const intensityChange = Math.abs(intensity - lastIntensity) / lastIntensity;
            if (intensityChange > intensityChangeThreshold) {
                return true;
            }
        }
        
        // 检查价格显著变化
        const priceChangeThreshold = this.config.priceChangeThreshold || 0.005; // 0.5%
        
        if (midPrice && this.lastOrderPrices.buy) {
            const buyPriceChange = Math.abs(midPrice - this.lastOrderPrices.buy) / this.lastOrderPrices.buy;
            if (buyPriceChange > priceChangeThreshold) {
                return true;
            }
        }
        
        if (midPrice && this.lastOrderPrices.sell) {
            const sellPriceChange = Math.abs(midPrice - this.lastOrderPrices.sell) / this.lastOrderPrices.sell;
            if (sellPriceChange > priceChangeThreshold) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 获取活跃订单数量
     * @returns {number} 活跃订单数量
     */
    getActiveOrderCount() {
        return this.activeOrders.size;
    }

    /**
     * 获取活跃订单
     * @returns {Array} 活跃订单数组
     */
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }

    /**
     * 获取已实现盈亏
     * @returns {number} 已实现盈亏
     */
    getRealizedPnL() {
        return this.realizedPnL;
    }
}

module.exports = OrderManager;