const AvellanedaMarketMaking = require('../index');

/**
 * 测试策略运行时的详细输出
 */
async function testStrategyDetailed() {
    console.log('🧪 测试策略运行时详细输出');
    console.log('='.repeat(60));
    
    const strategy = new AvellanedaMarketMaking();
    
    try {
        // 初始化策略
        console.log('\n📋 初始化策略...');
        await strategy.initialize();
        
        // 启动策略
        console.log('\n🚀 启动策略...');
        await strategy.start();
        
        // 等待一段时间观察输出
        console.log('\n⏳ 等待30秒观察策略运行...');
        console.log('观察以下内容:');
        console.log('1. 策略状态信息');
        console.log('2. 参数计算详情');
        console.log('3. 订单数量计算过程');
        console.log('4. 订单创建过程');
        console.log('5. 风险验证结果');
        
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // 停止策略
        console.log('\n🛑 停止策略...');
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
    
    testStrategyDetailed();
}

module.exports = testStrategyDetailed; 