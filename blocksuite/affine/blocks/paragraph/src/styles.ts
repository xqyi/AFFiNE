import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { css } from 'lit';

export const paragraphBlockStyles = css`
  affine-paragraph {
    box-sizing: border-box;
    display: block;
    font-size: var(--affine-font-base);
  }

  .affine-paragraph-block-container {
    position: relative;
    border-radius: 4px;
  }
  .affine-paragraph-rich-text-wrapper {
    position: relative;
  }

  .affine-paragraph-block-container.highlight-comment {
    background-color: ${unsafeCSSVarV2('block/comment/highlightActive')};
    outline: 2px solid ${unsafeCSSVarV2('block/comment/highlightUnderline')};
  }

  affine-paragraph code {
    padding: 0px 4px 2px;
  }

  .h1 {
    font-size: var(--affine-font-h-1);
    font-weight: 700;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 18px;
    margin-bottom: 10px;
  }

  .h2 {
    font-size: var(--affine-font-h-2);
    font-weight: 600;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 14px;
    margin-bottom: 10px;
  }

  .h3 {
    font-size: var(--affine-font-h-3);
    font-weight: 600;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 12px;
    margin-bottom: 10px;
  }

  .h4 {
    font-size: var(--affine-font-h-4);
    font-weight: 600;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 12px;
    margin-bottom: 10px;
  }

  .h5 {
    font-size: var(--affine-font-h-5);
    font-weight: 600;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 12px;
    margin-bottom: 10px;
  }

  .h6 {
    font-size: var(--affine-font-h-6);
    font-weight: 600;
    letter-spacing: normal;
    line-height: var(--affine-line-height-heading);
    margin-top: 12px;
    margin-bottom: 10px;
  }

  /* Inline code keeps one size across every heading level. The old ladder
     scaled it per level, which made code in an H1 jump to 25px in a
     monospace face while code in an H6 shrank below body copy. */
  .h1 code,
  .h2 code,
  .h3 code,
  .h4 code,
  .h5 code,
  .h6 code {
    font-size: calc(var(--affine-font-base) + 2px);
    padding: 0px 4px;
  }

  .quote {
    line-height: 26px;
    padding-left: 17px;
    margin-top: var(--affine-paragraph-space);
    padding-top: 10px;
    padding-bottom: 10px;
    position: relative;
  }
  .quote::after {
    content: '';
    width: 2px;
    height: calc(100% - 20px);
    margin-top: 10px;
    margin-bottom: 10px;
    position: absolute;
    left: 0;
    top: 0;
    background: var(--affine-quote-color);
    border-radius: 18px;
  }

  .affine-paragraph-placeholder {
    position: absolute;
    display: none;
    max-width: 100%;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    left: 0;
    bottom: 0;
    pointer-events: none;
    color: var(--affine-black-30);
    fill: var(--affine-black-30);
  }
  @media print {
    .affine-paragraph-placeholder {
      display: none !important;
    }
  }
  .affine-paragraph-placeholder.visible {
    display: block;
  }
  @media print {
    .affine-paragraph-placeholder.visible {
      display: none;
    }
  }
`;
