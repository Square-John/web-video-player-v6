# 公开指南

本目录保存面向项目使用者、部署者、贡献者和 Provider 作者的公开说明。这里解释如何安装、使用、部署和扩展项目。

## 当前入口

- 项目定位、核心能力和最短启动方式从仓库根 [`README.md`](../README.md) 开始。
- 当前公共协议与语言无关向量从 [`contracts/README.md`](../contracts/README.md) 进入。

## 当前指南

- [`前端展示能力与字段契约.md`](前端展示能力与字段契约.md)：逐页逐块说明请求、响应、ContentItem、分页、筛选、线路、播放和状态行为。
- [`数据源脚本开发指南.md`](数据源脚本开发指南.md)：从 manifest、SourceContext 和页面分发到导入、恢复、失败和发布验收的完整 Provider 手册。
- [`快速开始.md`](快速开始.md)：安装依赖、三份根配置、本地启动、首次使用和生产验证。
- [`部署指南.md`](部署指南.md)：静态前端、Node 后端、GitHub Pages、Render、反向代理和日志边界。
- [`当前版本与兼容性.md`](当前版本与兼容性.md)：运行要求、协议版本、Provider、浏览器数据和配置升级边界。
- [`常见问题.md`](常见问题.md)：启动、CORS、部署、数据源、播放、持久化、挑战和日志排查。
- [`CONTRIBUTING.md`](CONTRIBUTING.md)：公开贡献边界、开发入口和提交要求。
- [`SECURITY.md`](SECURITY.md)：漏洞私下报告和部署安全责任。
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)：主要直接依赖、许可证和项目链接。

公开指南只陈述当前真实产品能力。机器可验证的公共协议向量以 `contracts/current/` 为准；公开文档不能创造第二套接口或兼容行为。
