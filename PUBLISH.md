# 发布 dsh-xcode-mcp

让任何人都能 `Plugins 页输入 dsh-xcode-mcp → 安装` 的完整流程。

本机现状（已核实）：

| 项 | 值 |
|---|---|
| npm / node | 11.19.1 / v26.10.0 |
| registry | `https://registry.npmjs.org/` |
| 登录状态 | **未登录**（需先 `npm login`） |
| `dsh-xcode-mcp` 占用 | **可用** |
| 发布包 | 7 files / 4.1 kB |

---

## 0. 先补溯源字段（重要）

别人装的是要跑在自己机器上的东西，**能不能看到源码**直接决定他们敢不敢装。
现在的 `package.json` 缺 `repository` / `author`，补上（把 `YOURNAME` 换成你的 GitHub 用户名）：

```json
"author": "YOURNAME",
"repository": { "type": "git", "url": "git+https://github.com/YOURNAME/dsh-xcode-mcp.git" },
"homepage": "https://github.com/YOURNAME/dsh-xcode-mcp#readme",
"bugs": "https://github.com/YOURNAME/dsh-xcode-mcp/issues",
"publishConfig": { "access": "public" }
```

改完校验一遍，别把 JSON 写坏：

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"
npm pack --dry-run
```

## 1. 登录 npm

```bash
npm login          # 浏览器授权 + 2FA，需要你本人操作
npm whoami         # 应打印你的用户名
```

这一步我做不了 —— 它要你的账号密码和二次验证。

## 2. 建 GitHub 仓库（决定别人能不能搜到你）

```bash
cd /Users/orrhsiao/Desktop/tmp/dsh-xcode-mcp
git init -b main
git add .
git commit -m "dsh-xcode-mcp 1.0.0: Apple Xcode MCP bridge for DeepSeek Harness"
gh repo create dsh-xcode-mcp --public --source=. --push    # 或手工在网页建
gh repo edit --add-topic dsh-plugin --add-topic deepseek-harness --add-topic xcode --add-topic mcp
```

**`dsh-plugin` 这个 topic 是关键。** DSH 生态的发现工具（`dsh-find-plugin`、各类 catalog）是按这个
GitHub topic 和 npm 的 `dsh-plugin` keyword 抓取的 —— 两个都设上，才有人找得到你。

注意 `install-local.mjs` 已在 `files` 白名单外，不会进发布包，但会进 git，这没问题。

## 3. 发布

```bash
npm publish
```

unscoped 包默认就是 public，不需要加 `--access public`（那是给 `@scope/name` 用的）。
首次发布会让你确认，并可能要求 2FA。

**发布是不可逆的**：72 小时后基本无法 unpublish（只能 deprecate）。所以先发 `1.0.0`，
别一上来就发 `latest` 之外的 tag 试水 —— 想试水用 `npm publish --tag next`，
装的人要显式写 `dsh-xcode-mcp@next` 才拿得到。

### 更进阶：带 provenance 发布

从 GitHub Actions 发布并加 `--provenance`，npm 会在包页面挂上「源码来自这个仓库的这次提交」
的可验证签名。对一个要装进别人开发机的插件来说，这是性价比最高的信任信号。

```yaml
# .github/workflows/publish.yml
name: publish
on:
  release: { types: [published] }
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }   # id-token 是 provenance 必需
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, registry-url: 'https://registry.npmjs.org' }
      - run: npm publish --provenance --access public
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
```

## 4. 验证

```bash
npm view dsh-xcode-mcp                     # 元数据、维护者、repository 是否对
npm view dsh-xcode-mcp dist.tarball        # 拿 tarball 下来解压，确认只有声明文件
npx -y dsh-xcode-mcp 2>&1 | head -3        # 应当没有任何可执行行为（本包无 JS）
```

最后一条会报错/无输出 —— **这是预期结果**：本包里一个 JS 文件都没有。

## 5. 别人怎么装

侧边栏 **Plugins** 页 → 输入 `dsh-xcode-mcp` → 安装 → 重启 DSH。
`plugin_manager` 会同时完成 `pnpm add` 和登记 `dsh.profile.bundles` 两步。

（提醒：只跑 `dsh plugin --profile <p> add dsh-xcode-mcp` 是**不够**的 —— 那只是 pnpm add，
不会登记进 bundles，装完不生效。）

## 6. 后续更新

```bash
npm version patch        # 或 minor / major，顺手打 git tag
npm publish
```

`version` 不变的话 npm 会拒绝重复发布。

---

## 让别人发现你的渠道清单

| 渠道 | 做法 |
|---|---|
| npm 搜索 | `package.json` 的 `keywords`（已含 `dsh-plugin`、`dsh-bundle`、`deepseek-harness`） |
| DSH 生态抓取 | GitHub repo 加 `dsh-plugin` topic ← **最重要** |
| 可视化市场 | 装 `dshmarket` 后在其目录里提交 / 被其 feed 收录 |
| 目录站 | [deepseekplugin.org](https://deepseekplugin.org/submit) 有「提交插件」页 |
| 社区 feed | npm 上的 `dsh-plugin-catalog`、`awesome-dsh-plugin-feed` 系列包 |

## 发布前自查

- [ ] `repository` / `author` / `homepage` / `bugs` 都已填
- [ ] `npm pack --dry-run` 只有 7 个文件，无 `install-local.mjs`
- [ ] `package.json` 里没有 `scripts`（本包确实没有 —— 这是卖点，写进 README）
- [ ] README 讲清了 Xcode 27+ 的硬性前提
- [ ] 仓库有 `LICENSE`（MIT 已有）
