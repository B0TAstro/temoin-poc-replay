import type { ClientMessage, MatchState, PendingAction, Seat } from '../../shared/protocol.ts';

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/**
 * One match: two seats, the confirmed points, and at most one action waiting for the other
 * player's confirmation. Pure logic, no networking, so it can be unit tested.
 */
export class Room {
  readonly id: string;
  private points: Seat[] = [];
  private pending: PendingAction | null = null;
  private connected: [boolean, boolean] = [false, false];
  private nextActionId = 1;

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Seats a phone. A reconnecting phone asks for its previous seat; a new phone gets the first
   * free seat, Player 2 first since the host created the match on Player 1.
   * Returns null when the requested seat (or every seat) is taken.
   */
  join(seat?: Seat): Seat | null {
    const candidates: Seat[] = seat != null ? [seat] : [1, 0];
    const free = candidates.find((s) => !this.connected[s]);
    if (free == null) return null;
    this.connected[free] = true;
    return free;
  }

  leave(seat: Seat) {
    this.connected[seat] = false;
  }

  get isEmpty() {
    return !this.connected[0] && !this.connected[1];
  }

  /** Applies a message from `seat`. Returns an error message, or null when it was applied. */
  handle(seat: Seat, message: ClientMessage): string | null {
    switch (message.type) {
      case 'propose-point':
        if (this.pending) return 'Another action is waiting for confirmation';
        this.pending = { id: this.nextActionId++, proposedBy: seat, disputed: false, kind: 'point', winner: message.winner };
        return null;

      case 'propose-undo':
        if (this.pending) return 'Another action is waiting for confirmation';
        if (this.points.length === 0) return 'There is no point to undo';
        this.pending = { id: this.nextActionId++, proposedBy: seat, disputed: false, kind: 'undo' };
        return null;

      case 'confirm': {
        const error = this.checkAnswer(seat, message.actionId);
        if (error) return error;
        const action = this.pending!;
        if (action.kind === 'point') this.points.push(action.winner);
        else this.points.pop();
        this.pending = null;
        return null;
      }

      case 'dispute': {
        const error = this.checkAnswer(seat, message.actionId);
        if (error) return error;
        this.pending = { ...this.pending!, disputed: true };
        return null;
      }

      case 'cancel':
        if (!this.pending || this.pending.id !== message.actionId) return 'This action is no longer pending';
        this.pending = null;
        return null;

      default:
        return `Unexpected message "${message.type}" inside a match`;
    }
  }

  state(): MatchState {
    return {
      matchId: this.id,
      points: [...this.points],
      pending: this.pending,
      connected: [...this.connected],
    };
  }

  /** Confirm and dispute must come from the other player, about the current action. */
  private checkAnswer(seat: Seat, actionId: number): string | null {
    if (!this.pending || this.pending.id !== actionId) return 'This action is no longer pending';
    if (this.pending.proposedBy !== other(seat)) return 'Only the other player can answer';
    return null;
  }
}
