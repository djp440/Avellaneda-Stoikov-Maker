const AvellanedaCalculator = require('./calculator');
const { IndicatorsManager } = require('./indicators');
const ExchangeManager = require('./exchange');
const RiskManager = require('./risk-manager');
const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');

/**
 * Avellaneda做市策略核心逻辑
 */
class AvellanedaStrategy {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(config);
        
        // 初始化组件
        this.calculator = new AvellanedaCalculator(config);
        this.indicators = new IndicatorsManager(config);
        this.exchangeManager = new ExchangeManager(config);
        this.riskManager = new RiskManager(config);
        
        // 策略状态
        this.isRunning = false;
        this.isInitialized = false;
        this.lastUpdateTime = 0;
        this.orderRefreshTime = config.get('orderTimeout') || 30; // 订单刷新时间(秒)
        this.filledOrderDelay = config.get('filledOrderDelay') || 1; // 订单成交后延迟(秒)
        
        // 订单管理
        this.activeOrders = new Map(); // 活跃订单
        this.orderHistory = []; // 订单历史
        this.lastOrderId = 0;
        
        // 市场数据
        this.currentMarketData = {
            midPrice: 0,
            bestBid: 0,
            bestAsk: 0,
            timestamp: 0
        };
        
        // 账户数据
        this.currentBalances = {
            baseAmount: 0,
            quoteAmount: 0,
            timestamp: 0
        };
        
        // 策略状态
        this.strategyState = {
            optimalBid: 0,
            optimalAsk: 0,
            optimalSpread: 0,
            inventorySkew: 0,
            targetInventory: 0,
            currentInventory: 0,
            totalInventoryValue: 0
        };
        
        // 设置交易所事件监听
        this.setupExchangeEventListeners();
        
        this.logger.info('AvellanedaStrategy initialized', {
            orderRefreshTime: this.orderRefreshTime,
            filledOrderDelay: this.filledOrderDelay,
            riskManager: 'enabled'
        });
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
     * 处理订单簿更新
     */
    handleOrderBookUpdate(data) {
        try {
            this.currentMarketData = {
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
            this.updateIndicators();
            
        } catch (error) {
            this.logger.error('Error handling order book update', error);
        }
    }

    /**
     * 处理价格更新
     */
    handleTickerUpdate(data) {
        try {
            // 更新最新价格
            this.currentMarketData.lastPrice = data.last;
            this.currentMarketData.timestamp = data.timestamp;
            
        } catch (error) {
            this.logger.error('Error handling ticker update', error);
        }
    }

    /**
     * 处理余额更新
     */
    handleBalanceUpdate(data) {
        try {
            this.currentBalances = {
                baseAmount: data.base.free,
                quoteAmount: data.quote.free,
                timestamp: data.timestamp
            };
            
        } catch (error) {
            this.logger.error('Error handling balance update', error);
        }
    }

    /**
     * 处理连接丢失
     */
    handleConnectionLost() {
        this.logger.warn('Exchange connection lost, pausing strategy execution');
        // 可以在这里添加连接丢失时的处理逻辑
    }

    /**
     * 处理连接恢复
     */
    handleConnectionRestored() {
        this.logger.info('Exchange connection restored, resuming strategy execution');
        // 可以在这里添加连接恢复时的处理逻辑
    }

    /**
     * 初始化策略
     */
    async initialize() {
        try {
            this.logger.info('Initializing strategy');
            
            // 初始化交易所连接
            const exchangeInitialized = await this.exchangeManager.initialize();
            if (!exchangeInitialized) {
                throw new Error('Failed to initialize exchange connection');
            }
            
            // 初始化技术指标
            this.indicators.initialize();
            
            // 初始化风险管理器
            const riskInitialized = await this.riskManager.initialize();
            if (!riskInitialized) {
                throw new Error('Failed to initialize risk manager');
            }
            
            // 标记为已初始化
            this.isInitialized = true;
            
            this.logger.info('Strategy initialized successfully');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize strategy', error);
            return false;
        }
    }

    /**
     * 验证交易所连接
     */
    async validateExchangeConnection() {
        try {
            // 检查交易所状态
            const status = await this.exchange.fetchStatus();
            if (!status.status || status.status !== 'ok') {
                throw new Error(`Exchange status: ${status.status}`);
            }
            
            // 检查交易对信息
            const ticker = await this.exchange.fetchTicker(this.config.get('symbol'));
            if (!ticker || !ticker.last) {
                throw new Error('Unable to fetch ticker data');
            }
            
            this.logger.info('Exchange connection validated', {
                status: status.status,
                symbol: this.config.get('symbol'),
                lastPrice: ticker.last
            });
        } catch (error) {
            this.logger.error('Exchange connection validation failed', error);
            throw error;
        }
    }

    /**
     * 启动策略
     */
    async start() {
        try {
            if (!this.isInitialized) {
                throw new Error('Strategy not initialized');
            }
            
            this.isRunning = true;
            this.logger.info('Strategy started');
            
            // 开始主循环
            this.mainLoop();
            
            return true;
        } catch (error) {
            this.logger.error('Failed to start strategy', error);
            return false;
        }
    }

    /**
     * 停止策略
     */
    async stop() {
        try {
            this.isRunning = false;
            
            // 停止风险管理器
            this.riskManager.cleanup();
            
            // 取消所有活跃订单
            await this.cancelAllOrders();
            
            // 关闭交易所连接
            await this.exchangeManager.close();
            
            this.logger.info('Strategy stopped');
            return true;
        } catch (error) {
            this.logger.error('Failed to stop strategy', error);
            return false;
        }
    }

    /**
     * 主循环
     */
    async mainLoop() {
        while (this.isRunning) {
            try {
                // 检查风险状态
                const riskStatus = this.riskManager.getRiskStatus();
                if (riskStatus.state.isEmergencyStop) {
                    this.logger.warn('Strategy paused due to emergency stop');
                    await this.sleep(10000); // 紧急停止时等待更长时间
                    continue;
                }
                
                // 检查指标是否准备就绪
                if (this.indicators.isReady()) {
                    // 执行策略逻辑
                    await this.executeStrategy();
                } else {
                    this.logger.debug('Indicators not ready yet', this.indicators.getStatus());
                }
                
                // 等待下一次更新
                await this.sleep(this.config.get('updateInterval') || 1000);
                
            } catch (error) {
                this.logger.error('Error in main loop', error);
                await this.sleep(5000); // 错误时等待更长时间
            }
        }
    }

    /**
     * 更新市场数据
     */
    async updateMarketData() {
        try {
            // 获取订单簿
            const orderBook = await this.exchange.fetchOrderBook(this.config.get('symbol'));
            
            // 获取最新价格
            const ticker = await this.exchange.fetchTicker(this.config.get('symbol'));
            
            // 计算中间价
            const midPrice = Helpers.calculateMidPrice(orderBook.bids[0][0], orderBook.asks[0][0]);
            
            this.currentMarketData = {
                midPrice,
                bestBid: orderBook.bids[0][0],
                bestAsk: orderBook.asks[0][0],
                orderBook,
                lastPrice: ticker.last,
                timestamp: Date.now()
            };
            
            this.logger.debug('Market data updated', {
                midPrice,
                bestBid: this.currentMarketData.bestBid,
                bestAsk: this.currentMarketData.bestAsk,
                lastPrice: ticker.last
            });
            
        } catch (error) {
            this.logger.error('Failed to update market data', error);
        }
    }

    /**
     * 更新账户余额
     */
    async updateBalances() {
        try {
            const balances = await this.exchange.fetchBalance();
            
            const baseAmount = balances[this.config.get('baseCurrency')]?.free || 0;
            const quoteAmount = balances[this.config.get('quoteCurrency')]?.free || 0;
            
            this.currentBalances = {
                baseAmount,
                quoteAmount,
                timestamp: Date.now()
            };
            
            this.logger.debug('Balances updated', {
                baseAmount,
                quoteAmount
            });
            
        } catch (error) {
            this.logger.error('Failed to update balances', error);
        }
    }

    /**
     * 更新技术指标
     */
    updateIndicators() {
        try {
            const { midPrice, orderBook, timestamp } = this.currentMarketData;
            
            // 更新波动率指标
            this.indicators.updatePrice(midPrice, timestamp);
            
            // 更新交易强度指标
            if (orderBook && orderBook.bids && orderBook.asks) {
                this.indicators.updateOrderBook(orderBook.bids, orderBook.asks, timestamp);
            }
            
        } catch (error) {
            this.logger.error('Failed to update indicators', error);
        }
    }

    /**
     * 执行策略逻辑
     */
    async executeStrategy() {
        try {
            // 获取当前指标值
            const indicators = this.indicators.getCurrentValues();
            
            // 更新计算器状态
            const calculatorState = this.calculator.updateState(
                this.currentMarketData,
                indicators,
                this.currentBalances
            );
            
            if (!calculatorState) {
                this.logger.warn('Failed to update calculator state');
                return;
            }
            
            // 更新策略状态
            this.strategyState = {
                ...calculatorState,
                currentInventory: this.currentBalances.baseAmount,
                totalInventoryValue: calculatorState.inventoryValue.totalValue
            };
            
            // 更新风险管理器的持仓信息
            this.riskManager.updatePosition(
                this.currentBalances.baseAmount,
                calculatorState.inventoryValue.totalValue,
                this.currentMarketData.midPrice
            );
            
            // 检查是否需要更新订单
            if (this.shouldUpdateOrders()) {
                await this.updateOrders();
            }
            
            // 记录策略状态
            this.logStrategyStatus();
            
        } catch (error) {
            this.logger.error('Error executing strategy', error);
        }
    }

    /**
     * 检查是否需要更新订单
     */
    shouldUpdateOrders() {
        const now = Date.now();
        const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
        
        // 检查订单刷新时间
        if (timeSinceLastUpdate < this.orderRefreshTime) {
            return false;
        }
        
        // 检查指标是否有变化
        if (!this.indicators.hasChanged()) {
            return false;
        }
        
        return true;
    }

    /**
     * 更新订单
     */
    async updateOrders() {
        try {
            this.logger.info('Updating orders');
            
            // 取消现有订单
            await this.cancelActiveOrders();
            
            // 创建新订单
            await this.createOrders();
            
            this.lastUpdateTime = Date.now();
            
        } catch (error) {
            this.logger.error('Failed to update orders', error);
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
                    await this.exchangeManager.cancelOrder(orderId, this.config.get('symbol'));
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
     * 创建订单
     */
    async createOrders() {
        try {
            const { optimalBid, optimalAsk } = this.strategyState;
            const { currentInventory, targetInventory, totalInventoryValue } = this.strategyState;
            
            // 计算订单数量
            const baseAmount = this.config.get('orderAmount');
            const buyAmount = this.calculator.calculateOrderAmount(
                baseAmount, currentInventory, targetInventory, totalInventoryValue, true
            );
            const sellAmount = this.calculator.calculateOrderAmount(
                baseAmount, currentInventory, targetInventory, totalInventoryValue, false
            );
            
            // 创建买单
            if (buyAmount > 0 && optimalBid > 0) {
                // 风险验证
                const buyValidation = this.riskManager.validateOrder('buy', buyAmount, optimalBid);
                if (buyValidation.valid) {
                    const buyOrder = await this.createOrder('buy', buyAmount, optimalBid);
                    if (buyOrder) {
                        this.activeOrders.set(buyOrder.id, buyOrder);
                    }
                } else {
                    this.logger.warn('Buy order rejected by risk manager', buyValidation);
                }
            }
            
            // 创建卖单
            if (sellAmount > 0 && optimalAsk > 0) {
                // 风险验证
                const sellValidation = this.riskManager.validateOrder('sell', sellAmount, optimalAsk);
                if (sellValidation.valid) {
                    const sellOrder = await this.createOrder('sell', sellAmount, optimalAsk);
                    if (sellOrder) {
                        this.activeOrders.set(sellOrder.id, sellOrder);
                    }
                } else {
                    this.logger.warn('Sell order rejected by risk manager', sellValidation);
                }
            }
            
            this.logger.info('Orders created', {
                buyAmount,
                sellAmount,
                optimalBid,
                optimalAsk,
                activeOrdersCount: this.activeOrders.size
            });
            
        } catch (error) {
            this.logger.error('Failed to create orders', error);
        }
    }

    /**
     * 创建单个订单
     */
    async createOrder(side, amount, price) {
        try {
            const order = await this.exchangeManager.createOrder(side, amount, price, 'limit');
            
            if (order) {
            this.logger.info('Order created', {
                id: order.id,
                side,
                amount,
                price,
                status: order.status
            });
            }
            
            return order;
        } catch (error) {
            this.logger.error('Failed to create order', {
                side,
                amount,
                price,
                error: error.message
            });
            return null;
        }
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
            
            // 更新活跃订单
            if (this.activeOrders.has(orderId)) {
                this.activeOrders.set(orderId, order);
                
                // 检查订单状态
                if (order.status === 'filled') {
                    this.handleOrderFilled(order);
                } else if (order.status === 'canceled') {
                    this.activeOrders.delete(orderId);
                }
            }
            
            // 记录订单历史
            this.orderHistory.push({
                ...order,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.logger.error('Failed to handle order update', error);
        }
    }

    /**
     * 处理订单成交
     */
    handleOrderFilled(order) {
        try {
            this.logger.info('Order filled', {
                id: order.id,
                side: order.side,
                amount: order.amount,
                price: order.price,
                cost: order.cost
            });
            
            // 从活跃订单中移除
            this.activeOrders.delete(order.id);
            
            // 更新已实现盈亏（这里简化处理，实际应该根据成本价计算）
            const realizedPnL = this.calculateRealizedPnL(order);
            this.riskManager.updateRealizedPnL(realizedPnL);
            
            // 延迟创建新订单
            setTimeout(() => {
                if (this.isRunning) {
                    this.updateOrders();
                }
            }, this.filledOrderDelay * 1000);
            
        } catch (error) {
            this.logger.error('Failed to handle order filled', error);
        }
    }
    
    /**
     * 计算已实现盈亏
     */
    calculateRealizedPnL(order) {
        // 这里简化计算，实际应该根据持仓成本价计算
        // 对于做市策略，通常通过买卖价差获得利润
        const spread = this.currentMarketData.bestAsk - this.currentMarketData.bestBid;
        const estimatedPnL = order.amount * spread * 0.5; // 假设获得一半价差
        
        return estimatedPnL;
    }

    /**
     * 记录策略状态
     */
    logStrategyStatus() {
        try {
            const status = {
                timestamp: Date.now(),
                isRunning: this.isRunning,
                marketData: {
                    midPrice: this.currentMarketData.midPrice,
                    bestBid: this.currentMarketData.bestBid,
                    bestAsk: this.currentMarketData.bestAsk
                },
                balances: {
                    baseAmount: this.currentBalances.baseAmount,
                    quoteAmount: this.currentBalances.quoteAmount
                },
                strategyState: this.strategyState,
                indicators: this.indicators.getCurrentValues(),
                activeOrders: this.activeOrders.size
            };
            
            this.logger.info('Strategy status', status);
            
        } catch (error) {
            this.logger.error('Failed to log strategy status', error);
        }
    }

    /**
     * 获取策略状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            marketData: this.currentMarketData,
            balances: this.currentBalances,
            strategyState: this.strategyState,
            indicators: this.indicators.getStatus(),
            riskStatus: this.riskManager.getRiskStatus(),
            activeOrders: Array.from(this.activeOrders.values()),
            orderHistory: this.orderHistory.slice(-10) // 最近10个订单
        };
    }

    /**
     * 工具函数：睡眠
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AvellanedaStrategy; 