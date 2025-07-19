const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

class Logger {
    constructor(config) {
        this.config = config;
        this.logger = this.createLogger();
        this.performanceMetrics = new Map();
    }

    createLogger() {
        const logLevel = this.config.get('logLevel') || 'info';
        const logFile = this.config.get('logFile') || 'logs/strategy.log';

        // 定义日志格式
        const logFormat = winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );

        // 控制台格式
        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
                format: 'HH:mm:ss'
            }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                    msg += ` ${JSON.stringify(meta)}`;
                }
                return msg;
            })
        );

        // 创建logger实例
        const logger = winston.createLogger({
            level: logLevel,
            format: logFormat,
            defaultMeta: { service: 'avellaneda-strategy' },
            transports: [
                // 主日志文件 - 使用轮转
                new winston.transports.DailyRotateFile({
                    filename: logFile,
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '10m',
                    maxFiles: '14d',
                    tailable: true,
                    zippedArchive: true
                }),
                // 错误日志文件 - 使用轮转
                new winston.transports.DailyRotateFile({
                    filename: path.join(path.dirname(logFile), 'error-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    maxSize: '10m',
                    maxFiles: '30d',
                    zippedArchive: true
                }),
                // 交易日志文件 - 使用轮转
                new winston.transports.DailyRotateFile({
                    filename: path.join(path.dirname(logFile), 'trades-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'info',
                    maxSize: '10m',
                    maxFiles: '30d',
                    zippedArchive: true,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            ]
        });

        // 开发模式下添加控制台输出
        if (this.config.isDevelopment()) {
            logger.add(new winston.transports.Console({
                format: consoleFormat
            }));
        }

        return logger;
    }

    // 信息日志
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    // 警告日志
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    // 错误日志
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    // 调试日志
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // 交易日志
    trade(action, symbol, amount, price, meta = {}) {
        const tradeLog = {
            action,
            symbol,
            amount,
            price,
            timestamp: new Date().toISOString(),
            ...meta
        };
        
        this.logger.info('Trade executed', tradeLog);
        
        // 同时记录到交易专用日志
        this.logger.log({
            level: 'info',
            message: 'Trade executed',
            ...tradeLog,
            transport: 'trades'
        });
    }

    // 策略状态日志
    strategyStatus(status, meta = {}) {
        this.logger.info('Strategy status', {
            status,
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 市场数据日志
    marketData(symbol, bid, ask, spread, meta = {}) {
        this.logger.debug('Market data', {
            symbol,
            bid,
            ask,
            spread,
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 错误详情日志
    errorWithStack(message, error) {
        this.logger.error(message, {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    // 性能日志
    performance(operation, duration, meta = {}) {
        this.logger.info('Performance', {
            operation,
            duration,
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 性能监控开始
    startPerformanceTimer(operation) {
        this.performanceMetrics.set(operation, Date.now());
    }

    // 性能监控结束
    endPerformanceTimer(operation, meta = {}) {
        const startTime = this.performanceMetrics.get(operation);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.performance(operation, duration, meta);
            this.performanceMetrics.delete(operation);
            return duration;
        }
        return 0;
    }

    // 内存使用日志
    memoryUsage() {
        const usage = process.memoryUsage();
        this.logger.info('Memory usage', {
            rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
            external: Math.round(usage.external / 1024 / 1024) + ' MB',
            timestamp: new Date().toISOString()
        });
    }

    // 系统状态日志
    systemStatus(status, meta = {}) {
        this.logger.info('System status', {
            status,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 配置变更日志
    configChange(key, oldValue, newValue) {
        this.logger.info('Configuration changed', {
            key,
            oldValue,
            newValue,
            timestamp: new Date().toISOString()
        });
    }

    // 订单状态日志
    orderStatus(orderId, status, meta = {}) {
        this.logger.info('Order status', {
            orderId,
            status,
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 风险警告日志
    riskWarning(message, level = 'warn', meta = {}) {
        const logMethod = level === 'error' ? 'error' : 'warn';
        this.logger[logMethod]('Risk warning', {
            message,
            level,
            timestamp: new Date().toISOString(),
            ...meta
        });
    }

    // 获取日志统计
    getLogStats() {
        return {
            performanceMetrics: Array.from(this.performanceMetrics.keys()),
            timestamp: new Date().toISOString()
        };
    }

    // 清理性能指标
    clearPerformanceMetrics() {
        this.performanceMetrics.clear();
    }
}

module.exports = Logger; 