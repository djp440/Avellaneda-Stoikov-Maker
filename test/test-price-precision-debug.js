/**
 * 价格精度调试测试脚本
 * 用于验证CCXT返回的价格精度信息和价格格式化逻辑
 */

const ccxt = require('ccxt');
const path = require('path');

// 加载配置
const config = require('../config/trading.js');

async function testPricePrecision() {
    console.log('🔍 价格精度调试测试');
    console.log('─'.repeat(50));
    
    try {
        // 创建交易所实例
        const exchange = new ccxt.bitget({
            apiKey: process.env.BITGET_API_KEY,
            secret: process.env.BITGET_SECRET_KEY,
            password: process.env.BITGET_PASSPHRASE,
            sandbox: false
        });
        
        console.log('📡 连接交易所...');
        await exchange.loadMarkets();
        console.log('✅ 交易所连接成功');
        
        // 获取市场信息
        const symbol = config.symbol;
        const market = exchange.market(symbol);
        
        console.log('\n📊 市场信息:');
        console.log(`   交易对: ${market.symbol}`);
        console.log(`   基础货币: ${market.base}`);
        console.log(`   计价货币: ${market.quote}`);
        console.log(`   状态: ${market.active ? '活跃' : '非活跃'}`);
        
        console.log('\n🎯 精度信息:');
        console.log(`   价格精度: ${JSON.stringify(market.precision.price)}`);
        console.log(`   数量精度: ${JSON.stringify(market.precision.amount)}`);
        console.log(`   成本精度: ${JSON.stringify(market.precision.cost)}`);
        
        // 分析价格精度
        const pricePrecision = market.precision.price;
        console.log('\n🔍 价格精度分析:');
        console.log(`   原始值: ${pricePrecision}`);
        console.log(`   类型: ${typeof pricePrecision}`);
        
        if (typeof pricePrecision === 'number') {
            console.log(`   是否为整数: ${Number.isInteger(pricePrecision)}`);
            console.log(`   精度位数: ${pricePrecision}`);
            console.log(`   价格步长: ${Math.pow(10, -pricePrecision)}`);
        } else {
            console.log(`   价格步长: ${pricePrecision}`);
            console.log(`   精度位数: ${Math.abs(Math.floor(Math.log10(pricePrecision)))}`);
        }
        
        // 测试价格格式化
        console.log('\n🧪 价格格式化测试:');
        const testPrices = [179.87, 180.08, 180.123456];
        
        testPrices.forEach(price => {
            console.log(`\n   原始价格: ${price}`);
            
            // 使用当前逻辑格式化
            let formattedPrice;
            if (typeof pricePrecision === 'number') {
                formattedPrice = parseFloat(price.toFixed(pricePrecision));
            } else {
                const precision = Math.abs(Math.floor(Math.log10(pricePrecision)));
                formattedPrice = parseFloat(price.toFixed(precision));
            }
            
            console.log(`   格式化后: ${formattedPrice}`);
            console.log(`   差异: ${price - formattedPrice}`);
        });
        
        // 测试价格对齐
        console.log('\n🎯 价格对齐测试:');
        const priceStep = typeof pricePrecision === 'number' ? Math.pow(10, -pricePrecision) : pricePrecision;
        console.log(`   价格步长: ${priceStep}`);
        
        testPrices.forEach(price => {
            const alignedPrice = Math.round(price / priceStep) * priceStep;
            console.log(`   ${price} -> ${alignedPrice} (差异: ${price - alignedPrice})`);
        });
        
        console.log('\n✅ 价格精度调试测试完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.stack) {
            console.error('📚 错误详情:', error.stack);
        }
    }
}

// 运行测试
if (require.main === module) {
    testPricePrecision().then(() => {
        console.log('\n🏁 测试结束');
        process.exit(0);
    }).catch(error => {
        console.error('💥 测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testPricePrecision }; 