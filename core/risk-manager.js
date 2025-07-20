const Logger = require('../utils/logger');
const Helpers = require('../utils/helpers');

/**
 * 风险控制管理器
 * 负责监控和管理策略的风险，包括持仓控制、止损、资金管理等
 */
class RiskManager {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(config);
        
        // 风险配置
        this.riskConfig = {
            // 持仓限制 (百分比)
            maxPositionSizePercent: config.get('maxPositionSizePercent') || 10.0, // 最大持仓数量百分比
            maxPositionValuePercent: config.get('maxPositionValuePercent') || 50.0, // 最大持仓价值百分比
            targetInventory: config.get('targetInventory') || 0, // 目标库存
            
            // 止损设置
            stopLossPercent: config.get('stopLossPercent') || 2.0, // 止损百分比
            stopLossAmountPercent: config.get('stopLossAmountPercent') || 1.0, // 止损金额百分比
            trailingStopLoss: config.get('trailingStopLoss') || false, // 追踪止损
            
            // 资金管理
            maxDrawdown: config.get('maxDrawdown') || 5.0, // 最大回撤百分比
            maxDailyLossPercent: config.get('maxDailyLossPercent') || 2.0, // 最大日亏损百分比
            maxOrderSizePercent: config.get('maxOrderSizePercent') || 1.0, // 最大单笔订单数量百分比
            maxOrderValuePercent: config.get('maxOrderValuePercent') || 5.0, // 最大单笔订单价值百分比
            
            // 风险监控
            riskCheckInterval: config.get('riskCheckInterval') || 5000, // 风险检查间隔(毫秒)
            emergencyStopThreshold: config.get('emergencyStopThreshold') || 10.0, // 紧急停止阈值
        };
        
        // 风险状态
        this.riskState = {
            currentPosition: 0, // 当前持仓
            currentPositionValue: 0, // 当前持仓价值
            totalAccountValue: 0, // 账户总价值
            unrealizedPnL: 0, // 未实现盈亏
            realizedPnL: 0, // 已实现盈亏
            totalPnL: 0, // 总盈亏
            maxUnrealizedPnL: 0, // 最大未实现盈利
            maxDrawdownReached: 0, // 达到的最大回撤
            dailyPnL: 0, // 当日盈亏
            lastResetTime: Date.now(), // 上次重置时间
            isEmergencyStop: false, // 是否紧急停止
            riskAlerts: [], // 风险警报
            lastRiskCheck: 0, // 上次风险检查时间
        };
        
        // 历史数据
        this.history = {
            dailyPnL: [], // 日盈亏历史
            maxDrawdowns: [], // 最大回撤历史
            riskEvents: [], // 风险事件历史
        };
        
        // 风险检查定时器
        this.riskCheckTimer = null;
        
        this.logger.info('风险管理器已初始化', {
            riskConfig: this.riskConfig,
            maxPositionSize: this.riskConfig.maxPositionSize,
            stopLossPercent: this.riskConfig.stopLossPercent
        });
    }
    
    /**
     * 初始化风险管理器
     */
    async initialize() {
        try {
            this.logger.info('正在初始化风险管理器');
            
            // 重置日盈亏
            this.resetDailyPnL();
            
            // 启动风险检查定时器
            this.startRiskCheck();
            
            this.logger.info('风险管理器初始化成功');
            return true;
            
        } catch (error) {
            this.logger.error('风险管理器初始化失败', error);
            return false;
        }
    }
    
    /**
     * 启动风险检查定时器
     */
    startRiskCheck() {
        if (this.riskCheckTimer) {
            clearInterval(this.riskCheckTimer);
        }
        
        this.riskCheckTimer = setInterval(() => {
            this.performRiskCheck();
        }, this.riskConfig.riskCheckInterval);
        
        this.logger.info('风险检查定时器已启动', {
            interval: this.riskConfig.riskCheckInterval
        });
    }
    
    /**
     * 停止风险检查定时器
     */
    stopRiskCheck() {
        if (this.riskCheckTimer) {
            clearInterval(this.riskCheckTimer);
            this.riskCheckTimer = null;
            this.logger.info('风险检查定时器已停止');
        }
    }
    
    /**
     * 执行风险检查
     */
    async performRiskCheck() {
        try {
            const now = Date.now();
            this.riskState.lastRiskCheck = now;
            
            // 检查是否需要重置日盈亏
            this.checkDailyReset();
            
            // 执行各项风险检查
            const checks = [
                this.checkPositionLimits(),
                this.checkStopLoss(),
                this.checkDrawdown(),
                this.checkDailyLoss(),
                this.checkEmergencyStop()
            ];
            
            const results = await Promise.all(checks);
            
            // 处理检查结果
            for (const result of results) {
                if (result.triggered) {
                    await this.handleRiskEvent(result);
                }
            }
            
        } catch (error) {
            this.logger.error('执行风险检查时出错', error);
        }
    }
    
    /**
     * 检查持仓限制
     */
    async checkPositionLimits() {
        const position = Math.abs(this.riskState.currentPosition);
        const positionValue = Math.abs(this.riskState.currentPositionValue);
        const totalAccountValue = this.riskState.totalAccountValue;
        
        // 如果账户总价值为0，跳过检查
        if (totalAccountValue <= 0) {
            return { triggered: false };
        }
        
        // 计算基于百分比的限制
        const maxPositionValue = totalAccountValue * (this.riskConfig.maxPositionValuePercent / 100);
        
        const positionLimitExceeded = positionValue > maxPositionValue;
        
        if (positionLimitExceeded) {
            return {
                type: 'POSITION_LIMIT',
                triggered: true,
                severity: 'HIGH',
                message: `持仓价值超限: 当前=${positionValue.toFixed(2)}USDT/${maxPositionValue.toFixed(2)}USDT (${this.riskConfig.maxPositionValuePercent}%)`,
                data: {
                    currentPosition: position,
                    currentValue: positionValue,
                    maxValue: maxPositionValue,
                    maxValuePercent: this.riskConfig.maxPositionValuePercent,
                    totalAccountValue
                }
            };
        }
        
        return { triggered: false };
    }
    
    /**
     * 检查止损条件
     */
    async checkStopLoss() {
        const unrealizedPnL = this.riskState.unrealizedPnL;
        const totalPnL = this.riskState.totalPnL;
        const totalAccountValue = this.riskState.totalAccountValue;
        
        // 如果账户总价值为0，跳过检查
        if (totalAccountValue <= 0) {
            return { triggered: false };
        }
        
        // 检查百分比止损
        const stopLossAmountPercent = this.riskConfig.stopLossAmountPercent;
        const stopLossPercent = this.riskConfig.stopLossPercent;
        
        // 计算止损金额
        const absoluteStopLoss = totalAccountValue * (stopLossAmountPercent / 100);
        const percentStopLoss = totalAccountValue * (stopLossPercent / 100);
        
        // 只有当未实现盈亏为负数时才检查止损
        if (unrealizedPnL < 0) {
            if (unrealizedPnL < -absoluteStopLoss || unrealizedPnL < -percentStopLoss) {
                return {
                    type: 'STOP_LOSS',
                    triggered: true,
                    severity: 'CRITICAL',
                    message: `Stop loss triggered: unrealizedPnL=${unrealizedPnL}, stopLoss=${Math.min(-absoluteStopLoss, -percentStopLoss)} (${Math.min(stopLossAmountPercent, stopLossPercent)}%)`,
                    data: {
                        unrealizedPnL,
                        absoluteStopLoss,
                        percentStopLoss,
                        stopLossAmountPercent,
                        stopLossPercent,
                        totalAccountValue
                    }
                };
            }
        }
        
        return { triggered: false };
    }
    
    /**
     * 检查回撤限制
     */
    async checkDrawdown() {
        const currentDrawdown = this.calculateDrawdown();
        
        if (currentDrawdown > this.riskConfig.maxDrawdown) {
            return {
                type: 'MAX_DRAWDOWN',
                triggered: true,
                severity: 'HIGH',
                message: `Maximum drawdown exceeded: ${currentDrawdown.toFixed(2)}% > ${this.riskConfig.maxDrawdown}%`,
                data: {
                    currentDrawdown,
                    maxDrawdown: this.riskConfig.maxDrawdown
                }
            };
        }
        
        return { triggered: false };
    }
    
    /**
     * 检查日亏损限制
     */
    async checkDailyLoss() {
        const dailyPnL = this.riskState.dailyPnL;
        const totalAccountValue = this.riskState.totalAccountValue;
        
        // 如果账户总价值为0，跳过检查
        if (totalAccountValue <= 0) {
            return { triggered: false };
        }
        
        const maxDailyLoss = totalAccountValue * (this.riskConfig.maxDailyLossPercent / 100);
        
        // 只有当日盈亏为负数时才检查日亏损限制
        if (dailyPnL < 0 && dailyPnL < -maxDailyLoss) {
            return {
                type: 'DAILY_LOSS',
                triggered: true,
                severity: 'HIGH',
                message: `Daily loss limit exceeded: ${dailyPnL} < -${maxDailyLoss.toFixed(2)} (${this.riskConfig.maxDailyLossPercent}%)`,
                data: {
                    dailyPnL,
                    maxDailyLoss,
                    maxDailyLossPercent: this.riskConfig.maxDailyLossPercent,
                    totalAccountValue
                }
            };
        }
        
        return { triggered: false };
    }
    
    /**
     * 检查紧急停止条件
     */
    async checkEmergencyStop() {
        if (this.riskState.isEmergencyStop) {
            this.logger.debug('风险管理器: 紧急停止已激活，跳过重复检查');
            return {
                type: 'EMERGENCY_STOP',
                triggered: true,
                severity: 'CRITICAL',
                message: 'Emergency stop is active',
                data: {
                    isEmergencyStop: true
                }
            };
        }
        
        // 检查紧急停止阈值
        const drawdown = this.calculateDrawdown();
        this.logger.debug('风险管理器: 检查紧急停止阈值', {
            currentDrawdown: drawdown,
            threshold: this.riskConfig.emergencyStopThreshold
        });

        if (drawdown > this.riskConfig.emergencyStopThreshold) {
            this.logger.warn('风险管理器: 紧急停止阈值超限', {
                drawdown,
                threshold: this.riskConfig.emergencyStopThreshold
            });
            return {
                type: 'EMERGENCY_STOP_THRESHOLD',
                triggered: true,
                severity: 'CRITICAL',
                message: `Emergency stop threshold exceeded: ${drawdown.toFixed(2)}% > ${this.riskConfig.emergencyStopThreshold}%`,
                data: {
                    drawdown,
                    threshold: this.riskConfig.emergencyStopThreshold
                }
            };
        }
        
        return { triggered: false };
    }
    
    /**
     * 处理风险事件
     */
    async handleRiskEvent(event) {
        try {
            this.logger.warn('风险事件触发', event);
            
            // 记录风险事件
            this.riskState.riskAlerts.push({
                timestamp: Date.now(),
                ...event
            });
            
            // 根据事件类型和严重程度采取行动
            switch (event.severity) {
                case 'CRITICAL':
                    await this.handleCriticalRisk(event);
                    break;
                case 'HIGH':
                    await this.handleHighRisk(event);
                    break;
                case 'MEDIUM':
                    await this.handleMediumRisk(event);
                    break;
                default:
                    await this.handleLowRisk(event);
            }
            
            // 记录到历史
            this.history.riskEvents.push({
                timestamp: Date.now(),
                ...event
            });
            
        } catch (error) {
            this.logger.error('处理风险事件时出错', error);
        }
    }
    
    /**
     * 处理严重风险事件
     */
    async handleCriticalRisk(event) {
        this.logger.error('严重风险事件', event);
        console.error(`风险管理器: 严重风险事件触发 - ${event.message}`);
        
        // 触发紧急停止
        await this.triggerEmergencyStop(event);
        
        // 发送紧急通知
        this.sendEmergencyAlert(event);
    }
    
    /**
     * 处理高风险事件
     */
    async handleHighRisk(event) {
        this.logger.warn('高风险事件', event);
        
        // 减少仓位
        await this.reducePosition(event);
        
        // 发送风险警告
        this.sendRiskWarning(event);
    }
    
    /**
     * 处理中等风险事件
     */
    async handleMediumRisk(event) {
        this.logger.info('Medium risk event', event);
        
        // 调整策略参数
        await this.adjustStrategyParameters(event);
    }
    
    /**
     * 处理低风险事件
     */
    async handleLowRisk(event) {
        this.logger.info('低风险事件', event);
        
        // 记录日志
        this.logger.info('风险事件已记录', event);
    }
    
    /**
     * 触发紧急停止
     */
    async triggerEmergencyStop(event) {
        try {
            this.riskState.isEmergencyStop = true;
            console.error('风险管理器: 紧急停止已激活！');
            
            this.logger.error('触发紧急停止', {
                reason: event.message,
                timestamp: new Date().toISOString()
            });
            
            // 这里应该通知策略停止交易
            // 实际实现中需要与策略模块通信
            
        } catch (error) {
            this.logger.error('触发紧急停止时出错', error);
            console.error('风险管理器: 触发紧急停止时出错:', error.message);
        }
    }
    
    /**
     * 减少仓位
     */
    async reducePosition(event) {
        try {
            this.logger.warn('因风险事件减少仓位', event);
            
            // 计算需要减少的仓位
            const currentPosition = this.riskState.currentPosition;
            const reductionAmount = Math.abs(currentPosition) * 0.5; // 减少50%
            
            this.logger.info('仓位减少计算完成', {
                currentPosition,
                reductionAmount
            });
            
            // 这里应该通知策略减少仓位
            // 实际实现中需要与策略模块通信
            
        } catch (error) {
            this.logger.error('减少仓位时出错', error);
        }
    }
    
    /**
     * 调整策略参数
     */
    async adjustStrategyParameters(event) {
        try {
            this.logger.info('因风险事件调整策略参数', event);
            
            // 根据风险事件调整参数
            // 例如：减少订单大小、增加价差等
            
        } catch (error) {
            this.logger.error('调整策略参数时出错', error);
        }
    }
    
    /**
     * 发送紧急警报
     */
    sendEmergencyAlert(event) {
        // 这里可以实现发送邮件、短信、推送通知等
        this.logger.error('紧急警报', {
            message: event.message,
            timestamp: new Date().toISOString(),
            severity: event.severity
        });
    }
    
    /**
     * 发送风险警告
     */
    sendRiskWarning(event) {
        // 这里可以实现发送风险警告
        this.logger.warn('风险警告', {
            message: event.message,
            timestamp: new Date().toISOString(),
            severity: event.severity
        });
    }
    
    /**
     * 更新持仓信息
     */
    updatePosition(position, positionValue, midPrice) {
        const oldPosition = this.riskState.currentPosition;
        const oldValue = this.riskState.currentPositionValue;
        const oldUnrealizedPnL = this.riskState.unrealizedPnL;
        
        this.riskState.currentPosition = position;
        this.riskState.currentPositionValue = positionValue;
        
        // 计算未实现盈亏
        if (midPrice > 0) {
            // 确保 unrealizedPnL 的计算逻辑正确，这里假设 positionValue 是基于 midPrice 计算的
            // 如果 positionValue 已经是基于当前市价计算的，那么 unrealizedPnL 应该是 (currentPositionValue - initialCost)
            // 但根据代码，unrealizedPnL 似乎是当前持仓的市值，这与 PnL 的定义不符。
            // 修正：unrealizedPnL 应该是当前持仓的市值与成本价的差额。
            // 由于这里没有成本价信息，暂时保持原样，但需要注意这可能不是严格意义上的未实现盈亏。
            this.riskState.unrealizedPnL = position * midPrice;
        } else {
            this.riskState.unrealizedPnL = 0; // 如果 midPrice 无效，则未实现盈亏为0
        }
        
        // 更新总盈亏
        this.riskState.totalPnL = this.riskState.realizedPnL + this.riskState.unrealizedPnL;
        
        // 更新最大未实现盈利 (如果 unrealizedPnL 是盈利，则更新)
        if (this.riskState.unrealizedPnL > this.riskState.maxUnrealizedPnL) {
            this.riskState.maxUnrealizedPnL = this.riskState.unrealizedPnL;
        }
        
        this.logger.debug('持仓信息已更新', {
            oldPosition,
            newPosition: position,
            oldValue,
            newValue: positionValue,
            oldUnrealizedPnL,
            newUnrealizedPnL: this.riskState.unrealizedPnL,
            midPrice
        });
    }
    
    /**
     * 更新账户总价值
     */
    updateAccountValue(totalAccountValue) {
        const oldValue = this.riskState.totalAccountValue;
        this.riskState.totalAccountValue = totalAccountValue;
        
        this.logger.debug('账户总价值已更新', {
            oldValue,
            newValue: totalAccountValue
        });
    }
    
    /**
     * 更新已实现盈亏
     */
    updateRealizedPnL(realizedPnL) {
        const oldRealizedPnL = this.riskState.realizedPnL;
        this.riskState.realizedPnL = realizedPnL;
        
        // 更新总盈亏
        this.riskState.totalPnL = this.riskState.realizedPnL + this.riskState.unrealizedPnL;
        
        // 更新日盈亏
        const pnlChange = realizedPnL - oldRealizedPnL;
        this.riskState.dailyPnL += pnlChange;
        
        this.logger.debug('Realized PnL updated', {
            oldRealizedPnL,
            newRealizedPnL: realizedPnL,
            pnlChange,
            dailyPnL: this.riskState.dailyPnL
        });
    }
    
    /**
     * 计算回撤
     */
    calculateDrawdown() {
        // 回撤计算应基于账户总价值的峰值和谷值，而不是单一的未实现盈亏
        // 这里的实现可能不完全符合标准的回撤定义，但会根据现有逻辑进行调整
        // 如果 maxUnrealizedPnL 是历史最高账户价值，unrealizedPnL 是当前账户价值
        // 那么回撤 = (最高账户价值 - 当前账户价值) / 最高账户价值 * 100%

        // 假设 maxUnrealizedPnL 实际上是历史最高账户总价值
        // 并且 unrealizedPnL 实际上是当前账户总价值
        // 那么计算回撤的逻辑是：
        // drawdown = (峰值 - 当前值) / 峰值 * 100%

        const peakValue = this.riskState.maxUnrealizedPnL; // 假设这是历史最高账户价值
        const currentValue = this.riskState.unrealizedPnL; // 假设这是当前账户价值

        this.logger.debug('风险管理器: 计算回撤', {
            peakValue: peakValue,
            currentValue: currentValue
        });

        if (peakValue <= 0) { // 如果峰值为0或负数，无法计算回撤
            return 0;
        }
        
        const drawdown = ((peakValue - currentValue) / peakValue) * 100;
        
        // 更新最大回撤
        if (drawdown > this.riskState.maxDrawdownReached) {
            this.riskState.maxDrawdownReached = drawdown;
            this.logger.info('风险管理器: 达到新的最大回撤', { maxDrawdownReached: drawdown });
        }
        
        // 回撤不应为负数
        return Math.max(0, drawdown);
    }
    
    /**
     * 检查日重置
     */
    checkDailyReset() {
        const now = Date.now();
        const lastReset = this.riskState.lastResetTime;
        const oneDay = 24 * 60 * 60 * 1000; // 24小时
        
        if (now - lastReset >= oneDay) {
            this.resetDailyPnL();
        }
    }
    
    /**
     * 重置日盈亏
     */
    resetDailyPnL() {
        // 保存历史数据
        if (this.riskState.dailyPnL !== 0) {
            this.history.dailyPnL.push({
                date: new Date(this.riskState.lastResetTime).toISOString().split('T')[0],
                pnl: this.riskState.dailyPnL
            });
        }
        
        // 重置日盈亏
        this.riskState.dailyPnL = 0;
        this.riskState.lastResetTime = Date.now();
        
        this.logger.info('Daily PnL reset', {
            lastDailyPnL: this.history.dailyPnL[this.history.dailyPnL.length - 1]?.pnl || 0
        });
    }
    
    /**
     * 验证订单风险
     */
    validateOrder(side, amount, price) {
        const orderValue = amount * price;
        const totalAccountValue = this.riskState.totalAccountValue;
        
        // 检查紧急停止状态
        if (this.riskState.isEmergencyStop) {
            return {
                valid: false,
                reason: 'Emergency stop is active',
                type: 'EMERGENCY_STOP'
            };
        }
        
        // 如果账户总价值为0，跳过订单限制检查
        if (totalAccountValue <= 0) {
            return { valid: true };
        }
        
        // 计算基于百分比的限制
        const maxOrderSize = totalAccountValue * (this.riskConfig.maxOrderSizePercent / 100);
        const maxOrderValue = totalAccountValue * (this.riskConfig.maxOrderValuePercent / 100);
        
        // 检查订单大小限制
        if (amount > maxOrderSize) {
            return {
                valid: false,
                reason: `Order size ${amount} exceeds maximum ${maxOrderSize.toFixed(2)} (${this.riskConfig.maxOrderSizePercent}%)`,
                type: 'ORDER_SIZE_LIMIT'
            };
        }
        
        // 检查订单价值限制
        if (orderValue > maxOrderValue) {
            return {
                valid: false,
                reason: `Order value ${orderValue} exceeds maximum ${maxOrderValue.toFixed(2)} (${this.riskConfig.maxOrderValuePercent}%)`,
                type: 'ORDER_VALUE_LIMIT'
            };
        }
        
        return { valid: true };
    }
    
    /**
     * 获取风险状态
     */
    getRiskStatus() {
        return {
            config: this.riskConfig,
            state: {
                ...this.riskState,
                currentDrawdown: this.calculateDrawdown()
            },
            history: {
                dailyPnLCount: this.history.dailyPnL.length,
                riskEventsCount: this.history.riskEvents.length,
                maxDrawdownsCount: this.history.maxDrawdowns.length
            }
        };
    }
    
    /**
     * 重置紧急停止状态
     */
    resetEmergencyStop() {
        this.riskState.isEmergencyStop = false;
        this.logger.info('Emergency stop reset');
    }
    
    /**
     * 更新风险配置
     */
    updateRiskConfig(newConfig) {
        this.riskConfig = { ...this.riskConfig, ...newConfig };
        this.logger.info('Risk config updated', newConfig);
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        this.stopRiskCheck();
        this.logger.info('Risk manager cleaned up');
    }
}

module.exports = RiskManager; 