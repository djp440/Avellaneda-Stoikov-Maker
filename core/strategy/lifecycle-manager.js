/**
 * 生命周期管理器 - 负责策略的启动、停止、主循环和状态管理
 */
class LifecycleManager {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.config = strategy.config;
        
        // 生命周期状态
        this.isRunning = false;
        this.isPaused = false;
        this.mainLoopTimer = null;
        this.startTime = null;
        this.stopTime = null;
        
        // 循环配置
        this.loopInterval = this.config.get('loopInterval') || 1000; // 默认1秒
        this.maxLoopErrors = this.config.get('maxLoopErrors') || 10; // 最大连续错误次数
        this.loopErrorCount = 0;
        
        // 性能统计
        this.loopCount = 0;
        this.totalLoopTime = 0;
        this.lastLoopTime = 0;
        this.lastLoopDuration = 0;
        
        // 状态监控
        this.lastStatusPrint = 0;
        this.statusPrintInterval = this.config.get('statusPrintInterval') || 30000; // 30秒
    }

    /**
     * 启动策略
     */
    async start() {
        if (this.isRunning) {
            this.logger.warn('策略已在运行中，忽略启动请求');
            return false;
        }
        
        try {
            this.logger.info('开始启动Avellaneda做市策略...');
            console.log('🚀 启动Avellaneda做市策略...');
            
            // 重置状态
            this.resetState();
            
            // 初始化连接
            if (!await this.initializeConnections()) {
                throw new Error('初始化连接失败');
            }
            
            // 同步初始数据
            await this.syncInitialData();
            
            // 设置事件监听
            this.strategy.eventHandler.setupEventListeners();
            
            // 启动订单监控
            this.strategy.orderManager.startOrderMonitoring();
            
            // 启动主循环
            this.startMainLoop();
            
            // 更新状态
            this.isRunning = true;
            this.startTime = Date.now();
            
            this.logger.info('Avellaneda做市策略启动成功', {
                startTime: new Date(this.startTime).toISOString(),
                loopInterval: this.loopInterval,
                symbol: this.config.get('symbol')
            });
            console.log('✅ 策略启动成功');
            
            return true;
            
        } catch (error) {
            this.logger.error('策略启动失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            console.log(`❌ 策略启动失败: ${error.message}`);
            
            // 清理资源
            await this.cleanup();
            return false;
        }
    }

    /**
     * 停止策略
     */
    async stop() {
        if (!this.isRunning) {
            this.logger.warn('策略未在运行，忽略停止请求');
            return;
        }
        
        try {
            this.logger.info('开始停止策略...');
            console.log('🛑 停止策略...');
            
            // 停止主循环
            this.stopMainLoop();
            
            // 取消所有订单
            await this.strategy.orderManager.cancelAllOrders();
            
            // 停止订单监控
            this.strategy.orderManager.stopOrderMonitoring();
            
            // 清理事件监听
            this.strategy.eventHandler.removeEventListeners();
            
            // 更新状态
            this.isRunning = false;
            this.stopTime = Date.now();
            
            // 打印最终统计
            this.printFinalStats();
            
            this.logger.info('策略已停止', {
                stopTime: new Date(this.stopTime).toISOString(),
                runDuration: this.getRunDuration(),
                totalLoops: this.loopCount
            });
            console.log('✅ 策略已停止');
            
        } catch (error) {
            this.logger.error('停止策略时出错', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            console.log(`❌ 停止策略时出错: ${error.message}`);
        }
    }

    /**
     * 暂停策略
     */
    pause() {
        if (!this.isRunning || this.isPaused) {
            this.logger.warn('策略未运行或已暂停');
            return;
        }
        
        this.isPaused = true;
        this.logger.info('策略已暂停');
        console.log('⏸️ 策略已暂停');
    }

    /**
     * 恢复策略
     */
    resume() {
        if (!this.isRunning || !this.isPaused) {
            this.logger.warn('策略未运行或未暂停');
            return;
        }
        
        this.isPaused = false;
        this.logger.info('策略已恢复');
        console.log('▶️ 策略已恢复');
    }

    /**
     * 强制清理（紧急停止）
     */
    async forceCleanup() {
        try {
            this.logger.warn('执行强制清理...');
            console.log('🚨 执行强制清理...');
            
            // 立即停止主循环
            this.stopMainLoop();
            
            // 强制取消所有订单
            try {
                await Promise.race([
                    this.strategy.orderManager.cancelAllOrders(),
                    this.sleep(5000) // 5秒超时
                ]);
            } catch (error) {
                this.logger.error('强制取消订单失败', { error: error.message });
            }
            
            // 停止所有监控
            this.strategy.orderManager.stopOrderMonitoring();
            
            // 更新状态
            this.isRunning = false;
            this.stopTime = Date.now();
            
            this.logger.warn('强制清理完成');
            console.log('✅ 强制清理完成');
            
        } catch (error) {
            this.logger.error('强制清理失败', {
                errorName: error.name,
                errorMessage: error.message
            });
        }
    }

    /**
     * 初始化连接
     */
    async initializeConnections() {
        try {
            this.logger.info('初始化交易所连接...');
            
            // 连接交易所
            if (!this.strategy.exchangeManager.isConnected) {
                await this.strategy.exchangeManager.connect();
            }
            
            // 验证连接状态
            if (!this.strategy.exchangeManager.isConnected) {
                throw new Error('交易所连接失败');
            }
            
            this.logger.info('交易所连接成功');
            return true;
            
        } catch (error) {
            this.logger.error('初始化连接失败', { error: error.message });
            return false;
        }
    }

    /**
     * 同步初始数据
     */
    async syncInitialData() {
        try {
            this.logger.info('同步初始数据...');
            
            // 强制更新所有数据
            await this.strategy.dataManager.forceUpdateAll();
            
            // 同步订单状态
            await this.strategy.orderManager.syncActiveOrdersFromExchange();
            
            this.logger.info('初始数据同步完成');
            
        } catch (error) {
            this.logger.error('同步初始数据失败', { error: error.message });
            throw error;
        }
    }

    /**
     * 启动主循环
     */
    startMainLoop() {
        if (this.mainLoopTimer) {
            clearInterval(this.mainLoopTimer);
        }
        
        this.logger.info('启动主循环', { interval: this.loopInterval });
        
        this.mainLoopTimer = setInterval(async () => {
            try {
                await this.mainLoop();
            } catch (error) {
                this.logger.error('主循环执行出错', {
                    errorName: error.name,
                    errorMessage: error.message,
                    loopCount: this.loopCount
                });
                
                this.loopErrorCount++;
                if (this.loopErrorCount >= this.maxLoopErrors) {
                    this.logger.error('主循环连续错误次数过多，停止策略', {
                        errorCount: this.loopErrorCount,
                        maxErrors: this.maxLoopErrors
                    });
                    await this.stop();
                }
            }
        }, this.loopInterval);
    }

    /**
     * 停止主循环
     */
    stopMainLoop() {
        if (this.mainLoopTimer) {
            clearInterval(this.mainLoopTimer);
            this.mainLoopTimer = null;
            this.logger.info('主循环已停止');
        }
    }

    /**
     * 主循环逻辑
     */
    async mainLoop() {
        const loopStartTime = Date.now();
        this.loopCount++;
        this.lastLoopTime = loopStartTime;
        
        try {
            // 检查是否暂停
            if (this.isPaused) {
                return;
            }
            
            // 检查连接状态
            if (!this.strategy.exchangeManager.isConnected) {
                this.logger.warn('交易所连接断开，跳过本次循环');
                return;
            }
            
            this.logger.debug('开始主循环', { loopCount: this.loopCount });
            
            // 更新市场数据
            await this.strategy.dataManager.updateMarketData();
            
            // 更新余额
            await this.strategy.dataManager.updateBalances();
            
            // 更新技术指标
            await this.strategy.dataManager.updateIndicators();
            
            // 执行策略逻辑
            const strategyExecuted = await this.strategy.strategyCore.executeStrategy();
            
            // 检查是否需要更新订单
            if (strategyExecuted && this.strategy.orderManager.shouldUpdateOrders()) {
                await this.strategy.orderManager.updateOrders();
            }
            
            // 打印状态信息
            this.printStrategyStatus();
            
            // 重置错误计数
            this.loopErrorCount = 0;
            
            // 记录循环时间
            this.lastLoopDuration = Date.now() - loopStartTime;
            this.totalLoopTime += this.lastLoopDuration;
            
            this.logger.debug('主循环完成', {
                loopCount: this.loopCount,
                duration: this.lastLoopDuration + 'ms',
                strategyExecuted: strategyExecuted
            });
            
        } catch (error) {
            this.lastLoopDuration = Date.now() - loopStartTime;
            throw error;
        }
    }

    /**
     * 打印策略状态
     */
    printStrategyStatus() {
        const now = Date.now();
        
        // 检查是否需要打印状态
        if (now - this.lastStatusPrint < this.statusPrintInterval) {
            return;
        }
        
        try {
            const marketData = this.strategy.dataManager.getMarketDataSummary();
            const balanceData = this.strategy.dataManager.getBalanceSummary();
            const activeOrders = this.strategy.orderManager.getActiveOrdersCount();
            const { optimalBid, optimalAsk } = this.strategy.strategyState;
            
            if (marketData && balanceData) {
                const runTime = this.getRunDuration();
                const avgLoopTime = this.loopCount > 0 ? (this.totalLoopTime / this.loopCount).toFixed(2) : '0';
                
                console.log(`\n📊 策略状态 [运行时间: ${runTime}]`);
                console.log(`💰 市场: ${marketData.bestBid.toFixed(2)}/${marketData.bestAsk.toFixed(2)} (价差: ${marketData.spreadPercent}%)`);
                console.log(`🎯 报价: ${optimalBid?.toFixed(2) || 'N/A'}/${optimalAsk?.toFixed(2) || 'N/A'}`);
                console.log(`📦 订单: ${activeOrders}个活跃`);
                console.log(`💼 库存: ${balanceData.currentInventory?.toFixed(4) || 'N/A'} (目标: ${balanceData.targetInventory?.toFixed(4) || 'N/A'})`);
                console.log(`⚡ 性能: ${this.loopCount}次循环, 平均${avgLoopTime}ms/次`);
                
                this.logger.info('策略状态摘要', {
                    runTime: runTime,
                    marketBid: marketData.bestBid,
                    marketAsk: marketData.bestAsk,
                    optimalBid: optimalBid,
                    optimalAsk: optimalAsk,
                    activeOrders: activeOrders,
                    currentInventory: balanceData.currentInventory,
                    targetInventory: balanceData.targetInventory,
                    loopCount: this.loopCount,
                    avgLoopTime: avgLoopTime
                });
            }
            
            this.lastStatusPrint = now;
            
        } catch (error) {
            this.logger.error('打印策略状态失败', { error: error.message });
        }
    }

    /**
     * 打印最终统计
     */
    printFinalStats() {
        try {
            const runDuration = this.getRunDuration();
            const avgLoopTime = this.loopCount > 0 ? (this.totalLoopTime / this.loopCount).toFixed(2) : '0';
            const orderHistory = this.strategy.orderManager.getOrderHistory();
            
            console.log(`\n📈 策略运行统计`);
            console.log(`⏱️ 运行时间: ${runDuration}`);
            console.log(`🔄 循环次数: ${this.loopCount}`);
            console.log(`⚡ 平均循环时间: ${avgLoopTime}ms`);
            console.log(`📦 历史订单: ${orderHistory.length}个`);
            
            this.logger.info('最终统计', {
                runDuration: runDuration,
                totalLoops: this.loopCount,
                avgLoopTime: avgLoopTime,
                totalOrderHistory: orderHistory.length
            });
            
        } catch (error) {
            this.logger.error('打印最终统计失败', { error: error.message });
        }
    }

    /**
     * 重置状态
     */
    resetState() {
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.stopTime = null;
        this.loopCount = 0;
        this.totalLoopTime = 0;
        this.lastLoopTime = 0;
        this.lastLoopDuration = 0;
        this.loopErrorCount = 0;
        this.lastStatusPrint = 0;
        
        this.logger.debug('生命周期状态已重置');
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            this.stopMainLoop();
            this.strategy.orderManager.stopOrderMonitoring();
            this.strategy.eventHandler.removeEventListeners();
            this.resetState();
            
            this.logger.info('资源清理完成');
            
        } catch (error) {
            this.logger.error('清理资源失败', { error: error.message });
        }
    }

    /**
     * 获取运行时长
     */
    getRunDuration() {
        if (!this.startTime) {
            return '未启动';
        }
        
        const endTime = this.stopTime || Date.now();
        const duration = endTime - this.startTime;
        
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * 获取生命周期状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            startTime: this.startTime,
            stopTime: this.stopTime,
            runDuration: this.getRunDuration(),
            loopCount: this.loopCount,
            lastLoopTime: this.lastLoopTime,
            lastLoopDuration: this.lastLoopDuration,
            averageLoopTime: this.loopCount > 0 ? this.totalLoopTime / this.loopCount : 0,
            loopErrorCount: this.loopErrorCount,
            maxLoopErrors: this.maxLoopErrors,
            loopInterval: this.loopInterval
        };
    }

    /**
     * 工具函数：睡眠
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LifecycleManager;