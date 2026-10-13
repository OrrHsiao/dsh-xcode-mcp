# dsh-xcode-mcp

[English](README.md) | **中文**

**DeepSeek Harness 的 Apple Xcode MCP 桥接插件。**

Xcode 27 内置了一套 *headless MCP 工具服务*，`/usr/bin/xcrun mcpbridge` 是它的
STDIO 桥。本插件把这套桥接到 DeepSeek Harness 自带的 MCP 客户端上，于是每个
Xcode 工具都以普通原生工具的形式出现在模型面前，名字是 `mcp__xcode__<工具名>`。

在 Xcode 27.0 上共 **54 个工具**：工程与 scheme 检查、构建、测试、SwiftUI
Preview 渲染、模拟器启动与交互（点击 / 输入 / 滑动）、截图、无障碍层级、OSLog，
以及 Swift Package、本地化、Instrumentation 相关的辅助工具。

## 为什么要做成插件

手工接 `xcrun mcpbridge` 意味着要去改 profile 的 `cordis.patch.yml`，还得记住
transport 字段、工具调用超时和失败策略。这个包把这些配置封装起来，让这条连接变成
一个有名字、有版本、能在 Plugins 页里看到、也能像其他插件一样卸载的独立个体。

## 装进去的到底是什么

**没有任何 JavaScript 会被执行。** 纯声明式 bundle 就是一个 manifest 加一个
patch —— 8 个文件，解包约 4 kB，没有 `dependencies`，没有 `scripts`，没有构建步骤：

```
package.json  cordis.patch.yml  icon.svg
locale/en.json  locale/zh.json  README.md  README-zh.md  LICENSE
```

真正干活的 `@deepseek-ai/dsh-mcp-client` 随 dsh 一起发布，本包**刻意不依赖它**。
除了下面[配置](#配置)一节里那约 40 行 YAML，这里没有任何需要审计的东西。

## 前置条件

- **macOS**，**Xcode 27 或更高版本**。更早的版本里没有 `mcpbridge` 这个命令。
- headless 服务已启用并正在运行：

  ```sh
  xcrun mcp-server status     # 期望看到：Permission: enabled / mcp-server: running
  sudo xcrun mcp-server enable
  xcrun mcp-server start
  ```

- 若要使用工程级工具，需要 Xcode 里打开着工程，并授权你构建所在的目录：

  ```sh
  sudo xcrun mcp-server allow-folder /path/to/your/projects
  ```

首次连接时 Xcode 会弹一个 agent 授权框。**签名**客户端（例如 DeepSeek Harness）
批准一次即永久有效；未签名客户端的授权约 24 小时后失效。

## 安装

在侧边栏的 **Plugins** 页里输入包名：

```
dsh-xcode-mcp
```

安装会同时启用这个 bundle，通常能通过 HMR 直接生效。如果 `mcp__xcode__*` 工具
没有出现，重启 profile 让新的 bundle 层重新组合即可。

未发布前想先试，Plugins 页也接受指向本地目录的绝对路径。

## 验证

随便让它做点需要 Xcode 的事，或者看看工具列表里有没有 `mcp__xcode__*`。
第一个值得调的是 `mcp__xcode__XcodeListWorkspaces`：

```
* workspaceIdentifier: workspace-xxxxxxxxxx, workspacePath: /path/to/App.xcodeproj
```

再拿这个 identifier 调 `mcp__xcode__XcodeListSchemes`，就能列出工程里的 scheme。
两者都已在 Xcode 27.0 (27A266a) 上实测通过。

## 配置

这一行的 id 是 `mcp-xcode`，它的 `config` 就是完整的
[`@deepseek-ai/dsh-mcp-client`](https://www.npmjs.com/package/@deepseek-ai/dsh-mcp-client)
schema，那份文档里的任何字段都可用。要改哪一项，就在 profile 自己的
`cordis.patch.yml` 里覆盖这一行 —— **匹配到的覆盖会整体替换 `config`**，
所以仍然需要的字段必须全部重写：

```yaml
- id: mcp-xcode
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: xcode
    transport: stdio
    command: /usr/bin/xcrun
    args: ['mcpbridge']
    toolCallTimeoutMs: 900000   # 默认 60 秒；构建类调用需要更久
    failOnStartupError: false   # Xcode 没开时不能阻止 harness 启动
```

若想指定某个特定的 Xcode，而不是 `xcode-select` 指向的那个，加 `env` 并设置
`MCP_XCODE_PID`。

### 关于那 54 个工具

每个工具的 JSON Schema 每一轮都会提供给模型。如果这占用的上下文太多，注意
`@deepseek-ai/dsh-mcp-client` 并没有 include / exclude 过滤 —— 想要过滤就得换一个
自己实现了过滤的桥。

## 卸载

在 Plugins 页里卸载，或者把该 bundle 从 `dsh.profile.bundles` 中移除并卸载包。
禁用这个 bundle 时，它持有的 `mcpbridge` 子进程也会一并停止。

## 许可证

MIT
