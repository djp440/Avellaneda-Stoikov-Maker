# 网络连接配置指南

## 概述

本指南将帮助你在VPN不稳定环境下配置网络连接，确保Avellaneda做市策略能够稳定运行。

## 问题分析

### 常见网络问题
1. **VPN连接不稳定** - 导致网络中断
2. **网络延迟高** - 影响交易响应速度
3. **连接超时** - API调用失败
4. **地区限制** - 无法直接访问Bitget

### 解决方案
- 智能网络管理器
- 代理服务器配置
- 连接质量监控
- 自动重连机制

## 配置步骤

### 1. 代理服务器配置

#### 1.1 本地代理软件
推荐使用以下代理软件：
- **Clash** - 支持多种协议，配置简单
- **V2Ray** - 功能强大，支持多种传输协议
- **Shadowsocks** - 轻量级，适合低配置设备

#### 1.2 代理配置示例

**Clash配置示例**：
```yaml
port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: :9090
proxies:
  - name: "Bitget专用"
    type: vmess
    server: your-server.com
    port: 443
    uuid: your-uuid
    alterId: 0
    cipher: auto
    tls: true
    network: ws
    ws-opts:
      path: /path
      headers:
        Host: your-server.com
```

### 2. 环境变量配置

#### 2.1 创建.env文件
```bash
cp env.example .env
```

#### 2.2 配置代理参数
编辑 `.env` 文件，添加代理配置：

```env
# 网络代理配置
PROXY_HOST=127.0.0.1               # 代理服务器地址
PROXY_PORT=7890                    # 代理服务器端口
PROXY_PROTOCOL=http                # 代理协议
PROXY_USERNAME=                    # 代理用户名（可选）
PROXY_PASSWORD=                    # 代理密码（可选）

# 交易所配置
EXCHANGE=bitget
EXCHANGE_API_KEY=your_api_key_here
EXCHANGE_SECRET=your_secret_here
EXCHANGE_PASSPHRASE=your_passphrase_here
EXCHANGE_SANDBOX=true
```

#### 2.3 代理协议说明
- **http** - HTTP代理，兼容性好
- **https** - HTTPS代理，安全性高
- **socks5** - SOCKS5代理，功能强大

### 3. 网络测试

#### 3.1 基础网络测试
```bash
node test-network.js
```

#### 3.2 高级网络测试
```bash
# 完整测试
node test-network-advanced.js

# 持续监控（5分钟）
node test-network-advanced.js monitor 5

# 持续监控（10分钟）
node test-network-advanced.js monitor 10
```

#### 3.3 测试结果解读
- **excellent** (延迟 < 100ms) - 网络质量优秀
- **good** (延迟 < 300ms) - 网络质量良好
- **fair** (延迟 < 1000ms) - 网络质量一般
- **poor** (延迟 < 3000ms) - 网络质量较差
- **unusable** (延迟 > 3000ms) - 网络不可用

## 网络优化建议

### 1. VPN优化
- 选择稳定的VPN服务商
- 使用专用线路
- 配置自动重连
- 监控连接质量

### 2. 代理优化
- 使用本地代理软件
- 配置多个备用节点
- 启用自动切换
- 监控代理状态

### 3. 网络监控
- 定期检查网络状态
- 监控连接质量
- 记录网络事件
- 设置告警通知

## 故障排除

### 1. 连接超时
**症状**：API调用超时，策略无法运行

**解决方案**：
1. 检查代理服务是否正常运行
2. 验证代理配置是否正确
3. 尝试更换代理节点
4. 增加超时时间设置

### 2. 网络不稳定
**症状**：连接频繁断开，策略运行中断

**解决方案**：
1. 使用更稳定的VPN服务
2. 配置多个备用代理
3. 启用自动重连机制
4. 调整策略更新频率

### 3. 延迟过高
**症状**：网络延迟超过1000ms

**解决方案**：
1. 选择更近的代理节点
2. 优化网络路由
3. 使用专用线路
4. 考虑更换网络服务商

## 高级配置

### 1. 多代理配置
```env
# 主代理
PROXY_HOST=127.0.0.1
PROXY_PORT=7890
PROXY_PROTOCOL=http

# 备用代理
PROXY_HOST_BACKUP=127.0.0.1
PROXY_PORT_BACKUP=7891
PROXY_PROTOCOL_BACKUP=socks5
```

### 2. 网络质量阈值调整
```env
# 网络质量阈值（毫秒）
NETWORK_EXCELLENT_THRESHOLD=100
NETWORK_GOOD_THRESHOLD=300
NETWORK_FAIR_THRESHOLD=1000
NETWORK_POOR_THRESHOLD=3000
```

### 3. 重连策略配置
```env
# 重连配置
RECONNECT_ATTEMPTS=5
RECONNECT_DELAY=2000
HEALTH_CHECK_INTERVAL=30000
```

## 监控和维护

### 1. 网络状态监控
```bash
# 实时监控网络状态
node test-network-advanced.js monitor 60
```

### 2. 日志分析
查看网络相关日志：
```bash
tail -f logs/strategy.log | grep -i network
```

### 3. 性能统计
```bash
# 查看连接统计
node -e "
const NetworkManager = require('./core/network-manager');
const StrategyConfig = require('./config/strategy');
const config = new StrategyConfig();
const network = new NetworkManager(config);
console.log(network.getConnectionStats());
"
```

## 最佳实践

### 1. 网络准备
- 确保VPN服务稳定
- 配置本地代理软件
- 测试网络连接质量
- 准备备用网络方案

### 2. 配置优化
- 使用合适的代理协议
- 设置合理的超时时间
- 配置自动重连机制
- 启用网络质量监控

### 3. 运行监控
- 定期检查网络状态
- 监控策略运行情况
- 记录网络事件
- 及时处理异常

### 4. 故障处理
- 建立故障处理流程
- 准备应急方案
- 保持备用网络
- 定期测试恢复

## 常见问题

### Q: 代理配置后仍然无法连接
A: 检查代理软件是否正常运行，验证端口配置是否正确。

### Q: 网络延迟过高怎么办
A: 尝试更换更近的代理节点，或使用专用线路。

### Q: 如何监控网络质量
A: 使用 `test-network-advanced.js monitor` 命令进行持续监控。

### Q: VPN断开后策略如何处理
A: 系统会自动检测网络状态，暂停策略运行，网络恢复后自动重连。

### Q: 可以同时使用多个代理吗
A: 当前版本支持主备代理配置，未来版本将支持多代理负载均衡。

## 技术支持

如果遇到网络配置问题：
1. 查看日志文件获取详细错误信息
2. 运行网络测试脚本诊断问题
3. 检查代理软件配置
4. 联系技术支持获取帮助

## 免责声明

- 请确保使用合法的网络服务
- 遵守当地法律法规
- 注意网络安全和个人隐私保护
- 作者不对网络配置问题承担责任 