import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

// 叶子节点缩进 = 对应 heading 级数 + 1 个汉字宽（1.2em）
export const leafStyles = {
  h1: style({
    fontWeight: 600,
    paddingLeft: '1.2em',
  }),
  h2: style({
    fontWeight: 600,
    paddingLeft: '2.4em',
  }),
  h3: style({
    fontWeight: 600,
    paddingLeft: '3.6em',
  }),
  h4: style({
    fontWeight: 600,
    paddingLeft: '4.8em',
  }),
  h5: style({
    fontWeight: 600,
    paddingLeft: '6.0em',
  }),
  h6: style({
    fontWeight: 600,
    paddingLeft: '7.2em',
  }),
};
export const outlineBlockPreview = style({
  fontFamily: cssVar('fontFamily'),
  boxSizing: 'border-box',
  padding: '6px 4px',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',

  ':hover': {
    cursor: 'pointer',
    color: cssVarV2('text/emphasis'),
  },

  selectors: {
    '.active > &': {
      color: cssVarV2('text/emphasis'),
    },
    '&:not(:has(span))': {
      display: 'none',
    },
  },
});

export const icon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  boxSizing: 'border-box',
  padding: '4px',
  background: cssVarV2('layer/background/secondary'),
  borderRadius: '4px',
  color: cssVarV2('icon/primary'),
});

export const iconDisabled = style({
  color: cssVarV2('icon/disable'),
});

export const text = style({
  whiteSpace: 'nowrap',
  display: 'inline-block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  height: '22px',
});

export const textGeneral = style({
  fontWeight: 400,
});

// Per-level indent in em: H(n) sits exactly 1em to the right of H(n-1),
// so a new H4 under an H3 indents one CJK character, not three.
export const headingIndentEm: Record<string, number> = {
  h1: 0,
  h2: 1,
  h3: 2,
  h4: 3,
  h5: 4,
  h6: 5,
};

export const subtypeStyles = {
  title: style({
    fontWeight: 600,
    paddingLeft: '0',
  }),
  h1: style({
    fontWeight: 600,
    paddingLeft: '0',
  }),
  h2: style({
    fontWeight: 600,
    paddingLeft: '1.2em',
  }),
  h3: style({
    fontWeight: 600,
    paddingLeft: '2.4em',
  }),
  h4: style({
    fontWeight: 600,
    paddingLeft: '3.6em',
  }),
  h5: style({
    fontWeight: 600,
    paddingLeft: '4.8em',
  }),
  h6: style({
    fontWeight: 600,
    paddingLeft: '6.0em',
  }),
};

export const textSpan = style({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const linkedDocText = style({
  fontSize: 'inherit',
  borderBottom: `0.5px solid ${cssVar('dividerColor')}`,
  whiteSpace: 'break-spaces',
  marginRight: '2px',
});

export const linkedDocPreviewUnavailable = style({
  color: cssVarV2('text/disable'),
});

export const linkedDocPreviewAvailable = style({});
globalStyle(`${linkedDocPreviewAvailable} > svg`, {
  marginBottom: '0.1em',
});

export const linkedDocTextUnavailable = style({
  color: cssVarV2('text/disable'),
  textDecoration: 'line-through',
});
