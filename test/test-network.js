const ccxt = require('ccxt');

/**
 * 使用CCXT测试网络连接
 */
class NetworkTest {
    constructor() {
        this.exchanges = [
            {
                name: 'Bitget',
                exchange: new ccxt.bitget({
                    apiKey: process.env.BITGET_API_KEY || 'test',
                    secret: process.env.BITGET_SECRET || 'test',
                    password: process.env.BITGET_PASSPHRASE || 'test',
                    sandbox: false,
                    timeout: 10000
                })
            },
            {
                name: 'Bitget Sandbox',
                exchange: new ccxt.bitget({
                    apiKey: process.env.BITGET_API_KEY || 'test',
                    secret: process.env.BITGET_SECRET || 'test',
                    password: process.env.BITGET_PASSPHRASE || 'test',
                    sandbox: true,
                    timeout: 10000
                })
            }
        ];
    }

    /**
     * 测试交易所连接
     */
    async testExchange(exchangeInfo) {
        const { name, exchange } = exchangeInfo;
        const startTime = Date.now();
        
        try {
            console.log(`🔗 测试 ${name} 连接...`);
            
            // 测试加载市场信息
            await exchange.loadMarkets();
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`✅ ${name} 连接成功 - 耗时: ${duration}ms`);
            console.log(`   可用市场数量: ${Object.keys(exchange.markets).length}`);
            
            // 测试获取ticker
            try {
                const ticker = await exchange.fetchTicker('BTC/USDT');
                console.log(`   BTC/USDT 价格: $${ticker.last}`);
            } catch (tickerError) {
                console.log(`   ⚠️ 获取ticker失败: ${tickerError.message}`);
            }
            
            return {
                name,
                success: true,
                duration: `${duration}ms`,
                markets: Object.keys(exchange.markets).length
            };
            
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`❌ ${name} 连接失败 - 耗时: ${duration}ms`);
            console.log(`   错误: ${error.message}`);
            
            return {
                name,
                success: false,
                duration: `${duration}ms`,
                error: error.message
            };
        }
    }

    /**
     * 测试基本网络连接
     */
    async testBasicNetwork() {
        const https = require('https');
        
        const testUrls = [
            'https://www.google.com',
            'https://www.baidu.com'
        ];
        
        console.log('\n🌐 测试基本网络连接...\n');
        
        for (const url of testUrls) {
            try {
                const startTime = Date.now();
                await new Promise((resolve, reject) => {
                    const req = https.get(url, (res) => {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        console.log(`✅ ${url} - 状态: ${res.statusCode} (${duration}ms)`);
                        resolve();
                    });
                    
                    req.on('error', (error) => {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        console.log(`❌ ${url} - 错误: ${error.message} (${duration}ms)`);
                        resolve();
                    });
                    
                    req.setTimeout(5000, () => {
                        req.destroy();
                        console.log(`❌ ${url} - 超时 (5000ms+)`);
                        resolve();
                    });
                });
            } catch (error) {
                console.log(`❌ ${url} - 异常: ${error.message}`);
            }
        }
    }

    /**
     * 运行所有测试
     */
    async runTests() {
        console.log('🚀 开始CCXT网络连接测试...\n');
        
        // 测试交易所连接
        const results = [];
        for (const exchangeInfo of this.exchanges) {
            const result = await this.testExchange(exchangeInfo);
            results.push(result);
            console.log('');
        }
        
        // 测试基本网络连接
        await this.testBasicNetwork();
        
        this.printSummary(results);
    }

    /**
     * 输出测试摘要
     */
    printSummary(results) {
        console.log('\n📊 CCXT网络测试结果摘要:');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ 成功连接: ${successful.length}/${results.length}`);
        console.log(`❌ 失败连接: ${failed.length}/${results.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ 成功的连接:');
            successful.forEach(result => {
                console.log(`   ${result.name} - ${result.duration}`);
                if (result.markets) {
                    console.log(`     可用市场: ${result.markets}个`);
                }
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ 失败的连接:');
            failed.forEach(result => {
                console.log(`   ${result.name} - ${result.duration}`);
                console.log(`     错误: ${result.error}`);
            });
        }
        
        console.log('\n💡 建议:');
        if (failed.length === 0) {
            console.log('   CCXT连接正常，所有交易所API可访问！');
        } else if (successful.length > 0) {
            console.log('   部分CCXT连接正常，可能是特定环境的问题');
        } else {
            console.log('   CCXT连接有问题，请检查网络设置或API配置');
        }
        
        console.log('\n🔧 如果连接失败，请检查:');
        console.log('   1. 网络连接是否正常');
        console.log('   2. 防火墙是否阻止了连接');
        console.log('   3. API密钥配置是否正确');
        console.log('   4. 是否使用了代理或VPN');
    }
}

/**
 * 主函数
 */
async function main() {
    const test = new NetworkTest();
    await test.runTests();
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = NetworkTest; 