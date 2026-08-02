# 公共协议 1.0.0 契约向量

本目录保存前端 ProxyClient、后端无状态代理和后续 Provider 联合接入共同消费的语言无关 JSON 向量。权威字段和错误语义来自 `docs/计划/总计划/06-前端Shell后端代理与数据源Provider公共协议.md`，向量不能单独扩张协议。

## 当前文件

| 文件 | 作用 | 当前阶段 |
|---|---|---|
| `proxy-request.valid.json` | 覆盖 GET、UTF-8、JSON 和 base64 的合法请求组合 | 后端校验与前端 ProxyClient |
| `proxy-request.invalid.json` | 覆盖版本、精确字段、URL、方法、头、body 和容量的网络前失败 | 后端校验与前端 ProxyClient |
| `proxy-error.valid.json` | 覆盖全部冻结错误码、HTTP 状态和重试语义 | 后端错误外壳与前端 ProxyClient |
| `proxy-response.valid.json` | 覆盖 JSON、UTF-8、base64、上游 4xx 和有序重复响应头 | 后端执行器与前端 ProxyClient |
| `provider-manifest.valid.json` | 覆盖单文件 Provider 的完整 manifest、稳定身份、能力和最小网络 host | 单文件预检器与 Provider 加载器 |
| `provider-manifest.invalid.json` | 覆盖未知字段、身份不一致、通配/重复 host 和能力缺失 | 单文件预检器网络前失败边界 |

Provider manifest 向量已经在真实 Provider 阶段步骤 1 冻结；加载器和四条 Provider 尚未据此实现。本目录只冻结跨语言协议对象，不包含脚本文本、DNS 白名单、测试上游或绕过生产安全策略的夹具。

## 维护规则

1. `protocolVersion` 固定为 `1.0.0`，未知字段必须拒绝。
2. 向量中的 `expected` 只保存稳定错误码和规则原因，不保存异常文案匹配逻辑。
3. 请求、响应、错误字段变化时，先更新公共协议和版本，再同步三条开发线及本目录。
4. 安全测试不得通过测试专用域名白名单、跳过 DNS/IP 检查、放宽生产策略或关闭 TLS 证书校验获得成功。
5. 后端步骤 3 的真实集成测试使用独立 localhost 测试证书和临时 `NODE_EXTRA_CA_CERTS` 副本；该副本必须在测试结束后删除，生产连接器不得读取测试夹具。
6. 单文件模块只允许 `sourceManifest` 和 `createProviderFactory` 两个导出；manifest 向量不能单独授权或执行脚本文本。
7. `provider-manifest.invalid.json` 的每个 `patch` 都按顶层字段浅替换 `baseManifest`；嵌套对象由该字段整体替换，不执行递归合并或兼容默认值。
