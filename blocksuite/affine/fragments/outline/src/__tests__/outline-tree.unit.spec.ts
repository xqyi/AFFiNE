import { describe, expect, it } from 'vitest';

import {
  buildOutlineTree,
  defaultCollapsedForNote,
} from '../utils/outline-tree.js';

type FakeHeading = {
  id: string;
  flavour: string;
  props: { type$: { value: string } };
  children: unknown[];
};

function makeHeading(id: string, level: number): FakeHeading {
  return {
    id,
    flavour: 'affine:paragraph',
    props: { type$: { value: `h${level}` } },
    children: [],
  };
}

function makeNote(
  blocks: FakeHeading[]
): Parameters<typeof buildOutlineTree>[0] {
  return {
    id: 'note',
    children: blocks as never,
    props: {},
    flavour: 'affine:note',
    text: '' as never,
  } as never;
}

describe('buildOutlineTree', () => {
  it('by default (all collapsible headings collapsed) shows only top-level headings', () => {
    const note = makeNote([
      makeHeading('h1', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
    ]);
    const collapsed = defaultCollapsedForNote(note);
    // H1 stays expanded by default; h2 (has descendants) is collapsed; h3 is a leaf.
    // h1 and h2 are visible; h3 hidden (ancestor h2 collapsed).
    const rows = buildOutlineTree(note, collapsed);
    expect(rows.map(r => r.block.id)).toEqual(['h1', 'h2']);
    expect(rows[0].collapsed).toBe(false);
    expect(rows[0].hasChildren).toBe(true);
    expect(rows[1].collapsed).toBe(true);
  });

  it('expanding h1 (remove from collapsed) reveals h2; h3 stays hidden (h2 still collapsed)', () => {
    const note = makeNote([
      makeHeading('h1', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
    ]);
    // h1 expanded, h2 and h3 collapsed.
    const collapsed = new Set(['h2', 'h3']);
    const rows = buildOutlineTree(note, collapsed);
    // h1 visible. h2 visible (ancestor h1 not in collapsed), but h2 itself collapsed.
    // h3 hidden (ancestor h2 is in collapsed).
    expect(rows.map(r => r.block.id)).toEqual(['h1', 'h2']);
    expect(rows[0].collapsed).toBe(false);
    expect(rows[1].collapsed).toBe(true);
    expect(rows[1].hasChildren).toBe(true);
  });

  it('expanding h1 and h2 reveals h3 (all expanded)', () => {
    const note = makeNote([
      makeHeading('h1', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
    ]);
    const collapsed = new Set();
    const rows = buildOutlineTree(note, collapsed);
    expect(rows.map(r => r.block.id)).toEqual(['h1', 'h2', 'h3']);
    expect(rows[2].hasChildren).toBe(false);
  });

  it('a shallower heading after a deeper one closes the branch', () => {
    const note = makeNote([
      makeHeading('h1a', 1),
      makeHeading('h2', 2),
      makeHeading('h1b', 1),
      makeHeading('h3', 3),
    ]);
    const collapsed = new Set();
    const rows = buildOutlineTree(note, collapsed);
    // h3 is under h1b (its nearest shallower ancestor), not under h1a.
    expect(rows.map(r => r.block.id)).toEqual(['h1a', 'h2', 'h1b', 'h3']);
  });

  it('collapsing h2 hides h3 and h4 (descendants of h2) but h2 itself stays visible', () => {
    const note = makeNote([
      makeHeading('h1', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
      makeHeading('h4', 4),
    ]);
    // h1 open, h2 collapsed.
    const collapsed = new Set(['h2']);
    const rows = buildOutlineTree(note, collapsed);
    // h1 visible. h2 visible (ancestor h1 open) but collapsed. h3, h4 hidden.
    expect(rows.map(r => r.block.id)).toEqual(['h1', 'h2']);
    expect(rows[1].collapsed).toBe(true);
    expect(rows[1].hasChildren).toBe(true);
  });

  it('collapsing h1 hides h2 and h3 but h1 itself stays visible', () => {
    const note = makeNote([
      makeHeading('h1', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
    ]);
    const collapsed = new Set(['h1']);
    const rows = buildOutlineTree(note, collapsed);
    // h1 visible (no ancestor) but collapsed. h2, h3 hidden (ancestor h1 collapsed).
    expect(rows.map(r => r.block.id)).toEqual(['h1']);
    expect(rows[0].collapsed).toBe(true);
  });

  it('h2 -> h4 skip: h2 has no h3 descendant, so h2 must NOT show an arrow', () => {
    const note = makeNote([
      makeHeading('a', 1),
      makeHeading('b', 2),
      makeHeading('c', 3),
      makeHeading('d', 4),
    ]);
    // `a` is open; `b` (H2) has `c` (H3) as a child -> arrow on b.
    const rows = buildOutlineTree(note, new Set());
    expect(rows.map(r => r.block.id)).toEqual(['a', 'b', 'c', 'd']);
    const byId = new Map(rows.map(r => [r.block.id as string, r]));
    expect(byId.get('b')!.hasChildren).toBe(true);
    expect(byId.get('d')!.hasChildren).toBe(false); // d is a leaf
  });

  it('collapsing a leaf heading does not hide subsequent headings', () => {
    // `leaf` (H3) has no children; even if it were in the collapsed set it
    // should not hide what follows it (there is nothing under it).
    const note = makeNote([
      makeHeading('a', 1),
      makeHeading('leaf', 3),
      makeHeading('b', 2),
    ]);
    const rows = buildOutlineTree(note, new Set(['leaf']));
    expect(rows.map(r => r.block.id)).toEqual(['a', 'leaf', 'b']);
    expect(rows[1].hasChildren).toBe(false); // leaf has no children
    expect(rows[2].hasChildren).toBe(false); // b is also a leaf here
  });

  it('a visible leaf heading (no descendant) gets no arrow', () => {
    // Scenario from the bug report: "服务器清单" is an H3 with no deeper
    // headings at all, so it must render as a leaf (no chevron).
    const note = makeNote([
      makeHeading('a', 1),
      makeHeading('b', 2),
      makeHeading('leaf', 3),
    ]);
    // all open -> leaf H3 has no children, no arrow
    const rows = buildOutlineTree(note, new Set());
    expect(rows.map(r => r.block.id)).toEqual(['a', 'b', 'leaf']);
    expect(rows[2].hasChildren).toBe(false);
  });

  it('an H2 followed by an H4 (skipping H3) still has no arrow on H2', () => {
    // With `a` open and `b` (H2) followed by `d` (H4): `d` is a real
    // descendant of `b` (no H3 in between to close the branch), so
    // `b` correctly shows an arrow. But `d` itself is a leaf -> no arrow.
    const note = makeNote([
      makeHeading('a', 1),
      makeHeading('b', 2),
      makeHeading('d', 4),
    ]);
    const rows = buildOutlineTree(note, new Set());
    expect(rows.map(r => r.block.id)).toEqual(['a', 'b', 'd']);
    expect(rows[1].hasChildren).toBe(true); // b has d below it
    expect(rows[2].hasChildren).toBe(false); // d is a leaf
  });

  it('after a same-deeper heading closes a branch, the shallower heading is a leaf again', () => {
    const note = makeNote([
      makeHeading('h1a', 1),
      makeHeading('h2', 2),
      makeHeading('h3', 3),
      makeHeading('h1b', 1),
      makeHeading('h4', 4),
    ]);
    const collapsed = new Set();
    const rows = buildOutlineTree(note, collapsed);
    expect(rows.map(r => r.block.id)).toEqual(['h1a', 'h2', 'h3', 'h1b', 'h4']);
    const byId = new Map(rows.map(r => [r.block.id as string, r]));
    // h3 is the last descendant of h1a; h1a still counts as "having children".
    expect(byId.get('h1a')!.hasChildren).toBe(true);
    // h4 is a child of h1b, so h1b has an arrow
    expect(byId.get('h1b')!.hasChildren).toBe(true);
    expect(byId.get('h3')!.hasChildren).toBe(false);
    expect(byId.get('h4')!.hasChildren).toBe(false);
  });
});
