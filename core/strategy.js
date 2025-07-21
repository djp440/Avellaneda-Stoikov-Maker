const AvellanedaCalculator = require('./calculator');
const { IndicatorsManager } = require('./indicators');
const ExchangeManager = require('./exchange');
const RiskManager = require('./risk-manager');
const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');
const EventEmitter = require('events');

// 导入策略子模块
const EventHandler = require('./strategy/event-handler');
const OrderManager = require('./strategy/order-manager');
const DataManager = require('./strategy/data-manager');
const StrategyCore = require('./strategy/strategy-core');
const LifecycleManager = require('./strategy/lifecycle-manager');

/**
 * Avellaneda做市策略核心逻辑
 * 重构后的版本，使用模块化架构
 */
class AvellanedaStrategy extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger(config);
        
        // 初始化核心组件
        this.exchangeManager = new ExchangeManager(config);
        this.calculator = new AvellanedaCalculator(config, this.exchangeManager);
        this.indicators = new IndicatorsManager(config);
        this.riskManager = new RiskManager(config);
        
        // 初始化策略子模块
        this.eventHandler = new EventHandler(this);
        this.orderManager = new OrderManager(this);
        this.dataManager = new DataManager(this);
        this.strategyCore = new StrategyCore(this);
        this.lifecycleManager = new LifecycleManager(this);
        
        // 策略状态
        this.isRunning = false;
        this.isInitialized = false;
        this.lastUpdateTime = 0;
        this.forceOrderUpdate = false; // 强制更新订单标志
        
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
        
        // 策略状态数据
        this.strategyState = {
            currentPrice: 0,
            volatility: 0,
            currentInventory: 0,
            targetInventory: 0,
            totalInventoryValue: 0,
            optimalBid: 0,
            optimalAsk: 0,
            currentSpread: 0,
            lastCalculationTime: 0,
            executionCount: 0,
            averageExecutionTime: 0
        };
        
        this.logger.info('Avellaneda策略实例已创建（模块化版本）', {
            symbol: config.get('symbol'),
            modules: ['EventHandler', 'OrderManager', 'DataManager', 'StrategyCore', 'LifecycleManager']
        });
    }

    /**
     * 初始化策略
     */
    async initialize() {
        if (this.isInitialized) {
            this.logger.warn('策略已初始化，跳过重复初始化');
            return true;
        }
        
        try {
            this.logger.info('开始初始化Avellaneda策略...');
            
            // 验证配置
            if (!this.validateConfig()) {
                throw new Error('配置验证失败');
            }
            
            // 初始化交易所连接
            await this.exchangeManager.initialize();
            
            // 验证交易所连接
            if (!await this.validateExchangeConnection()) {
                throw new Error('交易所连接验证失败');
            }
            
            this.isInitialized = true;
            this.logger.info('Avellaneda策略初始化完成');
            return true;
            
        } catch (error) {
            this.logger.error('策略初始化失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * 验证配置
     */
    validateConfig() {
        const requiredFields = ['symbol', 'orderAmount', 'riskAversion'];
        
        for (const field of requiredFields) {
            if (!this.config.get(field)) {
                this.logger.error('缺少必需的配置字段', { field });
                return false;
            }
        }
        
        return true;
    }

    /**
     * 验证交易所连接
     */
    async validateExchangeConnection() {
        try {
            // 测试基本连接
            const ticker = await this.exchangeManager.getTicker();
            if (!ticker || !ticker.last) {
                throw new Error('无法获取价格数据');
            }
            
            // 测试余额查询
            const balances = await this.exchangeManager.getBalances();
            if (!balances) {
                throw new Error('无法获取账户余额');
            }
            
            this.logger.info('交易所连接验证成功');
            return true;
            
        } catch (error) {
            this.logger.error('交易所连接验证失败', { error: error.message });
            return false;
        }
    }

    /**
     * 启动策略
     */
    async start() {
        if (!this.isInitialized) {
            if (!await this.initialize()) {
                throw new Error('策略初始化失败');
            }
        }
        
        return await this.lifecycleManager.start();
    }

    /**
     * 停止策略
     */
    async stop() {
        return await this.lifecycleManager.stop();
    }

    /**
     * 暂停策略
     */
    pause() {
        return this.lifecycleManager.pause();
    }

    /**
     * 恢复策略
     */
    resume() {
        return this.lifecycleManager.resume();
    }

    /**
     * 强制清理
     */
    async forceCleanup() {
        return await this.lifecycleManager.forceCleanup();
    }

    /**
     * 获取策略状态
     */
    getStatus() {
        const lifecycleStatus = this.lifecycleManager.getStatus();
        const marketSummary = this.dataManager.getMarketDataSummary();
        const balanceSummary = this.dataManager.getBalanceSummary();
        const activeOrders = this.orderManager.getActiveOrders();
        const orderHistory = this.orderManager.getOrderHistory();
        const performanceStats = this.strategyCore.getPerformanceStats();
        
        return {
            // 生命周期状态
            lifecycle: lifecycleStatus,
            
            // 策略状态
            strategy: {
                isInitialized: this.isInitialized,
                strategyState: this.strategyState,
                performance: performanceStats
            },
            
            // 市场数据
            market: marketSummary,
            
            // 账户数据
            account: balanceSummary,
            
            // 订单数据
            orders: {
                active: activeOrders,
                history: orderHistory,
                activeCount: activeOrders.length
            },
            
            // 组件状态
            components: {
                exchange: {
                    connected: this.exchangeManager.isConnected,
                    status: this.exchangeManager.getStatus()
                },
                dataManager: this.dataManager.getUpdateStatus()
            },
            
            // 时间戳
            timestamp: Date.now()
        };
    }

    /**
     * 获取策略统计信息
     */
    getStats() {
        return {
            performance: this.strategyCore.getPerformanceStats(),
            lifecycle: this.lifecycleManager.getStatus(),
            orders: {
                activeCount: this.orderManager.getActiveOrdersCount(),
                historyCount: this.orderManager.getOrderHistory().length
            },
            market: this.dataManager.getMarketDataSummary(),
            account: this.dataManager.getBalanceSummary()
        };
    }

    /**
     * 更新策略参数
     */
    updateParameters(params) {
        const validation = this.strategyCore.validateParameters(params);
        if (!validation.valid) {
            throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
        }
        
        this.strategyCore.updateParameters(params);
        this.logger.info('策略参数已更新', params);
    }

    /**
     * 获取当前策略参数
     */
    getParameters() {
        return this.strategyCore.getParameters();
    }

    /**
     * 强制同步订单状态
     */
    async syncOrders() {
        return await this.orderManager.syncActiveOrdersFromExchange();
    }

    /**
     * 强制更新所有数据
     */
    async forceDataUpdate() {
        return await this.dataManager.forceUpdateAll();
    }

    /**
     * 取消所有订单
     */
    async cancelAllOrders() {
        return await this.orderManager.cancelAllOrders();
    }

    /**
     * 重置策略统计
     */
    resetStats() {
        this.strategyCore.resetStats();
        this.lifecycleManager.resetState();
        this.dataManager.reset();
        this.logger.info('策略统计已重置');
    }

    /**
     * 获取日志记录器（用于外部访问）
     */
    getLogger() {
        return this.logger;
    }

    /**
     * 获取配置（用于外部访问）
     */
    getConfig() {
        return this.config;
    }

    /**
     * 检查策略是否健康
     */
    isHealthy() {
        return {
            overall: this.isInitialized && this.exchangeManager.isConnected,
            details: {
                initialized: this.isInitialized,
                exchangeConnected: this.exchangeManager.isConnected,
                hasMarketData: !!this.currentMarketData.midPrice,
                hasBalanceData: !!this.currentBalances.timestamp,
                hasValidVolatility: this.strategyState.volatility > 0
            }
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