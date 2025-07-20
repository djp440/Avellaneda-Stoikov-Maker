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
        this.exchangeManager = new ExchangeManager(config);
        this.calculator = new AvellanedaCalculator(config, this.exchangeManager);
        this.indicators = new IndicatorsManager(config);
        this.riskManager = new RiskManager(config);
        
        // 策略状态
        this.isRunning = false;
        this.isInitialized = false;
        this.lastUpdateTime = 0;
        this.orderRefreshTime = (config.get('orderTimeout') || 30000) / 1000; // 订单刷新时间(秒)
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
        
        this.logger.info('Avellaneda策略已初始化', {
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
            this.logger.error('处理订单簿更新时出错', error);
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
            this.logger.error('处理价格更新时出错', error);
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
        this.syncActiveOrdersFromExchange();
        // 可以在这里添加连接恢复时的其他处理逻辑
    }

    /**
     * 从交易所同步当前挂单到本地activeOrders
     */
    async syncActiveOrdersFromExchange() {
        try {
            this.logger.info('开始同步交易所挂单到本地...');
            const openOrders = await this.exchangeManager.getOpenOrders();
            this.activeOrders.clear();
            if (Array.isArray(openOrders)) {
                for (const order of openOrders) {
                    this.activeOrders.set(order.id, order);
                }
                this.logger.info(`同步完成，当前活跃挂单数: ${this.activeOrders.size}`);
            } else {
                this.logger.warn('未能获取到有效的挂单数据');
            }
        } catch (error) {
            this.logger.error('同步交易所挂单失败', error);
        }
    }

    /**
     * 初始化策略
     */
    async initialize() {
        try {
            this.logger.info('正在初始化策略');
            
            // 初始化交易所连接
            const exchangeInitialized = await this.exchangeManager.initialize();
            if (!exchangeInitialized) {
                throw new Error('Failed to initialize exchange connection');
            }
            
            // 技术指标管理器不需要显式初始化，在构造函数中已经初始化
            
            // 初始化风险管理器
            const riskInitialized = await this.riskManager.initialize();
            if (!riskInitialized) {
                throw new Error('Failed to initialize risk manager');
            }
            
            // 挂单同步
            await this.syncActiveOrdersFromExchange();
            
            // 标记为已初始化
            this.isInitialized = true;
            
            this.logger.info('策略初始化成功');
            return true;
            
        } catch (error) {
            this.logger.error('策略初始化失败', error);
            return false;
        }
    }

    /**
     * 验证交易所连接
     */
    async validateExchangeConnection() {
        try {
            // 检查交易所状态
            const status = await this.exchangeManager.fetchStatus();
            if (!status.status || status.status !== 'ok') {
                throw new Error(`Exchange status: ${status.status}`);
            }
            
            // 检查交易对信息
            const ticker = await this.exchangeManager.fetchTicker(this.config.get('symbol'));
            if (!ticker || !ticker.last) {
                throw new Error('Unable to fetch ticker data');
            }
            
            this.logger.info('交易所连接验证通过', {
                status: status.status,
                symbol: this.config.get('symbol'),
                lastPrice: ticker.last
            });
        } catch (error) {
            this.logger.error('交易所连接验证失败', error);
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
            this.logger.info('策略已启动');
            
            // 开始主循环
            this.mainLoop();
            
            return true;
        } catch (error) {
            this.logger.error('策略启动失败', error);
            return false;
        }
    }

    /**
     * 停止策略
     */
    
    async stop() {
        try {
            if (!this.isRunning || this.isShuttingDown) {
                this.logger.warn('策略未在运行或正在关闭中');
                console.log('⚠️ 策略未在运行或正在关闭中');
                return;
            }

            this.isShuttingDown = true;
            console.log('\n🛑 开始停止策略...\n');
            this.logger.info('停止策略');

            // 停止健康检查
            console.log('💓 停止健康检查...');
            this.stopHealthCheck();
            console.log('✅ 健康检查已停止');

            // 停止策略
            if (this.strategy) {
                console.log('🎯 停止策略算法...');
                await this.strategy.stop();
                console.log('✅ 策略算法已停止');
            }

            // 清理交易所连接
            if (this.exchangeManager) {
                console.log('🏢 清理交易所连接...');
                await this.exchangeManager.close();
                console.log('✅ 交易所连接已清理');
            }

            // 清理网络管理器
            if (this.networkManager) {
                console.log('🌐 清理网络管理器...');
                this.networkManager.close();
                console.log('✅ 网络管理器已清理');
            }

            // 标记为停止状态
            this.isRunning = false;
            this.isShuttingDown = false;

            // 记录策略状态
            const uptime = this.startTime ? Date.now() - this.startTime : 0;
            this.logger.strategyStatus('stopped', {
                timestamp: new Date().toISOString(),
                uptime: uptime
            });

            console.log('\n✅ 策略停止成功！');
            console.log('─'.repeat(40));
            console.log(`📅 停止时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`⏱️ 运行时长: ${Math.round(uptime / 1000)}秒`);
            console.log('─'.repeat(40) + '\n');
            
            this.logger.info('策略停止成功');

        } catch (error) {
            this.logger.errorWithStack('策略停止失败', error);
            
            console.error('\n❌ 策略停止失败:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            // 强制清理
            this.forceCleanup();
            
            throw error;
        }
    }

    /**
     * 强制清理资源
     */
    forceCleanup() {
        try {
            // 强制停止所有定时器
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            // 强制停止策略
            this.isRunning = false;
            this.isShuttingDown = false;
            
            console.log('🧹 强制清理完成');
        } catch (error) {
            console.error('❌ 强制清理失败:', error.message);
        }
    }

    /**
     * 主循环
     */
    async mainLoop() {
        const loopTimeout = 30000; // 30秒超时
        let lastLoopTime = Date.now();
        while (this.isRunning) {
            try {
                const loopPromise = (async () => {
                    // 检查循环超时
                    const currentTime = Date.now();
                    if (currentTime - lastLoopTime > loopTimeout) {
                        this.logger.warn('主循环超时，重新开始循环');
                        lastLoopTime = currentTime;
                    }
                    // 检查风险状态
                    const riskStatus = this.riskManager.getRiskStatus();
                    if (riskStatus.state.isEmergencyStop) {
                        this.logger.warn('策略因紧急停止而暂停');
                        await this.sleep(10000); // 紧急停止时等待更长时间
                        return;
                    }
                    // 检查指标是否准备就绪
                    if (this.indicators.isReady()) {
                        await this.executeStrategy();
                    } else {
                        this.logger.debug('技术指标尚未准备就绪', this.indicators.getStatus());
                    }
                    lastLoopTime = Date.now();
                })();
                // 增加超时保护，防止单次循环卡死
                await Promise.race([
                    loopPromise,
                    this.sleep(loopTimeout).then(() => {
                        this.logger.error('主循环单次迭代超时，强制跳过');
                    })
                ]);
                await this.sleep(this.config.get('updateInterval') || 1000);
            } catch (error) {
                this.logger.error('主循环执行出错', error);
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
            const orderBook = await this.exchangeManager.fetchOrderBook(this.config.get('symbol'));
            
            // 获取最新价格
            const ticker = await this.exchangeManager.fetchTicker(this.config.get('symbol'));
            
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
            this.logger.error('更新市场数据失败', error);
        }
    }

    /**
     * 更新账户余额
     */
    async updateBalances() {
        try {
            const balances = await this.exchangeManager.fetchBalance();
            
            const baseAmount = balances[this.config.get('baseCurrency')]?.free || 0;
            const quoteAmount = balances[this.config.get('quoteCurrency')]?.free || 0;
            
            this.currentBalances = {
                baseAmount,
                quoteAmount,
                timestamp: Date.now()
            };
            
            this.logger.debug('余额已更新', {
                baseAmount,
                quoteAmount
            });
            
        } catch (error) {
            this.logger.error('更新余额失败', error);
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
            this.logger.error('更新技术指标失败', error);
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
                this.logger.warn('更新计算器状态失败');
                return;
            }
            
            // 更新策略状态
            this.strategyState = {
                ...calculatorState,
                currentInventory: this.currentBalances.baseAmount,
                totalInventoryValue: calculatorState.inventoryValue.totalValue
            };
            
            // 更新风险管理器的持仓信息和账户总价值
            this.riskManager.updatePosition(
                this.currentBalances.baseAmount,
                calculatorState.inventoryValue.baseValue, // 只使用基础货币价值，不包含计价货币
                this.currentMarketData.midPrice
            );
            
            // 更新账户总价值（用于计算最大持仓限制的基数）
            const totalAccountValue = calculatorState.inventoryValue.totalValue;
            this.riskManager.updateAccountValue(totalAccountValue);
            
            // 打印策略状态信息
            this.printStrategyStatus();
            
            // 检查是否需要更新订单
            if (this.shouldUpdateOrders()) {
                console.log('\n🔄 开始更新订单...');
                await this.updateOrders();
            } else {
                // 显示为什么不需要更新订单
                this.printOrderUpdateStatus();
            }
            
            // 记录策略状态
            this.logStrategyStatus();
            
        } catch (error) {
            this.logger.error('执行策略时出错', error);
        }
    }

    /**
     * 打印策略状态信息
     */
    printStrategyStatus() {
        const { optimalBid, optimalAsk, optimalSpread, inventorySkew, targetInventory, currentInventory } = this.strategyState;
        const { midPrice, bestBid, bestAsk } = this.currentMarketData;
        const { baseAmount, quoteAmount } = this.currentBalances;
        
        console.log('\n📊 策略状态:');
        console.log('─'.repeat(50));
        console.log(`💰 市场价格:`);
        console.log(`   中间价: ${midPrice.toFixed(2)} USDT`);
        console.log(`   最佳买价: ${bestBid.toFixed(2)} USDT`);
        console.log(`   最佳卖价: ${bestAsk.toFixed(2)} USDT`);
        console.log(`   市场价差: ${((bestAsk - bestBid) / midPrice * 100).toFixed(4)}%`);
        
        console.log(`\n🎯 策略价格:`);
        console.log(`   最优买价: ${optimalBid.toFixed(2)} USDT`);
        console.log(`   最优卖价: ${optimalAsk.toFixed(2)} USDT`);
        console.log(`   策略价差: ${(optimalSpread / midPrice * 100).toFixed(4)}%`);
        
        console.log(`\n📦 库存信息:`);
        console.log(`   当前库存: ${currentInventory.toFixed(8)} ${this.config.get('baseCurrency')}`);
        console.log(`   目标库存: ${targetInventory.toFixed(8)} ${this.config.get('baseCurrency')}`);
        console.log(`   库存偏差: ${(inventorySkew * 100).toFixed(4)}%`);
        console.log(`   基础余额: ${baseAmount.toFixed(8)} ${this.config.get('baseCurrency')}`);
        console.log(`   计价余额: ${quoteAmount.toFixed(2)} ${this.config.get('quoteCurrency')}`);
        
        // 显示技术指标
        const indicators = this.indicators.getCurrentValues();
        console.log(`\n📈 技术指标:`);
        console.log(`   波动率: ${(indicators.volatility * 100).toFixed(4)}%`);
        console.log(`   交易强度: ${indicators.tradingIntensity.toFixed(6)}`);
        console.log(`   指标就绪: ${this.indicators.isReady() ? '✅' : '❌'}`);
        
        // 显示风险状态
        const riskStatus = this.riskManager.getRiskStatus();
        console.log(`\n🛡️ 风险状态:`);
        console.log(`   当前持仓: ${riskStatus.state.currentPosition.toFixed(8)} ${this.config.get('baseCurrency')}`);
        console.log(`   持仓价值: ${riskStatus.state.currentPositionValue.toFixed(2)} USDT`);
        console.log(`   账户总值: ${riskStatus.state.totalAccountValue.toFixed(2)} USDT`);
        console.log(`   未实现盈亏: ${riskStatus.state.unrealizedPnL.toFixed(2)} USDT`);
        console.log(`   日盈亏: ${riskStatus.state.dailyPnL.toFixed(2)} USDT`);
        console.log(`   紧急停止: ${riskStatus.state.isEmergencyStop ? '⚠️ 是' : '✅ 否'}`);
        
        console.log('─'.repeat(50));
    }

    /**
     * 打印订单更新状态
     */
    printOrderUpdateStatus() {
        const now = Date.now();
        const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
        const timeUntilNextUpdate = this.orderRefreshTime - timeSinceLastUpdate;
        
        console.log(`\n⏰ 订单更新状态:`);
        console.log(`   距离上次更新: ${timeSinceLastUpdate.toFixed(1)}秒`);
        console.log(`   距离下次更新: ${timeUntilNextUpdate.toFixed(1)}秒`);
        console.log(`   指标变化: ${this.indicators.hasChanged() ? '✅ 有变化' : '❌ 无变化'}`);
        console.log(`   活跃订单: ${this.activeOrders.size}个`);
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
            console.log('🔄 正在更新订单...');
            
            // 取消现有订单
            await this.cancelActiveOrders();
            
            // 创建新订单
            await this.createOrders();
            
            this.lastUpdateTime = Date.now();
            
        } catch (error) {
            this.logger.error('更新订单失败', error);
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
            console.log('\n📝 开始构建订单参数...');
            console.log('─'.repeat(50));
            // 获取市场信息以确保正确的精度
            const marketInfo = this.exchangeManager.getMarketInfo();
            if (!marketInfo || !marketInfo.precision) {
                console.log('❌ 无法获取市场精度信息，跳过订单创建');
                this.logger.error('无法获取市场精度信息，跳过订单创建');
                return;
            }
            // 计算订单数量
            const baseAmount = this.config.get('orderAmount');
            // 确保基础数量符合最小精度要求
            const minAmount = marketInfo.precision.amount; // CCXT返回的是最小数量，不是精度位数
            const adjustedBaseAmount = Math.max(baseAmount, minAmount * 10); // 至少10倍最小数量
            console.log('📊 订单数量计算:');
            console.log(`   原始数量: ${baseAmount}`);
            console.log(`   调整数量: ${adjustedBaseAmount}`);
            console.log(`   最小数量: ${minAmount}`);
            console.log(`   数量精度: ${minAmount} (最小数量)`);
            const buyAmount = this.calculator.calculateOrderAmount(
                adjustedBaseAmount, currentInventory, targetInventory, totalInventoryValue, true
            );
            const sellAmount = this.calculator.calculateOrderAmount(
                adjustedBaseAmount, currentInventory, targetInventory, totalInventoryValue, false
            );
            console.log('\n🎯 订单数量计算结果:');
            console.log(`   买单数量: ${buyAmount.toFixed(8)} ${this.config.get('baseCurrency')}`);
            console.log(`   卖单数量: ${sellAmount.toFixed(8)} ${this.config.get('baseCurrency')}`);
            console.log(`   库存偏差: ${((currentInventory - targetInventory) / totalInventoryValue * 100).toFixed(4)}%`);
            // 并发创建买单和卖单
            const orderTasks = [];
            // 买单
            orderTasks.push((async () => {
                if (buyAmount > 0 && optimalBid > 0) {
                    console.log('\n🟢 创建买单:');
                    console.log(`   价格: ${optimalBid.toFixed(2)} USDT`);
                    console.log(`   数量: ${buyAmount.toFixed(8)} BTC`);
                    console.log(`   价值: ${(buyAmount * optimalBid).toFixed(2)} USDT`);
                    const buyValidation = this.riskManager.validateOrder('buy', buyAmount, optimalBid);
                    if (buyValidation.valid) {
                        console.log('   ✅ 风险验证通过');
                        const buyClientOrderId = Helpers.generateUniqueId(); // 生成唯一的 clientOrderId
                        const buyOrder = await this.createOrder('buy', buyAmount, optimalBid, buyClientOrderId);
                        if (buyOrder) {
                            this.activeOrders.set(buyOrder.id, buyOrder);
                            console.log(`   ✅ 买单创建成功 - ID: ${buyOrder.id}`);
                            this.logger.info('买单创建成功', {
                                orderId: buyOrder.id,
                                clientOrderId: buyClientOrderId,
                                amount: buyOrder.amount,
                                price: buyOrder.price,
                                status: buyOrder.status
                            });
                        } else {
                            console.log('   ❌ 买单创建失败');
                        }
                    } else {
                        console.log('   ❌ 风险验证失败:', buyValidation.reason);
                        this.logger.warn('买单被风险管理器拒绝', buyValidation);
                    }
                } else {
                    console.log('\n🟢 跳过买单创建:');
                    console.log(`   原因: ${buyAmount <= 0 ? '数量为零' : '价格无效'}`);
                    console.log(`   数量: ${buyAmount.toFixed(8)} BTC`);
                    console.log(`   价格: ${optimalBid.toFixed(2)} USDT`);
                    this.logger.debug('跳过买单创建', {
                        buyAmount: buyAmount,
                        optimalBid: optimalBid,
                        reason: buyAmount <= 0 ? '数量为零' : '价格无效'
                    });
                }
            })());
            // 卖单
            orderTasks.push((async () => {
                if (sellAmount > 0 && optimalAsk > 0) {
                    console.log('\n🔴 创建卖单:');
                    console.log(`   价格: ${optimalAsk.toFixed(2)} USDT`);
                    console.log(`   数量: ${sellAmount.toFixed(8)} BTC`);
                    console.log(`   价值: ${(sellAmount * optimalAsk).toFixed(2)} USDT`);
                    const sellValidation = this.riskManager.validateOrder('sell', sellAmount, optimalAsk);
                    if (sellValidation.valid) {
                        console.log('   ✅ 风险验证通过');
                        const sellClientOrderId = Helpers.generateUniqueId(); // 生成唯一的 clientOrderId
                        const sellOrder = await this.createOrder('sell', sellAmount, optimalAsk, sellClientOrderId);
                        if (sellOrder) {
                            this.activeOrders.set(sellOrder.id, sellOrder);
                            console.log(`   ✅ 卖单创建成功 - ID: ${sellOrder.id}`);
                            this.logger.info('卖单创建成功', {
                                orderId: sellOrder.id,
                                clientOrderId: sellClientOrderId,
                                amount: sellOrder.amount,
                                price: sellOrder.price,
                                status: sellOrder.status
                            });
                        } else {
                            console.log('   ❌ 卖单创建失败');
                        }
                    } else {
                        console.log('   ❌ 风险验证失败:', sellValidation.reason);
                        this.logger.warn('卖单被风险管理器拒绝', sellValidation);
                    }
                } else {
                    console.log('\n🔴 跳过卖单创建:');
                    console.log(`   原因: ${sellAmount <= 0 ? '数量为零' : '价格无效'}`);
                    console.log(`   数量: ${sellAmount.toFixed(8)} BTC`);
                    console.log(`   价格: ${optimalAsk.toFixed(2)} USDT`);
                    this.logger.debug('跳过卖单创建', {
                        sellAmount: sellAmount,
                        optimalAsk: optimalAsk,
                        reason: sellAmount <= 0 ? '数量为零' : '价格无效'
                    });
                }
            })());
            // 并发执行买卖单下单
            await Promise.all(orderTasks);
            console.log('\n📋 订单创建完成:');
            console.log(`   活跃订单数: ${this.activeOrders.size}个`);
            console.log(`   买单数量: ${buyAmount.toFixed(8)} BTC`);
            console.log(`   卖单数量: ${sellAmount.toFixed(8)} BTC`);
            console.log(`   最优买价: ${optimalBid.toFixed(2)} USDT`);
            console.log(`   最优卖价: ${optimalAsk.toFixed(2)} USDT`);
            console.log('─'.repeat(50));
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
        }
    }

    /**
     * 创建单个订单（下单后主动校验订单状态，带超时和重试）
     */
    async createOrder(side, amount, price, clientOrderId, maxRetries = 3, timeout = 5000) {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                console.log(`   🔧 正在创建${side === 'buy' ? '买单' : '卖单'}... (第${attempt + 1}次尝试, ClientOrderID: ${clientOrderId})`);
                console.log(`      参数: ${side} ${amount} BTC @ ${price} USDT`);

                // 尝试下单
                const orderPromise = this.exchangeManager.createOrder(side, amount, price, 'limit', { clientOrderId });
                const order = await Promise.race([
                    orderPromise,
                    this.sleep(timeout).then(() => { throw new Error('下单请求超时'); })
                ]);

                if (order && order.id) {
                    // 订单已成功提交并返回ID
                    console.log(`   ✅ 订单提交成功 - ID: ${order.id}`);
                    this.logger.info('Order submitted', {
                        id: order.id,
                        clientOrderId: clientOrderId,
                        side,
                        amount,
                        price,
                        status: order.status
                    });
                    return order;
                } else {
                    // 订单提交失败，但没有抛出异常（例如返回null或空对象）
                    console.log(`   ❌ 订单提交失败 - 返回无效订单对象`);
                    throw new Error('无效订单返回');
                }
            } catch (error) {
                attempt++;
                console.log(`   ❌ 第${attempt}次下单请求失败: ${error.message}`);
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
                    console.log(`   ⏳ 下单超时，尝试通过 ClientOrderID: ${clientOrderId} 查询订单状态...`);
                    try {
                        const existingOrder = await this.exchangeManager.getOrderByClientOrderId(clientOrderId, this.config.get('symbol'));
                        if (existingOrder && existingOrder.id) {
                            console.log(`   ✅ 发现现有订单 - ID: ${existingOrder.id}, 状态: ${existingOrder.status}`);
                            this.logger.info('Found existing order after timeout', {
                                id: existingOrder.id,
                                clientOrderId: clientOrderId,
                                status: existingOrder.status
                            });
                            return existingOrder; // 找到现有订单，不再重试
                        } else {
                            console.log('   ⚠️ 未找到现有订单，将重试下单');
                        }
                    } catch (queryError) {
                        console.log(`   ❌ 查询现有订单失败: ${queryError.message}`);
                        this.logger.error('Failed to query existing order by clientOrderId', {
                            clientOrderId,
                            error: queryError.message
                        });
                    }
                }

                if (attempt < maxRetries) {
                    await this.sleep(1000); // 重试间隔1秒
                    console.log('   ⏳ 准备重试下单...');
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