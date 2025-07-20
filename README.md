# Avellaneda-Stoikov-Maker

<p align="left">
  <a href="https://nodejs.org/en/about/releases/" target="_blank"><img src="https://img.shields.io/badge/node-%3E=18.0.0-green" alt="Node.js Version" /></a>
  <a href="https://github.com/daijiapeng/Avellaneda-Stoikov-Maker/blob/main/LICENSE" target="_blank"><img src="https://img.shields.io/badge/license-ISC-blue.svg" alt="License" /></a>
  <a href="https://github.com/daijiapeng/Avellaneda-Stoikov-Maker/stargazers" target="_blank"><img src="https://img.shields.io/github/stars/daijiapeng/Avellaneda-Stoikov-Maker?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/daijiapeng/Avellaneda-Stoikov-Maker/issues" target="_blank"><img src="https://img.shields.io/github/issues/daijiapeng/Avellaneda-Stoikov-Maker" alt="GitHub issues" /></a>
  <a href="https://github.com/daijiapeng/Avellaneda-Stoikov-Maker/pulls" target="_blank"><img src="https://img.shields.io/github/issues-pr/daijiapeng/Avellaneda-Stoikov-Maker" alt="GitHub pull requests" /></a>
  <a href="https://david-dm.org/daijiapeng/Avellaneda-Stoikov-Maker" target="_blank"><img src="https://img.shields.io/david/daijiapeng/Avellaneda-Stoikov-Maker" alt="dependencies" /></a>
</p>

基于 Avellaneda-Stoikov 模型的 Bitget 做市商策略，使用 Node.js + CCXT 框架实现，支持自动化加密货币做市交易，具备完善的风险控制和高可扩展性。

## 项目简介

- **核心算法**：Avellaneda-Stoikov 做市模型
- **目标交易所**：Bitget（可扩展至其他交易所）
- **主要特性**：
  - 动态定价与库存管理
  - 实时市场数据处理
  - 自动订单管理与风险控制
  - 完善的日志与监控
  - 配置热更新与模块化设计

## 目录结构

```
.
├── config/                # 策略与交易参数配置
├── core/                  # 核心策略、计算、风控、交易所接口
├── data/                  # 市场数据与账户数据
├── docs/                  # 项目文档与开发指南
├── python原代码/          # Python 参考实现
├── test/                  # 测试脚本与测试索引
├── utils/                 # 工具与日志模块
├── index.js               # 主入口文件
├── env.example            # 环境变量示例
├── package.json           # 依赖与脚本
└── README.md              # 项目说明
```

## 安装与环境准备

1. **安装 Node.js 18+**
2. **安装 cnpm（推荐）**
   ```sh
   npm install -g cnpm --registry=https://registry.npmmirror.com
   ```
3. **安装依赖**
   ```sh
   cnpm install
   ```
4. **配置环境变量**
   - 复制 `.env.example` 为 `.env`，填写你的 Bitget API 信息
   - 其他策略参数请在 `config/trading.js` 中调整

   ```env
   EXCHANGE=bitget
   EXCHANGE_API_KEY=你的api
   EXCHANGE_SECRET=你的api
   EXCHANGE_PASSPHRASE=你的api
   EXCHANGE_SANDBOX=false
   ```

## 启动方式

- **首次使用推荐**：运行 `start.bat`，自动检查环境并引导配置
- **快速启动**：`quick-start.bat`（需已配置好 .env）
- **开发调试**：`dev-start.bat`（支持热重载）

或手动启动：
```sh
# 生产模式
npm start

# 开发模式（需 nodemon）
npm run dev
```

## 策略配置说明

- **敏感信息**（API密钥等）放在 `.env`
- **策略参数**（如交易对、风险参数、风控规则等）在 `config/trading.js` 配置
- 主要参数示例：
  ```js
  module.exports = {
    symbol: 'BTC/USDT',
    riskFactor: 0.2,
    orderAmount: 0.000016,
    minSpread: 0.0011,
    // ...更多参数见 config/trading.js
  }
  ```

## 测试说明

- 测试脚本位于 `test/` 目录
- 已有测试包括：
  - 配置迁移与验证
  - 程序卡住检测与修复
- 详见 [`test/test索引.md`](test/test索引.md)

## 日志与监控

- 日志文件默认保存在 `logs/strategy.log`
- 包含策略运行状态、交易记录、错误信息、性能指标等

## 主要依赖

- [ccxt](https://github.com/ccxt/ccxt) - 统一交易所接口
- [dotenv](https://github.com/motdotla/dotenv) - 环境变量管理
- [winston](https://github.com/winstonjs/winston) - 日志系统
- [lodash](https://lodash.com/) - 数据处理
- [moment](https://momentjs.com/) - 时间处理

## 关键注意事项

- **资金安全**：API密钥请妥善保管，测试时建议只读权限
- **风险控制**：建议小资金测试，逐步放大
- **市场适应**：不同市场需调整参数
- **合规要求**：请遵守当地法规
- **依赖安装**：务必使用 `cnpm`，避免网络问题
- **日志与调试**：遇到问题请先查阅日志

## 参考文档

- [开发指南](docs/AVELLANEDA_JS_DEVELOPMENT_GUIDE.md)
- [Bitget接入说明](docs/BITGET_SETUP.md)
- [性能优化建议](docs/PERFORMANCE_OPTIMIZATION.md)
- [开发简要记录](docs/开发简要记录.md)

## 示例：如何在代码中使用策略

```js
const StrategyConfig = require('../config/strategy');
const AvellanedaStrategy = require('../core/strategy');

(async () => {
  const strategy = new AvellanedaStrategy(StrategyConfig);
  await strategy.initialize();
  await strategy.start();
})();
```

---

如需详细开发与扩展说明，请查阅 `docs/` 目录下的相关文档。
