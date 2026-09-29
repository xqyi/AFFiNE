# 自定义改动清单：xqyi/0274 相对上游基线 b4c8548c0

> 本文档罗列本分支相对上游共同祖先的全部改动，用于合并上游（merge/rebase）时评估冲突与保留策略。
>
> - **本分支**：`xqyi/0274`（远程 `origin/xqyi/0274`，HEAD = `fd7706437`）
> - **上游基线**：`b4c8548c0`（`feat(server): normalize timestamp`，版本 `0.27.0`）——`HEAD` 与 `origin/canary` 的 merge-base
> - **生成时间**：2026-09-29
> - **生成命令**：`git diff b4c8548c0..HEAD`

## 概览

| 指标                   | 值              |
| ---------------------- | --------------- |
| 领先 commit 数         | 24              |
| 落后上游 commit 数     | 49              |
| 变更文件总数           | 154             |
| 代码行                 | +3467 / −273    |
| 其中 `package.json`    | 123（纯版本号） |
| 非 `package.json` 文件 | 31              |

### 合并冲突面预判

双方都修改过的文件共 **124 个**：123 个 `package.json` + `yarn.lock`。
**业务代码（`ts`/`tsx`）重叠为 0 个** —— 冲突全部集中在版本号与依赖声明。

```
b4c8548c0  "version": "0.27.0"
    ├── 本分支  "version": "0.27.4"   ← 5d60353a9 统一改写
    └── 上游    "version": "0.27.5"   ← 上游独立做了同样的改写
```

> **已实测验证**（2026-09-28 试合并后回滚）：冲突数确为 **124**（123 个 `package.json` + `yarn.lock`），
> 与本节预判一致。除 `version` 字段外无其他冲突。
>
> 需注意：outline 的 vite-plugin **不会**产生冲突标记（上游未改该字段），须主动修改——详见第四节。

---

## 一、功能性改动（业务代码）

### 1.1 语雀风格文档排版（yuque typography）

引入统一的 CSS 覆盖层，把字体、标题层级、行高改为可配置变量。

| 文件                                                              | 变更           | 说明                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/component/src/theme/typography.css`            | **新增** 54 行 | `:root` 覆盖层：单一 sans 字体栈 `--affine-font-sans-family`（Inter 优先，追加共享的 `--affine-cjk-stack`）、标题 h1–h6 改用 em 表达（16px 基准下 30/24/20/18/17/16px）、`--affine-font-title: 30px`、`--affine-line-height: calc(1em + 10px)`、`--affine-line-height-heading: calc(1em + 6px)` |
| `packages/frontend/component/src/theme/index.ts`                  | +1 行          | 引入 `./typography.css`                                                                                                                                                                                                                                                                         |
| `blocksuite/affine/fragments/doc-title/src/doc-title.ts`          | 改 2 行        | 硬编码 `40px/50px` → `var(--affine-font-title, 30px)` / `var(--affine-font-title-line-height, 40px)`                                                                                                                                                                                            |
| `blocksuite/affine/blocks/code/src/highlight/affine-code-unit.ts` | 删 1 行        | 移除内联代码 `font-size: calc(var(--affine-font-base) - 3px)` 覆盖                                                                                                                                                                                                                              |
| `blocksuite/affine/blocks/list/src/styles.ts`                     | 删 1 行        | 移除列表内联代码字号覆盖                                                                                                                                                                                                                                                                        |
| `blocksuite/affine/blocks/paragraph/src/styles.ts`                | +22 / −38      | 标题六个层级改用 `--affine-line-height-heading` 与 `letter-spacing: normal`；标题内联代码统一为 `calc(var(--affine-font-base) + 2px)`                                                                                                                                                           |

> 设计意图：覆盖层本身来自 `a543d0d8e`（新增 `:root` 变量层）、`c1246b336`（改为从 `index.ts` 引入）、`568c6e273`（标题字号改由变量驱动）；内联代码不再自带缩小字号（`bd64770fa` / `a2ab1b64b`）；`fd7706437` 起，标题字号改为跟随 `--affine-font-base` 的 em 表达，CJK 回退链真正进入文档视图，六个标题层级的内联代码统一为 `calc(var(--affine-font-base) + 2px)`。
> 悬空引用已清理：原注释指向的 spec 文件已随 `f4e9087f9` 删除，`typography.css` 中的该行注释已移除。

### 1.2 大纲（Outline）折叠/缩进重构

改动量最大的一块：+936 / −94 行，新增树工具与测试。

| 文件                                                                          | 变更            | 说明                                                                                                                                                          |
| ----------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocksuite/affine/fragments/outline/src/utils/outline-tree.ts`               | **新增** 195 行 | 核心数据结构 `OutlineRow { block, collapsed, hasChildren }`；`isHeadingBlock` 鸭子类型判断（避免单测环境 `instanceof` 失效）                                  |
| `blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts` | **新增** 201 行 | 树遍历单元测试                                                                                                                                                |
| `blocksuite/affine/fragments/outline/vitest.config.ts`                        | **新增** 36 行  | 该 fragment 独立 vitest 配置                                                                                                                                  |
| `blocksuite/affine/fragments/outline/src/outline-viewer.ts`                   | +169            | 滚动指示条与折叠状态解耦；箭头随文本缩进；叶子缩进 +1 个中文字符；H1 默认展开；箭头改为实心三角并让按钮铺满 22px 行盒居中；去掉卡片 hover 底色（`c5d25f85d`） |
| `blocksuite/affine/fragments/outline/src/card/outline-card.ts`                | +57             | 折叠按钮交互                                                                                                                                                  |
| `blocksuite/affine/fragments/outline/src/card/outline-card.css.ts`            | +53             | 新增 `outlineRow` / `toggle` 样式                                                                                                                             |
| `blocksuite/affine/fragments/outline/src/card/outline-preview.ts`             | +78             | 预览渲染                                                                                                                                                      |
| `blocksuite/affine/fragments/outline/src/card/outline-preview.css.ts`         | +61             | 预览样式                                                                                                                                                      |
| `tests/affine-local/e2e/.../outline-panel.spec.ts`                            | +76             | e2e 新增用例                                                                                                                                                  |
| `tests/affine-local/e2e/.../outline-viewer.spec.ts`                           | +97             | 修复默认折叠行为的既有 spec                                                                                                                                   |

> ⚠️ **合并高风险区**：这是本分支唯一有实质业务逻辑的改动区。功能点分散在 8 个文件，若上游同期改动 outline 相关代码，需人工逐文件合并。

### 1.3 侧边栏文案与排序

| 文件                                                               | 变更    | 说明                                                                       |
| ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------- |
| `packages/frontend/i18n/src/resources/zh-Hans.json`                | 改 1 行 | `com.affine.rootAppSidebar.collections`：`精选` → `动态`                   |
| `packages/frontend/core/src/components/root-app-sidebar/index.tsx` | 换序    | `NavigationPanelCollections` 提到 `NavigationPanelMigrationFavorites` 之前 |

---

## 二、构建 / 打包工具链

### 2.1 新增脚本

| 文件                                                                | 行数 | 用途                                                                                                                       |
| ------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/apps/electron/scripts/package-green.ts`          | +348 | 免安装绿色包构建：组装 Electron runtime + `resources/app` + 运行时依赖 + 嵌入图标                                          |
| `packages/frontend/apps/electron/scripts/embed-exe-icon.mjs`        | +207 | rcedit 封装，嵌入 `icon_<buildType>.ico` 与 PE 版本串，逐张校验 ICO 图像已落盘                                             |
| `packages/frontend/apps/electron/scripts/stage-runtime-deps.mjs`    | +181 | 补齐 esbuild `external` 的运行时 `node_modules`（`electron-updater`/`yjs`/`semver` 等 19 包），逐个验证可从 app 目录内解析 |
| `packages/frontend/apps/electron/scripts/fix-squirrel-stub-icon.ts` | +164 | 修复 Squirrel 执行桩（`lib/net45/*_ExecutionStub.exe`）图标                                                                |
| `scripts/set-version.mjs`                                           | +30  | Windows 版 `set-version.sh`（原版依赖 `jq` + bash），遍历 yarn workspaces 统一版本号                                       |
| `AGENT.md`                                                          | 新增 | 手动打包指南                                                                                                               |
| `docs/handoff.md`                                                   | 新增 | 会话交接 + 编译打包流程                                                                                                    |

### 2.2 修改脚本

| 文件                                   | 变更    | 说明                                                                                                                                                    |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/dev.ts`（electron）           | +8/−2   | **Windows 修复**：绕过 `node_modules/.bin/electron.cmd`（shim 路径带尾随换行导致 `spawn()` 失败），直接 spawn `node_modules/electron/dist/electron.exe` |
| `scripts/make-env.ts`（electron）      | 改 3 行 | `fileURLToPath(new URL('.', import.meta.url))` → `dirname(fileURLToPath(import.meta.url))`，修复 Windows 下的 `__dirname` 计算                          |
| `scripts/make-squirrel.ts`（electron） | +6      | 打包后调用 `fixSquirrelStubIcon()`，避免开始菜单快捷方式显示 Electron 默认图标                                                                          |
| `.gitignore`                           | +1 行   | `!AGENT.md`（因 `/*.md` 全局忽略，需显式放行）                                                                                                          |

---

## 三、版本号统一

| 文件                  | 变更                | 说明                          |
| --------------------- | ------------------- | ----------------------------- |
| 123 个 `package.json` | `0.27.0` → `0.27.4` | 一次性改写全部 yarn workspace |

**涉及原因**：UI「关于」对话框显示的版本来自 `BUILD_CONFIG.appVersion`，而它由
`getBuildConfig(new Package('@affine/electron-renderer'))` 在 **rspack 构建期**从
`@affine/electron-renderer` 的 `package.json` 静态注入——只改
`packages/frontend/apps/electron/package.json` 对 UI 显示无效。

相关 commit：

- `c3184508b` 仅改 `apps/electron`（有效但不足够）
- `5d60353a9` 全量统一（真正生效的提交）

---

## 四、依赖调整

| 文件                                               | 变更                                               | 风险            |
| -------------------------------------------------- | -------------------------------------------------- | --------------- |
| `blocksuite/affine/fragments/outline/package.json` | `@vanilla-extract/vite-plugin` `~5.0.0` → `^5.0.0` | ⚠️ 需裁决       |
| `yarn.lock`                                        | +259 行                                            | ⚠️ 跟随上述变更 |

对应 commit `1c05be17b`（"align @vanilla-extract/vite-plugin in outline fragment to ^5.0.0"）。

### 4.1 重要澄清：上游从未在 outline 设定过该依赖

初次梳理时曾判断「上游在同一字段独立演进到 `~5.1.5`」，**该判断有误**。核实后的事实是：

**上游的 `~5.1.5` 仅存在于以下 4 个文件：**

| 文件                                       | 上游取值 |
| ------------------------------------------ | -------- |
| `package.json`（根）                       | `~5.1.5` |
| `blocksuite/affine/all/package.json`       | `~5.1.5` |
| `blocksuite/integration-test/package.json` | `~5.1.5` |
| `blocksuite/playground/package.json`       | `~5.1.5` |

**`blocksuite/affine/fragments/outline/package.json` 不在其中。** 上游对该文件的唯一改动是 `version` 字段：

```diff
# git diff b4c8548c0..upstream/canary -- blocksuite/affine/fragments/outline/package.json
   "version": "0.27.0"    →  "version": "0.27.5"
```

`vite-plugin` 依赖本身是本分支 `1c05be17b` **单方面新增**的（基线 `b4c8548c0` 的 outline 依赖中并无此项）。

### 4.2 修正后的决策含义

因此「采用上游的 `~5.1.5`」的正确解读是：

> **把 outline 的 vite-plugin 提升到与上游其余 4 处相同的版本**，
> 而非「跟随上游已有的取值」。

该依赖不可删除——它服务于 `1e8f7f352` 一系提交新增的 `blocksuite/affine/fragments/outline/vitest.config.ts`，是该 fragment 独立运行 vitest 的必要条件。

**已采纳的裁决：`~5.1.5`**（与上游根配置对齐）。

> 合并时该字段**不会**产生冲突标记（双方对它的改动不重叠），需主动修改。
> `yarn.lock` 会因该依赖变更而需要重新生成，应直接跑 `yarn install` 而非手工解冲突。

---

## 五、Commit 明细（24 个，按时间倒序）

| SHA         | 日期  | 说明                                                                                                |
| ----------- | ----- | --------------------------------------------------------------------------------------------------- |
| `fd7706437` | 09-29 | style(theme,paragraph): make the CJK fallback reach the doc view, scale headings with the base size |
| `e591f4997` | 09-28 | docs: document the machine-local yarn shim                                                          |
| `c5d25f85d` | 09-28 | feat(outline): solid disclosure arrow, centre it on the text, drop card hover background            |
| `c3c94d046` | 09-28 | docs: document custom changes on xqyi/0274 vs upstream base b4c8548c0                               |
| `5d60353a9` | 09-28 | chore(release): unify all workspace versions to 0.27.4 and add green packaging scripts              |
| `1c05be17b` | 09-27 | fix(deps): align @vanilla-extract/vite-plugin in outline fragment to ^5.0.0                         |
| `c3184508b` | 09-27 | chore(release): set electron app version to 0.27.4 to match official v0.27.4 tag                    |
| `f4e9087f9` | 09-27 | chore(port): drop superpowers spec/plan bundled in the outline-viewer commit                        |
| `468cab4ff` | 09-27 | docs(agent): add missing V8 snapshot copy step to manual packaging (blank window fix)               |
| `506125dd0` | 09-26 | docs(agent): restore step 4.5 rcedit icon embed + stub icon verification                            |
| `22d7a5fbb` | 09-26 | fix(build): embed app icon into Squirrel execution stub                                             |
| `bd64770fa` | 09-26 | style(list,paragraph): drop inline code font-size override (yuque alignment)                        |
| `a2ab1b64b` | 09-26 | style(code): inline code inherits body font-size (yuque alignment)                                  |
| `c1246b336` | 09-26 | fix(theme): import typography.css from index.ts instead of theme.css.ts                             |
| `568c6e273` | 09-26 | refactor(doc-title): drive title size/line-height from --affine-font-title vars                     |
| `a543d0d8e` | 09-26 | feat(theme): add yuque-style typography override layer                                              |
| `b19b61874` | 09-25 | docs: step 4.5 now uses full rcedit                                                                 |
| `e4773e610` | 09-25 | docs: add step 4.5 (rcedit icon embed) and patch productName + icons                                |
| `3bccf2e85` | 09-25 | docs: add AGENT.md packaging guide, unignore it                                                     |
| `9f44f66b3` | 09-25 | feat(sidebar): rename Collections to '动态' and reorder nav sections                                |
| `1e8f7f352` | 09-25 | feat(outline): follow arrow with text indent, leaf indent +1 CJK char, expand H1 by default         |
| `f64dc1392` | 09-23 | fix(outline): decouple scroll-indicator rail from collapse state                                    |
| `2411fef4b` | 09-23 | test(outline): fix e2e specs and tree traversal for collapsed-by-default behaviour                  |
| `0ed930613` | 09-23 | feat(outline): increase heading indent to 1em and add collapse/expand                               |

---

## 六、合并上游时的决策点

| #   | 决策                | 选项                                                | 建议                                                              |
| --- | ------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 版本号              | `0.27.5`（上游）/ `0.27.4`（本分支）                | ✅ **已定：`0.27.4`**，保持与自托管 server 0.27.4 对齐            |
| 2   | outline vite-plugin | `~5.1.5`（与上游其余 4 处对齐）/ `^5.0.0`（本分支） | ✅ **已定：`~5.1.5`**，见 4.2 —— 该值由本分支主动提升，非跟随上游 |
| 3   | outline 折叠逻辑    | 全保留 / 部分回退                                   | 全保留，除非上游有实质冲突                                        |
| 4   | 语雀排版            | 全保留 / 部分回退                                   | 全保留，与上游无重叠                                              |
| 5   | 打包脚本            | 全保留                                              | 全保留，本分支独有，上游无同类改动                                |

### 已知遗留问题

1. **原生模块重建后的无关漂移**（当前工作区无此项）：`packages/frontend/native/index.{js,d.ts}` 存在 NAPI-RS 重新生成导致的 `eslint-disable` → `oxlint-disable` 漂移，与本分支功能无关。
