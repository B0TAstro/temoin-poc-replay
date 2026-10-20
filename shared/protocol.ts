/**
 * Messages exchanged between the phones and the relay server, as JSON over WebSocket.
 * Types only: both sides import this file with `import type`, so nothing is bundled.
 *
 * The server holds the canonical match state. A point (or an undo) proposed by one phone is only
 * applied once the other phone confirms it.
 */

/** 0 = Player 1, 1 = Player 2. Each phone sits on one seat. */
export type Seat = 0 | 1;

export type PendingAction = {
  id: number;
  proposedBy: Seat;
  /** The other player said no: both phones offer to open the replay. */
  disputed: boolean;
} & ({ kind: 'point'; winner: Seat } | { kind: 'undo' });

export type MatchState = {
  matchId: string;
  /** Confirmed point winners, in order. The score is derived from this list. */
  points: Seat[];
  pending: PendingAction | null;
  connected: [boolean, boolean];
};

export type ClientMessage =
  | { type: 'create' }
  /** `seat` is set when a phone reconnects, to get its seat back. */
  | { type: 'join'; matchId: string; seat?: Seat }
  | { type: 'propose-point'; winner: Seat }
  | { type: 'propose-undo' }
  | { type: 'confirm'; actionId: number }
  | { type: 'dispute'; actionId: number }
  | { type: 'cancel'; actionId: number };

export type ServerMessage =
  | { type: 'joined'; matchId: string; seat: Seat }
  | { type: 'state'; state: MatchState }
  | { type: 'error'; message: string };
