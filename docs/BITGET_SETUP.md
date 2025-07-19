# Bitget交易所配置指南

## 概述

本指南将帮助你在Bitget交易所上配置API密钥，以便运行Avellaneda做市策略。

## 获取API密钥

### 1. 注册Bitget账户
- 访问 [Bitget官网](https://www.bitget.com)
- 完成账户注册和身份验证

### 2. 创建API密钥
1. 登录Bitget账户
2. 进入 **个人中心** → **API管理**
3. 点击 **创建API**
4. 设置API密钥名称（如：Avellaneda策略）
5. 选择权限：
   - ✅ **现货交易** - 必需
   - ✅ **查询** - 必需
   - ❌ **提现** - 不建议开启（安全考虑）
6. 设置IP白名单（可选，建议设置）
7. 设置Passphrase（API密码）- **必需设置**
8. 点击 **创建**

### 3. 保存API信息
创建成功后，你会获得：
- **API Key**: 用于身份验证
- **Secret Key**: 用于签名验证
- **Passphrase**: 用于API调用（必需）

⚠️ **重要**: 请妥善保存这些信息，Secret Key和Passphrase只会显示一次！

## 环境变量配置

### 1. 创建.env文件
```bash
cp env.example .env
```

### 2. 配置API密钥
编辑 `.env` 文件，填入你的API信息：

```env
# 交易所配置
EXCHANGE=bitget
EXCHANGE_API_KEY=你的API_KEY
EXCHANGE_SECRET=你的SECRET_KEY
EXCHANGE_PASSPHRASE=你的PASSPHRASE  # Bitget必需参数
EXCHANGE_SANDBOX=true  # 建议先设为true进行测试

# 交易对配置
SYMBOL=BTC/USDT  # Bitget支持的交易对格式
BASE_CURRENCY=BTC
QUOTE_CURRENCY=USDT
```

### 3. 测试配置
运行测试脚本验证配置：
```bash
node test-framework.js
```

## Bitget API特点

### 支持的交易对格式
Bitget使用标准的交易对格式，例如：
- `BTC/USDT`
- `ETH/USDT`
- `BNB/USDT`
- `ADA/USDT`

### API限制
- **现货交易**: 10次/秒
- **查询**: 20次/秒
- **订单簿**: 20次/秒

### 沙盒环境
Bitget提供沙盒环境用于测试：
- 沙盒URL: `https://api-sandbox.bitget.com`
- 生产URL: `https://api.bitget.com`

## 安全建议

### 1. API权限最小化
- 只开启必要的权限（现货交易、查询）
- 不要开启提现权限

### 2. IP白名单
- 设置API密钥的IP白名单
- 只允许你的服务器IP访问

### 3. 定期轮换
- 定期更换API密钥
- 删除不再使用的API密钥

### 4. 资金管理
- 在测试账户中先进行小资金测试
- 逐步增加资金规模

## 常见问题

### Q: API密钥创建失败
A: 检查是否完成了身份验证，某些功能需要完成KYC验证。

### Q: Passphrase是什么？
A: Passphrase是Bitget API的密码，在创建API密钥时必须设置。它用于API调用的额外安全验证。

### Q: 忘记了Passphrase怎么办？
A: Passphrase无法找回，只能删除旧API密钥重新创建。请务必妥善保存。

### Q: 交易对不存在
A: 确认交易对格式正确，检查Bitget是否支持该交易对。

### Q: API调用频率超限
A: 策略已内置频率控制，如仍有问题可调整更新间隔。

### Q: 沙盒环境数据不同步
A: 沙盒环境的数据可能与生产环境有差异，这是正常现象。

## 测试步骤

1. **配置沙盒环境**
   ```env
   EXCHANGE_SANDBOX=true
   ```

2. **运行基础测试**
   ```bash
   node test-framework.js
   ```

3. **小资金测试**
   - 使用少量资金进行测试
   - 观察策略运行情况
   - 检查日志输出

4. **切换到生产环境**
   ```env
   EXCHANGE_SANDBOX=false
   ```

## 联系支持

如果在配置过程中遇到问题：
- Bitget官方文档: [API文档](https://bitgetlimited.github.io/apidoc/zh/spot/index.html)
- Bitget客服: 通过官网联系客服
- 项目Issues: 在项目仓库提交Issue

## 免责声明

- 本策略仅供学习和研究使用
- 实际交易存在风险，请谨慎操作
- 建议先在沙盒环境充分测试
- 作者不对交易损失承担责任 