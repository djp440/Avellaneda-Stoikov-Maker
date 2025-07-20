const ccxt = require('ccxt');
const EventEmitter = require('events');
const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');
const NetworkManager = require('./network-manager');

/**
 * 交易所接口管理类
 * 负责CCXT交易所连接、实时数据获取、订单管理等
 */
class ExchangeManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger(config);
        
        // 网络管理器
        this.networkManager = new NetworkManager(config);
        
        // 交易所实例
        this.exchange = null;
        this.exchangeName = config.get('exchange').name;
        
        // 连接状态
        this.isConnected = false;
        this.isConnecting = false;
        this.lastConnectionTime = 0;
        this.connectionRetryCount = 0;
        this.maxRetryCount = 5;
        
        // 市场数据
        this.marketData = {
            orderBook: null,
            ticker: null,
            trades: [],
            lastUpdate: 0
        };
        
        // 账户数据
        this.accountData = {
            balances: {},
            positions: {},
            orders: [],
            lastUpdate: 0
        };
        
        // 数据更新间隔
        this.orderBookUpdateInterval = 1000; // 1秒
        this.tickerUpdateInterval = 2000;    // 2秒
        this.balanceUpdateInterval = 5000;   // 5秒
        
        // 更新定时器
        this.updateTimers = {
            orderBook: null,
            ticker: null,
            balance: null
        };
        
        // 重连定时器
        this.reconnectTimer = null;
        this.reconnectInterval = 10000; // 10秒
        
        // 事件监听器
        this.setupEventListeners();
        
        // 监听网络状态变化
        this.networkManager.on('connectionLost', () => {
            this.handleNetworkConnectionLost();
        });
        
        this.networkManager.on('connectionRestored', () => {
            this.handleNetworkConnectionRestored();
        });
        
        this.logger.info('交易所管理器已初始化', {
            exchange: this.exchangeName,
            symbol: config.get('symbol')
        });
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听交易所事件
        this.on('orderBookUpdate', (data) => {
            this.logger.debug('Order book updated', {
                symbol: data.symbol,
                bids: data.bids.length,
                asks: data.asks.length
            });
        });

        this.on('tickerUpdate', (data) => {
            this.logger.debug('Ticker updated', {
                symbol: data.symbol,
                last: data.last,
                change: data.change
            });
        });

        this.on('balanceUpdate', (data) => {
            this.logger.debug('Balance updated', {
                base: data.base,
                quote: data.quote
            });
        });

        this.on('orderUpdate', (data) => {
            this.logger.info('订单已更新', {
                id: data.id,
                status: data.status,
                side: data.side
            });
        });

        this.on('connectionLost', () => {
            this.logger.warn('交易所连接丢失');
            this.handleConnectionLost();
        });

        this.on('connectionRestored', () => {
            this.logger.info('交易所连接已恢复');
            this.connectionRetryCount = 0;
        });
    }

    /**
     * 初始化交易所连接
     */
    async initialize() {
        try {
            this.logger.info('正在初始化交易所连接', {
                exchange: this.exchangeName
            });

            // 检查网络连接
            if (!this.networkManager.isNetworkAvailable()) {
                this.logger.warn('网络不可用，等待连接...');
                await this.waitForNetworkConnection();
            }

            // 创建交易所实例
            await this.createExchangeInstance();
            
            // 测试连接
            await this.testConnection();
            
            // 加载市场信息
            await this.loadMarketInfo();
            
            // 启动数据更新
            this.startDataUpdates();
            
            this.isConnected = true;
            this.lastConnectionTime = Date.now();
            
            this.logger.info('Exchange connection initialized successfully');
            this.emit('connectionRestored');
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize exchange connection', error);
            this.handleConnectionError(error);
            return false;
        }
    }

    /**
     * 等待网络连接
     */
    async waitForNetworkConnection(timeout = 60000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkNetwork = () => {
                if (this.networkManager.isNetworkAvailable()) {
                    this.logger.info('Network connection restored');
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Network connection timeout'));
                    return;
                }
                
                setTimeout(checkNetwork, 5000);
            };
            
            checkNetwork();
        });
    }

    /**
     * 创建交易所实例
     */
    async createExchangeInstance() {
        try {
            const exchangeConfig = this.config.get('exchange');
            
            // 检查交易所是否支持
            if (!ccxt[this.exchangeName]) {
                throw new Error(`Unsupported exchange: ${this.exchangeName}`);
            }
            
            // 获取代理配置
            const proxyConfig = this.networkManager.getProxyConfig();
            
            // 创建交易所实例
            const exchangeOptions = {
                apiKey: exchangeConfig.apiKey,
                secret: exchangeConfig.secret,
                password: exchangeConfig.password, // Bitget需要passphrase
                sandbox: this.config.isSandbox(),
                enableRateLimit: true,
                options: {
                    defaultType: 'spot',
                    adjustForTimeDifference: true
                }
            };
            
            // 添加代理配置
            if (proxyConfig.enabled) {
                exchangeOptions.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
                if (proxyConfig.auth) {
                    exchangeOptions.proxy = `${proxyConfig.protocol}://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`;
                }
            }
            
            this.exchange = new ccxt[this.exchangeName](exchangeOptions);
            
            // 设置请求超时
            this.exchange.timeout = 30000;
            
            this.logger.info('Exchange instance created', {
                exchange: this.exchangeName,
                sandbox: this.config.isSandbox(),
                hasProxy: proxyConfig.enabled
            });
            
        } catch (error) {
            this.logger.error('Failed to create exchange instance', error);
            throw error;
        }
    }

    /**
     * 测试连接
     */
    async testConnection() {
        try {
            this.logger.info('Testing exchange connection');
            
            // 加载市场
            await this.exchange.loadMarkets();
            
            // 测试API连接
            await this.exchange.fetchBalance();
            
            // 测试市场数据获取
            const symbol = this.config.get('symbol');
            await this.exchange.fetchOrderBook(symbol);
            await this.exchange.fetchTicker(symbol);
            
            this.logger.info('Exchange connection test passed');
            
        } catch (error) {
            this.logger.error('Exchange connection test failed', error);
            throw error;
        }
    }

    /**
     * 加载市场信息
     */
    async loadMarketInfo() {
        try {
            const symbol = this.config.get('symbol');
            const market = this.exchange.market(symbol);
            
            if (!market) {
                throw new Error(`Market not found: ${symbol}`);
            }
            
            this.marketInfo = {
                symbol: market.symbol,
                base: market.base,
                quote: market.quote,
                precision: market.precision,
                limits: market.limits,
                active: market.active
            };
            
            this.logger.info('Market info loaded', {
                symbol: market.symbol,
                base: market.base,
                quote: market.quote,
                active: market.active
            });
            
        } catch (error) {
            this.logger.error('Failed to load market info', error);
            throw error;
        }
    }

    /**
     * 启动数据更新
     */
    startDataUpdates() {
        // 启动订单簿更新
        this.updateTimers.orderBook = setInterval(() => {
            this.updateOrderBook();
        }, this.orderBookUpdateInterval);

        // 启动价格更新
        this.updateTimers.ticker = setInterval(() => {
            this.updateTicker();
        }, this.tickerUpdateInterval);

        // 启动余额更新
        this.updateTimers.balance = setInterval(() => {
            this.updateBalances();
        }, this.balanceUpdateInterval);

        this.logger.info('Data updates started');
    }

    /**
     * 停止数据更新
     */
    stopDataUpdates() {
        Object.values(this.updateTimers).forEach(timer => {
            if (timer) {
                clearInterval(timer);
            }
        });
        
        this.updateTimers = {
            orderBook: null,
            ticker: null,
            balance: null
        };
        
        this.logger.info('Data updates stopped');
    }

    /**
     * 更新订单簿
     */
    
    async updateOrderBook() {
        try {
            if (!this.isConnected || !this.exchange) {
                return;
            }

            const symbol = this.config.get('symbol');
            
            // 添加超时保护
            const orderBookPromise = this.exchange.fetchOrderBook(symbol);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Order book fetch timeout')), 10000);
            });
            
            const orderBook = await Promise.race([orderBookPromise, timeoutPromise]);
            
            // 验证订单簿数据
            if (!orderBook || !orderBook.bids || !orderBook.asks) {
                this.logger.warn('Invalid order book data received');
                return;
            }

            this.marketData.orderBook = orderBook;
            this.marketData.lastUpdate = Date.now();

            // 计算中间价
            const midPrice = Helpers.calculateMidPrice(
                orderBook.bids[0][0], 
                orderBook.asks[0][0]
            );

            const orderBookData = {
                symbol,
                bids: orderBook.bids,
                asks: orderBook.asks,
                midPrice,
                timestamp: orderBook.timestamp,
                datetime: orderBook.datetime
            };

            this.emit('orderBookUpdate', orderBookData);
            
        } catch (error) {
            this.logger.error('Failed to update order book', error);
            this.handleConnectionError(error);
        }
    }

    /**
     * 更新价格数据
     */
    async updateTicker() {
        try {
            if (!this.isConnected || !this.exchange) {
                return;
            }

            const symbol = this.config.get('symbol');
            const ticker = await this.exchange.fetchTicker(symbol);
            
            // 验证价格数据
            if (!ticker || !ticker.last) {
                this.logger.warn('Invalid ticker data received');
                return;
            }

            this.marketData.ticker = ticker;
            this.marketData.lastUpdate = Date.now();

            const tickerData = {
                symbol,
                last: ticker.last,
                bid: ticker.bid,
                ask: ticker.ask,
                high: ticker.high,
                low: ticker.low,
                volume: ticker.baseVolume,
                change: ticker.change,
                percentage: ticker.percentage,
                timestamp: ticker.timestamp,
                datetime: ticker.datetime
            };

            this.emit('tickerUpdate', tickerData);
            
        } catch (error) {
            this.logger.error('Failed to update ticker', error);
            this.handleConnectionError(error);
        }
    }

    /**
     * 更新账户余额
     */
    async updateBalances() {
        try {
            if (!this.isConnected || !this.exchange) {
                return;
            }

            const balances = await this.exchange.fetchBalance();
            
            // 获取基础货币和计价货币余额
            const baseCurrency = this.config.get('baseCurrency');
            const quoteCurrency = this.config.get('quoteCurrency');
            
            const baseBalance = balances[baseCurrency] || { free: 0, used: 0, total: 0 };
            const quoteBalance = balances[quoteCurrency] || { free: 0, used: 0, total: 0 };

            this.accountData.balances = {
                [baseCurrency]: baseBalance,
                [quoteCurrency]: quoteBalance
            };
            this.accountData.lastUpdate = Date.now();

            const balanceData = {
                base: {
                    free: baseBalance.free,
                    used: baseBalance.used,
                    total: baseBalance.total
                },
                quote: {
                    free: quoteBalance.free,
                    used: quoteBalance.used,
                    total: quoteBalance.total
                },
                timestamp: Date.now()
            };

            this.emit('balanceUpdate', balanceData);
            
        } catch (error) {
            this.logger.error('Failed to update balances', error);
            this.handleConnectionError(error);
        }
    }

    /**
     * 获取当前订单簿
     */
    getOrderBook() {
        return this.marketData.orderBook;
    }

    /**
     * 获取当前价格数据
     */
    getTicker() {
        return this.marketData.ticker;
    }

    /**
     * 获取当前余额
     */
    getBalances() {
        return this.accountData.balances;
    }

    /**
     * 获取市场信息
     */
    getMarketInfo() {
        return this.marketInfo;
    }

    /**
     * 创建订单
     */
    async createOrder(side, amount, price, type = 'limit', params = {}) {
        try {
            if (!this.isConnected || !this.exchange) {
                throw new Error('Exchange not connected');
            }

            const symbol = this.config.get('symbol');
            
            // 格式化价格和数量
            const formattedPrice = this.formatPrice(price);
            const formattedAmount = this.formatAmount(amount);

            // 优先使用传入的 clientOrderId，否则生成新的
            const orderParams = {
                ...params,
                clientOrderId: params.clientOrderId || Helpers.generateUniqueId()
            };

            let order;
            if (type === 'limit') {
                order = await this.exchange.createLimitOrder(
                    symbol, side, formattedAmount, formattedPrice, orderParams
                );
            } else if (type === 'market') {
                order = await this.exchange.createMarketOrder(
                    symbol, side, formattedAmount, orderParams
                );
            }

            this.logger.info('Order created', {
                id: order.id,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                amount: order.amount,
                price: order.price,
                status: order.status
            });

            this.logger.info('订单创建成功并触发更新事件', {
                id: order.id,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                amount: order.amount,
                price: order.price,
                status: order.status,
                clientOrderId: order.clientOrderId
            });
            this.emit('orderUpdate', order);
            return order;
            
        } catch (error) {
            this.logger.error('创建订单失败', {
                side,
                amount,
                price,
                type,
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * 取消订单
     */
    async cancelOrder(orderId, symbol = null) {
        try {
            if (!this.isConnected || !this.exchange) {
                throw new Error('Exchange not connected');
            }

            const orderSymbol = symbol || this.config.get('symbol');
            const order = await this.exchange.cancelOrder(orderId, orderSymbol);

            this.logger.info('Order cancelled', {
                id: order.id,
                symbol: order.symbol,
                status: order.status
            });

            this.emit('orderUpdate', order);
            return order;
            
        } catch (error) {
            this.logger.error('Failed to cancel order', {
                orderId,
                symbol,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 获取订单信息
     */
    async getOrder(orderId, symbol = null) {
        try {
            if (!this.isConnected || !this.exchange) {
                throw new Error('Exchange not connected');
            }

            const orderSymbol = symbol || this.config.get('symbol');
            const order = await this.exchange.fetchOrder(orderId, orderSymbol);

            return order;
            
        } catch (error) {
            this.logger.error('Failed to get order', {
                orderId,
                symbol,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 通过 clientOrderId 获取订单信息
     */
    async getOrderByClientOrderId(clientOrderId, symbol = null) {
        try {
            if (!this.isConnected || !this.exchange) {
                throw new Error('Exchange not connected');
            }

            const orderSymbol = symbol || this.config.get('symbol');
            // 检查交易所是否支持 fetchOrderByClientId
            if (this.exchange.has['fetchOrderByClientId']) {
                const order = await this.exchange.fetchOrderByClientId(clientOrderId, orderSymbol);
                return order;
            } else {
                // 如果不支持，尝试获取所有订单并过滤
                this.logger.warn('交易所不支持 fetchOrderByClientId，尝试获取所有订单并过滤');
                const openOrders = await this.exchange.fetchOpenOrders(orderSymbol);
                return openOrders.find(order => order.clientOrderId === clientOrderId);
            }
            
        } catch (error) {
            this.logger.error('Failed to get order by clientOrderId', {
                clientOrderId,
                symbol,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 获取活跃订单
     */
    async getOpenOrders(symbol = null) {
        try {
            if (!this.isConnected || !this.exchange) {
                throw new Error('Exchange not connected');
            }

            const orderSymbol = symbol || this.config.get('symbol');
            const orders = await this.exchange.fetchOpenOrders(orderSymbol);

            return orders;
            
        } catch (error) {
            this.logger.error('Failed to get open orders', {
                symbol,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 格式化价格
     */
    formatPrice(price) {
        if (!this.marketInfo || !this.marketInfo.precision) {
            return price;
        }

        const pricePrecision = this.marketInfo.precision.price;
        if (pricePrecision !== undefined) {
            return parseFloat(price.toFixed(pricePrecision));
        }

        return price;
    }

    /**
     * 格式化数量
     */
    formatAmount(amount) {
        if (!this.marketInfo || !this.marketInfo.precision) {
            return amount;
        }

        // CCXT返回的amount是最小数量，不是精度位数
        // 我们需要根据最小数量计算精度位数
        const minAmount = this.marketInfo.precision.amount;
        if (minAmount !== undefined && minAmount > 0) {
            // 计算精度位数：例如 0.000001 -> 6位小数
            const precision = Math.abs(Math.floor(Math.log10(minAmount)));
            return parseFloat(amount.toFixed(precision));
        }

        return amount;
    }

    /**
     * 处理网络连接丢失
     */
    handleNetworkConnectionLost() {
        this.logger.warn('Network connection lost, pausing exchange operations');
        
        if (this.isConnected) {
            this.isConnected = false;
            this.emit('connectionLost');
        }
        
        // 停止数据更新
        this.stopDataUpdates();
    }

    /**
     * 处理网络连接恢复
     */
    async handleNetworkConnectionRestored() {
        this.logger.info('Network connection restored, attempting to reconnect exchange');
        
        // 等待网络稳定
        setTimeout(async () => {
            try {
                await this.reconnect();
            } catch (error) {
                this.logger.error('Failed to reconnect after network restoration', error);
            }
        }, 2000);
    }

    /**
     * 处理连接错误
     */
    handleConnectionError(error) {
        this.logger.error('Connection error occurred', error);
        
        if (this.isConnected) {
            this.isConnected = false;
            this.emit('connectionLost');
        }

        // 尝试重连
        this.scheduleReconnect();
    }

    /**
     * 处理连接丢失
     */
    handleConnectionLost() {
        this.logger.warn('Connection lost, attempting to reconnect');
        
        // 停止数据更新
        this.stopDataUpdates();
        
        // 尝试重连
        this.scheduleReconnect();
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.connectionRetryCount >= this.maxRetryCount) {
            this.logger.error('Max reconnection attempts reached');
            return;
        }

        this.connectionRetryCount++;
        const delay = this.reconnectInterval * this.connectionRetryCount;

        this.logger.info(`Scheduling reconnection attempt ${this.connectionRetryCount}/${this.maxRetryCount} in ${delay}ms`);

        this.reconnectTimer = setTimeout(async () => {
            await this.reconnect();
        }, delay);
    }

    /**
     * 重连
     */
    async reconnect() {
        try {
            this.logger.info('Attempting to reconnect');
            
            // 重新初始化连接
            const success = await this.initialize();
            
            if (success) {
                this.logger.info('Reconnection successful');
                this.emit('connectionRestored');
            } else {
                this.logger.error('Reconnection failed');
                this.scheduleReconnect();
            }
            
        } catch (error) {
            this.logger.error('Reconnection error', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 关闭连接
     */
    async close() {
        try {
            this.logger.info('Closing exchange connection');
            
            // 停止数据更新
            this.stopDataUpdates();
            
            // 清除重连定时器
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // 关闭网络管理器
            this.networkManager.close();
            
            // 重置状态
            this.isConnected = false;
            this.isConnecting = false;
            
            this.logger.info('Exchange connection closed');
            
        } catch (error) {
            this.logger.error('Error closing exchange connection', error);
        }
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            exchange: this.exchangeName,
            symbol: this.config.get('symbol'),
            lastConnectionTime: this.lastConnectionTime,
            connectionRetryCount: this.connectionRetryCount,
            lastUpdate: this.marketData.lastUpdate,
            networkStatus: this.networkManager.getNetworkStatus(),
            networkStats: this.networkManager.getConnectionStats()
        };
    }
}

module.exports = ExchangeManager; 