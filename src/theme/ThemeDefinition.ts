export type ThemeId =
  | 'base'
  | 'launch_01'
  | 'launch_02'
  | 'launch_03'
  | 'launch_04'
  | 'launch_05'
  | 'launch_06';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly displayName: string;
  readonly priceCoins: 0 | 300;
  readonly board: {
    readonly surface: string;
    readonly decoration?: string;
  };
  readonly cardBack: {
    readonly assetKey: string;
    readonly url: string;
  };
  readonly slots: {
    readonly recess: string;
    readonly edge: string;
    readonly highlight: string;
  };
}
