/**
 * 策略核心模块 - 负责Avellaneda算法的核心逻辑计算
 */
class StrategyCore {
    constructor(strategy) {
        this.strategy = strategy;
        this.logger = strategy.logger;
        this.config = strategy.config;
        
        // 策略参数
        this.riskAversion = this.config.get('riskAversion') || 0.1;
        this.timeHorizon = this.config.get('timeHorizon') || 1; // 小时
        this.minSpread = this.config.get('minSpread') || 0.001; // 最小价差
        this.maxSpread = this.config.get('maxSpread') || 0.01; // 最大价差
        
        // 性能统计
        this.executionCount = 0;
        this.lastExecutionTime = 0;
        this.totalExecutionTime = 0;
    }

    /**
     * 执行策略核心逻辑
     */
    async executeStrategy() {
        const startTime = Date.now();
        this.executionCount++;
        
        try {
            this.logger.info('开始执行策略核心逻辑', {
                executionCount: this.executionCount,
                timestamp: new Date().toISOString()
            });
            
            // 检查必要的数据是否可用
            if (!this.validateRequiredData()) {
                this.logger.warn('策略执行跳过：缺少必要数据');
                return false;
            }
            
            // 计算Avellaneda最优价格
            const optimalPrices = this.calculateOptimalPrices();
            if (!optimalPrices) {
                this.logger.warn('策略执行跳过：无法计算最优价格');
                return false;
            }
            
            // 更新策略状态
            this.updateStrategyState(optimalPrices);
            
            // 记录执行时间
            const executionTime = Date.now() - startTime;
            this.lastExecutionTime = executionTime;
            this.totalExecutionTime += executionTime;
            
            this.logger.info('策略核心逻辑执行完成', {
                executionTime: executionTime + 'ms',
                averageExecutionTime: (this.totalExecutionTime / this.executionCount).toFixed(2) + 'ms',
                optimalBid: optimalPrices.bid.toFixed(2),
                optimalAsk: optimalPrices.ask.toFixed(2),
                spread: (optimalPrices.ask - optimalPrices.bid).toFixed(4)
            });
            
            return true;
            
        } catch (error) {
            this.logger.error('策略核心逻辑执行失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack,
                executionCount: this.executionCount
            });
            return false;
        }
    }

    /**
     * 验证执行策略所需的数据
     */
    validateRequiredData() {
        // 检查市场数据
        if (!this.strategy.currentMarketData || 
            !this.strategy.currentMarketData.midPrice || 
            this.strategy.currentMarketData.midPrice <= 0) {
            this.logger.debug('缺少有效的市场数据', {
                hasMarketData: !!this.strategy.currentMarketData,
                midPrice: this.strategy.currentMarketData?.midPrice
            });
            return false;
        }
        
        // 检查余额数据
        if (!this.strategy.currentBalances) {
            this.logger.debug('缺少余额数据');
            return false;
        }
        
        // 检查波动率数据
        if (!this.strategy.strategyState.volatility || 
            this.strategy.strategyState.volatility <= 0) {
            this.logger.debug('缺少有效的波动率数据', {
                volatility: this.strategy.strategyState.volatility
            });
            return false;
        }
        
        // 检查库存数据
        if (this.strategy.strategyState.totalInventoryValue <= 0) {
            this.logger.debug('缺少有效的库存数据', {
                totalInventoryValue: this.strategy.strategyState.totalInventoryValue
            });
            return false;
        }
        
        return true;
    }

    /**
     * 计算Avellaneda最优价格
     */
    calculateOptimalPrices() {
        try {
            const { currentPrice, volatility, currentInventory, targetInventory, totalInventoryValue } = this.strategy.strategyState;
            const { midPrice } = this.strategy.currentMarketData;
            
            // 使用中间价作为参考价格
            const referencePrice = midPrice;
            
            // 计算库存偏差
            const inventoryImbalance = currentInventory - targetInventory;
            const inventoryRatio = inventoryImbalance / totalInventoryValue;
            
            // 计算时间衰减因子（距离时间地平线的剩余时间比例）
            const timeDecay = 1.0; // 简化处理，实际应该根据交易时间计算
            
            // 计算Avellaneda最优价差
            const optimalSpread = this.calculateOptimalSpread(volatility, timeDecay);
            
            // 计算库存调整
            const inventoryAdjustment = this.calculateInventoryAdjustment(
                inventoryRatio, volatility, timeDecay
            );
            
            // 计算最优买卖价
            const halfSpread = optimalSpread / 2;
            const optimalBid = referencePrice - halfSpread + inventoryAdjustment;
            const optimalAsk = referencePrice + halfSpread + inventoryAdjustment;
            
            // 应用价差限制
            const { bid: adjustedBid, ask: adjustedAsk } = this.applySpreadLimits(
                optimalBid, optimalAsk, referencePrice
            );
            
            // 应用价格精度
            const { bid: finalBid, ask: finalAsk } = this.applyPricePrecision(
                adjustedBid, adjustedAsk
            );
            
            this.logger.debug('Avellaneda最优价格计算完成', {
                referencePrice: referencePrice.toFixed(2),
                volatility: volatility.toFixed(6),
                inventoryImbalance: inventoryImbalance.toFixed(6),
                inventoryRatio: inventoryRatio.toFixed(4),
                optimalSpread: optimalSpread.toFixed(6),
                inventoryAdjustment: inventoryAdjustment.toFixed(6),
                rawBid: optimalBid.toFixed(6),
                rawAsk: optimalAsk.toFixed(6),
                adjustedBid: adjustedBid.toFixed(6),
                adjustedAsk: adjustedAsk.toFixed(6),
                finalBid: finalBid.toFixed(2),
                finalAsk: finalAsk.toFixed(2),
                finalSpread: (finalAsk - finalBid).toFixed(4)
            });
            
            return {
                bid: finalBid,
                ask: finalAsk,
                spread: finalAsk - finalBid,
                inventoryAdjustment: inventoryAdjustment,
                rawSpread: optimalSpread
            };
            
        } catch (error) {
            this.logger.error('计算最优价格失败', {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    /**
     * 计算Avellaneda最优价差
     */
    calculateOptimalSpread(volatility, timeDecay) {
        // Avellaneda-Stoikov模型的最优价差公式
        // spread = γ * σ² * T + (2/γ) * ln(1 + γ/k)
        // 这里简化为: spread = γ * σ² * T + 2 * ln(1 + γ)
        
        const gamma = this.riskAversion;
        const sigma = volatility;
        const T = timeDecay * this.timeHorizon;
        
        // 第一项：风险厌恶 * 波动率平方 * 时间
        const riskTerm = gamma * Math.pow(sigma, 2) * T;
        
        // 第二项：流动性补偿项（简化）
        const liquidityTerm = 2 * Math.log(1 + gamma);
        
        const optimalSpread = riskTerm + liquidityTerm;
        
        // 确保价差在合理范围内
        return Math.max(this.minSpread, Math.min(this.maxSpread, optimalSpread));
    }

    /**
     * 计算库存调整
     */
    calculateInventoryAdjustment(inventoryRatio, volatility, timeDecay) {
        // 库存调整公式：adjustment = -γ * σ² * T * q
        // 其中 q 是标准化的库存偏差
        
        const gamma = this.riskAversion;
        const sigma = volatility;
        const T = timeDecay * this.timeHorizon;
        const q = inventoryRatio; // 标准化库存偏差
        
        const adjustment = -gamma * Math.pow(sigma, 2) * T * q;
        
        // 限制调整幅度，避免过度偏离市场价格
        const maxAdjustment = this.strategy.currentMarketData.midPrice * 0.01; // 最大1%调整
        return Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustment));
    }

    /**
     * 应用价差限制
     */
    applySpreadLimits(bid, ask, referencePrice) {
        const currentSpread = ask - bid;
        const minSpreadAbs = referencePrice * this.minSpread;
        const maxSpreadAbs = referencePrice * this.maxSpread;
        
        let adjustedBid = bid;
        let adjustedAsk = ask;
        
        // 如果价差太小，扩大价差
        if (currentSpread < minSpreadAbs) {
            const adjustment = (minSpreadAbs - currentSpread) / 2;
            adjustedBid = bid - adjustment;
            adjustedAsk = ask + adjustment;
        }
        
        // 如果价差太大，缩小价差
        if (currentSpread > maxSpreadAbs) {
            const adjustment = (currentSpread - maxSpreadAbs) / 2;
            adjustedBid = bid + adjustment;
            adjustedAsk = ask - adjustment;
        }
        
        // 确保买价小于卖价
        if (adjustedBid >= adjustedAsk) {
            const midPoint = (adjustedBid + adjustedAsk) / 2;
            const halfMinSpread = minSpreadAbs / 2;
            adjustedBid = midPoint - halfMinSpread;
            adjustedAsk = midPoint + halfMinSpread;
        }
        
        return { bid: adjustedBid, ask: adjustedAsk };
    }

    /**
     * 应用价格精度
     */
    applyPricePrecision(bid, ask) {
        const marketInfo = this.strategy.exchangeManager.getMarketInfo();
        if (!marketInfo || !marketInfo.precision || !marketInfo.precision.price) {
            // 如果没有精度信息，使用默认精度（2位小数）
            return {
                bid: Math.round(bid * 100) / 100,
                ask: Math.round(ask * 100) / 100
            };
        }
        
        const pricePrecision = marketInfo.precision.price;
        const multiplier = Math.pow(10, pricePrecision);
        
        return {
            bid: Math.round(bid * multiplier) / multiplier,
            ask: Math.round(ask * multiplier) / multiplier
        };
    }

    /**
     * 更新策略状态
     */
    updateStrategyState(optimalPrices) {
        this.strategy.strategyState.optimalBid = optimalPrices.bid;
        this.strategy.strategyState.optimalAsk = optimalPrices.ask;
        this.strategy.strategyState.currentSpread = optimalPrices.spread;
        this.strategy.strategyState.lastCalculationTime = Date.now();
        
        // 更新策略统计
        this.strategy.strategyState.executionCount = this.executionCount;
        this.strategy.strategyState.averageExecutionTime = this.totalExecutionTime / this.executionCount;
        
        this.logger.debug('策略状态已更新', {
            optimalBid: optimalPrices.bid.toFixed(2),
            optimalAsk: optimalPrices.ask.toFixed(2),
            spread: optimalPrices.spread.toFixed(4),
            executionCount: this.executionCount
        });
    }

    /**
     * 获取策略性能统计
     */
    getPerformanceStats() {
        return {
            executionCount: this.executionCount,
            lastExecutionTime: this.lastExecutionTime,
            averageExecutionTime: this.executionCount > 0 ? this.totalExecutionTime / this.executionCount : 0,
            totalExecutionTime: this.totalExecutionTime,
            riskAversion: this.riskAversion,
            timeHorizon: this.timeHorizon,
            minSpread: this.minSpread,
            maxSpread: this.maxSpread
        };
    }

    /**
     * 重置策略统计
     */
    resetStats() {
        this.executionCount = 0;
        this.lastExecutionTime = 0;
        this.totalExecutionTime = 0;
        
        this.logger.info('策略统计已重置');
    }

    /**
     * 更新策略参数
     */
    updateParameters(params) {
        if (params.riskAversion !== undefined) {
            this.riskAversion = params.riskAversion;
        }
        if (params.timeHorizon !== undefined) {
            this.timeHorizon = params.timeHorizon;
        }
        if (params.minSpread !== undefined) {
            this.minSpread = params.minSpread;
        }
        if (params.maxSpread !== undefined) {
            this.maxSpread = params.maxSpread;
        }
        
        this.logger.info('策略参数已更新', {
            riskAversion: this.riskAversion,
            timeHorizon: this.timeHorizon,
            minSpread: this.minSpread,
            maxSpread: this.maxSpread
        });
    }

    /**
     * 获取当前策略参数
     */
    getParameters() {
        return {
            riskAversion: this.riskAversion,
            timeHorizon: this.timeHorizon,
            minSpread: this.minSpread,
            maxSpread: this.maxSpread
        };
    }

    /**
     * 验证策略参数
     */
    validateParameters(params) {
        const errors = [];
        
        if (params.riskAversion !== undefined) {
            if (typeof params.riskAversion !== 'number' || params.riskAversion <= 0) {
                errors.push('riskAversion must be a positive number');
            }
        }
        
        if (params.timeHorizon !== undefined) {
            if (typeof params.timeHorizon !== 'number' || params.timeHorizon <= 0) {
                errors.push('timeHorizon must be a positive number');
            }
        }
        
        if (params.minSpread !== undefined) {
            if (typeof params.minSpread !== 'number' || params.minSpread <= 0) {
                errors.push('minSpread must be a positive number');
            }
        }
        
        if (params.maxSpread !== undefined) {
            if (typeof params.maxSpread !== 'number' || params.maxSpread <= 0) {
                errors.push('maxSpread must be a positive number');
            }
            if (params.minSpread !== undefined && params.maxSpread <= params.minSpread) {
                errors.push('maxSpread must be greater than minSpread');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = StrategyCore;