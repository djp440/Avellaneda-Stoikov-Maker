# 测试文件索引

## 配置测试
- `test_config_migration.js` - 配置迁移测试，验证env中只保留敏感数据，其他配置从trading.js读取

## 测试说明
- 配置迁移测试验证了将非敏感配置从env文件迁移到config/trading.js的功能
- 确保敏感数据（API密钥等）仍然从环境变量读取
- 验证配置验证器和配置获取方法的正常工作
