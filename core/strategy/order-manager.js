const Helpers = require('../../utils/helpers');

/**
 * 订单管理器 - 负责订单的创建、取消、监控和状态管理
 */
class OrderManager {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.config = strategy.config;
        
        // 订单管理
        this.activeOrders = new Map(); // 活跃订单
        this.orderHistory = []; // 订单历史
        this.lastOrderId = 0;
        this.isCreatingOrders = false; // 订单创建并发保护标志
        
        // 上次订单价格记录（用于避免无意义的订单更新）
        this.lastOrderPrices = {
            bid: 0,
            ask: 0,
            timestamp: 0
        };
        
        // 订单监控配置
        this.orderMonitoringInterval = this.config.get('orderMonitoringInterval') || 5000; // 默认5秒检查一次
        this.orderMonitoringTimer = null;
    }

    /**
     * 从交易所同步当前挂单到本地activeOrders（增强容错处理）
     */
    async syncActiveOrdersFromExchange() {
        try {
            this.logger.info('开始同步交易所挂单到本地...');
            const openOrders = await this.strategy.exchangeManager.getOpenOrders();
            
            // 只有在成功获取到订单数据时才清空本地状态
            if (openOrders !== null) {
                const previousOrderCount = this.activeOrders.size;
                this.activeOrders.clear();
                
                if (Array.isArray(openOrders)) {
                    for (const order of openOrders) {
                        this.activeOrders.set(order.id, order);
                    }
                    this.logger.info(`同步完成，当前活跃挂单数: ${this.activeOrders.size}`, {
                        previousCount: previousOrderCount,
                        currentCount: this.activeOrders.size,
                        syncSuccess: true
                    });
                } else {
                    this.logger.warn('获取到的挂单数据格式无效', {
                        dataType: typeof openOrders,
                        data: openOrders
                    });
                }
            } else {
                this.logger.warn('无法获取订单状态，保持现有本地状态不变', {
                    currentActiveOrders: this.activeOrders.size,
                    reason: '网络连接问题或交易所未连接',
                    syncSuccess: false
                });
                console.log(`⚠️ 网络问题，保持现有订单状态: ${this.activeOrders.size}个`);
            }
        } catch (error) {
            this.logger.error('同步交易所挂单失败，保持现有本地状态', {
                error: error.message,
                currentActiveOrders: this.activeOrders.size,
                syncSuccess: false
            });
            console.log(`❌ 订单同步失败，保持现有状态: ${this.activeOrders.size}个`);
        }
    }

    /**
     * 检查是否需要更新订单
     */
    shouldUpdateOrders() {
        const now = Date.now();
        const timeSinceLastUpdate = (now - this.strategy.lastUpdateTime) / 1000;
        
        // 如果标记了强制更新，直接返回true
        if (this.strategy.forceOrderUpdate) {
            this.logger.info('检测到强制更新标志，立即更新订单');
            return true;
        }
        
        // 智能订单管理：允许的情况下最多1个买单和1个卖单存在，总订单数受配置限制
        // 检查当前余额，确定应该有哪些类型的订单
        const balances = this.strategy.exchangeManager.getBalances();
        const { optimalBid, optimalAsk } = this.strategy.strategyState;
        
        // 计算订单数量
        const baseAmount = this.config.get('orderAmount');
        const buyAmount = this.strategy.calculator.calculateOrderAmount(
            baseAmount, this.strategy.strategyState.currentInventory, 
            this.strategy.strategyState.targetInventory, this.strategy.strategyState.totalInventoryValue, true
        );
        const sellAmount = this.strategy.calculator.calculateOrderAmount(
            baseAmount, this.strategy.strategyState.currentInventory, 
            this.strategy.strategyState.targetInventory, this.strategy.strategyState.totalInventoryValue, false
        );
        
        // 检查是否可以创建买单和卖单
        const canCreateBuy = buyAmount > 0 && optimalBid > 0 && 
            this.strategy.riskManager.validateOrder('buy', buyAmount, optimalBid, balances).valid;
        const canCreateSell = sellAmount > 0 && optimalAsk > 0 && 
            this.strategy.riskManager.validateOrder('sell', sellAmount, optimalAsk, balances).valid;
        
        // 计算当前活跃订单类型
        let activeBuyOrders = 0;
        let activeSellOrders = 0;
        for (const order of this.activeOrders.values()) {
            if (order.side === 'buy') activeBuyOrders++;
            else if (order.side === 'sell') activeSellOrders++;
        }
        
        // 检查是否需要补充订单（智能策略：只在允许的情况下要求对应订单存在）
        const needBuyOrder = canCreateBuy && activeBuyOrders === 0;
        const needSellOrder = canCreateSell && activeSellOrders === 0;
        
        if (needBuyOrder || needSellOrder) {
            this.logger.info('检测到需要补充订单（智能策略）', {
                activeBuyOrders,
                activeSellOrders,
                canCreateBuy,
                canCreateSell,
                needBuyOrder,
                needSellOrder,
                strategy: `允许的情况下最多1个买单和1个卖单存在，总订单数不超过${this.config.get('maxOrders') || 10}个`
            });
            return true;
        } else {
            this.logger.debug('当前订单状态符合智能策略要求', {
                canCreateBuy,
                canCreateSell,
                activeBuyOrders,
                activeSellOrders,
                strategy: '允许的情况下最多1个买单和1个卖单存在'
            });
        }
        
        // 检查是否存在过多订单（紧急清理）
        const maxOrders = this.config.get('maxOrders') || 10;
        if (this.activeOrders.size > maxOrders) {
            this.logger.warn('检测到过多活跃订单，触发紧急清理', {
                activeOrdersCount: this.activeOrders.size,
                maxOrders: maxOrders,
                activeOrders: Array.from(this.activeOrders.values()).map(o => ({
                    id: o.id,
                    side: o.side,
                    amount: o.amount,
                    price: o.price,
                    status: o.status
                })),
                reason: `订单数量超过限制（最多${maxOrders}个）`
            });
            console.log(`⚠️ 检测到 ${this.activeOrders.size} 个活跃订单（超过限制${maxOrders}个），触发紧急清理`);
            
            // 立即清理多余订单（异步执行，不阻塞主流程）
            this.cleanupExcessOrders().catch(error => {
                this.logger.error('紧急清理订单失败', { error: error.message });
            });
            return true; // 强制更新订单
        }

        // 检查订单刷新时间
        const orderRefreshTime = (this.config.get('orderTimeout') || 30000) / 1000;
        if (timeSinceLastUpdate < orderRefreshTime) {
            return false;
        }
        
        // 检查指标是否有变化
        if (!this.strategy.indicators.hasChanged()) {
            return false;
        }
        
        // 检查价格是否有显著变化（避免无意义的订单更新）
        const { bid: lastBid, ask: lastAsk } = this.lastOrderPrices;
        const priceChangeThreshold = this.config.get('priceChangeThreshold') || 0.001;
        
        // 如果是第一次创建订单，直接返回true
        if (lastBid === 0 || lastAsk === 0) {
            return true;
        }
        
        // 计算价格变化百分比
        const bidChangePercent = Math.abs((optimalBid - lastBid) / lastBid);
        const askChangePercent = Math.abs((optimalAsk - lastAsk) / lastAsk);
        
        // 只有当买价或卖价变化超过阈值时才更新订单
        const shouldUpdate = bidChangePercent >= priceChangeThreshold || 
                           askChangePercent >= priceChangeThreshold;
        
        if (!shouldUpdate) {
            this.logger.debug('价格变化未达到阈值，跳过订单更新', {
                bidChange: (bidChangePercent * 100).toFixed(4) + '%',
                askChange: (askChangePercent * 100).toFixed(4) + '%',
                threshold: (priceChangeThreshold * 100).toFixed(4) + '%',
                currentBid: optimalBid.toFixed(2),
                currentAsk: optimalAsk.toFixed(2),
                lastBid: lastBid.toFixed(2),
                lastAsk: lastAsk.toFixed(2)
            });
        }
        
        return shouldUpdate;
    }

    /**
     * 更新订单
     */
    async updateOrders() {
        this.logger.info('开始执行 updateOrders 流程');
        try {
            // 重置强制更新标志
            this.strategy.forceOrderUpdate = false;
            
            // 取消现有订单
            this.logger.info('调用 cancelActiveOrders 取消现有订单');
            await this.cancelActiveOrders();
            
            // 创建新订单
            this.logger.info('调用 createOrders 创建新订单');
            await this.createOrders();
            
            // 更新上次订单价格记录
            this.lastOrderPrices = {
                bid: this.strategy.strategyState.optimalBid,
                ask: this.strategy.strategyState.optimalAsk,
                timestamp: Date.now()
            };
            
            this.strategy.lastUpdateTime = Date.now();
            this.logger.info('订单更新流程完成', { 
                lastUpdateTime: new Date(this.strategy.lastUpdateTime).toISOString(),
                updatedPrices: {
                    bid: this.lastOrderPrices.bid.toFixed(2),
                    ask: this.lastOrderPrices.ask.toFixed(2)
                }
            });
            console.log('✅ 订单更新完成');
            
        } catch (error) {
            this.logger.error('更新订单失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            console.log(`❌ 订单更新失败: ${error.message}`);
        }
    }

    /**
     * 紧急清理过多订单
     */
    async cleanupExcessOrders() {
        try {
            this.logger.info('开始紧急清理过多订单', {
                totalOrders: this.activeOrders.size
            });
            
            // 获取所有订单并按时间排序（最新的在前）
            const orders = Array.from(this.activeOrders.values())
                .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
            
            // 取消多余的订单（保留配置允许的数量）
            const maxOrders = this.config.get('maxOrders') || 10;
            const ordersToCancel = orders.slice(maxOrders);
            
            for (const order of ordersToCancel) {
                try {
                    await this.strategy.exchangeManager.cancelOrder(order.id, this.config.get('symbol'));
                    this.activeOrders.delete(order.id);
                    this.logger.info('紧急取消多余订单', {
                        orderId: order.id,
                        side: order.side,
                        price: order.price
                    });
                    console.log(`🗑️ 紧急取消订单 #${order.id.slice(-6)} (${order.side})`);
                } catch (error) {
                    this.logger.error('紧急取消订单失败', {
                        orderId: order.id,
                        error: error.message
                    });
                }
            }
            
            this.logger.info('紧急清理完成', {
                cancelledCount: ordersToCancel.length,
                remainingCount: this.activeOrders.size
            });
            
        } catch (error) {
            this.logger.error('紧急清理过程中发生错误', { error: error.message });
        }
    }

    /**
     * 取消活跃订单
     */
    async cancelActiveOrders() {
        try {
            const orderIds = Array.from(this.activeOrders.keys());
            
            for (const orderId of orderIds) {
                try {
                    await this.strategy.exchangeManager.cancelOrder(orderId, this.config.get('symbol'));
                    this.logger.debug('Order cancelled', { orderId });
                } catch (error) {
                    this.logger.warn('Failed to cancel order', { orderId, error: error.message });
                }
            }
            
            this.activeOrders.clear();
            
        } catch (error) {
            this.logger.error('Failed to cancel active orders', error);
        }
    }

    /**
     * 创建订单（增强网络状态检查）
     */
    async createOrders() {
        try {
            // 并发保护：如果正在创建订单，则跳过
            if (this.isCreatingOrders) {
                this.logger.warn('订单创建正在进行中，跳过本次创建请求');
                console.log('⚠️ 订单创建正在进行中，跳过');
                return;
            }
            
            // 检查交易所连接状态
            if (!this.strategy.exchangeManager.isConnected) {
                this.logger.warn('交易所未连接，跳过订单创建');
                console.log('⚠️ 交易所未连接，跳过订单创建');
                return;
            }
            
            // 检查网络连接状态
            if (this.strategy.exchangeManager.networkManager && !this.strategy.exchangeManager.networkManager.isNetworkAvailable()) {
                this.logger.warn('网络不可用，跳过订单创建', {
                    networkStatus: this.strategy.exchangeManager.networkManager.getNetworkStatus()
                });
                console.log('⚠️ 网络不可用，跳过订单创建');
                return;
            }
            
            this.isCreatingOrders = true;
            this.logger.info('开始创建订单，设置并发保护标志', {
                networkAvailable: true,
                exchangeConnected: true
            });
            
            const { optimalBid, optimalAsk } = this.strategy.strategyState;
            const { currentInventory, targetInventory, totalInventoryValue } = this.strategy.strategyState;
            
            // 获取市场信息以确保正确的精度
            const marketInfo = this.strategy.exchangeManager.getMarketInfo();
            if (!marketInfo || !marketInfo.precision) {
                console.log('❌ 无法获取市场精度信息，跳过订单创建');
                this.logger.error('无法获取市场精度信息，跳过订单创建');
                return;
            }
            
            // 计算订单数量
            const baseAmount = this.config.get('orderAmount');
            const minAmount = marketInfo.precision.amount;
            const adjustedBaseAmount = Math.max(baseAmount, minAmount * 10);
            
            const buyAmount = this.strategy.calculator.calculateOrderAmount(
                adjustedBaseAmount, currentInventory, targetInventory, totalInventoryValue, true
            );
            const sellAmount = this.strategy.calculator.calculateOrderAmount(
                adjustedBaseAmount, currentInventory, targetInventory, totalInventoryValue, false
            );
            
            // 紧凑输出订单信息
            const inventorySkew = ((currentInventory - targetInventory) / totalInventoryValue * 100).toFixed(2);
            console.log(`🔄下单 | 买: ${buyAmount.toFixed(4)}@${optimalBid.toFixed(2)} | 卖: ${sellAmount.toFixed(4)}@${optimalAsk.toFixed(2)} | 库存偏差: ${inventorySkew}%`);
            
            // 并发创建买单和卖单
            const orderTasks = [];
            
            // 买单
            orderTasks.push((async () => {
                if (buyAmount > 0 && optimalBid > 0) {
                    const buyValidation = this.strategy.riskManager.validateOrder('buy', buyAmount, optimalBid, this.strategy.exchangeManager.getBalances());
                    if (buyValidation.valid) {
                        const buyClientOrderId = Helpers.generateUniqueId();
                        const buyOrder = await this.createOrder('buy', buyAmount, optimalBid, buyClientOrderId);
                        if (buyOrder) {
                            this.activeOrders.set(buyOrder.id, buyOrder);
                            console.log(`✅买单 #${buyOrder.id.slice(-6)} | ${buyAmount.toFixed(4)}@${optimalBid.toFixed(2)}`);
                            this.logger.info('买单创建成功', {
                                orderId: buyOrder.id,
                                clientOrderId: buyClientOrderId,
                                amount: buyOrder.amount,
                                price: buyOrder.price,
                                status: buyOrder.status
                            });
                        } else {
                            console.log(`❌买单创建失败`);
                        }
                    } else {
                        console.log(`❌买单风险拒绝: ${buyValidation.reason}`);
                        this.logger.warn('买单被风险管理器拒绝', buyValidation);
                    }
                } else {
                    const reason = buyAmount <= 0 ? '数量为零' : '价格无效';
                    console.log(`⏭️跳过买单: ${reason}`);
                    this.logger.debug('跳过买单创建', {
                        buyAmount: buyAmount,
                        optimalBid: optimalBid,
                        reason: reason
                    });
                }
            })());
            
            // 卖单
            orderTasks.push((async () => {
                if (sellAmount > 0 && optimalAsk > 0) {
                    const sellValidation = this.strategy.riskManager.validateOrder('sell', sellAmount, optimalAsk, this.strategy.exchangeManager.getBalances());
                    if (sellValidation.valid) {
                        const sellClientOrderId = Helpers.generateUniqueId();
                        const sellOrder = await this.createOrder('sell', sellAmount, optimalAsk, sellClientOrderId);
                        if (sellOrder) {
                            this.activeOrders.set(sellOrder.id, sellOrder);
                            console.log(`✅卖单 #${sellOrder.id.slice(-6)} | ${sellAmount.toFixed(4)}@${optimalAsk.toFixed(2)}`);
                            this.logger.info('卖单创建成功', {
                                orderId: sellOrder.id,
                                clientOrderId: sellClientOrderId,
                                amount: sellOrder.amount,
                                price: sellOrder.price,
                                status: sellOrder.status
                            });
                        } else {
                            console.log(`❌卖单创建失败`);
                        }
                    } else {
                        console.log(`❌卖单风险拒绝: ${sellValidation.reason}`);
                        this.logger.warn('卖单被风险管理器拒绝', sellValidation);
                    }
                } else {
                    const reason = sellAmount <= 0 ? '数量为零' : '价格无效';
                    console.log(`⏭️跳过卖单: ${reason}`);
                    this.logger.debug('跳过卖单创建', {
                        sellAmount: sellAmount,
                        optimalAsk: optimalAsk,
                        reason: reason
                    });
                }
            })());
            
            // 并发执行买卖单下单
            await Promise.all(orderTasks);
            
            // 紧凑输出订单创建结果
            console.log(`📋订单完成 | 活跃: ${this.activeOrders.size}个`);
            
            this.logger.info('订单创建完成', {
                buyAmount,
                sellAmount,
                optimalBid,
                optimalAsk,
                activeOrdersCount: this.activeOrders.size
            });
        } catch (error) {
            console.log('❌ 创建订单失败:', error.message);
            this.logger.error('创建订单失败', error);
        } finally {
            this.isCreatingOrders = false;
            this.logger.debug("订单创建并发保护标志已重置");
        }
    }

    /**
     * 创建单个订单（下单后主动校验订单状态，带超时和重试）
     */
    async createOrder(side, amount, price, clientOrderId, maxRetries = 3, timeout = 5000) {
        let attempt = 0;
        this.logger.info('尝试创建单个订单', { side, amount, price, clientOrderId, maxRetries, timeout });
        
        while (attempt < maxRetries) {
            try {
                this.logger.debug(`正在创建${side === 'buy' ? '买单' : '卖单'}... (第${attempt + 1}次尝试, ClientOrderID: ${clientOrderId})`);
                this.logger.debug(`参数: ${side} ${amount} BTC @ ${price} USDT`);

                // 尝试下单
                const orderPromise = this.strategy.exchangeManager.createOrder(side, amount, price, 'limit', { clientOrderId });
                const order = await Promise.race([
                    orderPromise,
                    this.sleep(timeout).then(() => { throw new Error('下单请求超时'); })
                ]);

                if (order && order.id) {
                    // 订单已成功提交并返回ID，进行二次验证
                    this.logger.info('Order submitted, verifying...', {
                        id: order.id,
                        clientOrderId: clientOrderId,
                        side,
                        amount,
                        price,
                        status: order.status
                    });
                    
                    // 等待一小段时间后验证订单是否真正存在
                    await this.sleep(500);
                    try {
                        const verifyOrder = await this.strategy.exchangeManager.getOrderById(order.id);
                        if (verifyOrder && verifyOrder.id === order.id) {
                            this.logger.info('Order verification successful', {
                                id: order.id,
                                verifiedStatus: verifyOrder.status
                            });
                            return verifyOrder; // 返回验证后的订单信息
                        } else {
                            this.logger.warn('Order verification failed - order not found', {
                                id: order.id,
                                clientOrderId: clientOrderId
                            });
                            throw new Error('订单验证失败 - 订单不存在');
                        }
                    } catch (verifyError) {
                        this.logger.warn('Order verification error, using original order', {
                            id: order.id,
                            error: verifyError.message
                        });
                        // 验证失败时仍返回原订单，但记录警告
                        return order;
                    }
                } else {
                    // 订单提交失败，但没有抛出异常（例如返回null或空对象）
                    throw new Error('无效订单返回');
                }
            } catch (error) {
                attempt++;
                this.logger.warn('下单请求失败', {
                    side,
                    amount,
                    price,
                    clientOrderId,
                    attempt,
                    error: error.message
                });

                // 如果是超时错误，尝试通过 clientOrderId 查询订单状态
                if (error.message === '下单请求超时' || error.message.includes('timeout')) {
                    try {
                        const existingOrder = await this.strategy.exchangeManager.getOrderByClientOrderId(clientOrderId, this.config.get('symbol'));
                        if (existingOrder && existingOrder.id) {
                            this.logger.info('Found existing order after timeout', {
                                id: existingOrder.id,
                                clientOrderId: clientOrderId,
                                status: existingOrder.status
                            });
                            return existingOrder; // 找到现有订单，不再重试
                        }
                    } catch (queryError) {
                        this.logger.error('Failed to query existing order by clientOrderId', {
                            clientOrderId,
                            error: queryError.message
                        });
                    }
                }

                if (attempt < maxRetries) {
                    await this.sleep(1000); // 重试间隔1秒
                } else {
                    this.logger.error('下单最终失败', {
                        side,
                        amount,
                        price,
                        clientOrderId,
                        attempt,
                        error: error.message
                    });
                }
            }
        }
        return null; // 所有重试都失败
    }

    /**
     * 取消所有订单
     */
    async cancelAllOrders() {
        try {
            await this.cancelActiveOrders();
            this.logger.info('All orders cancelled');
        } catch (error) {
            this.logger.error('Failed to cancel all orders', error);
        }
    }

    /**
     * 处理订单更新
     */
    handleOrderUpdate(order) {
        try {
            const orderId = order.id;
            this.logger.info('收到订单更新', {
                id: order.id,
                status: order.status,
                side: order.side,
                amount: order.amount,
                filled: order.filled,
                remaining: order.remaining,
                clientOrderId: order.clientOrderId
            });

            // 更新活跃订单
            if (this.activeOrders.has(orderId)) {
                const existingOrder = this.activeOrders.get(orderId);
                // 仅当新状态更"终结"时才更新，避免旧状态覆盖新状态
                if (this.isNewOrderStatusMoreFinal(existingOrder.status, order.status)) {
                    this.activeOrders.set(orderId, order);
                    this.logger.debug('活跃订单状态已更新', { id: order.id, oldStatus: existingOrder.status, newStatus: order.status });
                } else {
                    this.logger.debug('活跃订单状态未更新 (新状态不更终结)', { id: order.id, oldStatus: existingOrder.status, newStatus: order.status });
                }
                
                // 检查订单状态
                if (order.status === 'filled') {
                    this.logger.info('订单已成交，调用 handleOrderFilled', { id: order.id });
                    this.handleOrderFilled(order);
                } else if (order.status === 'canceled' || order.status === 'rejected' || order.status === 'expired') {
                    this.logger.info('订单已取消/拒绝/过期，从活跃订单中移除', { id: order.id, status: order.status });
                    this.activeOrders.delete(orderId);
                } else if (order.status === 'open' && !this.activeOrders.has(orderId)) {
                    // 如果是新收到的open订单，且本地没有，则添加
                    this.activeOrders.set(orderId, order);
                    this.logger.info('新开放订单已添加到活跃订单列表', { id: order.id });
                }
            } else if (order.status === 'open' || order.status === 'partially_filled') {
                // 如果本地没有此订单，且状态是open或partially_filled，则添加
                this.activeOrders.set(orderId, order);
                this.logger.info('新订单已添加到活跃订单列表', { id: order.id, status: order.status });
            }
            
            // 记录订单历史
            this.orderHistory.push({
                ...order,
                timestamp: Date.now()
            });
            this.logger.debug('订单已添加到历史记录', { id: order.id, historySize: this.orderHistory.length });
            
        } catch (error) {
            this.logger.error('处理订单更新时出错', {
                orderId: order ? order.id : 'N/A',
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 辅助函数：判断新订单状态是否比旧状态更"终结"
     * 用于避免旧的或不完整的状态更新覆盖新的、更准确的状态
     */
    isNewOrderStatusMoreFinal(oldStatus, newStatus) {
        const statusPrecedence = {
            'open': 1,
            'partially_filled': 2,
            'canceled': 3,
            'rejected': 3,
            'expired': 3,
            'filled': 4
        };
        return (statusPrecedence[newStatus] || 0) >= (statusPrecedence[oldStatus] || 0);
    }

    /**
     * 处理订单成交
     */
    handleOrderFilled(order) {
        try {
            this.logger.info('订单已成交', {
                id: order.id,
                side: order.side,
                amount: order.amount,
                price: order.price,
                cost: order.cost,
                filled: order.filled,
                remaining: order.remaining,
                clientOrderId: order.clientOrderId
            });
            
            // 从活跃订单中移除
            if (this.activeOrders.has(order.id)) {
                this.activeOrders.delete(order.id);
                this.logger.debug('已成交订单从活跃订单列表中移除', { id: order.id });
            } else {
                this.logger.warn('尝试移除已成交订单，但该订单不在活跃订单列表中', { id: order.id });
            }
            
            // 更新已实现盈亏（这里简化处理，实际应该根据成本价计算）
            const realizedPnL = this.calculateRealizedPnL(order);
            this.strategy.riskManager.updateRealizedPnL(realizedPnL);
            this.logger.info('已实现盈亏已更新', { orderId: order.id, realizedPnL: realizedPnL });
            
            // 标记需要强制更新订单（订单成交后立即更新）
            this.strategy.forceOrderUpdate = true;
            this.logger.info('订单成交，已设置强制更新标志，等待下次策略循环时更新订单');
            
        } catch (error) {
            this.logger.error('处理订单成交时出错', {
                orderId: order ? order.id : 'N/A',
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * 计算已实现盈亏
     */
    calculateRealizedPnL(order) {
        // 这里简化计算，实际应该根据持仓成本价计算
        // 对于做市策略，通常通过买卖价差获得利润
        const spread = this.strategy.currentMarketData.bestAsk - this.strategy.currentMarketData.bestBid;
        const estimatedPnL = order.amount * spread * 0.5; // 假设获得一半价差
        
        return estimatedPnL;
    }

    /**
     * 启动订单监控
     */
    startOrderMonitoring() {
        if (this.orderMonitoringTimer) {
            this.logger.warn('订单监控已在运行中');
            return;
        }
        
        this.logger.info('启动订单状态监控', {
            interval: this.orderMonitoringInterval
        });
        
        this.orderMonitoringTimer = setInterval(async () => {
            try {
                await this.monitorOrderStatus();
            } catch (error) {
                this.logger.error('订单监控过程中出错', {
                    errorName: error.name,
                    errorMessage: error.message
                });
            }
        }, this.orderMonitoringInterval);
    }
    
    /**
     * 停止订单监控
     */
    stopOrderMonitoring() {
        if (this.orderMonitoringTimer) {
            clearInterval(this.orderMonitoringTimer);
            this.orderMonitoringTimer = null;
            this.logger.info('订单监控已停止');
        }
    }
    
    /**
     * 监控订单状态
     */
    async monitorOrderStatus() {
        if (!this.strategy.isRunning || this.activeOrders.size === 0) {
            return;
        }
        
        this.logger.debug('开始监控订单状态', {
            activeOrdersCount: this.activeOrders.size
        });
        
        // 创建当前活跃订单的副本，避免在迭代过程中修改
        const ordersToCheck = new Map(this.activeOrders);
        
        for (const [orderId, localOrder] of ordersToCheck) {
            try {
                // 查询远程订单状态
                const remoteOrder = await this.strategy.exchangeManager.getOrder(orderId);
                
                // 检查状态是否发生变化
                if (remoteOrder.status !== localOrder.status) {
                    this.logger.info('检测到订单状态变化', {
                        orderId: orderId,
                        localStatus: localOrder.status,
                        remoteStatus: remoteOrder.status,
                        side: remoteOrder.side,
                        amount: remoteOrder.amount,
                        price: remoteOrder.price
                    });
                    
                    // 触发订单更新处理
                    this.handleOrderUpdate(remoteOrder);
                }
                
            } catch (error) {
                // 如果订单查询失败，可能是订单已被取消或不存在
                if (error.message.includes('Order not found') || 
                    error.message.includes('order not found') ||
                    error.message.includes('Invalid order')) {
                    this.logger.warn('订单不存在，从活跃订单列表中移除', {
                        orderId: orderId,
                        error: error.message
                    });
                    
                    // 创建一个取消状态的订单对象
                    const canceledOrder = {
                        ...localOrder,
                        status: 'canceled',
                        timestamp: Date.now()
                    };
                    
                    this.handleOrderUpdate(canceledOrder);
                } else {
                    this.logger.error('查询订单状态失败', {
                        orderId: orderId,
                        errorName: error.name,
                        errorMessage: error.message
                    });
                }
            }
        }
    }

    /**
     * 工具函数：睡眠
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取活跃订单数量
     */
    getActiveOrdersCount() {
        return this.activeOrders.size;
    }

    /**
     * 获取活跃订单列表
     */
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }

    /**
     * 获取订单历史
     */
    getOrderHistory(limit = 10) {
        return this.orderHistory.slice(-limit);
    }
}

module.exports = OrderManager;