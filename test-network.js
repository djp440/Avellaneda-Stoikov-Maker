const https = require('https');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * 网络连接测试
 */
class NetworkTest {
    constructor() {
        this.proxyUrl = 'socks5://127.0.0.1:7897';
        this.agent = new SocksProxyAgent(this.proxyUrl);
        
        this.testUrls = [
            'https://api.bitget.com/api/v2/spot/public/coins',
            'https://api.bitget.com/api/v2/spot/public/ticker',
            'https://api-sandbox.bitget.com/api/v2/spot/public/coins',
            'https://www.google.com',
            'https://www.baidu.com'
        ];
    }

    /**
     * 测试单个URL
     */
    testUrl(url) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const protocol = url.startsWith('https:') ? https : http;
            
            const options = {
                agent: this.agent,
                timeout: 10000
            };
            
            const req = protocol.get(url, options, (res) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                resolve({
                    url,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    success: res.statusCode >= 200 && res.statusCode < 300
                });
            });
            
            req.on('error', (error) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                resolve({
                    url,
                    status: 'ERROR',
                    duration: `${duration}ms`,
                    success: false,
                    error: error.message
                });
            });
            
            req.setTimeout(10000, () => {
                req.destroy();
                resolve({
                    url,
                    status: 'TIMEOUT',
                    duration: '10000ms+',
                    success: false,
                    error: 'Request timeout'
                });
            });
        });
    }

    /**
     * 运行所有测试
     */
    async runTests() {
        console.log('🌐 开始网络连接测试...');
        console.log(`🔧 使用代理: ${this.proxyUrl}\n`);
        
        const results = [];
        
        for (const url of this.testUrls) {
            console.log(`🔗 测试: ${url}`);
            const result = await this.testUrl(url);
            results.push(result);
            
            if (result.success) {
                console.log(`✅ 成功 - 状态: ${result.status}, 耗时: ${result.duration}`);
            } else {
                console.log(`❌ 失败 - 状态: ${result.status}, 耗时: ${result.duration}`);
                if (result.error) {
                    console.log(`   错误: ${result.error}`);
                }
            }
            console.log('');
        }
        
        this.printSummary(results);
    }

    /**
     * 输出测试摘要
     */
    printSummary(results) {
        console.log('📊 网络测试结果摘要:');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ 成功连接: ${successful.length}/${results.length}`);
        console.log(`❌ 失败连接: ${failed.length}/${results.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ 成功的连接:');
            successful.forEach(result => {
                console.log(`   ${result.url} - ${result.status} (${result.duration})`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ 失败的连接:');
            failed.forEach(result => {
                console.log(`   ${result.url} - ${result.status} (${result.duration})`);
                if (result.error) {
                    console.log(`     错误: ${result.error}`);
                }
            });
        }
        
        console.log('\n💡 建议:');
        if (failed.length === 0) {
            console.log('   网络连接正常，所有测试通过！');
        } else if (successful.length > 0) {
            console.log('   部分网络连接正常，可能是特定API的问题');
        } else {
            console.log('   网络连接有问题，请检查代理设置或防火墙');
        }
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