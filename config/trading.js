/**
 * 交易配置
 * 包含所有非敏感的配置参数
 */

module.exports = {
    // 交易对配置
    symbol: 'SOL/USDT',                    // 交易对符号，格式为 基础货币/计价货币
    baseCurrency: 'SOL',                   // 基础货币，即被交易的货币
    quoteCurrency: 'USDT',                 // 计价货币，即用于计价的货币

    // 策略参数
    riskFactor: 0.2,                       // 风险因子，控制策略的激进程度，值越大风险越高
    orderAmount: 0.04,                  // 单笔订单数量，以基础货币为单位
    minSpread: 0.0011,                      // 最小价差，低于此值不会下单
    maxSpread: 0.03,                       // 最大价差，高于此值不会下单
    inventoryTarget: 0,                    // 库存目标，0表示中性，正数表示做多偏好，负数表示做空偏好
    shapeFactor: 1.0,                      // 形状因子，影响订单簿的形状，控制订单分布

    // 执行控制
    updateInterval: 5000,                  // 更新间隔，策略执行频率，单位为毫秒
    maxOrders: 10,                         // 最大订单数量，同时存在的订单上限
    orderTimeout: 15000,                   // 订单超时时间，单位为毫秒，超时后取消订单

    // 风险管理 - 持仓控制
    maxPositionValuePercent: 20.0,         // 最大持仓价值百分比，相对于账户总价值
    targetInventory: 0,                    // 目标库存，0表示中性，正数表示做多偏好，负数表示做空偏好

    // 风险管理 - 止损设置
    stopLossPercent: 2.0,                  // 止损百分比，当亏损达到此百分比时触发止损
    stopLossAmountPercent: 1.0,            // 止损金额百分比，相对于账户总价值
    trailingStopLoss: false,               // 是否启用追踪止损，true为启用，false为禁用

    // 风险管理 - 资金管理
    maxDrawdown: 5.0,                      // 最大回撤百分比，当回撤达到此百分比时触发风险控制
    maxDailyLossPercent: 2.0,              // 最大日亏损百分比，相对于账户总价值

    // 风险管理 - 订单控制
    maxOrderSizePercent: 1.0,              // 最大单笔订单数量百分比，相对于账户总价值
    maxOrderValuePercent: 5.0,             // 最大单笔订单价值百分比，相对于账户总价值

    // 风险管理 - 监控设置
    riskCheckInterval: 5000,               // 风险检查间隔，单位为毫秒
    emergencyStopThreshold: 10.0,          // 紧急停止阈值，当回撤达到此百分比时触发紧急停止

    // 技术指标配置
    volatilityBufferSize: 20,              // 波动率指标缓冲区大小，减少等待时间
    volatilityAlpha: 0.94,                 // 波动率计算平滑因子，0-1之间
    tradingIntensityBufferSize: 20,        // 交易强度指标缓冲区大小，减少等待时间
    orderBookDepth: 10,                    // 订单簿深度，用于计算交易强度

    // 日志配置
    logLevel: 'info',                      // 日志级别，可选值：debug, info, warn, error
    logFile: 'logs/strategy.log',          // 日志文件路径，策略运行日志保存位置

    // 开发模式
    nodeEnv: 'production',                 // 运行环境，development为开发环境，production为生产环境

    // 网络代理配置（VPN不稳定时使用）
    proxy: {
        host: '',                          // 代理服务器地址
        port: '',                          // 代理服务器端口
        protocol: '',                      // 代理协议，支持http、https、socks5
        username: '',                      // 代理用户名（如果需要认证）
        password: ''                       // 代理密码（如果需要认证）
    }
}; 