/**
 * 兼容层 - 为了保持向后兼容性
 * 这个文件将原来的 AvellanedaStrategy 类重定向到新的模块化实现
 */

const AvellanedaStrategyBase = require('./strategy/base');

/**
 * Avellaneda做市策略核心逻辑
 * 注意：这个类现在是一个兼容层，实际实现已经迁移到子模块中
 */
class AvellanedaStrategy extends AvellanedaStrategyBase {
    constructor(config) {
        super(config);
        console.log('注意：正在使用 AvellanedaStrategy 兼容层，建议直接使用 AvellanedaStrategyBase');
    }
}

module.exports = AvellanedaStrategy;