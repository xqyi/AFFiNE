# 大纲视图：层级缩进 + 折叠/展开 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 大纲（TOC）层级缩进增大为 1em/级；默认所有层级折叠，点击标题展开直接子级，收缩时整棵子树一并隐藏。

**Architecture:** 在 `outline-preview.ts` 的 `render()` 内按块 level 计算 `padding-left`（1em 步进）；在 `outline-card.ts` 维护每个 note 的折叠状态信号，新增纯函数 `buildOutlineTree` 把 note 子块切成有序扁平行（含 `collapsed`/`hasChildren`），渲染时仅可见行出现，每个含后代的标题行左侧加 toggle 图标。

**Tech Stack:** Lit + vanilla-extract CSS + `@blocksuite/icons`，React 宿主层不动。

## Global Constraints

- 缩进步进 = 1em（大纲字号 12px，1em = 1 个汉字宽）。
- 折叠状态**不持久化**；每次组件实例创建时重置为"所有可折叠标题默认折叠"。
- 仅标题（h1-h6）参与折叠；文档标题、note 卡片不可折叠。
- 展开 = 仅显示该标题直接子级（level+1），更深层保持折叠；收缩 = 该标题及其全部后代一起隐藏。

## 文件结构

| 文件                                                               | 责任                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/card/outline-preview.ts`                                      | 按 level 计算 `padding-left`；渲染行级 toggle              |
| `src/card/outline-preview.css.ts`                                  | 去掉旧 `paddingLeft` 硬编码，改由 JS 传 `style`            |
| `src/card/outline-card.ts`                                         | 折叠状态信号；调用 `buildOutlineTree`；渲染可见行 + toggle |
| `src/card/outline-card.css.ts`                                     | 新增 toggle 按钮样式                                       |
| `src/utils/query.ts`                                               | 新增 `buildOutlineTree` 纯函数 + 类型                      |
| `src/outline-viewer.ts`                                            | 右侧 mini 大纲复用同一棵 note 卡片渲染（默认折叠）         |
| `tests/affine-local/e2e/blocksuite/outline/outline-panel.spec.ts`  | 默认折叠/展开断言                                          |
| `tests/affine-local/e2e/blocksuite/outline/outline-viewer.spec.ts` | 右侧 viewer 默认折叠断言                                   |

## 任务拆分

### Task 1: 缩进（1em 步进）

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/card/outline-preview.css.ts`
- Modify: `blocksuite/affine/fragments/outline/src/card/outline-preview.ts`
- Test: `tests/affine-local/e2e/blocksuite/outline/outline-panel.spec.ts`

- [ ] **Step 1: 写 e2e 断言（失败）**

在 `outline-panel.spec.ts` 的 "TOC display" 里，把 "should add padding to sub-headings" 用例的断言从 `prevRect.x < currRect.x` 加强为"每级缩进约 1em（12px，按当前字号）"，并用 `getBoundingClientRect().left` 差值 ≥ 10px 做软断言（避免不同 DPI 抖动）。

- [ ] **Step 2: 运行测试确认失败**

Run: `yarn test:e2e tests/affine-local/e2e/blocksuite/outline/outline-panel.spec.ts -g "should add padding"`
Expected: FAIL（差值未达阈值）。

- [ ] **Step 3: 改 `outline-preview.css.ts`**

把 `subtypeStyles` 里每个 level 的 `paddingLeft` 改为按 level 计算：

```ts
const LEVEL_PAD: Record<string, string> = {
  title: '0px',
  h1: '0px',
  h2: '1em',
  h3: '2em',
  h4: '3em',
  h5: '4em',
  h6: '5em',
};
export const subtypeStyles = {
  title: style({ fontWeight: 600, paddingLeft: LEVEL_PAD.title }),
  h1: style({ fontWeight: 600, paddingLeft: LEVEL_PAD.h1 }),
  // ... 其余同理
};
export const textGeneral = style({
  fontWeight: 400,
  paddingLeft: '6em',
});
```

- [ ] **Step 4: 同步 `outline-card.ts` 里 `cardContent` 的 padding**

`outline-card.css.ts` 的 `cardContent` 当前没有额外 padding，保持不动。

- [ ] **Step 5: 运行测试确认通过 + commit**

Run: `yarn test:e2e ...`，Expected: PASS。
`git add -A && git commit -m "feat(outline): 1em-per-level indent"`。

---

### Task 2: 折叠树纯函数 `buildOutlineTree`

**Files:**

- Create/Modify: `blocksuite/affine/fragments/outline/src/utils/query.ts`
- Test: `blocksuite/affine/fragments/outline/__tests__/query.test.ts`（若仓库无该目录则新建）

- [ ] **Step 1: 写单测**

```ts
import { describe, expect, it } from 'vitest';
import { buildOutlineTree, type OutlineRow } from '../query.js';

describe('buildOutlineTree', () => {
  const makeBlock = (id: string, level: number) => ({
    id,
    props: { type$: { value: `h${level}` } },
    flavour: 'affine:paragraph',
  });

  it('collapses all by default', () => {
    const note = {
      children: [makeBlock('h1', 1), makeBlock('h2', 2), makeBlock('h3', 3)],
    };
    const rows: OutlineRow[] = buildOutlineTree(
      note,
      new Set(['h1', 'h2', 'h3'])
    );
    expect(rows.map(r => r.block.id)).toEqual(['h1']);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].hasChildren).toBe(true);
  });

  it('expanding h1 shows h2 directly, h3 stays hidden', () => {
    const note = {
      children: [makeBlock('h1', 1), makeBlock('h2', 2), makeBlock('h3', 3)],
    };
    const rows = buildOutlineTree(note, new Set(['h2', 'h3'])); // h1 expanded
    expect(rows.map(r => r.block.id)).toEqual(['h1', 'h2']);
    expect(rows[1].collapsed).toBe(true);
  });
});
```

- [ ] **Step 2: 实现**

```ts
export interface OutlineRow {
  block: BlockModel;
  collapsed: boolean;
  hasChildren: boolean;
}

export function buildOutlineTree(
  note: NoteBlockModel,
  collapsed: ReadonlySet<string>
): OutlineRow[] {
  const headings = note.children.filter(isHeadingBlock);
  const rows: OutlineRow[] = [];
  let openStack: number[] = []; // 当前打开的 level 链

  for (const b of headings) {
    const level = Number(b.props.type$.value.slice(1));
    while (openStack.length && openStack[openStack.length - 1] >= level) {
      openStack.pop();
    }
    const ancestorCollapsed = openStack.length
      ? openStack.some(l => l < level && false) // placeholder
      : false;
    // 简化：只要存在祖先在 collapsed 里，则隐藏；这里祖先 = 上一个比它浅的 heading
    rows.push({
      block: b,
      collapsed: collapsed.has(b.id),
      hasChildren: /* 后续存在更深的 heading */ true,
    });
    openStack.push(level);
  }
  return rows.filter(r => !collapsed.has(r.block.id));
}
```

实现要点（在写代码时精确化）：

- `hasChildren` = 该 heading 之后存在比它深一级的 heading（按 level 顺序）。
- 行可见 = 自身不在 collapsed 里 **且** 所有比它浅的祖先 heading 都展开。
- 默认（全 collapsed）结果：只有最小 level 的 heading 可见。

- [ ] **Step 3: 运行单测通过 + commit**

Run: `yarn vitest run blocksuite/affine/fragments/outline/__tests__/query.test.ts`
Expected: PASS。

---

### Task 3: 卡片折叠 UI（toggle 图标 + 状态）

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/card/outline-card.ts`
- Modify: `blocksuite/affine/fragments/outline/src/card/outline-card.css.ts`
- Modify: `blocksuite/affine/fragments/outline/src/card/outline-preview.ts`

- [ ] **Step 1: 加折叠状态**

在 `OutlineNoteCard` 内：

```ts
private _collapsedHeadings$ = signal<Set<string>>(new Set());

private _initCollapsed() {
  const rows = buildOutlineTree(this.note, new Set(this.note.children.map(b => b.id)));
  this._collapsedHeadings$.value = new Set(rows.filter(r => r.hasChildren).map(r => r.block.id));
}
```

`connectedCallback` 里调用 `_initCollapsed()`。

- [ ] **Step 2: 渲染**

把 `render()` 中 `children.map` 换成按 `buildOutlineTree(this.note, this._collapsedHeadings$.value)` 的行来渲染。

- [ ] **Step 3: toggle 图标**

在 `outline-preview.ts` 行内，当 `row.hasChildren` 时在文本前渲染：

```ts
import { ArrowDownSmallIcon } from '@blocksuite/icons/lit';
html`<button
  class=${styles.toggle}
  data-testid="outline-toggle-${block.id}"
  @click=${(e: MouseEvent) => {
    e.stopPropagation();
    this._onToggle(block.id, row.collapsed);
  }}
>
  ${
    row.collapsed
      ? html`<svg style="transform: rotate(-90deg)">
          ${ArrowDownSmallIcon({ width: '1em', height: '1em' })}
        </svg>`
      : html`${ArrowDownSmallIcon({ width: '1em', height: '1em' })}`
  }
</button>`;
```

`_onToggle` 在卡片层实现：展开=从 set 移除 id；收缩=把该 id 及其所有后代 id 重新加入 set。

- [ ] **Step 4: CSS**

```ts
export const toggle = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1em',
  height: '1em',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2('icon/primary'),
});
```

- [ ] **Step 5: e2e 断言 + commit**

在 `outline-panel.spec.ts` 加用例：

```ts
test('headings collapse/expand on toggle', async ({ page }) => {
  await createHeadings(page);
  const toc = await openTocPanel(page);
  const h1 = getTocHeading(toc, 1);
  await h1.locator('xpath=..').getByTestId('outline-toggle-...').click(); // 展开 h1
  await expect(getTocHeading(toc, 2)).toBeVisible();
  await expect(getTocHeading(toc, 3)).toBeHidden();
});
```

Run: `yarn test:e2e ...` → PASS。
`git commit -m "feat(outline): collapsible note cards with 1-level expand"`。

---

### Task 4: 右侧 `OutlineViewer` 同步默认折叠

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/outline-viewer.ts`

- [ ] **Step 1: 按 note 分组**

把当前 `getHeadingBlocksFromDoc(...)` 扁平列表改为按 note 分组渲染 `OutlineNoteCard`（复用 Task 3 的组件），保证右侧 mini 大纲与左侧面板行为一致。

- [ ] **Step 2: 保持 200px 宽度不变**；卡片内部折叠逻辑自动生效。

- [ ] **Step 3: e2e 断言 + commit**

```ts
// outline-viewer.spec.ts 新增
test('viewer shows collapsed by default', async ({ page }) => {
  await createHeadings(page);
  await getIndicators(page).first().hover({ force: true });
  const viewer = page.locator('affine-outline-viewer');
  await expect(viewer.getByTestId('outline-block-preview-h2')).toBeHidden();
});
```

Run → PASS。`git commit -m "feat(outline): viewer reuses collapsible cards"`。

---

### Task 5: 回归与收尾

- [ ] 跑整个 outline e2e 套件：`yarn test:e2e tests/affine-local/e2e/blocksuite/outline/`。
- [ ] 跑 blocksuite vitest：`yarn vitest run blocksuite/affine/fragments/outline/`。
- [ ] `git commit -m "test(outline): assert default-collapsed + 1-level expand"`。
