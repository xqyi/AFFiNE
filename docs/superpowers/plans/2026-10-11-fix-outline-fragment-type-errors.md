# Fix Outline-Fragment Type Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the 8 real TypeScript errors in `blocksuite/affine/fragments/outline` so `tsc -b` builds that project and can reach every package downstream of it, including `@affine/core`.

**Architecture:** Four surgical edits in four files (three sources, one spec) plus a package-level gate. Three fixes are type-only; the fourth replaces a theme token that does not exist in `@toeverything/theme@1.1.23` with the icon-family accent token, restoring the author's hover-colour intent.

**Tech Stack:** TypeScript project references (`tsc -b`), Lit 3 templates, `@vanilla-extract/css` + `cssVarV2`, `@toeverything/theme@1.1.23`, Vitest.

**Spec:** embedded below — see "Spec: the 8 errors and the decisions they force" (this is a bounded fix, so no separate spec document exists).

## Global Constraints

- The only legal theme keys are those in `@toeverything/theme@1.1.23`'s `AffineThemeKeyV2`. The `icon/*` family is exactly `primary, secondary, tertiary, activated, disable, monotone, transparentBlack, fileIconBorder, fileIconColors/*`; there is no `icon/emphasis`.
- Do not change outline indent, spacing, collapse or visibility behaviour.
- Touch only the four files listed in File Structure.
- Always pass `--force` to `tsc -b`. The incremental cache replays stale errors, which is why an earlier run reported 39 errors where a clean rebuild reports 8.
- `npx oxfmt --check <files>` and `npx oxlint --deny-warnings <paths>` must stay clean.
- Commit only when the human partner asks for it; otherwise stop after each task's verification step.

## Spec: the 8 errors and the decisions they force

| #   | Location                                      | Code   | Cause                                                         |
| --- | --------------------------------------------- | ------ | ------------------------------------------------------------- |
| 1   | `src/card/outline-card.css.ts:190`            | TS2345 | `cssVarV2('icon/emphasis')` — no such theme key               |
| 2   | `src/card/outline-preview.ts:126`             | TS2464 | computed class-map key is `string \| undefined`               |
| 3   | `src/card/outline-preview.ts:285`             | TS7006 | `@click` handler param `e` implicitly `any`                   |
| 4   | `src/card/outline-preview.ts:286`             | TS7006 | `@pointerup` handler param `e` implicitly `any`               |
| 5   | `src/utils/outline-tree.ts:28`                | TS2352 | `BlockModel<object>` cast to a shape it does not overlap with |
| 6   | `src/__tests__/outline-tree.unit.spec.ts:77`  | TS2345 | `new Set()` infers `Set<unknown>`                             |
| 7   | `src/__tests__/outline-tree.unit.spec.ts:90`  | TS2345 | same                                                          |
| 8   | `src/__tests__/outline-tree.unit.spec.ts:191` | TS2345 | same                                                          |

Decisions these errors force:

- **Token (#1).** `icon/emphasis` is a typo for the icon-family accent. `icon/activated` is `#1e96eb` in both themes — identical to the light-theme `text/emphasis` that the sibling `src/card/outline-preview.css.ts:43` already uses for hover emphasis. **Chosen: `icon/activated`.** If a subtler hover is wanted, the alternative is `icon/secondary` (`#b3b3b3` light / `#cdcdcd` dark). This is a visual taste call, not a technical one — override it in review if you prefer.
- **Indent key (#2).** `indentClass` is `undefined` for every `type` absent from `subtypeStyles` (a body paragraph `type: 'text'`, and all list types). Today that undefined key lands in `classMap` as the literal class `"undefined"`. The fix omits the key instead of emitting a bogus class — otherwise behaviour-identical.
- **Heading type (#5).** Replace the non-overlapping cast with a single private `headingType(block): string | undefined` helper shared by `isHeadingBlock` and `headingLevel`; both currently re-extract the same field, and only one of the two casts overlaps.

## Review Focus

1. **Arrow hover colour is a taste decision** (`icon/activated` = accent blue vs `icon/secondary` = grey). No automated test; worth one look in both light and dark theme.
2. **The leaf-preview `class` attribute has no automated coverage** — this repo has no Lit render fixtures, so the `"undefined"`-class removal is pinned only by the compiler plus Task 2 Step 5's manual devtools check.
3. **`indentClass === undefined` path** — body paragraphs (`type: 'text'`) and list types must keep rendering the same classes they do today, minus the bogus one.
4. **`headingLevel` on non-heading input must stay 0** — the rewritten guard must not turn a paragraph into level 7.
5. **`tsc -b` without `--force` lies.** Every verification below uses `--force`; a result from the cached path proves nothing.

## File Structure

- `blocksuite/affine/fragments/outline/src/card/outline-card.css.ts` — hover colour of the disclosure arrow button.
- `blocksuite/affine/fragments/outline/src/card/outline-preview.ts` — indent-class selection in `_TextBlockPreview`, and the arrow button's event handlers in `_renderToggle`.
- `blocksuite/affine/fragments/outline/src/utils/outline-tree.ts` — duck-typed heading detection used by `buildOutlineTree`.
- `blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts` — existing unit coverage for `buildOutlineTree` / `defaultCollapsedForNote`; the regression guard for Task 3.

---

### Task 1: Real theme token for the arrow hover colour

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/card/outline-card.css.ts:190`
- Test: none — the compiler pins this (see Review Focus 1)

**Interfaces:**

- Consumes: `cssVarV2` from `@toeverything/theme/v2`.
- Produces: nothing new; `toggle`'s style object keeps its export name and shape.

- [ ] **Step 1: Confirm the failure**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force`
Expected: FAIL, including `src/card/outline-card.css.ts(190,23): error TS2345: Argument of type '"icon/emphasis"' is not assignable to parameter of type ...`

- [ ] **Step 2: Confirm nothing else uses the typo, and that the replacement key is legal**

Run: `rg -n "icon/emphasis" --glob '!**/node_modules/**'`
Expected: one hit, `blocksuite/affine/fragments/outline/src/card/outline-card.css.ts:190`.

Run: `rg -n "'icon/activated'" node_modules/@toeverything/theme/dist/v2/variables.d.ts`
Expected: two hits (the lightThemeV2 and darkThemeV2 declarations), proving `icon/activated` is a key of `AffineThemeKeyV2`.

- [ ] **Step 3: Replace the token**

In `src/card/outline-card.css.ts`, inside `toggle`'s `selectors['&:hover']`, change `color: cssVarV2('icon/emphasis')` to `color: cssVarV2('icon/activated')`.

- [ ] **Step 4: Verify the error is gone**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force 2>&1 | Select-String "outline-card.css.ts"`
Expected: no output.

- [ ] **Step 5: Format check**

Run: `npx oxfmt --check blocksuite/affine/fragments/outline/src/card/outline-card.css.ts`
Expected: `All matched files use the correct format.`

- [ ] **Step 6: Commit** (only if the human partner asked for commits)

```bash
git add blocksuite/affine/fragments/outline/src/card/outline-card.css.ts
git commit -m "fix(outline): use the real icon/activated theme token for the arrow hover colour"
```

---

### Task 2: Type the preview's class key and event handlers

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/card/outline-preview.ts:120-133` (`_TextBlockPreview` classMap), `:281-291` (`_renderToggle` handlers)
- Test: none — compiler-pinned, plus a manual check (Review Focus 2)

**Interfaces:**

- Consumes: `styles.subtypeStyles`, `styles.leafStyles`, `classMap` from `lit/directives/class-map.js`.
- Produces: nothing new; `_TextBlockPreview` and `_renderToggle` keep their signatures and their rendered class/attribute contract minus the bogus `"undefined"` class.

- [ ] **Step 1: Confirm the three failures**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force`
Expected: FAIL with `outline-preview.ts(126,11): error TS2464`, `outline-preview.ts(285,16): error TS7006`, `outline-preview.ts(286,20): error TS7006`.

- [ ] **Step 2: Hoist the indent class and drop the undefined key**

In `_TextBlockPreview`, right after `const hasArrow = this.toggleVisible;`, add:

```ts
const leafIndentClass = hasArrow
  ? indentClass
  : (styles.leafStyles?.[block.props.type as keyof typeof styles.leafStyles] ??
    indentClass);
```

Then replace the third entry of the `classMap` object with a conditional spread:

```ts
class=${classMap({
  [styles.text]: true,
  [styles.textGeneral]: !indentClass,
  ...(leafIndentClass ? { [leafIndentClass]: true } : {}),
})}
```

- [ ] **Step 3: Type the two event handlers**

In `_renderToggle`, change `@click=${e => e.stopPropagation()}` to `@click=${(e: MouseEvent) => e.stopPropagation()}`, and `@pointerup=${e => {` to `@pointerup=${(e: PointerEvent) => {`. Leave both bodies exactly as they are.

- [ ] **Step 4: Verify the errors are gone**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force 2>&1 | Select-String "outline-preview.ts"`
Expected: no output.

- [ ] **Step 5: Manual DOM check (compensates for the missing render test)**

Run: `yarn dev`, open a doc whose outline has an H2 with a body paragraph under it, expand that branch, and inspect the paragraph preview's `class` attribute in devtools.
Expected: the span carries the style classes and no `"undefined"` class; hovering the disclosure arrow turns it `#1e96eb`.

- [ ] **Step 6: Commit** (only if the human partner asked for commits)

```bash
git add blocksuite/affine/fragments/outline/src/card/outline-preview.ts
git commit -m "fix(outline): type the preview class key and arrow event handlers"
```

---

### Task 3: One heading-type helper in outline-tree.ts

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/utils/outline-tree.ts:17-30`
- Test: `blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts` (existing)

**Interfaces:**

- Consumes: `BlockModel` from `@blocksuite/store`.
- Produces: private `headingType(block: BlockModel): string | undefined`. `isHeadingBlock(block: BlockModel): boolean` and `headingLevel(block: BlockModel): number` keep their current signatures and semantics.

- [ ] **Step 1: Baseline the existing spec (must be green before the change)**

Run: `npx vitest --run blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts`
Expected: PASS. This is the regression guard for `buildOutlineTree` and `defaultCollapsedForNote`.

- [ ] **Step 2: Confirm the failure**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force`
Expected: FAIL with `utils/outline-tree.ts(28,17): error TS2352`.

- [ ] **Step 3: Add `headingType` and route both callers through it**

Replace `isHeadingBlock` and `headingLevel` with:

```ts
function headingType(block: BlockModel): string | undefined {
  if ((block as { flavour?: string }).flavour !== 'affine:paragraph') {
    return;
  }
  return (block as { props?: { type$?: { value?: string } } }).props?.type$
    ?.value;
}

function isHeadingBlock(block: BlockModel): boolean {
  return /^h[1-6]$/.test(headingType(block) ?? '');
}

function headingLevel(block: BlockModel): number {
  const type = headingType(block);
  return type && /^h[1-6]$/.test(type) ? Number(type.slice(1)) || 7 : 0;
}
```

The keyword-narrowing comment above the old `isHeadingBlock` moves to `headingType` — it still explains why the check is duck-typed rather than `instanceof`.

- [ ] **Step 4: Verify the error is gone and behaviour is unchanged**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force 2>&1 | Select-String "outline-tree.ts"`
Expected: no output.

Run: `npx vitest --run blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts`
Expected: PASS, same test count as Step 1.

- [ ] **Step 5: Framework check**

Run: `npx oxlint --deny-warnings blocksuite/affine/fragments/outline/src/utils/outline-tree.ts`
Expected: exit 0, no findings.

- [ ] **Step 6: Commit** (only if the human partner asked for commits)

```bash
git add blocksuite/affine/fragments/outline/src/utils/outline-tree.ts
git commit -m "refactor(outline): share one duck-typed heading-type helper"
```

---

### Task 4: Type the spec's collapsed sets

**Files:**

- Modify: `blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts:76, 89, 190`
- Test: this file is the test

**Interfaces:**

- Consumes: `buildOutlineTree(note: NoteBlockModel, collapsed: ReadonlySet<string>)`.
- Produces: nothing outside the spec file.

- [ ] **Step 1: Confirm the three failures**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force`
Expected: FAIL with three `Set<unknown>` → `ReadonlySet<string>` TS2345 errors at `outline-tree.unit.spec.ts(77,41)`, `(90,41)`, `(191,41)`.

- [ ] **Step 2: Annotate the element type**

At lines 76, 89 and 190, change `const collapsed = new Set();` to `const collapsed = new Set<string>();`.

Leave the inline `new Set()` calls that are passed straight to `buildOutlineTree` (lines 132, 147, 162, 176) unchanged — the parameter type already infers `Set<string>` there.

- [ ] **Step 3: Verify**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force 2>&1 | Select-String "outline-tree.unit.spec.ts"`
Expected: no output.

Run: `npx vitest --run blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit** (only if the human partner asked for commits)

```bash
git add blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts
git commit -m "test(outline): annotate collapsed sets as Set<string>"
```

---

### Task 5: Package and downstream typecheck gate

**Files:** none — verification only.

**Interfaces:**

- Consumes: the four edits from Tasks 1-4.
- Produces: the acceptance evidence for this plan.

- [ ] **Step 1: Package clean build**

Run: `npx tsc -b blocksuite/affine/fragments/outline/tsconfig.json --force; "exit=$LASTEXITCODE"`
Expected: `exit=0`, and no line matches `error TS`.

- [ ] **Step 2: Downstream clean build**

Run: `npx tsc -b packages/frontend/core/tsconfig.json; "exit=$LASTEXITCODE"`
Expected: `exit=0`. This is the first time `@affine/core` is typechecked on this branch; it also covers the earlier `View` sidebar-default change (`_defaultSidebarTabId$`, `ViewSidebarTab.isDefault`).

- [ ] **Step 3: Lint and format the touched files**

Run: `npx oxlint --deny-warnings blocksuite/affine/fragments/outline`
Expected: exit 0.

Run: `npx oxfmt --check blocksuite/affine/fragments/outline/src/card/outline-card.css.ts blocksuite/affine/fragments/outline/src/card/outline-preview.ts blocksuite/affine/fragments/outline/src/utils/outline-tree.ts blocksuite/affine/fragments/outline/src/__tests__/outline-tree.unit.spec.ts`
Expected: `All matched files use the correct format.`

- [ ] **Step 4: Report**

State the exit codes from Steps 1-3 and the vitest test count from Task 3 Step 4. If any command is not `exit=0`, stop and report the failing file and error instead of claiming success.
