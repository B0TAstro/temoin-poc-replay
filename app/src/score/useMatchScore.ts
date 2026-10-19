import { useMemo, useState } from 'react';

import { type Player, scoreMatch } from './tennis';

/** Local match state: the list of point winners, from which the score is derived. */
export function useMatchScore() {
  const [pointWinners, setPointWinners] = useState<Player[]>([]);
  const score = useMemo(() => scoreMatch(pointWinners), [pointWinners]);

  const addPoint = (player: Player) => {
    if (score.winner != null) return;
    setPointWinners((points) => [...points, player]);
  };
  const undo = () => setPointWinners((points) => points.slice(0, -1));

  return { score, pointCount: pointWinners.length, addPoint, undo };
}
