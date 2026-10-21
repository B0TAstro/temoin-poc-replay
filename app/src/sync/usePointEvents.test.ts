import { describe, expect, it } from '@jest/globals';

import type { PendingAction } from '../../../shared/protocol';

import { diffPointEnds } from './usePointEvents';

const proposal = (winner: 0 | 1): PendingAction => ({ id: 1, proposedBy: 0, disputed: false, kind: 'point', winner });
const undo: PendingAction = { id: 2, proposedBy: 0, disputed: false, kind: 'undo' };

describe('point end events from the match state', () => {
  it('ends the point as soon as it is proposed, labelled with the score it was played at', () => {
    expect(diffPointEnds(1, [0], proposal(0))).toEqual({
      ended: [{ pointIndex: 1, label: 'Set 1 · Game 1 · 15-0' }],
      retracted: 0,
    });
  });

  it('emits nothing when the proposal is confirmed', () => {
    expect(diffPointEnds(2, [0, 0], null)).toEqual({ ended: [], retracted: 0 });
  });

  it('retracts the end when the proposal is cancelled', () => {
    expect(diffPointEnds(2, [0], null)).toEqual({ ended: [], retracted: 1 });
  });

  it('waits for an undo to be confirmed, then retracts', () => {
    expect(diffPointEnds(2, [0, 1], undo).retracted).toBe(0);
    expect(diffPointEnds(2, [0], null).retracted).toBe(1);
  });

  it('ends points one by one in solo (no proposal step)', () => {
    expect(diffPointEnds(0, [1], null).ended).toEqual([{ pointIndex: 0, label: 'Set 1 · Game 1 · 0-0' }]);
  });
});
