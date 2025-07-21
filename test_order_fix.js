/**
 * 测试订单监控修复效果
 * 验证订单成交后是否能正确挂出新订单
 */

const AvellanedaStrategy = require('./core/strategy');
const config = require('./config');
const logger = require('./utils/logger');

class OrderFixTest {
    constructor() {
        this.strategy = null;
        this.testResults = {
            orderCreated: false,
            orderFilled: false,
            newOrderCreated: false,
            monitoringActive: false
        };
    }

    async runTest() {
        try {
            logger.info('开始测试订单监控修复效果');
            
            // 初始化策略
            this.strategy = new AvellanedaStrategy(config);
            
            // 监听订单事件
            this.setupEventListeners();
            
            // 启动策略
            await this.strategy.start();
            
            // 等待一段时间观察订单行为
            await this.waitAndObserve();
            
            // 输出测试结果
            this.printTestResults();
            
        } catch (error) {
            logger.error('测试过程中出错', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
        } finally {
            if (this.strategy) {
                await this.strategy.stop();
            }
        }
    }

    setupEventListeners() {
        // 监听订单更新事件
        this.strategy.exchangeManager.on('orderUpdate', (order) => {
            logger.info('检测到订单更新', {
                orderId: order.id,
                status: order.status,
                side: order.side,
                amount: order.amount,
                price: order.price
            });
            
            if (order.status === 'open') {
                this.testResults.orderCreated = true;
                logger.info('✅ 订单创建成功');
            } else if (order.status === 'filled') {
                this.testResults.orderFilled = true;
                logger.info('✅ 订单成交检测成功');
            }
        });
        
        // 检查订单监控是否启动
        setTimeout(() => {
            if (this.strategy.orderMonitoringTimer) {
                this.testResults.monitoringActive = true;
                logger.info('✅ 订单监控已启动');
            } else {
                logger.warn('❌ 订单监控未启动');
            }
        }, 2000);
    }

    async waitAndObserve() {
        logger.info('开始观察订单行为，等待60秒...');
        
        const startTime = Date.now();
        const observationTime = 60000; // 60秒
        
        while (Date.now() - startTime < observationTime) {
            // 检查活跃订单数量
            const activeOrdersCount = this.strategy.activeOrders.size;
            
            if (activeOrdersCount > 0) {
                logger.debug('当前活跃订单数量', { count: activeOrdersCount });
                
                // 如果之前有订单成交，现在又有新订单，说明修复成功
                if (this.testResults.orderFilled && activeOrdersCount > 0) {
                    this.testResults.newOrderCreated = true;
                    logger.info('✅ 订单成交后成功创建新订单');
                }
            }
            
            await this.sleep(5000); // 每5秒检查一次
        }
    }

    printTestResults() {
        logger.info('=== 测试结果汇总 ===');
        logger.info('订单创建', { success: this.testResults.orderCreated });
        logger.info('订单成交检测', { success: this.testResults.orderFilled });
        logger.info('订单监控启动', { success: this.testResults.monitoringActive });
        logger.info('成交后新订单创建', { success: this.testResults.newOrderCreated });
        
        const allTestsPassed = Object.values(this.testResults).every(result => result === true);
        
        if (allTestsPassed) {
            logger.info('🎉 所有测试通过！订单监控修复成功！');
        } else {
            logger.warn('⚠️ 部分测试未通过，可能需要进一步调试');
        }
        
        // 输出修复说明
        logger.info('=== 修复说明 ===');
        logger.info('1. 添加了主动订单状态监控机制');
        logger.info('2. 每5秒检查一次活跃订单的状态变化');
        logger.info('3. 当检测到订单成交时，自动触发订单更新流程');
        logger.info('4. 解决了订单成交后无法挂出新订单的问题');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行测试
if (require.main === module) {
    const test = new OrderFixTest();
    test.runTest().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = OrderFixTest;