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
    // h1 and h2 have descendants -> in collapsed set. h3 is a leaf.
    // h1 is visible (no ancestor). h2 is hidden (ancestor h1 collapsed). h3 hidden.
    const rows = buildOutlineTree(note, collapsed);
    expect(rows.map(r => r.block.id)).toEqual(['h1']);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].hasChildren).toBe(true);
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
});
