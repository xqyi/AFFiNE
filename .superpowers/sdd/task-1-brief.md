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
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
    'Noto Color Emoji';

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


