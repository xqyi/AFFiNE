import type { NoteBlockModel } from '@blocksuite/affine-model';
import type { BlockModel } from '@blocksuite/store';

export interface OutlineRow {
  block: BlockModel;
  /** Whether this heading is currently in the collapsed state. */
  collapsed: boolean;
  /** Whether this heading has any strictly-deeper descendant heading. */
  hasChildren: boolean;
}

/**
 * Duck-type check for a heading paragraph block, avoiding a direct import of
 * `ParagraphBlockModel` (the unit-test environment cannot reliably run
 * `instanceof` against model classes). A heading is a paragraph whose
 * `type` is one of h1-h6.
 */
function isHeadingBlock(block: BlockModel): boolean {
  const flavour = (block as { flavour?: string }).flavour;
  if (flavour !== 'affine:paragraph') return false;
  const type = (block as { props: { type$?: { value?: string } } }).props?.type$
    ?.value;
  return /^h[1-6]$/.test(type ?? '');
}

function headingLevel(block: BlockModel): number {
  if (!isHeadingBlock(block)) return 0;
  const type = (block as { props: { type$: { value: string } } }).props.type$
    .value;
  return Number(type.slice(1)) || 7;
}

/**
 * Flatten a note's block tree into document order, descending recursively
 * into container (hub) blocks so that headings nested inside them are
 * included. This mirrors how the editor actually displays note content.
 */
function collectBlocks(
  root: NoteBlockModel,
  out: BlockModel[] = []
): BlockModel[] {
  for (const child of root.children) {
    out.push(child);
    const flavour = (child as { flavour?: string }).flavour;
    if (
      flavour === 'affine:callout' ||
      flavour === 'affine:database' ||
      flavour === 'affine:data-view'
    ) {
      collectBlocks(child as unknown as NoteBlockModel, out);
    }
  }
  return out;
}

/**
 * Build a flat, document-ordered list of visible outline rows for a note.
 *
 * Visibility model (matches the UI toggle behaviour):
 *  - A heading is VISIBLE iff none of its open ancestors are in `collapsed`.
 *    (An "open" ancestor is one that is itself visible and not in
 *    `collapsed`.)
 *  - A heading's own `collapsed` flag only controls whether ITS children are
 *    visible, never whether it itself is shown.
 *
 * So clicking a collapsed heading (removing it from the set) reveals its
 * direct children; deeper descendants stay hidden until those children are
 * also expanded.
 */
export function buildOutlineTree(
  note: NoteBlockModel,
  collapsed: ReadonlySet<string>
): OutlineRow[] {
  const blocks = collectBlocks(note);

  const headingEntries: Array<{ id: string; level: number }> = [];
  for (const b of blocks) {
    if (isHeadingBlock(b)) {
      headingEntries.push({ id: b.id, level: headingLevel(b) });
    }
  }
  const hasDescendant = new Map<string, boolean>();
  for (const h of headingEntries) {
    hasDescendant.set(
      h.id,
      headingEntries.some(o => o.level > h.level && o.id !== h.id)
    );
  }

  const rows: OutlineRow[] = [];
  // Stack of visible (open) ancestor headings. A heading is pushed only when
  // it is NOT in the collapsed set — its children are visible only in that case.
  const openStack: Array<{ level: number; id: string }> = [];

  for (const block of blocks) {
    if (!isHeadingBlock(block)) continue;
    const level = headingLevel(block);
    const id = block.id;

    while (openStack.length && openStack[openStack.length - 1].level >= level) {
      openStack.pop();
    }

    const ancestorCollapsed = openStack.some(a => collapsed.has(a.id));
    const selfCollapsed = collapsed.has(id);

    if (!ancestorCollapsed) {
      rows.push({
        block,
        collapsed: selfCollapsed,
        hasChildren: hasDescendant.get(id) ?? false,
      });
    }

    // Push every visible heading onto the stack. A collapsed heading is
    // still an ancestor of the deeper headings that follow it — those must
    // stay hidden while it is collapsed.
    openStack.push({ level, id });
  }

  return rows;
}

/**
 * Collect every heading block in a note, regardless of collapse state.
 * Used for the scroll-indicator rail, which must track all headings even
 * when their ancestors are collapsed.
 */
export function collectHeadingBlocks(note: NoteBlockModel): Array<{
  id: string;
  block: BlockModel;
}> {
  const blocks = collectBlocks(note);
  return blocks.filter(isHeadingBlock).map(block => ({
    id: block.id,
    block,
  }));
}

/**
 * Default collapsed set for a note: every heading that has descendants is
 * collapsed, so the panel initially shows only the top-level (min-level)
 * headings. Leaf headings are NOT in the set (they have nothing to hide).
 */
export function defaultCollapsedForNote(note: NoteBlockModel): Set<string> {
  const blocks = collectBlocks(note);
  const set = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!isHeadingBlock(b)) continue;
    const level = headingLevel(b);
    const hasDeeperAfter = blocks
      .slice(i + 1)
      .some(o => isHeadingBlock(o) && headingLevel(o) > level);
    if (hasDeeperAfter) set.add(b.id);
  }
  return set;
}
