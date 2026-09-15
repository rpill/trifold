export const UI_TOKENS = {
  color: {
    table: 0x123b34,
    control: 0x173f38,
    controlActive: 0x24584d,
    paper: 0xf0e6d3,
    paperPressed: 0xd9c7a8,
    ink: 0x1b2e29,
    mutedInk: 0x68746d,
    gold: 0xb8904f,
    goldLight: 0xd8bc82,
    danger: 0xb86262,
    overlay: 0x0d1f1e,
  },
  radius: { card: 16, panel: 20, control: 12 },
  stroke: { thin: 1, normal: 2 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
  asset: {
    homeBackground: 'ui.home.background',
    paperPanel: 'ui.panel.paper',
    coinIcon: 'ui.icon.coin',
  },
} as const;
