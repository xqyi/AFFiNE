# 大纲视图：层级缩进 + 折叠/展开 设计文档

日期：2026-09-23
状态：已确认

## 背景

右侧文档大纲（Table of Contents，`affine-outline-viewer`，以及侧边栏大纲面板 `outline-panel`）由
`blocksuite/affine/fragments/outline` 这个 fragment 提供，渲染链路为：

- `OutlineViewer`（`src/outline-viewer.ts`）：右侧悬浮的迷你大纲，hover 展开成 200px 面板。
- `OutlinePanelBody`（`src/body/outline-panel-body.ts`）：侧边栏大纲面板主体，按 note 卡片渲染。
- `OutlineNoteCard`（`src/card/outline-card.ts`）：单张 note 卡片，内部逐块渲染
  `affine-outline-block-preview`。
- `OutlineBlockPreview`（`src/card/outline-preview.ts` + `src/card/outline-preview.css.ts`）：
  单个大纲行，按块类型（标题/普通）渲染文本 + 图标。

大纲数据模型：note 的 children 是扁平块序列，标题（h1-h6）并不嵌套，"层级"仅是按
`type` 的 level 视觉呈现。

## 需求与确认项

1. 大纲层级缩进增大为"1 个汉字"宽。
2. 默认所有层级收缩；点击标题节点可展开/收缩：
   - 展开：仅展开该节点的"下一级"子节点，更深层保持收缩。
   - 收缩：将该节点下所有后代一并收缩。
3. 折叠/展开状态**不跨会话持久化**：每次打开面板重置为全折叠。
4. 折叠粒度：**仅标题节点（h1-h6）参与折叠**；文档标题与 note 卡片不可折叠。

## 需求 1：缩进

- 大纲字号为 12px（`fontSm`），1 个汉字宽 = 12px = 1em。
- 改法：`subtypeStyles` 与各消费方的 `paddingLeft` 改为 `1em` 倍数：
  - title / h1 = 0
  - h2 = 1em
  - h3 = 2em
  - h4 = 3em
  - h5 = 4em
  - h6 = 5em
  - 普通文本（`textGeneral`）= 6em（与 h6 之后一档对齐，非标题行保持最右）
- 涉及文件：
  - `src/card/outline-preview.css.ts`：`subtypeStyles`、`textGeneral`。
  - `src/body/outline-panel-body.css.ts`：`h2`/`h3` 的 `padding-left` 与上面对齐。
- `OutlineViewer` 与大纲面板共用 `affine-outline-block-preview`，改动同时生效。

## 需求 2：折叠/展开

### 数据形态

- 每个 note 卡片（`OutlineNoteCard`）持有本地折叠状态信号：
  `private _collapsedHeadings$ = signal<Set<string>>(new Set())`
  初值全部折叠：该 note 下所有含后代的标题 id 进入 set。
  "含后代"判定：某标题 id 之后存在 level 更深的标题，即它可折叠。
- 状态随卡片实例存在，卡片重建（重渲染/重连）即重置 → 满足"不跨会话"。
- 默认全折叠时，note 卡片只显示其直接子级（level = 最小 level 的标题们），
  即文档顶层结构，孙子级隐藏。

### 渲染

- 在 `OutlineNoteCard` 内，把 note 的 children 按标题 level 切成树：
  - 顶层 = 第一个最小 level 的标题及其之前的块。
  - 对每个可折叠标题，只渲染其"直接子级"（level 恰好 +1 的标题及其中间的块）；
    更深后代不渲染（收起）。
  - 实现：写一个纯函数 `buildOutlineTree(note, collapsed: Set<string>)` 返回
    扁平化的有序行（`{ block, level, collapsed, hasChildren }`），渲染侧只消费扁平数组，
    递归逻辑与渲染解耦。
- 每个有子代的标题行，左侧渲染一个 toggle 图标（chevron 展开/收起，`@blocksuite/icons`
  现成图标，如 `ArrowDownSmallIcon` / 旋转 -90 表示收起）。点击 toggle 切换该 id 的
  collapsed 状态并 `requestUpdate`；标题文本本身的点击行为不变（滚动定位）。

### 交互规则

- 展开：从 collapsed 集合移除该 id（其直接子级显示，更深层仍折叠）。
- 收缩：将该 id 及其所有后代的 id 重新加入 collapsed 集合（整棵子树隐藏）。
- 叶子标题（无后代）无 toggle，不受影响。
- 面板初始：全部可折叠标题 collapsed。

### 影响面

- 右侧 `OutlineViewer`：它独立渲染一份扁平列表（`getHeadingBlocksFromDoc`），
  需求描述聚焦"右侧文档大纲视图"。为保持右侧 mini 大纲轻量，行为同样生效：
  右侧 viewer 复用 `buildOutlineTree` + 卡片内部的折叠状态机制。
  最小做法：右侧 viewer 也按 note 分组渲染同样的卡片（当前它其实已渲染全部标题行），
  为其增加同样的折叠逻辑。
- 测试文件更新：
  - `tests/affine-local/e2e/blocksuite/outline/outline-panel.spec.ts`
  - `tests/affine-local/e2e/blocksuite/outline/outline-viewer.spec.ts`
    中涉及"所有标题默认显示"的断言需改为"默认仅顶层显示"。

## 文件级改动清单

| 文件                                 | 改动                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| `src/card/outline-preview.css.ts`    | 缩进改 1em 倍数                                                       |
| `src/body/outline-panel-body.css.ts` | h2/h3 padding-left 对齐                                               |
| `src/utils/query.ts`                 | 新增 `buildOutlineTree(note, collapsed)` 纯函数 + 类型                |
| `src/card/outline-card.ts`           | 折叠状态信号 + toggle 图标 + 按树渲染                                 |
| `src/outline-viewer.ts`              | 按 note 分组渲染 + 复用折叠逻辑（最小改动：保留现有行为，仅同步缩进） |
| `tests/.../outline-panel.spec.ts`    | 断言适配                                                              |
| `tests/.../outline-viewer.spec.ts`   | 断言适配                                                              |

## 测试要点

- 单测：`buildOutlineTree` 对各级 title 序列的切分、折叠集合的展开/收缩语义。
- e2e：默认全折叠 → 点击 h1 展开显示其直接子级 → 再点 h2 展开 → 点击 h1 收缩后
  其下 h2/h3 全部隐藏。

## 决策记录

- 折叠状态不持久化（用户确认）。
- 仅标题可折叠，文档标题/note 卡片不可折叠（用户确认）。
