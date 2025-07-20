const AvellanedaMarketMaking = require('../index');

/**
 * 测试启动脚本的详细输出
 */
async function testStartupDebug() {
    console.log('🧪 测试启动脚本详细输出');
    console.log('='.repeat(60));
    
    const strategy = new AvellanedaMarketMaking();
    
    try {
        // 测试初始化
        console.log('\n📋 测试初始化过程...');
        await strategy.initialize();
        
        // 获取状态
        console.log('\n📊 获取策略状态...');
        const status = strategy.getStatus();
        console.log('策略状态:', JSON.stringify(status, null, 2));
        
        // 测试启动
        console.log('\n🚀 测试启动过程...');
        await strategy.start();
        
        // 等待一段时间
        console.log('\n⏳ 等待5秒...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 测试停止
        console.log('\n🛑 测试停止过程...');
        await strategy.stop();
        
        console.log('\n✅ 测试完成！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        
        if (error.stack) {
            console.error('\n📚 错误堆栈:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    // 设置调试模式
    process.env.DEBUG = 'true';
    process.env.NODE_ENV = 'development';
    
    testStartupDebug();
}

module.exports = testStartupDebug; 