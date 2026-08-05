# 当前公共协议契约向量

本目录是当前公开实现使用的唯一协议向量入口，当前包含 Proxy Protocol `2.0.0`、Provider ABI `2.0.0` 和 manifest schema `1.0.0`。版本事实来自本目录 JSON；目录名不代替协议字段。

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

1. 公开源码树只保存 `contracts/current/`；历史向量由 Git 提交与发布标签追溯，当前实现不得兼容解释旧版本。
2. 请求和响应正文只做运输编码；JSON、HTML、文本和 Cookie 语义由 Provider 处理。
3. `headers` 是有序条目数组，同名字段不得合并为对象或逗号字符串。
4. 上游 `4xx/5xx` 使用成功运输外壳；只有安全、校验、容量和网络失败使用错误外壳。
5. 向量变化必须与协议版本、前后端调用者和公开开发文档在同一发布中更新。
6. 当前调用者只引用 `contracts/current/`；协议升级时原子替换本目录，不建立历史副本或兼容入口。
