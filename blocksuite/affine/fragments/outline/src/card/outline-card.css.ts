import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const outlineCard = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',

  selectors: {
    '&[data-status="dragging"]': {
      pointerEvents: 'none',
      opacity: 0.5,
    },
    '&[data-sortable="true"]': {
      padding: '2px 0px',
    },
  },
});

export const cardPreview = style({
  position: 'relative',
  width: '100%',
  borderRadius: '4px',
  cursor: 'default',
  userSelect: 'none',
  // 卡片底色始终与面板背景一致：hover / selected / dragging 一律不加背景色。
  // 之前 hover 与 selected 会铺一层 layer/background/hoverOverlay，导致
  // 「鼠标在卡片上时高亮、移开就没了」，看起来像选中状态时有时无。
  // 交互反馈仍由 cursor: pointer、拖拽时的 opacity 与标题高亮颜色承担。
  selectors: {
    [`${outlineCard}[data-status="dragging"] &`]: {
      opacity: 0.9,
    },
  },
});

export const cardHeader = style({
  padding: '0 8px',
  width: '100%',
  minHeight: '28px',
  display: 'none',
  alignItems: 'center',
  gap: '8px',
  boxSizing: 'border-box',

  ':hover': {
    cursor: 'grab',
  },
  selectors: {
    [`${outlineCard}[data-sortable="true"] &`]: {
      display: 'flex',
    },
    [`${outlineCard}[data-visibility="edgeless"] &:hover`]: {
      cursor: 'default',
    },
  },
});

const invisibleCard = style({
  selectors: {
    [`${outlineCard}[data-visibility="edgeless"] &`]: {
      color: cssVarV2('text/disable'),
      pointerEvents: 'none',
    },
  },
});

export const headerIcon = style([
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invisibleCard,
]);

export const headerNumber = style([
  {
    textAlign: 'center',
    fontSize: cssVar('fontSm'),
    color: cssVar('brandColor'),
    fontWeight: 500,
    lineHeight: '14px',
  },
  invisibleCard,
]);

export const divider = style({
  height: '1px',
  flex: 1,
  borderTop: `1px dashed ${cssVar('borderColor')}`,
  transform: 'translateY(50%)',
});

export const displayModeButtonGroup = style({
  display: 'none',
  position: 'absolute',
  right: '8px',
  top: '-6px',
  paddingTop: '8px',
  paddingBottom: '8px',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: '20px',

  selectors: {
    [`${cardPreview}:hover &`]: {
      display: 'flex',
    },
  },
});

export const displayModeButton = style({
  display: 'flex',
  borderRadius: '4px',
  backgroundColor: cssVar('hoverColor'),
  alignItems: 'center',
});

export const currentModeLabel = style({
  display: 'flex',
  padding: '2px 0px 2px 4px',
  alignItems: 'center',
});

export const cardContent = style([
  {
    fontFamily: cssVar('fontSansFamily'),
    userSelect: 'none',
    color: cssVarV2('text/primary'),

    ':hover': {
      cursor: 'pointer',
    },
  },
  invisibleCard,
]);

export const modeChangePanel = style({
  position: 'absolute',
  display: 'none',
  background: cssVarV2('layer/background/overlayPanel'),
  borderRadius: '8px',
  boxShadow: cssVar('shadow2'),
  boxSizing: 'border-box',
  padding: '8px',
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/primary'),
  lineHeight: '22px',
  fontWeight: 400,
  fontFamily: cssVar('fontSansFamily'),

  selectors: {
    '&[data-show]': {
      display: 'flex',
    },
  },
});

export const outlineRow = style({
  display: 'block',
});

// 展开态：实心箭头旋转 90° 指向下。
export const toggle = style({
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  // 盒高铺满 22px 行盒并顶对齐，使箭头与文字严格垂直居中
  // （vertical-align: middle 会相对 x-height 对齐，反而偏移 1.7px）。
  width: '16px',
  height: '100%',
  verticalAlign: 'top',
  lineHeight: 0,
  marginRight: '0',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2('icon/primary'),
  transform: 'rotate(90deg)',
  transition: 'transform 150ms ease',
  selectors: {
    '&:hover': {
      color: cssVarV2('icon/emphasis'),
    },
  },
});

// 折叠态：箭头指向右，不旋转。
export const toggleCollapsed = style({
  transform: 'rotate(0deg)',
});

export const toggleSpacer = style({
  display: 'inline-block',
  width: '1.2em',
  height: '1.2em',
  flexShrink: 0,
});
