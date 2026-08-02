# 公共协议 2.0.0 契约向量

本目录保存 Proxy Protocol `2.0.0`、Provider ABI `2.0.0` 和 manifest schema `1.0.0` 的语言无关向量。权威语义来自 `docs/计划/总计划/06-前端Shell后端代理与数据源Provider公共协议.md`。

## 文件职责

| 文件 | 作用 |
|---|---|
| `proxy-request.valid.json` | none、utf8、base64 请求体和有序多值请求头。 |
| `proxy-request.invalid.json` | 精确字段、版本、URL、方法、头和原始正文组合失败。 |
| `proxy-response.valid.json` | 固定 base64 原始字节、空正文、上游非 2xx 和重复响应头。 |
| `proxy-error.valid.json` | 代理自身稳定错误；不包含业务解码错误。 |
| `provider-manifest.valid.json` | Provider ABI 2.0 单文件 manifest。 |
| `provider-manifest.invalid.json` | ABI 1.x、未知未来版本和 manifest 字段失败。 |

## 维护规则

1. `contracts/v1/` 是历史向量，2.0 实现不得修改或兼容解释它。
2. 请求和响应正文只做运输编码；JSON、HTML、文本和 Cookie 语义由 Provider 处理。
3. `headers` 是有序条目数组，同名字段不得合并为对象或逗号字符串。
4. 上游 `4xx/5xx` 使用成功运输外壳；只有安全、校验、容量和网络失败使用错误外壳。
5. 向量变化前必须先更新正式公共协议和版本。
