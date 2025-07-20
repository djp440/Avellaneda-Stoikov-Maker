const fs = require('fs');
const path = require('path');

/**
 * 程序卡住问题修复器
 * 修复可能导致程序卡住且无法退出的问题
 */
class HangIssueFixer {
    constructor() {
        this.fixes = [];
        this.backupDir = 'backup_' + new Date().toISOString().replace(/[:.]/g, '-');
    }

    /**
     * 创建备份
     */
    createBackup() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            
            const filesToBackup = [
                'index.js',
                'core/strategy.js',
                'core/exchange.js',
                'core/network-manager.js',
                'core/risk-manager.js',
                'utils/logger.js'
            ];
            
            filesToBackup.forEach(file => {
                if (fs.existsSync(file)) {
                    const backupPath = path.join(this.backupDir, file);
                    const backupDir = path.dirname(backupPath);
                    
                    if (!fs.existsSync(backupDir)) {
                        fs.mkdirSync(backupDir, { recursive: true });
                    }
                    
                    fs.copyFileSync(file, backupPath);
                }
            });
            
            console.log(`✅ 备份已创建到: ${this.backupDir}`);
            return true;
        } catch (error) {
            console.error('❌ 创建备份失败:', error.message);
            return false;
        }
    }

    /**
     * 修复1: 为主循环添加超时保护
     */
    fixMainLoopTimeout() {
        console.log('\n🔧 修复1: 为主循环添加超时保护...');
        
        try {
            const strategyFile = 'core/strategy.js';
            let content = fs.readFileSync(strategyFile, 'utf8');
            
            // 查找mainLoop方法
            const mainLoopPattern = /async mainLoop\(\) \{[\s\S]*?while \(this\.isRunning\) \{[\s\S]*?\}/;
            const match = content.match(mainLoopPattern);
            
            if (match) {
                // 添加超时保护
                const timeoutFix = `
    async mainLoop() {
        const loopTimeout = 30000; // 30秒超时
        let lastLoopTime = Date.now();
        
        while (this.isRunning) {
            try {
                // 检查循环超时
                const currentTime = Date.now();
                if (currentTime - lastLoopTime > loopTimeout) {
                    this.logger.warn('主循环超时，重新开始循环');
                    lastLoopTime = currentTime;
                }
                
                // 检查风险状态
                const riskStatus = this.riskManager.getRiskStatus();
                if (riskStatus.state.isEmergencyStop) {
                    this.logger.warn('策略因紧急停止而暂停');
                    await this.sleep(10000); // 紧急停止时等待更长时间
                    continue;
                }
                
                // 检查指标是否准备就绪
                if (this.indicators.isReady()) {
                    // 执行策略逻辑
                    await this.executeStrategy();
                } else {
                    this.logger.debug('技术指标尚未准备就绪', this.indicators.getStatus());
                }
                
                // 更新循环时间
                lastLoopTime = Date.now();
                
                // 等待下一次更新
                await this.sleep(this.config.get('updateInterval') || 1000);
                
            } catch (error) {
                this.logger.error('主循环执行出错', error);
                await this.sleep(5000); // 错误时等待更长时间
            }
        }
    }`;
                
                content = content.replace(mainLoopPattern, timeoutFix);
                fs.writeFileSync(strategyFile, content, 'utf8');
                
                this.fixes.push('主循环超时保护');
                console.log('✅ 主循环超时保护已添加');
            } else {
                console.log('⚠️  未找到mainLoop方法，跳过此修复');
            }
        } catch (error) {
            console.error('❌ 修复主循环超时失败:', error.message);
        }
    }

    /**
     * 修复2: 为网络连接添加超时保护
     */
    fixNetworkTimeout() {
        console.log('\n🔧 修复2: 为网络连接添加超时保护...');
        
        try {
            const networkFile = 'core/network-manager.js';
            let content = fs.readFileSync(networkFile, 'utf8');
            
            // 查找testConnection方法
            const testConnectionPattern = /async testConnection\(url\) \{[\s\S]*?\}/;
            const match = content.match(testConnectionPattern);
            
            if (match) {
                // 添加更严格的超时保护
                const timeoutFix = `
    async testConnection(url) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timeout = Math.min(this.connectionConfig.timeout, 5000); // 最大5秒超时
            
            const options = {
                hostname: new URL(url).hostname,
                port: new URL(url).port || (url.startsWith('https') ? 443 : 80),
                path: new URL(url).pathname,
                method: 'GET',
                timeout: timeout
            };
            
            // 添加代理配置
            if (this.proxyConfig.enabled) {
                options.host = this.proxyConfig.host;
                options.port = this.proxyConfig.port;
                options.path = url;
                
                if (this.proxyConfig.auth) {
                    const auth = Buffer.from(
                        \`\${this.proxyConfig.auth.username}:\${this.proxyConfig.auth.password}\`
                    ).toString('base64');
                    options.headers = {
                        'Proxy-Authorization': \`Basic \${auth}\`
                    };
                }
            }
            
            const client = url.startsWith('https') ? https : http;
            
            // 添加连接超时
            const connectionTimeout = setTimeout(() => {
                req.destroy();
                resolve({
                    url,
                    success: false,
                    latency: timeout,
                    error: 'connection_timeout'
                });
            }, timeout);
            
            const req = client.request(options, (res) => {
                clearTimeout(connectionTimeout);
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                resolve({
                    url,
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    latency,
                    statusCode: res.statusCode
                });
            });
            
            req.on('error', (error) => {
                clearTimeout(connectionTimeout);
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                resolve({
                    url,
                    success: false,
                    latency,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                clearTimeout(connectionTimeout);
                req.destroy();
                resolve({
                    url,
                    success: false,
                    latency: timeout,
                    error: 'timeout'
                });
            });
            
            req.end();
        });
    }`;
                
                content = content.replace(testConnectionPattern, timeoutFix);
                fs.writeFileSync(networkFile, content, 'utf8');
                
                this.fixes.push('网络连接超时保护');
                console.log('✅ 网络连接超时保护已添加');
            } else {
                console.log('⚠️  未找到testConnection方法，跳过此修复');
            }
        } catch (error) {
            console.error('❌ 修复网络超时失败:', error.message);
        }
    }

    /**
     * 修复3: 为交易所API调用添加超时保护
     */
    fixExchangeTimeout() {
        console.log('\n🔧 修复3: 为交易所API调用添加超时保护...');
        
        try {
            const exchangeFile = 'core/exchange.js';
            let content = fs.readFileSync(exchangeFile, 'utf8');
            
            // 查找updateOrderBook方法
            const updateOrderBookPattern = /async updateOrderBook\(\) \{[\s\S]*?\}/;
            const match = content.match(updateOrderBookPattern);
            
            if (match) {
                // 添加超时保护
                const timeoutFix = `
    async updateOrderBook() {
        try {
            if (!this.isConnected || !this.exchange) {
                return;
            }

            const symbol = this.config.get('symbol');
            
            // 添加超时保护
            const orderBookPromise = this.exchange.fetchOrderBook(symbol);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Order book fetch timeout')), 10000);
            });
            
            const orderBook = await Promise.race([orderBookPromise, timeoutPromise]);
            
            // 验证订单簿数据
            if (!orderBook || !orderBook.bids || !orderBook.asks) {
                this.logger.warn('Invalid order book data received');
                return;
            }

            this.marketData.orderBook = orderBook;
            this.marketData.lastUpdate = Date.now();

            // 计算中间价
            const midPrice = Helpers.calculateMidPrice(
                orderBook.bids[0][0], 
                orderBook.asks[0][0]
            );

            const orderBookData = {
                symbol,
                bids: orderBook.bids,
                asks: orderBook.asks,
                midPrice,
                timestamp: orderBook.timestamp,
                datetime: orderBook.datetime
            };

            this.emit('orderBookUpdate', orderBookData);
            
        } catch (error) {
            this.logger.error('Failed to update order book', error);
            this.handleConnectionError(error);
        }
    }`;
                
                content = content.replace(updateOrderBookPattern, timeoutFix);
                fs.writeFileSync(exchangeFile, content, 'utf8');
                
                this.fixes.push('交易所API超时保护');
                console.log('✅ 交易所API超时保护已添加');
            } else {
                console.log('⚠️  未找到updateOrderBook方法，跳过此修复');
            }
        } catch (error) {
            console.error('❌ 修复交易所超时失败:', error.message);
        }
    }

    /**
     * 修复4: 改进进程退出处理
     */
    fixProcessExitHandling() {
        console.log('\n🔧 修复4: 改进进程退出处理...');
        
        try {
            const indexFile = 'index.js';
            let content = fs.readFileSync(indexFile, 'utf8');
            
            // 查找main函数
            const mainPattern = /async function main\(\) \{[\s\S]*?\}/;
            const match = content.match(mainPattern);
            
            if (match) {
                // 添加更强大的进程退出处理
                const exitFix = `
async function main() {
    const strategy = new AvellanedaMarketMaking();
    
    // 强制退出处理
    let forceExitTimeout = null;
    const forceExit = () => {
        console.log('\\n🛑 强制退出程序...');
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
            console.log('\\n🛑 收到SIGINT信号，开始优雅关闭...');
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 10000); // 10秒后强制退出
            strategy.gracefulShutdown('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\\n🛑 收到SIGTERM信号，开始优雅关闭...');
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 10000); // 10秒后强制退出
            strategy.gracefulShutdown('SIGTERM');
        });
        
        // 处理未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('\\n❌ 未捕获的异常:');
            console.error(\`   错误类型: \${error.constructor.name}\`);
            console.error(\`   错误信息: \${error.message}\`);
            
            if (strategy.debugMode && error.stack) {
                console.error('\\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 5000); // 5秒后强制退出
            strategy.gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('\\n❌ 未处理的Promise拒绝:');
            console.error(\`   原因: \${reason}\`);
            console.error(\`   Promise: \${promise}\`);
            
            if (strategy.debugMode && reason instanceof Error && reason.stack) {
                console.error('\\n📚 错误堆栈:');
                console.error(reason.stack);
            }
            
            clearTimeout(forceExitTimeout);
            forceExitTimeout = setTimeout(forceExit, 5000); // 5秒后强制退出
            strategy.gracefulShutdown('unhandledRejection');
        });
        
    } catch (error) {
        console.error('\\n❌ 程序运行失败:');
        console.error(\`   错误类型: \${error.constructor.name}\`);
        console.error(\`   错误信息: \${error.message}\`);
        
        // 如果是网络连接问题，提供详细的解决建议
        if (error.message.includes('网络连接测试失败')) {
            console.log('\\n🔧 网络连接问题解决方案:');
            console.log('─'.repeat(50));
            console.log('1. 检查网络连接是否正常');
            console.log('2. 如果使用VPN，确保VPN连接稳定');
            console.log('3. 配置代理服务器:');
            console.log('   - 在 .env 文件中添加代理配置');
            console.log('   - 运行 node test-network-advanced.js 测试网络');
            console.log('4. 查看详细配置指南: docs/NETWORK_SETUP.md');
            console.log('─'.repeat(50));
            console.log('\\n💡 建议先运行网络测试:');
            console.log('   node test-network-advanced.js');
        }
        
        // 如果是配置问题，提供配置检查建议
        if (error.message.includes('配置验证失败') || error.message.includes('请配置有效的')) {
            console.log('\\n🔧 配置问题解决方案:');
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
            console.log('\\n🔧 调试建议:');
            console.log('─'.repeat(50));
            console.log('1. 启用调试模式: DEBUG=true node index.js');
            console.log('2. 查看详细日志: logs/strategy.log');
            console.log('3. 检查错误日志: logs/error-*.log');
            console.log('4. 运行单元测试: node test/*.js');
            console.log('─'.repeat(50));
        }
        
        process.exit(1);
    }
}`;
                
                content = content.replace(mainPattern, exitFix);
                fs.writeFileSync(indexFile, content, 'utf8');
                
                this.fixes.push('进程退出处理改进');
                console.log('✅ 进程退出处理已改进');
            } else {
                console.log('⚠️  未找到main函数，跳过此修复');
            }
        } catch (error) {
            console.error('❌ 修复进程退出处理失败:', error.message);
        }
    }

    /**
     * 修复5: 添加定时器清理保护
     */
    fixTimerCleanup() {
        console.log('\n🔧 修复5: 添加定时器清理保护...');
        
        try {
            const strategyFile = 'core/strategy.js';
            let content = fs.readFileSync(strategyFile, 'utf8');
            
            // 查找stop方法
            const stopPattern = /async stop\(\) \{[\s\S]*?\}/;
            const match = content.match(stopPattern);
            
            if (match) {
                // 添加定时器清理保护
                const cleanupFix = `
    async stop() {
        try {
            if (!this.isRunning || this.isShuttingDown) {
                this.logger.warn('策略未在运行或正在关闭中');
                console.log('⚠️ 策略未在运行或正在关闭中');
                return;
            }

            this.isShuttingDown = true;
            console.log('\\n🛑 开始停止策略...\\n');
            this.logger.info('停止策略');

            // 停止健康检查
            console.log('💓 停止健康检查...');
            this.stopHealthCheck();
            console.log('✅ 健康检查已停止');

            // 停止策略
            if (this.strategy) {
                console.log('🎯 停止策略算法...');
                await this.strategy.stop();
                console.log('✅ 策略算法已停止');
            }

            // 清理交易所连接
            if (this.exchangeManager) {
                console.log('🏢 清理交易所连接...');
                await this.exchangeManager.close();
                console.log('✅ 交易所连接已清理');
            }

            // 清理网络管理器
            if (this.networkManager) {
                console.log('🌐 清理网络管理器...');
                this.networkManager.close();
                console.log('✅ 网络管理器已清理');
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

            console.log('\\n✅ 策略停止成功！');
            console.log('─'.repeat(40));
            console.log(\`📅 停止时间: \${new Date().toLocaleString('zh-CN')}\`);
            console.log(\`⏱️ 运行时长: \${Math.round(uptime / 1000)}秒\`);
            console.log('─'.repeat(40) + '\\n');
            
            this.logger.info('策略停止成功');

        } catch (error) {
            this.logger.errorWithStack('策略停止失败', error);
            
            console.error('\\n❌ 策略停止失败:');
            console.error(\`   错误类型: \${error.constructor.name}\`);
            console.error(\`   错误信息: \${error.message}\`);
            
            if (this.debugMode && error.stack) {
                console.error('\\n📚 错误堆栈:');
                console.error(error.stack);
            }
            
            // 强制清理
            this.forceCleanup();
            
            throw error;
        }
    }

    /**
     * 强制清理资源
     */
    forceCleanup() {
        try {
            // 强制停止所有定时器
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            // 强制停止策略
            this.isRunning = false;
            this.isShuttingDown = false;
            
            console.log('🧹 强制清理完成');
        } catch (error) {
            console.error('❌ 强制清理失败:', error.message);
        }
    }`;
                
                content = content.replace(stopPattern, cleanupFix);
                fs.writeFileSync(strategyFile, content, 'utf8');
                
                this.fixes.push('定时器清理保护');
                console.log('✅ 定时器清理保护已添加');
            } else {
                console.log('⚠️  未找到stop方法，跳过此修复');
            }
        } catch (error) {
            console.error('❌ 修复定时器清理失败:', error.message);
        }
    }

    /**
     * 运行所有修复
     */
    async runAllFixes() {
        console.log('🚀 开始修复程序卡住问题...\n');
        
        // 创建备份
        if (!this.createBackup()) {
            console.log('❌ 备份创建失败，停止修复');
            return;
        }
        
        try {
            this.fixMainLoopTimeout();
            this.fixNetworkTimeout();
            this.fixExchangeTimeout();
            this.fixProcessExitHandling();
            this.fixTimerCleanup();
            
        } catch (error) {
            console.error('❌ 修复过程中发生错误:', error.message);
        }
        
        this.printResults();
    }

    /**
     * 打印修复结果
     */
    printResults() {
        console.log('\n📊 修复结果汇总:');
        console.log('─'.repeat(60));
        
        if (this.fixes.length > 0) {
            this.fixes.forEach(fix => {
                console.log(`✅ ${fix}`);
            });
            
            console.log('─'.repeat(60));
            console.log(`总计: ${this.fixes.length} 项修复`);
            
            console.log('\n🔧 修复内容说明:');
            console.log('1. 主循环超时保护 - 防止主循环无限执行');
            console.log('2. 网络连接超时保护 - 防止网络请求阻塞');
            console.log('3. 交易所API超时保护 - 防止API调用阻塞');
            console.log('4. 进程退出处理改进 - 确保程序能够正常退出');
            console.log('5. 定时器清理保护 - 防止定时器泄漏');
            
            console.log('\n💡 建议:');
            console.log('1. 运行测试脚本验证修复效果: node test/test_hang_detection.js');
            console.log('2. 如果问题仍然存在，可以恢复备份: cp -r backup_*/* .');
            console.log('3. 检查网络连接和代理设置');
            console.log('4. 确保.env文件配置正确');
            
        } else {
            console.log('⚠️  没有应用任何修复');
        }
    }

    /**
     * 恢复备份
     */
    restoreBackup() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                console.log('❌ 备份目录不存在');
                return false;
            }
            
            const filesToRestore = [
                'index.js',
                'core/strategy.js',
                'core/exchange.js',
                'core/network-manager.js',
                'core/risk-manager.js',
                'utils/logger.js'
            ];
            
            filesToRestore.forEach(file => {
                const backupPath = path.join(this.backupDir, file);
                if (fs.existsSync(backupPath)) {
                    fs.copyFileSync(backupPath, file);
                    console.log(`✅ 已恢复: ${file}`);
                }
            });
            
            console.log('✅ 备份恢复完成');
            return true;
        } catch (error) {
            console.error('❌ 恢复备份失败:', error.message);
            return false;
        }
    }
}

// 主函数
async function main() {
    const fixer = new HangIssueFixer();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--restore')) {
        console.log('🔄 恢复备份...');
        fixer.restoreBackup();
    } else {
        await fixer.runAllFixes();
    }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    main();
}

module.exports = HangIssueFixer; 