export type VisualQaInteraction =
  | { readonly type: 'click'; readonly target: string }
  | { readonly type: 'drag'; readonly from: string; readonly to: string }
  | { readonly type: 'swipe'; readonly direction: 'left' | 'right' | 'up' | 'down' }
  | { readonly type: 'wait-ready'; readonly marker: string };

export interface VisualQaScenario {
  readonly id: string;
  readonly scene: string;
  readonly fixture: string;
  readonly viewports: readonly string[] | 'all';
  readonly interactions?: readonly VisualQaInteraction[];
  readonly ready?: string;
}

export interface VisualQaCatalogValidationContext {
  readonly fixtureIds: ReadonlySet<string>;
  readonly viewportIds: ReadonlySet<string>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateInteraction(interaction: VisualQaInteraction, index: number): string | null {
  switch (interaction.type) {
    case 'click':
      return nonEmpty(interaction.target) ? null : `interaction ${index}: click target must be non-empty`;
    case 'drag':
      return nonEmpty(interaction.from) && nonEmpty(interaction.to)
        ? null
        : `interaction ${index}: drag endpoints must be non-empty`;
    case 'swipe':
      return ['left', 'right', 'up', 'down'].includes(interaction.direction)
        ? null
        : `interaction ${index}: swipe direction is invalid`;
    case 'wait-ready':
      return nonEmpty(interaction.marker) ? null : `interaction ${index}: ready marker must be non-empty`;
    default:
      return `interaction ${index}: unknown interaction type`;
  }
}

export function validateVisualQaCatalog(
  scenarios: readonly VisualQaScenario[],
  context: VisualQaCatalogValidationContext,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const scenario of scenarios) {
    if (!nonEmpty(scenario.id)) {
      errors.push('scenario id must be non-empty');
    } else if (seen.has(scenario.id)) {
      errors.push(`duplicate scenario id: ${scenario.id}`);
    } else {
      seen.add(scenario.id);
    }

    if (!context.fixtureIds.has(scenario.fixture)) {
      errors.push(`${scenario.id}: unknown fixture ${scenario.fixture}`);
    }

    if (scenario.viewports !== 'all') {
      for (const viewport of scenario.viewports) {
        if (!context.viewportIds.has(viewport)) {
          errors.push(`${scenario.id}: unknown viewport ${viewport}`);
        }
      }
    }

    scenario.interactions?.forEach((interaction, index) => {
      const error = validateInteraction(interaction, index);
      if (error) errors.push(`${scenario.id}: ${error}`);
    });
  }

  return errors;
}

const ALL_CAPTURE_FIXTURES: readonly { readonly id:string; readonly scene:string }[] = [
  {id:'home-fresh',scene:'HomeScene'}, {id:'home-progress',scene:'HomeScene'},
  {id:'game-short-columns',scene:'GameScene'}, {id:'game-long-columns',scene:'GameScene'}, {id:'game-free-cells-full',scene:'GameScene'},
  {id:'game-dragons-red-ready',scene:'GameScene'}, {id:'game-dragons-green-ready',scene:'GameScene'}, {id:'game-dragons-white-ready',scene:'GameScene'},
  {id:'game-auto-collect',scene:'GameScene'}, {id:'game-hint',scene:'GameScene'}, {id:'game-win',scene:'GameScene'},
  {id:'daily-unsolved',scene:'DailyScene'}, {id:'daily-solved',scene:'DailyScene'}, {id:'daily-replay',scene:'DailyScene'}, {id:'daily-archive',scene:'DailyScene'},
  {id:'mastery-novice',scene:'MasteryScene'}, {id:'mastery-mid',scene:'MasteryScene'}, {id:'mastery-master',scene:'MasteryScene'}, {id:'mastery-rank-up',scene:'MasteryScene'},
  {id:'leaderboard-loading',scene:'LeaderboardsScene'}, {id:'leaderboard-own',scene:'LeaderboardsScene'}, {id:'leaderboard-empty',scene:'LeaderboardsScene'}, {id:'leaderboard-unavailable',scene:'LeaderboardsScene'},
  {id:'settings-ru',scene:'SettingsScene'}, {id:'settings-en',scene:'SettingsScene'},
];

export const VISUAL_QA_SCENARIOS: readonly VisualQaScenario[] = Object.freeze(
  ALL_CAPTURE_FIXTURES.map(({id,scene}) => Object.freeze({ id, scene, fixture:id, viewports:'all' as const, ready:'scene-created' })),
);

export function getVisualQaScenario(id:string):VisualQaScenario|null {
  return VISUAL_QA_SCENARIOS.find((scenario)=>scenario.id===id) ?? null;
}
