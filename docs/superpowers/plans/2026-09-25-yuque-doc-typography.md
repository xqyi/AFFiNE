# 语雀风格文档排版 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过新增 `:root` CSS 变量覆盖层 + 文档标题变量化，把 AFFiNE 文档视图的字体族/字号/行高调整到语雀观感。

**Architecture:** 不改依赖包 `@toeverything/theme`；在 `@affine/component/theme` 新建 `typography.css` 覆盖层（`:root` 变量默认值），由 `theme.css.ts` 引入；`doc-title` 硬编码 40px 改为读新变量。下游消费方（paragraph 标题、code 块、page-root/surface 正文）全部读变量，自动生效。

**Tech Stack:** 纯 CSS 变量 + lit `css`` 模板（仅 doc-title 一处改 TS 内联样式），无新依赖。

## Global Constraints

- 作用范围：**仅文档视图**（page/edgeless 编辑器内的标题、正文、代码块、文档标题 + 导入/导出/打印）。不改 app 外壳 UI。
- **不改动** `node_modules/@toeverything/theme`。
- 行内 code 字号（`calc(var(--affine-font-base) ± Npx)`）**本期不动**。
- 标题字重维持现状（`.h1`=700、`.h2`–`.h6`=600）。
- 变量默认值必须可被现有"设置→字号/自定义字体"继续覆盖（它们写在 `document.documentElement.style`，优先级高于 `:root`，行为不变——不新增任何 `!important`）。
- 不新增任何与颜色相关的变量（本期只动字体/字号/行高）。

### 变量清单（各任务引用同一组值，务必保持一致）

```
--affine-font-family          = 'Inter', 'Source Sans 3', 'PingFang SC', 'Hiragino Sans GB',
                                'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans',
                                apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial,
                                sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
                                'Segoe UI Symbol', 'Noto Color Emoji';
--affine-font-code-family     = 'Source Code Pro', 'IBM Plex Mono', 'Space Mono', Consolas,
                                Menlo, Monaco, 'Noto Sans Mono CJK SC', 'Noto Sans Mono',
                                'Courier New', monospace;
--affine-font-h-1             = 30px;   (原 28px)
--affine-font-h-2             = 24px;   (原 26px)
--affine-font-h-3             = 20px;   (原 24px)
--affine-font-h-4             = 18px;   (原 22px)
--affine-font-h-5             = 16px;   (原 20px)
--affine-font-h-6             = 15px;   (原 18px)
--affine-font-base            = 15px;   (不变)
--affine-font-title           = 30px;   (新增)
--affine-font-title-line-height = 40px; (新增)
--affine-line-height          = calc(1em + 10px);  (原 calc(1em + 8px))
```

---

### Task 1: 新建 typography.css 覆盖层并接入主题

**Files:**

- Create: `packages/frontend/component/src/theme/typography.css`
- Modify: `packages/frontend/component/src/theme/theme.css.ts:1`（加 import）

**Interfaces:**

- Consumes: 无（首个任务）。
- Produces: `:root` 上 10 个变量默认值（上方"变量清单"）。后续 Task 依赖这些变量已在全局生效。

- [ ] **Step 1: 写 typography.css（含可断言的测试锚点）**

创建 `packages/frontend/component/src/theme/typography.css`，内容：

```css
/*
 * Yuque-style document typography override layer.
 *
 * Written to :root so it OVERRIDES the baseTheme defaults injected by
 * @toeverything/theme (those variables resolve at the same scope), while
 * remaining lower priority than user overrides on document.documentElement
 * (Settings -> font size / custom font), which is required behavior.
 *
 * See docs/superpowers/specs/2026-09-25-yuque-doc-typography-design.md
 */
:root {
  /* font families: keep Inter/Source, add CJK fallback chain */
  --affine-font-family:
    'Inter', 'Source Sans 3', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans', apple-system,
    BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';

  --affine-font-code-family:
    'Source Code Pro', 'IBM Plex Mono', 'Space Mono', Consolas, Menlo, Monaco,
    'Noto Sans Mono CJK SC', 'Noto Sans Mono', 'Courier New', monospace;

  /* heading scale: compress to Yuque rhythm */
  --affine-font-h-1: 30px;
  --affine-font-h-2: 24px;
  --affine-font-h-3: 20px;
  --affine-font-h-4: 18px;
  --affine-font-h-5: 16px;
  --affine-font-h-6: 15px;

  /* body base unchanged */
  --affine-font-base: 15px;

  /* doc title (replaces the hard-coded 40px in doc-title.ts) */
  --affine-font-title: 30px;
  --affine-font-title-line-height: 40px;

  /* looser reading line-height for CJK comfort */
  --affine-line-height: calc(1em + 10px);
}
```

- [ ] **Step 2: 接入 theme.css.ts**

在 `packages/frontend/component/src/theme/theme.css.ts` 第 1 行之前加：

```ts
import './typography.css';
```

改后文件顶部：

```ts
import './typography.css';
import { cssVar } from '@toeverything/theme';
import { globalStyle } from '@vanilla-extract/css';

globalStyle('body', {
  color: cssVar('textPrimaryColor'),
  fontFamily: cssVar('fontFamily'),
  fontSize: cssVar('fontBase'),
});
```

- [ ] **Step 3: 静态验证 CSS 语法**

Run:

```powershell
cd E:\AFFiNE\AFFiNE
npx eslint packages/frontend/component/src/theme/typography.css packages/frontend/component/src/theme/theme.css.ts
```

Expected: 0 error（若该目录未纳入 eslint 范围则报 "file ignored"，属正常，以下一步构建为准）。

- [ ] **Step 4: 构建 @affine/component 确认 CSS 被打包**

Run:

```powershell
cd E:\AFFiNE\AFFiNE
yarn affine build component 2>&1 | Select-String -Pattern "error|typography|failed"
```

Expected: 无 `error`/`failed`；若构建脚本名不同（`yarn --cwd packages/frontend/component build` 无 build script），改用 `yarn affine bundle --package @affine/component` 或直接跳到 Task 2 的 dev server 验证（变量层是否注入由浏览器实测决定，构建通过即可）。

- [ ] **Step 5: Commit**

```powershell
cd E:\AFFiNE\AFFiNE
git add packages/frontend/component/src/theme/typography.css packages/frontend/component/src/theme/theme.css.ts
git commit -m "feat(theme): add yuque-style typography override layer (:root font/size/line-height vars)"
```

---

### Task 2: 文档标题变量化

**Files:**

- Modify: `blocksuite/affine/fragments/doc-title/src/doc-title.ts:21-25`（`.doc-title-container` 的 font-size/line-height）

**Interfaces:**

- Consumes: Task 1 提供的 `--affine-font-title` / `--affine-font-title-line-height`（带 fallback，Task 1 缺省时也能独立工作）。
- Produces: 文档标题尺寸跟随变量。

- [ ] **Step 1: 改 doc-title.ts 内联样式**

将 `blocksuite/affine/fragments/doc-title/src/doc-title.ts` 中：

```ts
  static override styles = css`
    .doc-title-container {
      font-size: 40px;
      line-height: 50px;
      font-weight: 700;
    }
```

改为：

```ts
  static override styles = css`
    .doc-title-container {
      font-size: var(--affine-font-title, 30px);
      line-height: var(--affine-font-title-line-height, 40px);
      font-weight: 700;
    }
```

- [ ] **Step 2: 类型检查 blocksuite fragment**

Run:

```powershell
cd E:\AFFiNE\AFFiNE\blocksuite
yarn tsc -b --force 2>&1 | Select-String -Pattern "error TS" | Select-Object -First 10
```

Expected: 无 `error TS`（纯 CSS 字符串改动，正常应零报错）。

- [ ] **Step 3: Commit**

```powershell
cd E:\AFFiNE\AFFiNE
git add blocksuite/affine/fragments/doc-title/src/doc-title.ts
git commit -m "refactor(doc-title): drive title size/line-height from --affine-font-title vars"
```

---

### Task 3: 浏览器实测验证（验收）

**Files:** 无改动，仅验证。

**Interfaces:**

- Consumes: Task 1 + Task 2。

- [ ] **Step 1: 启动 web dev server**

Run:

```powershell
cd E:\AFFiNE\AFFiNE
yarn affine dev web
```

Expected: dev server 起在 `http://localhost:8080`（rspack dev server 默认端口；如端口被占用会提示其他端口，以终端输出为准）。

- [ ] **Step 2: 建一篇测试文档，逐项核对**

在应用里新建文档，依次输入：`# H1 标题`、`## H2 小节`、`### H3`、`#### H4`、`##### H5`、`###### H6`、一段中文正文（≥5 行）、一个含 `apt install <pkg>` 的行内 code、一个 `bash` 代码块、文档标题写"Ubuntu 运维手册"。用浏览器 DevTools 核对：

| 检查项                                                             | 期望                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `getComputedStyle(document).getPropertyValue('--affine-font-h-1')` | `30px`                                                                              |
| `--affine-font-h-6`                                                | `15px`                                                                              |
| `--affine-line-height`                                             | `calc(1em + 10px)` 或计算值 ≥ 25px                                                  |
| 正文 `font-family` 计算值                                          | 以 `Inter`（或已装 CJK 字体）开头，**含** `PingFang SC`/`Microsoft YaHei`（按平台） |
| 代码块 `font-family`                                               | 以 `Source Code Pro` 或 `IBM Plex Mono` 开头                                        |
| 文档标题高度观感                                                   | 30px/40px，与 H1 协调、不再 40px 割裂                                               |
| 中文渲染                                                           | 苹方/微软雅黑（系统字体），非生硬默认 sans-serif                                    |

Run（在 DevTools Console 内）：

```js
const cs = getComputedStyle(document.documentElement);
[
  cs.getPropertyValue('--affine-font-h-1'),
  cs.getPropertyValue('--affine-font-h-6'),
  cs.getPropertyValue('--affine-line-height'),
  cs.getPropertyValue('--affine-font-title'),
].map(s => s.trim());
```

Expected: `['30px','15px','calc(1em + 10px)','30px']`。

- [ ] **Step 3: 主题切换 + 设置覆盖回归**

1. 切 light/dark：色板应**完全不变**（本期未动颜色变量）。
2. 设置 → 编辑器 → 字号 拖到 20px：正文应变 20px（`documentElement.style` 优先级高于 `:root`，覆盖生效）。
3. 打印预览（Ctrl+P）含中文文档：中文不应回退 Courier。

- [ ] **Step 4: 记录结果**

把 Step 2 表格逐项 PASS/FAIL 结果追加记录（可口头汇报；若某项 FAIL，回到 Task 1/2 修）。

- [ ] **Step 5: 最终 Commit（若有微调）**

```powershell
cd E:\AFFiNE\AFFiNE
git status --short
# 仅当 Step 3 暴露需修正时才 add/commit；纯验证无改动则跳过
```

---

## Self-Review 记录

1. **Spec coverage**：spec 的"需求与确认项"6 条 → Task 1（字体族/字号/行高/标题变量 4 条）、Task 2（doc-title 硬编码）、Task 3（打印/设置覆盖验证）。✅
2. **Placeholder scan**：无 TBD/TODO；每个改动步骤含完整 before/after 代码。✅
3. **Type consistency**：变量名在"变量清单"、Task 1 CSS、Task 2 fallback 三处一致（`--affine-font-title` / `--affine-font-title-line-height`）。✅

## 风险与回滚

- `:root` 覆盖层若与未来主题编辑器生成的变量树冲突：编辑器变量只列 `lightCssVariables` 内 key，`--affine-font-title*` 两个新变量不在其中，编辑器不会列出，互不影响。
- 回滚：`git revert` 两个 commit（Task 1 / Task 2）即可，无数据迁移。
