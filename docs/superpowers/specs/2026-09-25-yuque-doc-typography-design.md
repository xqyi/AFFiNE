# 语雀风格文档排版：字体/字号/字重 设计文档

日期：2026-09-25
状态：待 review

## 背景

参考对象是语雀（Yuque）的文档视图，其阅读观感"舒服"主要来自三件事：
正文行高宽松、标题字号阶梯收窄（H2–H6 比 H1 递减得更快、更接近正文）、
中文使用专属字体（苹方/微软雅黑/Noto Sans CJK）而非通用 sans-serif 兜底。

本方案目标是：**在不改动 AFFiNE 依赖包 `@toeverything/theme` 的前提下**，
用一层 AFFiNE 侧的 CSS 变量覆盖层，把文档视图（page / edgeless 编辑器内的
标题、正文、代码块、文档标题）的字体族、字号、行高调整到贴近语雀观感。
本期**只出 spec，不动代码**；实现计划待 spec 通过 review 后另行制定。

### 现状（已核实的 AFFiNE 字体变量体系）

字体变量来自 `@toeverything/theme` 的 `baseTheme`，以 `--affine-*` 形式落到 DOM。
消费方全部读变量、不读常量，因此改默认值即可让下游自动生效。

| 变量 | 现值 | 消费方 |
|---|---|---|
| `--affine-font-h-1`…`-h-6` | 28/26/24/22/20/18px | `paragraph/src/styles.ts` 的 `.h1`–`.h6` |
| `--affine-font-base` | 15px | `page-root-block` / `surface-block`、正文基准 |
| `--affine-font-sm` / `-xs` | 14/12px | 代码块、附件、嵌入块等 |
| `--affine-font-family` | `'Inter','Source Sans 3',Poppins, …sans-serif, emoji`（**无 CJK 回退**） | `page-root-block`、`surface-block`、`page-editor` 等 |
| `--affine-font-code-family` | `'IBM Plex Mono','Space Mono',Consolas,Menlo,Monaco,Courier,monospace,…` | 代码块 `code/src/styles.ts`、行内 code |
| `--affine-line-height` | `calc(1em + 8px)` | 正文、代码块、列表 |
| 文档标题 | 硬编码 `40px / 50px / 700`（`doc-title/src/doc-title.ts`，**非变量**） | 文档顶部大标题 |

### 与语雀观感的核心差距

1. **字体栈缺 CJK 回退**：`fontSansFamily` / `fontCodeFamily` 末尾是 `sans-serif`+emoji，
   中文落到系统默认字体，观感偏生硬。这是本期最大痛点。
2. **H2–H6 字号偏大偏挤**：26/24/22/20/18px 比语雀的收窄节奏更"厚"。
3. **正文行高偏紧**：`calc(1em+8px)`（约 1.53）低于语雀常用的 1.7–1.75 阅读行高。
4. **文档标题硬编码 40px**：与 H1（28px）割裂，不进主题体系。

## 需求与确认项

1. **作用范围 = 仅文档视图**：page/edgeless 编辑器内的标题、正文、代码块、
   文档标题，以及 markdown/HTML 导入、导出、打印的字体表现。**不改 app 外壳 UI。**
 2. **字体族策略 = 保留 Inter/Source 系 + 补齐 CJK 回退链**（平台优先级：
    macOS 苹方 → 日文/韩文 → Windows 微软雅黑 → Noto Sans CJK，
    即 PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans CJK SC。）
3. **字号阶梯 = 对齐语雀收窄节奏**（见下方清单），行高略放宽。
4. **文档标题变量化**：新增 `--affine-font-title`，替换 `doc-title` 的硬编码 40px。
5. **行内 code 字号本期不动**（保持 `calc(base ∓ Npx)` 相对计算，避免连锁改动）。
6. 打印字体栈与正文保持一致，避免打印时中文回退到 Courier。

## CSS 变量清单（方案核心）

以下变量通过**新增覆盖层**写入（见"实现方式"），默认值与现有 `baseTheme` 一致，
只是把字体族与字号阶梯改到目标值：

```css
/* 字体族：西文保留 Inter/Source 系，中文补 CJK 回退链（关键改动） */
--affine-font-family:
  'Inter', 'Source Sans 3',
  'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
  'Noto Sans CJK SC', 'Noto Sans',
  apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif,
  'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';

/* 等宽字体：保留 Source Code Pro / IBM Plex / Space Mono，补 CJK 等宽回退 */
--affine-font-code-family:
  'Source Code Pro', 'IBM Plex Mono', 'Space Mono',
  Consolas, Menlo, Monaco,
  'Noto Sans Mono CJK SC', 'Noto Sans Mono',
  'Courier New', monospace;

/* 字号阶梯：对齐语雀收窄节奏（原 28/26/24/22/20/18） */
--affine-font-h-1: 30px;
--affine-font-h-2: 24px;
--affine-font-h-3: 20px;
--affine-font-h-4: 18px;
--affine-font-h-5: 16px;
--affine-font-h-6: 15px;

/* 正文基准（不变） */
--affine-font-base: 15px;

/* 文档标题：新增变量，替换硬编码 40px */
--affine-font-title: 30px;
--affine-font-title-line-height: 40px;

/* 行高：略放宽，提升中文阅读舒适度（原 calc(1em + 8px)） */
--affine-line-height: calc(1em + 10px);
```

> 注：标题字重维持现状（`.h1`=700、`.h2`–`.h6`=600，见 `paragraph/src/styles.ts`），
> 与语雀一致，本清单不覆盖字重。

## 实现方式（定位，不含代码）

### 1. 新增覆盖层（唯一需要新建的文件）

- 新建 `packages/frontend/component/src/theme/typography.css`：
  内容即上面"CSS 变量清单"里的 `:root { … }`。
- 在 `packages/frontend/component/src/theme/theme.css.ts` 顶部
  `import './typography.css';`（该文件已被 `@affine/component` 入口引入，
  全局生效）。
- 该层写在 `:root` 上，**覆盖** `@toeverything/theme` 注入的同名变量默认值，
  不碰依赖包、可被主题编辑器与"自定义字体/字号"设置继续覆盖（它们作用在
  `document.documentElement.style`，优先级高于 `:root`，行为不变）。

### 2. 自动生效的消费方（无需改动）

- 标题 `.h1`–`.h6`：`blocksuite/affine/blocks/paragraph/src/styles.ts` 全用
  `var(--affine-font-h-N)`，默认值改了即生效。
- 代码块：`blocksuite/affine/blocks/code/src/styles.ts` 用
  `--affine-font-code-family` + `--affine-font-xs`，族改了即生效。
- 正文：`page-root-block.ts` / `surface-block.ts` / `page-editor.ts` /
  `edgeless-editor.ts` 用 `--affine-font-family` + `--affine-font-base` +
  `--affine-line-height`，全自动生效。

### 3. 定点改动（2 处）

- **文档标题变量化**：`blocksuite/affine/fragments/doc-title/src/doc-title.ts`
  中 `.doc-title-container` 的 `font-size: 40px; line-height: 50px`
  改为 `font-size: var(--affine-font-title, 30px); line-height: var(--affine-font-title-line-height, 40px)`。
  新增的 2 个变量由覆盖层提供默认值。
- **打印字体栈同步**：`@toeverything/theme` 的 `printTheme` 单独定义了
  `fontSansFamily`/`fontCodeFamily`。因本期不改依赖包，打印场景沿用默认 `:root`
  覆盖层即可（`page-root-block` 打印也读 `--affine-font-family`）。
  若后续发现打印中文仍回退 Courier，再评估是否扩展覆盖层加打印 media query。

## 文件级改动清单

| 文件 | 改动 |
|---|---|
| `packages/frontend/component/src/theme/typography.css`（新建） | `:root` 写入清单里全部变量默认值 |
| `packages/frontend/component/src/theme/theme.css.ts` | 顶部 `import './typography.css'` |
| `blocksuite/affine/fragments/doc-title/src/doc-title.ts` | `.doc-title-container` 的 font-size/line-height 改读新变量 |

## 测试要点

- **视觉回归**：打开一个含 H1–H6、正文、代码块、行内 code 的文档，
  截图对比改前/改后，确认：① 中文渲染走 CJK 字体而非系统 sans-serif；
  ② 标题阶梯收窄、不再"厚挤"；③ 正文行高更宽松；④ 文档标题与 H1 协调。
- **主题切换**：切换 light/dark，确认变量层不破坏色板（本期只动字体/字号/行高，
  不动颜色，色板应完全不变）。
- **设置覆盖**：在"设置→编辑器→字号"拖动 `--affine-font-base`、
  "字体"选自定义字体，确认仍按原优先级覆盖 `:root` 默认值（行为不变）。
- **打印/PDF**：导出或打印一份含中文文档，确认字体族未回退 Courier。
- **e2e**：`tests/affine-local/e2e/blocksuite` 下标题/代码相关断言
  若硬编码了旧字号（28px 等），同步更新。

## 风险与决策记录

- **CJK 字体可用性**：桌面端（Electron）各平台系统自带 苹方/微软雅黑，
  字体栈按平台优先级排序，不强依赖 Noto；Web 端无 Noto 时落到系统 sans-serif，
  观感可接受。
- **主题编辑器变量树**：`theme-editor/resource.ts` 用 `lightCssVariables`/
  `darkCssVariables` 生成可编辑树，font 变量已在其内；`:root` 覆盖层只改默认值，
  编辑器显示同步、不需额外处理。新增 `--affine-font-title`/`-line-height` 两个变量
  不在 v1 变量表内，编辑器不会列出它们（可接受，它们只是排版默认值）。
- **行内 code 字号**：本期保持 `calc(base ∓ Npx)`，若后续要贴语雀 ~13px
  代码小片，再单独立项加 `--affine-font-code-inline`。
- **决策（用户已确认方向）**：仅文档视图；保留 Inter/Source + 加 CJK 回退；
  字号阶梯 30/24/20/18/16/15；行高 `calc(1em+10px)`；文档标题变量化。
