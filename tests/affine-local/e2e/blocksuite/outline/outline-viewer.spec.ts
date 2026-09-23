import { test } from '@affine-test/kit/playwright';
import {
  clickEdgelessModeButton,
  clickPageModeButton,
  createEdgelessNoteBlock,
} from '@affine-test/kit/utils/editor';
import {
  pressBackspace,
  pressEnter,
  selectAllByKeyboard,
} from '@affine-test/kit/utils/keyboard';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import {
  clickNewPageButton,
  createLinkedPage,
  type,
  waitForEditorLoad,
} from '@affine-test/kit/utils/page-logic';
import { expect, type Locator, type Page } from '@playwright/test';

import {
  createHeadings,
  createTitle,
  getVerticalCenterFromLocator,
} from './utils';

function getIndicators(container: Page | Locator) {
  return container.locator('affine-outline-viewer .outline-viewer-indicator');
}

// Each heading row in the viewer is a `.outline-viewer-item` div that
// optionally contains a toggle button (preceding sibling of the
// `affine-outline-block-preview`) followed by the preview element whose
// inner span carries the `outline-block-preview-h<n>` testid.
function getHeadingRow(container: Locator, level: number): Locator {
  return container
    .getByTestId(`outline-block-preview-h${level}`)
    .locator('xpath=../..');
}

function getHeadingToggle(container: Locator, level: number): Locator {
  return getHeadingRow(container, level).getByTestId(/outline-toggle/);
}

test.beforeEach(async ({ page }) => {
  await openHomePage(page);
  await clickNewPageButton(page);
  await waitForEditorLoad(page);
});

test('should display indicators when non-empty headings exists', async ({
  page,
}) => {
  const indicators = getIndicators(page);
  await createHeadings(page);

  await expect(indicators).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await expect(indicators.nth(i)).toBeVisible();
  }
});

test('should be hidden when only empty headings exists', async ({ page }) => {
  const indicators = getIndicators(page);
  await expect(indicators).toHaveCount(0);

  for (let i = 1; i <= 6; i++) {
    // empty heading
    await type(page, `${'#'.repeat(i)} `);
    await pressEnter(page);
  }

  await expect(indicators).toHaveCount(0);
});

test('should update indicator when clear title or headings', async ({
  page,
}) => {
  const indicators = getIndicators(page);
  const title = await createTitle(page);
  const headings = await createHeadings(page);

  await expect(indicators).toHaveCount(7);

  await title.scrollIntoViewIfNeeded();
  await title.click();
  await selectAllByKeyboard(page);
  await pressBackspace(page);
  await expect(indicators).toHaveCount(6);

  for (let i = 1; i <= 6; i++) {
    await headings[i - 1].click();
    await selectAllByKeyboard(page);
    await pressBackspace(page);
    await expect(indicators).toHaveCount(6 - i);
  }
});

test('should display collapsed outline panel by default when hovering', async ({
  page,
}) => {
  const indicators = getIndicators(page);
  await createTitle(page);
  await createHeadings(page);
  await indicators.first().hover({ force: true });

  const viewer = page.locator('affine-outline-viewer');
  // Top-level h1 row is visible by default; h2..h6 stay hidden under
  // their collapsed ancestors until the h1 toggle is clicked.
  await expect(viewer.getByTestId('outline-block-preview-h1')).toBeVisible();
  await expect(viewer.getByTestId('outline-block-preview-h2')).toBeHidden();
  await expect(viewer.getByTestId('outline-block-preview-h6')).toBeHidden();
});

test('expand a heading reveals its direct children only', async ({ page }) => {
  const indicators = getIndicators(page);
  await createTitle(page);
  await createHeadings(page);
  await indicators.first().hover({ force: true });

  const viewer = page.locator('affine-outline-viewer');
  await expect(viewer.getByTestId('outline-block-preview-h1')).toBeVisible();
  await expect(viewer.getByTestId('outline-block-preview-h2')).toBeHidden();

  // h1 is collapsible by default (it has h2..h6 descendants).
  await getHeadingToggle(viewer, 1).click();

  // Expanding h1 reveals its direct children (h2). h3-h6 stay hidden.
  await expect(viewer.getByTestId('outline-block-preview-h2')).toBeVisible();
  await expect(viewer.getByTestId('outline-block-preview-h3')).toBeHidden();

  // Expanding h2 reveals h3.
  await getHeadingToggle(viewer, 2).click();
  await expect(viewer.getByTestId('outline-block-preview-h3')).toBeVisible();
});

test('collapsing a heading hides all its descendants', async ({ page }) => {
  const indicators = getIndicators(page);
  await createTitle(page);
  await createHeadings(page);
  await indicators.first().hover({ force: true });

  const viewer = page.locator('affine-outline-viewer');
  // Expand h1 and h2 so h3 becomes visible.
  await getHeadingToggle(viewer, 1).click();
  await getHeadingToggle(viewer, 2).click();
  await expect(viewer.getByTestId('outline-block-preview-h3')).toBeVisible();

  // Collapse h1: everything under it (h2, h3, ...) is hidden at once.
  await getHeadingToggle(viewer, 1).click();
  await expect(viewer.getByTestId('outline-block-preview-h2')).toBeHidden();
  await expect(viewer.getByTestId('outline-block-preview-h3')).toBeHidden();
});

test('should highlight indicator when scrolling', async ({ page }) => {
  const indicators = getIndicators(page);
  const title = await createTitle(page);
  for (let i = 0; i < 3; i++) {
    await pressEnter(page);
  }
  const headings = await createHeadings(page, 10);
  await title.scrollIntoViewIfNeeded();

  const viewportCenter = await getVerticalCenterFromLocator(
    page.locator('body')
  );
  for (let i = 0; i < headings.length; i++) {
    const lastHeadingCenter = await getVerticalCenterFromLocator(headings[i]);
    await expect(indicators.nth(i)).toHaveClass(/active/);
    await page.mouse.wheel(0, lastHeadingCenter - viewportCenter + 20);
    await page.waitForTimeout(10);
  }
});

test('should highlight indicator when click item in outline panel', async ({
  page,
}) => {
  const viewer = page.locator('affine-outline-viewer');
  const indicators = getIndicators(page);
  const headings = await createHeadings(page, 10);

  await indicators.first().hover({ force: true });

  // Click the visible top-level h1 item to scroll and activate it.
  await viewer.getByTestId('outline-block-preview-h1').click();
  await expect(headings[0]).toBeVisible();
  await expect(indicators.nth(0)).toHaveClass(/active/);
});

test('outline viewer should hide in edgeless mode', async ({ page }) => {
  await createTitle(page);
  await pressEnter(page);

  await type(page, '# ');
  await type(page, 'Heading 1');

  const indicators = getIndicators(page);
  await expect(indicators).toHaveCount(2);

  await clickEdgelessModeButton(page);
  await expect(indicators).toHaveCount(0);

  await clickPageModeButton(page);
  await expect(indicators).toHaveCount(2);
});

test('should hide edgeless-only note headings', async ({ page }) => {
  await createTitle(page);
  await pressEnter(page);
  await type(page, '# Heading 1');
  await pressEnter(page);
  await type(page, '## Heading 2');

  await clickEdgelessModeButton(page);
  await createEdgelessNoteBlock(page, [100, 100]);
  await type(page, '# Edgeless');

  await clickPageModeButton(page);
  await waitForEditorLoad(page);
  const indicators = getIndicators(page);
  await expect(indicators).toHaveCount(3);
  await indicators.first().hover({ force: true });

  const viewer = page.locator('affine-outline-viewer');
  await expect(viewer).toBeVisible();
  const h1InPanel = viewer
    .getByTestId('outline-block-preview-h1')
    .locator('span');
  await h1InPanel.waitFor({ state: 'visible' });
  await expect(h1InPanel).toContainText(['Heading 1']);
});

test('outline viewer should update after change heading in edgeless mode', async ({
  page,
}) => {
  await createTitle(page);
  await pressEnter(page);

  await type(page, '# ');
  await type(page, 'Heading 1');

  await clickEdgelessModeButton(page);
  const note = page.locator('affine-edgeless-note');
  await note.dblclick();
  await type(page, '# New Heading');
  await clickPageModeButton(page);

  const indicators = getIndicators(page);
  await expect(indicators).toHaveCount(3);
});

test('outline viewer should be useable in doc peek preview', async ({
  page,
}) => {
  await pressEnter(page);
  await createLinkedPage(page, 'Test Page');

  await page.locator('affine-reference').hover();

  const toolbar = page.locator('affine-toolbar-widget editor-toolbar');
  await expect(toolbar).toBeVisible();

  await toolbar.getByLabel(/^Open doc with$/).click();
  await toolbar
    .getByLabel('Open doc menu')
    .getByLabel('Open in center peek')
    .click();

  const peekView = page.getByTestId('peek-view-modal');
  await expect(peekView).toBeVisible();

  const title = peekView.locator('doc-title .inline-editor');
  await title.click();
  await pressEnter(page);

  await type(page, '# Heading 1');

  for (let i = 0; i < 10; i++) {
    await pressEnter(page);
  }

  await type(page, '## Heading 2');

  const outlineViewer = peekView.locator('affine-outline-viewer');
  const outlineViewerBound = await outlineViewer.boundingBox();
  expect(outlineViewerBound).not.toBeNull();

  const indicators = getIndicators(peekView);
  await expect(indicators).toHaveCount(3);
  await expect(indicators.nth(0)).toBeVisible();
  await expect(indicators.nth(1)).toBeVisible();
  await expect(indicators.nth(2)).toBeVisible();

  await indicators.first().hover({ force: true });
  const viewer = peekView.locator('affine-outline-viewer');
  await expect(viewer).toBeVisible();

  // position of outline viewer should be fixed
  {
    // Collapsed by default: only the top-level h1 row is shown (h2 is
    // hidden under its collapsed ancestor).
    const h1Row = getHeadingRow(viewer, 1);
    await expect(h1Row).toBeVisible();
    await expect(getHeadingRow(viewer, 2)).toBeHidden();

    await h1Row.click();
    await page.mouse.move(0, 0);
    await h1Row.waitFor({ state: 'hidden' });

    const currentOutlineViewerBound = await outlineViewer.boundingBox();
    expect(currentOutlineViewerBound).not.toBeNull();
    expect(outlineViewerBound).toEqual(currentOutlineViewerBound);
  }

  // outline viewer should be hidden when clicking the outline panel toggle button
  {
    await indicators.first().hover({ force: true });
    const toggleButton = peekView.locator(
      '.outline-viewer-header edgeless-tool-icon-button'
    );
    await toggleButton.click();

    await page.waitForTimeout(500);
    await expect(peekView).toBeHidden();
    await expect(viewer).toBeHidden();
    await expect(page.locator('affine-outline-panel')).toBeVisible();
  }
});
