import type { PlayerCommand } from '../game/model/types.ts';

export interface TutorialScenario {
  readonly seed: number;
  readonly bootstrapCommands: readonly PlayerCommand[];
  readonly guidedCommands: readonly PlayerCommand[];
  readonly milestones: { readonly sequence: number; readonly freeCell: number; readonly flowerAuto: number; readonly foundationAuto: number; readonly dragons: number; readonly undoMove: number };
}

export const TUTORIAL_SCENARIO: TutorialScenario = Object.freeze({
  seed: 39650,
  bootstrapCommands: Object.freeze([
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 6,
      index: 4
    },
    target: {
      zone: "tableau",
      column: 2
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 6,
      index: 3
    },
    target: {
      zone: "tableau",
      column: 5
    }
  }
] satisfies PlayerCommand[]),
  guidedCommands: Object.freeze([
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 5,
      index: 4
    },
    target: {
      zone: "tableau",
      column: 2
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 7,
      index: 4
    },
    target: {
      zone: "free-cell",
      cell: 0
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 7,
      index: 3
    },
    target: {
      zone: "free-cell",
      cell: 1
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 0,
      index: 4
    },
    target: {
      zone: "free-cell",
      cell: 2
    }
  },
  {
    type: "move",
    source: {
      zone: "free-cell",
      cell: 1
    },
    target: {
      zone: "tableau",
      column: 0
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 4,
      index: 3
    },
    target: {
      zone: "free-cell",
      cell: 1
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 4,
      index: 2
    },
    target: {
      zone: "tableau",
      column: 0
    }
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 3,
      index: 4
    },
    target: {
      zone: "tableau",
      column: 5
    }
  },
  {
    type: "collect-dragons",
    family: "red"
  },
  {
    type: "move",
    source: {
      zone: "tableau",
      column: 7,
      index: 2
    },
    target: {
      zone: "free-cell",
      cell: 1
    }
  }
] satisfies PlayerCommand[]),
  milestones: Object.freeze({
  "sequence": 0,
  "freeCell": 1,
  "flowerAuto": 6,
  "foundationAuto": 7,
  "dragons": 8,
  "undoMove": 9
}),
});
