const StrategyConfig = require('./config/strategy');
const Logger = require('./utils/logger');
const AvellanedaStrategy = require('./core/strategy');
const ccxt = require('ccxt');

class AvellanedaMarketMaking {
    constructor() {
        this.config = null;
        this.logger = null;
        this.strategy = null;
        this.exchange = null;
        this.isRunning = false;
        this.isShuttingDown = false;
        this.healthCheckInterval = null;
        this.startTime = null;
        this.debugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
    }

    /**
     * 打印启动横幅
     */
    printStartupBanner() {
        console.log('\n' + '='.repeat(80));
        console.log('🚀 Avellaneda 做市策略启动器');
        console.log('='.repeat(80));
        console.log(`📅 启动时间: ${new Date().toLocaleString('zh-CN')}`);
        console.log(`🔧 调试模式: ${this.debugMode ? '启用' : '禁用'}`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 Node.js版本: ${process.version}`);
        console.log(`💾 内存: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log('='.repeat(80) + '\n');
    }

    /**
     * 打印配置摘要
     */
    printConfigSummary() {
        if (!this.debugMode) return;
        
        console.log('📋 配置摘要:');
        console.log('─'.repeat(40));
        
        const config = this.config.getAll();
        
        // 交易所配置
        console.log('🏢 交易所配置:');
        console.log(`   交易所: ${config.exchange.name}`);
        console.log(`   API密钥: ${config.exchange.apiKey ? '✅ 已配置' : '❌ 未配置'}`);
        console.log(`   密钥: ${config.exchange.secret ? '✅ 已配置' : '❌ 未配置'}`);
        console.log(`   Passphrase: ${config.exchange.password ? '✅ 已配置' : '❌ 未配置'}`);
        console.log(`   沙盒模式: ${config.exchange.sandbox ? '✅ 启用' : '❌ 禁用'}`);
        
        // 交易配置
        console.log('\n💰 交易配置:');
        console.log(`   交易对: ${config.symbol}`);
        console.log(`   基础货币: ${config.baseCurrency}`);
        console.log(`   计价货币: ${config.quoteCurrency}`);
        console.log(`   风险因子: ${config.riskFactor}`);
        console.log(`   订单金额: ${config.orderAmount}`);
        console.log(`   最小价差: ${config.minSpread}`);
        console.log(`   最大价差: ${config.maxSpread}`);
        
        // 执行配置
        console.log('\n⚙️ 执行配置:');
        console.log(`   更新间隔: ${config.updateInterval}ms`);
        console.log(`   最大订单数: ${config.maxOrders}`);
        console.log(`   订单超时: ${config.orderTimeout}ms`);
        console.log(`   成交延迟: ${config.filledOrderDelay}ms`);
        
        // 风险管理配置
        console.log('\n🛡️ 风险管理:');
        console.log(`   最大仓位比例: ${config.maxPositionSizePercent}%`);
        console.log(`   最大仓位价值: ${config.maxPositionValuePercent}%`);
        console.log(`   止损比例: ${config.stopLossPercent}%`);
        console.log(`   最大回撤: ${config.maxDrawdown}%`);
        console.log(`   日最大亏损: ${config.maxDailyLossPercent}%`);
        
        console.log('─'.repeat(40) + '\n');
    }

    /**
     * 初始化策略
     */
    async initialize() {
        try {
            this.printStartupBanner();
            console.log('🔧 开始初始化 Avellaneda 做市策略...\n');
            
            // 步骤1: 初始化配置
            console.log('📋 步骤 1/5: 加载配置...');
            this.config = new StrategyConfig();
            console.log('✅ 配置加载完成');
            
            // 打印配置摘要
            this.printConfigSummary();
            
            // 步骤2: 初始化日志
            console.log('📝 步骤 2/5: 初始化日志系统...');
            this.logger = new Logger(this.config);
            console.log('✅ 日志系统初始化完成');
            
            // 记录启动信息
            this.logger.info('策略初始化开始', {
                exchange: this.config.get('exchange').name,
                symbol: this.config.get('symbol'),
                sandbox: this.config.isSandbox(),
                environment: this.config.get('nodeEnv'),
                debugMode: this.debugMode,
                nodeVersion: process.version,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            });

            // 步骤3: 验证配置
            console.log('🔍 步骤 3/5: 验证配置...');
            this.validateConfiguration();
            console.log('✅ 配置验证通过');
            
            // 步骤4: 初始化策略
            console.log('🧮 步骤 4/5: 初始化策略算法...');
            await this.initializeStrategy();
            console.log('✅ 策略算法初始化完成');
            
            // 步骤5: 设置配置监听
            console.log('👂 步骤 5/5: 设置配置监听...');
            this.setupConfigWatchers();
            console.log('✅ 配置监听设置完成');
            
            this.logger.info('策略初始化完成', {
                totalSteps: 5,
                timestamp: new Date().toISOString()
            });
            
            console.log('\n🎉 策略初始化完成！');
            console.log('─'.repeat(40));
            
            return true;
        } catch (error) {
            console.error('\n❌ 策略初始化失败:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            if (this.logger) {
                this.logger.errorWithStack('策略初始化失败', error);
            }
            throw error;
        }
    }

    /**
     * 验证配置
     */
    validateConfiguration() {
        const config = this.config.getAll();
        
        this.logger.info('配置验证开始', {
            exchange: config.exchange.name,
            symbol: config.symbol,
            riskFactor: config.riskFactor,
            orderAmount: config.orderAmount,
            updateInterval: config.updateInterval
        });

        // 检查关键配置
        const validationChecks = [
            {
                name: 'API密钥',
                check: () => config.exchange.apiKey && config.exchange.apiKey !== 'your_api_key_here',
                error: '请配置有效的交易所API密钥'
            },
            {
                name: '密钥',
                check: () => config.exchange.secret && config.exchange.secret !== 'your_secret_here',
                error: '请配置有效的交易所密钥'
            },
            {
                name: 'Passphrase',
                check: () => config.exchange.password && config.exchange.password !== 'your_passphrase_here',
                error: '请配置有效的交易所Passphrase'
            },
            {
                name: '交易对',
                check: () => config.symbol && config.symbol.includes('/'),
                error: '请配置有效的交易对格式 (如: BTC/USDT)'
            },
            {
                name: '风险因子',
                check: () => config.riskFactor > 0 && config.riskFactor <= 1,
                error: '风险因子必须在0-1之间'
            },
            {
                name: '订单金额',
                check: () => config.orderAmount > 0,
                error: '订单金额必须大于0'
            }
        ];

        const failedChecks = [];
        
        for (const check of validationChecks) {
            if (!check.check()) {
                failedChecks.push(check);
                if (this.debugMode) {
                    console.log(`   ❌ ${check.name}: ${check.error}`);
                }
            } else if (this.debugMode) {
                console.log(`   ✅ ${check.name}: 通过`);
            }
        }

        if (failedChecks.length > 0) {
            const errorMessage = `配置验证失败:\n${failedChecks.map(c => `- ${c.name}: ${c.error}`).join('\n')}`;
            throw new Error(errorMessage);
        }

        this.logger.info('配置验证通过', {
            totalChecks: validationChecks.length,
            passedChecks: validationChecks.length - failedChecks.length
        });
    }

    /**
     * 初始化策略
     */
    async initializeStrategy() {
        try {
            if (this.debugMode) {
                console.log('   正在创建策略实例...');
            }
            
            // 创建策略实例，传递配置管理器实例
            this.strategy = new AvellanedaStrategy(this.config);
            
            if (this.debugMode) {
                console.log('   正在初始化策略组件...');
            }
            
            // 初始化策略
            const initialized = await this.strategy.initialize();
            if (!initialized) {
                throw new Error('策略初始化失败');
            }
            
            this.logger.info('策略算法初始化成功', {
                strategyClass: this.strategy.constructor.name,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('策略算法初始化失败', error);
            throw error;
        }
    }

    /**
     * 设置配置变更监听
     */
    setupConfigWatchers() {
        if (this.debugMode) {
            console.log('   设置配置变更监听器...');
        }
        
        // 监听配置变更
        this.config.watch('all', (key, oldValue, newValue) => {
            this.logger.configChange(key, oldValue, newValue);
        });

        // 监听特定配置变更
        this.config.watch('updateInterval', (oldValue, newValue) => {
            this.logger.info('更新间隔已变更', { oldValue, newValue });
        });
        
        if (this.debugMode) {
            console.log('   配置监听器设置完成');
        }
    }

    /**
     * 网络连接测试
     */
    async testNetworkConnection() {
        const maxRetries = 2; // 减少重试次数
        let retryCount = 0;
        
        console.log('🌐 开始网络连接测试...\n');
        
        while (retryCount < maxRetries) {
            try {
                console.log(`   第 ${retryCount + 1}/${maxRetries} 次测试...`);
                
                // 创建网络管理器进行快速测试
                const NetworkManager = require('./core/network-manager');
                const networkManager = new NetworkManager(this.config);
                
                // 执行快速网络测试（只测试一个连接）
                const testResult = await this.performQuickNetworkTest(networkManager);
                
                if (testResult.success) {
                    console.log(`   ✅ 网络连接正常`);
                    console.log(`   📊 延迟: ${testResult.latency}ms`);
                    console.log(`   🌍 测试地址: ${testResult.url}`);
                    
                    this.logger.info('网络连接测试通过', testResult);
                    
                    // 关闭网络管理器
                    networkManager.close();
                    return true;
                } else {
                    throw new Error(`网络连接失败: ${testResult.error}`);
                }
                
            } catch (error) {
                retryCount++;
                this.logger.warn(`网络连接测试失败 (第${retryCount}次)`, error);
                
                console.log(`   ❌ 网络连接测试失败: ${error.message}`);
                
                if (retryCount < maxRetries) {
                    console.log(`   ⏳ 3秒后重试... (${retryCount}/${maxRetries})`);
                    
                    // 等待3秒后重试（缩短等待时间）
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    console.log(`   ❌ 网络连接测试连续${maxRetries}次失败`);
                    console.log('   💡 建议检查网络连接或配置代理');
                    this.logger.error('网络连接测试最终失败', error);
                    return false;
                }
            }
        }
        
        return false;
    }

    /**
     * 执行快速网络测试
     */
    async performQuickNetworkTest(networkManager) {
        try {
            // 只测试一个可靠的连接点
            const testUrl = 'https://www.google.com';
            const startTime = Date.now();
            
            // 使用简化的连接测试
            const result = await networkManager.testConnection(testUrl);
            
            if (result.success) {
                return {
                    success: true,
                    latency: result.latency,
                    url: testUrl
                };
            } else {
                return {
                    success: false,
                    error: result.error || '连接超时',
                    url: testUrl
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: 'unknown'
            };
        }
    }

    /**
     * 启动策略
     */
    async start() {
        try {
            if (this.isRunning) {
                this.logger.warn('策略已在运行中');
                console.log('⚠️ 策略已在运行中');
                return;
            }

            console.log('🚀 开始启动策略...\n');
            this.logger.info('启动策略');

            // 网络连接测试
            console.log('🔍 执行网络连接测试...');
            const networkTestPassed = await this.testNetworkConnection();
            if (!networkTestPassed) {
                throw new Error('网络连接测试失败，无法启动策略');
            }
            console.log('✅ 网络连接测试通过\n');

            // 启动策略
            console.log('🎯 启动策略算法...');
            const started = await this.strategy.start();
            if (!started) {
                throw new Error('策略启动失败');
            }
            console.log('✅ 策略算法启动成功');

            // 标记为运行状态
            this.isRunning = true;
            this.startTime = Date.now();

            // 启动健康检查
            console.log('💓 启动健康检查...');
            this.startHealthCheck();
            console.log('✅ 健康检查启动成功');

            // 记录策略状态
            this.logger.strategyStatus('started', {
                timestamp: new Date().toISOString(),
                config: this.config.getStrategyParams()
            });

            console.log('\n🎉 策略启动成功！');
            console.log('─'.repeat(40));
            console.log(`📅 启动时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`🏢 交易所: ${this.config.get('exchange').name}`);
            console.log(`💰 交易对: ${this.config.get('symbol')}`);
            console.log(`⚙️ 更新间隔: ${this.config.get('updateInterval')}ms`);
            console.log('─'.repeat(40));
            console.log('📊 策略正在运行中...');
            console.log('按 Ctrl+C 停止策略\n');
            
            this.logger.info('策略启动成功');

        } catch (error) {
            this.isRunning = false;
            this.logger.errorWithStack('策略启动失败', error);
            
            console.error('\n❌ 策略启动失败:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            throw error;
        }
    }

    /**
     * 停止策略
     */
    async stop() {
        try {
            if (!this.isRunning || this.isShuttingDown) {
                this.logger.warn('策略未在运行或正在关闭中');
                console.log('⚠️ 策略未在运行或正在关闭中');
                return;
            }

            this.isShuttingDown = true;
            console.log('\n🛑 开始停止策略...\n');
            this.logger.info('停止策略');

            // 停止健康检查
            console.log('💓 停止健康检查...');
            try {
                this.stopHealthCheck();
                console.log('✅ 健康检查已停止');
            } catch (error) {
                console.log('⚠️ 停止健康检查时出错:', error.message);
            }

            // 停止策略
            if (this.strategy) {
                console.log('🎯 停止策略算法...');
                await this.strategy.stop();
                console.log('✅ 策略算法已停止');
            }

            // 标记为停止状态
            this.isRunning = false;
            this.isShuttingDown = false;

            // 记录策略状态
            const uptime = this.startTime ? Date.now() - this.startTime : 0;
            this.logger.strategyStatus('stopped', {
                timestamp: new Date().toISOString(),
                uptime: uptime
            });

            console.log('\n✅ 策略停止成功！');
            console.log('─'.repeat(40));
            console.log(`📅 停止时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`⏱️ 运行时长: ${Math.round(uptime / 1000)}秒`);
            console.log('─'.repeat(40) + '\n');
            
            this.logger.info('策略停止成功');

        } catch (error) {
            this.logger.errorWithStack('策略停止失败', error);
            
            console.error('\n❌ 策略停止失败:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            throw error;
        }
    }

    /**
     * 启动健康检查
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('健康检查失败', error);
            }
        }, 30000); // 每30秒检查一次
    }

    /**
     * 停止健康检查
     */
    stopHealthCheck() {
        try {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
                if (this.logger) {
                    this.logger.info('健康检查已停止');
                }
            }
        } catch (error) {
            if (this.logger) {
                this.logger.error('停止健康检查时出错', error);
            } else {
                console.error('停止健康检查时出错:', error.message);
            }
        }
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        try {
            // 检查策略状态
            if (this.strategy) {
                const strategyStatus = this.strategy.getStatus();
                if (!strategyStatus.isRunning) {
                    this.logger.warn('策略状态异常', strategyStatus);
                }
            }

            // 记录内存使用
            if (this.logger && this.logger.memoryUsage) {
                this.logger.memoryUsage();
            }

            // 记录系统状态
            if (this.logger && this.logger.systemStatus) {
                this.logger.systemStatus('healthy', {
                    uptime: this.startTime ? Date.now() - this.startTime : 0,
                    strategyRunning: this.isRunning
                });
            }

        } catch (error) {
            this.logger.error('健康检查异常', error);
        }
    }

    /**
     * 优雅关闭
     */
    async gracefulShutdown(signal) {
        console.log(`\n🛑 收到信号 ${signal}，正在优雅关闭...`);
        console.log('─'.repeat(40));
        
        try {
            // 停止策略
            await this.stop();
            
            // 清理资源
            console.log('🧹 清理资源...');
            this.cleanup();
            console.log('✅ 资源清理完成');
            
            console.log('✅ 优雅关闭完成');
            console.log('─'.repeat(40));
            process.exit(0);
        } catch (error) {
            console.error('❌ 优雅关闭失败:', error.message);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            process.exit(1);
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            // 停止健康检查
            this.stopHealthCheck();
        } catch (error) {
            console.error('清理健康检查时出错:', error.message);
        }
        
        try {
            // 清理配置监听器
            if (this.config && this.config.watchers) {
                this.config.watchers.clear();
            }
        } catch (error) {
            console.error('清理配置监听器时出错:', error.message);
        }
        
        try {
            // 清理日志
            if (this.logger && this.logger.clearPerformanceMetrics) {
                this.logger.clearPerformanceMetrics();
            }
        } catch (error) {
            console.error('清理日志时出错:', error.message);
        }
    }

    /**
     * 获取策略状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isShuttingDown: this.isShuttingDown,
            startTime: this.startTime,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            config: this.config ? this.config.getConfigSummary() : null,
            strategy: this.strategy ? this.strategy.getStatus() : null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 重启策略
     */
    async restart() {
        try {
            console.log('\n🔄 开始重启策略...\n');
            this.logger.info('重启策略');
            
            await this.stop();
            await this.start();
            
            this.logger.info('策略重启成功');
            console.log('✅ 策略重启成功\n');
        } catch (error) {
            this.logger.error('策略重启失败', error);
            
            console.error('\n❌ 策略重启失败:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (this.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            throw error;
        }
    }
}

// 主函数

async function main() {
    const strategy = new AvellanedaMarketMaking();
    
    // 强制退出处理
    let forceExitTimeout = null;
    const forceExit = () => {
        console.log('\n🛑 强制退出程序...');
        process.exit(1);
    };
    
    try {
        // 初始化策略
        await strategy.initialize();
        
        // 启动策略
        await strategy.start();
        
        // 保持程序运行
        console.log('📊 策略正在运行中...');
        console.log('按 Ctrl+C 停止策略');
        
        // 处理进程退出信号
        process.on('SIGINT', () => {
            console.log('\n🛑 收到SIGINT信号，开始优雅关闭...');
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 10000); // 10秒后强制退出
            strategy.gracefulShutdown('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 收到SIGTERM信号，开始优雅关闭...');
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 10000); // 10秒后强制退出
            strategy.gracefulShutdown('SIGTERM');
        });
        
        // 处理未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('\n❌ 未捕获的异常:');
            console.error(`   错误类型: ${error.constructor.name}`);
            console.error(`   错误信息: ${error.message}`);
            
            if (strategy.debugMode && error.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 5000); // 5秒后强制退出
            strategy.gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('\n❌ 未处理的Promise拒绝:');
            console.error(`   原因: ${reason}`);
            console.error(`   Promise: ${promise}`);
            
            if (strategy.debugMode && reason instanceof Error && reason.stack) {
                console.error('\n📚 错误堆栈:');
                console.error(reason.stack);
            }
            
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 5000); // 5秒后强制退出
            strategy.gracefulShutdown('unhandledRejection');
        });
        
    } catch (error) {
        console.error('\n❌ 程序运行失败:');
        console.error(`   错误类型: ${error.constructor.name}`);
        console.error(`   错误信息: ${error.message}`);
        
        // 如果是网络连接问题，提供详细的解决建议
        if (error.message.includes('网络连接测试失败')) {
            console.log('\n🔧 网络连接问题解决方案:');
            console.log('─'.repeat(50));
            console.log('1. 检查网络连接是否正常');
            console.log('2. 如果使用VPN，确保VPN连接稳定');
            console.log('3. 配置代理服务器:');
            console.log('   - 在 .env 文件中添加代理配置');
            console.log('   - 运行 node test-network-advanced.js 测试网络');
            console.log('4. 查看详细配置指南: docs/NETWORK_SETUP.md');
            console.log('─'.repeat(50));
            console.log('\n💡 建议先运行网络测试:');
            console.log('   node test-network-advanced.js');
        }
        
        // 如果是配置问题，提供配置检查建议
        if (error.message.includes('配置验证失败') || error.message.includes('请配置有效的')) {
            console.log('\n🔧 配置问题解决方案:');
            console.log('─'.repeat(50));
            console.log('1. 检查 .env 文件是否存在且格式正确');
            console.log('2. 确保所有必需的配置项都已填写');
            console.log('3. 验证API密钥、密钥和Passphrase是否正确');
            console.log('4. 检查交易对格式是否正确 (如: BTC/USDT)');
            console.log('5. 查看配置示例: env.example');
            console.log('─'.repeat(50));
        }
        
        // 如果是其他错误，提供通用调试建议
        if (strategy.debugMode) {
            console.log('\n🔧 调试建议:');
            console.log('─'.repeat(50));
            console.log('1. 启用调试模式: DEBUG=true node index.js');
            console.log('2. 查看详细日志: logs/strategy.log');
            console.log('3. 检查错误日志: logs/error-*.log');
            console.log('4. 运行单元测试: node test/*.js');
            console.log('─'.repeat(50));
        }
        
        process.exit(1);
    }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    main();
}

module.exports = AvellanedaMarketMaking; 