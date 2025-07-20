const NetworkManager = require('../core/network-manager');
const StrategyConfig = require('../config/strategy');

/**
 * 高级网络连接测试
 * 测试代理配置和网络连接质量
 */
class AdvancedNetworkTest {
    constructor() {
        this.config = new StrategyConfig();
        this.networkManager = new NetworkManager(this.config);
    }

    /**
     * 运行完整测试
     */
    async runFullTest() {
        console.log('🚀 开始高级网络连接测试...\n');
        
        // 测试代理配置
        await this.testProxyConfiguration();
        
        // 测试网络连接
        await this.testNetworkConnections();
        
        // 测试连接质量
        await this.testConnectionQuality();
        
        // 测试Bitget连接
        await this.testBitgetConnection();
        
        // 显示测试结果
        this.displayTestResults();
    }

    /**
     * 测试代理配置
     */
    async testProxyConfiguration() {
        console.log('🔧 测试代理配置...');
        
        const proxyConfig = this.networkManager.getProxyConfig();
        
        if (proxyConfig.enabled) {
            console.log('✅ 代理已启用');
            console.log(`   地址: ${proxyConfig.host}:${proxyConfig.port}`);
            console.log(`   协议: ${proxyConfig.protocol}`);
            console.log(`   认证: ${proxyConfig.auth ? '是' : '否'}`);
        } else {
            console.log('ℹ️  未配置代理，使用直连');
        }
        
        console.log('');
    }

    /**
     * 测试网络连接
     */
    async testNetworkConnections() {
        console.log('🌐 测试网络连接...');
        
        const testUrls = [
            'https://www.google.com',
            'https://www.baidu.com',
            'https://api.bitget.com',
            'https://api-sandbox.bitget.com'
        ];
        
        for (const url of testUrls) {
            try {
                const result = await this.networkManager.testConnection(url);
                const status = result.success ? '✅' : '❌';
                const latency = result.latency ? `${result.latency}ms` : 'timeout';
                
                console.log(`${status} ${url} - ${latency}`);
                
                if (!result.success && result.error) {
                    console.log(`   错误: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ ${url} - 测试失败: ${error.message}`);
            }
        }
        
        console.log('');
    }

    /**
     * 测试连接质量
     */
    async testConnectionQuality() {
        console.log('📊 测试连接质量...');
        
        // 执行多次测试计算平均质量
        const testCount = 5;
        const results = [];
        
        for (let i = 0; i < testCount; i++) {
            console.log(`   测试 ${i + 1}/${testCount}...`);
            await this.networkManager.performHealthCheck();
            const status = this.networkManager.getNetworkStatus();
            results.push(status);
            
            if (i < testCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // 计算平均延迟
        const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
        const quality = this.networkManager.getConnectionQuality(avgLatency);
        
        console.log(`✅ 平均延迟: ${avgLatency.toFixed(2)}ms`);
        console.log(`✅ 连接质量: ${quality}`);
        console.log('');
    }

    /**
     * 测试Bitget连接
     */
    async testBitgetConnection() {
        console.log('🔗 测试Bitget交易所连接...');
        
        const ccxt = require('ccxt');
        const exchangeConfig = this.config.get('exchange');
        const proxyConfig = this.networkManager.getProxyConfig();
        
        try {
            // 创建交易所实例
            const exchangeOptions = {
                apiKey: exchangeConfig.apiKey,
                secret: exchangeConfig.secret,
                password: exchangeConfig.password,
                sandbox: this.config.isSandbox(),
                enableRateLimit: true,
                timeout: 10000
            };
            
            // 添加代理配置
            if (proxyConfig.enabled) {
                exchangeOptions.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
                if (proxyConfig.auth) {
                    exchangeOptions.proxy = `${proxyConfig.protocol}://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`;
                }
            }
            
            const exchange = new ccxt.bitget(exchangeOptions);
            
            // 测试连接
            console.log('   测试市场信息加载...');
            await exchange.loadMarkets();
            console.log(`✅ 市场信息加载成功，共 ${Object.keys(exchange.markets).length} 个交易对`);
            
            // 测试API连接
            console.log('   测试API连接...');
            await exchange.fetchBalance();
            console.log('✅ API连接成功');
            
            // 测试市场数据
            console.log('   测试市场数据获取...');
            const symbol = this.config.get('symbol');
            const ticker = await exchange.fetchTicker(symbol);
            console.log(`✅ ${symbol} 价格: $${ticker.last}`);
            
            console.log('✅ Bitget连接测试通过\n');
            
        } catch (error) {
            console.log(`❌ Bitget连接测试失败: ${error.message}\n`);
        }
    }

    /**
     * 显示测试结果
     */
    displayTestResults() {
        console.log('📋 测试结果摘要:');
        console.log('='.repeat(50));
        
        const networkStatus = this.networkManager.getNetworkStatus();
        const networkStats = this.networkManager.getConnectionStats();
        const proxyConfig = this.networkManager.getProxyConfig();
        
        console.log(`网络状态: ${networkStatus.isConnected ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`连接质量: ${networkStatus.connectionQuality}`);
        console.log(`平均延迟: ${networkStatus.latency}ms`);
        console.log(`成功率: ${networkStats.successRate}`);
        console.log(`连续失败: ${networkStats.consecutiveFailures}`);
        console.log(`代理状态: ${proxyConfig.enabled ? '✅ 已启用' : '❌ 未启用'}`);
        
        console.log('\n💡 建议:');
        
        if (!networkStatus.isConnected) {
            console.log('   - 检查网络连接');
            console.log('   - 配置代理服务器');
            console.log('   - 检查防火墙设置');
        } else if (networkStatus.connectionQuality === 'poor' || networkStatus.connectionQuality === 'unusable') {
            console.log('   - 网络质量较差，建议优化网络环境');
            console.log('   - 考虑使用更稳定的VPN服务');
            console.log('   - 调整策略更新频率');
        } else {
            console.log('   - 网络连接正常，可以运行策略');
            console.log('   - 建议定期监控网络状态');
        }
        
        if (proxyConfig.enabled) {
            console.log('   - 代理已配置，确保代理服务稳定运行');
        }
    }

    /**
     * 运行持续监控
     */
    async runContinuousMonitoring(duration = 300000) { // 5分钟
        console.log(`🔄 开始持续网络监控 (${duration/1000}秒)...\n`);
        
        const startTime = Date.now();
        let checkCount = 0;
        
        const monitorInterval = setInterval(async () => {
            checkCount++;
            const elapsed = Date.now() - startTime;
            
            console.log(`[${new Date().toLocaleTimeString()}] 检查 #${checkCount} (${elapsed/1000}s)`);
            
            await this.networkManager.performHealthCheck();
            const status = this.networkManager.getNetworkStatus();
            const stats = this.networkManager.getConnectionStats();
            
            console.log(`   状态: ${status.isConnected ? '✅' : '❌'} | 质量: ${status.connectionQuality} | 延迟: ${status.latency}ms | 成功率: ${stats.successRate}`);
            
            if (elapsed >= duration) {
                clearInterval(monitorInterval);
                console.log('\n📊 监控完成');
                this.displayTestResults();
            }
        }, 10000); // 每10秒检查一次
    }
}

/**
 * 主函数
 */
async function main() {
    const test = new AdvancedNetworkTest();
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'monitor':
                const duration = args[1] ? parseInt(args[1]) * 1000 : 300000;
                await test.runContinuousMonitoring(duration);
                break;
            default:
                await test.runFullTest();
                break;
        }
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = AdvancedNetworkTest; 