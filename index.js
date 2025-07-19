const StrategyConfig = require('./config/strategy');
const Logger = require('./utils/logger');
const AvellanedaStrategy = require('./core/strategy');
const ccxt = require('ccxt');

class AvellanedaMarketMaking {
    constructor() {
        this.config = null;
        this.logger = null;
        this.strategy = null;
        this.exchange = null;
        this.isRunning = false;
        this.isShuttingDown = false;
        this.healthCheckInterval = null;
        this.startTime = null;
    }

    /**
     * 初始化策略
     */
    async initialize() {
        try {
            console.log('🚀 初始化 Avellaneda 做市策略...');
            
            // 初始化配置
            this.config = new StrategyConfig();
            console.log('✅ 配置加载完成');
            
            // 初始化日志
            this.logger = new Logger(this.config);
            console.log('✅ 日志系统初始化完成');
            
            // 记录启动信息
            this.logger.info('策略初始化开始', {
                exchange: this.config.get('exchange').name,
                symbol: this.config.get('symbol'),
                sandbox: this.config.isSandbox(),
                environment: this.config.get('nodeEnv')
            });

            // 验证配置
            this.validateConfiguration();
            
            // 初始化策略
            await this.initializeStrategy();
            console.log('✅ 策略算法初始化完成');
            
            // 设置配置变更监听
            this.setupConfigWatchers();
            
            this.logger.info('策略初始化完成');
            console.log('✅ 策略初始化完成');
            
            return true;
        } catch (error) {
            console.error('❌ 策略初始化失败:', error.message);
            if (this.logger) {
                this.logger.errorWithStack('策略初始化失败', error);
            }
            throw error;
        }
    }

    /**
     * 验证配置
     */
    validateConfiguration() {
        const config = this.config.getAll();
        
        this.logger.info('配置验证', {
            exchange: config.exchange.name,
            symbol: config.symbol,
            riskFactor: config.riskFactor,
            orderAmount: config.orderAmount,
            updateInterval: config.updateInterval
        });

        // 检查关键配置
        if (!config.exchange.apiKey || config.exchange.apiKey === 'your_api_key_here') {
            throw new Error('请配置有效的交易所API密钥');
        }

        if (!config.exchange.secret || config.exchange.secret === 'your_secret_here') {
            throw new Error('请配置有效的交易所密钥');
        }

        this.logger.info('配置验证通过');
    }

    /**
     * 初始化策略
     */
    async initializeStrategy() {
        try {
            // 获取策略配置
            const strategyConfig = this.config.getAll();
            
            // 创建策略实例
            this.strategy = new AvellanedaStrategy(strategyConfig);
            
            // 初始化策略
            const initialized = await this.strategy.initialize();
            if (!initialized) {
                throw new Error('策略初始化失败');
            }
            
            this.logger.info('策略算法初始化成功');
            
        } catch (error) {
            this.logger.error('策略算法初始化失败', error);
            throw error;
        }
    }

    /**
     * 设置配置变更监听
     */
    setupConfigWatchers() {
        // 监听配置变更
        this.config.watch('all', (key, oldValue, newValue) => {
            this.logger.configChange(key, oldValue, newValue);
        });

        // 监听特定配置变更
        this.config.watch('updateInterval', (oldValue, newValue) => {
            this.logger.info('更新间隔已变更', { oldValue, newValue });
        });
    }

    /**
     * 启动策略
     */
    async start() {
        try {
            if (this.isRunning) {
                this.logger.warn('策略已在运行中');
                return;
            }

            this.logger.info('启动策略');
            console.log('🚀 启动策略...');

            // 启动策略
            const started = await this.strategy.start();
            if (!started) {
                throw new Error('策略启动失败');
            }

            // 标记为运行状态
            this.isRunning = true;
            this.startTime = Date.now();

            // 启动健康检查
            this.startHealthCheck();

            // 记录策略状态
            this.logger.strategyStatus('started', {
                timestamp: new Date().toISOString(),
                config: this.config.getStrategyParams()
            });

            console.log('✅ 策略启动成功');
            this.logger.info('策略启动成功');

        } catch (error) {
            this.isRunning = false;
            this.logger.errorWithStack('策略启动失败', error);
            console.error('❌ 策略启动失败:', error.message);
            throw error;
        }
    }

    /**
     * 停止策略
     */
    async stop() {
        try {
            if (!this.isRunning || this.isShuttingDown) {
                this.logger.warn('策略未在运行或正在关闭中');
                return;
            }

            this.isShuttingDown = true;
            this.logger.info('停止策略');
            console.log('🛑 停止策略...');

            // 停止健康检查
            this.stopHealthCheck();

            // 停止策略
            if (this.strategy) {
                await this.strategy.stop();
            }

            // 标记为停止状态
            this.isRunning = false;
            this.isShuttingDown = false;

            // 记录策略状态
            this.logger.strategyStatus('stopped', {
                timestamp: new Date().toISOString(),
                uptime: this.startTime ? Date.now() - this.startTime : 0
            });

            console.log('✅ 策略停止成功');
            this.logger.info('策略停止成功');

        } catch (error) {
            this.logger.errorWithStack('策略停止失败', error);
            console.error('❌ 策略停止失败:', error.message);
            throw error;
        }
    }

    /**
     * 启动健康检查
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('健康检查失败', error);
            }
        }, 30000); // 每30秒检查一次
    }

    /**
     * 停止健康检查
     */
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        try {
            // 检查交易所连接
            const status = await this.exchange.fetchStatus();
            if (status.status !== 'ok') {
                this.logger.warn('交易所状态异常', { status: status.status });
            }

            // 检查策略状态
            const strategyStatus = this.strategy.getStatus();
            if (!strategyStatus.isRunning) {
                this.logger.warn('策略状态异常', strategyStatus);
            }

            // 记录内存使用
            this.logger.memoryUsage();

            // 记录系统状态
            this.logger.systemStatus('healthy', {
                uptime: this.startTime ? Date.now() - this.startTime : 0,
                strategyRunning: this.isRunning
            });

        } catch (error) {
            this.logger.error('健康检查异常', error);
        }
    }

    /**
     * 优雅关闭
     */
    async gracefulShutdown(signal) {
        console.log(`\n🛑 收到信号 ${signal}，正在优雅关闭...`);
        
        try {
            // 停止策略
            await this.stop();
            
            // 清理资源
            this.cleanup();
            
            console.log('✅ 优雅关闭完成');
            process.exit(0);
        } catch (error) {
            console.error('❌ 优雅关闭失败:', error.message);
            process.exit(1);
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 停止健康检查
        this.stopHealthCheck();
        
        // 清理配置监听器
        if (this.config) {
            this.config.watchers.clear();
        }
        
        // 清理日志
        if (this.logger) {
            this.logger.clearPerformanceMetrics();
        }
    }

    /**
     * 获取策略状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isShuttingDown: this.isShuttingDown,
            startTime: this.startTime,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            config: this.config ? this.config.getConfigSummary() : null,
            strategy: this.strategy ? this.strategy.getStatus() : null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 重启策略
     */
    async restart() {
        try {
            this.logger.info('重启策略');
            console.log('🔄 重启策略...');
            
            await this.stop();
            await this.start();
            
            this.logger.info('策略重启成功');
            console.log('✅ 策略重启成功');
        } catch (error) {
            this.logger.error('策略重启失败', error);
            console.error('❌ 策略重启失败:', error.message);
            throw error;
        }
    }
}

// 主函数
async function main() {
    const strategy = new AvellanedaMarketMaking();
    
    try {
        // 初始化策略
        await strategy.initialize();
        
        // 启动策略
        await strategy.start();
        
        // 保持程序运行
        console.log('📊 策略正在运行中...');
        console.log('按 Ctrl+C 停止策略');
        
        // 处理进程退出信号
        process.on('SIGINT', () => strategy.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => strategy.gracefulShutdown('SIGTERM'));
        
        // 处理未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('❌ 未捕获的异常:', error);
            strategy.gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ 未处理的Promise拒绝:', reason);
            strategy.gracefulShutdown('unhandledRejection');
        });
        
    } catch (error) {
        console.error('❌ 程序运行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    main();
}

module.exports = AvellanedaMarketMaking; 