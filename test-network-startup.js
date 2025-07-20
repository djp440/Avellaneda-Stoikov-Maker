const AvellanedaMarketMaking = require('./index');

/**
 * 测试策略启动时的网络连接测试功能
 */
class NetworkStartupTest {
    constructor() {
        this.strategy = new AvellanedaMarketMaking();
    }

    /**
     * 运行测试
     */
    async runTest() {
        console.log('🧪 测试策略启动时的网络连接测试功能...\n');
        
        try {
            // 初始化策略
            console.log('1️⃣ 初始化策略...');
            await this.strategy.initialize();
            console.log('✅ 策略初始化成功\n');
            
            // 测试启动（包含网络连接测试）
            console.log('2️⃣ 启动策略（包含网络连接测试）...');
            await this.strategy.start();
            console.log('✅ 策略启动成功\n');
            
            // 运行一段时间
            console.log('3️⃣ 策略运行中（10秒）...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // 停止策略
            console.log('4️⃣ 停止策略...');
            await this.strategy.stop();
            console.log('✅ 策略停止成功\n');
            
            console.log('🎉 网络连接测试功能测试完成！');
            
        } catch (error) {
            console.error('❌ 测试失败:', error.message);
            
            // 如果是网络连接问题，提供解决建议
            if (error.message.includes('网络连接测试失败')) {
                console.log('\n🔧 网络连接问题解决方案:');
                console.log('1. 检查网络连接是否正常');
                console.log('2. 如果使用VPN，确保VPN连接稳定');
                console.log('3. 配置代理服务器:');
                console.log('   - 在 .env 文件中添加代理配置');
                console.log('   - 运行 node test-network-advanced.js 测试网络');
                console.log('4. 查看详细配置指南: docs/NETWORK_SETUP.md');
            }
            
            process.exit(1);
        }
    }

    /**
     * 测试网络连接失败场景
     */
    async testNetworkFailure() {
        console.log('🧪 测试网络连接失败场景...\n');
        
        // 临时修改环境变量，模拟网络问题
        const originalProxyHost = process.env.PROXY_HOST;
        process.env.PROXY_HOST = 'invalid.proxy.com';
        
        try {
            const strategy = new AvellanedaMarketMaking();
            await strategy.initialize();
            await strategy.start();
        } catch (error) {
            console.log('✅ 网络连接失败场景测试通过');
            console.log('   错误信息:', error.message);
        } finally {
            // 恢复原始配置
            if (originalProxyHost) {
                process.env.PROXY_HOST = originalProxyHost;
            } else {
                delete process.env.PROXY_HOST;
            }
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const test = new NetworkStartupTest();
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const testType = args[0] || 'normal';
    
    try {
        switch (testType) {
            case 'failure':
                await test.testNetworkFailure();
                break;
            default:
                await test.runTest();
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

module.exports = NetworkStartupTest; 