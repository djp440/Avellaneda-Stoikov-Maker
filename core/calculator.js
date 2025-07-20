const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');

/**
 * Avellaneda-Stoikov模型核心计算器
 * 实现最优价差、最优价格和订单数量计算
 */
class AvellanedaCalculator {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(config);
        
        // 核心参数
        this.gamma = config.get('riskFactor'); // 风险因子
        this.eta = config.get('shapeFactor'); // 形状因子
        this.inventoryTargetBase = config.get('inventoryTarget') || 0.5; // 库存目标比例
        
        // 状态变量
        this.reservationPrice = 0;
        this.optimalSpread = 0;
        this.optimalBid = 0;
        this.optimalAsk = 0;
        
        this.logger.info('AvellanedaCalculator initialized', {
            gamma: this.gamma,
            eta: this.eta,
            inventoryTargetBase: this.inventoryTargetBase
        });
    }

    /**
     * 计算最优价差
     * 公式: γ * σ² * t + (2/γ) * ln(1 + γ/k)
     * @param {number} volatility - 波动率
     * @param {number} tradingIntensity - 交易强度
     * @param {number} timeToExpiry - 到期时间(秒)
     * @returns {number} 最优价差
     */
    calculateOptimalSpread(volatility, tradingIntensity, timeToExpiry = 0) {
        try {
            if (!volatility || !tradingIntensity || volatility <= 0 || tradingIntensity <= 0) {
                this.logger.warn('最优价差计算参数无效', {
                    volatility,
                    tradingIntensity,
                    timeToExpiry,
                    reason: tradingIntensity <= 0 ? '交易强度为零，可能是订单簿数据不完整' : '波动率无效'
                });
                return this.config.get('minSpread');
            }

            // 时间项 (γ * σ² * t)
            const timeComponent = this.gamma * Math.pow(volatility, 2) * timeToExpiry;
            
            // 交易强度项 (2/γ) * ln(1 + γ/k)
            const intensityComponent = (2 / this.gamma) * Math.log(1 + this.gamma / tradingIntensity);
            
            // 总价差
            const optimalSpread = timeComponent + intensityComponent;
            
            // 确保不小于最小价差
            const finalSpread = Math.max(optimalSpread, this.config.get('minSpread'));
            
            this.logger.debug('Optimal spread calculated', {
                volatility,
                tradingIntensity,
                timeToExpiry,
                timeComponent,
                intensityComponent,
                optimalSpread,
                finalSpread
            });
            
            return finalSpread;
        } catch (error) {
            this.logger.error('Error calculating optimal spread', error);
            return this.config.minSpread;
        }
    }

    /**
     * 计算最优买卖价格
     * @param {number} midPrice - 中间价
     * @param {number} optimalSpread - 最优价差
     * @returns {Object} {optimalBid, optimalAsk}
     */
    calculateOptimalPrices(midPrice, optimalSpread) {
        try {
            if (!midPrice || midPrice <= 0) {
                this.logger.warn('Invalid mid price for optimal prices calculation', { midPrice });
                return { optimalBid: 0, optimalAsk: 0 };
            }

            const halfSpread = optimalSpread / 2;
            const optimalBid = midPrice - halfSpread;
            const optimalAsk = midPrice + halfSpread;
            
            // 格式化价格
            const formattedBid = Helpers.formatPrice(optimalBid, this.config.get('pricePrecision') || 8);
            const formattedAsk = Helpers.formatPrice(optimalAsk, this.config.get('pricePrecision') || 8);
            
            this.logger.debug('Optimal prices calculated', {
                midPrice,
                optimalSpread,
                optimalBid: formattedBid,
                optimalAsk: formattedAsk
            });
            
            return {
                optimalBid: formattedBid,
                optimalAsk: formattedAsk
            };
        } catch (error) {
            this.logger.error('Error calculating optimal prices', error);
            return { optimalBid: 0, optimalAsk: 0 };
        }
    }

    /**
     * 计算库存偏差
     * @param {number} currentInventory - 当前库存
     * @param {number} targetInventory - 目标库存
     * @param {number} totalInventory - 总库存价值
     * @returns {number} 库存偏差比例
     */
    calculateInventorySkew(currentInventory, targetInventory, totalInventory) {
        try {
            if (!totalInventory || totalInventory <= 0) {
                return 0;
            }
            
            const inventorySkew = (currentInventory - targetInventory) / totalInventory;
            
            this.logger.debug('Inventory skew calculated', {
                currentInventory,
                targetInventory,
                totalInventory,
                inventorySkew
            });
            
            return inventorySkew;
        } catch (error) {
            this.logger.error('Error calculating inventory skew', error);
            return 0;
        }
    }

    /**
     * 计算目标库存
     * @param {number} totalInventoryValue - 总库存价值
     * @param {number} price - 当前价格
     * @returns {number} 目标库存数量
     */
    calculateTargetInventory(totalInventoryValue, price) {
        try {
            if (!totalInventoryValue || !price || price <= 0) {
                return 0;
            }
            
            const targetInventoryValue = totalInventoryValue * this.inventoryTargetBase;
            const targetInventory = targetInventoryValue / price;
            
            this.logger.debug('Target inventory calculated', {
                totalInventoryValue,
                price,
                targetInventoryValue,
                targetInventory
            });
            
            return targetInventory;
        } catch (error) {
            this.logger.error('Error calculating target inventory', error);
            return 0;
        }
    }

    /**
     * 应用形状因子调整订单数量
     * 根据库存偏差调整订单大小
     * @param {number} baseAmount - 基础订单数量
     * @param {number} inventorySkew - 库存偏差
     * @param {boolean} isBuy - 是否为买单
     * @returns {number} 调整后的订单数量
     */
    applyShapeFactor(baseAmount, inventorySkew, isBuy) {
        try {
            if (!baseAmount || baseAmount <= 0) {
                return 0;
            }
            
            let adjustedAmount = baseAmount;
            
            // 根据库存偏差和订单方向调整数量
            if (isBuy && inventorySkew > 0) {
                // 买单且库存过多，减少买单数量
                adjustedAmount = baseAmount * Math.exp(-this.eta * inventorySkew);
            } else if (!isBuy && inventorySkew < 0) {
                // 卖单且库存不足，减少卖单数量
                adjustedAmount = baseAmount * Math.exp(this.eta * inventorySkew);
            }
            
            // 确保调整后的数量不为负数
            adjustedAmount = Math.max(adjustedAmount, 0);
            
            this.logger.debug('Shape factor applied', {
                baseAmount,
                inventorySkew,
                isBuy,
                eta: this.eta,
                adjustedAmount
            });
            
            return adjustedAmount;
        } catch (error) {
            this.logger.error('Error applying shape factor', error);
            return baseAmount;
        }
    }

    /**
     * 计算订单数量
     * @param {number} baseAmount - 基础订单数量
     * @param {number} currentInventory - 当前库存
     * @param {number} targetInventory - 目标库存
     * @param {number} totalInventory - 总库存价值
     * @param {boolean} isBuy - 是否为买单
     * @returns {number} 计算后的订单数量
     */
    calculateOrderAmount(baseAmount, currentInventory, targetInventory, totalInventory, isBuy) {
        try {
            if (!baseAmount || baseAmount <= 0) {
                return 0;
            }
            
            // 计算库存偏差
            const inventorySkew = this.calculateInventorySkew(currentInventory, targetInventory, totalInventory);
            
            // 应用形状因子调整
            let adjustedAmount = this.applyShapeFactor(baseAmount, inventorySkew, isBuy);
            
            // 应用数量限制
            adjustedAmount = Helpers.limitValue(adjustedAmount, 0, this.config.get('maxPosition') || 1.0);
            
            // 格式化数量
            const finalAmount = this.formatAmount(adjustedAmount);
            
            // 打印详细的订单数量计算过程
            this.printOrderAmountCalculation({
                baseAmount,
                currentInventory,
                targetInventory,
                totalInventory,
                inventorySkew,
                isBuy,
                adjustedAmount,
                finalAmount
            });
            
            this.logger.debug('Order amount calculated', {
                baseAmount,
                currentInventory,
                targetInventory,
                totalInventory,
                inventorySkew,
                isBuy,
                adjustedAmount,
                finalAmount
            });
            
            return finalAmount;
        } catch (error) {
            this.logger.error('Error calculating order amount', error);
            return 0;
        }
    }

    /**
     * 打印订单数量计算详情
     */
    printOrderAmountCalculation(data) {
        const {
            baseAmount,
            currentInventory,
            targetInventory,
            totalInventory,
            inventorySkew,
            isBuy,
            adjustedAmount,
            finalAmount
        } = data;
        
        console.log(`\n📦 ${isBuy ? '买单' : '卖单'}数量计算:`);
        console.log('─'.repeat(40));
        
        console.log('📊 基础参数:');
        console.log(`   基础数量: ${baseAmount.toFixed(8)} BTC`);
        console.log(`   当前库存: ${currentInventory.toFixed(8)} BTC`);
        console.log(`   目标库存: ${targetInventory.toFixed(8)} BTC`);
        console.log(`   总库存价值: ${totalInventory.toFixed(2)} USDT`);
        
        console.log('\n🎯 库存偏差:');
        console.log(`   偏差值: ${inventorySkew.toFixed(6)}`);
        console.log(`   偏差百分比: ${(inventorySkew * 100).toFixed(4)}%`);
        
        console.log('\n🔧 形状因子调整:');
        console.log(`   形状因子(η): ${this.eta}`);
        console.log(`   调整前数量: ${baseAmount.toFixed(8)} BTC`);
        
        // 计算调整因子
        let adjustmentFactor = 1;
        if (isBuy && inventorySkew > 0) {
            adjustmentFactor = Math.exp(-this.eta * inventorySkew);
            console.log(`   调整因子: exp(-${this.eta} × ${inventorySkew.toFixed(6)}) = ${adjustmentFactor.toFixed(6)}`);
        } else if (!isBuy && inventorySkew < 0) {
            adjustmentFactor = Math.exp(this.eta * inventorySkew);
            console.log(`   调整因子: exp(${this.eta} × ${inventorySkew.toFixed(6)}) = ${adjustmentFactor.toFixed(6)}`);
        } else {
            console.log(`   调整因子: 1.000000 (无需调整)`);
        }
        
        console.log(`   调整后数量: ${adjustedAmount.toFixed(8)} BTC`);
        
        console.log('\n📏 数量限制:');
        const maxPosition = this.config.get('maxPosition') || 1.0;
        console.log(`   最大持仓限制: ${maxPosition.toFixed(8)} BTC`);
        console.log(`   限制后数量: ${adjustedAmount.toFixed(8)} BTC`);
        
        console.log('\n🎯 最终结果:');
        console.log(`   格式化数量: ${finalAmount.toFixed(8)} BTC`);
        console.log(`   订单价值: ${(finalAmount * (isBuy ? this.optimalBid : this.optimalAsk)).toFixed(2)} USDT`);
        
        console.log('─'.repeat(40));
    }

    /**
     * 格式化订单数量
     * @param {number} amount - 原始数量
     * @returns {number} 格式化后的数量
     */
    formatAmount(amount) {
        try {
            // 获取市场精度信息
            const precision = this.config.get('amountPrecision') || 6; // 默认6位精度
            const minAmount = Math.pow(10, -precision); // 最小数量
            
            // 确保数量不小于最小数量
            if (amount < minAmount) {
                this.logger.warn('订单数量小于最小数量，使用最小数量', {
                    originalAmount: amount,
                    minAmount: minAmount,
                    precision: precision
                });
                amount = minAmount;
            }
            
            // 格式化到指定精度
            const formattedAmount = Math.floor(amount * Math.pow(10, precision)) / Math.pow(10, precision);
            
            this.logger.debug('订单数量格式化', {
                originalAmount: amount,
                formattedAmount: formattedAmount,
                precision: precision,
                minAmount: minAmount
            });
            
            return formattedAmount;
        } catch (error) {
            this.logger.error('Error formatting amount', error);
            return amount;
        }
    }

    /**
     * 计算库存价值
     * @param {number} baseAmount - 基础资产数量
     * @param {number} quoteAmount - 计价资产数量
     * @param {number} price - 当前价格
     * @returns {Object} {baseValue, quoteValue, totalValue}
     */
    calculateInventoryValue(baseAmount, quoteAmount, price) {
        try {
            const baseValue = baseAmount * price;
            const quoteValue = quoteAmount;
            const totalValue = baseValue + quoteValue;
            
            this.logger.debug('Inventory value calculated', {
                baseAmount,
                quoteAmount,
                price,
                baseValue,
                quoteValue,
                totalValue
            });
            
            return {
                baseValue,
                quoteValue,
                totalValue
            };
        } catch (error) {
            this.logger.error('Error calculating inventory value', error);
            return { baseValue: 0, quoteValue: 0, totalValue: 0 };
        }
    }

    /**
     * 更新计算器状态
     * @param {Object} marketData - 市场数据
     * @param {Object} indicators - 技术指标
     * @param {Object} balances - 账户余额
     * @returns {Object} 计算器状态
     */
    updateState(marketData, indicators, balances) {
        try {
            const { midPrice, timestamp } = marketData;
            const { volatility, tradingIntensity } = indicators;
            const { baseAmount, quoteAmount } = balances;
            
            // 计算库存价值
            const inventoryValue = this.calculateInventoryValue(baseAmount, quoteAmount, midPrice);
            
            // 计算目标库存
            const targetInventory = this.calculateTargetInventory(inventoryValue.totalValue, midPrice);
            
            // 计算库存偏差
            const inventorySkew = this.calculateInventorySkew(baseAmount, targetInventory, inventoryValue.totalValue);
            
            // 计算最优价差
            const optimalSpread = this.calculateOptimalSpread(volatility, tradingIntensity);
            
            // 计算最优价格
            const { optimalBid, optimalAsk } = this.calculateOptimalPrices(midPrice, optimalSpread);
            
            // 打印详细的计算过程
            this.printCalculationDetails({
                midPrice,
                volatility,
                tradingIntensity,
                baseAmount,
                quoteAmount,
                inventoryValue,
                targetInventory,
                inventorySkew,
                optimalSpread,
                optimalBid,
                optimalAsk
            });
            
            // 更新状态
            this.reservationPrice = midPrice;
            this.optimalSpread = optimalSpread;
            this.optimalBid = optimalBid;
            this.optimalAsk = optimalAsk;
            
            return {
                optimalBid,
                optimalAsk,
                optimalSpread,
                inventorySkew,
                targetInventory,
                inventoryValue
            };
            
        } catch (error) {
            this.logger.error('更新计算器状态失败', error);
            return null;
        }
    }

    /**
     * 打印详细的计算过程
     */
    printCalculationDetails(data) {
        const {
            midPrice,
            volatility,
            tradingIntensity,
            baseAmount,
            quoteAmount,
            inventoryValue,
            targetInventory,
            inventorySkew,
            optimalSpread,
            optimalBid,
            optimalAsk
        } = data;
        
        console.log('\n🧮 参数计算详情:');
        console.log('─'.repeat(50));
        
        console.log('📊 输入参数:');
        console.log(`   中间价: ${midPrice.toFixed(2)} USDT`);
        console.log(`   波动率: ${(volatility * 100).toFixed(4)}%`);
        console.log(`   交易强度: ${tradingIntensity.toFixed(6)}`);
        console.log(`   基础余额: ${baseAmount.toFixed(8)} BTC`);
        console.log(`   计价余额: ${quoteAmount.toFixed(2)} USDT`);
        
        console.log('\n💰 库存价值计算:');
        console.log(`   基础货币价值: ${inventoryValue.baseValue.toFixed(2)} USDT`);
        console.log(`   计价货币价值: ${inventoryValue.quoteValue.toFixed(2)} USDT`);
        console.log(`   总价值: ${inventoryValue.totalValue.toFixed(2)} USDT`);
        
        console.log('\n🎯 库存管理:');
        console.log(`   当前库存: ${baseAmount.toFixed(8)} BTC`);
        console.log(`   目标库存: ${targetInventory.toFixed(8)} BTC`);
        console.log(`   库存偏差: ${(inventorySkew * 100).toFixed(4)}%`);
        
        console.log('\n📈 最优价差计算:');
        console.log(`   风险因子(γ): ${this.gamma}`);
        console.log(`   形状因子(η): ${this.eta}`);
        console.log(`   时间项: ${(this.gamma * Math.pow(volatility, 2) * 0).toFixed(6)}`);
        console.log(`   强度项: ${((2 / this.gamma) * Math.log(1 + this.gamma / tradingIntensity)).toFixed(6)}`);
        console.log(`   最优价差: ${optimalSpread.toFixed(6)}`);
        console.log(`   价差百分比: ${(optimalSpread / midPrice * 100).toFixed(4)}%`);
        
        console.log('\n💱 最优价格计算:');
        console.log(`   价差的一半: ${(optimalSpread / 2).toFixed(6)}`);
        console.log(`   最优买价: ${optimalBid.toFixed(2)} USDT`);
        console.log(`   最优卖价: ${optimalAsk.toFixed(2)} USDT`);
        console.log(`   价格差: ${(optimalAsk - optimalBid).toFixed(2)} USDT`);
        
        console.log('─'.repeat(50));
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前计算器状态
     */
    getState() {
        return {
            gamma: this.gamma,
            eta: this.eta,
            inventoryTargetBase: this.inventoryTargetBase,
            reservationPrice: this.reservationPrice,
            optimalSpread: this.optimalSpread,
            optimalBid: this.optimalBid,
            optimalAsk: this.optimalAsk
        };
    }
}

module.exports = AvellanedaCalculator; 