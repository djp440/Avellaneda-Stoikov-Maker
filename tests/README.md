# 测试脚本索引

本文件夹包含了Avellaneda做市策略的各种测试脚本，用于验证系统的各个功能模块。

## 测试脚本列表

### 核心功能测试

#### `test_order_filled_update.js`
**功能**: 测试订单成交后的更新逻辑
**测试内容**:
- 订单成交后强制更新机制
- 时间计算逻辑（修复负数显示问题）
- forceOrderUpdate标志的工作流程
- shouldUpdateOrders方法的条件判断

**运行方式**: `node tests/test_order_filled_update.js`

#### `test_compact_order_output.js`
**功能**: 测试紧凑订单输出格式
**测试内容**:
- 订单创建时的紧凑输出格式
- 成功/失败状态的简洁显示
- 跳过订单的原因说明
- 订单完成状态的紧凑显示
- 新旧输出格式的对比展示

**运行方式**: `node tests/test_compact_order_output.js`

#### `test_market_data_validation.js`
**功能**: 测试市场数据验证逻辑
**测试内容**:
- 市场数据有效性检查
- 数据格式验证
- 异常数据处理

**运行方式**: `node tests/test_market_data_validation.js`

#### `test_reconnect_fix.js`
**功能**: 测试网络重连修复逻辑
**测试内容**:
- 网络断线重连机制
- 连接状态管理
- 异常恢复处理

**运行方式**: `node tests/test_reconnect_fix.js`

## 测试运行指南

### 单个测试运行
```bash
# 运行特定测试
node tests/test_order_filled_update.js
```

### 批量测试运行
```bash
# 运行所有测试（如果有测试套件）
npm test
```

### 测试环境要求
- Node.js 环境
- 已安装项目依赖 (`npm install`)
- 不需要真实的交易所连接（使用模拟数据）

## 测试结果说明

### 成功标识
- ✅ 表示测试通过
- 📊 表示状态信息
- 🔍 表示测试步骤

### 失败标识
- ❌ 表示测试失败
- ⚠️ 表示警告信息

## 添加新测试

当添加新的测试脚本时，请：n1. 在此文件中添加测试描述
2. 使用统一的命名规范：`test_功能名称.js`
3. 包含详细的测试说明和运行方式
4. 确保测试可以独立运行

## 注意事项

- 测试脚本使用模拟配置，不会影响真实交易
- 某些测试可能需要特定的环境配置
- 测试过程中的日志输出是正常现象
- 如果测试失败，请检查错误信息并根据提示进行修复