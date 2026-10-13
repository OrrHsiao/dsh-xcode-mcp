# dsh-xcode-mcp

**Apple Xcode MCP bridge for [DeepSeek Harness](https://deepseek.com).**

Xcode 27 ships a *headless MCP tool service*. `/usr/bin/xcrun mcpbridge` is the
STDIO bridge to it. This bundle wires that bridge into the MCP client already
shipped with DeepSeek Harness, so every Xcode tool reaches the model as an
ordinary native tool named `mcp__xcode__<ToolName>`.

On Xcode 27.0 that is **54 tools**: project and scheme inspection, builds,
tests, SwiftUI Preview rendering, simulator launch and interaction
(tap / type / swipe), screenshots, the accessibility hierarchy, OSLog, and
Swift package, localization and instrumentation helpers.

## Why a bundle

Hand-wiring `xcrun mcpbridge` means editing the profile's `cordis.patch.yml` and
remembering the transport fields, the tool-call timeout and the failure policy.
This package carries that configuration instead, so the connection becomes one
installable thing that is named, versioned, listed in the Plugins page and
removable like any other plugin.

It contains **no JavaScript**: a configuration-only bundle is a manifest plus a
patch. There is nothing to audit beyond the 40 lines of YAML below, and no
dependency to install — `@deepseek-ai/dsh-mcp-client` ships with dsh itself.

## Requirements

- **macOS**, **Xcode 27 or later**. `mcpbridge` does not exist in earlier
  versions.
- The headless service enabled and running:

  ```sh
  xcrun mcp-server status     # expect: Permission: enabled / mcp-server: running
  sudo xcrun mcp-server enable
  xcrun mcp-server start
  ```

- For the project-scoped tools, a project open in Xcode, plus permission for the
  folders you build in:

  ```sh
  sudo xcrun mcp-server allow-folder /path/to/your/projects
  ```

On first connection Xcode shows an agent-authorization prompt. A **signed**
client such as DeepSeek Harness is remembered permanently; an unsigned client's
grant expires after about 24 hours.

## Install

From a directory, through the agent:

> Install the bundle at `/absolute/path/to/dsh-xcode-mcp`.

or from the **Plugins** page in the sidebar, which accepts the same absolute
path. Once published to a registry, the package name alone is enough.

Then **restart the profile** so the new bundle layer is composed.

## Verify

Ask for something that needs Xcode, or check the tool list for `mcp__xcode__*`.
A first call worth making is `mcp__xcode__XcodeListWorkspaces`, which reports the
open workspaces, schemes and permitted folders.

## Configure

The row is `mcp-xcode`; its `config` is the full
[`@deepseek-ai/dsh-mcp-client`](https://www.npmjs.com/package/@deepseek-ai/dsh-mcp-client)
schema, so any field documented there works. To change one, override the row in
the profile's own `cordis.patch.yml` — a matching override replaces the whole
`config`, so restate every field you still want:

```yaml
- id: mcp-xcode
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: xcode
    transport: stdio
    command: /usr/bin/xcrun
    args: ['mcpbridge']
    toolCallTimeoutMs: 900000
    failOnStartupError: false
```

To point at a specific Xcode instead of the one `xcode-select` names, add `env`
with `MCP_XCODE_PID`.

### A note on the 54 tools

Every tool's JSON Schema is offered to the model each turn. If that is more
context than you want, `@deepseek-ai/dsh-mcp-client` has no include/exclude
filter — the alternative is a bridge that implements one.

## Remove

Through the Plugins page, or by removing the bundle from `dsh.profile.bundles`
and uninstalling the package. Disabling the bundle stops the `mcpbridge`
subprocess with it.

## License

MIT
