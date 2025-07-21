/**
 * Avellaneda做市策略基础类
 * 负责初始化和协调各个子模块
 */
const EventEmitter = require('events');
const Logger = require('../../utils/logger');
const AvellanedaCalculator = require('../calculator');
const { IndicatorsManager } = require('../indicators');
const ExchangeManager = require('../exchange');
const RiskManager = require('../risk-manager');

// 导入子模块
const EventHandler = require('./event-handler');
const OrderManager = require('./order-manager');
const MarketDataManager = require('./market-data-manager');
const StrategyExecutor = require('./strategy-executor');

class AvellanedaStrategyBase extends EventEmitter {
    constructor(config) {
        super();
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
        this.isShuttingDown = false;
        this.lastUpdateTime = 0;
        this.orderRefreshTime = (config.get('orderTimeout') || 30000) / 1000; // 订单刷新时间(秒)
        this.filledOrderDelay = config.get('filledOrderDelay') || 1; // 订单成交后延迟(秒)
        this.forceOrderUpdate = false; // 强制更新订单标志
        this.isCreatingOrders = false; // 订单创建并发保护标志
        
        // 初始化子模块
        this.eventHandler = new EventHandler(this);
        this.orderManager = new OrderManager(this);
        this.marketDataManager = new MarketDataManager(this);
        this.strategyExecutor = new StrategyExecutor(this);
        
        // 订单监控配置
        this.orderMonitoringInterval = config.get('orderMonitoringInterval') || 5000; // 默认5秒检查一次
        this.orderMonitoringTimer = null;
        
        this.logger.info('Avellaneda策略基础类已初始化', {
            orderRefreshTime: this.orderRefreshTime,
            filledOrderDelay: this.filledOrderDelay,
            orderMonitoringInterval: this.orderMonitoringInterval,
            riskManager: 'enabled'
        });
    }

    /**
     * 初始化策略
     */
    async initialize() {
        console.log('AvellanedaStrategy: initialize() 开始');
        try {
            this.logger.info('正在初始化策略');
            
            console.log('AvellanedaStrategy: initialize() - 初始化交易所连接...');
            // 初始化交易所连接
            const exchangeInitialized = await this.exchangeManager.initialize();
            if (!exchangeInitialized) {
                console.error('AvellanedaStrategy: initialize() - 交易所连接初始化失败');
                throw new Error('Failed to initialize exchange connection');
            }
            console.log('AvellanedaStrategy: initialize() - 交易所连接初始化完成');
            
            // 技术指标管理器不需要显式初始化，在构造函数中已经初始化
            
            console.log('AvellanedaStrategy: initialize() - 初始化风险管理器...');
            // 初始化风险管理器
            const riskInitialized = await this.riskManager.initialize();
            if (!riskInitialized) {
                console.error('AvellanedaStrategy: initialize() - 风险管理器初始化失败');
                throw new Error('Failed to initialize risk manager');
            }
            console.log('AvellanedaStrategy: initialize() - 风险管理器初始化完成');
            
            console.log('AvellanedaStrategy: initialize() - 同步活跃订单...');
            // 挂单同步
            await this.orderManager.syncActiveOrdersFromExchange();
            console.log('AvellanedaStrategy: initialize() - 活跃订单同步完成');
            
            // 标记为已初始化
            this.isInitialized = true;
            
            this.logger.info('策略初始化成功');
            console.log('AvellanedaStrategy: initialize() 成功完成');
            return true;
            
        } catch (error) {
            this.logger.error('策略初始化失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            console.error('AvellanedaStrategy: initialize() 失败:', error.message);
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
        console.log('AvellanedaStrategy: start() 开始');
        try {
            if (!this.isInitialized) {
                console.error('AvellanedaStrategy: start() - 策略未初始化');
                throw new Error('Strategy not initialized');
            }
            
            this.isRunning = true;
            this.logger.info('策略已启动');
            console.log('AvellanedaStrategy: start() - 策略已启动');
            
            console.log('AvellanedaStrategy: start() - 开始主循环...');
            // 开始主循环
            this.strategyExecutor.startMainLoop();
            console.log('AvellanedaStrategy: start() - 主循环已启动');
            
            // 启动订单监控
            this.orderManager.startOrderMonitoring();
            console.log('AvellanedaStrategy: start() - 订单监控已启动');
            
            console.log('AvellanedaStrategy: start() 成功完成');
            return true;
        } catch (error) {
            this.logger.error('策略启动失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            console.error('AvellanedaStrategy: start() 失败:', error.message);
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
            
            // 停止订单监控
            this.orderManager.stopOrderMonitoring();
            console.log('✅ 订单监控已停止');

            // 注意：健康检查由主程序管理，策略类不直接控制

            // 停止策略主循环
            if (this.strategyExecutor) {
                console.log('🎯 停止策略主循环...');
                this.strategyExecutor.stopMainLoop();
                console.log('✅ 策略主循环已停止');
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
     * 获取策略状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            marketData: this.marketDataManager.getMarketData(),
            balances: this.marketDataManager.balances,
            strategyState: this.strategyExecutor.getStrategyState(),
            indicators: this.indicators.getStatus(),
            riskStatus: this.riskManager.getRiskStatus(),
            activeOrders: this.orderManager.getActiveOrders(),
            orderHistory: this.orderManager.getOrderHistory(10) // 最近10个订单
        };
    }

    /**
     * 工具函数：睡眠
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AvellanedaStrategyBase;