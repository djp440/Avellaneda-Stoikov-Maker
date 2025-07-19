const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

/**
 * 配置验证器
 */
class ConfigValidator {
    static validateExchange(config) {
        const errors = [];
        
        if (!config.apiKey) {
            errors.push('EXCHANGE_API_KEY is required');
        }
        if (!config.secret) {
            errors.push('EXCHANGE_SECRET is required');
        }
        if (!config.password) {
            errors.push('EXCHANGE_PASSPHRASE is required for Bitget');
        }
        
        return errors;
    }
    
    static validateStrategy(config) {
        const errors = [];
        
        if (config.riskFactor <= 0 || config.riskFactor > 1) {
            errors.push('RISK_FACTOR must be between 0 and 1');
        }
        if (config.orderAmount <= 0) {
            errors.push('ORDER_AMOUNT must be positive');
        }
        if (config.minSpread <= 0) {
            errors.push('MIN_SPREAD must be positive');
        }
        if (config.maxSpread <= config.minSpread) {
            errors.push('MAX_SPREAD must be greater than MIN_SPREAD');
        }
        if (config.updateInterval < 100) {
            errors.push('UPDATE_INTERVAL must be at least 100ms');
        }
        
        return errors;
    }
    
    static validateRisk(config) {
        const errors = [];
        
        if (config.maxPositionSize <= 0) {
            errors.push('MAX_POSITION_SIZE must be positive');
        }
        if (config.maxPositionValue <= 0) {
            errors.push('MAX_POSITION_VALUE must be positive');
        }
        if (config.stopLossPercent <= 0 || config.stopLossPercent > 100) {
            errors.push('STOP_LOSS_PERCENT must be between 0 and 100');
        }
        if (config.stopLossAmount <= 0) {
            errors.push('STOP_LOSS_AMOUNT must be positive');
        }
        if (config.maxDrawdown <= 0 || config.maxDrawdown > 100) {
            errors.push('MAX_DRAWDOWN must be between 0 and 100');
        }
        if (config.maxDailyLoss <= 0) {
            errors.push('MAX_DAILY_LOSS must be positive');
        }
        if (config.maxOrderSize <= 0) {
            errors.push('MAX_ORDER_SIZE must be positive');
        }
        if (config.maxOrderValue <= 0) {
            errors.push('MAX_ORDER_VALUE must be positive');
        }
        if (config.riskCheckInterval < 1000) {
            errors.push('RISK_CHECK_INTERVAL must be at least 1000ms');
        }
        if (config.emergencyStopThreshold <= 0 || config.emergencyStopThreshold > 100) {
            errors.push('EMERGENCY_STOP_THRESHOLD must be between 0 and 100');
        }
        
        return errors;
    }
}

class StrategyConfig {
    constructor() {
        this.config = {};
        this.validators = new Map();
        this.watchers = new Map();
        
        this.loadConfig();
        this.setupValidators();
        this.validateConfig();
    }

    loadConfig() {
        this.config = {
            // 交易所配置
            exchange: {
                name: process.env.EXCHANGE || 'bitget',
                apiKey: process.env.EXCHANGE_API_KEY,
                secret: process.env.EXCHANGE_SECRET,
                password: process.env.EXCHANGE_PASSPHRASE, // Bitget需要passphrase
                sandbox: this.parseBoolean(process.env.EXCHANGE_SANDBOX, false)
            },

            // 交易对配置
            symbol: process.env.SYMBOL || 'BTC/USDT',
            baseCurrency: process.env.BASE_CURRENCY || 'BTC',
            quoteCurrency: process.env.QUOTE_CURRENCY || 'USDT',

            // 策略参数
            riskFactor: this.parseFloat(process.env.RISK_FACTOR, 0.1),
            orderAmount: this.parseFloat(process.env.ORDER_AMOUNT, 0.001),
            minSpread: this.parseFloat(process.env.MIN_SPREAD, 0.0001),
            maxSpread: this.parseFloat(process.env.MAX_SPREAD, 0.01),
            inventoryTarget: this.parseFloat(process.env.INVENTORY_TARGET, 0),
            shapeFactor: this.parseFloat(process.env.SHAPE_FACTOR, 1.0),

            // 执行控制
            updateInterval: this.parseInt(process.env.UPDATE_INTERVAL, 1000),
            maxOrders: this.parseInt(process.env.MAX_ORDERS, 10),
            orderTimeout: this.parseInt(process.env.ORDER_TIMEOUT, 30000),
            filledOrderDelay: this.parseInt(process.env.FILLED_ORDER_DELAY, 1000),

            // 风险管理
            maxPositionSize: this.parseFloat(process.env.MAX_POSITION_SIZE, 1000),
            maxPositionValue: this.parseFloat(process.env.MAX_POSITION_VALUE, 50000),
            targetInventory: this.parseFloat(process.env.TARGET_INVENTORY, 0),
            stopLossPercent: this.parseFloat(process.env.STOP_LOSS_PERCENT, 2.0),
            stopLossAmount: this.parseFloat(process.env.STOP_LOSS_AMOUNT, 1000),
            trailingStopLoss: this.parseBoolean(process.env.TRAILING_STOP_LOSS, false),
            maxDrawdown: this.parseFloat(process.env.MAX_DRAWDOWN, 5.0),
            maxDailyLoss: this.parseFloat(process.env.MAX_DAILY_LOSS, 2000),
            maxOrderSize: this.parseFloat(process.env.MAX_ORDER_SIZE, 100),
            maxOrderValue: this.parseFloat(process.env.MAX_ORDER_VALUE, 5000),
            riskCheckInterval: this.parseInt(process.env.RISK_CHECK_INTERVAL, 5000),
            emergencyStopThreshold: this.parseFloat(process.env.EMERGENCY_STOP_THRESHOLD, 10.0),

            // 日志配置
            logLevel: process.env.LOG_LEVEL || 'info',
            logFile: process.env.LOG_FILE || 'logs/strategy.log',

            // 环境配置
            nodeEnv: process.env.NODE_ENV || 'development'
        };
    }

    setupValidators() {
        this.validators.set('exchange', ConfigValidator.validateExchange);
        this.validators.set('strategy', ConfigValidator.validateStrategy);
        this.validators.set('risk', ConfigValidator.validateRisk);
    }

    validateConfig() {
        const errors = [];

        // 验证交易所配置
        const exchangeErrors = this.validators.get('exchange')(this.config.exchange);
        errors.push(...exchangeErrors);

        // 验证策略配置
        const strategyErrors = this.validators.get('strategy')(this.config);
        errors.push(...strategyErrors);

        // 验证风险管理配置
        const riskErrors = this.validators.get('risk')(this.config);
        errors.push(...riskErrors);

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    // 解析工具方法
    parseFloat(value, defaultValue) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    parseInt(value, defaultValue) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    parseBoolean(value, defaultValue) {
        if (value === undefined || value === null) return defaultValue;
        return value === 'true' || value === '1' || value === true;
    }

    get(key) {
        return this.config[key];
    }

    getAll() {
        return { ...this.config };
    }

    update(key, value) {
        const oldValue = this.config[key];
        this.config[key] = value;
        
        // 触发配置变更事件
        this.triggerConfigChange(key, oldValue, value);
    }

    // 配置热更新
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        
        // 更新配置
        Object.assign(this.config, newConfig);
        
        // 重新验证
        this.validateConfig();
        
        // 触发配置变更事件
        this.triggerConfigChange('all', oldConfig, this.config);
    }

    // 配置变更监听
    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
        }
        this.watchers.get(key).push(callback);
    }

    unwatch(key, callback) {
        if (this.watchers.has(key)) {
            const callbacks = this.watchers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    triggerConfigChange(key, oldValue, newValue) {
        // 触发特定键的监听器
        if (this.watchers.has(key)) {
            this.watchers.get(key).forEach(callback => {
                try {
                    callback(oldValue, newValue);
                } catch (error) {
                    console.error('Config change callback error:', error);
                }
            });
        }
        
        // 触发全局监听器
        if (this.watchers.has('all')) {
            this.watchers.get('all').forEach(callback => {
                try {
                    callback(key, oldValue, newValue);
                } catch (error) {
                    console.error('Config change callback error:', error);
                }
            });
        }
    }

    // 获取交易所配置
    getExchangeConfig() {
        return this.config.exchange;
    }

    // 获取策略参数
    getStrategyParams() {
        return {
            riskFactor: this.config.riskFactor,
            orderAmount: this.config.orderAmount,
            minSpread: this.config.minSpread,
            maxSpread: this.config.maxSpread,
            inventoryTarget: this.config.inventoryTarget,
            shapeFactor: this.config.shapeFactor
        };
    }

    // 获取风险管理参数
    getRiskParams() {
        return {
            maxPosition: this.config.maxPosition,
            stopLossPercent: this.config.stopLossPercent,
            maxDailyLoss: this.config.maxDailyLoss
        };
    }

    // 检查是否为开发模式
    isDevelopment() {
        return this.config.nodeEnv === 'development';
    }

    // 检查是否为沙盒模式
    isSandbox() {
        return this.config.exchange.sandbox;
    }

    // 获取配置摘要
    getConfigSummary() {
        return {
            exchange: this.config.exchange.name,
            symbol: this.config.symbol,
            riskFactor: this.config.riskFactor,
            orderAmount: this.config.orderAmount,
            updateInterval: this.config.updateInterval,
            sandbox: this.config.exchange.sandbox,
            environment: this.config.nodeEnv
        };
    }
}

module.exports = StrategyConfig; 