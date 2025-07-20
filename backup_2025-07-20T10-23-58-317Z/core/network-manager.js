const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const Logger = require('../utils/logger');

/**
 * 智能网络连接管理器
 * 处理VPN不稳定环境下的网络连接问题
 */
class NetworkManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger(config);
        
        // 网络状态
        this.networkStatus = {
            isConnected: false,
            connectionQuality: 'unknown', // poor, fair, good, excellent
            latency: 0,
            lastCheck: 0,
            consecutiveFailures: 0,
            totalFailures: 0,
            totalSuccesses: 0
        };
        
        // 代理配置
        this.proxyConfig = {
            enabled: false,
            host: null,
            port: null,
            protocol: 'http',
            auth: null
        };
        
        // 连接配置
        this.connectionConfig = {
            timeout: 3000, // 缩短超时时间到3秒
            retryAttempts: 2, // 减少重试次数
            retryDelay: 1000, // 缩短重试延迟
            healthCheckInterval: 30000,
            qualityThresholds: {
                excellent: 100,  // 延迟 < 100ms
                good: 300,       // 延迟 < 300ms
                fair: 1000,      // 延迟 < 1000ms
                poor: 3000       // 延迟 < 3000ms
            }
        };
        
        // 监控定时器
        this.healthCheckTimer = null;
        this.connectionTestTimer = null;
        
        // 测试URL列表（优化为快速测试）
        this.testUrls = [
            'https://www.google.com', // 最可靠的测试点
            'https://www.baidu.com'   // 备用测试点
        ];
        
        this.loadProxyConfig();
        this.startHealthCheck();
    }
    
    /**
     * 加载代理配置
     */
    loadProxyConfig() {
        // 从环境变量加载代理配置
        const proxyHost = process.env.PROXY_HOST;
        const proxyPort = process.env.PROXY_PORT;
        const proxyProtocol = process.env.PROXY_PROTOCOL || 'http';
        const proxyUsername = process.env.PROXY_USERNAME;
        const proxyPassword = process.env.PROXY_PASSWORD;
        
        if (proxyHost && proxyPort) {
            this.proxyConfig = {
                enabled: true,
                host: proxyHost,
                port: parseInt(proxyPort),
                protocol: proxyProtocol,
                auth: proxyUsername && proxyPassword ? {
                    username: proxyUsername,
                    password: proxyPassword
                } : null
            };
            
            this.logger.info('代理配置已加载', {
                host: proxyHost,
                port: proxyPort,
                protocol: proxyProtocol,
                hasAuth: !!proxyUsername
            });
        } else {
            this.logger.info('未找到代理配置，使用直连');
        }
    }
    
    /**
     * 启动健康检查
     */
    startHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.connectionConfig.healthCheckInterval);
        
        this.logger.info('网络健康检查已启动', {
            interval: this.connectionConfig.healthCheckInterval
        });
    }
    
    /**
     * 停止健康检查
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        
        if (this.connectionTestTimer) {
            clearTimeout(this.connectionTestTimer);
            this.connectionTestTimer = null;
        }
    }
    
    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        try {
            const results = await this.testMultipleConnections();
            this.updateNetworkStatus(results);
            
            this.logger.info('网络健康检查完成', {
                quality: this.networkStatus.connectionQuality,
                latency: this.networkStatus.latency,
                failures: this.networkStatus.consecutiveFailures
            });
            
        } catch (error) {
            this.logger.error('健康检查失败', error);
            this.networkStatus.consecutiveFailures++;
        }
    }
    
    /**
     * 测试多个连接
     */
    async testMultipleConnections() {
        const results = [];
        
        for (const url of this.testUrls) {
            try {
                const result = await this.testConnection(url);
                results.push(result);
                
                // 如果有一个连接成功，就认为网络可用
                if (result.success) {
                    break;
                }
            } catch (error) {
                results.push({
                    url,
                    success: false,
                    latency: 0,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * 测试单个连接
     */
    async testConnection(url) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timeout = this.connectionConfig.timeout;
            
            const options = {
                hostname: new URL(url).hostname,
                port: new URL(url).port || (url.startsWith('https') ? 443 : 80),
                path: new URL(url).pathname,
                method: 'GET',
                timeout: timeout
            };
            
            // 添加代理配置
            if (this.proxyConfig.enabled) {
                options.host = this.proxyConfig.host;
                options.port = this.proxyConfig.port;
                options.path = url;
                
                if (this.proxyConfig.auth) {
                    const auth = Buffer.from(
                        `${this.proxyConfig.auth.username}:${this.proxyConfig.auth.password}`
                    ).toString('base64');
                    options.headers = {
                        'Proxy-Authorization': `Basic ${auth}`
                    };
                }
            }
            
            const client = url.startsWith('https') ? https : http;
            const req = client.request(options, (res) => {
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                resolve({
                    url,
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    latency,
                    statusCode: res.statusCode
                });
            });
            
            req.on('error', (error) => {
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                resolve({
                    url,
                    success: false,
                    latency,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    url,
                    success: false,
                    latency: timeout,
                    error: 'timeout'
                });
            });
            
            req.end();
        });
    }
    
    /**
     * 更新网络状态
     */
    updateNetworkStatus(results) {
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length > 0) {
            // 计算平均延迟
            const avgLatency = successfulResults.reduce((sum, r) => sum + r.latency, 0) / successfulResults.length;
            
            this.networkStatus = {
                isConnected: true,
                latency: avgLatency,
                lastCheck: Date.now(),
                consecutiveFailures: 0,
                totalSuccesses: this.networkStatus.totalSuccesses + 1,
                totalFailures: this.networkStatus.totalFailures,
                connectionQuality: this.getConnectionQuality(avgLatency)
            };
            
            this.emit('connectionRestored', this.networkStatus);
        } else {
            this.networkStatus.consecutiveFailures++;
            this.networkStatus.totalFailures++;
            this.networkStatus.isConnected = false;
            this.networkStatus.connectionQuality = 'poor';
            
            this.emit('connectionLost', {
                consecutiveFailures: this.networkStatus.consecutiveFailures,
                totalFailures: this.networkStatus.totalFailures
            });
        }
    }
    
    /**
     * 获取连接质量
     */
    getConnectionQuality(latency) {
        const { qualityThresholds } = this.connectionConfig;
        
        if (latency < qualityThresholds.excellent) return 'excellent';
        if (latency < qualityThresholds.good) return 'good';
        if (latency < qualityThresholds.fair) return 'fair';
        if (latency < qualityThresholds.poor) return 'poor';
        return 'unusable';
    }
    
    /**
     * 检查网络是否可用
     */
    isNetworkAvailable() {
        return this.networkStatus.isConnected && 
               this.networkStatus.connectionQuality !== 'unusable';
    }
    
    /**
     * 获取网络状态
     */
    getNetworkStatus() {
        return { ...this.networkStatus };
    }
    
    /**
     * 获取代理配置
     */
    getProxyConfig() {
        return { ...this.proxyConfig };
    }
    
    /**
     * 更新代理配置
     */
    updateProxyConfig(config) {
        this.proxyConfig = { ...this.proxyConfig, ...config };
        this.logger.info('Proxy configuration updated', this.proxyConfig);
        
        // 重新测试连接
        this.performHealthCheck();
    }
    
    /**
     * 强制重新连接测试
     */
    async forceReconnectTest() {
        this.logger.info('Forcing reconnection test');
        await this.performHealthCheck();
        return this.networkStatus;
    }
    
    /**
     * 获取连接统计
     */
    getConnectionStats() {
        const total = this.networkStatus.totalSuccesses + this.networkStatus.totalFailures;
        const successRate = total > 0 ? (this.networkStatus.totalSuccesses / total * 100).toFixed(2) : 0;
        
        return {
            totalAttempts: total,
            successRate: `${successRate}%`,
            consecutiveFailures: this.networkStatus.consecutiveFailures,
            currentQuality: this.networkStatus.connectionQuality,
            averageLatency: this.networkStatus.latency,
            lastCheck: new Date(this.networkStatus.lastCheck).toISOString()
        };
    }
    
    /**
     * 关闭网络管理器
     */
    close() {
        this.stopHealthCheck();
        this.logger.info('Network manager closed');
    }
}

module.exports = NetworkManager; 