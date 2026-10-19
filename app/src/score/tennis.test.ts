import { describe, expect, it } from '@jest/globals';

import { type Player, pointLabels, scoreMatch, statusLabel } from './tennis';

/** n points in a row for `player`. */
const run = (player: Player, n: number): Player[] => Array.from({ length: n }, () => player);
/** A game won to love by `player`. */
const game = (player: Player) => run(player, 4);
/** `n` games in a row for `player`. */
const games = (player: Player, n: number) => Array.from({ length: n }, () => game(player)).flat();
/** Games alternating A, B, A, B… starting with `first`, `n` games in total. */
const alternate = (first: Player, n: number): Player[] =>
  Array.from({ length: n }, (_, i) => game(((first + i) % 2) as Player)).flat();

describe('points within a game', () => {
  it('starts at 0-0', () => {
    const score = scoreMatch([]);
    expect(pointLabels(score)).toEqual(['0', '0']);
    expect(score.games).toEqual([0, 0]);
    expect(score.sets).toEqual([]);
  });

  it('counts 15, 30, 40', () => {
    expect(pointLabels(scoreMatch([0]))).toEqual(['15', '0']);
    expect(pointLabels(scoreMatch([0, 0]))).toEqual(['30', '0']);
    expect(pointLabels(scoreMatch([0, 0, 0, 1]))).toEqual(['40', '15']);
  });

  it('wins a game from 40 with a 2-point lead', () => {
    const score = scoreMatch(game(1));
    expect(score.games).toEqual([0, 1]);
    expect(pointLabels(score)).toEqual(['0', '0']);
  });
});

describe('deuce and advantage', () => {
  const deuce: Player[] = [0, 0, 0, 1, 1, 1];

  it('shows deuce at 40-40', () => {
    const score = scoreMatch(deuce);
    expect(pointLabels(score)).toEqual(['40', '40']);
    expect(statusLabel(score)).toBe('Deuce');
  });

  it('gives advantage, then back to deuce', () => {
    expect(pointLabels(scoreMatch([...deuce, 0]))).toEqual(['AD', '40']);
    expect(statusLabel(scoreMatch([...deuce, 0]))).toBe('Advantage Player 1');
    expect(pointLabels(scoreMatch([...deuce, 0, 1]))).toEqual(['40', '40']);
    expect(pointLabels(scoreMatch([...deuce, 0, 1, 1]))).toEqual(['40', 'AD']);
  });

  it('wins the game from advantage', () => {
    const score = scoreMatch([...deuce, 0, 1, 1, 1]);
    expect(score.games).toEqual([0, 1]);
    expect(pointLabels(score)).toEqual(['0', '0']);
  });
});

describe('sets', () => {
  it('wins a set 6-4', () => {
    const score = scoreMatch([...alternate(0, 8), ...games(0, 2)]); // 4-4, then 6-4
    expect(score.sets).toEqual([{ games: [6, 4] }]);
    expect(score.games).toEqual([0, 0]);
  });

  it('does not end the set at 6-5', () => {
    const score = scoreMatch([...alternate(0, 10), ...game(0)]); // 5-5, then 6-5
    expect(score.sets).toEqual([]);
    expect(score.games).toEqual([6, 5]);
  });

  it('wins a set 7-5', () => {
    const score = scoreMatch([...alternate(0, 10), ...games(1, 2)]); // 5-5, then 5-7
    expect(score.sets).toEqual([{ games: [5, 7] }]);
  });
});

describe('tie-break', () => {
  const sixAll = alternate(0, 12);

  it('starts a tie-break at 6-6 and counts plain numbers', () => {
    const score = scoreMatch([...sixAll, 0, 0, 1]);
    expect(score.inTiebreak).toBe(true);
    expect(pointLabels(score)).toEqual(['2', '1']);
    expect(statusLabel(score)).toBe('Tie-break');
  });

  it('wins the tie-break 7-5 and the set 7-6', () => {
    const score = scoreMatch([...sixAll, ...run(0, 5), ...run(1, 5), 0, 0]);
    expect(score.sets).toEqual([{ games: [7, 6], tiebreak: [7, 5] }]);
    expect(score.inTiebreak).toBe(false);
  });

  it('needs a 2-point lead past 6-6', () => {
    const atSixSix = [...sixAll, ...run(0, 6), ...run(1, 6)];
    expect(scoreMatch([...atSixSix, 0]).sets).toEqual([]);
    expect(pointLabels(scoreMatch([...atSixSix, 0]))).toEqual(['7', '6']);
    const won = scoreMatch([...atSixSix, 0, 1, 1, 1]);
    expect(won.sets).toEqual([{ games: [6, 7], tiebreak: [7, 9] }]);
  });
});

describe('match', () => {
  it('is won in two straight sets (best of 3)', () => {
    const score = scoreMatch([...games(0, 6), ...games(0, 6)]);
    expect(score.winner).toBe(0);
    expect(score.sets).toEqual([{ games: [6, 0] }, { games: [6, 0] }]);
    expect(statusLabel(score)).toBe('Player 1 wins');
  });

  it('goes to a third set at one set all', () => {
    const score = scoreMatch([...games(0, 6), ...games(1, 6), ...games(1, 3)]);
    expect(score.winner).toBeUndefined();
    expect(score.sets).toHaveLength(2);
    expect(score.games).toEqual([0, 3]);
  });

  it('ignores points scored after the match is over', () => {
    const over = [...games(1, 6), ...games(1, 6)];
    expect(scoreMatch([...over, 0, 0])).toEqual(scoreMatch(over));
  });

  it('supports best of 5', () => {
    const twoSets = [...games(0, 6), ...games(0, 6)];
    expect(scoreMatch(twoSets, { setsToWin: 3 }).winner).toBeUndefined();
    expect(scoreMatch([...twoSets, ...games(0, 6)], { setsToWin: 3 }).winner).toBe(0);
  });
});

describe('undo', () => {
  it('brings back the game when the game-winning point is removed', () => {
    const beforeGame = scoreMatch(game(0).slice(0, -1));
    expect(beforeGame.games).toEqual([0, 0]);
    expect(pointLabels(beforeGame)).toEqual(['40', '0']);
  });

  it('brings back the set and the tie-break when the set-winning point is removed', () => {
    const tiebreak = [...alternate(0, 12), ...run(0, 7)];
    const beforeSet = scoreMatch(tiebreak.slice(0, -1));
    expect(beforeSet.sets).toEqual([]);
    expect(beforeSet.inTiebreak).toBe(true);
    expect(pointLabels(beforeSet)).toEqual(['6', '0']);
  });
});
