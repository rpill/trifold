import type { TrifoldSnapshot } from '../model/types.ts';
import { findWinningProof, type HintSearchResult } from './HintSearch.ts';

export interface HintWorkerRequest {
  readonly id: number;
  readonly snapshot: TrifoldSnapshot;
  readonly maxNodes: number;
}

export interface HintWorkerResponse {
  readonly id: number;
  readonly result: HintSearchResult;
}

const workerScope = typeof self !== 'undefined' ? self : null;
if (workerScope) {
  workerScope.onmessage = (event: MessageEvent<HintWorkerRequest>): void => {
    const request = event.data;
    const response: HintWorkerResponse = {
      id: request.id,
      result: findWinningProof(request.snapshot, { maxNodes: request.maxNodes }),
    };
    workerScope.postMessage(response);
  };
}
