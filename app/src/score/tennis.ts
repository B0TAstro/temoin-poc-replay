/**
 * Tennis scoring, as pure functions.
 *
 * The match is stored as the ordered list of who won each point; the score is recomputed from it.
 * Undo is just dropping the last point, and syncing two phones only means agreeing on that list.
 */

export type Player = 0 | 1;
export type Pair = [number, number];

export type MatchConfig = {
  /** Sets needed to win the match: 2 for best of 3, 3 for best of 5. */
  setsToWin: number;
  /** Games needed to win a set (with a 2-game lead). */
  gamesPerSet: number;
  /** Points needed to win a tie-break (with a 2-point lead), played at gamesPerSet all. */
  tiebreakPoints: number;
};

export const DEFAULT_CONFIG: MatchConfig = { setsToWin: 2, gamesPerSet: 6, tiebreakPoints: 7 };

export type SetScore = {
  games: Pair;
  /** Tie-break points, when the set went to a tie-break. */
  tiebreak?: Pair;
};

export type Score = {
  /** Finished sets, in order. */
  sets: SetScore[];
  /** Games in the current set. */
  games: Pair;
  /** Points in the current game (raw count: 0, 1, 2, 3, …) or in the tie-break. */
  points: Pair;
  inTiebreak: boolean;
  winner?: Player;
};

const other = (player: Player): Player => (player === 0 ? 1 : 0);

const withPoint = (pair: Pair, player: Player): Pair =>
  player === 0 ? [pair[0] + 1, pair[1]] : [pair[0], pair[1] + 1];

/** First to `target` with a lead of at least 2. */
const hasWon = (pair: Pair, player: Player, target: number) =>
  pair[player] >= target && pair[player] - pair[other(player)] >= 2;

const emptyScore = (): Score => ({ sets: [], games: [0, 0], points: [0, 0], inTiebreak: false });

/** Applies one point won by `player`. Points after the end of the match are ignored. */
export function addPoint(score: Score, player: Player, config: MatchConfig = DEFAULT_CONFIG): Score {
  if (score.winner != null) return score;

  const points = withPoint(score.points, player);
  const gameTarget = score.inTiebreak ? config.tiebreakPoints : 4;
  if (!hasWon(points, player, gameTarget)) return { ...score, points };

  // Game (or tie-break) won.
  const games = withPoint(score.games, player);
  const setWon = score.inTiebreak || hasWon(games, player, config.gamesPerSet);
  if (!setWon) {
    const tiebreakNext = games[0] === config.gamesPerSet && games[1] === config.gamesPerSet;
    return { ...score, games, points: [0, 0], inTiebreak: tiebreakNext };
  }

  const finishedSet: SetScore = score.inTiebreak ? { games, tiebreak: points } : { games };
  const sets = [...score.sets, finishedSet];
  const setsWon = sets.filter((s) => s.games[player] > s.games[other(player)]).length;
  return {
    sets,
    games: [0, 0],
    points: [0, 0],
    inTiebreak: false,
    winner: setsWon >= config.setsToWin ? player : undefined,
  };
}

/** Recomputes the full score from the ordered list of point winners. */
export function scoreMatch(pointWinners: readonly Player[], config: Partial<MatchConfig> = {}): Score {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return pointWinners.reduce((score, player) => addPoint(score, player, fullConfig), emptyScore());
}

const GAME_POINT_LABELS = ['0', '15', '30', '40'];

/** What to display for the current game: "0", "15", "30", "40", "AD", or tie-break numbers. */
export function pointLabels(score: Score): [string, string] {
  const [a, b] = score.points;
  if (score.inTiebreak) return [String(a), String(b)];
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40'];
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }
  return [GAME_POINT_LABELS[a], GAME_POINT_LABELS[b]];
}

/** A short status line: winner, tie-break, deuce or advantage. Empty when there is nothing to say. */
export function statusLabel(score: Score, names: [string, string] = ['Player 1', 'Player 2']): string {
  if (score.winner != null) return `${names[score.winner]} wins`;
  if (score.inTiebreak) return 'Tie-break';
  const [a, b] = score.points;
  if (a >= 3 && b >= 3) {
    if (a === b) return 'Deuce';
    return `Advantage ${names[a > b ? 0 : 1]}`;
  }
  return '';
}
